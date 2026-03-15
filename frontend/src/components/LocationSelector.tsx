"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Search, Navigation, RotateCcw, Loader2 } from "lucide-react";
import axios from "axios";

export interface DefaultLocation {
  placeId: string;
  displayName: string;
  lat: number;
  lng: number;
}

export const NYC_DEFAULT: DefaultLocation = {
  placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
  displayName: "New York City",
  lat: 40.73,
  lng: -73.995,
};

const STORAGE_KEY = "poview_default_location";

interface LocationSelectorProps {
  value: DefaultLocation;
  onChange: (loc: DefaultLocation) => void;
}

export function getStoredLocation(): DefaultLocation {
  if (typeof window === "undefined") return NYC_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.placeId && parsed.lat && parsed.lng) return parsed;
    }
  } catch {}
  return NYC_DEFAULT;
}

function saveLocation(loc: DefaultLocation) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

type SelectorState = "idle" | "searching" | "locating" | "error";

interface Suggestion {
  placePrediction?: {
    placeId?: string;
    place?: string;
    text?: { text: string };
    structuredFormat?: {
      mainText?: { text: string };
      secondaryText?: { text: string };
    };
  };
}

export default function LocationSelector({
  value,
  onChange,
}: LocationSelectorProps) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<SelectorState>("idle");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isDefault = value.placeId === NYC_DEFAULT.placeId;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
        setQuery("");
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Autocomplete debounce
  useEffect(() => {
    if (!query.trim()) {
      if (suggestions.length > 0) setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get("http://localhost:8000/api/autocomplete", {
          params: { input: query },
        });
        setSuggestions(res.data.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selectPlace = useCallback(
    async (placeId: string) => {
      setState("searching");
      setErrorMsg("");
      try {
        const cleanId = placeId.replace("places/", "");
        const res = await axios.get(
          `http://localhost:8000/api/resolve_location/${cleanId}`,
        );
        const loc: DefaultLocation = {
          placeId: res.data.placeId,
          displayName: res.data.displayName,
          lat: res.data.lat,
          lng: res.data.lng,
        };
        saveLocation(loc);
        onChange(loc);
        setExpanded(false);
        setQuery("");
        setSuggestions([]);
      } catch {
        setErrorMsg("Failed to resolve location");
        setState("error");
        return;
      }
      setState("idle");
    },
    [onChange],
  );

  const useMyLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported by your browser");
      setState("error");
      return;
    }
    if (!window.isSecureContext) {
      setErrorMsg(
        "Location requires HTTPS. Please access via localhost or HTTPS.",
      );
      setState("error");
      return;
    }
    setState("locating");
    setErrorMsg("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await axios.get(
            "http://localhost:8000/api/reverse_geocode",
            {
              params: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            },
          );
          const loc: DefaultLocation = {
            placeId: res.data.placeId,
            displayName: res.data.displayName,
            lat: res.data.lat,
            lng: res.data.lng,
          };
          saveLocation(loc);
          onChange(loc);
          setExpanded(false);
        } catch (err: unknown) {
          const isNotFound =
            axios.isAxiosError(err) && err.response?.status === 404;
          setErrorMsg(
            isNotFound
              ? "Could not identify this location. Try searching instead."
              : "Network error. Please try again.",
          );
          setState("error");
          return;
        }
        setState("idle");
      },
      () => {
        setErrorMsg("Location access denied");
        setState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 },
    );
  }, [onChange]);

  const resetToDefault = useCallback(() => {
    saveLocation(NYC_DEFAULT);
    onChange(NYC_DEFAULT);
    setExpanded(false);
    setQuery("");
    setSuggestions([]);
  }, [onChange]);

  const isLoading = state === "searching" || state === "locating";

  return (
    <div ref={containerRef} className="w-full max-w-md">
      {/* Collapsed: current location display */}
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md hover:bg-white/10 hover:border-cyan-400/30 transition-all duration-300 group"
        >
          <div className="flex items-center space-x-2.5">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-white/80 font-medium">
              {value.displayName}
            </span>
            {isDefault && (
              <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider">
                (Default)
              </span>
            )}
          </div>
          <span className="text-xs text-white/40 group-hover:text-cyan-400 transition-colors font-medium">
            Change
          </span>
        </button>
      ) : (
        /* Expanded: search + options */
        <div className="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-4 py-3 border-b border-white/5">
            <Search className="w-4 h-4 text-white/40 mr-2.5 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search a city or place..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
            />
            {isLoading && (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-2" />
            )}
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="max-h-48 overflow-y-auto border-b border-white/5">
              {suggestions.map((s, i) => {
                const pred = s.placePrediction;
                if (!pred) return null;
                const id = pred.placeId || pred.place || "";
                const main =
                  pred.structuredFormat?.mainText?.text ||
                  pred.text?.text ||
                  "";
                const secondary =
                  pred.structuredFormat?.secondaryText?.text || "";
                return (
                  <button
                    key={i}
                    onClick={() => selectPlace(id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors flex flex-col"
                  >
                    <span className="text-sm text-white/90 font-medium">
                      {main}
                    </span>
                    {secondary && (
                      <span className="text-xs text-white/40">{secondary}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Use My Location */}
          <button
            onClick={useMyLocation}
            disabled={isLoading}
            className="w-full flex items-center px-4 py-3 hover:bg-white/5 transition-colors space-x-2.5 border-b border-white/5 disabled:opacity-50"
          >
            <Navigation className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-white/70 font-medium">
              {state === "locating"
                ? "Detecting location..."
                : "Use My Location"}
            </span>
          </button>

          {/* Current selection + reset */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-white/60 font-medium truncate max-w-[200px]">
                {value.displayName}
              </span>
            </div>
            {!isDefault && (
              <button
                onClick={resetToDefault}
                className="flex items-center space-x-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Error message */}
          {state === "error" && errorMsg && (
            <div className="px-4 pb-3">
              <p className="text-xs text-red-400">{errorMsg}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
