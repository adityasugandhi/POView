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
      });
    }
  }, [sendTourProgress, sendTourLifecycle]);

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
    try {
      const audioContext = getSharedAudioContext();
      startTour(timeline, audioContext);
    } catch (err) {
      console.error("[useTourPlayback] Failed to get AudioContext", err);
    }
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
