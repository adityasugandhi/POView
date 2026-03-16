from google.adk.agents import LlmAgent
from google.genai import types

from models import NeighborhoodProfile


def create_formatter_agent() -> LlmAgent:
    """Creates the Formatter agent that structures raw narrative into NeighborhoodProfile JSON."""

    return LlmAgent(
        name="FormatterAgent",
        model="gemini-3.1-pro-preview",
        instruction="""You are a strict JSON formatter. You will receive two pieces of data from the session state:

1. `raw_narrative` — A rich text narrative about a neighborhood
2. `visualization_plan` — A camera flight plan with waypoints

Your job is to extract and structure ALL information from the raw_narrative into the exact NeighborhoodProfile JSON schema.

Rules:
- Extract real data from the narrative. Do NOT invent or hallucinate any information.
- Every field must be populated based on what the narrative describes.
- Scores (1-10) should reflect the narrative's assessment of each dimension.
- The `highlights` array should capture the most notable features mentioned.
- The `insider_tip` should come directly from the narrative's insider knowledge section.
- Keep the `tagline` punchy and under 10 words.
- The `vibe_description` must be exactly 2-3 sentences.

Output ONLY the valid JSON object matching the schema. No markdown, no explanation.""",
        output_schema=NeighborhoodProfile,
        generate_content_config=types.GenerateContentConfig(
            temperature=0.1,
        ),
        output_key="final_ui_payload",
    )
