"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, ChevronDown } from "lucide-react";

interface LiveModel {
  id: string;
  label: string;
  vision: boolean;
}
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

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "muted";

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

  // --- Dev model selector ---
  const [availableModels, setAvailableModels] = useState<LiveModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  useEffect(() => {
    fetch("/api/live_models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length) {
          setAvailableModels(data.models);
          setSelectedModel(data.default || data.models[0].id);
        }
      })
      .catch(() => {}); // non-critical — falls back to backend default
  }, []);

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
          if (d.place_name) lastFlyToPlaceRef.current = d.place_name as string;
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
          }, 20000);
          break;
        case "neighborhood":
        case "search_neighborhood":
          useSimulationStore.getState().setIsScanning(false);
          if (d.profile_data || d.profile) {
            onProfileData?.(
              (d.profile_data || d.profile) as NeighborhoodProfile,
              (d.place_id as string) || lastFlyToPlaceRef.current || "",
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
        case "narrated_tour":
        case "start_narrated_tour":
        case "tour_recommendations":
          if (d.profile_data || d.profile) {
            onProfileData?.(
              (d.profile_data || d.profile) as NeighborhoodProfile,
              (d.place_id as string) || lastFlyToPlaceRef.current || "",
            );
          }
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
            if (loc) {
              const store = useSimulationStore.getState();
              // Phase 1: High orbit
              store.setCinematicFlight({
                active: true,
                phase: "high-orbit",
                targetLat: loc.lat,
                targetLng: loc.lng,
              });
              // Phase 2: Approach after 3s
              setTimeout(() => {
                useSimulationStore.getState().setCinematicFlight({
                  active: true,
                  phase: "approach",
                  targetLat: loc.lat,
                  targetLng: loc.lng,
                });
              }, 3000);
              // Phase 3: Arrive after 6s total, then clear
              setTimeout(() => {
                useSimulationStore.getState().setCinematicFlight({
                  active: true,
                  phase: "arrive",
                  targetLat: loc.lat,
                  targetLng: loc.lng,
                });
                // Phase 4: Orbit after arrival animation
                setTimeout(() => {
                  useSimulationStore.getState().setCinematicFlight({
                    active: true,
                    phase: "orbit",
                    targetLat: loc.lat,
                    targetLng: loc.lng,
                  });
                }, 3000);
              }, 6000);
            }
          })
          .catch(() => {}); // silent fail — tool_result will handle it
      } else if (tool === "search_neighborhood" || tool === "get_recommendations") {
        setIsScanning(true);
      }
    },
    [onLocationUpdate, setIsScanning, startFlightCaptures],
  );

  // --- WebSocket hook ---
  const lastFlyToPlaceRef = useRef<string | null>(null);

  const {
    connect,
    disconnect,
    sendAudio,
    sendText,
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
    isMuted,
    mute,
    unmute,
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
        if (!isConnected) {
          setVoiceState("idle");
        } else if (isMuted) {
          setVoiceState("muted");
        } else {
          setVoiceState(isRecording ? "listening" : "idle");
        }
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => setPanelVisible(false), 8000);
      });
    }
  }, [isPlaying, isRecording, isConnected, isMuted]);

  // --- Toggle mic (Mute / Unmute) ---
  const handleToggle = useCallback(async () => {
    if (!isConnected) {
      try {
        await unlockSharedAudioContext();
        const sessionId = crypto.randomUUID();
        console.log("[Voice] connecting WS…", sessionId);
        await connect(sessionId, selectedModel || undefined);
        console.log("[Voice] WS open, starting mic…");
        await startMic();
        console.log("[Voice] mic started");
        setVoiceState("listening");
        setPanelVisible(true);
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        useSimulationStore.getState().setIsVoiceSessionActive(true);

        // Always fire an immediate greeting so the user hears the system is alive.
        // A small delay lets the Gemini session fully initialize before receiving text.
        setTimeout(() => {
          sendText(
            "The user just activated the voice assistant. " +
            "Greet them warmly and concisely in 1-2 sentences. " +
            "Let them know they can ask you to fly anywhere, explore a neighborhood, or find recommendations. " +
            "Do NOT ask a question — just welcome them and tell them you're ready."
          );
        }, 600);

        // Async location enrichment — sends a silent context update once geocode resolves.
        // Kept separate so the greeting never blocks on network.
        const storeState = useSimulationStore.getState();
        const loc = storeState.location || storeState.defaultLocation;
        if (loc) {
          fetch(`/api/reverse_geocode?lat=${loc.lat}&lng=${loc.lng}`)
            .then((r) => r.json())
            .then((data) => {
              const neighborhood = data.neighborhood || data.formatted_address || "";
              if (neighborhood) {
                sendText(`<LOCATION_CONTEXT>User is currently viewing ${neighborhood} on the 3D globe.</LOCATION_CONTEXT>`);
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("[Voice] toggle failed:", err);
        stopMic();
        disconnect();
        setVoiceState("idle");
      }
    } else {
      // If connected, toggle mute state instead of disconnecting
      if (isMuted) {
        unmute();
        setVoiceState(isPlaying ? "speaking" : "listening");
      } else {
        mute();
        setVoiceState(isPlaying ? "speaking" : "muted");
      }
    }
  }, [isConnected, isMuted, isPlaying, connect, startMic, stopMic, disconnect, mute, unmute, sendText, selectedModel]);

  // --- Explicit Disconnect ---
  const handleEndSession = useCallback(() => {
    stopMic();
    stopPlayback();
    stopFlightCaptures();
    disconnect();
    setVoiceState("idle");
    useSimulationStore.getState().setIsVoiceSessionActive(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setPanelVisible(false), 3000);
  }, [stopMic, stopPlayback, stopFlightCaptures, disconnect]);

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

  // --- Analyze Now handler ---
  const handleAnalyzeNow = useCallback(() => {
    const place = lastFlyToPlaceRef.current;
    if (!place || !isConnected) return;
    sendText(`Analyze ${place} neighborhood in detail`);
  }, [isConnected, sendText]);

  // --- Button style by state ---
  const buttonStyle = {
    idle: "bg-black/40 hover:bg-white/10 border-white/10 text-white/60 hover:text-white",
    muted: "bg-red-500/20 border-red-400/50 text-red-300",
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
          {/* State indicator + Analyze Now */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
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
            {lastFlyToPlaceRef.current && isConnected && (
              <button
                onClick={handleAnalyzeNow}
                disabled={voiceState === "processing"}
                className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 backdrop-blur-xl rounded-full px-3 py-1.5 text-[11px] font-bold text-cyan-300 tracking-wider uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Analyze Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dev model selector — only shown when not connected */}
      {!isConnected && availableModels.length > 0 && (
        <div className="relative pointer-events-auto mb-2">
          <button
            onClick={() => setModelDropdownOpen((o) => !o)}
            className="flex items-center space-x-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-3 py-1.5 text-[10px] font-bold text-white/40 hover:text-white/70 hover:border-white/20 transition-all duration-200 tracking-widest uppercase"
          >
            <span className="text-yellow-400/70">DEV</span>
            <span className="max-w-[200px] truncate">
              {availableModels.find((m) => m.id === selectedModel)?.label ?? selectedModel}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${modelDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {modelDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 min-w-[280px] bg-black/90 backdrop-blur-2xl border border-white/15 rounded-xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] z-30">
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold text-yellow-400/60 tracking-widest uppercase border-b border-white/10">
                Dev — Gemini Live Model
              </div>
              {availableModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setModelDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 text-xs transition-colors duration-150 flex items-start space-x-2 ${
                    selectedModel === m.id
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${m.vision ? "bg-green-400" : "bg-orange-400"}`} />
                  <span className="leading-tight">{m.label}</span>
                </button>
              ))}
              <div className="px-3 py-2 border-t border-white/10 flex items-center space-x-3 text-[9px] text-white/30">
                <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /><span>audio + vision</span></span>
                <span className="flex items-center space-x-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" /><span>audio only</span></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Control Buttons — centered at bottom */}
      <div className="flex items-center space-x-3 pointer-events-auto">
        <button
          onClick={handleToggle}
          className={`backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 transition-all duration-300 border ${buttonStyle}`}
          title={!isConnected ? "Start voice assistant" : isMuted ? "Unmute mic" : "Mute mic"}
        >
          {isConnected && !isMuted ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
          <span className="text-xs font-bold tracking-wider uppercase">
            {voiceState === "idle"
              ? "VOICE"
              : voiceState === "listening"
                ? "LISTENING"
                : voiceState === "muted"
                  ? "MUTED"
                  : voiceState === "processing"
                    ? "THINKING"
                    : "SPEAKING"}
          </span>
        </button>

        {isConnected && (
          <button
            onClick={handleEndSession}
            className="backdrop-blur-xl bg-black/40 hover:bg-red-500/20 border border-white/10 hover:border-red-400/50 text-white/60 hover:text-red-300 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-3 py-3 transition-all duration-300 group"
            title="End Session"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:scale-110 transition-transform"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>
    </>
  );
}

// Re-export sendText for external use (e.g. text-to-voice)
export type { TranscriptLine };
