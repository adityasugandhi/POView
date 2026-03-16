"""Tool wrappers that bridge the Live conversational agent to existing POView services."""

from agents.workflow import run_narrated_tour_workflow, run_neighborhood_workflow
from services.gemini_client import parse_contextual_intent
from services.places_service import (
    contextual_places_search,
    get_autocomplete_predictions,
    get_nearby_places,
    get_places_details,
)
from services.weather_service import fetch_weather_forecast


async def search_neighborhood(place_query: str, intent: str = "general exploration") -> dict:
    """Search and analyze a neighborhood. Call this when the user describes a place
    they want to explore. Returns neighborhood profile data, scores, highlights,
    and camera waypoints for a drone tour.

    Args:
        place_query: The name or description of the place (e.g. "Williamsburg Brooklyn",
                     "Times Square", "coffee shops near SoHo").
        intent: What the user wants to explore (e.g. "nightlife", "family activities",
                "best coffee spots"). Defaults to general exploration.
    """
    # 1. Autocomplete to resolve a place_id
    predictions = await get_autocomplete_predictions(place_query)
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
    import asyncio
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


async def get_recommendations(place_query: str, intent: str, radius: float = 0.4) -> dict:
    """Get specific place recommendations near a location. Use this when the user
    asks for recommendations like restaurants, cafes, parks, etc.

    Args:
        place_query: The location name to search near (e.g. "Williamsburg Brooklyn").
        intent: What type of places to find (e.g. "best pizza", "quiet parks", "live music venues").
        radius: Search radius in miles (0.1 to 1.0). Default 0.4 miles.
    """
    # 1. Resolve location
    predictions = await get_autocomplete_predictions(place_query)
    if not predictions:
        return {"error": f"Could not find '{place_query}'."}

    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    if not place_id:
        return {"error": "Could not resolve place."}

    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        return {"error": "Could not get location details."}

    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]

    # 2. Parse intent into keywords
    try:
        intent_parsed = await parse_contextual_intent(intent)
        keywords = intent_parsed.get("keywords", [intent])
    except Exception:
        keywords = [intent]

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


async def start_narrated_tour(place_query: str, intent: str = "general exploration") -> dict:
    """Start a synchronized narrated drone tour with voice narration aligned to camera
    movements. Call this when the user wants a guided tour, narrated flyover, or
    immersive exploration of a neighborhood.

    Args:
        place_query: The location to tour (e.g. "Williamsburg Brooklyn").
        intent: What aspect to focus on (e.g. "nightlife", "food scene", "family-friendly").
    """
    # 1. Resolve location
    predictions = await get_autocomplete_predictions(place_query)
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
    import asyncio
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
