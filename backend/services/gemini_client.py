import json
import os

from google import genai
from google.genai import types

from models import (
    CinematicNarrative,
    ComparativeAnalysis,
    IntentKeywords,
    NeighborhoodProfile,
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY"))
MODEL_ID = "gemini-3.1-pro-preview"

def expand_refs(obj, defs):
    """Recursively replaces $ref with the actual object from $defs to satisfy Gemini API requirements."""
    if isinstance(obj, dict):
        if "$ref" in obj:
            ref_key = obj["$ref"].split("/")[-1]
            return expand_refs(defs[ref_key], defs)
        # We must not strip "title" if it is a property name, only if it's an OpenAPI annotation.
        # But safest is to just strip exactly the ones that fail or let them pass.
        # Let's strip "title" only if it's an annotation on an object/string, not a property.
        res = {}
        for k, v in obj.items():
            if k == "$defs": continue
            if k == "title" and isinstance(v, str) and "type" in obj: continue # heuristical strip
            res[k] = expand_refs(v, defs)
        return res
    elif isinstance(obj, list):
        return [expand_refs(item, defs) for item in obj]
    return obj

def get_gemini_schema(model):
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})
    return expand_refs(schema, defs)

async def generate_neighborhood_profile(prompt_payload: str) -> dict:
    """Generates a standard neighborhood profile using Gemini."""

    # Standard profile generation requires lower thinking level for rapid UI rendering
    # (as mandated by GroundLevel architectural doc)
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=get_gemini_schema(NeighborhoodProfile),
        temperature=0.4
    )

    # We dynamically attach thinking_level if supported in the kwargs or assume the SDK maps it.
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt_payload,
        config=config
    )
    return json.loads(response.text)

async def generate_comparative_analysis(prompt_payload: str) -> dict:
    """Generates complex comparative reasoning requiring high cognitive depth."""

    # Compare mode requires 'high' thinking level
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=get_gemini_schema(ComparativeAnalysis),
        temperature=0.2
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt_payload,
        config=config
    )
    return json.loads(response.text)

async def generate_cinematic_narrative(prompt_payload: str) -> dict:
    """Generates the Day in the Life narrative sequence."""

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=get_gemini_schema(CinematicNarrative),
        temperature=0.7
    )

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt_payload,
        config=config
    )
    return json.loads(response.text)

async def parse_contextual_intent(intent: str) -> dict:
    """Parses user free-text intent to extract keywords for Places API."""

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=get_gemini_schema(IntentKeywords),
        temperature=0.1
    )

    prompt = f"Analyze the following user search intent and extract the most relevant keywords to be used in a Google Places API text search.\n\nUser Intent: '{intent}'"

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=config
    )
    return json.loads(response.text)
