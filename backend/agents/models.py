
from pydantic import BaseModel, Field


class CameraWaypoint(BaseModel):
    label: str = Field(..., description="Descriptive label: 'Overview', POI name, or 'Return'.")
    latitude: float
    longitude: float
    altitude: float = Field(..., description="Meters above ground level.")
    heading: float = Field(..., description="Compass heading in degrees (0=North).")
    pitch: float = Field(..., description="Camera pitch in degrees (negative=looking down).")
    roll: float = 0.0
    duration: float = Field(..., description="Flight duration in seconds to reach this waypoint.")
    pause_after: float = Field(1.0, description="Dwell time in seconds before advancing to next waypoint.")


class VisualizationPlan(BaseModel):
    waypoints: list[CameraWaypoint]
    total_duration: float = Field(..., description="Sum of all waypoint durations and pauses.")


class ExtractedPOI(BaseModel):
    name: str
    latitude: float
    longitude: float
    relevance: str = Field(..., description="Brief reason this POI is notable.")
