/**
 * POView — Trajectory Loader
 *
 * Converts a NarrationTimeline's trajectory_timestamps array into a
 * CesiumJS SampledPositionProperty with Lagrange interpolation.
 * The resulting spline can be evaluated at any audio clock time to get
 * the exact camera position.
 *
 * Also computes a SampledProperty for heading and pitch.
 */

import type { NarrationTimeline, TrajectoryTimestamp } from "@/types/simulation";

// We need to use Cesium types at runtime without importing the heavy library at build time
type CesiumViewer = any;

export interface TrajectorySpline {
  positionProperty: any; // Cesium.SampledPositionProperty
  headingProperty: any; // Cesium.SampledProperty(Number)
  pitchProperty: any; // Cesium.SampledProperty(Number)
  startJulianDate: any; // Cesium.JulianDate
  totalDurationSeconds: number;
}

/**
 * Load a NarrationTimeline's trajectory timestamps into CesiumJS
 * SampledPositionProperty splines for smooth camera interpolation.
 */
export function loadTrajectory(
  timeline: NarrationTimeline,
  viewer: CesiumViewer
): TrajectorySpline | null {
  const Cesium = (window as any).Cesium;
  if (!Cesium) {
    console.error("[TrajectoryLoader] Cesium not available on window");
    return null;
  }

  const timestamps = timeline.trajectory_timestamps;
  if (!timestamps || timestamps.length === 0) {
    console.warn("[TrajectoryLoader] No trajectory timestamps in timeline, using waypoint fallback");
    return loadFromWaypoints(timeline, Cesium);
  }

  // Start Julian date anchored to "now"
  const startJulianDate = Cesium.JulianDate.now();

  // Create the SampledPositionProperty
  const positionProperty = new Cesium.SampledPositionProperty();
  positionProperty.setInterpolationOptions({
    interpolationDegree: 3,
    interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
  });

  // Create number properties for heading and pitch
  const headingProperty = new Cesium.SampledProperty(Number);
  headingProperty.setInterpolationOptions({
    interpolationDegree: 1,
    interpolationAlgorithm: Cesium.LinearApproximation,
  });

  const pitchProperty = new Cesium.SampledProperty(Number);
  pitchProperty.setInterpolationOptions({
    interpolationDegree: 1,
    interpolationAlgorithm: Cesium.LinearApproximation,
  });

  for (const ts of timestamps) {
    const julianTime = Cesium.JulianDate.addSeconds(
      startJulianDate,
      ts.time_s,
      new Cesium.JulianDate()
    );

    const cartesian = Cesium.Cartesian3.fromDegrees(
      ts.lng,
      ts.lat,
      ts.alt
    );

    positionProperty.addSample(julianTime, cartesian);
    headingProperty.addSample(julianTime, Cesium.Math.toRadians(ts.heading));
    pitchProperty.addSample(julianTime, Cesium.Math.toRadians(ts.pitch));
  }

  const lastTimestamp = timestamps[timestamps.length - 1];
  console.log(
    `[TrajectoryLoader] Loaded ${timestamps.length} samples, ` +
    `total duration: ${lastTimestamp.time_s.toFixed(1)}s`
  );

  return {
    positionProperty,
    headingProperty,
    pitchProperty,
    startJulianDate,
    totalDurationSeconds: lastTimestamp.time_s,
  };
}

/**
 * Fallback: construct trajectory from waypoint data when dense timestamps
 * are not available.
 */
function loadFromWaypoints(
  timeline: NarrationTimeline,
  Cesium: any
): TrajectorySpline | null {
  const segments = timeline.segments;
  if (!segments || segments.length === 0) return null;

  const startJulianDate = Cesium.JulianDate.now();
  const positionProperty = new Cesium.SampledPositionProperty();
  positionProperty.setInterpolationOptions({
    interpolationDegree: 3,
    interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
  });

  const headingProperty = new Cesium.SampledProperty(Number);
  const pitchProperty = new Cesium.SampledProperty(Number);

  let cumTime = 0;

  for (const seg of segments) {
    const wp = seg.waypoint;
    const julianTime = Cesium.JulianDate.addSeconds(
      startJulianDate,
      seg.cumulative_start_time_s || cumTime,
      new Cesium.JulianDate()
    );

    const cartesian = Cesium.Cartesian3.fromDegrees(
      wp.longitude,
      wp.latitude,
      wp.altitude || 300
    );

    positionProperty.addSample(julianTime, cartesian);
    headingProperty.addSample(julianTime, Cesium.Math.toRadians(wp.heading || 0));
    pitchProperty.addSample(julianTime, Cesium.Math.toRadians(wp.pitch || -35));

    cumTime += (wp.duration || 3) + (wp.pause_after || 1) + (seg.estimated_speech_duration_s || 4);
  }

  return {
    positionProperty,
    headingProperty,
    pitchProperty,
    startJulianDate,
    totalDurationSeconds: cumTime,
  };
}
