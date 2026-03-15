"use client";
import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import InsightPanel from "@/components/InsightPanel";
import SearchBox from "@/components/SearchBox";
import RecommendationsPanel from "@/components/RecommendationsPanel";
import LandingPage from "@/components/LandingPage";
import { Recommendation } from "@/components/RecommendationPin3D";
import { DefaultLocation, getStoredLocation } from "@/components/LocationSelector";
import axios from "axios";
import { Ion } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// Set Cesium base URL to public folder copies
if (typeof window !== "undefined") {
  (window as unknown as Record<string, string>).CESIUM_BASE_URL = "/cesium";
  Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";
}

// Dynamically import CesiumJS map to avoid SSR issues
const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

interface CameraWaypoint {
  label: string;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  pitch: number;
  roll: number;
  duration: number;
  pause_after: number;
}

export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profileData, setProfileData] = useState<Record<string, any> | null>(null);
  const [viewport, setViewport] = useState<{ low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [_layersVisible] = useState(true);

  // Landing Page State
  const [hasStarted, setHasStarted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Default location from localStorage
  const [defaultLocation, setDefaultLocation] = useState<DefaultLocation>(getStoredLocation);

  // Weather state from backend
  const [weatherState, setWeatherState] = useState<string>("clear");

  // Drone Tour state
  const [droneWaypoints, setDroneWaypoints] = useState<CameraWaypoint[]>([]);
  const [activeDroneWaypoint, setActiveDroneWaypoint] = useState<CameraWaypoint | null>(null);
  const [isDroneFlying, setIsDroneFlying] = useState(false);
  const droneTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = (defaultLoc: DefaultLocation) => {
    // Pre-set location so Map3D flies to chosen location instead of NYC
    setLocation({ lat: defaultLoc.lat, lng: defaultLoc.lng });

    setIsTransitioning(true);
    setTimeout(() => {
      setHasStarted(true);
    }, 1000);
  };

  const handleSearch = async (placeId: string, intent: string, radius: number) => {
    setLoading(true);
    setError("");
    setRecommendations([]);
    setSelectedRecommendation(null);

    try {
      // Execute both requests concurrently for better UX
      const [proximityRes, profileRes] = await Promise.all([
        axios.post(`http://localhost:8000/api/proximity_search`, {
          place_id: placeId,
          intent: intent,
          radius: radius
        }),
        axios.get(`http://localhost:8000/api/profile_v2/${placeId}`, {
          params: { intent: intent }
        })
      ]);

      if (proximityRes.data && proximityRes.data.results) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRecommendations(proximityRes.data.results.map((res: Record<string, any>) => ({
          ...res.metadata,
          lat: res.coordinates[0],
          lng: res.coordinates[1],
          routingPath: res.routing_path
        })));
      } else {
        setError("Failed to retrieve matching locations from proximity search.");
      }

      if (profileRes.data) {
        setProfileData({
          ...profileRes.data.data,
          weather: profileRes.data.weather
        });
        if (profileRes.data.viewport) {
          setViewport(profileRes.data.viewport);
        }
        if (profileRes.data.location) {
          setLocation({ lat: profileRes.data.location.lat, lng: profileRes.data.location.lng });
        }
        if (profileRes.data.weather && profileRes.data.weather.render_state) {
          setWeatherState(profileRes.data.weather.render_state);
        } else {
          setWeatherState("clear");
        }
        // Extract visualization plan for drone tour
        if (profileRes.data.visualization_plan && profileRes.data.visualization_plan.waypoints) {
          setDroneWaypoints(profileRes.data.visualization_plan.waypoints);
        }
      } else {
        setError("Failed to retrieve primary neighborhood profile.");
      }

    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(axiosErr.response?.data?.detail || axiosErr.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRecenter = () => {
    setRecenterTrigger(prev => prev + 1);
  };

  const handleClear = () => {
    setRecommendations([]);
    setSelectedRecommendation(null);
    setLocation(null);
    setProfileData(null);
    setWeatherState("clear");
    setDroneWaypoints([]);
    setActiveDroneWaypoint(null);
    setIsDroneFlying(false);
    if (droneTimerRef.current) clearTimeout(droneTimerRef.current);
  };

  const handleDroneTour = useCallback(() => {
    if (droneWaypoints.length === 0 || isDroneFlying) return;
    setIsDroneFlying(true);

    let index = 0;
    const flyNext = () => {
      if (index >= droneWaypoints.length) {
        setIsDroneFlying(false);
        setActiveDroneWaypoint(null);
        return;
      }
      const wp = droneWaypoints[index];
      setActiveDroneWaypoint(wp);
      index++;
      const waitMs = ((wp.duration || 3) + (wp.pause_after || 1)) * 1000;
      droneTimerRef.current = setTimeout(flyNext, waitMs);
    };
    flyNext();
  }, [droneWaypoints, isDroneFlying]);


  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans">

      {/* Landing Page Overlay */}
      {!hasStarted && (
        <div
          className={`absolute inset-0 z-50 transition-all duration-1000 ease-[cubic-bezier(0.76,0,0.24,1)] ${isTransitioning ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
            }`}
        >
          <LandingPage onStart={handleStart} defaultLocation={defaultLocation} onLocationChange={setDefaultLocation} />
        </div>
      )}

      {/* 3D Map Viewport Background */}
      <div className="absolute inset-0 z-0">
        <Map3D
          viewport={viewport ?? undefined}
          location={location ?? undefined}
          recommendations={recommendations}
          selectedRecommendation={selectedRecommendation ?? undefined}
          recenterTrigger={recenterTrigger}
          layersVisible={_layersVisible}
          weatherState={weatherState}
          droneWaypoint={activeDroneWaypoint ?? undefined}
        />
      </div>

      {/* Main UI Overlay (fades in after start) */}
      <div className={`transition-opacity duration-1000 ${isTransitioning || hasStarted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

        {/* Top-Center Weather Pane & Utilities */}
        {profileData && profileData.weather && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-4">
            <div className="bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-5 py-2 flex items-center space-x-3 pointer-events-auto transition-transform hover:scale-105">
              <span className="text-xl">{profileData.weather.is_day ? '☀️' : '🌙'}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white/50 tracking-widest uppercase">Live Weather</span>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300 group-hover:text-white transition-colors"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>
              <span className="text-xs font-bold text-cyan-300 group-hover:text-white transition-colors tracking-wider">RECENTER</span>
            </button>

            {droneWaypoints.length > 0 && (
              <button
                onClick={handleDroneTour}
                disabled={isDroneFlying}
                className={`backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-full px-4 py-3 flex items-center space-x-2 pointer-events-auto transition-all duration-300 group border ${isDroneFlying ? 'bg-purple-500/40 border-purple-400/50 cursor-not-allowed' : 'bg-purple-500/20 hover:bg-purple-500/40 border-purple-400/50'}`}
                title="Start autonomous drone camera tour"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors ${isDroneFlying ? 'text-purple-200 animate-pulse' : 'text-purple-300 group-hover:text-white'}`}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path></svg>
                <span className={`text-xs font-bold transition-colors tracking-wider ${isDroneFlying ? 'text-purple-200' : 'text-purple-300 group-hover:text-white'}`}>
                  {isDroneFlying ? 'FLYING...' : 'DRONE TOUR'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Floating UI Layer Left Side */}
        <div className="absolute inset-y-6 left-6 w-[400px] md:w-[480px] z-10 flex flex-col pointer-events-none space-y-6">

          {/* Title and Search Header */}
          <div className="pointer-events-auto shrink-0 flex flex-col space-y-5">
            <div className="px-2 pt-2">
              <h1 className="text-4xl font-extrabold text-white tracking-wider drop-shadow-xl mb-1">
                POView
              </h1>
              <p className="text-white/70 text-sm font-medium tracking-wide drop-shadow-md">Autonomous Urban Intelligence</p>
            </div>
            <SearchBox
              onSearch={handleSearch}
              onRecenter={handleRecenter}
              onClear={handleClear}
              isAnalyzing={loading}
              layersVisible={_layersVisible}
            />
            {error && <p className="text-red-400 text-sm px-2 drop-shadow-md font-medium">{error}</p>}
          </div>

          {/* Floating Insight Panel */}
          <div className="pointer-events-auto flex-1 overflow-hidden h-0 rounded-3xl">
            {loading ? (
              <div className="p-8 text-center text-white/50 h-full flex flex-col items-center justify-center bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl">
                <div className="w-12 h-12 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
                <p className="tracking-widest uppercase text-xs font-semibold text-cyan-300/80">Aggregating Telemetry...</p>
              </div>
            ) : (
              profileData && (
                <div className="h-full">
                  <InsightPanel profileData={profileData} />
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Floating Recommendations Panel */}
        {recommendations && recommendations.length > 0 && (
          <div className="absolute inset-y-6 right-6 w-[400px] z-10 hidden lg:flex flex-col">
            <RecommendationsPanel
              recommendations={recommendations}
              onSelectRecommendation={setSelectedRecommendation}
              profileData={profileData ?? undefined}
            />
          </div>
        )}
      </div>
    </main>
  );
}
