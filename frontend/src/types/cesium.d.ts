/**
 * POView — Global type declarations for CesiumJS runtime globals.
 * Cesium is loaded via script tag / CDN and accessed on `window`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  /** Minimal Cesium namespace surface used by POView sync modules. */
  interface CesiumNamespace {
    Cartographic: {
      fromCartesian(cartesian: any): {
        latitude: number;
        longitude: number;
        height: number;
      };
    };
    Math: {
      toDegrees(radians: number): number;
      toRadians(degrees: number): number;
    };
    Cartesian3: {
      fromDegrees(longitude: number, latitude: number, height?: number): any;
    };
    BoundingSphere: new (center: any, radius: number) => any;
    Intersect: { OUTSIDE: number };
    JulianDate: {
      now(): any;
      addSeconds(julianDate: any, seconds: number, result: any): any;
      new (): any;
    };
    SampledPositionProperty: new () => any;
    SampledProperty: new (type: any) => any;
    LagrangePolynomialApproximation: any;
    LinearApproximation: any;
  }

  /** Minimal Cesium Viewer surface used by POView sync modules. */
  interface CesiumViewer {
    camera: {
      positionWC: any;
      directionWC: any;
      upWC: any;
      heading: number;
      pitch: number;
      roll: number;
      position: { clone(): any };
      setView(options: any): void;
      flyTo(options: any): void;
      zoomIn(amount: number): void;
      zoomOut(amount: number): void;
      computeViewRectangle?(ellipsoid: any): any;
    };
    scene: {
      preUpdate: { addEventListener(callback: () => void): () => void };
      postRender: { addEventListener(callback: () => void): () => void };
      camera: {
        frustum: {
          computeCullingVolume(position: any, direction: any, up: any): any;
        };
        computeViewRectangle(ellipsoid: any): any;
      };
      globe: { ellipsoid: any };
      screenSpaceCameraController: { enableInputs: boolean };
      fog: { enabled: boolean; density: number };
      skyAtmosphere: {
        hueShift: number;
        saturationShift: number;
        brightnessShift: number;
      } | null;
    };
  }

  interface Window {
    Cesium: CesiumNamespace;
    cesiumViewer: CesiumViewer;
    CESIUM_BASE_URL: string;
  }
}

export {};
