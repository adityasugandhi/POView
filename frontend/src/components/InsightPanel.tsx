"use client";
import React from "react";
import {
  MapPin,
  Coffee,
  Utensils,
  Train,
  Shield,
  DollarSign,
  Building,
  type LucideIcon,
} from "lucide-react";
import type {
  NeighborhoodProfile,
  ScoreDetail,
  Highlight,
} from "@/types/simulation";

// Lucide mapping specifically requested as emojis are forbidden
const IconMap: Record<string, LucideIcon> = {
  waterfront: MapPin,
  dining: Utensils,
  food: Utensils,
  coffee: Coffee,
  cafe: Coffee,
  transit: Train,
  infrastructure: Building,
  safety: Shield,
  cost: DollarSign,
  affordability: DollarSign,
  default: MapPin,
};

export default function InsightPanel({
  profileData,
}: {
  profileData: NeighborhoodProfile;
}) {
  if (!profileData)
    return (
      <div className="p-8 text-white/50 h-full flex flex-col justify-center items-center text-center bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl">
        <Building className="w-16 h-16 text-white/20 mb-6 drop-shadow-md inline-block" />
        <h2 className="text-xl font-medium tracking-wider text-white">
          No Location Selected
        </h2>
        <p className="text-gray-400 mt-2 tracking-wide">
          Enter a location or Places ID to generate insights.
        </p>
      </div>
    );

  return (
    <div className="p-8 bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] rounded-3xl text-slate-100 h-full overflow-y-auto w-full scroll-smooth">
      <h1 className="text-4xl font-bold tracking-wider text-white mb-2 drop-shadow-sm">
        {profileData.neighborhood_name}
      </h1>
      <p className="text-lg font-medium text-cyan-300 mb-8 tracking-wide drop-shadow-sm">
        {profileData.tagline}
      </p>

      <div className="mb-8">
        <h2 className="text-sm uppercase tracking-widest text-white/60 font-semibold mb-3">
          Atmosphere
        </h2>
        <p className="text-gray-300 leading-relaxed text-base">
          {profileData.vibe_description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-10">
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl shadow-inner">
          <h3 className="font-semibold text-white tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] block"></span>{" "}
            Best For
          </h3>
          <ul className="list-none text-sm text-gray-300 space-y-2">
            {profileData.best_for.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl shadow-inner">
          <h3 className="font-semibold text-white tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] block"></span>{" "}
            Not Ideal For
          </h3>
          <ul className="list-none text-sm text-gray-300 space-y-2">
            {profileData.not_ideal_for.map((item: string, idx: number) => (
              <li key={idx} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-white/60 font-semibold mb-4">
          Lifestyle Scores
        </h2>
        <div className="space-y-4">
          {Object.entries(profileData.scores).map(
            ([key, scoreObj]: [string, ScoreDetail]) => (
              <div
                key={key}
                className="flex flex-col bg-white/5 border border-white/10 p-5 rounded-2xl transition-all hover:bg-white/10"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="capitalize font-medium text-white tracking-wide">
                    {key.replace("_", " ")}
                  </span>
                  <span className="font-bold text-cyan-300 tracking-wider">
                    {scoreObj.value}/10
                  </span>
                </div>
                <div className="w-full bg-white/10 h-[2px] rounded-full mb-3 overflow-hidden">
                  <div
                    className="bg-cyan-400 h-[2px] rounded-full shadow-[0_0_10px_rgba(34,211,238,1)] transition-all duration-1000"
                    style={{ width: `${(scoreObj.value / 10) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {scoreObj.note}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-sm uppercase tracking-widest text-white/60 font-semibold mb-4">
          Highlights
        </h2>
        <div className="space-y-5">
          {profileData.highlights.map((hlt: Highlight, idx: number) => {
            const Icon = IconMap[hlt.icon_identifier] || IconMap.default;
            return (
              <div
                key={idx}
                className="flex items-start space-x-4 bg-white/5 border border-white/10 p-5 rounded-2xl transition hover:bg-white/10"
              >
                <div className="p-3 bg-white/5 shadow-inner rounded-xl flex-shrink-0 mt-0.5 border border-white/10">
                  <Icon className="w-5 h-5 text-cyan-300 drop-shadow-md" />
                </div>
                <div>
                  <h4 className="font-semibold text-white tracking-wide mb-1">
                    {hlt.title}
                  </h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {hlt.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 bg-cyan-900/20 border border-cyan-500/30 p-6 rounded-2xl backdrop-blur-md shadow-inner">
        <h3 className="text-xs uppercase tracking-widest text-cyan-400 font-semibold mb-2">
          Insider Tip
        </h3>
        <p className="text-base text-cyan-50 leading-relaxed font-medium">
          {profileData.insider_tip}
        </p>
      </div>
    </div>
  );
}
