/**
 * POView — useTourPlayback Hook
 *
 * React wrapper around the TourOrchestrator. Provides reactive tour state
 * (status, progress, current segment) for UI components, and exposes
 * start/pause/resume/stop actions.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSimulationStore } from "@/store/useSimulationStore";
import {
  initOrchestrator,
  startTour,
  pauseTour,
  resumeTour,
  stopTour,
  getTourProgress,
  getCurrentSegment,
} from "@/lib/tourOrchestrator";
import { getSharedAudioContext } from "@/lib/sharedAudioContext";
import { getViewer } from "@/lib/spatialPerceptionEngine";
import type {
  NarrationTimeline,
  NarrationSegment,
  TourStatus,
} from "@/types/simulation";

interface TourPlaybackState {
  tourStatus: TourStatus;
  progress: number; // 0-1
  currentSegment: NarrationSegment | null;
  startNarratedTour: (timeline: NarrationTimeline) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useTourPlayback(
  sendTourProgress: (...args: unknown[]) => void,
  sendTourLifecycle: (...args: unknown[]) => void,
  sendScreenCapture?: (...args: unknown[]) => void,
): TourPlaybackState {
  const tourStatus = useSimulationStore((s) => s.tourStatus);
  const [progress, setProgress] = useState(0);
  const [currentSegment, setCurrentSegment] = useState<NarrationSegment | null>(
    null,
  );
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialized = useRef(false);

  // Initialize orchestrator with WebSocket callbacks (once)
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initOrchestrator({
        sendTourProgress,
        sendTourLifecycle,
        sendScreenCapture: sendScreenCapture || (() => {}),
      });
    }
  }, [sendTourProgress, sendTourLifecycle, sendScreenCapture]);

  // Update progress and current segment on an interval when tour is active
  useEffect(() => {
    if (
      tourStatus === "playing" ||
      tourStatus === "opening" ||
      tourStatus === "narrating"
    ) {
      progressInterval.current = setInterval(() => {
        setProgress(getTourProgress());
        setCurrentSegment(getCurrentSegment());
      }, 250);
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [tourStatus]);

  const startNarratedTour = useCallback((timeline: NarrationTimeline) => {
    // Tour data can arrive before the Cesium viewer is mounted (race condition
    // between pipeline_complete WS message and Map3D render), and window.Cesium
    // must be set before trajectoryLoader can build splines.
    // Retry up to 20 times (~10s) in 500ms increments.
    const MAX_RETRIES = 20;
    const attempt = (retriesLeft: number) => {
      const viewer = getViewer();
      const cesiumReady = !!(window as { Cesium?: unknown }).Cesium;
      if (!viewer || !cesiumReady) {
        if (retriesLeft > 0) {
          setTimeout(() => attempt(retriesLeft - 1), 500);
        } else {
          console.error("[useTourPlayback] Cesium viewer not ready after retries — tour aborted");
        }
        return;
      }
      try {
        const audioContext = getSharedAudioContext();
        startTour(timeline, audioContext);
      } catch (err) {
        console.error("[useTourPlayback] Failed to start tour", err);
      }
    };
    attempt(MAX_RETRIES);
  }, []);

  return {
    tourStatus,
    progress,
    currentSegment,
    startNarratedTour,
    pause: pauseTour,
    resume: resumeTour,
    stop: stopTour,
  };
}
