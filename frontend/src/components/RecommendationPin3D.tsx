"use client";
import React, { useRef, useEffect, useState } from "react";
import { useCesium } from "resium";
import { Cartesian3, SceneTransforms } from "cesium";
import { PinContainer } from "@/components/ui/3d-pin";

interface RecommendationPin3DProps {
  recommendation: {
    name: string;
    rating: number;
    description?: string;
    lat: number;
    lng: number;
  };
  index: number;
}

const RecommendationPin3D = ({ recommendation, index }: RecommendationPin3DProps) => {
  const { scene } = useCesium();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!scene || !recommendation?.lat || !recommendation?.lng) return;

    const position3D = Cartesian3.fromDegrees(recommendation.lng, recommendation.lat, 20);

    const updatePosition = () => {
      if (!overlayRef.current) return;

      const canvasPosition = SceneTransforms.worldToWindowCoordinates(scene, position3D);
      if (canvasPosition) {
        overlayRef.current.style.transform = `translate(${canvasPosition.x}px, ${canvasPosition.y}px) translate(-50%, -100%)`;
        if (!isVisible) setIsVisible(true);
      } else {
        if (isVisible) setIsVisible(false);
      }
    };

    const postRenderListener = scene.postRender.addEventListener(updatePosition);
    return () => {
      postRenderListener();
    };
  }, [scene, recommendation, isVisible]);

  if (!recommendation) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute top-0 left-0 pointer-events-auto z-10"
      style={{
        display: isVisible ? "block" : "none",
        willChange: "transform",
      }}
    >
      <PinContainer
        title={recommendation.name}
        containerClassName="w-60 h-52"
      >
        <div className="flex flex-col gap-2 p-2 tracking-tight w-[10rem]">
          <h3 className="max-w-xs font-bold text-sm text-white truncate">
            {recommendation.name}
          </h3>
          <div className="flex items-center gap-1">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-cyan-400 text-xs font-mono font-bold">
              {recommendation.rating?.toFixed(1)}
            </span>
            <span className="text-white/50 text-[10px] tracking-widest uppercase">
              STARS
            </span>
          </div>
          {recommendation.description && (
            <p className="text-white/70 text-xs leading-relaxed line-clamp-3">
              {recommendation.description}
            </p>
          )}
        </div>
      </PinContainer>
    </div>
  );
};

export default RecommendationPin3D;
