"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useLiveWebSocket, TranscriptLine } from "@/hooks/useLiveWebSocket";
import { unlockSharedAudioContext } from "@/lib/sharedAudioContext";
import { useSimulationStore } from "@/store/useSimulationStore";

import type {
  NeighborhoodProfile,
  Recommendation,
  CameraWaypoint,
} from "@/types/simulation";

export interface VoiceAssistantProps {
  onProfileData?: (profile: NeighborhoodProfile, placeId: string) => void;
  onRecommendations?: (recs: Recommendation[]) => void;
  onDroneWaypoints?: (waypoints: CameraWaypoint[]) => void;
  onDroneTourStart?: () => void;
  onNarratedTourResult?: (data: Record<string, unknown>) => void;
  onLocationUpdate?: (location: { lat: number; lng: number }, viewport?: unknown) => void;
  onWebSocketReady?: (methods: {
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
    sendCameraContext: (payload: {
      lat: number;
      lng: number;
      alt: number;
      heading: number;
      pitch: number;
      visible_pois: Array<{ name: string; type: string; rating: number }>;
      bounding_box: {
        west: number;
        south: number;
        east: number;
        north: number;
      };
    }) => void;
    sendScreenCapture: (blob: Blob) => void;
  }) => void;
}

type VoiceState = "idle" | "listening" | "processing" | "speaking";

export default function VoiceAssistant({
  onProfileData,
  onRecommendations,
  onDroneWaypoints,
  onDroneTourStart,
  onNarratedTourResult,
  onLocationUpdate,
  onWebSocketReady,
}: VoiceAssistantProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const flightCaptureRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Audio player ---
  const {
    addChunk: addAudioChunk,
    stop: stopPlayback,
    isPlaying,
  } = useAudioPlayer();

  // --- Flight screen capture helpers ---
  const sendScreenCaptureRef = useRef<((blob: Blob) => void) | null>(null);
  const sendCameraContextRef = useRef<((payload: {
    lat: number; lng: number; alt: number; heading: number; pitch: number;
    visible_pois: Array<{ name: string; type: string; rating: number }>;
    bounding_box: { west: number; south: number; east: number; north: number };
  }) => void) | null>(null);

  const stopFlightCaptures = useCallback(() => {
    if (flightCaptureRef.current) {
      clearInterval(flightCaptureRef.current);
      flightCaptureRef.current = null;
    }
  }, []);

  const startFlightCaptures = useCallback(() => {
    stopFlightCaptures();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium viewer is attached to window at runtime
    const viewer = (window as any).cesiumViewer as { scene?: { canvas?: HTMLCanvasElement } } | undefined;
    if (!viewer?.scene?.canvas) return;
    const canvas = viewer.scene.canvas;
    flightCaptureRef.current = setInterval(() => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob && sendScreenCaptureRef.current) {
            sendScreenCaptureRef.current(blob);
          }
        },
        "image/jpeg",
        0.4,
      );
    }, 1000);
  }, [stopFlightCaptures]);

  // --- WebSocket callbacks (stable refs) ---
  const handleAudio = useCallback(
    (buf: ArrayBuffer) => {
      addAudioChunk(buf);
      setVoiceState("speaking");
    },
    [addAudioChunk],
  );

  const handleTranscript = useCallback((line: TranscriptLine) => {
    // Only show agent lines once the full sentence is complete
    if (line.role === "agent" && !line.finished) return;

    setTranscript((prev) => {
      const lastIdx = prev.findLastIndex((l) => l.role === line.role);
      if (lastIdx !== -1 && !prev[lastIdx].finished) {
        const updated = [...prev];
        updated[lastIdx] = line;
        return updated;
      }
      return [...prev, line];
    });
    setPanelVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
  }, []);

  const handleToolResult = useCallback(
    (tool: string, data: unknown) => {
      const d = data as Record<string, unknown> | null;
      if (!d) return;
      switch (tool) {
        case "fly_to_location":
          useSimulationStore.getState().setIsScanning(false);
          if (d.location) {
            onLocationUpdate?.(
              d.location as { lat: number; lng: number },
              d.viewport,
            );
          }
          if (d.recommendations) {
            onRecommendations?.(d.recommendations as Recommendation[]);
          }
          // Stop flight captures after camera arrives (3s flight + 500ms buffer)
          setTimeout(() => {
            stopFlightCaptures();
            // Send final camera context so agent knows camera has landed
            const telemetry = useSimulationStore.getState().cameraTelemetry;
            if (telemetry && sendCameraContextRef.current) {
              sendCameraContextRef.current({
                lat: telemetry.lat,
                lng: telemetry.lng,
                alt: telemetry.alt,
                heading: telemetry.heading,
                pitch: telemetry.pitch,
                visible_pois: useSimulationStore.getState().visiblePOIs.map((p) => ({
                  name: p.name,
                  type: p.type || "",
                  rating: p.rating || 0,
                })),
                bounding_box: telemetry.viewRectangle || { west: 0, south: 0, east: 0, north: 0 },
              });
            }
          }, 3500);
          break;
        case "search_neighborhood":
          useSimulationStore.getState().setIsScanning(false);
          if (d.profile && d.place_id) {
            onProfileData?.(
              d.profile as NeighborhoodProfile,
              d.place_id as string,
            );
          }
          if (d.location) {
            onLocationUpdate?.(
              d.location as { lat: number; lng: number },
              d.viewport,
            );
          }
          if (
            d.visualization_plan &&
            (d.visualization_plan as Record<string, unknown>).waypoints
          ) {
            onDroneWaypoints?.(
              (d.visualization_plan as { waypoints: CameraWaypoint[] })
                .waypoints,
            );
          }
          break;
        case "get_recommendations":
          useSimulationStore.getState().setIsScanning(false);
          if (d.recommendations) {
            onRecommendations?.(d.recommendations as Recommendation[]);
          }
          break;
        case "start_drone_tour":
          onDroneTourStart?.();
          break;
        case "start_narrated_tour":
          onNarratedTourResult?.(d);
          break;
        case "tour_recommendations":
          if (d.recommendations) {
            onRecommendations?.(d.recommendations as Recommendation[]);
          }
          onNarratedTourResult?.(d);
          break;
      }
    },
    [
      onProfileData,
      onDroneWaypoints,
      onRecommendations,
      onDroneTourStart,
      onNarratedTourResult,
      onLocationUpdate,
      stopFlightCaptures,
    ],
  );

  const handleStateChange = useCallback((state: string) => {
    if (state === "processing") setVoiceState("processing");
  }, []);

  const handleError = useCallback((message: string) => {
    console.error("[VoiceAssistant] WS error:", message);
    setVoiceState("idle");
  }, []);

  // --- Pre-fly geocoding on function_call ---
  const setIsScanning = useSimulationStore((s) => s.setIsScanning);

  const handleToolCall = useCallback(
    (tool: string, args: Record<string, unknown>) => {
      if (tool === "fly_to_location" && args.place_query) {
        setIsScanning(true);
        startFlightCaptures();
        const query = args.place_query as string;
        fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
        )
          .then((r) => r.json())
          .then((data) => {
            const loc = data.results?.[0]?.geometry?.location;
            const vp = data.results?.[0]?.geometry?.viewport;
            if (loc) onLocationUpdate?.(loc, vp);
          })
          .catch(() => {}); // silent fail — tool_result will handle it
      } else if (tool === "search_neighborhood" || tool === "get_recommendations") {
        setIsScanning(true);
      }
    },
    [onLocationUpdate, setIsScanning, startFlightCaptures],
  );

  // --- WebSocket hook ---
  const {
    connect,
    disconnect,
    sendAudio,
    sendCameraContext,
    sendTourProgress,
    sendTourLifecycle,
    sendScreenCapture,
    isConnected,
  } = useLiveWebSocket({
    onAudio: handleAudio,
    onTranscript: handleTranscript,
    onToolResult: handleToolResult,
    onStateChange: handleStateChange,
    onError: handleError,
    onToolCall: handleToolCall,
  });

  // Keep refs in sync for use inside callbacks
  useEffect(() => {
    sendScreenCaptureRef.current = sendScreenCapture;
    sendCameraContextRef.current = sendCameraContext;
  }, [sendScreenCapture, sendCameraContext]);

  // Expose WebSocket methods for tour orchestrator
  const wsMethodsExposed = React.useRef(false);
  React.useEffect(() => {
    if (isConnected && !wsMethodsExposed.current) {
      wsMethodsExposed.current = true;
      onWebSocketReady?.({
        sendTourProgress,
        sendTourLifecycle,
        sendCameraContext,
        sendScreenCapture,
      });
    }
    if (!isConnected) {
      wsMethodsExposed.current = false;
    }
  }, [
    isConnected,
    sendTourProgress,
    sendTourLifecycle,
    sendCameraContext,
    sendScreenCapture,
    onWebSocketReady,
  ]);

  // --- Mic recorder ---
  const handleChunk = useCallback(
    (chunk: Int16Array) => {
      sendAudio(chunk);
    },
    [sendAudio],
  );

  const {
    start: startMic,
    stop: stopMic,
    isRecording,
  } = useAudioRecorder({
    onChunk: handleChunk,
  });

  // Sync voice state with isPlaying — use ref to track previous state and avoid setState in effect
  const prevIsPlayingRef = useRef(isPlaying);
  useEffect(() => {
    const wasPlaying = prevIsPlayingRef.current;
    prevIsPlayingRef.current = isPlaying;
    if (wasPlaying && !isPlaying) {
      // Audio just stopped — schedule state update outside effect
      queueMicrotask(() => {
        setVoiceState(isRecording ? "listening" : "idle");
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => setPanelVisible(false), 8000);
      });
    }
  }, [isPlaying, isRecording]);

  // --- Toggle mic ---
  const handleToggle = useCallback(async () => {
    if (!isConnected) {
      try {
        await unlockSharedAudioContext();
        const sessionId = crypto.randomUUID();
        console.log("[Voice] connecting WS…", sessionId);
        await connect(sessionId);
        console.log("[Voice] WS open, starting mic…");
        await startMic();
        console.log("[Voice] mic started");
        setVoiceState("listening");
        setPanelVisible(true);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      } catch (err) {
        console.error("[Voice] toggle failed:", err);
        stopMic();
        disconnect();
        setVoiceState("idle");
      }
    } else {
      // Disconnect everything
      stopMic();
      stopPlayback();
      stopFlightCaptures();
      disconnect();
      setVoiceState("idle");
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => setPanelVisible(false), 8000);
    }
  }, [isConnected, connect, startMic, stopMic, stopPlayback, stopFlightCaptures, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      stopFlightCaptures();
    };
  }, [stopFlightCaptures]);

  // Auto-scroll transcript
  useEffect(() => {
    if (panelVisible && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, panelVisible]);

  // --- Button style by state ---
  const buttonStyle = {
    idle: "bg-black/40 hover:bg-white/10 border-white/10 text-white/60 hover:text-white",
    listening: "bg-cyan-500/20 border-cyan-400/50 text-cyan-300 animate-pulse",
    processing:
      "bg-purple-500/20 border-purple-400/50 text-purple-300 animate-pulse",
    speaking:
      "bg-green-500/20 border-green-400/50 text-green-300 animate-pulse",
  }[voiceState];

  return (
    <>
      {/* Transcript panel — above the button */}
      {panelVisible && transcript.length > 0 && (
        <div className="w-[480px] bg-black/80 backdrop-blur-2xl border border-white/20 rounded-2xl p-4 z-20 transition-opacity duration-500 flex flex-col pointer-events-auto shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
          <div className="max-h-48 overflow-y-auto space-y-4 pr-2">
            {transcript.map((line, i) => (
              <p
                key={i}
                className={`text-sm leading-relaxed transition-opacity duration-300 ${
                  line.finished ? "opacity-100" : "opacity-60"
                } ${
                  line.role === "user"
                    ? "text-white/60 font-medium"
                    : "text-white font-semibold"
                }`}
              >
                <span className="text-xs uppercase tracking-widest mr-2 opacity-60">
                  {line.role === "user" ? "You" : "POView"}
                </span>
                {line.text}
              </p>
            ))}
            <div ref={transcriptEndRef} />
          </div>
          {/* State indicator dot */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center space-x-2 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                voiceState === "idle"
                  ? "bg-white/20"
                  : voiceState === "listening"
                    ? "bg-cyan-400 animate-pulse"
                    : voiceState === "processing"
                      ? "bg-purple-400 animate-pulse"
                      : "bg-green-400 animate-pulse"
              }`}
            />
            <span className="text-xs text-white/40 tracking-widest uppercase font-bold">
              {voiceState}
            </span>
          </div>
        </div>
      )}

      {/* Mic toggle button — centered at bottom */}
      <button
        onClick={handleToggle}
        className={`backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 pointer-events-auto transition-all duration-300 border ${buttonStyle}`}
        title={isConnected ? "Stop voice assistant" : "Start voice assistant"}
      >
        {isConnected ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        <span className="text-xs font-bold tracking-wider uppercase">
          {voiceState === "idle"
            ? "VOICE"
            : voiceState === "listening"
              ? "LISTENING"
              : voiceState === "processing"
                ? "THINKING"
                : "SPEAKING"}
        </span>
      </button>
    </>
  );
}

// Re-export sendText for external use (e.g. text-to-voice)
export type { TranscriptLine };
