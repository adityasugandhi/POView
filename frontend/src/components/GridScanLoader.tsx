"use client";
import { useState, useEffect } from "react";

const SCAN_PHRASES = [
  "Scanning Grid Sector",
  "Triangulating Coordinates",
  "Locking Target Vector",
  "Rendering Spatial Matrix",
];

export default function GridScanLoader() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [dots, setDots] = useState("");

  // Cycle through phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % SCAN_PHRASES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden relative">
      {/* Scan line sweep */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"
          style={{
            animation: "scanSweep 2.5s ease-in-out infinite",
          }}
        />
      </div>

      {/* Outer pulsing ring */}
      <div className="relative mb-8">
        <div
          className="absolute -inset-6 rounded-full border border-cyan-400/20"
          style={{ animation: "pulseRing 3s ease-in-out infinite" }}
        />

        {/* Wireframe globe */}
        <div className="relative w-32 h-32" style={{ perspective: "400px" }}>
          {/* Outer ring - tilted */}
          <div
            className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
            style={{
              animation: "gridSpin 3s linear infinite",
              transform: "rotateX(60deg)",
            }}
          />
          {/* Middle ring - opposite tilt */}
          <div
            className="absolute inset-2 rounded-full border-2 border-cyan-400/20"
            style={{
              animation: "gridSpin 4s linear infinite reverse",
              transform: "rotateX(60deg) rotateY(45deg)",
            }}
          />
          {/* Inner ring - vertical */}
          <div
            className="absolute inset-4 rounded-full border-2 border-cyan-400/40"
            style={{
              animation: "gridSpin 2.5s linear infinite",
              transform: "rotateY(60deg)",
            }}
          />
          {/* Equator ring */}
          <div
            className="absolute inset-6 rounded-full border border-white/10"
            style={{
              animation: "gridSpin 5s linear infinite reverse",
              transform: "rotateX(90deg)",
            }}
          />
          {/* Center dot - pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_20px_rgba(34,211,238,0.8)]" />
          </div>
        </div>
      </div>

      {/* Scan text */}
      <div className="flex items-center space-x-1 mb-3">
        <span className="text-cyan-400 text-sm">&#9658;</span>
        <p className="text-sm tracking-widest uppercase font-semibold text-cyan-300/80">
          {SCAN_PHRASES[phraseIndex]}
          {dots}
        </p>
      </div>

      {/* Thin progress bar */}
      <div className="w-40 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full"
          style={{
            animation: "progressSlide 2s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
