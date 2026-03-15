"use client";
import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCesium } from "resium";
import { Cartesian3, SceneTransforms } from "cesium";
import { PinContainer } from "@/components/ui/3d-pin";
import {
  CardContainer,
  CardBody,
  CardItem,
} from "@/components/ui/3d-card-effect";

import type { Recommendation, PlaceReview } from "@/types/simulation";
export type { Recommendation, PlaceReview };

interface RecommendationPin3DProps {
  recommendation: Recommendation;
  index: number;
  isActive?: boolean;
  onSelect?: () => void;
}

const StarRating = ({ rating }: { rating: number }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span
        key={i}
        className={
          i <= Math.round(rating) ? "text-yellow-400" : "text-white/20"
        }
      >
        ★
      </span>,
    );
  }
  return <span className="text-[10px] flex gap-px">{stars}</span>;
};

const priceLevelToSymbol = (level: string) => {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Free",
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return map[level] || "";
};

const ImageLightbox = ({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")
        setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
      if (e.key === "ArrowRight")
        setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white/70 hover:text-white text-3xl z-[210] transition-colors"
      >
        ✕
      </button>

      {/* Photo counter */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/60 text-sm font-mono z-[210]">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Left arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
          }}
          className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-4xl z-[210] transition-colors"
        >
          ‹
        </button>
      )}

      {/* Image */}
      <Image
        src={images[currentIndex]}
        alt={`Photo ${currentIndex + 1}`}
        width={1200}
        height={800}
        unoptimized
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Right arrow */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
          }}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-4xl z-[210] transition-colors"
        >
          ›
        </button>
      )}
    </div>,
    document.body,
  );
};

const RichDetailCard = ({
  recommendation,
  onImageClick,
}: {
  recommendation: Recommendation;
  onImageClick?: (index: number) => void;
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const photos = recommendation.photoUrls || [];
  const reviews = recommendation.reviews || [];
  const priceSymbol = priceLevelToSymbol(recommendation.priceLevel || "");

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const itemWidth = 280 + 8; // image width + gap
    setActivePhotoIndex(Math.round(scrollLeft / itemWidth));
  };

  return (
    <div className="flex flex-col gap-2 w-[300px] max-h-[380px] overflow-hidden">
      {/* Image Carousel */}
      <CardItem translateZ={80} className="w-full">
        {photos.length > 0 ? (
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
            >
              {photos.map((url, i) => (
                <Image
                  key={i}
                  src={url}
                  alt={`${recommendation.name} photo ${i + 1}`}
                  width={280}
                  height={140}
                  unoptimized
                  className="w-[280px] h-[140px] object-cover rounded-lg shrink-0 snap-center cursor-pointer"
                  onClick={() => onImageClick?.(i)}
                />
              ))}
            </div>
            {photos.length > 1 && (
              <div className="flex justify-center gap-1 mt-1.5">
                {photos.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === activePhotoIndex
                        ? "bg-cyan-400 scale-125"
                        : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-[100px] rounded-lg bg-gradient-to-br from-cyan-900/40 to-purple-900/40 flex items-center justify-center">
            <span className="text-white/40 text-xs font-medium truncate px-4">
              {recommendation.name}
            </span>
          </div>
        )}
      </CardItem>

      {/* Name + Rating Row */}
      <CardItem translateZ={60} className="w-full">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-sm text-white truncate flex-1">
            {recommendation.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-cyan-400 text-xs font-mono font-bold">
              {recommendation.rating?.toFixed(1)}
            </span>
            {recommendation.ratingCount ? (
              <span className="text-white/40 text-[10px]">
                ({recommendation.ratingCount})
              </span>
            ) : null}
            {priceSymbol && (
              <span className="text-green-400/70 text-[10px] font-bold ml-1">
                {priceSymbol}
              </span>
            )}
          </div>
        </div>
      </CardItem>

      {/* Address / Phone / Website */}
      <CardItem translateZ={40} className="w-full">
        <div className="flex flex-col gap-0.5 text-[10px] text-white/50">
          {recommendation.address && (
            <span className="truncate">📍 {recommendation.address}</span>
          )}
          <div className="flex items-center gap-3">
            {recommendation.phone && <span>📞 {recommendation.phone}</span>}
            {recommendation.website && (
              <a
                href={recommendation.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400/70 hover:text-cyan-300 truncate"
                onClick={(e) => e.stopPropagation()}
              >
                🔗 {new URL(recommendation.website).hostname}
              </a>
            )}
          </div>
        </div>
      </CardItem>

      {/* Hours (collapsible) */}
      {recommendation.hours && recommendation.hours.length > 0 && (
        <CardItem translateZ={30} className="w-full">
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setHoursOpen(!hoursOpen);
              }}
              className="text-[10px] text-white/60 hover:text-white/80 flex items-center gap-1 transition-colors"
            >
              <span
                className={`transition-transform ${hoursOpen ? "rotate-90" : ""}`}
              >
                ▸
              </span>
              Hours
            </button>
            {hoursOpen && (
              <ul className="text-[9px] text-white/40 mt-1 space-y-px pl-3">
                {recommendation.hours.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </CardItem>
      )}

      {/* Reviews */}
      <CardItem translateZ={20} className="w-full">
        {reviews.length > 0 ? (
          <div className="max-h-[120px] overflow-y-auto space-y-2 scrollbar-hide">
            {reviews.map((rev, i) => (
              <div key={i} className="bg-white/5 rounded-lg p-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[10px] text-white/60 font-medium truncate">
                    {rev.authorName}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <StarRating rating={rev.rating} />
                    {rev.timeAgo && (
                      <span className="text-[9px] text-white/30">
                        {rev.timeAgo}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed line-clamp-3">
                  {rev.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-white/30 italic">No reviews yet</p>
        )}
      </CardItem>
    </div>
  );
};

const RecommendationPin3D = ({
  recommendation,
  isActive,
  onSelect,
}: RecommendationPin3DProps) => {
  const { scene } = useCesium();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const showDetail = isActive || isHovered;

  useEffect(() => {
    if (!scene || !recommendation?.lat || !recommendation?.lng) return;

    const position3D = Cartesian3.fromDegrees(
      recommendation.lng,
      recommendation.lat,
      20,
    );

    const updatePosition = () => {
      if (!overlayRef.current) return;

      const canvasPosition = SceneTransforms.worldToWindowCoordinates(
        scene,
        position3D,
      );
      if (canvasPosition) {
        overlayRef.current.style.transform = `translate(${canvasPosition.x}px, ${canvasPosition.y}px) translate(-50%, -100%)`;
        if (!isVisible) setIsVisible(true);
      } else {
        if (isVisible) setIsVisible(false);
      }
    };

    const postRenderListener =
      scene.postRender.addEventListener(updatePosition);
    return () => {
      postRenderListener();
    };
  }, [scene, recommendation, isVisible]);

  if (!recommendation) return null;

  return (
    <div
      ref={overlayRef}
      className={`absolute top-0 left-0 pointer-events-auto ${showDetail ? "z-[100]" : "z-10"}`}
      style={{
        display: isVisible ? "block" : "none",
        willChange: "transform",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Upright floating detail card — appears above the pin on hover/click */}
      {showDetail && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[110]">
          <CardContainer className="inter-var" containerClassName="py-0">
            <CardBody className="bg-black/80 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 shadow-[0_12px_48px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-bottom-2 duration-200 w-auto h-auto">
              <div onClick={(e) => e.stopPropagation()}>
                <RichDetailCard
                  recommendation={recommendation}
                  onImageClick={(index) => setLightboxIndex(index)}
                />
              </div>
            </CardBody>
          </CardContainer>
          {/* Arrow pointer */}
          <div className="flex justify-center -mt-px">
            <div className="w-3 h-3 bg-black/80 border-r border-b border-white/15 rotate-45 -translate-y-1.5" />
          </div>
        </div>
      )}

      {/* The 3D pin (always visible) */}
      <PinContainer
        title={recommendation.name}
        containerClassName="w-60 h-52"
        isActive={showDetail}
        onPinClick={onSelect}
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

      {/* Fullscreen image lightbox */}
      {lightboxIndex !== null &&
        recommendation.photoUrls &&
        recommendation.photoUrls.length > 0 && (
          <ImageLightbox
            images={recommendation.photoUrls}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
    </div>
  );
};

export default RecommendationPin3D;
