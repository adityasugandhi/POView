"use client";

import React from "react";
import type { NarrationSegment, TourStatus } from "@/types/simulation";

interface TourProgressBarProps {
  tourStatus: TourStatus;
  progress: number; // 0-1
  currentSegment: NarrationSegment | null;
  totalSegments: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function TourProgressBar({
  tourStatus,
  progress,
  currentSegment,
  totalSegments,
  onPause,
  onResume,
  onStop,
}: TourProgressBarProps) {
  // Only visible during active tour
  if (tourStatus === "idle" || tourStatus === "loading") return null;

  const isActive =
    tourStatus === "playing" ||
    tourStatus === "narrating" ||
    tourStatus === "opening";
  const isPaused = tourStatus === "paused";

  const segmentNumber = currentSegment ? currentSegment.segment_id + 1 : 0;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-2xl pointer-events-auto">
      <div className="bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_16px_64px_0_rgba(0,0,0,0.7)] px-6 py-4 space-y-3">
        {/* Top row: status + controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Status indicator */}
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isActive
                  ? "bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                  : isPaused
                    ? "bg-amber-400"
                    : "bg-white/30"
              }`}
            />
            <span className="text-xs font-mono uppercase tracking-widest text-white/60">
              {tourStatus === "opening"
                ? "Starting Tour"
                : tourStatus === "narrating"
                  ? `Segment ${segmentNumber}/${totalSegments}`
                  : tourStatus === "playing"
                    ? `Flying — ${segmentNumber}/${totalSegments}`
                    : tourStatus === "paused"
                      ? "Paused"
                      : tourStatus === "closing"
                        ? "Wrapping Up"
                        : "Tour"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {isActive && (
              <button
                onClick={onPause}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-amber-400/50 transition-all group"
                title="Pause Tour"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-white/70 group-hover:text-amber-400"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </button>
            )}
            {isPaused && (
              <button
                onClick={onResume}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-cyan-400/50 transition-all group"
                title="Resume Tour"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-white/70 group-hover:text-cyan-400"
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </button>
            )}
            <button
              onClick={onStop}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-red-400/50 transition-all group"
              title="Stop Tour"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-white/70 group-hover:text-red-400"
              >
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
          {/* Segment markers */}
          {totalSegments > 0 &&
            Array.from({ length: totalSegments }, (_, i) => {
              const position = ((i + 1) / totalSegments) * 100;
              return (
                <div
                  key={i}
                  className="absolute top-0 w-0.5 h-full bg-white/20"
                  style={{ left: `${position}%` }}
                />
              );
            })}
        </div>

        {/* Subtitle / narration text */}
        {currentSegment && currentSegment.narration_text && (
          <div className="text-sm text-white/80 font-light leading-relaxed line-clamp-2 italic">
            &ldquo;{currentSegment.narration_text}&rdquo;
          </div>
        )}

        {/* POI badges */}
        {currentSegment && currentSegment.poi_names.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentSegment.poi_names.slice(0, 4).map((name, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-cyan-300/80 bg-cyan-500/10 border border-cyan-400/20 rounded-full"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
