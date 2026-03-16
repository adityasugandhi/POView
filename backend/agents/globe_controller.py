import json
from typing import AsyncGenerator
from google.adk.agents import BaseAgent, LlmAgent
from google.adk.agents.invocation_context import InvocationContext
from google.genai import types
from google.adk.events import Event
from google.adk.events.event_actions import EventActions
from agents.models import VisualizationPlan, ExtractedPOI
from agents.json_utils import parse_json_from_text
from agents.waypoint_utils import compute_waypoints_for_places


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
        from google import genai
        import os

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
        places_dicts = [{"name": p.name, "lat": p.latitude, "lng": p.longitude} for p in pois]
        waypoints = await compute_waypoints_for_places(origin_lat, origin_lng, places_dicts)

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

