import asyncio
from typing import Callable
from services.places_service import get_places_details, get_nearby_places
from services.weather_service import fetch_weather_forecast
from agents.workflow import run_neighborhood_workflow, run_narrated_tour_workflow

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
