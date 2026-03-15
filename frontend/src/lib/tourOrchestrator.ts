/**
 * POView — Tour Orchestrator
 *
 * Master lifecycle controller that coordinates:
 * - Trajectory loading (trajectoryLoader)
 * - Audio clock bridge (audioClockBridge)
 * - Camera sync controller (cameraSyncController)
 * - Segment advancement detection
 * - Narration cue delivery via WebSocket
 * - Tour lifecycle (start/pause/resume/stop)
 *
 * This module has no React dependencies — it operates on Zustand getState()
 * and WebSocket functions passed in at initialization.
 */

import { useSimulationStore } from "@/store/useSimulationStore";
import {
  startAudioClockBridge,
  stopAudioClockBridge,
} from "./audioClockBridge";
import { loadTrajectory, type TrajectorySpline } from "./trajectoryLoader";
import { startCameraSync, stopCameraSync } from "./cameraSyncController";
import { getViewer } from "./spatialPerceptionEngine";
import type { NarrationTimeline, NarrationSegment } from "@/types/simulation";

// --- Types ---

export interface TourOrchestratorCallbacks {
  sendTourProgress: (payload: {
    segment_id: number;
    narration_text: string;
    poi_names: string[];
    transition_description: string;
    playback_state: "segment_boundary" | "playing" | "paused" | "completed";
    audio_time_s: number;
  }) => void;
  sendTourLifecycle: (
    event: "tour_start" | "tour_pause" | "tour_resume" | "tour_stop",
    extra?: { opening_narration?: string },
  ) => void;
}

// --- Module state ---

let _callbacks: TourOrchestratorCallbacks | null = null;
let _spline: TrajectorySpline | null = null;
let _segmentCheckInterval: ReturnType<typeof setInterval> | null = null;
let _lastSegmentIndex = -1;

/**
 * Initialize the orchestrator with WebSocket callbacks.
 * Must be called once when the VoiceAssistant connects.
 */
export function initOrchestrator(callbacks: TourOrchestratorCallbacks): void {
  _callbacks = callbacks;
}

/**
 * Start a narrated tour.
 *
 * 1. Load timeline into Zustand store
 * 2. Load trajectory spline into CesiumJS
 * 3. Start audio clock bridge
 * 4. Start camera sync
 * 5. Send tour_start lifecycle event
 * 6. Begin segment tracking
 */
export function startTour(
  timeline: NarrationTimeline,
  audioContext: AudioContext,
): boolean {
  const store = useSimulationStore.getState();
  const viewer = getViewer();

  if (!viewer) {
    console.error("[TourOrchestrator] No Cesium viewer available");
    return false;
  }

  if (!_callbacks) {
    console.error(
      "[TourOrchestrator] Orchestrator not initialized — call initOrchestrator first",
    );
    return false;
  }

  // 1. Load timeline
  store.loadNarrationTimeline(timeline);

  // 2. Load trajectory spline
  _spline = loadTrajectory(timeline, viewer);
  if (!_spline) {
    console.error("[TourOrchestrator] Failed to load trajectory");
    store.clearTour();
    return false;
  }

  // 3. Start audio clock bridge
  startAudioClockBridge(audioContext);

  // 4. Record the tour start audio time
  store.setTourStartAudioTime(audioContext.currentTime);

  // 5. Start camera sync
  startCameraSync(viewer, _spline);

  // 6. Set tour status to opening
  store.setTourStatus("opening");

  // 7. Send tour_start lifecycle event (triggers opening narration)
  _callbacks.sendTourLifecycle("tour_start", {
    opening_narration: timeline.opening_narration,
  });

  // 8. Start segment tracking (check every 200ms)
  _lastSegmentIndex = -1;
  _segmentCheckInterval = setInterval(checkSegmentAdvancement, 200);

  console.log(
    `[TourOrchestrator] Tour started: "${timeline.place_name}" — ` +
      `${timeline.total_segments} segments, ` +
      `~${timeline.total_estimated_duration_s.toFixed(0)}s total`,
  );

  // After a brief opening delay, transition to "playing"
  setTimeout(() => {
    const currentStatus = useSimulationStore.getState().tourStatus;
    if (currentStatus === "opening") {
      useSimulationStore.getState().setTourStatus("playing");
    }
  }, 3000);

  return true;
}

/**
 * Pause the tour — audio keeps running but camera and narration freeze.
 */
export function pauseTour(): void {
  const store = useSimulationStore.getState();
  if (store.tourStatus !== "playing" && store.tourStatus !== "narrating")
    return;

  store.setTourStatus("paused");
  _callbacks?.sendTourLifecycle("tour_pause");
  console.log("[TourOrchestrator] Tour paused");
}

/**
 * Resume the tour from where it was paused.
 */
export function resumeTour(): void {
  const store = useSimulationStore.getState();
  if (store.tourStatus !== "paused") return;

  store.setTourStatus("playing");
  _callbacks?.sendTourLifecycle("tour_resume");
  console.log("[TourOrchestrator] Tour resumed");
}

/**
 * Stop the tour and clean up all resources.
 */
export function stopTour(): void {
  // Clear segment tracking
  if (_segmentCheckInterval) {
    clearInterval(_segmentCheckInterval);
    _segmentCheckInterval = null;
  }

  // Stop sync systems
  stopCameraSync();
  stopAudioClockBridge();

  // Clear Zustand
  useSimulationStore.getState().clearTour();

  // Send lifecycle event
  _callbacks?.sendTourLifecycle("tour_stop");

  _spline = null;
  _lastSegmentIndex = -1;
  console.log("[TourOrchestrator] Tour stopped and cleaned up");
}

/**
 * Check if the audio clock has advanced past a segment boundary.
 * Called every 200ms from setInterval.
 */
function checkSegmentAdvancement(): void {
  const store = useSimulationStore.getState();
  const {
    narrationTimeline,
    tourStatus,
    audioPlaybackTime,
    tourStartAudioTime,
  } = store;

  if (
    !narrationTimeline ||
    (tourStatus !== "playing" && tourStatus !== "opening")
  )
    return;

  const elapsed = audioPlaybackTime - tourStartAudioTime;
  const segments = narrationTimeline.segments;

  // Find which segment we should be in based on elapsed time
  let targetSegmentIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    if (elapsed >= segments[i].cumulative_start_time_s) {
      targetSegmentIndex = i;
    } else {
      break;
    }
  }

  // If we've advanced to a new segment, send the narration cue
  if (
    targetSegmentIndex > _lastSegmentIndex &&
    targetSegmentIndex < segments.length
  ) {
    _lastSegmentIndex = targetSegmentIndex;
    store.advanceSegment();

    const segment = segments[targetSegmentIndex];
    store.setTourStatus("narrating");

    _callbacks?.sendTourProgress({
      segment_id: segment.segment_id,
      narration_text: segment.narration_text,
      poi_names: segment.poi_names,
      transition_description: segment.transition_description,
      playback_state: "segment_boundary",
      audio_time_s: elapsed,
    });

    console.log(
      `[TourOrchestrator] Segment ${targetSegmentIndex + 1}/${segments.length}: ` +
        `"${segment.narration_text.substring(0, 50)}..."`,
    );

    // After the estimated narration duration, go back to "playing"
    setTimeout(() => {
      const currentStatus = useSimulationStore.getState().tourStatus;
      if (currentStatus === "narrating") {
        useSimulationStore.getState().setTourStatus("playing");
      }
    }, segment.estimated_speech_duration_s * 1000);
  }

  // Check if tour is complete
  if (elapsed > narrationTimeline.total_estimated_duration_s) {
    console.log("[TourOrchestrator] Tour complete!");
    stopTour();
  }
}

/**
 * Get the current tour progress as a 0-1 fraction.
 */
export function getTourProgress(): number {
  const store = useSimulationStore.getState();
  const { narrationTimeline, audioPlaybackTime, tourStartAudioTime } = store;
  if (!narrationTimeline || narrationTimeline.total_estimated_duration_s === 0)
    return 0;

  const elapsed = audioPlaybackTime - tourStartAudioTime;
  return Math.min(
    1,
    Math.max(0, elapsed / narrationTimeline.total_estimated_duration_s),
  );
}

/**
 * Get the current narration segment for subtitle display.
 */
export function getCurrentSegment(): NarrationSegment | null {
  const store = useSimulationStore.getState();
  const { narrationTimeline, currentSegmentIndex } = store;
  if (!narrationTimeline || currentSegmentIndex < 0) return null;
  return narrationTimeline.segments[currentSegmentIndex] || null;
}
