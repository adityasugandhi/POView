import json
import re


def parse_json_from_text(text: str) -> dict:
    """Strips markdown code fences and parses JSON from LLM output."""
    cleaned = text.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    return json.loads(cleaned)


# Re-export schema utilities from gemini_client for agent use
