"""Tool wrappers that bridge the Live conversational agent to existing POView services."""

import json
import asyncio
from services.places_service import (
    get_autocomplete_predictions,
    get_places_details,
    get_nearby_places,
    contextual_places_search,
)
from services.gemini_client import parse_contextual_intent
from services.weather_service import fetch_weather_forecast
from services.streaming_workflow import (
    run_streaming_workflow,
    run_streaming_recommendations,
    run_streaming_tour_recommendations,
)
from agents.waypoint_utils import compute_waypoints_for_places
import contextvars

# Context variable used to track the current active session in live tools
current_session_id = contextvars.ContextVar("current_session_id", default=None)
active_ws_senders = {}

def _get_ws_sender():
    """Retrieve the active WebSocket sender based on the current context."""
    sess_id = current_session_id.get()
    sender = active_ws_senders.get(sess_id)
    return sender if sender else lambda msg: None
from services.narration_generator import generate_place_narrations
from agents.narration_planner import compute_trajectory_timestamps


async def fly_to_location(place_query: str, current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Fly the camera to a location on the 3D globe AND discover nearby points of
    interest. The camera moves while POI data loads in parallel, so 3D pins and
    details appear by the time the fly-by completes.

    Args:
        place_query: The name of the place (e.g. "Manhattan", "Times Square", "Tokyo").
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    predictions = await get_autocomplete_predictions(place_query, lat=current_lat, lng=current_lng)
    if not predictions:
        return {"error": f"Could not find '{place_query}'."}

    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place."}

    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        return {"error": "Could not retrieve location details."}

    lat = location_details["geometry"].get("location", {}).get("lat")
    lng = location_details["geometry"].get("location", {}).get("lng")

    # Fetch nearby POIs in parallel so pins render during the fly-by
    nearby_places = []
    try:
        nearby_places = await get_nearby_places(lat, lng)
    except Exception:
        pass  # Non-critical — camera still flies

    # Build lightweight recommendations from nearby places
    recommendations = []
    for place in (nearby_places or [])[:8]:
        p_lat = place.get("geometry", {}).get("location", {}).get("lat")
        p_lng = place.get("geometry", {}).get("location", {}).get("lng")
        if p_lat and p_lng:
            recommendations.append({
                "name": place.get("name", ""),
                "lat": p_lat,
                "lng": p_lng,
                "rating": place.get("rating", 0),
                "ratingCount": place.get("user_ratings_total", 0),
                "description": ", ".join(
                    t.replace("_", " ") for t in place.get("types", [])[:3]
                ),
                "address": place.get("vicinity", ""),
                "photoUrls": [],
            })

    return {
        "action": "fly_to",
        "place_id": place_id,
        "place_name": location_details.get("name", place_query),
        "location": {"lat": lat, "lng": lng},
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "recommendations": recommendations,
    }


async def search_neighborhood(place_query: str, intent: str = "general exploration", current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Deep neighborhood analysis with profile data, scores, highlights, and drone
    tour waypoints. This is SLOW (10-20 seconds). Only call this when the user
    explicitly asks for analysis, details, or a tour — NOT for simple navigation.

    Args:
        place_query: The name or description of the place (e.g. "Williamsburg Brooklyn",
                     "Times Square", "coffee shops near SoHo").
        intent: What the user wants to explore (e.g. "nightlife", "family activities",
                "best coffee spots"). Defaults to general exploration.
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    # 1. Autocomplete to resolve a place_id
    predictions = await get_autocomplete_predictions(place_query, lat=current_lat, lng=current_lng)
    if not predictions:
        return {"error": f"Could not find a location matching '{place_query}'. Try a more specific name."}

    # Extract place_id from first prediction
    first = predictions[0]
    place_id = first.get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place ID from autocomplete."}

    # 2. Get full place details to fetch place_name quickly
    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("name"):
        place_name = place_query
    else:
        place_name = location_details.get("name")

    # 3. Launch the streaming pipeline in the background
    asyncio.create_task(
        run_streaming_workflow(
            place_id=place_id,
            intent=intent,
            send_to_frontend=_get_ws_sender(),
            workflow_type="neighborhood"
        )
    )

    # 4. Return lightweight ack immediately (< 1s total tool time)
    return {
        "status": "analysis_started",
        "place_name": place_name,
        "message": f"Analysis of {place_name} is underway. Results will stream progressively."
    }


async def get_recommendations(place_query: str, intent: str, radius: float = 1.0, current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Get specific place recommendations near a location. Use this when the user
    asks for recommendations like restaurants, cafes, parks, etc.

    Args:
        place_query: The location name to search near (e.g. "Williamsburg Brooklyn").
        intent: What type of places to find (e.g. "best pizza", "quiet parks", "live music venues").
        radius: Search radius in miles (0.1 to 50.0). Default 1.0 mile. Use larger values (5-20) for broad city-wide searches, smaller values (0.5-2) for hyper-local results.
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    # 1. Autocomplete to resolve place quickly for the immediate response
    predictions = await get_autocomplete_predictions(place_query)
    if not predictions:
        return {"error": f"Could not find '{place_query}'."}

    place_name = place_query

    # 2. Launch the streaming pipeline in the background
    asyncio.create_task(
        run_streaming_recommendations(
            place_query=place_query,
            intent=intent,
            radius=radius,
            send_to_frontend=_get_ws_sender()
        )
    )

    # 3. Return lightweight ack immediately
    return {
        "status": "analysis_started",
        "place_name": place_name,
        "message": f"Finding recommendations near {place_name}. Results will stream progressively.",
        "action": "get_recommendations"
    }


async def start_drone_tour(place_query: str) -> dict:
    """Start a cinematic drone flyover tour of a neighborhood. Call this when the user
    asks for a drone tour, flyover, or wants to see the area from above.

    Args:
        place_query: The location to fly over (e.g. "Williamsburg Brooklyn").
    """
    # This triggers the frontend to start the drone tour animation.
    # The visualization_plan waypoints come from the neighborhood search.
    return {
        "action": "start_drone_tour",
        "place_query": place_query,
        "message": "Starting drone tour! The camera will fly over the key points of interest.",
    }


async def start_narrated_tour(place_query: str, intent: str = "general exploration", current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Start a synchronized narrated drone tour with voice narration aligned to camera
    movements. Call this when the user wants a guided tour, narrated flyover, or
    immersive exploration of a neighborhood.

    Args:
        place_query: The location to tour (e.g. "Williamsburg Brooklyn").
        intent: What aspect to focus on (e.g. "nightlife", "food scene", "family-friendly").
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    # 1. Resolve location
    predictions = await get_autocomplete_predictions(place_query, lat=current_lat, lng=current_lng)
    if not predictions:
        return {"error": f"Could not find a location matching '{place_query}'."}

    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place ID."}

    # 2. Get location details quickly
    location_details = await get_places_details(place_id)
    place_name = location_details.get("name") if location_details else place_query

    # 3. Launch the streaming pipeline in the background
    asyncio.create_task(
        run_streaming_workflow(
            place_id=place_id,
            intent=intent,
            send_to_frontend=_get_ws_sender(),
            workflow_type="narrated_tour"
        )
    )

    return {
        "status": "analysis_started",
        "place_name": place_name,
        "message": f"Planning narrated tour of {place_name}. Results will stream progressively.",
        "action": "start_narrated_tour"
    }


async def tour_recommendations(place_query: str, intent: str, radius: float = 1.0, current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Find recommended places near a location AND start a narrated drone tour
    visiting each one. Use this when the user wants to both discover places AND
    take a guided flyover — e.g. "show me the best cafes near Times Square
    and fly me through them" or "find parks near SoHo and give me a tour."

    Args:
        place_query: The area to search in (e.g. "Times Square Manhattan").
        intent: What type of places to find and tour (e.g. "best cafes", "rooftop bars").
        radius: Search radius in miles (0.1 to 50.0). Default 1.0 mile. Use larger values (5-20) for broad city-wide searches, smaller values (0.5-2) for hyper-local results.
    """
    # 1. Autocomplete to resolve place quickly
    predictions = await get_autocomplete_predictions(place_query)
    if not predictions:
        return {"error": f"Could not find '{place_query}'."}
        
    place_name = place_query

    # 2. Launch the streaming pipeline in the background
    asyncio.create_task(
        run_streaming_tour_recommendations(
            place_query=place_query,
            intent=intent,
            radius=radius,
            send_to_frontend=_get_ws_sender()
        )
    )

    # 3. Return lightweight ack immediately
    return {
        "status": "analysis_started",
        "place_name": place_name,
        "message": f"Planning recommended tour of {place_name}. Results will stream progressively.",
        "action": "tour_recommendations"
    }
