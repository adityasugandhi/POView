import os
import json
from google import genai
from google.genai import types


async def generate_place_narrations(
    area_name: str,
    intent: str,
    places: list[dict],
    weather_summary: str,
) -> dict:
    """Generate narration for a drone tour visiting specific places.

    Makes one Gemini call. Returns {opening_narration, closing_narration,
    segments: [{narration_text, poi_names, transition_description, ambient_notes}]}.
    """
    place_descriptions = []
    for i, p in enumerate(places):
        reviews_text = ""
        for r in p.get("reviews", [])[:2]:
            reviews_text += f' Review: "{r.get("text", "")[:100]}"'
        place_descriptions.append(
            f"{i+1}. {p['name']} — Rating: {p.get('rating', 'N/A')}/5 "
            f"({p.get('ratingCount', 0)} reviews), "
            f"Price: {p.get('priceLevel', 'N/A')}, "
            f"Address: {p.get('address', 'N/A')}. "
            f"{p.get('description', '')}.{reviews_text}"
        )

    prompt = f"""You are a cinematic tour narrator. Generate narration for a drone tour of {area_name}.

User's intent: {intent}
Current weather: {weather_summary}

Places to narrate (in visit order):
{chr(10).join(place_descriptions)}

Output valid JSON:
{{
  "opening_narration": "2-3 sentence hook about the area and what we'll explore",
  "closing_narration": "2-sentence summary inviting the listener to visit",
  "segments": [
    {{
      "narration_text": "25-40 words highlighting rating, specialty, why to visit",
      "poi_names": ["exact place name"],
      "transition_description": "how the camera approaches this place",
      "ambient_notes": "weather/architectural observation"
    }}
  ]
}}

Rules:
- One segment per place, in the same order
- Each narration_text: 25-40 words, mention rating if >= 4.0
- Match tone to intent: "nightlife"=energetic, "family"=warm, "food"=appetizing
- Reference weather naturally in opening
- Include specific details from reviews when available"""

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                response_mime_type="application/json",
            ),
        )
        result = json.loads(response.text)
    except Exception as e:
        print(f"Narration generation failed: {e}, using fallback")
        result = _build_fallback_narration(area_name, intent, places)

    return result


def _build_fallback_narration(area_name: str, intent: str, places: list[dict]) -> dict:
    segments = []
    for p in places:
        rating_text = f", rated {p.get('rating', 'N/A')} stars" if p.get("rating") else ""
        segments.append({
            "narration_text": f"Here we arrive at {p['name']}{rating_text}. "
                              f"{p.get('description', 'A great spot to check out.')}",
            "poi_names": [p["name"]],
            "transition_description": f"Approaching {p['name']}",
            "ambient_notes": "",
        })
    return {
        "opening_narration": f"Welcome to {area_name}! Let me show you the best {intent} spots in the area.",
        "closing_narration": f"That wraps up our {intent} tour of {area_name}. I hope you enjoyed the journey!",
        "segments": segments,
    }
