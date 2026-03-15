import { useRef, useState, useCallback } from "react";

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
}

export function useLiveWebSocket({
  onAudio,
  onTranscript,
  onToolResult,
  onStateChange,
  onError,
}: UseLiveWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(
    (sessionId: string) => {
      if (wsRef.current) return;

      const ws = new WebSocket(
        `ws://localhost:8000/ws/live/${sessionId}`
      );
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onclose = () => {
        wsRef.current = null;
        setIsConnected(false);
      };

      ws.onerror = () => {
        onError("WebSocket connection error");
      };

      ws.onmessage = (event: MessageEvent) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary frame = audio PCM
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
            case "tool_result":
              onToolResult(msg.tool, msg.data);
              break;
            case "state":
              onStateChange(msg.state);
              break;
            case "error":
              onError(msg.message);
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };
    },
    [onAudio, onTranscript, onToolResult, onStateChange, onError]
  );

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const sendAudio = useCallback((chunk: Int16Array) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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
      bounding_box: { west: number; south: number; east: number; north: number };
    }) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "camera_context", ...payload })
        );
      }
    },
    []
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
          JSON.stringify({ type: "tour_progress", ...payload })
        );
      }
    },
    []
  );

  /** Send tour lifecycle events (start/pause/resume/stop) */
  const sendTourLifecycle = useCallback(
    (
      event: "tour_start" | "tour_pause" | "tour_resume" | "tour_stop",
      extra?: { opening_narration?: string }
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: event, ...extra })
        );
      }
    },
    []
  );

  return {
    connect,
    disconnect,
    sendAudio,
    sendText,
    sendCameraContext,
    sendTourProgress,
    sendTourLifecycle,
    isConnected,
  };
}
