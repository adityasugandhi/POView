import asyncio
from typing import Callable
from services.places_service import get_places_details, get_nearby_places, get_autocomplete_predictions, contextual_places_search
from services.weather_service import fetch_weather_forecast
from services.gemini_client import parse_contextual_intent
from agents.workflow import run_neighborhood_workflow, run_narrated_tour_workflow
from agents.waypoint_utils import compute_waypoints_for_places
from services.narration_generator import generate_place_narrations
from agents.narration_planner import compute_trajectory_timestamps

async def run_streaming_workflow(
    place_id: str,
    intent: str,
    send_to_frontend: Callable,
    workflow_type: str = "neighborhood"
) -> dict:
    """
    Runs the analysis pipeline with intermediate result streaming.

    send_to_frontend pushes messages directly to the WebSocket,
    bypassing the Gemini tool_result chokepoint.
    """

    # Stage 1: Resolve location (~1.5s)
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Resolving location...",
        "progress": 10,
    })
    
    place_details = await get_places_details(place_id)
    if not place_details or not place_details.get("geometry"):
        send_to_frontend({
            "type": "error",
            "message": "Failed to resolve location details."
        })
        return {"error": "Location details missing"}

    lat = place_details["geometry"]["location"]["lat"]
    lng = place_details["geometry"]["location"]["lng"]

    # Push location immediately — frontend can start camera fly-in NOW
    send_to_frontend({
        "type": "pipeline_partial",
        "partial": "location",
        "data": {
            "location": {"lat": lat, "lng": lng},
            "viewport": place_details.get("geometry", {}).get("viewport", {}),
            "place_name": place_details.get("name", "Unknown"),
        }
    })

    # Stage 2: Nearby POIs + Weather in parallel (~1.5s)
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Fetching surroundings...",
        "progress": 25,
    })
    
    nearby, weather = await asyncio.gather(
        get_nearby_places(lat, lng),
        fetch_weather_forecast(lat, lng),
    )
    
    # Push weather immediately — frontend can apply weather effects NOW
    if weather:
        send_to_frontend({
            "type": "pipeline_partial",
            "partial": "weather",
            "data": {"weather": weather},
        })

    # Stage 3: Run ADK agents (~5-8s, parallelized)
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "AI agents analyzing...",
        "progress": 40,
    })
    
    # Define a stage callback for the ADK pipeline
    def on_stage(stage_name: str, progress_pct: int):
        send_to_frontend({
            "type": "state",
            "state": "pipeline_stage",
            "stage": stage_name,
            "progress": progress_pct,
        })

    try:
        if workflow_type == "narrated_tour":
            result = await run_narrated_tour_workflow(
                place_id=place_id,
                location_details=place_details,
                nearby_places=nearby,
                weather=weather,
                intent=intent,
            )
        else:
            result = await run_neighborhood_workflow(
                place_id=place_id,
                location_details=place_details,
                nearby_places=nearby,
                weather=weather,
                intent=intent,
            )
    except Exception as e:
        send_to_frontend({
            "type": "error",
            "message": f"Pipeline failed: {str(e)}"
        })
        return {"error": str(e)}

    # Push final result via WebSocket
    send_to_frontend({
        "type": "pipeline_complete",
        "data": result,
        "workflow_type": workflow_type
    })

    return result


async def run_streaming_recommendations(
    place_query: str,
    intent: str,
    radius: float,
    send_to_frontend: Callable,
) -> dict:
    """Streams simple contextual recommendations."""
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Gathering spatial intelligence...",
        "progress": 20,
    })

    predictions = await get_autocomplete_predictions(place_query)
    if not predictions:
        send_to_frontend({"type": "error", "message": f"Could not find '{place_query}'."})
        return {}

    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Parsing semantic intent...",
        "progress": 40,
    })

    location_details, intent_parsed_result = await asyncio.gather(
        get_places_details(place_id),
        parse_contextual_intent(intent),
        return_exceptions=True,
    )

    if isinstance(location_details, Exception) or not location_details or not location_details.get("geometry"):
        send_to_frontend({"type": "error", "message": "Location details missing"})
        return {}

    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]

    send_to_frontend({
        "type": "pipeline_partial",
        "partial": "location",
        "data": {
            "location": {"lat": lat, "lng": lng},
            "viewport": location_details.get("geometry", {}).get("viewport", {}),
            "place_name": place_query,
        }
    })

    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Scanning area for matches...",
        "progress": 60,
    })

    if isinstance(intent_parsed_result, Exception):
        keywords = [intent]
    else:
        keywords = intent_parsed_result.get("keywords", [intent])

    results = await contextual_places_search(lat, lng, radius, keywords)
    
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Aggregating telemetry...",
        "progress": 100,
    })

    data = {
        "place_query": place_query,
        "intent": intent,
        "location": {"lat": lat, "lng": lng},
        "recommendations": results or [],
    }

    send_to_frontend({
        "type": "pipeline_complete",
        "data": data,
        "workflow_type": "get_recommendations"
    })
    return data


async def run_streaming_tour_recommendations(
    place_query: str,
    intent: str,
    radius: float,
    send_to_frontend: Callable,
) -> dict:
    """Streams the heavy tour recommendations workflow."""
    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Resolving target sector...",
        "progress": 10,
    })

    predictions, intent_parsed_result = await asyncio.gather(
        get_autocomplete_predictions(place_query),
        parse_contextual_intent(intent),
        return_exceptions=True,
    )

    if isinstance(predictions, Exception) or not predictions:
        send_to_frontend({"type": "error", "message": "Could not resolve place."})
        return {}
        
    place_id = predictions[0].get("placePrediction", {}).get("placeId", "")
    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        send_to_frontend({"type": "error", "message": "Location details missing."})
        return {}
        
    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]
    area_name = location_details.get("name", place_query)

    send_to_frontend({
        "type": "pipeline_partial",
        "partial": "location",
        "data": {
            "location": {"lat": lat, "lng": lng},
            "viewport": location_details.get("geometry", {}).get("viewport", {}),
            "place_name": area_name,
        }
    })

    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Extracting high-value targets...",
        "progress": 30,
    })

    if isinstance(intent_parsed_result, Exception):
        keywords = [intent]
    else:
        keywords = intent_parsed_result.get("keywords", [intent])

    recommendations = await contextual_places_search(lat, lng, radius, keywords)
    if not recommendations:
        send_to_frontend({"type": "error", "message": "No matching places found."})
        return {}

    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Generating flight trajectory and narration...",
        "progress": 50,
    })

    try:
        all_waypoints, narration_result, weather = await asyncio.gather(
            compute_waypoints_for_places(lat, lng, recommendations),
            generate_place_narrations(area_name, intent, recommendations, ""),
            fetch_weather_forecast(lat, lng),
        )
    except Exception as e:
        send_to_frontend({"type": "error", "message": f"Tour generation failed: {str(e)}"})
        return {}

    if weather:
        send_to_frontend({
            "type": "pipeline_partial",
            "partial": "weather",
            "data": {"weather": weather},
        })

    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Assembling timeline...",
        "progress": 80,
    })

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

    opening_text = narration_result.get("opening_narration", "")
    opening_duration = len(opening_text.split()) / 2.5
    cumulative = opening_duration

    for seg in segments:
        seg["cumulative_start_time_s"] = round(cumulative, 2)
        wp = seg["waypoint"]
        cumulative += seg["estimated_speech_duration_s"] + wp.get("duration", 3) + wp.get("pause_after", 1)

    closing_text = narration_result.get("closing_narration", "")
    total_duration = round(cumulative + len(closing_text.split()) / 2.5, 2)
    trajectory = compute_trajectory_timestamps(segments, opening_duration)

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

    data = {
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

    send_to_frontend({
        "type": "state",
        "state": "pipeline_stage",
        "stage": "Simulation complete",
        "progress": 100,
    })

    send_to_frontend({
        "type": "pipeline_complete",
        "data": data,
        "workflow_type": "tour_recommendations"
    })
    
    return data
