/**
 * POView — Spatial Perception Engine
 *
 * Pure TypeScript module (zero React deps). Attaches to a CesiumJS Viewer and
 * provides the voice assistant with "vision" — camera telemetry, frustum-culled
 * visible POIs, and significant-change detection.
 *
 * All output is pushed to Zustand transient state via getState() to avoid
 * triggering React re-renders.
 *
 * Performance budget: < 2ms per execution at 500ms throttle.
 */

import { useSimulationStore } from "@/store/useSimulationStore";
import type { CameraTelemetry, VisiblePOI } from "@/types/simulation";

// --- Types ---

export type SignificantChangeCallback = (
  telemetry: CameraTelemetry,
  visiblePOIs: VisiblePOI[],
) => void;

interface RegisteredPOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
  rating: number;
}

// --- Module state ---

let _viewer: CesiumViewer | null = null;
let _removeListener: (() => void) | null = null;
let _lastExecutionTime = 0;
let _onSignificantChange: SignificantChangeCallback | null = null;
let _registeredPOIs: RegisteredPOI[] = [];
let _previousBBoxCenter: { lat: number; lng: number } | null = null;
let _previousAlt = 0;
let _previousVisibleSet = new Set<string>();

const THROTTLE_MS = 500;
const SIGNIFICANT_MOVE_M = 200;
const SIGNIFICANT_ALT_M = 100;

// --- Haversine distance (meters) ---

function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Core loop (called on every preUpdate, self-throttled) ---

function onPreUpdate() {
  const now = performance.now();
  if (now - _lastExecutionTime < THROTTLE_MS) return;
  _lastExecutionTime = now;

  if (!_viewer || !_viewer.camera || !_viewer.scene) return;

  // Lazy reference to Cesium (loaded at runtime)
  const Cesium = window.Cesium;
  if (!Cesium) return;

  try {
    // A) Extract camera telemetry
    const cartographic = Cesium.Cartographic.fromCartesian(
      _viewer.camera.positionWC,
    );
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const alt = cartographic.height;
    const heading = Cesium.Math.toDegrees(_viewer.camera.heading);
    const pitch = Cesium.Math.toDegrees(_viewer.camera.pitch);
    const roll = Cesium.Math.toDegrees(_viewer.camera.roll);

    let viewRectangle: CameraTelemetry["viewRectangle"] = null;
    const rect = _viewer.scene.camera.computeViewRectangle(
      _viewer.scene.globe.ellipsoid,
    );
    if (rect) {
      viewRectangle = {
        west: Cesium.Math.toDegrees(rect.west),
        south: Cesium.Math.toDegrees(rect.south),
        east: Cesium.Math.toDegrees(rect.east),
        north: Cesium.Math.toDegrees(rect.north),
      };
    }

    const telemetry: CameraTelemetry = {
      lat,
      lng,
      alt,
      heading,
      pitch,
      roll,
      viewRectangle,
    };

    // Push to Zustand transient state (no renders)
    useSimulationStore.getState().setCameraTelemetry(telemetry);

    // B) Frustum culling for POI visibility
    const visibleArray: VisiblePOI[] = [];

    if (_registeredPOIs.length > 0) {
      const cullingVolume = _viewer.scene.camera.frustum.computeCullingVolume(
        _viewer.camera.positionWC,
        _viewer.camera.directionWC,
        _viewer.camera.upWC,
      );

      for (const poi of _registeredPOIs) {
        const poiCartesian = Cesium.Cartesian3.fromDegrees(poi.lng, poi.lat, 0);
        const boundingSphere = new Cesium.BoundingSphere(poiCartesian, 50);
        const visibility = cullingVolume.computeVisibility(boundingSphere);
        if (visibility !== Cesium.Intersect.OUTSIDE) {
          visibleArray.push({
            name: poi.name,
            lat: poi.lat,
            lng: poi.lng,
            type: poi.type,
            rating: poi.rating,
          });
        }
      }
    }

    useSimulationStore.getState().setVisiblePOIs(visibleArray);

    // C) Significant change detection
    const currentVisibleSet = new Set(visibleArray.map((p) => p.name));
    let isSignificant = false;

    if (_previousBBoxCenter === null) {
      isSignificant = true;
    } else {
      const distMoved = haversineDistanceM(
        _previousBBoxCenter.lat,
        _previousBBoxCenter.lng,
        lat,
        lng,
      );
      const altDelta = Math.abs(alt - _previousAlt);

      if (distMoved > SIGNIFICANT_MOVE_M || altDelta > SIGNIFICANT_ALT_M) {
        isSignificant = true;
      }

      // Check for new POIs entering the frustum
      for (const name of currentVisibleSet) {
        if (!_previousVisibleSet.has(name)) {
          isSignificant = true;
          break;
        }
      }
    }

    if (isSignificant && _onSignificantChange) {
      _onSignificantChange(telemetry, visibleArray);
    }

    // Update previous state
    _previousBBoxCenter = { lat, lng };
    _previousAlt = alt;
    _previousVisibleSet = currentVisibleSet;
  } catch (e) {
    // Silently swallow CesiumJS errors during initialization
    console.warn("[SpatialPerception] Error in preUpdate:", e);
  }
}

// --- Public API ---

/**
 * Initialize the spatial perception engine.
 * @param viewer CesiumJS Viewer instance
 * @param onChange Callback fired when a significant camera change is detected
 */
export function initSpatialPerception(
  viewer: CesiumViewer,
  onChange?: SignificantChangeCallback,
): void {
  _viewer = viewer;
  _onSignificantChange = onChange || null;
  _lastExecutionTime = 0;
  _previousBBoxCenter = null;
  _previousAlt = 0;
  _previousVisibleSet = new Set();

  // Attach to the scene's preUpdate event
  _removeListener = viewer.scene.preUpdate.addEventListener(onPreUpdate);
  console.log(
    "[SpatialPerception] Initialized — 500ms throttle, frustum culling active.",
  );
}

/**
 * Remove all event listeners and clean up.
 */
export function destroySpatialPerception(): void {
  if (_removeListener) {
    _removeListener();
    _removeListener = null;
  }
  _viewer = null;
  _registeredPOIs = [];
  _previousBBoxCenter = null;
  _previousVisibleSet = new Set();
  console.log("[SpatialPerception] Destroyed.");
}

/**
 * Register POIs for frustum culling visibility testing.
 * Call this when new Places API results arrive.
 */
export function registerPOIs(
  pois: Array<{
    name: string;
    lat: number;
    lng: number;
    type?: string;
    rating?: number;
  }>,
): void {
  _registeredPOIs = pois.map((p) => ({
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    type: p.type || "unknown",
    rating: p.rating || 0,
  }));
  // Reset visible set to trigger re-evaluation on next frame
  _previousVisibleSet = new Set();
}

/**
 * Get the current viewer reference (for use by other sync modules).
 */
export function getViewer(): CesiumViewer | null {
  return _viewer;
}
