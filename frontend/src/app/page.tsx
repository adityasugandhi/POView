"use client";
import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import InsightPanel from "@/components/InsightPanel";
import SearchBox from "@/components/SearchBox";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import LandingPage from "@/components/LandingPage";
import {
  getStoredLocation,
  DefaultLocation as LocSelectorDefault,
} from "@/components/LocationSelector";
import { ChevronLeft, ChevronRight } from "lucide-react";
import VoiceAssistant from "@/components/VoiceAssistant";
import TourProgressBar from "@/components/TourProgressBar";
import GridScanLoader from "@/components/GridScanLoader";
import { useSimulationStore } from "@/store/useSimulationStore";
import { useTourPlayback } from "@/hooks/useTourPlayback";
import {
  MOCK_LOCATION,
  MOCK_VIEWPORT,
  MOCK_RECOMMENDATIONS,
  MOCK_PROFILE_DATA,
  MOCK_WEATHER,
  MOCK_DRONE_WAYPOINTS,
} from "@/lib/mockData";
import axios from "axios";
import { Ion } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type {
  CameraWaypoint,
  DefaultLocation,
  Viewport,
  Recommendation as SimRecommendation,
  NeighborhoodProfile,
  NarrationTimeline,
} from "@/types/simulation";

const NYC_FALLBACK: DefaultLocation = {
  placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
  displayName: "New York City",
  lat: 40.73,
  lng: -73.995,
};

// Set Cesium base URL to public folder copies
if (typeof window !== "undefined") {
  (window as unknown as Record<string, string>).CESIUM_BASE_URL = "/cesium";
  Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";
}

// Dynamically import CesiumJS map to avoid SSR issues
const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

export default function Home() {
  // ── Zustand reactive selectors ──────────────────────────────────────
  const profileData = useSimulationStore((s) => s.profileData);
  const viewport = useSimulationStore((s) => s.viewport);
  const location = useSimulationStore((s) => s.location);
  const recommendationsData = useSimulationStore((s) => s.recommendationsData);
  const selectedRecommendation = useSimulationStore(
    (s) => s.selectedRecommendation,
  );
  const insightPanelVisible = useSimulationStore((s) => s.insightPanelVisible);
  const recommendationsPanelVisible = useSimulationStore((s) => s.recommendationsPanelVisible);
  const loading = useSimulationStore((s) => s.loading);
  const error = useSimulationStore((s) => s.error);
  const recenterTrigger = useSimulationStore((s) => s.recenterTrigger);
  const layersVisible = useSimulationStore((s) => s.layersVisible);
  const hasStarted = useSimulationStore((s) => s.hasStarted);
  const isTransitioning = useSimulationStore((s) => s.isTransitioning);
  const weatherState = useSimulationStore((s) => s.weatherState);
  const droneWaypoints = useSimulationStore((s) => s.droneWaypoints);
  const activeDroneWaypoint = useSimulationStore((s) => s.activeDroneWaypoint);
  const isScanning = useSimulationStore((s) => s.isScanning);
  const cinematicFlight = useSimulationStore((s) => s.cinematicFlight);

  // ── Zustand actions ─────────────────────────────────────────────────
  const setProfileData = useSimulationStore((s) => s.setProfileData);
  const setViewport = useSimulationStore((s) => s.setViewport);
  const setLocation = useSimulationStore((s) => s.setLocation);
  const setRecommendationsData = useSimulationStore(
    (s) => s.setRecommendationsData,
  );
  const setSelectedRecommendation = useSimulationStore(
    (s) => s.setSelectedRecommendation,
  );
  const setLoading = useSimulationStore((s) => s.setLoading);
  const setError = useSimulationStore((s) => s.setError);
  const setRecenterTrigger = useSimulationStore((s) => s.setRecenterTrigger);
  const setHasStarted = useSimulationStore((s) => s.setHasStarted);
  const setIsTransitioning = useSimulationStore((s) => s.setIsTransitioning);
  const setWeatherState = useSimulationStore((s) => s.setWeatherState);
  const setDroneWaypoints = useSimulationStore((s) => s.setDroneWaypoints);
  const setActiveDroneWaypoint = useSimulationStore(
    (s) => s.setActiveDroneWaypoint,
  );
  const clearSearch = useSimulationStore((s) => s.clearSearch);

  // ── Mock data toggle (dev only) ────────────────────────────────────
  const [useMockData, setUseMockData] = useState(false);

  // ── Local drone tour controls (index-based navigation) ─────────────
  const [droneIndex, setDroneIndex] = useState<number>(-1);
  const [droneAutoPlay, setDroneAutoPlay] = useState(false);
  const droneTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive active POI name for Map3D highlighting
  const activePOIName =
    droneIndex >= 0 ? droneWaypoints[droneIndex]?.label : undefined;

  // ── Default location (hydrate once after mount) ─────────────────────
  const defaultLocation = useSimulationStore((s) => s.defaultLocation);
  React.useEffect(() => {
    const stored = getStoredLocation();
    if (stored) {
      useSimulationStore.getState().setDefaultLocation(stored);
    }
  }, []);

  // ── Tour Playback ────────────────────────────────────────────────────
  type WsCallbacks =
    NonNullable<
      import("@/components/VoiceAssistant").VoiceAssistantProps["onWebSocketReady"]
    > extends (methods: infer M) => void
      ? Partial<M>
      : never;
  const wsCallbacks = useRef<WsCallbacks>({});

  const tourPlayback = useTourPlayback(
    (...args: unknown[]) =>
      (
        wsCallbacks.current.sendTourProgress as
          | ((...a: unknown[]) => void)
          | undefined
      )?.(...args),
    (...args: unknown[]) =>
      (
        wsCallbacks.current.sendTourLifecycle as
          | ((...a: unknown[]) => void)
          | undefined
      )?.(...args),
    (...args: unknown[]) =>
      (
        wsCallbacks.current.sendScreenCapture as
          | ((...a: unknown[]) => void)
          | undefined
      )?.(...args),
  );

  const handleWebSocketReady = useCallback(
    (callbacks: Required<WsCallbacks>) => {
      wsCallbacks.current = callbacks;
    },
    [],
  );

  const handleNarratedTourResult = useCallback(
    (data: Record<string, unknown>) => {
      // Show UI panels by starting transition if we are on landing page
      if (!useSimulationStore.getState().hasStarted) {
        setIsTransitioning(true);
        setTimeout(() => setHasStarted(true), 1000);
      }

      if (data.profile) setProfileData(data.profile as NeighborhoodProfile);
      if (data.viewport) setViewport(data.viewport as Viewport);
      if (data.location) {
        const loc = data.location as { lat: number; lng: number };
        setLocation({ lat: loc.lat, lng: loc.lng });
      }
      if (data.weather) {
        const weather = data.weather as { render_state?: string };
        if (weather.render_state) setWeatherState(weather.render_state);
      }
      if (data.narration_timeline) {
        tourPlayback.startNarratedTour(
          data.narration_timeline as NarrationTimeline,
        );
      }
    },
    [
      setProfileData,
      setViewport,
      setLocation,
      setWeatherState,
      tourPlayback,
      setIsTransitioning,
      setHasStarted,
    ],
  );

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleStart = (defaultLoc: DefaultLocation) => {
    if (useMockData) {
      loadMockData();
      return;
    }
    // Pre-set location so Map3D flies to chosen location instead of NYC
    setLocation({ lat: defaultLoc.lat, lng: defaultLoc.lng });
    setIsTransitioning(true);
    setTimeout(() => {
      setHasStarted(true);
    }, 1000);
  };

  const handleSearch = async (
    placeId: string,
    intent: string,
    radius: number,
  ) => {
    setLoading(true);
    setError("");
    setRecommendationsData([]);
    setSelectedRecommendation(null);

    try {
      // Execute both requests concurrently for better UX
      const [proximityRes, profileRes] = await Promise.all([
        axios.post(`http://localhost:8000/api/proximity_search`, {
          place_id: placeId,
          intent: intent,
          radius: radius,
        }),
        axios.get(`http://localhost:8000/api/profile_v2/${placeId}`, {
          params: { intent: intent },
        }),
      ]);

      if (proximityRes.data && proximityRes.data.results) {
        setRecommendationsData(
          proximityRes.data.results.map(
            (res: {
              metadata: Record<string, unknown>;
              coordinates: [number, number];
              routing_path?: number[][];
            }) => ({
              ...res.metadata,
              lat: res.coordinates[0],
              lng: res.coordinates[1],
              routingPath: res.routing_path,
            }),
          ),
        );
      } else {
        setError(
          "Failed to retrieve matching locations from proximity search.",
        );
      }

      if (profileRes.data) {
        setProfileData({
          ...profileRes.data.data,
          weather: profileRes.data.weather,
        });
        if (profileRes.data.viewport) {
          setViewport(profileRes.data.viewport);
        }
        if (profileRes.data.location) {
          setLocation({
            lat: profileRes.data.location.lat,
            lng: profileRes.data.location.lng,
          });
        }
        if (profileRes.data.weather && profileRes.data.weather.render_state) {
          setWeatherState(profileRes.data.weather.render_state);
        } else {
          setWeatherState("clear");
        }
        // Extract visualization plan for drone tour — exclude filler waypoints, keep POI stops
        if (
          profileRes.data.visualization_plan &&
          profileRes.data.visualization_plan.waypoints
        ) {
          const FILLER_LABELS = new Set(["Overview", "Descent", "Return"]);
          const poiOnly = profileRes.data.visualization_plan.waypoints
            .filter(
              (wp: CameraWaypoint) =>
                !FILLER_LABELS.has(wp.label) &&
                !wp.label.startsWith("Transit to "),
            )
            .slice(0, proximityRes.data.results.length);
          setDroneWaypoints(poiOnly);
        }
      } else {
        setError("Failed to retrieve primary neighborhood profile.");
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecenter = () => {
    setRecenterTrigger();
  };

  const handleGoHome = useCallback(() => {
    setIsTransitioning(true);
    setHasStarted(false);
    // Allow one frame for the off-screen landing page to mount, then slide it in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
    });
  }, [setIsTransitioning, setHasStarted]);

  const handleClear = () => {
    clearSearch();
    setDroneIndex(-1);
    setDroneAutoPlay(false);
    if (droneTimerRef.current) clearTimeout(droneTimerRef.current);
  };

  // ── Mock data loader (dev only) ─────────────────────────────────────
  const loadMockData = () => {
    setLocation(MOCK_LOCATION);
    setViewport(MOCK_VIEWPORT);
    setRecommendationsData(MOCK_RECOMMENDATIONS);
    setProfileData(MOCK_PROFILE_DATA as unknown as NeighborhoodProfile);
    setWeatherState(MOCK_WEATHER.render_state);
    setDroneWaypoints(MOCK_DRONE_WAYPOINTS);
    setHasStarted(true);
    setLoading(false);
    setError("");
  };

  // ── Drone tour controls (index-based PREV/NEXT/PLAY/PAUSE/STOP) ────

  const goToWaypoint = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, droneWaypoints.length - 1));
      setDroneIndex(clamped);
      setActiveDroneWaypoint(droneWaypoints[clamped]);
    },
    [droneWaypoints, setActiveDroneWaypoint],
  );

  const handleNext = useCallback(() => {
    if (droneIndex >= droneWaypoints.length - 1) {
      setDroneAutoPlay(false);
      return;
    }
    goToWaypoint(droneIndex + 1);
  }, [droneIndex, droneWaypoints.length, goToWaypoint]);

  const handlePrev = useCallback(() => {
    if (droneIndex <= 0) return;
    goToWaypoint(droneIndex - 1);
  }, [droneIndex, goToWaypoint]);

  const handlePlayPause = useCallback(() => {
    setDroneAutoPlay((prev) => {
      if (!prev && droneIndex >= droneWaypoints.length - 1) {
        goToWaypoint(0);
      }
      return !prev;
    });
  }, [droneIndex, droneWaypoints.length, goToWaypoint]);

  const handleDroneTour = useCallback(() => {
    if (droneWaypoints.length === 0 || droneIndex >= 0) return;
    setDroneAutoPlay(true);
    goToWaypoint(0);
  }, [droneWaypoints, droneIndex, goToWaypoint]);

  const handleStopTour = useCallback(() => {
    setDroneIndex(-1);
    setDroneAutoPlay(false);
    setActiveDroneWaypoint(null);
    if (droneTimerRef.current) clearTimeout(droneTimerRef.current);
  }, [setActiveDroneWaypoint]);

  // Auto-play effect: schedule next waypoint when auto-playing
  React.useEffect(() => {
    if (!droneAutoPlay || droneIndex < 0 || droneIndex >= droneWaypoints.length)
      return;
    const wp = droneWaypoints[droneIndex];
    const waitMs = ((wp.duration || 3) + (wp.pause_after || 1)) * 1000;
    droneTimerRef.current = setTimeout(() => {
      handleNext();
    }, waitMs);
    return () => {
      if (droneTimerRef.current) clearTimeout(droneTimerRef.current);
    };
  }, [droneAutoPlay, droneIndex, droneWaypoints, handleNext]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans">
      {/* Landing Page Overlay */}
      {!hasStarted && (
        <div
          className={`absolute inset-0 z-50 transition-all duration-1000 ease-[cubic-bezier(0.76,0,0.24,1)] ${
            isTransitioning
              ? "-translate-y-full opacity-0"
              : "translate-y-0 opacity-100"
          }`}
        >
          <LandingPage
            onStart={handleStart}
            defaultLocation={
              (defaultLocation ?? NYC_FALLBACK) as LocSelectorDefault
            }
            onLocationChange={(loc: LocSelectorDefault) =>
              useSimulationStore
                .getState()
                .setDefaultLocation(loc as DefaultLocation)
            }
            useMockData={useMockData}
            onToggleMockData={() => setUseMockData((prev) => !prev)}
          />
        </div>
      )}

      {/* 3D Map Viewport Background */}
      <div className="absolute inset-0 z-0">
        <Map3D
          viewport={viewport ?? undefined}
          location={location ?? undefined}
          recommendations={recommendationsData}
          selectedRecommendation={selectedRecommendation ?? undefined}
          onSelectRecommendation={(rec) =>
            setSelectedRecommendation(
              selectedRecommendation?.name === rec.name ? null : rec,
            )
          }
          recenterTrigger={recenterTrigger}
          layersVisible={layersVisible}
          weatherState={weatherState}
          droneWaypoint={activeDroneWaypoint ?? undefined}
          activePOIName={activePOIName}
          cinematicFlight={cinematicFlight}
        />
      </div>

      {/* Main UI Overlay (fades in after start) */}
      <div
        className={`transition-opacity duration-1000 ${
          isTransitioning || hasStarted
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Top-Center Weather Pane & Utilities */}
        {profileData && profileData.weather && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-4">
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-5 py-2 flex items-center space-x-3 pointer-events-auto transition-transform hover:scale-105">
              <span className="text-xl">
                {profileData.weather.is_day ? "☀️" : "🌙"}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/50 tracking-widest uppercase">
                  Live Weather
                </span>
                <div className="flex items-center space-x-2 text-sm font-semibold text-white">
                  <span>{profileData.weather.temperature}°F</span>
                  <span className="text-cyan-400">|</span>
                  <span>{profileData.weather.condition}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRecenter}
              className="bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 pointer-events-auto transition-all duration-300 group"
              title="Return to target location"
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
                className="text-cyan-300 group-hover:text-white transition-colors"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
              </svg>
              <span className="text-xs font-bold text-cyan-300 group-hover:text-white transition-colors tracking-wider">
                RECENTER
              </span>
            </button>

            {droneWaypoints.length > 0 && (
              <>
                {droneIndex === -1 ? (
                  <button
                    onClick={handleDroneTour}
                    className="bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/50 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 pointer-events-auto transition-all duration-300 group"
                    title="Start autonomous drone camera tour"
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
                      className="text-purple-300 group-hover:text-white transition-colors"
                    >
                      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>
                    </svg>
                    <span className="text-xs font-bold text-purple-300 group-hover:text-white transition-colors tracking-wider">
                      DRONE TOUR
                    </span>
                  </button>
                ) : (
                  <div className="bg-black/40 backdrop-blur-2xl border border-purple-400/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-2 py-1.5 flex items-center space-x-1 pointer-events-auto">
                    <button
                      onClick={handlePrev}
                      disabled={droneIndex <= 0}
                      className="rounded-full px-3 py-2 text-xs font-bold tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-purple-300 hover:bg-purple-500/30 hover:text-white"
                      title="Previous waypoint"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 inline-block mr-0.5" />
                      PREV
                    </button>

                    <div className="px-3 py-1 flex flex-col items-center min-w-[120px]">
                      <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase leading-none truncate max-w-[140px]">
                        {droneIndex >= 0
                          ? droneWaypoints[droneIndex]?.label
                          : "—"}
                      </span>
                      <span className="text-xs font-semibold text-purple-300">
                        {`${droneIndex + 1}/${droneWaypoints.length} places`}
                      </span>
                    </div>

                    <button
                      onClick={handleNext}
                      disabled={droneIndex >= droneWaypoints.length - 1}
                      className="rounded-full px-3 py-2 text-xs font-bold tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-purple-300 hover:bg-purple-500/30 hover:text-white"
                      title="Next waypoint"
                    >
                      NEXT
                      <ChevronRight className="w-3.5 h-3.5 inline-block ml-0.5" />
                    </button>

                    <div className="w-px h-6 bg-purple-400/30 mx-1" />

                    <button
                      onClick={handlePlayPause}
                      className="rounded-full px-3 py-2 text-xs font-bold tracking-wider transition-all duration-200 text-purple-300 hover:bg-purple-500/30 hover:text-white"
                      title={
                        droneAutoPlay ? "Pause auto-play" : "Resume auto-play"
                      }
                    >
                      {droneAutoPlay ? "PAUSE" : "PLAY"}
                    </button>

                    <button
                      onClick={handleStopTour}
                      className="rounded-full px-3 py-2 text-xs font-bold tracking-wider transition-all duration-200 text-red-400 hover:bg-red-500/30 hover:text-red-300"
                      title="Stop tour"
                    >
                      STOP
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Floating UI Layer Left Side */}
        <div className="absolute inset-y-6 left-6 w-[400px] md:w-[480px] z-10 flex flex-col pointer-events-none space-y-6">
          {/* Title and Search Header */}
          <div className="pointer-events-auto shrink-0 flex flex-col space-y-5">
            <div className="px-2 pt-2 flex items-center space-x-2">
              <button
                onClick={handleGoHome}
                className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl px-5 py-3 flex items-center space-x-3 w-fit cursor-pointer hover:border-white/20 hover:bg-black/50 transition-all duration-300"
                title="Back to home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-cyan-400 shrink-0"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-extrabold text-white tracking-wider drop-shadow-xl leading-none">
                    POView
                  </h1>
                  <p className="text-white/50 text-xs font-medium tracking-wide drop-shadow-md">
                    Autonomous Urban Intelligence
                  </p>
                </div>
              </button>
              <button
                onClick={handleGoHome}
                className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 flex items-center justify-center hover:border-white/20 hover:bg-black/50 transition-all duration-300 group"
                title="Back to home"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 group-hover:text-cyan-400 transition-colors"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </button>
            </div>
            <SearchBox
              onSearch={handleSearch}
              onRecenter={handleRecenter}
              onClear={handleClear}
              isAnalyzing={loading}
              layersVisible={layersVisible}
            />
            {error && (
              <p className="text-red-400 text-sm px-2 drop-shadow-md font-medium">
                {error}
              </p>
            )}
          </div>

          <div className="pointer-events-auto flex-1 overflow-hidden h-0 rounded-3xl">
            {loading || isScanning ? (
              <div className="p-8 text-center text-white/50 h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl">
                <div className="w-12 h-12 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                <p className="tracking-widest uppercase text-xs font-semibold text-cyan-300/80 animate-pulse">
                  {isScanning ? "Locking Target Vector..." : "Aggregating Telemetry..."}
                </p>
              </div>
            ) : (
              (profileData || insightPanelVisible) && (
                <div className="h-full">
                  <InsightPanel profileData={profileData} />
                </div>
              )
            )}
          </div>
        </div>

        {isScanning ? (
          <div className="absolute inset-y-6 right-6 w-[400px] z-10 hidden lg:flex flex-col">
            <GridScanLoader />
          </div>
        ) : (recommendationsData && recommendationsData.length > 0) || recommendationsPanelVisible ? (
          <div className="absolute inset-y-6 right-6 w-[400px] z-10 hidden lg:flex flex-col">
            <RecommendationsPanel
              recommendations={recommendationsData}
              onSelectRecommendation={(rec: SimRecommendation) =>
                setSelectedRecommendation(rec)
              }
              profileData={profileData ?? undefined}
            />
          </div>
        ) : null}
      </div>

      {/* Tour Progress Bar (visible only during active tours) */}
      <TourProgressBar
        tourStatus={tourPlayback.tourStatus}
        progress={tourPlayback.progress}
        currentSegment={tourPlayback.currentSegment}
        totalSegments={
          useSimulationStore.getState().narrationTimeline?.total_segments ?? 0
        }
        onPause={tourPlayback.pause}
        onResume={tourPlayback.resume}
        onStop={tourPlayback.stop}
      />

      {/* Voice Assistant — fixed bottom-center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center space-y-3 pointer-events-auto">
        <VoiceAssistant
          onProfileData={(profile) => {
            setProfileData(profile);
          }}
          onRecommendations={(recs) => {
            setRecommendationsData(recs);
          }}
          onDroneWaypoints={(waypoints) => {
            setDroneWaypoints(waypoints);
          }}
          onDroneTourStart={handleDroneTour}
          onNarratedTourResult={handleNarratedTourResult}
          onLocationUpdate={(loc, vp) => {
            setLocation({ lat: loc.lat, lng: loc.lng });
            if (vp) setViewport(vp as Viewport);
            if (!hasStarted) {
              setIsTransitioning(true);
              setTimeout(() => setHasStarted(true), 1000);
            }
          }}
          onWebSocketReady={handleWebSocketReady}
        />
      </div>
    </main>
  );
}
