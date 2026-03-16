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
from agents.workflow import run_neighborhood_workflow, run_narrated_tour_workflow
from agents.waypoint_utils import compute_waypoints_for_places
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

    # 2. Get full place details
    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        return {"error": "Could not retrieve location details."}

    lat = location_details["geometry"].get("location", {}).get("lat")
    lng = location_details["geometry"].get("location", {}).get("lng")
    if not lat or not lng:
        return {"error": "Location geometry is invalid."}

    # 3. Get nearby places and weather in parallel
    nearby_places, weather = await asyncio.gather(
        get_nearby_places(lat, lng),
        fetch_weather_forecast(lat, lng),
    )

    # 4. Run the full agent workflow
    try:
        result = await run_neighborhood_workflow(
            place_id=place_id,
            location_details=location_details,
            nearby_places=nearby_places,
            weather=weather,
            intent=intent,
        )
    except Exception as e:
        return {"error": f"Neighborhood analysis failed: {str(e)}"}

    profile_data = result.get("profile_data", {})
    visualization_plan = result.get("visualization_plan", {})

    return {
        "place_id": place_id,
        "place_name": location_details.get("name", place_query),
        "location": {"lat": lat, "lng": lng},
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "weather": weather,
        "profile": profile_data,
        "visualization_plan": visualization_plan,
    }


async def get_recommendations(place_query: str, intent: str, radius: float = 0.4, current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Get specific place recommendations near a location. Use this when the user
    asks for recommendations like restaurants, cafes, parks, etc.

    Args:
        place_query: The location name to search near (e.g. "Williamsburg Brooklyn").
        intent: What type of places to find (e.g. "best pizza", "quiet parks", "live music venues").
        radius: Search radius in miles (0.1 to 1.0). Default 0.4 miles.
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    # 1. Resolve location
    predictions = await get_autocomplete_predictions(place_query, lat=current_lat, lng=current_lng)
    if not predictions:
        return {"error": f"Could not find '{place_query}'."}

    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place."}

    # 2. Get location details and parse intent in parallel
    location_details, intent_parsed_result = await asyncio.gather(
        get_places_details(place_id),
        parse_contextual_intent(intent),
        return_exceptions=True,
    )

    if isinstance(location_details, Exception) or not location_details or not location_details.get("geometry"):
        return {"error": "Could not get location details."}

    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]

    # Extract keywords from parallel intent parse
    if isinstance(intent_parsed_result, Exception):
        keywords = [intent]
    else:
        keywords = intent_parsed_result.get("keywords", [intent])

    # 3. Search for places
    results = await contextual_places_search(lat, lng, radius, keywords)
    if not results:
        return {"error": "No matching places found in that area."}

    return {
        "place_query": place_query,
        "intent": intent,
        "location": {"lat": lat, "lng": lng},
        "recommendations": results,
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

    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        return {"error": "Could not retrieve location details."}

    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]

    # 2. Get nearby places and weather
    nearby_places, weather = await asyncio.gather(
        get_nearby_places(lat, lng),
        fetch_weather_forecast(lat, lng),
    )

    # 3. Run the enhanced 4-agent narrated tour pipeline
    try:
        result = await run_narrated_tour_workflow(
            place_id=place_id,
            location_details=location_details,
            nearby_places=nearby_places,
            weather=weather,
            intent=intent,
        )
    except Exception as e:
        return {"error": f"Narrated tour generation failed: {str(e)}"}

    return {
        "action": "start_narrated_tour",
        "place_id": place_id,
        "place_name": location_details.get("name", place_query),
        "location": {"lat": lat, "lng": lng},
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "weather": weather,
        "profile": result.get("profile_data", {}),
        "narration_timeline": result.get("narration_timeline", {}),
        "visualization_plan": result.get("visualization_plan", {}),
    }


async def tour_recommendations(place_query: str, intent: str, radius: float = 0.4, current_lat: float | None = None, current_lng: float | None = None) -> dict:
    """Find recommended places near a location AND start a narrated drone tour
    visiting each one. Use this when the user wants to both discover places AND
    take a guided flyover — e.g. "show me the best cafes near Times Square
    and fly me through them" or "find parks near SoHo and give me a tour."

    Args:
        place_query: The area to search in (e.g. "Times Square Manhattan").
        intent: What type of places to find and tour (e.g. "best cafes", "rooftop bars").
        radius: Search radius in miles (0.1 to 1.0). Default 0.4 miles.
        current_lat: Optional latitude of the user's current viewport center for location-biased search.
        current_lng: Optional longitude of the user's current viewport center for location-biased search.
    """
    # 1. Resolve location and parse intent in parallel
    predictions, intent_parsed_result = await asyncio.gather(
        get_autocomplete_predictions(place_query, lat=current_lat, lng=current_lng),
        parse_contextual_intent(intent),
        return_exceptions=True,
    )

    if isinstance(predictions, Exception) or not predictions:
        return {"error": f"Could not find '{place_query}'."}
    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place."}
    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        return {"error": "Could not get location details."}
    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]
    area_name = location_details.get("name", place_query)

    # 2. Extract keywords from parallel intent parse
    if isinstance(intent_parsed_result, Exception):
        keywords = [intent]
    else:
        keywords = intent_parsed_result.get("keywords", [intent])

    # 3. Search for places
    recommendations = await contextual_places_search(lat, lng, radius, keywords)
    if not recommendations:
        return {"error": "No matching places found in that area."}

    # 4. Generate waypoints, narration, and weather in parallel
    try:
        all_waypoints, narration_result, weather = await asyncio.gather(
            compute_waypoints_for_places(lat, lng, recommendations),
            generate_place_narrations(area_name, intent, recommendations, ""),
            fetch_weather_forecast(lat, lng),
        )
    except Exception as e:
        return {"error": f"Tour generation failed: {str(e)}"}

    # 5. Assemble NarrationTimeline segments
    narration_segments = narration_result.get("segments", [])
    segments = []
    poi_index = 0

    for i, wp in enumerate(all_waypoints):
        wp_dict = wp.model_dump() if hasattr(wp, "model_dump") else wp
        label = wp_dict.get("label", "")

        if label == "Overview":
            narr_text = f"Let's take in the full panorama of {area_name} from above."
            poi_names, transition, ambient = [], "Rising for an aerial overview", ""
        elif label == "Descent":
            narr_text = f"Now descending toward street level to explore {intent} spots."
            poi_names, transition, ambient = [], "Descending toward the neighborhood", ""
        elif label == "Return":
            narr_text = f"Climbing back up for one final look at {area_name}."
            poi_names, transition, ambient = [], "Ascending to overview altitude", ""
        elif label.startswith("Transit"):
            narr_text = ""
            poi_names, transition, ambient = [], "Following the road", ""
        else:
            # POI stop — use narration from generate_place_narrations
            if poi_index < len(narration_segments):
                seg_data = narration_segments[poi_index]
                narr_text = seg_data.get("narration_text", f"Here we see {label}.")
                poi_names = seg_data.get("poi_names", [label])
                transition = seg_data.get("transition_description", f"Approaching {label}")
                ambient = seg_data.get("ambient_notes", "")
            else:
                narr_text = f"Here we see {label}."
                poi_names, transition, ambient = [label], f"Approaching {label}", ""
            poi_index += 1

        speech_duration = round(len(narr_text.split()) / 2.5, 2) if narr_text else 0.0

        segments.append({
            "segment_id": i,
            "waypoint": wp_dict,
            "narration_text": narr_text,
            "poi_names": poi_names,
            "poi_context": {},
            "transition_description": transition,
            "estimated_speech_duration_s": speech_duration,
            "cumulative_start_time_s": 0.0,
            "ambient_notes": ambient,
        })

    # 6. Recompute timing deterministically
    opening_text = narration_result.get("opening_narration", "")
    opening_duration = len(opening_text.split()) / 2.5
    cumulative = opening_duration

    for seg in segments:
        seg["cumulative_start_time_s"] = round(cumulative, 2)
        wp = seg["waypoint"]
        cumulative += seg["estimated_speech_duration_s"] + wp.get("duration", 3) + wp.get("pause_after", 1)

    closing_text = narration_result.get("closing_narration", "")
    total_duration = round(cumulative + len(closing_text.split()) / 2.5, 2)

    # 7. Compute trajectory timestamps
    trajectory = compute_trajectory_timestamps(segments, opening_duration)

    # 8. Build NarrationTimeline
    narration_timeline = {
        "place_name": area_name,
        "place_id": place_id,
        "intent": intent,
        "total_segments": len(segments),
        "total_estimated_duration_s": total_duration,
        "opening_narration": opening_text or f"Welcome to {area_name}!",
        "closing_narration": closing_text or "That wraps up our tour!",
        "segments": segments,
        "weather_context": weather or {},
        "trajectory_timestamps": trajectory,
    }

    wp_dicts = [wp.model_dump() if hasattr(wp, "model_dump") else wp for wp in all_waypoints]

    return {
        "action": "start_narrated_tour",
        "place_id": place_id,
        "place_name": area_name,
        "location": {"lat": lat, "lng": lng},
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "weather": weather,
        "recommendations": recommendations,
        "narration_timeline": narration_timeline,
        "visualization_plan": {"waypoints": wp_dicts, "total_duration": total_duration},
    }
