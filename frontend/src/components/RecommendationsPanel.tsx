import React from "react";
import { Star, MapPin } from "lucide-react";
import { Recommendation } from "./RecommendationPin3D";
import { useSimulationStore } from "@/store/useSimulationStore";
import { AnalysisSkeleton } from "./AnalysisSkeleton";

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  onSelectRecommendation?: (rec: Recommendation) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileData?: Record<string, any>;
}

export default function RecommendationsPanel({
  recommendations,
  onSelectRecommendation,
  profileData,
}: RecommendationsPanelProps) {
  const { isAnalyzing, currentStage } = useSimulationStore(
    (state) => state.analysisState
  );

  if (isAnalyzing && (!recommendations || recommendations.length === 0)) {
    return <AnalysisSkeleton stage={currentStage} />;
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="max-h-full flex flex-col bg-slate-900/40 backdrop-blur-3xl border border-white/15 shadow-2xl rounded-[2rem] pb-2 overflow-hidden pointer-events-auto">
      {/* Header / Insights */}
      <div className="shrink-0 p-8 border-b border-white/10 bg-gradient-to-br from-white/10 to-transparent">
        {profileData && (
          <div className="mb-6 pb-6 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">
                Contextual Insight
              </h3>
              {profileData.weather && (
                <span
                  className="bg-black/30 border border-white/10 px-3 py-1.5 rounded-full text-xs font-mono font-medium text-white/90 flex items-center space-x-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] shadow-sm"
                  title={profileData.weather.ai_summary}
                >
                  <span>{profileData.weather.temperature}°F</span>
                  <span className="opacity-40">|</span>
                  <span className="truncate">
                    {profileData.weather.condition}
                  </span>
                </span>
              )}
            </div>
            <h4 className="text-white text-xl font-bold tracking-tight mb-3 drop-shadow-sm">
              {profileData.neighborhood_name}
            </h4>
            <p className="text-white font-medium text-base/relaxed drop-shadow-sm">
              {profileData.vibe_description}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Recommendations
          </h2>
          <p className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-semibold tracking-wide flex items-center shadow-sm">
            {recommendations.length}{" "}
            {recommendations.length === 1 ? "Match" : "Matches"}
          </p>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {recommendations.map((rec, index) => (
          <div
            key={index}
            onClick={() =>
              onSelectRecommendation && onSelectRecommendation(rec)
            }
            className="group relative bg-[#ffffff]/5 backdrop-blur-xl hover:bg-[#ffffff]/10 border border-white/10 hover:border-white/30 rounded-3xl p-5 shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
          >
            {/* Rank Badge */}
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-white/40 group-hover:text-white border border-white/10 group-hover:border-white/30 bg-black/20 text-xs transition-all duration-300">
              {index + 1}
            </div>

            <div className="pl-4">
              <div className="flex justify-between items-start mb-2 pr-10">
                <h3 className="text-white font-semibold text-lg tracking-tight group-hover:text-indigo-200 transition-colors duration-200">
                  {rec.name}
                </h3>
              </div>

              <p className="text-white/70 text-sm/relaxed mb-3">
                {rec.description}
              </p>

              <div className="flex items-center space-x-3 mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center space-x-1.5 bg-black/30 pl-1.5 pr-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400/50" />
                  <span className="text-white font-mono text-xs font-semibold">
                    {rec.rating.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-white/50 group-hover:text-indigo-300 transition-colors duration-200">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium tracking-wide">
                    View Location
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
