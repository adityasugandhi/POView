/**
 * POView — Zustand Simulation Store
 *
 * Central nervous system for voice-globe synchronization.
 * Split into three partitions:
 *
 * A) REACTIVE STATE — triggers React re-renders via selectors
 * B) TRANSIENT SIMULATION STATE — accessed ONLY via getState(), NEVER renders
 * C) TRANSIENT TOUR STATE — accessed ONLY via getState()/subscribe(), NEVER renders
 *
 * Access patterns:
 *   React components → useSimulationStore(state => state.field)   [reactive]
 *   CesiumJS loops   → useSimulationStore.getState().field        [transient]
 *   Audio bridge     → useSimulationStore.getState().field        [transient]
 *   WebSocket        → useSimulationStore.subscribe(...)           [transient]
 */

import { create } from "zustand";
import type {
  CameraTelemetry,
  NarrationTimeline,
  VisiblePOI,
  NeighborhoodProfile,
  Recommendation,
  WeatherData,
  TourStatus,
  DefaultLocation,
  CameraWaypoint,
  Viewport,
} from "@/types/simulation";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface SimulationState {
  // ── A) Reactive State (OK to use as selectors — triggers renders) ──────

  isVoiceSessionActive: boolean;
  profileData: NeighborhoodProfile | null;
  recommendationsData: Recommendation[];
  insightPanelVisible: boolean;
  recommendationsPanelVisible: boolean;
  searchQuery: string;
  weatherState: string;
  weatherData: WeatherData | null;
  liveApiConnectionStatus:
    | "disconnected"
    | "connecting"
    | "connected"
    | "error";
  tourStatus: TourStatus;

  // UI / navigation state
  hasStarted: boolean;
  isTransitioning: boolean;
  defaultLocation: DefaultLocation | null;
  location: { lat: number; lng: number } | null;
  viewport: Viewport | null;
  selectedRecommendation: Recommendation | null;
  recenterTrigger: number;
  layersVisible: boolean;
  loading: boolean;
  error: string;

  // Scanning state (GridScanLoader during fly_to_location)
  isScanning: boolean;

  // Cinematic flight state
  cinematicFlight: {
    active: boolean;
    phase: "high-orbit" | "approach" | "arrive" | "orbit" | "idle";
    targetLat: number;
    targetLng: number;
  } | null;

  // Legacy drone waypoints (kept for backward-compat, replaced by tour engine)
  droneWaypoints: CameraWaypoint[];
  activeDroneWaypoint: CameraWaypoint | null;
  isDroneFlying: boolean;

  // ── B) Transient Simulation State (NEVER use as selector) ─────────────

  cameraTelemetry: CameraTelemetry;
  audioPlaybackTime: number;
  visiblePOIs: VisiblePOI[];
  lastContextInjectionTime: number;

  // ── C) Transient Tour State (NEVER use as selector — use subscribe) ───

  narrationTimeline: NarrationTimeline | null;
  currentSegmentIndex: number;
  tourStartAudioTime: number;
  // trajectorySpline and tourStartJulianDate are stored as opaque refs
  // (not serializable — managed outside Zustand by the sync controller)

  // ── Actions ───────────────────────────────────────────────────────────

  // Reactive setters
  setProfileData: (data: NeighborhoodProfile | null) => void;
  setRecommendationsData: (data: Recommendation[]) => void;
  setWeatherState: (state: string) => void;
  setWeatherData: (data: WeatherData | null) => void;
  setLocation: (loc: { lat: number; lng: number } | null) => void;
  setViewport: (vp: Viewport | null) => void;
  setSelectedRecommendation: (rec: Recommendation | null) => void;
  setRecenterTrigger: () => void;
  setLayersVisible: (visible: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setHasStarted: (started: boolean) => void;
  setIsTransitioning: (transitioning: boolean) => void;
  setDefaultLocation: (loc: DefaultLocation | null) => void;
  setIsVoiceSessionActive: (active: boolean) => void;
  setTourStatus: (status: TourStatus) => void;
  setIsScanning: (scanning: boolean) => void;
  setCinematicFlight: (flight: SimulationState["cinematicFlight"]) => void;
  setLiveApiConnectionStatus: (
    status: SimulationState["liveApiConnectionStatus"],
  ) => void;

  // Legacy drone
  setDroneWaypoints: (waypoints: CameraWaypoint[]) => void;
  setActiveDroneWaypoint: (wp: CameraWaypoint | null) => void;
  setIsDroneFlying: (flying: boolean) => void;

  // Transient setters (called from non-React code, bypass reconciliation)
  setCameraTelemetry: (telemetry: CameraTelemetry) => void;
  setAudioTime: (time: number) => void;
  setVisiblePOIs: (pois: VisiblePOI[]) => void;
  setLastContextInjectionTime: (time: number) => void;

  // Tour actions
  loadNarrationTimeline: (timeline: NarrationTimeline) => void;
  advanceSegment: () => void;
  setTourStartAudioTime: (time: number) => void;
  clearTour: () => void;

  // Compound actions
  clearSearch: () => void;
  getSimulationSnapshot: () => {
    cameraTelemetry: CameraTelemetry;
    audioPlaybackTime: number;
    visiblePOIs: VisiblePOI[];
    tourStatus: TourStatus;
    currentSegmentIndex: number;
    narrationTimeline: NarrationTimeline | null;
  };
}

// ---------------------------------------------------------------------------
// Default transient state
// ---------------------------------------------------------------------------

const DEFAULT_CAMERA_TELEMETRY: CameraTelemetry = {
  lat: 0,
  lng: 0,
  alt: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  viewRectangle: null,
};

// ---------------------------------------------------------------------------
// Store creation
// ---------------------------------------------------------------------------

export const useSimulationStore = create<SimulationState>((set, get) => ({
  // ── A) Reactive defaults ──────────────────────────────────────────────

  isVoiceSessionActive: false,
  profileData: null,
  recommendationsData: [],
  insightPanelVisible: false,
  recommendationsPanelVisible: false,
  searchQuery: "",
  weatherState: "clear",
  weatherData: null,
  liveApiConnectionStatus: "disconnected",
  tourStatus: "idle",

  isScanning: false,
  cinematicFlight: null,
  hasStarted: false,
  isTransitioning: false,
  defaultLocation: null,
  location: null,
  viewport: null,
  selectedRecommendation: null,
  recenterTrigger: 0,
  layersVisible: true,
  loading: false,
  error: "",

  droneWaypoints: [],
  activeDroneWaypoint: null,
  isDroneFlying: false,

  // ── B) Transient defaults ─────────────────────────────────────────────

  cameraTelemetry: DEFAULT_CAMERA_TELEMETRY,
  audioPlaybackTime: 0,
  visiblePOIs: [],
  lastContextInjectionTime: 0,

  // ── C) Tour defaults ──────────────────────────────────────────────────

  narrationTimeline: null,
  currentSegmentIndex: -1,
  tourStartAudioTime: 0,

  // ── Reactive setters ──────────────────────────────────────────────────

  setProfileData: (data) => set({ profileData: data }),
  setRecommendationsData: (data) => set({ recommendationsData: data }),
  setWeatherState: (state) => set({ weatherState: state }),
  setWeatherData: (data) => set({ weatherData: data }),
  setLocation: (loc) => set({ location: loc }),
  setViewport: (vp) => set({ viewport: vp }),
  setSelectedRecommendation: (rec) => set({ selectedRecommendation: rec }),
  setRecenterTrigger: () =>
    set((s) => ({ recenterTrigger: s.recenterTrigger + 1 })),
  setLayersVisible: (visible) => set({ layersVisible: visible }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setHasStarted: (started) => set({ hasStarted: started }),
  setIsTransitioning: (transitioning) =>
    set({ isTransitioning: transitioning }),
  setDefaultLocation: (loc) => set({ defaultLocation: loc }),
  setIsScanning: (scanning) => set({ isScanning: scanning }),
  setCinematicFlight: (flight) => set({ cinematicFlight: flight }),
  setIsVoiceSessionActive: (active) => set({ isVoiceSessionActive: active }),
  setTourStatus: (status) => set({ tourStatus: status }),
  setLiveApiConnectionStatus: (status) =>
    set({ liveApiConnectionStatus: status }),

  // Legacy drone
  setDroneWaypoints: (waypoints) => set({ droneWaypoints: waypoints }),
  setActiveDroneWaypoint: (wp) => set({ activeDroneWaypoint: wp }),
  setIsDroneFlying: (flying) => set({ isDroneFlying: flying }),

  // ── Transient setters (no render triggers — called via getState()) ────

  setCameraTelemetry: (telemetry) => {
    // Direct mutation to avoid triggering subscribers that do shallow compare
    const state = get();
    state.cameraTelemetry = telemetry;
  },

  setAudioTime: (time) => {
    const state = get();
    state.audioPlaybackTime = time;
  },

  setVisiblePOIs: (pois) => {
    const state = get();
    state.visiblePOIs = pois;
  },

  setLastContextInjectionTime: (time) => {
    const state = get();
    state.lastContextInjectionTime = time;
  },

  // ── Tour actions ──────────────────────────────────────────────────────

  loadNarrationTimeline: (timeline) =>
    set({
      narrationTimeline: timeline,
      currentSegmentIndex: -1,
      tourStatus: "loading",
    }),

  advanceSegment: () => {
    const state = get();
    const nextIndex = state.currentSegmentIndex + 1;
    // Use direct mutation for the segment index (high freq, non-reactive)
    state.currentSegmentIndex = nextIndex;
  },

  setTourStartAudioTime: (time) => {
    const state = get();
    state.tourStartAudioTime = time;
  },

  clearTour: () =>
    set({
      narrationTimeline: null,
      currentSegmentIndex: -1,
      tourStatus: "idle",
      tourStartAudioTime: 0,
    }),

  // ── Compound actions ──────────────────────────────────────────────────

  clearSearch: () =>
    set({
      recommendationsData: [],
      selectedRecommendation: null,
      location: null,
      profileData: null,
      weatherState: "clear",
      weatherData: null,
      droneWaypoints: [],
      activeDroneWaypoint: null,
      isDroneFlying: false,
      error: "",
    }),

  getSimulationSnapshot: () => {
    const s = get();
    return {
      cameraTelemetry: { ...s.cameraTelemetry },
      audioPlaybackTime: s.audioPlaybackTime,
      visiblePOIs: [...s.visiblePOIs],
      tourStatus: s.tourStatus,
      currentSegmentIndex: s.currentSegmentIndex,
      narrationTimeline: s.narrationTimeline,
    };
  },
}));
