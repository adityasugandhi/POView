"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight } from 'lucide-react';
import LocationSelector, { DefaultLocation } from '@/components/LocationSelector';

const Globe = dynamic(
    () => import('@/components/ui/globe').then((m) => m.Globe),
    { ssr: false }
);

interface LandingPageProps {
    onStart: (location: DefaultLocation) => void;
    defaultLocation: DefaultLocation;
    onLocationChange: (loc: DefaultLocation) => void;
}

export default function LandingPage({ onStart, defaultLocation, onLocationChange }: LandingPageProps) {
    const ctaLabel =
        defaultLocation.displayName === "New York City"
            ? "Get Started"
            : `Explore ${defaultLocation.displayName.length > 20 ? defaultLocation.displayName.slice(0, 20) + "..." : defaultLocation.displayName}`;

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-3xl">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Micro-label */}
            <div className="relative z-10 mb-6 inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="text-xs font-mono uppercase tracking-widest text-white/70">POView V5</span>
            </div>

            {/* Two-column layout: text left, globe right */}
            <div className="relative z-10 flex flex-col md:flex-row items-center w-full max-w-6xl px-6 gap-4 md:gap-8">

                {/* Left: Text content */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left md:w-1/2">
                    {/* Hero Headline */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                        Where would you like to go{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                            Today, Sir!
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-lg md:text-xl text-white/50 font-light mb-8 max-w-xl leading-relaxed">
                        Abstract intent translated into physical space. Experience a new dimension of contextual spatial intelligence.
                    </p>

                    {/* Location Selector */}
                    <div className="mb-8 w-full max-w-md">
                        <LocationSelector value={defaultLocation} onChange={onLocationChange} />
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={() => onStart(defaultLocation)}
                        className="group relative inline-flex items-center justify-center px-8 py-4 space-x-3 text-sm font-semibold tracking-wide text-white transition-all duration-500 bg-white/10 border border-white/20 rounded-full hover:bg-white/20 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] backdrop-blur-md overflow-hidden"
                    >
                        <span className="relative z-10">{ctaLabel}</span>
                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform duration-300" />

                        {/* Hover Effect Background */}
                        <div className="absolute inset-0 w-full h-full -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    </button>
                </div>

                {/* Right: Globe */}
                <div className="relative w-full md:w-1/2 aspect-square max-w-[500px]">
                    <Globe className="opacity-85" />
                </div>
            </div>

            {/* Footer / Copyright */}
            <div className="absolute bottom-8 text-xs font-mono text-white/30 tracking-widest uppercase">
                Initiating Global Grid
            </div>
        </div>
    );
}
