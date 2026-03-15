/**
 * POView — Camera Sync Controller
 *
 * Attaches to CesiumJS viewer.scene.preUpdate and slaves the camera to the
 * audio clock via the trajectory spline. The camera position at any point
 * in time is: trajectorySpline.evaluate(tourStartJulianDate + audioElapsedTime)
 *
 * If audio stalls → camera freezes (by design).
 * If audio pauses → camera pauses (by design).
 *
 * The controller disables user camera inputs (mouse/keyboard) during playback
 * to prevent desynchronization.
 *
 * Performance: single SampledPositionProperty.getValue() + camera.setView() = <1ms.
 */

import { useSimulationStore } from "@/store/useSimulationStore";
import type { TrajectorySpline } from "./trajectoryLoader";

let _viewer: any = null;
let _spline: TrajectorySpline | null = null;
let _removeListener: (() => void) | null = null;
let _previousInputsEnabled = true;

/**
 * Start the camera sync controller — camera is now slaved to audio clock.
 */
export function startCameraSync(
  viewer: any,
  spline: TrajectorySpline
): void {
  _viewer = viewer;
  _spline = spline;

  const Cesium = (window as any).Cesium;
  if (!Cesium || !viewer || !spline) {
    console.error("[CameraSync] Missing dependencies");
    return;
  }

  // Disable user camera controls during playback
  _previousInputsEnabled = viewer.scene.screenSpaceCameraController.enableInputs;
  viewer.scene.screenSpaceCameraController.enableInputs = false;

  // Attach to preUpdate — runs once per render frame
  _removeListener = viewer.scene.preUpdate.addEventListener(() => {
    if (!_spline || !_viewer) return;

    const store = useSimulationStore.getState();
    const tourStatus = store.tourStatus;

    // Only control camera when tour is actively playing
    if (tourStatus !== "playing" && tourStatus !== "opening" && tourStatus !== "narrating") {
      return;
    }

    // Compute elapsed audio time since tour start
    const audioTime = store.audioPlaybackTime;
    const tourStartTime = store.tourStartAudioTime;
    const elapsed = audioTime - tourStartTime;

    if (elapsed < 0 || elapsed > _spline.totalDurationSeconds) {
      return; // Out of bounds — tour hasn't started or already ended
    }

    // Evaluate trajectory spline at the current audio-elapsed time
    const evaluationDate = Cesium.JulianDate.addSeconds(
      _spline.startJulianDate,
      elapsed,
      new Cesium.JulianDate()
    );

    const position = _spline.positionProperty.getValue(evaluationDate);
    const heading = _spline.headingProperty.getValue(evaluationDate);
    const pitch = _spline.pitchProperty.getValue(evaluationDate);

    if (position) {
      _viewer.camera.setView({
        destination: position,
        orientation: {
          heading: heading ?? 0,
          pitch: pitch ?? Cesium.Math.toRadians(-35),
          roll: 0,
        },
      });
    }
  });

  console.log(
    `[CameraSync] Started — total trajectory: ${spline.totalDurationSeconds.toFixed(1)}s, ` +
    `user inputs DISABLED`
  );
}

/**
 * Stop the camera sync controller and re-enable user inputs.
 */
export function stopCameraSync(): void {
  if (_removeListener) {
    _removeListener();
    _removeListener = null;
  }

  // Re-enable user camera controls
  if (_viewer) {
    _viewer.scene.screenSpaceCameraController.enableInputs = _previousInputsEnabled;
  }

  _spline = null;
  _viewer = null;
  console.log("[CameraSync] Stopped — user inputs RESTORED");
}

/**
 * Check if the camera sync is currently active.
 */
export function isCameraSyncActive(): boolean {
  return _removeListener !== null;
}
