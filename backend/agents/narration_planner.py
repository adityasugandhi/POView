"""
POView — NarrationPlanner Agent

Slots into the SequentialAgent chain AFTER GlobeController and BEFORE Formatter.
Reads the raw_narrative + visualization_plan from session state, and produces
a NarrationTimeline that temporally binds narration text to camera waypoints.
"""

import json
import re

from google.adk.agents import LlmAgent


def strip_code_fences(text: str) -> str:
    """Strip markdown code fences from LLM output."""
    cleaned = text.strip()
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    return cleaned

NARRATION_PLANNER_INSTRUCTIONS = """
You are a cinematic tour narration planner. You receive a neighborhood
narrative and a list of camera waypoints with coordinates, altitude, heading,
pitch, and duration.

Your job: split the narrative into exactly N segments (one per waypoint)
where each segment describes EXACTLY what the camera shows at that position.

Rules:
1. opening_narration: 2-3 sentence hook spoken BEFORE the camera moves.
   Think of it as the teaser that grabs attention.
2. Each segment's narration_text must be speakable in approximately the same
   duration as its waypoint's flight + pause time. Target: 2.5 words/second.
   A 10-second waypoint = ~25 words of narration.
3. Reference SPECIFIC POI names from the nearby_pois data.
   Mention real ratings and notable facts when available.
4. transition_description must match camera movement: "As we descend toward...",
   "Panning east to reveal...", "Climbing for an aerial view of..."
5. closing_narration: 2-sentence summary. Match tone to user intent.
6. Weave weather_context naturally. If overcast, describe moody atmosphere.
   If sunny, describe vibrant energy.
7. Match tone to user intent. "nightlife" = emphasize bars/venues.
   "family" = emphasize parks/schools. "food" = emphasize restaurants/cafes.
8. Calculate estimated_speech_duration_s as: len(narration_text.split()) / 2.5
9. Calculate cumulative_start_time_s for each segment:
   segment[0].start = opening_speech_duration
   segment[n].start = segment[n-1].start + segment[n-1].speech_duration + segment[n-1].waypoint.duration + segment[n-1].waypoint.pause_after

Output: Valid JSON matching the schema below. No markdown. No preamble.

JSON Schema:
{
  "place_name": "...",
  "place_id": "...",
  "intent": "...",
  "total_segments": N,
  "total_estimated_duration_s": ...,
  "opening_narration": "...",
  "closing_narration": "...",
  "segments": [
    {
      "segment_id": 0,
      "waypoint": {CameraWaypoint object},
      "narration_text": "...",
      "poi_names": ["..."],
      "poi_context": {},
      "transition_description": "...",
      "estimated_speech_duration_s": ...,
      "cumulative_start_time_s": ...,
      "ambient_notes": "..."
    }
  ],
  "weather_context": {}
}
"""

def create_narration_planner_agent() -> LlmAgent:
    return LlmAgent(
        name="NarrationPlannerAgent",
        model="gemini-3.1-pro-preview",
        instruction=NARRATION_PLANNER_INSTRUCTIONS,
        output_key="narration_timeline_raw",
    )


def compute_trajectory_timestamps(segments: list, opening_duration: float) -> list:
    """
    Compute dense trajectory timestamps (every 0.5s) by interpolating
    between waypoints across the full tour duration.
    """
    timestamps = []

    # Build waypoint timeline with absolute start times
    waypoint_timeline = []
    for seg in segments:
        wp = seg.get("waypoint", {})
        waypoint_timeline.append({
            "start_time": seg["cumulative_start_time_s"],
            "lat": wp.get("latitude", 0),
            "lng": wp.get("longitude", 0),
            "alt": wp.get("altitude", 300),
            "heading": wp.get("heading", 0),
            "pitch": wp.get("pitch", -35),
            "duration": wp.get("duration", 3),
            "pause_after": wp.get("pause_after", 1),
        })

    if not waypoint_timeline:
        return timestamps

    # Compute total duration
    last = waypoint_timeline[-1]
    last_seg = segments[-1]
    total_time = (
        last["start_time"]
        + last_seg["estimated_speech_duration_s"]
        + last["duration"]
        + last["pause_after"]
    )

    # Generate samples at 0.5s intervals
    t = 0.0
    while t <= total_time:
        # Find which segment we're in
        current_wp = waypoint_timeline[0]
        next_wp = waypoint_timeline[0]

        for i in range(len(waypoint_timeline)):
            if waypoint_timeline[i]["start_time"] <= t:
                current_wp = waypoint_timeline[i]
                next_wp = waypoint_timeline[i + 1] if i + 1 < len(waypoint_timeline) else current_wp

        # Interpolation factor within the flight duration
        flight_start = current_wp["start_time"]
        flight_duration = current_wp["duration"]
        if flight_duration > 0 and current_wp != next_wp:
            progress = min(1.0, max(0.0, (t - flight_start) / flight_duration))
        else:
            progress = 1.0

        # Lerp position
        lat = current_wp["lat"] + (next_wp["lat"] - current_wp["lat"]) * progress
        lng = current_wp["lng"] + (next_wp["lng"] - current_wp["lng"]) * progress
        alt = current_wp["alt"] + (next_wp["alt"] - current_wp["alt"]) * progress

        # Angular interpolation for heading
        heading_diff = next_wp["heading"] - current_wp["heading"]
        if heading_diff > 180:
            heading_diff -= 360
        elif heading_diff < -180:
            heading_diff += 360
        heading = current_wp["heading"] + heading_diff * progress

        pitch = current_wp["pitch"] + (next_wp["pitch"] - current_wp["pitch"]) * progress

        timestamps.append({
            "time_s": round(t, 2),
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "alt": round(alt, 1),
            "heading": round(heading, 1),
            "pitch": round(pitch, 1),
        })

        t += 0.5

    return timestamps


def post_process_narration_timeline(
    raw_json: str,
    place_name: str,
    place_id: str,
    intent: str,
    weather_data: dict,
    waypoints: list,
) -> dict:
    """
    Parse the LLM output, validate, fill computed fields, and add trajectory timestamps.
    """
    try:
        timeline = json.loads(strip_code_fences(raw_json))
    except json.JSONDecodeError:
        # Fallback: create a minimal timeline from waypoints
        timeline = _build_fallback_timeline(place_name, place_id, intent, waypoints, weather_data)

    # Ensure required fields
    timeline["place_name"] = timeline.get("place_name", place_name)
    timeline["place_id"] = timeline.get("place_id", place_id)
    timeline["intent"] = timeline.get("intent", intent)
    timeline["weather_context"] = timeline.get("weather_context", weather_data or {})

    segments = timeline.get("segments", [])
    timeline["total_segments"] = len(segments)

    # Recompute cumulative times to ensure correctness
    opening_words = len(timeline.get("opening_narration", "").split())
    opening_duration = opening_words / 2.5

    cumulative = opening_duration
    for seg in segments:
        seg["cumulative_start_time_s"] = round(cumulative, 2)
        speech_words = len(seg.get("narration_text", "").split())
        seg["estimated_speech_duration_s"] = round(speech_words / 2.5, 2)

        wp = seg.get("waypoint", {})
        wp_duration = wp.get("duration", 3)
        wp_pause = wp.get("pause_after", 1)
        cumulative += seg["estimated_speech_duration_s"] + wp_duration + wp_pause

    closing_words = len(timeline.get("closing_narration", "").split())
    closing_duration = closing_words / 2.5
    timeline["total_estimated_duration_s"] = round(cumulative + closing_duration, 2)

    # Compute trajectory timestamps
    timeline["trajectory_timestamps"] = compute_trajectory_timestamps(segments, opening_duration)

    return timeline


def _build_fallback_timeline(place_name, place_id, intent, waypoints, weather_data):
    """
    Build a minimal NarrationTimeline if the LLM output fails to parse.
    """
    segments = []
    cumulative = 4.0  # ~10 words opening / 2.5

    for i, wp_data in enumerate(waypoints):
        wp = wp_data if isinstance(wp_data, dict) else wp_data.model_dump()
        narration = f"Here we see the view from {wp.get('label', f'waypoint {i+1}')}."
        speech_dur = len(narration.split()) / 2.5
        segments.append({
            "segment_id": i,
            "waypoint": wp,
            "narration_text": narration,
            "poi_names": [],
            "poi_context": {},
            "transition_description": f"Moving to waypoint {i+1}",
            "estimated_speech_duration_s": round(speech_dur, 2),
            "cumulative_start_time_s": round(cumulative, 2),
            "ambient_notes": "",
        })
        cumulative += speech_dur + wp.get("duration", 3) + wp.get("pause_after", 1)

    return {
        "place_name": place_name,
        "place_id": place_id,
        "intent": intent,
        "total_segments": len(segments),
        "total_estimated_duration_s": round(cumulative + 4.0, 2),
        "opening_narration": f"Welcome to {place_name}. Let me show you around this fascinating neighborhood.",
        "closing_narration": f"That concludes our tour of {place_name}. I hope you enjoyed the journey.",
        "segments": segments,
        "weather_context": weather_data or {},
        "trajectory_timestamps": [],
    }
