import { useRef, useState, useCallback } from "react";

interface UseAudioRecorderOptions {
  onChunk: (chunk: Int16Array) => void;
}

export function useAudioRecorder({ onChunk }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (isRecording) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = ctx;

    await ctx.audioWorklet.addModule("/audio-recording-worklet.js");

    const source = ctx.createMediaStreamSource(stream);
    const workletNode = new AudioWorkletNode(ctx, "audio-recording-processor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (e: MessageEvent<Int16Array>) => {
      onChunk(e.data);
    };

    source.connect(workletNode);
    // Don't connect workletNode to destination — we don't want mic playback
    setIsRecording(true);
  }, [isRecording, onChunk]);

  const stop = useCallback(() => {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    setIsRecording(false);
    setIsMuted(false);
  }, []);

  const mute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
      setIsMuted(true);
    }
  }, []);

  const unmute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
      setIsMuted(false);
    }
  }, []);

  return { start, stop, isRecording, isMuted, mute, unmute };
}
