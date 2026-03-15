"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Video,
  Globe,
  Brain,
  CloudRain,
  Zap,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

function GlassCard({ children, className = "" }: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 ${className}`}
    >
      {children}
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  return (
    <FadeIn delay={delay}>
      <GlassCard className="h-full transition-all duration-300 hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.08)]">
        <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{description}</p>
      </GlassCard>
    </FadeIn>
  );
}

const features: Omit<FeatureCardProps, "delay">[] = [
  {
    icon: <Video className="w-6 h-6" />,
    title: "Cinematic Drone Tours",
    description:
      "AI-generated camera flyovers that take you on a cinematic tour of neighborhoods, highlighting key points of interest.",
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: "Global Coverage",
    description:
      "Explore cities worldwide with Google 3D Tiles rendering, live weather data, and AI-curated local insights.",
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: "AI-Powered Insights",
    description:
      "Voice-enabled assistant powered by Gemini provides contextual intelligence about your surroundings.",
  },
  {
    icon: <CloudRain className="w-6 h-6" />,
    title: "Dynamic Environment",
    description:
      "Real-time weather effects on the 3D scene — fog, rain, snow — with contextual data overlays and recommendation markers.",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Real-Time Processing",
    description:
      "WebSocket-powered live audio streaming with instant transcription and AI response generation.",
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Smart Navigation",
    description:
      "Natural language location search with intelligent disambiguation and coordinate resolution.",
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-[150px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight"
          >
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>POView</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            <span>Launch App</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-20">
        <FadeIn>
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-white/70">
              Product Overview
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6">
            Autonomous Urban{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              Intelligence
            </span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="max-w-2xl text-lg md:text-xl text-white/50 font-light leading-relaxed mb-10">
            POView transforms how you interact with the physical world. Combine
            3D city exploration with real-time AI analysis, voice
            interaction, and contextual spatial data — all from your browser.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/"
              className="group inline-flex items-center space-x-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
            >
              <span>Launch Demo</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://github.com/adityasugandhi/POView"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <span>View on GitHub</span>
            </a>
          </div>
        </FadeIn>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <FadeIn delay={0.2}>
          <h2 className="text-2xl md:text-3xl font-bold mb-12">
            Core Capabilities
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              {...feature}
              delay={0.3 + i * 0.1}
            />
          ))}
        </div>
      </section>

      {/* Architecture Overview */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <FadeIn delay={0.2}>
          <GlassCard className="p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Choose a Location",
                  desc: "Search by name or coordinates. The AI resolves your intent into a precise map position.",
                },
                {
                  step: "02",
                  title: "Explore the View",
                  desc: "Navigate 3D city models with real-time weather effects, recommendation markers, and AI-curated local insights.",
                },
                {
                  step: "03",
                  title: "Ask the Assistant",
                  desc: "Use voice to converse naturally. The AI analyzes your location context and can search neighborhoods, recommend places, or launch drone tours.",
                },
              ].map((item) => (
                <div key={item.step}>
                  <span className="text-4xl font-black text-cyan-500/20">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-2 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to explore?
          </h2>
          <p className="text-white/50 mb-8 max-w-md mx-auto">
            Jump into the live app and experience spatial intelligence
            first-hand.
          </p>
          <Link
            href="/"
            className="group inline-flex items-center space-x-3 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
          >
            <span>Launch Demo</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs font-mono text-white/30 tracking-widest uppercase">
        POView — Autonomous Urban Intelligence
      </footer>
    </div>
  );
}
