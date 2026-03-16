"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, MapPin, Navigation, Trash2, Globe, ChevronDown, ChevronUp } from "lucide-react";
import { useSimulationStore } from "@/store/useSimulationStore";

interface Suggestion {
  placePrediction: {
    placeId: string;
    text: {
      text: string;
    };
  };
}

interface SearchBoxProps {
  onSearch: (placeId: string, intent: string, radius: number) => void;
  onRecenter: () => void;
  onClear: () => void;
  isAnalyzing: boolean;
  layersVisible: boolean;
}

const EXAMPLE_SEARCHES = [
  {
    label: "NYC Office Hunt",
    location: "129 West 29th Street, New York, NY",
    placeId: "ChIJlY7Zcq9ZwokRv7Zvn4Njrj0",
    intent: "Find the best area to rent a workspace",
  },
  {
    label: "Brooklyn Coffee",
    location: "255 Madison Street, Brooklyn, NY",
    placeId: "ChIJBTPq7pFbwokRiQcRoOoIjV4",
    intent: "Find me a good place for coffee",
  },
  {
    label: "Williamsburg Nightlife",
    location: "Williamsburg, Brooklyn, NY",
    placeId: "ChIJQSrBBv1bwokRbNfFHCnyeYI",
    intent: "Best bars and nightlife scene",
  },
];

export default function SearchBox({
  onSearch,
  onRecenter,
  onClear,
  isAnalyzing,
}: SearchBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [intentValue, setIntentValue] = useState("");
  const [radiusValue, setRadiusValue] = useState(0.4);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-collapse when scanning/flying starts
  const isScanning = useSimulationStore((s) => s.isScanning);
  useEffect(() => {
    if (!isScanning) return;
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, [isScanning]);

  // Auto-collapse when voice session starts
  const isVoiceSessionActive = useSimulationStore((s) => s.isVoiceSessionActive);
  useEffect(() => {
    if (!isVoiceSessionActive) return;
    const id = requestAnimationFrame(() => setCollapsed(true));
    return () => cancelAnimationFrame(id);
  }, [isVoiceSessionActive]);

  const fetchSuggestions = async (query: string) => {
    try {
      const res = await fetch(
        `http://localhost:8000/api/autocomplete?input=${encodeURIComponent(query)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch autocomplete predictions:", error);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputValue.length > 2 && isOpen) {
        fetchSuggestions(inputValue);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [inputValue, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (placeId: string, text: string) => {
    setInputValue(text);
    setSelectedPlaceId(placeId);
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let placeId = selectedPlaceId;

    if (!placeId && suggestions.length > 0) {
      const firstSuggestion = suggestions[0].placePrediction;
      if (firstSuggestion && firstSuggestion.placeId) {
        setIsOpen(false);
        setInputValue(firstSuggestion.text.text);
        setSelectedPlaceId(firstSuggestion.placeId);
        placeId = firstSuggestion.placeId;
      }
    }

    if (placeId && intentValue) {
      onSearch(placeId, intentValue, radiusValue);
    }
  };

  const handleExplore = () => {
    let placeId = selectedPlaceId;
    if (!placeId && suggestions.length > 0) {
      placeId = suggestions[0].placePrediction.placeId;
    }
    if (placeId) {
      // General overview instead of explicit intent
      onSearch(
        placeId,
        "general neighborhood overview and interesting places",
        radiusValue,
      );
    }
  };

  // Collapsed mini-bar: click to expand
  if (collapsed) {
    return (
      <div ref={wrapperRef} className="relative z-50 w-full flex flex-col items-center">
        <div
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl px-4 py-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all hover:border-white/20 hover:bg-black/50 group cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            <Search className="w-4 h-4 text-white/40 group-hover:text-cyan-400 transition-colors" />
            <span className="text-sm text-white/50 group-hover:text-white/70 font-medium truncate max-w-[260px] transition-colors">
              {inputValue || "Search location..."}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 hover:border-white/20 hover:bg-black/50 transition-all"
        >
          <ChevronDown className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative z-50 w-full flex flex-col items-center">
      <form
        onSubmit={handleSubmit}
        className="relative w-full flex flex-col space-y-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all focus-within:border-white/20"
      >

        {/* Location Input */}
        <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:bg-white/10 focus-within:border-white/30 transition-all p-2">
          <MapPin className="w-5 h-5 ml-2 text-white/50" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setSelectedPlaceId(""); // Reset if they start typing again
              setIsOpen(true);
            }}
            onFocus={() => {
              if (inputValue.length > 2) setIsOpen(true);
            }}
            placeholder="Primary Location..."
            disabled={isAnalyzing}
            className="w-full bg-transparent text-white placeholder-white/50 px-3 py-1 outline-none disabled:opacity-50 font-medium"
          />
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && suggestions.length > 0 && (
          <ul className="absolute top-[60px] left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-black/90 backdrop-blur-3xl border border-white/20 rounded-xl shadow-2xl animate-in fade-in">
            {suggestions.map((suggestion, idx) => {
              const text = suggestion.placePrediction?.text?.text;
              const placeId = suggestion.placePrediction?.placeId;
              if (!text || !placeId) return null;

              return (
                <li
                  key={idx}
                  onClick={() => handleSelect(placeId, text)}
                  className="px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white cursor-pointer border-b border-white/5 last:border-0 transition-colors text-sm font-medium"
                >
                  {text}
                </li>
              );
            })}
          </ul>
        )}

        {/* Contextual Intent Input */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:bg-white/10 focus-within:border-white/30 transition-all p-2">
          <Search
            className={`w-5 h-5 ml-2 ${isAnalyzing ? "text-cyan-400 animate-pulse" : "text-white/50"}`}
          />
          <input
            type="text"
            value={intentValue}
            onChange={(e) => setIntentValue(e.target.value)}
            placeholder="Contextual Intent (e.g. quiet cafe)..."
            disabled={isAnalyzing}
            className="w-full bg-transparent text-white placeholder-white/50 px-3 py-1 outline-none disabled:opacity-50 font-medium"
          />
        </div>

        {/* Radius Slider */}
        <div className="flex items-center space-x-4 px-2">
          <span className="text-xs text-white/60 font-bold uppercase tracking-wider w-16">
            Radius
          </span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={radiusValue}
            onChange={(e) => setRadiusValue(parseFloat(e.target.value))}
            disabled={isAnalyzing}
            className="flex-1 accent-cyan-400 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-white uppercase font-bold w-12 text-right">
            {radiusValue.toFixed(1)} mi
          </span>
        </div>

        {/* Standardized Button Array */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          <button
            type="submit"
            disabled={
              isAnalyzing ||
              !intentValue.trim() ||
              (!selectedPlaceId && !inputValue.trim())
            }
            className="col-span-1 flex flex-col items-center justify-center p-2 bg-white text-black font-extrabold rounded-xl text-[10px] uppercase hover:bg-gray-200 transition-all disabled:opacity-50 tracking-wider h-14"
          >
            <Search className="w-4 h-4 mb-1" />
            {isAnalyzing ? "..." : "Search"}
          </button>
          <button
            type="button"
            onClick={onRecenter}
            disabled={isAnalyzing}
            className="col-span-1 flex flex-col items-center justify-center p-2 bg-white/10 text-white font-bold rounded-xl text-[10px] uppercase hover:bg-white/20 transition-all tracking-wider h-14"
          >
            <Navigation className="w-4 h-4 mb-1" />
            Recenter
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={isAnalyzing}
            className="col-span-1 flex flex-col items-center justify-center p-2 bg-white/10 text-white font-bold rounded-xl text-[10px] uppercase hover:bg-red-500/80 transition-all tracking-wider h-14"
          >
            <Trash2 className="w-4 h-4 mb-1" />
            Clear
          </button>
          <button
            type="button"
            onClick={handleExplore}
            disabled={isAnalyzing || (!selectedPlaceId && !inputValue.trim())}
            className="col-span-1 flex flex-col items-center justify-center p-2 bg-white/10 text-white font-bold rounded-xl text-[10px] uppercase hover:bg-white/20 transition-all tracking-wider h-14"
          >
            <Globe className="w-4 h-4 mb-1" />
            Explore
          </button>
        </div>

        {/* Example Search Chips */}
        {!isAnalyzing && (
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold px-1">
              Try an example
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {EXAMPLE_SEARCHES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => {
                    setInputValue(example.location);
                    setSelectedPlaceId(example.placeId);
                    setIntentValue(example.intent);
                    onSearch(example.placeId, example.intent, radiusValue);
                  }}
                  className="flex-shrink-0 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-white/60 font-medium hover:bg-cyan-500/20 hover:border-cyan-400/30 hover:text-white/90 transition-all"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
      {/* Bottom collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="mt-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 hover:border-white/20 hover:bg-black/50 transition-all"
      >
        <ChevronUp className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
      </button>
    </div>
  );
}
