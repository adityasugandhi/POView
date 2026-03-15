/**
 * POView — Shared Audio Context
 * 
 * A singleton AudioContext instance to guarantee perfect clock synchronization
 * between Gemini's audio playback (useAudioPlayer) and the tour orchestrator (useTourPlayback).
 * 
 * Creating multiple AudioContexts causes clock bifurcation (where one clock stays at 0
 * if not resumed by a user gesture), resulting in frozen camera paths during playback.
 */

let sharedContext: AudioContext | null = null;
let unlockAttempted = false;

/**
 * Get or create the shared AudioContext.
 * Must be called initially from within a user gesture handler (e.g., onClick).
 */
export function getSharedAudioContext(): AudioContext {
  if (!sharedContext) {
    sharedContext = new AudioContext({ sampleRate: 24000 });
  }
  return sharedContext;
}

/**
 * Attempts to resume the AudioContext to bypass browser autoplay policies.
 * Must be called within a user gesture (like a button click).
 */
export async function unlockSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
      console.log("[SharedAudioContext] Unlocked and resumed successfully.");
    } catch (e) {
      console.warn("[SharedAudioContext] Failed to resume on gesture:", e);
    }
  }
  unlockAttempted = true;
}

/**
 * Destroy the shared context.
 */
export function destroySharedAudioContext(): void {
  if (sharedContext) {
    sharedContext.close();
    sharedContext = null;
    unlockAttempted = false;
  }
}
