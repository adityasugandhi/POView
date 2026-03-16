import math
import asyncio
from typing import List, Tuple
import polyline as polyline_lib
from agents.models import CameraWaypoint
from services.places_service import get_directions


def compute_heading(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute compass heading from point 1 to point 2 in degrees."""
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlng = math.radians(lng2 - lng1)
    x = math.sin(dlng) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlng)
    heading = math.degrees(math.atan2(x, y))
    return (heading + 360) % 360


def offset_point(lat: float, lng: float, bearing_deg: float, distance_m: float) -> Tuple[float, float]:
    """Compute a new lat/lng by moving from a point along a bearing by distance in meters."""
    R = 6_371_000
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


def sample_road_points(
    decoded_path: List[Tuple[float, float]], max_points: int = 3
) -> List[Tuple[float, float]]:
    """Sample evenly-spaced intermediate points along a decoded polyline.

    Skips first and last points (those are the origin/destination).
    Returns empty list if path is too short to sample meaningfully.
    """
    if len(decoded_path) < 4:
        return []

    cum_dist = [0.0]
    for i in range(1, len(decoded_path)):
        lat1, lng1 = decoded_path[i - 1]
        lat2, lng2 = decoded_path[i]
        d = math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2)
        cum_dist.append(cum_dist[-1] + d)

    total = cum_dist[-1]
    if total < 1e-8:
        return []

    samples = []
    for k in range(1, max_points + 1):
        target = total * k / (max_points + 1)
        for j in range(1, len(cum_dist)):
            if cum_dist[j] >= target:
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


def build_transit_waypoints(
    decoded: List[Tuple[float, float]], dest_name: str
) -> List[CameraWaypoint]:
    """Return intermediate road-following waypoints from a decoded polyline."""
    sampled = sample_road_points(decoded, max_points=3)
    if not sampled:
        return []

    transit_waypoints = []
    for idx, (lat, lng) in enumerate(sampled):
        if idx + 1 < len(sampled):
            next_lat, next_lng = sampled[idx + 1]
        else:
            next_lat, next_lng = decoded[-1]
        heading = compute_heading(lat, lng, next_lat, next_lng)

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


async def compute_waypoints_for_places(
    origin_lat: float,
    origin_lng: float,
    places: List[dict],
) -> List[CameraWaypoint]:
    """Compute deterministic camera waypoints for a list of places.

    Args:
        origin_lat/lng: Center of the area.
        places: List of dicts with 'name', 'lat', 'lng' keys.

    Returns: [Overview, Descent, (Transit+POI)*N, Return]
    """
    places = places[:5]
    waypoints = []

    # Overview
    waypoints.append(CameraWaypoint(
        label="Overview", latitude=origin_lat, longitude=origin_lng,
        altitude=800, heading=0, pitch=-30, roll=0, duration=4.0, pause_after=2.0,
    ))

    if not places:
        waypoints.append(CameraWaypoint(
            label="Return", latitude=origin_lat, longitude=origin_lng,
            altitude=400, heading=0, pitch=-35, roll=0, duration=3.5, pause_after=1.0,
        ))
        return waypoints

    # Descent
    first = places[0]
    descent_heading = compute_heading(origin_lat, origin_lng, first["lat"], first["lng"])
    waypoints.append(CameraWaypoint(
        label="Descent", latitude=origin_lat, longitude=origin_lng,
        altitude=200, heading=descent_heading, pitch=-25, roll=0, duration=3.0, pause_after=0.5,
    ))

    # Fetch all routes in parallel
    route_pairs = []
    prev_lat, prev_lng = origin_lat, origin_lng
    for p in places:
        route_pairs.append((prev_lat, prev_lng, p["lat"], p["lng"]))
        prev_lat, prev_lng = p["lat"], p["lng"]

    encoded_routes = await asyncio.gather(
        *[get_directions(olat, olng, dlat, dlng) for olat, olng, dlat, dlng in route_pairs],
        return_exceptions=True,
    )

    # Transit + POI for each place
    for i, place in enumerate(places):
        encoded = encoded_routes[i]
        decoded_path = []
        if isinstance(encoded, str) and encoded:
            try:
                decoded_path = polyline_lib.decode(encoded)
            except Exception:
                pass

        if decoded_path:
            waypoints.extend(build_transit_waypoints(decoded_path, place["name"]))

        # Approach bearing
        if len(decoded_path) >= 2:
            pen_lat, pen_lng = decoded_path[-2]
            approach = compute_heading(pen_lat, pen_lng, place["lat"], place["lng"])
        elif i > 0:
            prev = places[i - 1]
            approach = compute_heading(prev["lat"], prev["lng"], place["lat"], place["lng"])
        else:
            approach = compute_heading(origin_lat, origin_lng, place["lat"], place["lng"])

        reversed_bearing = (approach + 180) % 360
        cam_lat, cam_lng = offset_point(place["lat"], place["lng"], reversed_bearing, 100)
        face_heading = compute_heading(cam_lat, cam_lng, place["lat"], place["lng"])

        waypoints.append(CameraWaypoint(
            label=place["name"], latitude=cam_lat, longitude=cam_lng,
            altitude=40, heading=face_heading, pitch=-12, roll=0, duration=3.0, pause_after=1.5,
        ))

    # Return
    waypoints.append(CameraWaypoint(
        label="Return", latitude=origin_lat, longitude=origin_lng,
        altitude=400, heading=0, pitch=-35, roll=0, duration=3.5, pause_after=1.0,
    ))

    return waypoints
