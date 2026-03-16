import json

from google.adk.agents import SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.formatter import create_formatter_agent
from agents.globe_controller import GlobeControllerAgent
from agents.json_utils import parse_json_from_text
from agents.narration_planner import (
    create_narration_planner_agent,
    post_process_narration_timeline,
)
from agents.script_writer import create_script_writer_agent


def _build_sequential_agent() -> SequentialAgent:
    """Builds the 3-agent sequential workflow (legacy, backward-compat)."""
    return SequentialAgent(
        name="NeighborhoodNarrativeAgent",
        sub_agents=[
            create_script_writer_agent(),
            GlobeControllerAgent(name="GlobeControllerAgent"),
            create_formatter_agent(),
        ],
    )


def _build_narrated_tour_agent() -> SequentialAgent:
    """Builds the 4-agent sequential workflow with NarrationPlanner."""
    return SequentialAgent(
        name="NarratedTourAgent",
        sub_agents=[
            create_script_writer_agent(),
            GlobeControllerAgent(name="GlobeControllerAgent"),
            create_narration_planner_agent(),
            create_formatter_agent(),
        ],
    )


async def run_neighborhood_workflow(
    place_id: str,
    location_details: dict,
    nearby_places: list,
    weather: dict,
    intent: str = None,
) -> dict:
    """Runs the full 3-agent neighborhood profiling workflow.

    Returns: { "profile_data": dict, "visualization_plan": dict }
    """
    # Extract coordinates
    lat = location_details.get("geometry", {}).get("location", {}).get("lat", 0)
    lng = location_details.get("geometry", {}).get("location", {}).get("lng", 0)

    # Format context for the agents
    location_name = location_details.get("name", "Unknown Location")
    address = location_details.get("formatted_address", "")

    nearby_summary = []
    for p in (nearby_places or [])[:15]:
        name = p.get("name", "")
        types_list = p.get("types", [])
        rating = p.get("rating", "N/A")
        nearby_summary.append(f"- {name} (types: {', '.join(types_list[:3])}, rating: {rating})")
    nearby_text = "\n".join(nearby_summary) if nearby_summary else "Limited data available."

    weather_summary = weather.get("ai_summary", "Weather data unavailable.")
    intent_text = f"User's search intent: '{intent}'" if intent else "General neighborhood exploration."

    context_payload = f"""Location: {location_name}
Address: {address}
Coordinates: ({lat}, {lng})

{intent_text}

Current Weather: {weather_summary}

Nearby Places:
{nearby_text}"""

    # Build and run the agent pipeline
    agent = _build_sequential_agent()
    session_service = InMemorySessionService()

    session = await session_service.create_session(
        app_name="poview",
        user_id="poview_user",
        state={
            "origin_lat": lat,
            "origin_lng": lng,
            "context_payload": context_payload,
            "weather_summary": weather_summary,
            "intent": intent or "general exploration",
        },
    )

    runner = Runner(
        agent=agent,
        app_name="poview",
        session_service=session_service,
    )

    # Run the sequential agent pipeline
    final_event = None
    async for event in runner.run_async(
        user_id="poview_user",
        session_id=session.id,
        new_message=types.Content(
            parts=[types.Part(text=context_payload)],
            role="user",
        ),
    ):
        final_event = event

    # Extract results from session state
    updated_session = await session_service.get_session(
        app_name="poview",
        user_id="poview_user",
        session_id=session.id,
    )

    state = updated_session.state if updated_session else {}

    # Parse the final UI payload
    raw_payload = state.get("final_ui_payload", "{}")
    if isinstance(raw_payload, str):
        try:
            profile_data = parse_json_from_text(raw_payload)
        except Exception:
            profile_data = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
    else:
        profile_data = raw_payload

    visualization_plan = state.get("visualization_plan", {"waypoints": [], "total_duration": 0})

    return {
        "profile_data": profile_data,
        "visualization_plan": visualization_plan,
    }


async def run_narrated_tour_workflow(
    place_id: str,
    location_details: dict,
    nearby_places: list,
    weather: dict,
    intent: str = None,
) -> dict:
    """Runs the 4-agent narrated tour workflow.

    Returns: { "profile_data": dict, "visualization_plan": dict, "narration_timeline": dict }
    """
    lat = location_details.get("geometry", {}).get("location", {}).get("lat", 0)
    lng = location_details.get("geometry", {}).get("location", {}).get("lng", 0)

    location_name = location_details.get("name", "Unknown Location")
    address = location_details.get("formatted_address", "")

    nearby_summary = []
    for p in (nearby_places or [])[:15]:
        name = p.get("name", "")
        types_list = p.get("types", [])
        rating = p.get("rating", "N/A")
        nearby_summary.append(f"- {name} (types: {', '.join(types_list[:3])}, rating: {rating})")
    nearby_text = "\n".join(nearby_summary) if nearby_summary else "Limited data available."

    weather_summary = weather.get("ai_summary", "Weather data unavailable.")
    intent_text = f"User's search intent: '{intent}'" if intent else "General neighborhood exploration."

    context_payload = f"""Location: {location_name}
Address: {address}
Coordinates: ({lat}, {lng})

{intent_text}

Current Weather: {weather_summary}

Nearby Places:
{nearby_text}"""

    agent = _build_narrated_tour_agent()
    session_service = InMemorySessionService()

    session = await session_service.create_session(
        app_name="poview",
        user_id="poview_tour",
        state={
            "origin_lat": lat,
            "origin_lng": lng,
            "context_payload": context_payload,
            "weather_summary": weather_summary,
            "intent": intent or "general exploration",
        },
    )

    runner = Runner(
        agent=agent,
        app_name="poview",
        session_service=session_service,
    )

    async for event in runner.run_async(
        user_id="poview_tour",
        session_id=session.id,
        new_message=types.Content(
            parts=[types.Part(text=context_payload)],
            role="user",
        ),
    ):
        pass

    updated_session = await session_service.get_session(
        app_name="poview",
        user_id="poview_tour",
        session_id=session.id,
    )

    state = updated_session.state if updated_session else {}

    # Parse profile
    raw_payload = state.get("final_ui_payload", "{}")
    if isinstance(raw_payload, str):
        try:
            profile_data = parse_json_from_text(raw_payload)
        except Exception:
            profile_data = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
    else:
        profile_data = raw_payload

    visualization_plan = state.get("visualization_plan", {"waypoints": [], "total_duration": 0})
    waypoints = visualization_plan.get("waypoints", []) if isinstance(visualization_plan, dict) else []

    # Parse and post-process narration timeline
    raw_timeline = state.get("narration_timeline_raw", "{}")
    narration_timeline = post_process_narration_timeline(
        raw_json=raw_timeline if isinstance(raw_timeline, str) else json.dumps(raw_timeline),
        place_name=location_name,
        place_id=place_id,
        intent=intent or "",
        weather_data=weather or {},
        waypoints=waypoints,
    )

    return {
        "profile_data": profile_data,
        "visualization_plan": visualization_plan,
        "narration_timeline": narration_timeline,
    }
