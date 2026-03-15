# POView — Definitive Implementation Blueprint
# Voice-Globe Spatially-Aware Synchronization Engine
# Version: FINAL — March 15, 2026

> **Purpose**: This document is the single source of truth for the POView voice-globe synchronization upgrade. It is structured as a phased agentic IDE playbook — each phase is a self-contained prompt designed to be fed sequentially into Cursor, Windsurf, or any agentic coding environment. The agent must complete and validate each phase before receiving the next.
>
> **Prerequisite**: Read `architecture_review.md` in its entirety before beginning any phase. That document describes every existing file, endpoint, data model, and component in the current codebase.

---

## Table of Contents

1. [Architectural Diagnosis — The Five Synchronization Gaps](#1-architectural-diagnosis)
2. [Target Architecture — Unified Clock-Driven Tour Engine](#2-target-architecture)
3. [Core Architectural Decisions and Rationale](#3-core-architectural-decisions)
4. [Phase 0 — Constitutional Rules (.cursorrules)](#phase-0)
5. [Phase 1 — Zustand Transient State Infrastructure](#phase-1)
6. [Phase 2 — Spatial Perception and Frustum Culling Engine](#phase-2)
7. [Phase 3 — Backend NarrationTimeline Pipeline](#phase-3)
8. [Phase 4 — Gemini Live API Context Injection Protocol](#phase-4)
9. [Phase 5 — Audio-Visual Clock Synchronization Engine](#phase-5)
10. [Phase 6 — Tour Playback Orchestrator and UI](#phase-6)
11. [Phase 7 — Integration Testing and Calibration](#phase-7)
12. [Appendix A — Data Model Schemas](#appendix-a)
13. [Appendix B — Technical Constraints and Gotchas](#appendix-b)

---

## 1. Architectural Diagnosis — The Five Synchronization Gaps <a id="1-architectural-diagnosis"></a>

The current POView platform operates with five critical disconnections between its voice assistant and 3D globe rendering:

**Gap 1 — Contextual Blindness**: The Gemini Live voice agent receives only microphone audio. It has zero awareness of the camera's geographic position, altitude, heading, or which POIs are currently visible on screen. It cannot describe what the user sees because it does not know what the user sees.

**Gap 2 — Temporal Desynchronization**: The SSE-streamed drone waypoints execute on the JavaScript event loop timeline. The Gemini audio response plays on the Web Audio API hardware clock. These are two independent timing systems. Network jitter causes the camera to outpace or lag behind the narration, destroying the illusion of a unified tour guide.

**Gap 3 — Narrative-Waypoint Misalignment**: The ScriptWriter agent produces a 400-600 word narrative. The GlobeController agent produces camera waypoints. But the narrative text is never segmented or time-aligned to specific waypoints. There is no data structure that says "speak THIS sentence while the camera is at THIS position."

**Gap 4 — State Management Bottleneck**: All frontend state flows through React `useState` in `page.tsx` via prop drilling. Camera telemetry updating at 60Hz through React state will trigger catastrophic re-render cascades, starving the WebGL rendering thread and causing audio buffer underruns (crackling/dropouts).

**Gap 5 — Fire-and-Forget Tour Execution**: Once a drone tour starts, neither the voice agent nor the backend receives progress updates. There is no mechanism to pause the camera if audio buffers, skip narration if the user interrupts, or dynamically enrich context as the camera discovers new areas.

---

## 2. Target Architecture — Unified Clock-Driven Tour Engine <a id="2-target-architecture"></a>

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                          │
│  Voice (Mic/Speaker)  ←→  3D Globe (CesiumJS)  ←→  UI Panels          │
└──────────┬──────────────────────┬──────────────────────┬───────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     ZUSTAND TRANSIENT STATE STORE                       │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ REACTIVE STATE   │  │ TRANSIENT STATE   │  │ TOUR STATE            │  │
│  │ (triggers render)│  │ (NO renders)      │  │ (NO renders)          │  │
│  │                  │  │                   │  │                       │  │
│  │ isVoiceActive    │  │ cameraTelemetry   │  │ narrationTimeline     │  │
│  │ profileData      │  │ audioPlaybackTime │  │ currentSegmentIndex   │  │
│  │ panelVisibility  │  │ visiblePOIs[]     │  │ tourPlaybackState     │  │
│  │ searchQuery      │  │ viewBoundingBox   │  │ audioSegmentEndTime   │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────────┘  │
│                                                                         │
│  Access pattern:                                                        │
│  • React components → useSimulationStore(selector) [reactive only]      │
│  • CesiumJS event loop → useSimulationStore.getState() [transient]      │
│  • AudioWorklet bridge → useSimulationStore.getState() [transient]      │
│  • WebSocket handlers → useSimulationStore.subscribe() [transient]      │
└─────────────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   SYNCHRONIZATION ENGINE (Frontend)                      │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    MASTER CLOCK: Web Audio API                     │  │
│  │         audioContext.currentTime + audioContext.outputLatency      │  │
│  │              ↓ (pushed to Zustand every frame)                    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────┐  ┌────────────────────────┐    │
│  │ CesiumJS Camera Controller         │  │ Narration Cue Engine   │    │
│  │                                    │  │                        │    │
│  │ viewer.scene.preUpdate listener:   │  │ Monitors audioTime vs  │    │
│  │ 1. Read audioPlaybackTime from     │  │ segment boundaries.    │    │
│  │    Zustand.getState()              │  │ When audioTime crosses │    │
│  │ 2. Convert to JulianDate           │  │ a segment threshold:   │    │
│  │ 3. Evaluate SampledPositionProperty│  │ → inject next narration│    │
│  │ 4. camera.setView(position)        │  │   cue via WebSocket    │    │
│  │                                    │  │ → update visiblePOIs   │    │
│  │ Result: camera FOLLOWS audio clock │  │ → fire UI callbacks    │    │
│  │ If audio stalls → camera freezes   │  │                        │    │
│  └────────────────────────────────────┘  └────────────────────────┘    │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Spatial Perception Engine (500ms throttled loop)                   │  │
│  │ 1. computeViewRectangle → WGS84 bounding box                     │  │
│  │ 2. Frustum culling → visible POI array                            │  │
│  │ 3. Push to Zustand transient state                                │  │
│  │ 4. If significant change → trigger backend Places API lookup      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI + ADK)                          │
│                                                                         │
│  WebSocket /ws/live/{session_id}                                        │
│  ├── Gemini Live API (bidirectional audio)                              │
│  ├── Inbound: audio PCM, tour_progress, camera_context                  │
│  ├── Outbound: audio PCM, narration_cue, tool_result                    │
│  └── Context injection: send_client_content(<SPATIAL_CONTEXT>)          │
│                                                                         │
│  Enhanced ADK SequentialAgent Pipeline:                                  │
│  ScriptWriter → GlobeController → NarrationPlanner → Formatter          │
│       │              │                  │                │               │
│  raw_narrative   waypoints[]    NarrationTimeline   NeighborhoodProfile  │
│  (Gemini 2.5    (camera path)  (segments: text +   (scores, highlights) │
│   Pro + Search)  (Flash)        waypoint + timing)  (Flash)             │
│                                      │                                  │
│                                      ▼                                  │
│                         SampledPositionProperty spline                   │
│                         (complete trajectory sent to frontend            │
│                          BEFORE audio playback begins)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Decisions and Rationale <a id="3-core-architectural-decisions"></a>

### Decision 1: Web Audio API is the Master Clock

**Why not JavaScript timers?** `setTimeout` and `setInterval` run on the JS event loop which is imprecise (±4-16ms jitter). The Web Audio API runs on a dedicated hardware clock driven by the audio subsystem's crystal oscillator. `AudioContext.currentTime` provides sub-millisecond precision independent of main-thread load.

**The rule**: `audioContext.currentTime + audioContext.outputLatency` is the single source of truth for all temporal synchronization. The CesiumJS camera is a slave to this clock. If audio buffers or stalls, the camera freezes in place. When audio resumes, the camera resumes. The narration and visuals can never drift apart.

### Decision 2: SampledPositionProperty Trajectory, Not Sequential flyTo()

**Why not sequential flyTo with complete callbacks?** The flyTo approach creates discrete jumps between waypoints. Each flyTo is independent — if audio stalls between segments, there is no mechanism to freeze the camera mid-flight. Sequential flyTo also creates visible easing resets at each waypoint boundary.

**The solution**: The backend computes the entire flight trajectory as a series of timestamped positions. The frontend loads this into a `Cesium.SampledPositionProperty` with `LAGRANGE` interpolation to create a smooth spline. A `viewer.scene.preUpdate` listener evaluates this spline at the current audio time on every frame, giving pixel-perfect continuous camera positioning that is mathematically bound to the audio clock.

### Decision 3: Zustand Transient State is Mandatory

**Why not React state?** Camera telemetry at 60Hz through `useState` triggers 60 re-renders per second of the entire component tree. This will cause WebGL frame drops, audio buffer underruns, and UI freezing. This is not a theoretical concern — it is a guaranteed failure mode at this update frequency.

**The rule**: All high-frequency data (camera position, audio time, visible POIs, tour progress) lives in Zustand transient state accessed ONLY via `useSimulationStore.getState()` and `useSimulationStore.subscribe()`. These patterns bypass React's reconciliation entirely. Only UI-visible state (panel toggles, profile data, search text) uses reactive Zustand selectors that trigger renders.

### Decision 4: Textual Telemetry Injection, Not Video Streaming

**Why not pipe the CesiumJS canvas as video to Gemini?** Video processing consumes 70-280 tokens per frame. A 10-minute tour would exhaust token limits and cost orders of magnitude more. Visual interpretation of overhead 3D tiles is error-prone for identifying specific POIs. Latency is unacceptable.

**The solution**: Extract the camera's WGS84 bounding box, query Google Places API for POIs in that region, and inject a structured text summary into the Gemini Live session via `send_client_content`. This gives the model perfect semantic accuracy at near-zero token cost and zero latency.

### Decision 5: Gemini Live Agent Speaks Narration (Not Pre-generated TTS)

**Why not pre-generate TTS audio for each segment?** Pre-generated audio cannot handle user interruptions (barge-in). It cannot adapt tone to the user's emotional state. It cannot answer questions mid-tour. It creates a brittle, non-interactive experience.

**The solution**: The NarrationTimeline provides narration text per segment. When the audio clock crosses a segment boundary, the backend injects the narration text into the Gemini Live session as a directed cue. The model speaks it with natural prosody, emotional adaptation (affective dialog), and maintains the ability to pause for user questions.

**Fallback**: If Gemini response latency (typically 320ms p50) creates noticeable gaps, pre-generate audio segments as a degraded fallback path. This is Option B, implemented only if Option A proves insufficient in testing.

### Decision 6: NON_BLOCKING Tool Calls for Tour Generation

**Why?** The `start_drone_tour` tool triggers the full ADK pipeline (ScriptWriter + GlobeController + NarrationPlanner + Formatter) which takes 5-15 seconds. A blocking tool call would leave the user in silence during this time.

**The solution**: Define `start_drone_tour` with `"behavior": "NON_BLOCKING"`. The agent immediately responds with conversational filler ("Let me calculate the best flight path...") while the pipeline runs in the background. When the tool result arrives, use `FunctionResponseScheduling.WHEN_IDLE` to smoothly inject the trajectory data without interrupting the agent mid-sentence.

---

## Phase 0 — Constitutional Rules <a id="phase-0"></a>

```
[AGENTIC PROMPT — PHASE 0: INITIALIZATION]

You are an expert Software Architect specializing in React 19, CesiumJS WebGL
rendering, Web Audio API synchronization, and the Gemini Live API. Your objective
is to refactor the POView platform (codename gods_eye) to achieve perfect temporal
and spatial synchronization between a 3D drone camera tour and a real-time voice
assistant.

BEFORE WRITING ANY CODE: Read the file architecture_review.md in its entirety.
This document describes every file, endpoint, data model, hook, and component in
the current codebase. You must understand the existing architecture completely.

Create a .cursorrules file at the project root. This file governs your behavior
for the ENTIRE refactoring process. Include these rules verbatim:

---START .cursorrules CONTENT---

# POView Refactoring Constitution

## Identity
You are refactoring POView, an autonomous urban intelligence platform built with:
- Backend: Python 3.11, FastAPI, Google Agent Development Kit (ADK), Gemini API, Redis, Pydantic v2
- Frontend: Next.js 16, React 19, TypeScript, CesiumJS + Resium, Tailwind CSS 4
- Voice: Gemini Live API (gemini-2.5-flash-native-audio-preview), WebSocket, AudioWorklet
- The full architecture is documented in architecture_review.md — reference it constantly.

## State Management Protocol
- Use Zustand for ALL global state management. Install it if not present.
- STRICTLY separate reactive state (UI toggles, profile data, panel visibility)
  from transient simulation state (camera telemetry, audio time, visible POIs, tour progress).
- For transient state: use ONLY useSimulationStore.getState() for reads and
  useSimulationStore.subscribe() for reactions. These NEVER trigger React renders.
- For reactive state: use useSimulationStore(state => state.someProperty) selectors.
- NEVER use React Context or useState for any data that updates more than once per second.
- NEVER pass camera coordinates, audio time, or POI arrays through React props.

## CesiumJS Mechanics Protocol
- NEVER bind Cesium entity positions to React state.
- Use Cesium.SampledPositionProperty with LAGRANGE interpolation for flight trajectories.
- Use viewer.scene.preUpdate.addEventListener() for the master sync loop.
- Use camera.flyTo() ONLY for one-off navigation (search results), NEVER for tour playback.
- Disable ScreenSpaceCameraController inputs during tour playback.
- For frustum culling: use camera.frustum.computeCullingVolume(). Throttle to 500ms.
- For bounding box: use viewer.scene.camera.computeViewRectangle().

## Audio Mechanics Protocol
- AudioContext.currentTime + AudioContext.outputLatency is the SINGLE master clock.
- Push this value to Zustand transient state on every frame.
- The CesiumJS camera is a SLAVE to this clock during tour playback.
- If audio stalls, the camera must freeze. When audio resumes, the camera resumes.

## Gemini Live API Protocol
- Context injection uses send_client_content with text turns.
- Prefix spatial context with the tag: <SPATIAL_CONTEXT>
- Prefix narration cues with the tag: [NARRATION_CUE]
- The model's system prompt must instruct it to silently absorb <SPATIAL_CONTEXT>
  without acknowledging it, and to speak [NARRATION_CUE] content naturally.
- Use NON_BLOCKING behavior for tour generation tool calls.
- Use WHEN_IDLE scheduling for tool responses during active speech.

## Code Generation Protocol
- Do NOT hallucinate imports. Verify every import exists in node_modules or the codebase.
- If a package is not in package.json, ASK before installing.
- Maintain the existing dark glassmorphic Tailwind CSS aesthetic precisely.
- Maintain the existing backend file structure (services/, agents/, models, etc.).
- Use Pydantic v2 for all new backend models.
- All new TypeScript interfaces must be defined in a shared types file.

## Confirmation Protocol
- After each phase, provide a SUMMARY of files created/modified.
- Do NOT proceed to the next phase until instructed.
- If any phase instruction is ambiguous, ASK for clarification before coding.

---END .cursorrules CONTENT---

After writing this file, respond ONLY with: "CONSTITUTIONAL RULES WRITTEN. Ready for Phase 1."
Do not write any other code.
```

---

## Phase 1 — Zustand Transient State Infrastructure <a id="phase-1"></a>

```
[AGENTIC PROMPT — PHASE 1: ZUSTAND STATE INFRASTRUCTURE]

Reference: .cursorrules, architecture_review.md

OBJECTIVE: Implement the Zustand state store that will serve as the central nervous
system for all voice-globe synchronization. This store must handle 60Hz camera
telemetry and audio timing WITHOUT triggering React re-renders.

INSTRUCTIONS:

1. Install Zustand:
   cd frontend && npm install zustand

2. Create file: src/store/useSimulationStore.ts

   Design and export a Zustand store with THREE distinct state partitions:

   A) REACTIVE STATE (triggers React renders when changed via selectors):
      - isVoiceSessionActive: boolean (default false)
      - profileData: NeighborhoodProfile | null
      - recommendationsData: Recommendation[] | null
      - insightPanelVisible: boolean
      - recommendationsPanelVisible: boolean
      - searchQuery: string
      - weatherState: WeatherData | null
      - liveApiConnectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'

   B) TRANSIENT SIMULATION STATE (NEVER triggers renders — accessed only via getState):
      - cameraTelemetry: {
          lat: number, lng: number, alt: number,
          heading: number, pitch: number, roll: number,
          viewRectangle: { west: number, south: number, east: number, north: number } | null
        }
      - audioPlaybackTime: number (seconds from AudioContext.currentTime + outputLatency)
      - visiblePOIs: Array<{ name: string, lat: number, lng: number, type: string, rating: number }>
      - lastContextInjectionTime: number (timestamp of last <SPATIAL_CONTEXT> push)

   C) TRANSIENT TOUR STATE (NEVER triggers renders — accessed only via getState/subscribe):
      - tourStatus: 'idle' | 'loading' | 'opening' | 'playing' | 'narrating' | 'paused' | 'closing'
      - narrationTimeline: NarrationTimeline | null (full timeline from backend)
      - currentSegmentIndex: number
      - tourStartJulianDate: any (Cesium.JulianDate reference for spline evaluation)
      - trajectorySpline: any (reference to loaded SampledPositionProperty)

   D) ATOMIC ACTIONS (one setter per property, plus compound actions):
      - setCameraTelemetry(telemetry) — called from CesiumJS preUpdate, updates partition B
      - setAudioTime(time) — called from audio frame loop, updates partition B
      - setVisiblePOIs(pois) — called from spatial perception engine, updates partition B
      - setTourStatus(status) — updates partition C
      - loadNarrationTimeline(timeline) — sets timeline + resets segment index, partition C
      - advanceSegment() — increments currentSegmentIndex, partition C
      - getSimulationSnapshot() — returns a frozen copy of ALL transient state (B + C)
        for use in non-React code. This calls getState() internally.

      For reactive state, use standard Zustand setters.

3. Create file: src/types/simulation.ts

   Define TypeScript interfaces for:
   - CameraTelemetry
   - NarrationSegment (matches backend Pydantic model)
   - NarrationTimeline (matches backend Pydantic model)
   - CameraWaypoint (matches existing backend model)
   - TourPlaybackState
   - SpatialContextPayload (for WebSocket messages)

4. Refactor src/app/page.tsx:

   Locate ALL existing useState hooks in page.tsx. For each one, determine:
   - If it tracks camera coordinates, viewport, weather effects tuning,
     drone waypoints, or WebSocket status → MIGRATE to Zustand.
   - If it tracks UI-visible state (panel toggles, profile data display,
     search input) → MIGRATE to Zustand reactive partition.
   - Remove the old useState declarations and replace reads/writes
     with Zustand selector hooks and actions.

   CRITICAL: Do NOT modify the actual CesiumJS viewer logic, the WebSocket
   connection logic, or the audio pipeline in this phase. Only migrate state.
   The existing functionality must continue working identically after migration.

5. Verify: Run `npm run build` and `npm run dev`. The application must behave
   identically to before. No visual or functional regressions.

Provide a summary of:
- Every useState hook that was migrated (old name → new Zustand property)
- Every useState hook that was intentionally left in place (and why)
- The complete interface for useSimulationStore
```

---

## Phase 2 — Spatial Perception and Frustum Culling Engine <a id="phase-2"></a>

```
[AGENTIC PROMPT — PHASE 2: SPATIAL PERCEPTION ENGINE]

Reference: .cursorrules, architecture_review.md, src/store/useSimulationStore.ts

OBJECTIVE: Build the engine that gives the voice assistant "vision" — the ability
to know what geographic region and which POIs are currently visible on the user's
3D globe. This engine must operate WITHOUT degrading CesiumJS WebGL performance.

INSTRUCTIONS:

1. Create file: src/lib/spatialPerceptionEngine.ts

   This is a pure TypeScript module (NOT a React hook). It receives a Cesium
   Viewer reference and attaches event listeners. It has zero React dependencies.

   Implement the following:

   A) THROTTLED TELEMETRY EXTRACTION
      - Attach to viewer.scene.preUpdate.addEventListener().
      - Maintain a lastExecutionTime variable. On each frame callback, check
        if 500ms have elapsed since last execution. If not, return immediately.
        Do NOT use setInterval — use the preUpdate delta for throttling.
      - When 500ms have elapsed, extract:
        a. Camera cartographic position:
           const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
           lat = Cesium.Math.toDegrees(cartographic.latitude);
           lng = Cesium.Math.toDegrees(cartographic.longitude);
           alt = cartographic.height;
        b. Camera orientation:
           heading = Cesium.Math.toDegrees(viewer.camera.heading);
           pitch = Cesium.Math.toDegrees(viewer.camera.pitch);
           roll = Cesium.Math.toDegrees(viewer.camera.roll);
        c. View bounding rectangle:
           const rect = viewer.scene.camera.computeViewRectangle(
             viewer.scene.globe.ellipsoid
           );
           If rect is defined, convert to degrees (west, south, east, north).
      - Push all values to Zustand via:
        useSimulationStore.getState().setCameraTelemetry({...})

   B) FRUSTUM CULLING FOR POI VISIBILITY
      - Maintain an internal registry of known POI coordinates (populated when
        the backend returns Places API results).
      - Expose a method: registerPOIs(pois: Array<{name, lat, lng, ...}>)
      - Inside the 500ms throttled loop, AFTER extracting telemetry:
        a. Compute the culling volume:
           const cullingVolume = viewer.scene.camera.frustum.computeCullingVolume(
             viewer.camera.positionWC,
             viewer.camera.directionWC,
             viewer.camera.upWC
           );
        b. For each registered POI, create a BoundingSphere:
           const poiCartesian = Cesium.Cartesian3.fromDegrees(poi.lng, poi.lat, 0);
           const boundingSphere = new Cesium.BoundingSphere(poiCartesian, 50);
        c. Test visibility:
           const visibility = cullingVolume.computeVisibility(boundingSphere);
           If visibility !== Cesium.Intersect.OUTSIDE → POI is visible.
        d. Collect all visible POIs into an array.
      - Push visible POIs to Zustand:
        useSimulationStore.getState().setVisiblePOIs(visibleArray)

   C) SIGNIFICANT CHANGE DETECTION
      - Maintain the previous bounding box and previous visible POI set.
      - After each computation, determine if a "significant change" occurred:
        * Bounding box center moved > 200 meters, OR
        * Altitude changed > 100 meters, OR
        * A new POI entered the frustum that was not visible before
      - If significant change detected, dispatch a custom event or call a
        registered callback: onSignificantChange(telemetry, visiblePOIs)
      - This callback will later be used (Phase 4) to trigger backend
        Places API lookups and Gemini context injection.

   D) INITIALIZATION AND CLEANUP
      - Export function: initSpatialPerception(viewer: Cesium.Viewer, onChange: callback)
      - Export function: destroySpatialPerception() — removes all event listeners
      - Export function: registerPOIs(pois) — for external modules to feed POI data

2. Integrate into the CesiumJS component:

   In the component that initializes the Cesium Viewer (Map3D or GlobeViewer),
   call initSpatialPerception(viewer) after the viewer is mounted.
   Call destroySpatialPerception() on component unmount.

   For now, pass a simple console.log callback for onSignificantChange
   so we can verify the engine is working.

3. Verify:
   - Open the browser console.
   - Navigate the globe manually. Every 500ms you should see telemetry logs.
   - The CesiumJS frame rate must remain at 60fps. If you see frame drops,
     the throttle is not working correctly — fix it.
   - No React re-renders should be triggered by telemetry updates.
     Verify using React DevTools Profiler.

Provide a summary of the spatial perception API surface and the throttle mechanism.
```

---

## Phase 3 — Backend NarrationTimeline Pipeline <a id="phase-3"></a>

```
[AGENTIC PROMPT — PHASE 3: NARRATION TIMELINE PIPELINE]

Reference: .cursorrules, architecture_review.md, backend/agents/workflow.py,
backend/agents/models.py, backend/models.py

OBJECTIVE: Create the NarrationTimeline — the unified data structure that binds
narration text segments to camera waypoints with precise timing. This requires
a new NarrationPlanner agent in the ADK pipeline and new Pydantic models.

INSTRUCTIONS:

1. Add new Pydantic models to backend/models.py:

   class NarrationSegment(BaseModel):
       """One narration segment bound to one camera waypoint."""
       segment_id: int
       waypoint: CameraWaypoint          # reuse existing model from agents/models.py
       narration_text: str               # what the voice should say at this position
       poi_names: list[str]              # POIs visible from this camera angle
       poi_context: dict                 # {name: {rating, type, notable_fact}}
       transition_description: str       # describes camera movement (e.g., "sweeping east along the waterfront")
       estimated_speech_duration_s: float # len(narration_text.split()) / 2.5
       cumulative_start_time_s: float    # seconds from tour start when this segment begins
       ambient_notes: str               # weather, architectural style, time-of-day color

   class NarrationTimeline(BaseModel):
       """Complete synchronized tour: trajectory + narration segments."""
       place_name: str
       place_id: str
       intent: str
       total_segments: int
       total_estimated_duration_s: float
       opening_narration: str            # spoken before camera moves
       closing_narration: str            # spoken after final waypoint
       segments: list[NarrationSegment]
       weather_context: dict
       trajectory_timestamps: list[dict] # [{time_s: float, lat, lng, alt, heading, pitch}]
                                         # dense trajectory points for SampledPositionProperty

   CRITICAL FIELD: cumulative_start_time_s
   This field defines WHEN each segment begins relative to tour start.
   Segment 0 starts at opening_narration_duration.
   Segment 1 starts at segment_0.cumulative_start_time_s + segment_0.estimated_speech_duration_s + segment_0.waypoint.duration.
   And so on. This creates the master timeline that the audio clock will reference.

   CRITICAL FIELD: trajectory_timestamps
   This is a dense array of position/orientation samples (every 0.5 seconds)
   computed from the waypoints via interpolation. The frontend loads this
   directly into a SampledPositionProperty. The backend must compute this
   so the frontend does not need to do spline math.

2. Create new agent: backend/agents/narration_planner.py

   This is a new agent that slots into the SequentialAgent chain AFTER
   GlobeController and BEFORE Formatter.

   Agent specification:
   - Model: gemini-2.5-flash (fast structured output)
   - Reads from ADK session state:
     * raw_narrative (from ScriptWriter)
     * visualization_plan (waypoints array from GlobeController)
     * weather_data, intent, nearby_pois (from initial context)
   - Writes to ADK session state:
     * narration_timeline (NarrationTimeline)

   System prompt for NarrationPlanner:

   """
   You are a cinematic tour narration planner. You receive a neighborhood
   narrative and a list of camera waypoints with coordinates, altitude,
   heading, pitch, and duration.

   Your job: split the narrative into exactly N segments (one per waypoint)
   where each segment describes EXACTLY what the camera shows at that position.

   Rules:
   1. opening_narration: 2-3 sentence hook spoken BEFORE the camera moves.
      Estimated duration: word_count / 2.5 seconds.
   2. Each segment's narration_text must be speakable in approximately the same
      duration as its waypoint's flight + pause time. Target: 2.5 words/second.
      A 10-second waypoint = ~25 words of narration.
   3. Reference SPECIFIC POI names from poi_names and poi_context.
      Mention real ratings and notable facts.
   4. transition_description must match camera movement: "As we descend toward...",
      "Panning east to reveal...", "Climbing for an aerial view of..."
   5. closing_narration: 2-sentence summary. Estimated duration: word_count / 2.5.
   6. Weave weather_context naturally. If overcast, describe moody atmosphere.
      If sunny, describe vibrant energy.
   7. Match tone to user intent. "nightlife" = emphasize bars/venues.
      "family" = emphasize parks/schools.
   8. Calculate cumulative_start_time_s for each segment:
      segment[0].start = opening_duration
      segment[n].start = segment[n-1].start + segment[n-1].speech_duration + segment[n-1].waypoint.duration
   9. estimated_speech_duration_s = len(narration_text.split()) / 2.5

   Output: Valid JSON matching NarrationTimeline schema. No markdown. No preamble.
   """

   After generating the NarrationTimeline JSON, the agent must also compute
   trajectory_timestamps: interpolate between waypoints to produce a dense
   position sample every 0.5 seconds across the full tour duration.
   Use linear interpolation for lat/lng/alt and angular interpolation for heading/pitch.

3. Modify backend/agents/workflow.py:

   Change the SequentialAgent chain from:
     ScriptWriter → GlobeController → Formatter
   To:
     ScriptWriter → GlobeController → NarrationPlanner → Formatter

   The Formatter agent should now include narration_timeline in its final
   output payload alongside the existing NeighborhoodProfile.

4. Modify backend/live_tools.py — upgrade start_drone_tour:

   Current signature: start_drone_tour(place_query: str) → returns {action: "start_drone_tour"}

   New signature:
   async def start_narrated_tour(place_query: str, intent: str = "") -> dict:
       """
       Triggers a synchronized narrated drone tour.
       Uses NON_BLOCKING behavior — the agent can keep talking while this runs.

       1. Resolves place via autocomplete → details
       2. Fetches nearby POIs + weather
       3. Runs enhanced ADK pipeline (ScriptWriter → GlobeController → NarrationPlanner → Formatter)
       4. Returns NarrationTimeline + NeighborhoodProfile + VisualizationPlan
       """
       # ... resolve place, fetch data (same as existing search_neighborhood) ...
       result = await run_narrated_tour_workflow(place_details, nearby_pois, weather, intent)

       return {
           "action": "start_narrated_tour",
           "narration_timeline": result["narration_timeline"].model_dump(),
           "profile_data": result["profile_data"].model_dump(),
       }

   In the tool definition for the Gemini Live session, set:
   {
     "name": "start_narrated_tour",
     "description": "Generates a synchronized narrated drone tour with camera trajectory and voice narration segments for a neighborhood.",
     "behavior": "NON_BLOCKING",
     "parameters": {
       "type": "object",
       "properties": {
         "place_query": {"type": "string", "description": "Location name or address"},
         "intent": {"type": "string", "description": "What the user wants to explore (e.g., food scene, nightlife, family-friendly)"}
       },
       "required": ["place_query"]
     }
   }

5. Add REST endpoint in backend/main.py (for non-voice text-search tours):

   GET /api/narrated_tour/{place_id}?intent=...
   This runs the same pipeline and returns the NarrationTimeline as JSON.
   Cache with Redis (72h TTL, key: narrated_tour_{place_id}_{intent}).

6. Verify:
   - Hit the new REST endpoint with curl or Postman.
   - Verify the NarrationTimeline JSON is valid and contains:
     * opening_narration + closing_narration
     * Correct number of segments matching waypoint count
     * cumulative_start_time_s values that increase monotonically
     * trajectory_timestamps with dense position samples
     * estimated_speech_duration_s values that are reasonable (5-15s each)

Provide: The complete NarrationTimeline JSON output for a test location.
```

---

## Phase 4 — Gemini Live API Context Injection Protocol <a id="phase-4"></a>

```
[AGENTIC PROMPT — PHASE 4: GEMINI LIVE API CONTEXT INJECTION]

Reference: .cursorrules, architecture_review.md, backend/live_agent.py,
backend/live_tools.py, src/store/useSimulationStore.ts

OBJECTIVE: Upgrade the WebSocket protocol and Gemini Live agent to support:
(A) Silent spatial context injection (the agent knows what the user sees)
(B) Narration cue delivery (the agent speaks tour narration on command)
(C) Tour progress tracking (the backend knows where the camera is)

INSTRUCTIONS:

1. Upgrade the Gemini Live agent system prompt (backend/live_agent.py):

   Locate the existing system prompt for the POViewLiveAgent.
   APPEND the following sections (do not replace existing content):

   """
   ## SPATIAL AWARENESS PROTOCOL

   You will periodically receive messages tagged with <SPATIAL_CONTEXT>.
   These contain real-time data about what the user currently sees on their
   3D globe: geographic bounds, visible landmarks, nearby POIs with ratings,
   weather conditions, and camera altitude/heading.

   Rules for <SPATIAL_CONTEXT>:
   - NEVER acknowledge receiving these messages out loud.
   - NEVER say "I can see that you're looking at..." or similar meta-commentary.
   - Silently absorb this information into your awareness.
   - USE it naturally when the user asks questions like "What's that building?"
     or "What restaurants are nearby?" — reference the POI data seamlessly
     as if you can see the same view.
   - Adapt your tone to the weather and atmosphere described in the context.

   ## NARRATED TOUR MODE

   When you receive a message tagged with [NARRATION_CUE], you are delivering
   a segment of a guided tour. Rules:

   1. Speak the provided narration text naturally and conversationally.
      Paraphrase slightly — add warmth, personality, and natural speech patterns.
      Do NOT read it verbatim like a teleprompter.
   2. Match your pacing to a comfortable guided-tour rhythm. Not rushed, not slow.
   3. After delivering a narration segment, go COMPLETELY SILENT.
      Do not ad-lib, do not fill silence, do not say "moving on" or similar.
      Wait for the next [NARRATION_CUE] or for the user to speak.
   4. If the user interrupts with a question during the tour:
      - Answer it briefly and conversationally.
      - Use your <SPATIAL_CONTEXT> awareness to reference visible POIs.
      - End your answer with a natural resumption phrase like "Anyway, let me
        continue showing you around..." to signal the frontend to resume the tour.
   5. Reference what the user "sees" — the camera position and POIs are
      provided in each cue. Speak as if you share the same view.
   6. Weave ambient notes (weather, architectural character) naturally into
      your delivery.
   """

2. Upgrade the WebSocket handler (backend route for /ws/live/{session_id}):

   Add handling for THREE new inbound message types from the frontend:

   A) TOUR PROGRESS:
      {
        "type": "tour_progress",
        "segment_id": 3,
        "playback_state": "segment_boundary",
        "audio_time_s": 45.2
      }
      When received with playback_state "segment_boundary":
      - Look up the corresponding NarrationSegment from the active timeline
      - Inject the narration cue into the Gemini session:
        await session.send_client_content(
          turns=Content(role="user", parts=[Part(text=
            f"[NARRATION_CUE — Segment {segment_id}]\n"
            f"Camera position: {segment.waypoint.lat}, {segment.waypoint.lng} "
            f"(alt: {segment.waypoint.altitude}m, heading: {segment.waypoint.heading}°)\n"
            f"Visible POIs: {', '.join(segment.poi_names)}\n"
            f"Camera movement: {segment.transition_description}\n"
            f"Ambient: {segment.ambient_notes}\n"
            f"Speak this narration:\n\"{segment.narration_text}\""
          )])
        )

   B) CAMERA CONTEXT (periodic spatial awareness updates):
      {
        "type": "camera_context",
        "lat": 40.7081, "lng": -73.9571, "alt": 450,
        "heading": 45.2, "pitch": -35.0,
        "visible_pois": [{"name": "Domino Park", "rating": 4.6, "type": "park"}, ...],
        "bounding_box": {"west": ..., "south": ..., "east": ..., "north": ...}
      }
      When received:
      - Check if > 5 seconds since last context injection (rate limit)
      - If new POIs are present that were not in previous context:
        * Optionally: query Google Places API for richer data on new POIs
        * Cache results in Redis with 5-minute TTL
      - Inject spatial context:
        await session.send_client_content(
          turns=Content(role="user", parts=[Part(text=
            f"<SPATIAL_CONTEXT>\n"
            f"Camera: {lat}°N, {lng}°W, altitude {alt}m, heading {heading}°\n"
            f"Weather: {cached_weather_description}\n"
            f"Visible landmarks: {formatted_poi_list}\n"
            f"Neighborhood: {cached_neighborhood_name}\n"
            f"</SPATIAL_CONTEXT>"
          )])
        )

   C) TOUR LIFECYCLE:
      {"type": "tour_start", "timeline_id": "..."}
      {"type": "tour_pause"}
      {"type": "tour_resume"}
      {"type": "tour_stop"}
      On tour_start: store the active NarrationTimeline in session state.
      On tour_pause: send text to Gemini: "[TOUR_PAUSED] The user has paused the tour."
      On tour_resume: send text to Gemini: "[TOUR_RESUMED] Continue from where you left off."
      On tour_stop: send text to Gemini: "[TOUR_ENDED] The tour has concluded. Return to normal conversation."

3. Upgrade the frontend WebSocket hook (src/hooks/useLiveWebSocket.ts):

   Add outbound message methods:
   - sendTourProgress(segmentId, playbackState, audioTime)
   - sendCameraContext(telemetry, visiblePOIs)
   - sendTourLifecycle(event: 'start' | 'pause' | 'resume' | 'stop')

   Wire the spatial perception engine's onSignificantChange callback to
   call sendCameraContext. Throttle to max 1 message per 5 seconds.

   Add inbound message handling for tool_result with action "start_narrated_tour":
   - Parse the NarrationTimeline from the payload
   - Call useSimulationStore.getState().loadNarrationTimeline(timeline)
   - Trigger tour playback initialization (will be implemented in Phase 5)

4. Verify:
   - Start a voice session and ask about a neighborhood.
   - Observe in backend logs that <SPATIAL_CONTEXT> injections are being sent.
   - Verify Gemini does NOT acknowledge them verbally.
   - Navigate the globe manually during a voice session and ask "What's nearby?"
   - The agent should reference POIs from the most recent spatial context.

Provide: Example WebSocket message payloads for each new message type.
```

---

## Phase 5 — Audio-Visual Clock Synchronization Engine <a id="phase-5"></a>

```
[AGENTIC PROMPT — PHASE 5: AUDIO-VISUAL CLOCK SYNCHRONIZATION]

Reference: .cursorrules, architecture_review.md, src/store/useSimulationStore.ts,
src/lib/spatialPerceptionEngine.ts, src/types/simulation.ts

OBJECTIVE: Implement the master clock system and the camera trajectory binding.
This is the most technically critical phase. The CesiumJS camera must be
mathematically slaved to the Web Audio API hardware clock, ensuring that if
audio stalls, the camera freezes — and when audio resumes, the camera resumes.

INSTRUCTIONS:

1. Create file: src/lib/audioClockBridge.ts

   This module bridges the Web Audio API timing into the Zustand store.

   Implementation:
   - Accept an AudioContext reference (from the existing useAudioPlayer hook).
   - Start a requestAnimationFrame loop that runs on EVERY frame:

     function syncAudioClock(audioContext: AudioContext) {
       const masterTime = audioContext.currentTime + (audioContext.outputLatency || 0);
       useSimulationStore.getState().setAudioTime(masterTime);
       animFrameId = requestAnimationFrame(() => syncAudioClock(audioContext));
     }

   - IMPORTANT: This does NOT use the Zustand setter that triggers renders.
     It uses getState().setAudioTime() which writes directly to memory.
   - Export: startAudioClockSync(audioContext), stopAudioClockSync()
   - The audioPlaybackTime in Zustand will update at ~60fps from this loop.

2. Create file: src/lib/trajectoryLoader.ts

   This module converts the NarrationTimeline's trajectory_timestamps array
   into a Cesium.SampledPositionProperty.

   Implementation:
   function loadTrajectory(
     timeline: NarrationTimeline,
     startTime: Cesium.JulianDate
   ): {
     positionProperty: Cesium.SampledPositionProperty,
     orientationTimeline: Array<{time: JulianDate, heading: number, pitch: number}>
   }

   Steps:
   a. Create a new Cesium.SampledPositionProperty().
   b. Set interpolation:
      property.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation
      });
   c. For each entry in timeline.trajectory_timestamps:
      - Convert time_s to a JulianDate:
        const sampleTime = Cesium.JulianDate.addSeconds(startTime, entry.time_s, new Cesium.JulianDate());
      - Convert lat/lng/alt to Cartesian3:
        const position = Cesium.Cartesian3.fromDegrees(entry.lng, entry.lat, entry.alt);
      - Add to property:
        property.addSample(sampleTime, position);
   d. Also build an orientation timeline array for heading/pitch interpolation.
   e. Return both the position property and orientation timeline.

3. Create file: src/lib/cameraSyncController.ts

   This is the CORE synchronization module. It attaches to the CesiumJS
   viewer and drives the camera position from the audio clock.

   Implementation:
   function initCameraSync(
     viewer: Cesium.Viewer,
     positionProperty: Cesium.SampledPositionProperty,
     orientationTimeline: OrientationTimeline[],
     tourStartJulianDate: Cesium.JulianDate,
     tourAudioStartTime: number  // audioContext.currentTime when tour audio begins
   ): { destroy: () => void }

   Steps:
   a. Disable user camera input:
      viewer.scene.screenSpaceCameraController.enableInputs = false;

   b. Attach to viewer.scene.preUpdate.addEventListener:
      On every frame:
      1. Read audioPlaybackTime from Zustand:
         const { audioPlaybackTime } = useSimulationStore.getState();
      2. Compute elapsed tour time:
         const elapsedTourTime = audioPlaybackTime - tourAudioStartTime;
      3. Clamp: if elapsedTourTime < 0 or > totalDuration, do nothing.
      4. Convert to JulianDate:
         const currentJulianDate = Cesium.JulianDate.addSeconds(
           tourStartJulianDate, elapsedTourTime, new Cesium.JulianDate()
         );
      5. Evaluate position from the spline:
         const position = positionProperty.getValue(currentJulianDate);
      6. Interpolate orientation from the orientationTimeline:
         Find the two nearest orientation entries bracketing elapsedTourTime.
         Linearly interpolate heading and pitch between them.
      7. If position is valid:
         viewer.scene.camera.setView({
           destination: position,
           orientation: {
             heading: Cesium.Math.toRadians(interpolatedHeading),
             pitch: Cesium.Math.toRadians(interpolatedPitch),
             roll: 0.0
           }
         });
      8. Determine current narration segment:
         Check elapsedTourTime against each segment's cumulative_start_time_s.
         If we've crossed into a new segment boundary, call:
         useSimulationStore.getState().advanceSegment()

   c. Return a destroy function that removes the listener and re-enables
      camera input: viewer.scene.screenSpaceCameraController.enableInputs = true;

   CRITICAL BEHAVIOR:
   - If the Gemini audio stream buffers (audioContext pauses/underruns),
     audioPlaybackTime stops advancing → elapsedTourTime freezes →
     camera position evaluation returns the same value → camera freezes.
   - When audio resumes, audioPlaybackTime advances → camera moves.
   - This creates PERFECT sync without any explicit pause/resume logic.

4. Wire the segment advancement to narration cue delivery:

   In the module that manages the WebSocket (or in a dedicated controller),
   use useSimulationStore.subscribe() to watch currentSegmentIndex:

   useSimulationStore.subscribe(
     state => state.currentSegmentIndex,
     (newIndex, prevIndex) => {
       if (newIndex !== prevIndex && newIndex >= 0) {
         // Send narration cue for the new segment
         wsSendTourProgress(newIndex, 'segment_boundary', audioTime);
       }
     }
   );

   Note: Zustand's subscribe with a selector only fires when the selected
   value actually changes, so this is efficient.

5. Handle tour pause/resume from user barge-in:

   When the user starts speaking (detected by the AudioWorklet's voice
   activity detection or the Gemini Live API's barge-in event):
   - The Gemini model will naturally stop generating audio.
   - audioContext.currentTime continues advancing BUT no new audio is
     scheduled → the effective playback position stalls.
   - The camera will naturally slow/stop because no new audio time is
     advancing the elapsed tour time.

   When the user finishes speaking and the model resumes narration:
   - New audio buffers are scheduled, audioContext.currentTime reflects
     the resumed playback → camera resumes.

   For explicit pause button:
   - Call audioContext.suspend() → freezes the hardware clock entirely.
   - Camera freezes because audioPlaybackTime stops updating.
   - On resume: audioContext.resume() → everything flows again.

6. Verify:
   - Manually create a test NarrationTimeline with 3 segments.
   - Load the trajectory and start the camera sync with a mock audio source.
   - Verify camera moves smoothly along the spline.
   - Verify that pausing the AudioContext freezes the camera.
   - Verify that segment boundaries trigger advanceSegment() at correct times.
   - Measure frame rate — must remain at 60fps during sync.

Provide: A recording/screenshot of the camera sync test showing smooth flight.
```

---

## Phase 6 — Tour Playback Orchestrator and UI <a id="phase-6"></a>

```
[AGENTIC PROMPT — PHASE 6: TOUR PLAYBACK ORCHESTRATOR AND UI]

Reference: .cursorrules, all previously created files

OBJECTIVE: Build the top-level orchestrator that connects all subsystems into
a cohesive tour experience, plus the UI components for tour progress display.

INSTRUCTIONS:

1. Create file: src/lib/tourOrchestrator.ts

   This is the master controller that coordinates the entire tour lifecycle.
   It is NOT a React hook — it is a plain TypeScript class/module.

   API:

   class TourOrchestrator {
     constructor(
       viewer: Cesium.Viewer,
       audioContext: AudioContext,
       wsSend: (msg: any) => void
     )

     async startTour(timeline: NarrationTimeline): Promise<void>
       // 1. Set tourStatus = 'loading' in Zustand
       // 2. Load trajectory into SampledPositionProperty via trajectoryLoader
       // 3. Store trajectory reference in Zustand transient state
       // 4. Set tourStatus = 'opening'
       // 5. Send tour_start lifecycle message via WebSocket
       // 6. Send the opening_narration as a [NARRATION_CUE] via WebSocket
       // 7. Wait for estimated opening narration duration (word_count / 2.5 seconds)
       //    Use a Promise that resolves after the duration, NOT setTimeout.
       //    Instead, poll audioPlaybackTime in a rAF loop until sufficient time passes.
       // 8. Set tourStatus = 'playing'
       // 9. Record tourAudioStartTime = audioContext.currentTime
       // 10. Initialize cameraSyncController with the trajectory and start time
       // 11. Initialize segment subscription for narration cue delivery
       // 12. The tour is now running — camera follows audio clock,
       //     segments advance automatically, narration cues fire on boundaries.

     pauseTour(): void
       // 1. audioContext.suspend()
       // 2. Set tourStatus = 'paused'
       // 3. Send tour_pause lifecycle message

     resumeTour(): void
       // 1. audioContext.resume()
       // 2. Set tourStatus = 'playing'
       // 3. Send tour_resume lifecycle message

     stopTour(): void
       // 1. Destroy cameraSyncController (removes listener, re-enables camera input)
       // 2. Set tourStatus = 'idle', clear timeline
       // 3. Send tour_stop lifecycle message
       // 4. audioContext.resume() if suspended

     // Internal: called when advanceSegment reaches the final segment
     private handleTourComplete(): void
       // 1. Set tourStatus = 'closing'
       // 2. Send closing_narration as [NARRATION_CUE]
       // 3. Wait for closing narration duration
       // 4. stopTour()
   }

2. Create React hook: src/hooks/useTourPlayback.ts

   A thin React hook that wraps TourOrchestrator and exposes controls + reactive state.

   const useTourPlayback = (viewerRef, audioContextRef, wsSendRef) => {
     // Create TourOrchestrator instance (once, via useRef)
     // Subscribe to Zustand reactive tour state for UI:
     const tourStatus = useSimulationStore(state => state.tourStatus);
     const currentSegment = useSimulationStore(state => state.currentSegmentIndex);
     const timeline = useSimulationStore(state => state.narrationTimeline);

     // NOTE: tourStatus is in the REACTIVE partition because the UI needs it.
     // Move tourStatus from transient to reactive in the Zustand store.
     // currentSegmentIndex stays transient but we expose it reactively here
     // by subscribing and using a local state mirror that updates at most 1/second.

     return {
       tourStatus,
       currentSegmentIndex: currentSegment,
       totalSegments: timeline?.total_segments ?? 0,
       currentNarrationText: timeline?.segments[currentSegment]?.narration_text ?? '',
       progress: timeline ? ((currentSegment + 1) / timeline.total_segments) * 100 : 0,
       controls: {
         startTour: (timeline) => orchestratorRef.current.startTour(timeline),
         pauseTour: () => orchestratorRef.current.pauseTour(),
         resumeTour: () => orchestratorRef.current.resumeTour(),
         stopTour: () => orchestratorRef.current.stopTour(),
       }
     };
   };

3. Create component: src/components/TourProgressBar.tsx

   A glassmorphic progress bar displayed at the bottom of the 3D globe
   during active tour playback.

   Features:
   - Only visible when tourStatus is not 'idle'
   - Shows current narration text as subtitles (fade-in typewriter effect)
   - Shows segment progress dots (filled for completed, pulsing for current)
   - Play/Pause button (toggles pauseTour/resumeTour)
   - Stop button (calls stopTour)
   - Progress percentage

   Styling: Match existing POView glassmorphic aesthetic:
   - backdrop-filter: blur(20px)
   - bg-black/40 border border-white/10
   - Text: text-white/90 for subtitles, text-white/50 for metadata

4. Create component: src/components/TourPOIHighlight.tsx

   During tour playback, renders a pulsing highlight on the 3D globe
   at the current segment's POI location.

   Implementation using Resium:
   - Render a Cesium Entity with EllipseGraphics at the POI coordinates
   - Use a CallbackProperty for the ellipse material alpha to create pulsing
   - Fade in when entering a segment, fade out when transitioning
   - Color: semi-transparent accent color matching the glassmorphic theme

5. Integrate into src/app/page.tsx:

   - Initialize useTourPlayback hook
   - When handleVoiceSearchResult receives action "start_narrated_tour":
     * Call tourPlayback.controls.startTour(timeline)
     * Also set profileData for the InsightPanel as before
   - Render TourProgressBar when tourStatus !== 'idle'
   - Render TourPOIHighlight during active tour
   - Connect VoiceAssistant's mic activity detection to tour pause
     (if user starts speaking during a tour, the Gemini barge-in will
     naturally pause audio output, and the clock-based camera sync
     will automatically freeze)

6. Verify end-to-end:
   - Start a voice session
   - Say "Give me a tour of Williamsburg Brooklyn"
   - Agent should respond with filler while pipeline runs (NON_BLOCKING)
   - NarrationTimeline arrives via tool_result
   - Opening narration plays, then camera begins moving
   - Each segment: camera flies to position → narration plays → next segment
   - Progress bar shows subtitles and controls
   - Pressing pause freezes both audio and camera
   - Speaking during tour pauses the tour naturally
   - Tour concludes with closing narration

Provide: Summary of the complete tour lifecycle with timing measurements.
```

---

## Phase 7 — Integration Testing and Calibration <a id="phase-7"></a>

```
[AGENTIC PROMPT — PHASE 7: INTEGRATION TESTING AND CALIBRATION]

Reference: All previously created files

OBJECTIVE: Fine-tune timing, fix edge cases, and verify the complete system
operates as a seamless, human-like tour guide experience.

TEST MATRIX (verify each):

□ SYNC TEST: Play a narrated tour. At no point should the voice describe
  something the camera hasn't arrived at yet. At no point should the camera
  show a location without narration beginning within 500ms of arrival.
  If timing is off, adjust estimated_speech_duration_s calculation
  (try 2.3 or 2.7 words/second instead of 2.5).

□ AUDIO STALL TEST: Throttle network to simulate Gemini response latency.
  The camera must freeze when audio buffers and resume when audio resumes.
  No visual jump or narration skip should occur.

□ BARGE-IN TEST: During an active tour, speak a question.
  The agent should stop narrating, answer the question referencing
  visible POIs from <SPATIAL_CONTEXT>, then say something like
  "Let me continue..." After a brief pause, the tour should resume
  from where it left off (not restart from the beginning).

□ EXPLICIT PAUSE TEST: Click the pause button on TourProgressBar.
  Both audio and camera must freeze. Click resume — both must continue.

□ STOP TEST: Click stop mid-tour. Camera input re-enables immediately.
  Agent returns to normal conversation mode. No ghost narration cues fire.

□ SPATIAL AWARENESS TEST: During a voice session WITHOUT a tour active,
  navigate the globe manually. Ask "What's nearby?" or "What's that building?"
  The agent should reference POIs from the most recent <SPATIAL_CONTEXT>.

□ FRAME RATE TEST: During an active tour with all systems running
  (spatial perception, audio clock bridge, camera sync, narration cues),
  CesiumJS must maintain 55+ fps. Use Chrome DevTools Performance panel.
  If frame drops occur, check:
  - Is the spatial perception throttle working (500ms)?
  - Is the frustum culling iterating too many POIs?
  - Is any Zustand update accidentally triggering React renders?

□ SESSION TIMEOUT TEST: Gemini Live sessions max at ~10 minutes.
  For tours approaching this limit, implement graceful degradation:
  - Detect the session nearing timeout (track elapsed session time)
  - If mid-tour, complete current segment narration
  - Send closing narration early
  - End tour gracefully rather than dropping mid-sentence

□ CACHE TEST: Request the same narrated tour twice. Second request should
  be served from Redis cache (72h TTL). Verify timeline structure is identical.

CALIBRATION PARAMETERS TO TUNE:

| Parameter | Default | Tune Range | Effect |
|-----------|---------|------------|--------|
| Speech rate (words/sec) | 2.5 | 2.0-3.0 | Higher = shorter narration per segment |
| Spatial perception throttle | 500ms | 300-1000ms | Lower = more responsive, higher CPU |
| Context injection cooldown | 5s | 3-10s | How often <SPATIAL_CONTEXT> is pushed |
| Segment gap silence | 300ms | 0-800ms | Breathing room between segments |
| Opening narration pause | 1.5s | 0.5-3s | Pause after opening before camera moves |
| Frustum BoundingSphere radius | 50m | 20-200m | POI detection sensitivity |

After all tests pass, provide a FINAL SUMMARY documenting:
1. Total files created and modified (with paths)
2. New npm dependencies added
3. New backend endpoints added
4. New Pydantic models added
5. WebSocket protocol changes (new message types)
6. Known limitations or future improvements
```

---

## Appendix A — Data Model Schemas <a id="appendix-a"></a>

### NarrationSegment (Backend Pydantic + Frontend TypeScript)

```python
# backend/models.py
class NarrationSegment(BaseModel):
    segment_id: int
    waypoint: CameraWaypoint
    narration_text: str
    poi_names: list[str]
    poi_context: dict                    # {name: {rating, type, notable_fact}}
    transition_description: str
    estimated_speech_duration_s: float   # len(narration_text.split()) / 2.5
    cumulative_start_time_s: float      # seconds from tour start
    ambient_notes: str
```

```typescript
// frontend/src/types/simulation.ts
interface NarrationSegment {
  segment_id: number;
  waypoint: CameraWaypoint;
  narration_text: string;
  poi_names: string[];
  poi_context: Record<string, { rating: number; type: string; notable_fact: string }>;
  transition_description: string;
  estimated_speech_duration_s: number;
  cumulative_start_time_s: number;
  ambient_notes: string;
}
```

### NarrationTimeline

```python
# backend/models.py
class NarrationTimeline(BaseModel):
    place_name: str
    place_id: str
    intent: str
    total_segments: int
    total_estimated_duration_s: float
    opening_narration: str
    closing_narration: str
    segments: list[NarrationSegment]
    weather_context: dict
    trajectory_timestamps: list[dict]   # [{time_s, lat, lng, alt, heading, pitch}]
```

### CameraTelemetry (Frontend only)

```typescript
interface CameraTelemetry {
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
```

### WebSocket Message Types (New)

```typescript
// Outbound (frontend → backend)
type TourProgressMessage = {
  type: 'tour_progress';
  segment_id: number;
  playback_state: 'segment_boundary' | 'playing' | 'paused' | 'completed';
  audio_time_s: number;
};

type CameraContextMessage = {
  type: 'camera_context';
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  pitch: number;
  visible_pois: Array<{ name: string; rating: number; type: string }>;
  bounding_box: { west: number; south: number; east: number; north: number };
};

type TourLifecycleMessage = {
  type: 'tour_start' | 'tour_pause' | 'tour_resume' | 'tour_stop';
};

// Inbound (backend → frontend) — existing tool_result type, new action:
type NarratedTourResult = {
  type: 'tool_result';
  action: 'start_narrated_tour';
  narration_timeline: NarrationTimeline;
  profile_data: NeighborhoodProfile;
};
```

---

## Appendix B — Technical Constraints and Gotchas <a id="appendix-b"></a>

### CesiumJS

- `camera.moveEnd` is unreliable at altitudes below ~100m due to floating-point epsilon issues (Cesium GitHub issue #4753). Do NOT rely on it for segment transitions. Use the audio-clock-driven segment boundary detection instead.
- `scene.preUpdate` fires every frame (~60fps). This is the correct place for the camera sync loop. NEVER use `setInterval`.
- `computeViewRectangle()` returns `undefined` when the camera is in space (very zoomed out). Handle this gracefully.
- `screenSpaceCameraController.enableInputs = false` during tours. Re-enable on pause/stop.
- Google Photorealistic 3D Tiles do NOT expose semantic metadata (building names, addresses). All POI data must come from the Google Places API, not from tile raycasting.

### Gemini Live API

- Sessions max at ~10 minutes. Long tours need graceful timeout handling.
- Function calls are BLOCKING by default. Tour generation MUST use `NON_BLOCKING` behavior.
- `send_client_content` with text does NOT interrupt active audio generation. It appends to context silently.
- Transcription accuracy for proper nouns (neighborhood names) can be imperfect. Cross-reference with resolved place_id.
- Audio output latency is typically 320ms p50, 780ms p95 for first chunk.
- `send_tool_response()` (not the deprecated `send()`) must be used for tool results. Using the wrong method causes the agent to speak "tool_outputs" literally.

### Web Audio API

- `AudioContext.outputLatency` may be 0 on some browsers/devices. Default to 0 if unavailable.
- `audioContext.suspend()` / `resume()` are asynchronous — they return Promises. Await them.
- Audio buffer underruns cause crackling/silence. If camera sync detects no audioPlaybackTime advancement for > 2 seconds during an active tour, show a "buffering" indicator.
- The AudioWorklet processor runs on a separate thread. It cannot access Zustand directly. Bridge values via MessagePort.

### Zustand

- `getState()` returns a direct reference to the store's state object. Mutations are safe if done through setters.
- `subscribe()` with a selector only fires when the selector's return value changes (shallow equality by default).
- To subscribe from non-React code (like the camera sync controller), use `useSimulationStore.subscribe()` directly — it works outside of React components.
- Zustand stores persist across React hot-reloads in development. This is helpful for testing.

### Performance Budget

| Operation | Budget | Measurement Method |
|-----------|--------|--------------------|
| Spatial perception loop | < 2ms per execution | performance.now() delta |
| Camera sync evaluation | < 0.5ms per frame | preUpdate callback timing |
| Audio clock bridge | < 0.1ms per frame | rAF callback timing |
| WebSocket message send | < 1ms per message | Network panel |
| Zustand getState() | < 0.01ms per call | Negligible |
| Total main thread per frame | < 8ms (for 60fps budget of 16.67ms) | Performance panel |

---
