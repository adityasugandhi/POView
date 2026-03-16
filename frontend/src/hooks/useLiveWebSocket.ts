import { useRef, useState, useCallback } from "react";
import { useSimulationStore } from "@/store/useSimulationStore";

export interface TranscriptLine {
  role: "user" | "agent";
  text: string;
  finished: boolean;
}

interface UseLiveWebSocketOptions {
  onAudio: (arrayBuffer: ArrayBuffer) => void;
  onTranscript: (line: TranscriptLine) => void;
  onToolResult: (tool: string, data: unknown) => void;
  onStateChange: (state: string) => void;
  onError: (message: string) => void;
  onToolCall?: (tool: string, args: Record<string, unknown>) => void;
}

export function useLiveWebSocket({
  onAudio,
  onTranscript,
  onToolResult,
  onStateChange,
  onError,
  onToolCall,
}: UseLiveWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioSentRef = useRef(false);

  const connect = useCallback(
    (sessionId: string, model?: string): Promise<void> => {
      if (wsRef.current) return Promise.resolve();

      return new Promise<void>((resolve, reject) => {
        const url = model
          ? `ws://localhost:8000/ws/live/${sessionId}?model=${encodeURIComponent(model)}`
          : `ws://localhost:8000/ws/live/${sessionId}`;
        const ws = new WebSocket(url);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[WS] connected");
          setIsConnected(true);
          resolve();
        };

        ws.onclose = () => {
          console.log("[WS] closed");
          wsRef.current = null;
          setIsConnected(false);
        };

        ws.onerror = () => {
          onError("WebSocket connection error");
          reject(new Error("WebSocket connection error"));
        };

        ws.onmessage = (event: MessageEvent) => {
          if (event.data instanceof ArrayBuffer) {
            if (event.data.byteLength > 0) {
              console.log(
                "[WS] audio chunk received, bytes:",
                event.data.byteLength,
              );
            }
            onAudio(event.data);
            return;
          }

          // Text frame = JSON envelope
          try {
            const msg = JSON.parse(event.data as string);
            switch (msg.type) {
              case "transcript":
                onTranscript({
                  role: msg.role,
                  text: msg.text,
                  finished: msg.finished,
                });
                break;
              case "tool_result": {
                onToolResult(msg.tool, msg.data);
                // Don't complete analysis for background pipeline acks — those complete
                // via pipeline_complete once the streaming workflow finishes.
                const isBackgroundAck =
                  msg.data && msg.data.status === "analysis_started";
                if (msg.tool && !isBackgroundAck) {
                  useSimulationStore.getState().completeAnalysis();
                }
                break;
              }
              case "state":
                if (msg.state === "pipeline_stage") {
                  onStateChange(msg.stage);
                  useSimulationStore.getState().updateAnalysisStage(msg.stage, msg.progress || 50);
                } else {
                  onStateChange(msg.state);
                  if (msg.tool && msg.args) {
                    onToolCall?.(msg.tool, msg.args);
                  }
                  
                  // LAYER 1: INSTANT SKELETON UI TRIGGER
                  if (msg.state === "processing") {
                    const toolName = msg.tool || msg.tool_name;
                    if (toolName) {
                      useSimulationStore.getState().startAnalysis(toolName);
                      
                      if (toolName === "search_neighborhood" || toolName === "start_narrated_tour") {
                        useSimulationStore.setState({ insightPanelVisible: true });
                      }
                      if (toolName === "tour_recommendations" || toolName === "get_recommendations") {
                        useSimulationStore.setState({ 
                          insightPanelVisible: true,
                          recommendationsPanelVisible: true 
                        });
                      }
                    }
                  }
                }
                break;
              case "pipeline_partial":
                // LAYER 2: PROGRESSIVE STREAMING UPDATES
                if (msg.partial === "location" && msg.data) {
                  useSimulationStore.getState().setLocation(msg.data.location);
                  useSimulationStore.getState().setViewport(msg.data.viewport);
                } else if (msg.partial === "weather" && msg.data) {
                  useSimulationStore.getState().setWeatherData(msg.data.weather);
                }
                break;
              case "pipeline_complete":
                onToolResult(msg.workflow_type, msg.data);
                useSimulationStore.getState().completeAnalysis();
                break;
              case "error":
                onError(msg.message);
                break;
            }
          } catch {
            // ignore malformed frames
          }
        };
      });
    },
    [onAudio, onTranscript, onToolResult, onStateChange, onError, onToolCall],
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    audioSentRef.current = false;
  }, []);

  const sendAudio = useCallback((chunk: Int16Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      if (!audioSentRef.current) {
        console.log("[WS] first audio chunk sent, bytes:", chunk.byteLength);
        audioSentRef.current = true;
      }
      wsRef.current.send(chunk.buffer);
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text_input", text }));
    }
  }, []);

  /** Send spatial context to the voice agent (for <SPATIAL_CONTEXT> injection) */
  const sendCameraContext = useCallback(
    (payload: {
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
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "camera_context", ...payload }),
        );
      }
    },
    [],
  );

  /** Send narration cue at segment boundaries (for [NARRATION_CUE] injection) */
  const sendTourProgress = useCallback(
    (payload: {
      segment_id: number;
      narration_text: string;
      poi_names: string[];
      transition_description: string;
      playback_state: "segment_boundary" | "playing" | "paused" | "completed";
      audio_time_s: number;
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "tour_progress", ...payload }),
        );
      }
    },
    [],
  );

  /** Send tour lifecycle events (start/pause/resume/stop) */
  const sendTourLifecycle = useCallback(
    (
      event: "tour_start" | "tour_pause" | "tour_resume" | "tour_stop",
      extra?: { opening_narration?: string },
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: event, ...extra }));
      }
    },
    [],
  );

  /** Send a screen capture frame to the voice agent for visual awareness */
  const sendScreenCapture = useCallback((jpegBlob: Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        wsRef.current?.send(
          JSON.stringify({
            type: "screen_capture",
            data: base64,
            mimeType: "image/jpeg",
          }),
        );
      };
      reader.readAsDataURL(jpegBlob);
    }
  }, []);

  return {
    connect,
    disconnect,
    sendAudio,
    sendText,
    sendCameraContext,
    sendTourProgress,
    sendTourLifecycle,
    sendScreenCapture,
    isConnected,
  };
}
