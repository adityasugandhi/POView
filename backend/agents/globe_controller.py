import asyncio
import json
import math
from collections.abc import AsyncGenerator

import polyline as polyline_lib
from google.adk.agents import BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event
from google.adk.events.event_actions import EventActions
from google.genai import types

from agents.json_utils import parse_json_from_text
from agents.models import CameraWaypoint, ExtractedPOI, VisualizationPlan
from services.places_service import get_directions

EXTRACT_POIS_INSTRUCTION = """You are a coordinate extraction specialist. Given a narrative text about a neighborhood, extract all specifically named places/POIs that include coordinates.

Return a JSON array of objects with these fields:
- "name": string (the place name)
- "latitude": number
- "longitude": number
- "relevance": string (brief reason this POI matters)

Extract ONLY places that have explicit or inferable coordinates from the text. Return valid JSON array only, no other text."""


class GlobeControllerAgent(BaseAgent):
    """Custom agent that computes camera waypoints for Cesium drone flights."""

    model: str = "gemini-2.5-flash"

    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        # 1. Read state
        raw_narrative = ctx.session.state.get("raw_narrative", "")
        origin_lat = ctx.session.state.get("origin_lat", 40.7128)
        origin_lng = ctx.session.state.get("origin_lng", -74.0060)

        # 2. Extract POIs via internal LLM call
        import os

        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        extract_response = client.models.generate_content(
            model=self.model,
            contents=f"Extract POIs from this narrative:\n\n{raw_narrative}",
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                system_instruction=EXTRACT_POIS_INSTRUCTION,
            ),
        )

        try:
            pois_data = parse_json_from_text(extract_response.text)
            if isinstance(pois_data, dict) and "pois" in pois_data:
                pois_data = pois_data["pois"]
            pois = [ExtractedPOI(**p) for p in pois_data[:5]]  # Cap at 5 POIs to match proximity_search count
        except Exception as e:
            print(f"POI extraction failed: {e}, using empty list")
            pois = []

        # 3. Compute deterministic camera waypoints with road-following
        waypoints = []

        # Waypoint 0: Establishing Shot — high altitude overview
        waypoints.append(CameraWaypoint(
            label="Overview",
            latitude=origin_lat,
            longitude=origin_lng,
            altitude=800,
            heading=0,
            pitch=-30,
            roll=0,
            duration=4.0,
            pause_after=2.0,
        ))

        # Build transition pairs for parallel route fetching
        if pois:
            # Descent waypoint: transition from overview to street level
            first_poi = pois[0]
            descent_heading = self._compute_heading(
                origin_lat, origin_lng, first_poi.latitude, first_poi.longitude
            )
            waypoints.append(CameraWaypoint(
                label="Descent",
                latitude=origin_lat,
                longitude=origin_lng,
                altitude=200,
                heading=descent_heading,
                pitch=-25,
                roll=0,
                duration=3.0,
                pause_after=0.5,
            ))

            # Build route pairs: origin→POI1, POI1→POI2, ...
            route_pairs = []
            prev_lat, prev_lng = origin_lat, origin_lng
            for poi in pois:
                route_pairs.append((prev_lat, prev_lng, poi.latitude, poi.longitude))
                prev_lat, prev_lng = poi.latitude, poi.longitude

            # Fetch all routes in parallel
            encoded_routes = await asyncio.gather(
                *[get_directions(olat, olng, dlat, dlng)
                  for olat, olng, dlat, dlng in route_pairs],
                return_exceptions=True,
            )

            # Insert transit + POI waypoints for each segment
            for i, poi in enumerate(pois):
                # Decode polyline for this segment
                encoded = encoded_routes[i]
                decoded_path = []
                if isinstance(encoded, str) and encoded:
                    try:
                        decoded_path = polyline_lib.decode(encoded)
                    except Exception as e:
                        print(f"Polyline decode failed for {poi.name}: {e}")

                # Add transit waypoints from road path
                if decoded_path:
                    transit_wps = self._build_transit_waypoints(
                        decoded_path, poi.name
                    )
                    waypoints.extend(transit_wps)

                # Determine approach bearing from decoded path or fallback
                if len(decoded_path) >= 2:
                    pen_lat, pen_lng = decoded_path[-2]
                    approach_bearing = self._compute_heading(
                        pen_lat, pen_lng, poi.latitude, poi.longitude
                    )
                elif i > 0:
                    prev_poi = pois[i - 1]
                    approach_bearing = self._compute_heading(
                        prev_poi.latitude, prev_poi.longitude,
                        poi.latitude, poi.longitude,
                    )
                else:
                    approach_bearing = self._compute_heading(
                        origin_lat, origin_lng,
                        poi.latitude, poi.longitude,
                    )

                # Reverse bearing to position camera in front of building
                reversed_bearing = (approach_bearing + 180) % 360

                # Offset camera 100m from building along reversed bearing
                cam_lat, cam_lng = self._offset_point(
                    poi.latitude, poi.longitude, reversed_bearing, 100
                )

                # Face camera toward the building facade
                face_heading = self._compute_heading(
                    cam_lat, cam_lng, poi.latitude, poi.longitude
                )

                waypoints.append(CameraWaypoint(
                    label=poi.name,
                    latitude=cam_lat,
                    longitude=cam_lng,
                    altitude=40,
                    heading=face_heading,
                    pitch=-12,
                    roll=0,
                    duration=3.0,
                    pause_after=1.5,
                ))

        # Final Waypoint: Return to origin at medium altitude
        waypoints.append(CameraWaypoint(
            label="Return",
            latitude=origin_lat,
            longitude=origin_lng,
            altitude=400,
            heading=0,
            pitch=-35,
            roll=0,
            duration=3.5,
            pause_after=1.0,
        ))

        total_duration = sum(wp.duration + wp.pause_after for wp in waypoints)
        plan = VisualizationPlan(waypoints=waypoints, total_duration=total_duration)

        # 4. Store in session state via EventActions for proper ADK tracking
        plan_data = plan.model_dump()

        yield Event(
            author=self.name,
            content=types.Content(
                parts=[types.Part(text=json.dumps(plan_data))],
                role="model",
            ),
            actions=EventActions(
                state_delta={"visualization_plan": plan_data},
            ),
        )

    def _build_transit_waypoints(
        self, decoded: list[tuple[float, float]], dest_name: str
    ) -> list[CameraWaypoint]:
        """Return intermediate road-following waypoints from a decoded polyline."""
        sampled = self._sample_road_points(decoded, max_points=3)
        if not sampled:
            return []

        transit_waypoints = []
        for idx, (lat, lng) in enumerate(sampled):
            # Compute heading toward next sample point or destination
            if idx + 1 < len(sampled):
                next_lat, next_lng = sampled[idx + 1]
            else:
                # Last sample: heading toward the decoded path end
                next_lat, next_lng = decoded[-1]
            heading = self._compute_heading(lat, lng, next_lat, next_lng)

            transit_waypoints.append(CameraWaypoint(
                label=f"Transit to {dest_name} ({idx + 1})",
                latitude=lat,
                longitude=lng,
                altitude=90,
                heading=heading,
                pitch=-15,
                roll=0,
                duration=2.0,
                pause_after=0.2,
            ))

        return transit_waypoints

    @staticmethod
    def _sample_road_points(
        decoded_path: list[tuple[float, float]], max_points: int = 3
    ) -> list[tuple[float, float]]:
        """Sample evenly-spaced intermediate points along a decoded polyline.

        Skips first and last points (those are the origin/destination).
        Returns empty list if path is too short to sample meaningfully.
        """
        if len(decoded_path) < 4:
            return []

        # Compute cumulative distances
        cum_dist = [0.0]
        for i in range(1, len(decoded_path)):
            lat1, lng1 = decoded_path[i - 1]
            lat2, lng2 = decoded_path[i]
            d = math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2)
            cum_dist.append(cum_dist[-1] + d)

        total = cum_dist[-1]
        if total < 1e-8:
            return []

        # Pick evenly spaced target distances (excluding start/end)
        samples = []
        for k in range(1, max_points + 1):
            target = total * k / (max_points + 1)
            # Binary search for the segment containing this distance
            for j in range(1, len(cum_dist)):
                if cum_dist[j] >= target:
                    # Interpolate between j-1 and j
                    seg_len = cum_dist[j] - cum_dist[j - 1]
                    if seg_len < 1e-12:
                        samples.append(decoded_path[j])
                    else:
                        frac = (target - cum_dist[j - 1]) / seg_len
                        lat1, lng1 = decoded_path[j - 1]
                        lat2, lng2 = decoded_path[j]
                        interp_lat = lat1 + frac * (lat2 - lat1)
                        interp_lng = lng1 + frac * (lng2 - lng1)
                        samples.append((interp_lat, interp_lng))
                    break

        return samples

    @staticmethod
    def _compute_heading(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Compute compass heading from point 1 to point 2 in degrees."""
        lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
        dlng = math.radians(lng2 - lng1)
        x = math.sin(dlng) * math.cos(lat2_r)
        y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlng)
        heading = math.degrees(math.atan2(x, y))
        return (heading + 360) % 360

    @staticmethod
    def _offset_point(lat: float, lng: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
        """Compute a new lat/lng by moving from a point along a bearing by distance in meters."""
        R = 6_371_000  # Earth radius in meters
        lat_r = math.radians(lat)
        lng_r = math.radians(lng)
        bearing_r = math.radians(bearing_deg)
        d = distance_m / R

        new_lat = math.asin(
            math.sin(lat_r) * math.cos(d) +
            math.cos(lat_r) * math.sin(d) * math.cos(bearing_r)
        )
        new_lng = lng_r + math.atan2(
            math.sin(bearing_r) * math.sin(d) * math.cos(lat_r),
            math.cos(d) - math.sin(lat_r) * math.sin(new_lat)
        )
        return math.degrees(new_lat), math.degrees(new_lng)
