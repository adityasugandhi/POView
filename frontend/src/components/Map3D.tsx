"use client";
import React, { useMemo } from "react";
import { Viewer, CameraFlyTo, Cesium3DTileset, Entity, PolylineGraphics, PointGraphics, useCesium } from "resium";
import { Cartesian3, Rectangle, Math as CesiumMath, Color } from "cesium";
import RecommendationPin3D, { Recommendation } from "./RecommendationPin3D";

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

interface Map3DProps {
    viewport?: {
        low: { latitude: number; longitude: number };
        high: { latitude: number; longitude: number };
    };
    location?: { lat: number; lng: number };
    recommendations?: Recommendation[];
    selectedRecommendation?: Recommendation;
    recenterTrigger?: number;
    layersVisible?: boolean;
    weatherState?: string;
    droneWaypoint?: CameraWaypoint;
}


// WeatherEffects manages dynamic Cesium environment based on Google WeatherForecast 2 context
const WeatherEffects = ({ weatherState }: { weatherState?: string }) => {
    const { scene } = useCesium();

    React.useEffect(() => {
        if (!scene) return;

        // Reset defaults
        // eslint-disable-next-line react-hooks/immutability
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        if (scene.skyAtmosphere) {
            scene.skyAtmosphere.hueShift = 0.0;
            scene.skyAtmosphere.saturationShift = 0.0;
            scene.skyAtmosphere.brightnessShift = 0.0;
        }

        // Apply Weather Model states
        if (weatherState === "rain" || weatherState === "heavy_rain") {
            scene.fog.density = 0.0012; // Thicker fog for rain
            if (scene.skyAtmosphere) {
                scene.skyAtmosphere.saturationShift = -0.7; // Desaturated and moody
                scene.skyAtmosphere.brightnessShift = -0.4; // Darker sky
            }
        } else if (weatherState === "snow") {
            scene.fog.density = 0.0025; // Very thick white out
            if (scene.skyAtmosphere) {
                scene.skyAtmosphere.saturationShift = -0.5;
                scene.skyAtmosphere.brightnessShift = 0.3; // Brighter fog for snow
            }
        } else if (weatherState === "fog" || weatherState === "overcast") {
            scene.fog.density = 0.0015;
            if (scene.skyAtmosphere) {
                scene.skyAtmosphere.saturationShift = -0.8;
                scene.skyAtmosphere.brightnessShift = -0.2;
            }
        }
    }, [scene, weatherState]);

    return null;
};

export default function Map3D({ viewport, location, recommendations = [], selectedRecommendation, recenterTrigger, layersVisible = true, weatherState = "clear", droneWaypoint }: Map3DProps) {
    const GOOGLE_TILE_URL = `https://tile.googleapis.com/v1/3dtiles/root.json?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

    const cameraConfig = useMemo(() => {
        // Highest priority: Drone waypoint (active drone tour)
        if (droneWaypoint) {
            return {
                destination: Cartesian3.fromDegrees(
                    droneWaypoint.longitude,
                    droneWaypoint.latitude,
                    droneWaypoint.altitude
                ),
                orientation: {
                    heading: CesiumMath.toRadians(droneWaypoint.heading),
                    pitch: CesiumMath.toRadians(droneWaypoint.pitch),
                    roll: droneWaypoint.roll,
                },
                duration: droneWaypoint.duration,
            };
        }

        if (recenterTrigger && recenterTrigger > 0) {
            // Recenter explicitly to the user's searched origin location, or fallback to NY
            const targetLat = location?.lat || 40.7300;
            const targetLng = location?.lng || -73.9950;

            return {
                destination: Cartesian3.fromDegrees(targetLng, targetLat - 0.006, 400),
                orientation: {
                    heading: 0,
                    pitch: CesiumMath.toRadians(-35),
                    roll: 0
                }
            };
        }

        if (selectedRecommendation && selectedRecommendation.lat && selectedRecommendation.lng) {
            // Priority 0: Explicitly clicked recommendation
            return {
                destination: Cartesian3.fromDegrees(selectedRecommendation.lng, selectedRecommendation.lat - 0.001, 40), // Cinematic "Hero View"
                orientation: {
                    heading: 0,
                    pitch: CesiumMath.toRadians(-15),
                    roll: 0
                }
            };
        } else if (location && location.lat && location.lng) {
            // Priority 1: Neighborhood/Spatial Area View at an angle 
            // Offset slightly South to frame the neighborhood nicely
            return {
                destination: Cartesian3.fromDegrees(location.lng, location.lat - 0.006, 400),
                orientation: {
                    heading: 0,
                    pitch: CesiumMath.toRadians(-35),
                    roll: 0
                }
            };
        } else if (recommendations.length > 0 && recommendations[0].lat && recommendations[0].lng) {
            // Priority 2: Street-Level Hero View for specific point of interest (using the first one as anchor)
            return {
                destination: Cartesian3.fromDegrees(recommendations[0].lng, recommendations[0].lat - 0.001, 40),
                orientation: {
                    heading: 0,
                    pitch: CesiumMath.toRadians(-15),
                    roll: 0
                }
            };
        } else if (viewport) {
            return {
                destination: Rectangle.fromDegrees(
                    viewport.low.longitude,
                    viewport.low.latitude,
                    viewport.high.longitude,
                    viewport.high.latitude
                )
            };
        }

        // Default fallback to New York City skyline aesthetic view
        return {
            destination: Cartesian3.fromDegrees(-73.9950, 40.7300, 1200),
            orientation: {
                heading: CesiumMath.toRadians(30),
                pitch: CesiumMath.toRadians(-25),
                roll: 0
            }
        };
    }, [viewport, location, recommendations, selectedRecommendation, recenterTrigger, droneWaypoint]);

    // Generate a robust key to force CameraFlyTo to re-trigger when targets change
    const flyToKey = useMemo(() => {
        const destStr = JSON.stringify(cameraConfig.destination);
        const orientStr = JSON.stringify(cameraConfig.orientation);
        return `${destStr}-${orientStr}-${recenterTrigger || 0}`;
    }, [cameraConfig, recenterTrigger]);

    // Helper to format routing paths for each recommendation
    const getPolylinePositions = (path: number[][]) => {
        if (!path || path.length < 2) return null;
        const coords = path.map(p => [p[1], p[0]]).flat();
        return Cartesian3.fromDegreesArray(coords);
    };

    const handleZoomIn = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewer = (window as unknown as Record<string, any>).cesiumViewer;
        if (viewer) viewer.camera.zoomIn(500);
    };

    const handleZoomOut = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewer = (window as unknown as Record<string, any>).cesiumViewer;
        if (viewer) viewer.camera.zoomOut(500);
    };

    const handleResetCompass = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewer = (window as unknown as Record<string, any>).cesiumViewer;
        if (viewer) {
            const currentPosition = viewer.camera.position.clone();
            const currentPitch = viewer.camera.pitch;
            viewer.camera.flyTo({
                destination: currentPosition,
                orientation: {
                    heading: 0.0,
                    pitch: currentPitch,
                    roll: 0.0
                },
                duration: 1.0
            });
        }
    };

    return (
        <div className="w-full h-full relative">
            <Viewer
                full
                timeline={false}
                animation={false}
                baseLayerPicker={false}
                geocoder={false}
                homeButton={false}
                sceneModePicker={false}
                navigationHelpButton={false}
                selectionIndicator={false}
                infoBox={false}
                ref={(e: { cesiumElement?: unknown } | null) => {
                    if (e && e.cesiumElement) {
                        (window as unknown as Record<string, unknown>).cesiumViewer = e.cesiumElement;
                    }
                }}
            >
                <WeatherEffects weatherState={weatherState} />

                <Cesium3DTileset
                    url={GOOGLE_TILE_URL}
                    showCreditsOnScreen={true}
                />

                <CameraFlyTo
                    key={flyToKey}
                    destination={cameraConfig.destination}
                    orientation={cameraConfig.orientation}
                    duration={'duration' in cameraConfig ? (cameraConfig.duration as number) : 3.5}
                />

                {layersVisible && recommendations.map((rec, index) => {
                    if (!rec.lat || !rec.lng) return null;
                    const pathPositions = rec.routingPath ? getPolylinePositions(rec.routingPath) : null;
                    return (
                        <React.Fragment key={`rec-${index}`}>
                            {/* 3D Anchor Point */}
                            <Entity position={Cartesian3.fromDegrees(rec.lng, rec.lat, 20)}>
                                <PointGraphics pixelSize={14} color={Color.CYAN} outlineColor={Color.WHITE} outlineWidth={3} />
                            </Entity>
                            {/* 3D Animated Pin Overlay */}
                            <RecommendationPin3D recommendation={rec} index={index} />

                            {/* Routing Path */}
                            {pathPositions && (
                                <Entity>
                                    <PolylineGraphics
                                        positions={pathPositions}
                                        width={5}
                                        material={new Color(0.0, 1.0, 1.0, 0.5)} // Cyan with some transparency, slightly lower opacity for multiple paths
                                    />
                                </Entity>
                            )}
                        </React.Fragment>
                    );
                })}
                {/* Vivid Original Location Marker */}
                {layersVisible && location && location.lat !== undefined && location.lng !== undefined && (
                    <Entity
                        position={Cartesian3.fromDegrees(location.lng, location.lat, 0)}
                    >
                        <PointGraphics
                            color={Color.fromCssColorString('#f43f5e')} // Vibrant Rose Red for the main origin
                            pixelSize={20}
                            outlineColor={Color.WHITE}
                            outlineWidth={3}
                        />
                    </Entity>
                )}

                {layersVisible && location && location.lat !== undefined && location.lng !== undefined && recommendations.length === 0 && (
                    <Entity position={Cartesian3.fromDegrees(location.lng, location.lat, 20)}>
                        <PointGraphics pixelSize={12} color={Color.WHITE} outlineColor={Color.CYAN} outlineWidth={2} />
                    </Entity>
                )}
            </Viewer>

            {/* Custom On-Screen Map Controls */}
            <div className="absolute bottom-10 right-10 z-50 flex flex-col space-y-2 bg-black/40 backdrop-blur-md rounded-xl p-2 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
                <button
                    onClick={handleResetCompass}
                    className="p-3 bg-white/5 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 hover:border-cyan-400 group relative"
                    title="Reset Compass (Face North)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 group-hover:text-cyan-400"><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon><circle cx="12" cy="12" r="10"></circle></svg>
                </button>
                <div className="w-full h-px bg-white/10 my-1"></div>
                <button
                    onClick={handleZoomIn}
                    className="p-3 bg-white/5 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 hover:border-cyan-400 group"
                    title="Zoom In"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 group-hover:text-cyan-400"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-3 bg-white/5 hover:bg-white/20 text-white rounded-lg transition-all border border-white/5 hover:border-cyan-400 group"
                    title="Zoom Out"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 group-hover:text-cyan-400"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>
        </div>
    );
}
