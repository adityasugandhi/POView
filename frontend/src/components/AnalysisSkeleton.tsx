import { useEffect, useState } from "react";
import { Loader2, Sparkles, ServerCog } from "lucide-react";

interface AnalysisSkeletonProps {
  stage: string | null;
}

export function AnalysisSkeleton({ stage }: AnalysisSkeletonProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none p-6 flex flex-col h-full fade-in-out">
      {/* Header Skeleton */}
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-white/10 rounded-full animate-pulse backdrop-blur-md" />
          <div className="h-8 w-48 bg-white/20 rounded-lg animate-pulse backdrop-blur-md" />
        </div>
      </div>

      {/* Vibe / Sentiment Skeleton */}
      <div className="space-y-3 mb-8">
        <div className="h-4 w-full bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-[85%] bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-[90%] bg-white/10 rounded animate-pulse" />
      </div>

      {/* Grid Features Skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl border border-white/10 animate-pulse flex flex-col justify-end p-4">
            <div className="h-3 w-16 bg-white/20 rounded mb-2" />
            <div className="h-4 w-24 bg-white/20 rounded" />
          </div>
        ))}
      </div>
      
      {/* Progress Footer */}
      <div className="mt-auto bg-black/40 backdrop-blur-xl border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20" />
            <ServerCog className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-blue-300/70 font-mono tracking-wider uppercase">System Status</span>
            <span className="text-sm text-blue-100 font-medium">
              {stage || "Initializing multi-agent protocol..."}
            </span>
          </div>
        </div>
        <div className="text-xs font-mono text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded">
          {elapsed}s
        </div>
      </div>
    </div>
  );
}
