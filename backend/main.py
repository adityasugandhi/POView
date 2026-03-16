import asyncio
import json
import traceback

from dotenv import load_dotenv

load_dotenv()

import polyline
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from agents import run_narrated_tour_workflow, run_neighborhood_workflow
from agents.live_agent import create_live_agent
from services.gemini_client import (
    generate_neighborhood_profile,
    parse_contextual_intent,
)
from services.places_service import (
    contextual_places_search,
    format_context_payload,
    get_autocomplete_predictions,
    get_directions,
    get_nearby_places,
    get_places_details,
    reverse_geocode,
)
from services.redis_cache import get_cached_profile, set_cached_profile
from services.weather_service import fetch_weather_forecast

app = FastAPI(title="GroundLevel AI Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Live Agent Setup ---
live_agent = create_live_agent()
live_session_service = InMemorySessionService()
live_runner = Runner(
    agent=live_agent,
    app_name="poview-live",
    session_service=live_session_service,
)


@app.get("/api/autocomplete")
async def autocomplete_proxy(input: str):
    """Secure proxy for Places Autocomplete."""
    if not input:
        return {"suggestions": []}
    suggestions = await get_autocomplete_predictions(input)
    return {"suggestions": suggestions}


@app.get("/api/resolve_location/{place_id}")
async def resolve_location(place_id: str):
    """Resolve a placeId to coordinates and display name."""
    details = await get_places_details(place_id)
    if not details or not details.get("geometry"):
        raise HTTPException(status_code=404, detail="Place not found")
    loc = details["geometry"]["location"]
    return {
        "placeId": place_id,
        "displayName": details.get("name", details.get("formatted_address", "")),
        "lat": loc["lat"],
        "lng": loc["lng"],
    }


@app.get("/api/reverse_geocode")
async def reverse_geocode_endpoint(lat: float, lng: float):
    """Convert lat/lng to a place ID and display name."""
    result = await reverse_geocode(lat, lng)
    if not result or not result.get("place_id"):
        raise HTTPException(status_code=404, detail="Could not resolve location")
    return {
        "placeId": result["place_id"],
        "displayName": result["formatted_address"],
        "lat": lat,
        "lng": lng,
    }


class ProximityRequest(BaseModel):
    place_id: str
    intent: str
    radius: float = 0.4


@app.post("/api/proximity_search")
async def proximity_search(req: ProximityRequest):
    """Handles Contextual AI Proximity Search"""

    # 1. Resolve place_id to lat/lng
    location_details = await get_places_details(req.place_id)
    if not location_details or not location_details.get("geometry"):
        raise HTTPException(status_code=404, detail="Location not found")

    lat = location_details["geometry"].get("location", {}).get("lat")
    lng = location_details["geometry"].get("location", {}).get("lng")

    if not lat or not lng:
        raise HTTPException(status_code=400, detail="Location geometry invalid")

    # 2. Parse intent with Gemini to get Places keywords
    try:
        intent_parsed = await parse_contextual_intent(req.intent)
        keywords = intent_parsed.get("keywords", [])
        if not keywords:
            keywords = [req.intent]  # Fallback
    except Exception as e:
        print(f"Gemini Intent Parsing Error: {e}")
        keywords = [req.intent]  # Fallback

    # 3. Search Google Places within bounds (returns a list of dicts)
    recommendations = await contextual_places_search(lat, lng, req.radius, keywords)
    if not recommendations:
        raise HTTPException(
            status_code=404, detail="No contextual matches found nearby."
        )

    # 4. Concurrently Get Actual Route directions for all recommendations
    async def fetch_route(rec):
        try:
            directions = await get_directions(lat, lng, rec["lat"], rec["lng"])
            path = (
                polyline.decode(directions)
                if directions
                else [[lat, lng], [rec["lat"], rec["lng"]]]
            )
            return path
        except Exception as e:
            print(f"Directions API fallback to straight line for {rec['name']}: {e}")
            return [[lat, lng], [rec["lat"], rec["lng"]]]

    routes = await asyncio.gather(*[fetch_route(r) for r in recommendations])

    # Combine recommendations with their respective routing paths
    results = []
    for i, rec in enumerate(recommendations):
        results.append(
            {
                "coordinates": [rec["lat"], rec["lng"]],
                "metadata": {
                    "name": rec["name"],
                    "rating": rec.get("rating", 0),
                    "description": rec.get("description", ""),
                    "photoUrls": rec.get("photoUrls", []),
                    "reviews": rec.get("reviews", []),
                    "address": rec.get("address", ""),
                    "phone": rec.get("phone", ""),
                    "website": rec.get("website", ""),
                    "hours": rec.get("hours", []),
                    "priceLevel": rec.get("priceLevel", ""),
                    "ratingCount": rec.get("ratingCount", 0),
                },
                "routing_path": routes[i],
            }
        )

    # 5. Return structured array of recommendations
    return {"results": results}


@app.get("/api/profile/{place_id}")
async def fetch_neighborhood_profile(place_id: str, intent: str = None):
    """Main Orchestration endpoint for the Foundation Neighborhood Profile"""

    # 1. Check strict Redis Cache (Zero Token Expenditure)
    cache_key = f"{place_id}_{intent}" if intent else place_id
    cached_payload = await get_cached_profile(cache_key)
    if cached_payload:
        if (
            "viewport" in cached_payload
            and "profile_data" in cached_payload
            and "weather" in cached_payload
        ):
            return {
                "source": "cache",
                "data": cached_payload["profile_data"],
                "viewport": cached_payload["viewport"],
                "location": cached_payload["location"],
                "weather": cached_payload["weather"],
            }
        # If it's old cache without viewport, we fall through and regenerate to get the bounds

    # 2. Asynchronously aggregate Google Places Data
    location_details = await get_places_details(place_id)
    if not location_details:
        raise HTTPException(status_code=404, detail="Location not found")

    lat = location_details.get("geometry", {}).get("location", {}).get("lat")
    lng = location_details.get("geometry", {}).get("location", {}).get("lng")

    if not lat or not lng:
        raise HTTPException(status_code=400, detail="Location geometry invalid")

    nearby_places = await get_nearby_places(lat, lng)
    weather = await fetch_weather_forecast(lat, lng)

    # 3. Format context explicitly matching the architectural constraints
    prompt_payload = format_context_payload(location_details, nearby_places)

    # System Instruction injection specific to Module 1 with Google WeatherForecast 2 Integration
    intent_instruction = (
        f"The user's specific search intent is: '{intent}'. Tailor the 'vibe_description' to specifically explain WHY this neighborhood is (or isn't) highly relevant to their intent in exactly 2 punchy, actionable sentences. "
        if intent
        else ""
    )

    system_instruction = (
        "You are an expert urban analyst. Your tone must be direct, highly specific, and culturally intuitive. "
        "Do NOT use diplomatic platitudes. Provide unvarnished assessments. You must reply strictly in the exact JSON format requested. "
        f"CRITICAL GOOGLE WEATHERFORECAST 2 CONTEXT: {weather['ai_summary']} "
        "You MUST adapt the 'vibe_description', 'best_for', and 'not_ideal_for' arrays to heavily reflect this current weather reality. "
        f"{intent_instruction}"
    )

    full_prompt = (
        f"SYSTEM INSTRUCTION: {system_instruction}\n\nDATA PAYLOAD:\n{prompt_payload}"
    )

    # 4. Generate AI Insight via Gemini 3.1 Pro
    try:
        profile_data = await generate_neighborhood_profile(full_prompt)
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"Gemini API Error: {e}")
        raise HTTPException(
            status_code=500, detail="AI insights temporarily unavailable"
        )

    # 5. Set Redis Cache with 72-hour TTL
    cache_wrapper = {
        "profile_data": profile_data,
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "location": location_details.get("geometry", {}).get("location"),
        "weather": weather,
    }
    await set_cached_profile(cache_key, cache_wrapper)

    return {
        "source": "gemini",
        "data": profile_data,
        "viewport": cache_wrapper["viewport"],
        "location": cache_wrapper["location"],
        "weather": weather,
    }


@app.get("/api/profile_v2/{place_id}")
async def fetch_neighborhood_profile_v2(place_id: str, intent: str = None):
    """V2 Neighborhood Profile using Agent ADK sequential workflow."""

    # 1. Check Redis Cache
    cache_key = f"v2_{place_id}_{intent}" if intent else f"v2_{place_id}"
    cached_payload = await get_cached_profile(cache_key)
    if cached_payload:
        if all(
            k in cached_payload
            for k in ("profile_data", "viewport", "weather", "visualization_plan")
        ):
            return {
                "source": "cache",
                "data": cached_payload["profile_data"],
                "viewport": cached_payload["viewport"],
                "location": cached_payload["location"],
                "weather": cached_payload["weather"],
                "visualization_plan": cached_payload["visualization_plan"],
            }

    # 2. Aggregate data (same as v1)
    location_details = await get_places_details(place_id)
    if not location_details:
        raise HTTPException(status_code=404, detail="Location not found")

    lat = location_details.get("geometry", {}).get("location", {}).get("lat")
    lng = location_details.get("geometry", {}).get("location", {}).get("lng")

    if not lat or not lng:
        raise HTTPException(status_code=400, detail="Location geometry invalid")

    nearby_places = await get_nearby_places(lat, lng)
    weather = await fetch_weather_forecast(lat, lng)

    # 3. Run Agent ADK workflow
    try:
        result = await run_neighborhood_workflow(
            place_id=place_id,
            location_details=location_details,
            nearby_places=nearby_places,
            weather=weather,
            intent=intent,
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        print(f"Agent Workflow Error: {e}")
        raise HTTPException(
            status_code=500, detail="AI agent workflow temporarily unavailable"
        )

    profile_data = result["profile_data"]
    visualization_plan = result["visualization_plan"]

    # 4. Cache the full response
    cache_wrapper = {
        "profile_data": profile_data,
        "viewport": location_details.get("geometry", {}).get("viewport"),
        "location": location_details.get("geometry", {}).get("location"),
        "weather": weather,
        "visualization_plan": visualization_plan,
    }
    await set_cached_profile(cache_key, cache_wrapper)

    return {
        "source": "agents",
        "data": profile_data,
        "viewport": cache_wrapper["viewport"],
        "location": cache_wrapper["location"],
        "weather": weather,
        "visualization_plan": visualization_plan,
    }


@app.get("/api/drone_stream/{place_id}")
async def drone_stream(place_id: str, intent: str = None):
    """SSE endpoint that streams CameraWaypoints one at a time."""

    cache_key = f"v2_{place_id}_{intent}" if intent else f"v2_{place_id}"
    cached_payload = await get_cached_profile(cache_key)

    if not cached_payload or "visualization_plan" not in cached_payload:
        raise HTTPException(
            status_code=404,
            detail="No visualization plan found. Generate a v2 profile first.",
        )

    plan = cached_payload["visualization_plan"]
    waypoints = plan.get("waypoints", [])

    async def event_generator():
        for i, wp in enumerate(waypoints):
            data = json.dumps(wp)
            yield f"event: waypoint\ndata: {data}\n\n"
            # Pause for the waypoint's duration + pause_after to sync with camera flight
            total_wait = wp.get("duration", 3.0) + wp.get("pause_after", 1.0)
            await asyncio.sleep(total_wait)
        yield f"event: done\ndata: {json.dumps({'message': 'Flight complete'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/api/narrated_tour/{place_id}")
async def narrated_tour(place_id: str, intent: str = None):
    """Generate a synchronized narrated drone tour with NarrationTimeline."""
    cache_key = f"narrated_{place_id}_{intent}" if intent else f"narrated_{place_id}"
    cached = await get_cached_profile(cache_key)
    if cached and "narration_timeline" in cached:
        return cached

    # Resolve location details
    location_details = await get_places_details(place_id)
    if not location_details or not location_details.get("geometry"):
        raise HTTPException(status_code=404, detail="Location not found.")

    lat = location_details["geometry"]["location"]["lat"]
    lng = location_details["geometry"]["location"]["lng"]

    nearby_places, weather = await asyncio.gather(
        get_nearby_places(lat, lng),
        fetch_weather_forecast(lat, lng),
    )

    result = await run_narrated_tour_workflow(
        place_id=place_id,
        location_details=location_details,
        nearby_places=nearby_places,
        weather=weather,
        intent=intent,
    )

    response = {
        "place_id": place_id,
        "location": {"lat": lat, "lng": lng},
        "weather": weather,
        "narration_timeline": result.get("narration_timeline", {}),
        "visualization_plan": result.get("visualization_plan", {}),
        "profile_data": result.get("profile_data", {}),
    }

    # Cache for 72 hours
    await set_cached_profile(cache_key, response, ttl=259200)
    return response


@app.websocket("/ws/live/{session_id}")
async def live_websocket(websocket: WebSocket, session_id: str):
    """Bidirectional audio streaming via Gemini Live API + ADK."""
    await websocket.accept()

    # Create a session for this connection
    user_id = f"live_user_{session_id}"
    session = await live_session_service.create_session(
        app_name="poview-live",
        user_id=user_id,
    )

    # Configure BIDI streaming with audio
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )

    live_queue = LiveRequestQueue()

    async def upstream_task():
        """Reads audio/text from WebSocket and pushes into the LiveRequestQueue."""
        try:
            while True:
                data = await websocket.receive()

                if "bytes" in data and data["bytes"]:
                    # Binary audio data from browser mic (Int16 PCM 16kHz)
                    audio_bytes = data["bytes"]
                    live_queue.send_realtime(
                        types.Blob(
                            mime_type="audio/pcm;rate=16000",
                            data=audio_bytes,
                        )
                    )
                elif "text" in data and data["text"]:
                    # Text message (could be text command, spatial context, or tour cue)
                    try:
                        msg = json.loads(data["text"])
                        msg_type = msg.get("type")

                        if msg_type == "text_input":
                            live_queue.send_content(
                                types.Content(
                                    parts=[types.Part(text=msg["text"])],
                                    role="user",
                                )
                            )
                        elif msg_type == "camera_context":
                            # Silent spatial context injection (rate-limited client-side to 5s)
                            visible_pois = msg.get("visible_pois", [])
                            poi_summary = (
                                ", ".join(
                                    [
                                        f"{p['name']} ({p.get('type','')}, {p.get('rating','N/A')}★)"
                                        for p in visible_pois[:8]
                                    ]
                                )
                                or "no notable POIs visible"
                            )
                            bbox = msg.get("bounding_box", {})
                            context_text = (
                                f"<SPATIAL_CONTEXT>"
                                f"Camera: ({msg.get('lat',0):.4f}, {msg.get('lng',0):.4f}) "
                                f"alt={msg.get('alt',0):.0f}m heading={msg.get('heading',0):.0f}° "
                                f"pitch={msg.get('pitch',0):.0f}° | "
                                f"Visible POIs: {poi_summary} | "
                                f"View bounds: W={bbox.get('west',0):.4f} S={bbox.get('south',0):.4f} "
                                f"E={bbox.get('east',0):.4f} N={bbox.get('north',0):.4f}"
                                f"</SPATIAL_CONTEXT>"
                            )
                            live_queue.send_content(
                                types.Content(
                                    parts=[types.Part(text=context_text)],
                                    role="user",
                                )
                            )
                        elif msg_type == "tour_progress":
                            # Narration cue injection — the agent should speak this
                            segment_id = msg.get("segment_id", 0)
                            narration = msg.get("narration_text", "")
                            poi_names = msg.get("poi_names", [])
                            transition = msg.get("transition_description", "")
                            state = msg.get("playback_state", "playing")

                            if state == "segment_boundary" and narration:
                                cue_text = (
                                    f"[NARRATION_CUE segment={segment_id}] "
                                    f"Transition: {transition}. "
                                    f"Narration: {narration} "
                                    f"POIs in view: {', '.join(poi_names)}."
                                )
                                live_queue.send_content(
                                    types.Content(
                                        parts=[types.Part(text=cue_text)],
                                        role="user",
                                    )
                                )
                        elif msg_type in (
                            "tour_start",
                            "tour_pause",
                            "tour_resume",
                            "tour_stop",
                        ):
                            lifecycle_text = f"[TOUR_LIFECYCLE] Event: {msg_type}"
                            if msg_type == "tour_start":
                                opening = msg.get("opening_narration", "")
                                if opening:
                                    lifecycle_text += (
                                        f" | Opening narration to speak: {opening}"
                                    )
                            live_queue.send_content(
                                types.Content(
                                    parts=[types.Part(text=lifecycle_text)],
                                    role="user",
                                )
                            )
                    except json.JSONDecodeError:
                        pass

        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"Upstream error: {e}")
        finally:
            live_queue.close()

    async def downstream_task():
        """Reads events from run_live and sends audio/text back over WebSocket."""
        try:
            async for event in live_runner.run_live(
                user_id=user_id,
                session_id=session.id,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                if not event:
                    continue

                # Handle audio output
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        # Audio response
                        if part.inline_data and part.inline_data.data:
                            audio_bytes = part.inline_data.data
                            try:
                                await websocket.send_bytes(audio_bytes)
                            except Exception:
                                return

                        # Text transcription from agent
                        if part.text:
                            try:
                                await websocket.send_text(
                                    json.dumps(
                                        {
                                            "type": "transcript",
                                            "role": "agent",
                                            "text": part.text,
                                            "finished": True,
                                        }
                                    )
                                )
                            except Exception:
                                return

                # Handle input transcription
                if hasattr(event, "input_transcription") and event.input_transcription:
                    try:
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "transcript",
                                    "role": "user",
                                    "text": event.input_transcription.text,
                                    "finished": bool(
                                        getattr(
                                            event.input_transcription, "finished", False
                                        )
                                    ),
                                }
                            )
                        )
                    except Exception:
                        return

                # Handle output transcription (agent speech-to-text)
                if (
                    hasattr(event, "output_transcription")
                    and event.output_transcription
                ):
                    try:
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "type": "transcript",
                                    "role": "agent",
                                    "text": event.output_transcription.text,
                                    "finished": bool(
                                        getattr(
                                            event.output_transcription,
                                            "finished",
                                            False,
                                        )
                                    ),
                                }
                            )
                        )
                    except Exception:
                        return

                # Handle tool calls and their results
                if hasattr(event, "tool_calls") and event.tool_calls:
                    await websocket.send_text(
                        json.dumps({"type": "state", "state": "processing"})
                    )

                if hasattr(event, "tool_results") and event.tool_results:
                    for result in event.tool_results:
                        tool_name = getattr(result, "name", "unknown")
                        tool_data = None
                        if hasattr(result, "content") and result.content:
                            for p in result.content:
                                if hasattr(p, "text") and p.text:
                                    try:
                                        tool_data = json.loads(p.text)
                                    except json.JSONDecodeError:
                                        tool_data = {"text": p.text}
                        try:
                            await websocket.send_text(
                                json.dumps(
                                    {
                                        "type": "tool_result",
                                        "tool": tool_name,
                                        "data": tool_data,
                                    }
                                )
                            )
                        except Exception:
                            return

        except Exception as e:
            print(f"Downstream error: {e}")
            traceback.print_exc()
            try:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": str(e)})
                )
            except Exception:
                pass

    # Run upstream and downstream concurrently
    upstream = asyncio.create_task(upstream_task())
    downstream = asyncio.create_task(downstream_task())

    try:
        await asyncio.gather(upstream, downstream, return_exceptions=True)
    finally:
        upstream.cancel()
        downstream.cancel()
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
