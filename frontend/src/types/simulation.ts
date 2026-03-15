/**
 * POView — Shared TypeScript interfaces for the Voice-Globe Synchronization Engine.
 * These types mirror backend Pydantic models and define the simulation state shape.
 */

// --- Camera & Spatial ---

export interface CameraTelemetry {
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  pitch: number;
  roll: number;
  viewRectangle: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
}

export interface VisiblePOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
  rating: number;
}

// --- Camera Waypoint (matches backend agents/models.py) ---

export interface CameraWaypoint {
  label: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  pitch: number;
  roll: number;
  duration: number;
  pause_after: number;
}

// --- NarrationTimeline (matches backend models.py) ---

export interface NarrationSegment {
  segment_id: number;
  waypoint: CameraWaypoint;
  narration_text: string;
  poi_names: string[];
  poi_context: Record<
    string,
    { rating: number; type: string; notable_fact: string }
  >;
  transition_description: string;
  estimated_speech_duration_s: number;
  cumulative_start_time_s: number;
  ambient_notes: string;
}

export interface NarrationTimeline {
  place_name: string;
  place_id: string;
  intent: string;
  total_segments: number;
  total_estimated_duration_s: number;
  opening_narration: string;
  closing_narration: string;
  segments: NarrationSegment[];
  weather_context: Record<string, unknown>;
  trajectory_timestamps: TrajectoryTimestamp[];
}

export interface TrajectoryTimestamp {
  time_s: number;
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  pitch: number;
}

// --- Tour Playback ---

export type TourStatus =
  | "idle"
  | "loading"
  | "opening"
  | "playing"
  | "narrating"
  | "paused"
  | "closing";

// --- Spatial Context (WebSocket messages) ---

export interface SpatialContextPayload {
  type: "camera_context";
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  pitch: number;
  visible_pois: Array<{ name: string; rating: number; type: string }>;
  bounding_box: { west: number; south: number; east: number; north: number };
}

export interface TourProgressPayload {
  type: "tour_progress";
  segment_id: number;
  playback_state: "segment_boundary" | "playing" | "paused" | "completed";
  audio_time_s: number;
}

export interface TourLifecyclePayload {
  type: "tour_start" | "tour_pause" | "tour_resume" | "tour_stop";
}

// --- Weather (from backend) ---

export interface WeatherData {
  temperature: number;
  condition: string;
  ai_summary: string;
  render_state: string;
  is_day: boolean;
}

// --- Recommendation (from proximity search) ---

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  timeAgo: string;
}

export interface Recommendation {
  name: string;
  rating: number;
  description?: string;
  lat: number;
  lng: number;
  routingPath?: number[][];
  photoUrls?: string[];
  reviews?: PlaceReview[];
  address?: string;
  phone?: string;
  website?: string;
  hours?: string[];
  priceLevel?: string;
  ratingCount?: number;
}

// --- Neighborhood Profile (from backend) ---

export interface ScoreDetail {
  value: number;
  note: string;
}

export interface Highlight {
  icon_identifier: string;
  title: string;
  description: string;
}

export interface NeighborhoodProfile {
  neighborhood_name: string;
  tagline: string;
  vibe_description: string;
  best_for: string[];
  not_ideal_for: string[];
  scores: {
    walkability: ScoreDetail;
    food_scene: ScoreDetail;
    nightlife: ScoreDetail;
    family_friendly: ScoreDetail;
    transit: ScoreDetail;
    safety: ScoreDetail;
    affordability: ScoreDetail;
  };
  highlights: Highlight[];
  insider_tip: string;
  one_liner_summary: string;
  weather?: WeatherData;
}

// --- Default Location (from LocationSelector) ---

export interface DefaultLocation {
  placeId: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface Viewport {
  low: { latitude: number; longitude: number };
  high: { latitude: number; longitude: number };
}
