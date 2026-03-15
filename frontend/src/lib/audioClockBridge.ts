/**
 * POView — Audio Clock Bridge
 *
 * Bridges the Web Audio API's AudioContext.currentTime into Zustand transient
 * state at ~60fps via requestAnimationFrame. This is the MASTER CLOCK for the
 * entire synchronization engine.
 *
 * The audio clock is the ground truth — camera and narration cues follow it.
 * If audio stalls, camera freezes. If audio pauses, everything pauses.
 *
 * Performance: single rAF call + one Zustand mutation = <0.1ms per frame.
 */

import { useSimulationStore } from "@/store/useSimulationStore";

let _audioContext: AudioContext | null = null;
let _rafId: number | null = null;
let _running = false;

/**
 * Start the audio clock bridge.
 * Must be called AFTER the AudioContext is created (usually on user gesture).
 */
export function startAudioClockBridge(audioContext: AudioContext): void {
  _audioContext = audioContext;

  if (_running) return;
  _running = true;

  function tick() {
    if (!_running || !_audioContext) return;

    // Push audio time to Zustand transient state (no render)
    const currentTime = _audioContext.currentTime;
    useSimulationStore.getState().setAudioTime(currentTime);

    _rafId = requestAnimationFrame(tick);
  }

  _rafId = requestAnimationFrame(tick);
  console.log("[AudioClockBridge] Started — syncing AudioContext.currentTime to Zustand at ~60fps");
}

/**
 * Stop the audio clock bridge.
 */
export function stopAudioClockBridge(): void {
  _running = false;
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
  _audioContext = null;
  console.log("[AudioClockBridge] Stopped");
}

/**
 * Get the current AudioContext reference (for use by other sync modules).
 */
export function getAudioContext(): AudioContext | null {
  return _audioContext;
}

/**
 * Get precise audio time including output latency compensation.
 */
export function getPreciseAudioTime(): number {
  if (!_audioContext) return 0;
  const baseTime = _audioContext.currentTime;
  // outputLatency might not be available in all browsers
  const latency = (_audioContext as any).outputLatency ?? 0;
  return baseTime + latency;
}
