
from pydantic import BaseModel, Field


class ScoreDetail(BaseModel):
    value: int = Field(..., ge=1, le=10, description="Numerical score ranging from 1 to 10.")
    note: str = Field(..., description="A single, highly specific sentence justifying the assigned numerical score.")

class Scores(BaseModel):
    walkability: ScoreDetail
    food_scene: ScoreDetail
    nightlife: ScoreDetail
    family_friendly: ScoreDetail
    transit: ScoreDetail
    safety: ScoreDetail
    affordability: ScoreDetail

class Highlight(BaseModel):
    icon_identifier: str = Field(..., description="A strictly alphanumeric, lowercase keyword used by Next.js to map to an SVG icon. No emojis.")
    title: str = Field(..., description="Condensed descriptive title (2-4 words).")
    description: str = Field(..., description="A single explanatory sentence detailing the specific highlight.")

class NeighborhoodProfile(BaseModel):
    neighborhood_name: str
    tagline: str = Field(..., description="Highly memorable, punchy summary strictly capped at a maximum of ten words.")
    vibe_description: str = Field(..., description="Highly specific atmospheric evaluation restricted to exactly two or three sentences.")
    best_for: list[str] = Field(..., description="Three to four demographic profiles that align with the location.")
    not_ideal_for: list[str] = Field(..., description="Two to three explicit callouts identifying incompatible demographics.")
    scores: Scores
    highlights: list[Highlight] = Field(..., description="Sequential list of the location's most prominent features.")
    insider_tip: str = Field(..., description="Actionable, hyper-local knowledge restricted to one or two sentences.")
    one_liner_summary: str = Field(..., description="A single-sentence elevator pitch summarizing the entire evaluation.")

class CategoryComparison(BaseModel):
    category: str = Field(..., description="The specific metric being evaluated.")
    winner: str = Field(..., description="Strictly limited to 'A', 'B', or 'tie'")
    insight: str = Field(..., description="A highly specific, single-sentence justification for the assigned verdict.")

class ComparativeAnalysis(BaseModel):
    summary: str = Field(..., description="A definitive bottom-line assessment restricted to three or four sentences.")
    winner_overall: str = Field(..., description="Strictly limited to 'A', 'B', or 'depends'.")
    winner_explanation: str = Field(..., description="A concise justification restricted to two sentences.")
    category_comparisons: list[CategoryComparison]
    choose_a_if: str = Field(..., description="Conditional statement completing 'Choose Location A if you...'")
    choose_b_if: str = Field(..., description="Conditional statement completing 'Choose Location B if you...'")

class PlaceMention(BaseModel):
    name: str = Field(..., description="Exact entity name as provided in the source data.")
    time_of_day: str = Field(..., description="Categorical tag strictly restricted to 'morning', 'afternoon', or 'evening'.")
    lat: float
    lng: float

class CinematicNarrative(BaseModel):
    narrative: str = Field(..., description="The complete sequential story, spanning exactly 150 to 200 words, from a second-person perspective.")
    places_mentioned: list[PlaceMention] = Field(..., description="Chronological list of geographic entities incorporated into the narrative.")

class CommuteAnalysis(BaseModel):
    recommended_mode: str
    recommendation_reason: str = Field(..., description="A concise, logical justification restricted to two sentences.")
    daily_reality: str = Field(..., description="A qualitative assessment of the commuting experience restricted to exactly three sentences.")
    pro_tip: str = Field(..., description="A single, highly actionable piece of advice or shortcut regarding the route.")

class IntentKeywords(BaseModel):
    keywords: list[str] = Field(..., description="One to three highly actionable search terms derived from the user intent for the Google Places API. Strictly no emojis allowed.")
    search_rationale: str = Field(..., description="A single sentence explaining why these keywords best capture the user's intent. Strictly no emojis allowed.")


# --- Narrated Tour Models (Voice-Globe Sync Engine) ---

class TrajectoryTimestamp(BaseModel):
    """Dense trajectory sample for SampledPositionProperty interpolation."""
    time_s: float = Field(..., description="Seconds from tour start.")
    lat: float
    lng: float
    alt: float
    heading: float
    pitch: float

class NarrationSegment(BaseModel):
    """One narration segment bound to one camera waypoint."""
    segment_id: int
    waypoint: dict = Field(..., description="CameraWaypoint data (label, lat, lng, alt, heading, pitch, duration, pause_after).")
    narration_text: str = Field(..., description="Text the voice agent should speak at this camera position.")
    poi_names: list[str] = Field(default_factory=list, description="POIs visible from this camera angle.")
    poi_context: dict = Field(default_factory=dict, description="POI enrichment: {name: {rating, type, notable_fact}}.")
    transition_description: str = Field("", description="Describes camera movement, e.g., 'sweeping east along the waterfront'.")
    estimated_speech_duration_s: float = Field(..., description="word_count / 2.5 seconds.")
    cumulative_start_time_s: float = Field(..., description="Seconds from tour start when this segment begins.")
    ambient_notes: str = Field("", description="Weather, architectural style, time-of-day color.")

class NarrationTimeline(BaseModel):
    """Complete synchronized tour: trajectory + narration segments."""
    place_name: str
    place_id: str
    intent: str = ""
    total_segments: int
    total_estimated_duration_s: float
    opening_narration: str = Field(..., description="Spoken before camera moves (2-3 sentence hook).")
    closing_narration: str = Field(..., description="Spoken after final waypoint (2-sentence summary).")
    segments: list[NarrationSegment]
    weather_context: dict = Field(default_factory=dict)
    trajectory_timestamps: list[TrajectoryTimestamp] = Field(default_factory=list, description="Dense position samples every 0.5s for SampledPositionProperty.")
