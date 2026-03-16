from google.adk.agents import LlmAgent
from google.adk.tools import google_search
from google.genai import types


def create_script_writer_agent() -> LlmAgent:
    """Creates the ScriptWriter agent with Google Search grounding."""

    return LlmAgent(
        name="ScriptWriterAgent",
        model="gemini-3.1-pro-preview-customtools",
        instruction="""You are an expert urban analyst and neighborhood storyteller. Your task is to produce a rich, grounded narrative about the location provided in the session state.

Use your Google Search grounding tool to gather real-time, verified facts about this area. Do NOT fabricate information.

Your narrative MUST cover ALL of the following dimensions:
- **Vibe & Identity**: What does this neighborhood feel like? Cultural character, energy level, aesthetic.
- **Walkability**: How pedestrian-friendly is it? Sidewalk quality, distances between key amenities.
- **Food Scene**: Notable restaurants, cuisines, price ranges, hidden gems.
- **Nightlife**: Bars, clubs, late-night options, social scene.
- **Safety**: General safety perception, well-lit areas, any known concerns.
- **Transit**: Public transportation options, connectivity, commute convenience.
- **Affordability**: Cost of living relative to the broader metro area.
- **Highlights**: Top 3-5 unique features or landmarks that define this area.
- **Insider Tips**: Local knowledge that only residents would know.
- **Demographics**: Who lives here? Age groups, professions, lifestyle patterns.

CRITICAL: You MUST embed specific place names with their approximate coordinates (latitude, longitude) throughout the narrative. For example: "Blue Bottle Coffee (34.0522, -118.2437) anchors the morning ritual..."

The user's search context and weather conditions are provided in the session state. Adapt your narrative tone accordingly.

Write 400-600 words of rich, specific, grounded text. Do NOT format as JSON — just write the narrative as flowing text.""",
        tools=[google_search],
        generate_content_config=types.GenerateContentConfig(
            temperature=0.5,
        ),
        output_key="raw_narrative",
    )
