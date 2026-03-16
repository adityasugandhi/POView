"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  Workflow,
  Code,
  Radio,
  Database,
  Search,
  GitBranch,
  AudioLines,
  Wrench,
  Globe,
  Mic,
  MapPin,
  ChevronRight,
  ExternalLink,
  Cpu,
  Layers,
} from "lucide-react";
import { InteractiveGridPattern } from "@/components/ui/interactive-grid-pattern";
import { IconCloud } from "@/components/ui/icon-cloud";

/* ─── Helper Components ─── */

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
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

function SectionHeading({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-12">
      <FadeIn>
        <span className="inline-block mb-4 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-mono uppercase tracking-widest text-cyan-400">
          {label}
        </span>
      </FadeIn>
      <FadeIn delay={0.1}>
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3">
          {title}
        </h2>
      </FadeIn>
      {subtitle && (
        <FadeIn delay={0.15}>
          <p className="max-w-2xl text-white/50 leading-relaxed">{subtitle}</p>
        </FadeIn>
      )}
    </div>
  );
}

function StatCard({
  value,
  label,
  detail,
  delay,
}: {
  value: string;
  label: string;
  detail: string;
  delay: number;
}) {
  return (
    <FadeIn delay={delay}>
      <div className="text-center p-4">
        <div className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
          {value}
        </div>
        <div className="text-sm font-semibold text-white mt-1">{label}</div>
        <div className="text-xs text-white/40 mt-0.5">{detail}</div>
      </div>
    </FadeIn>
  );
}

function TechBadge({
  children,
  color = "cyan",
}: {
  children: React.ReactNode;
  color?: "cyan" | "blue" | "purple" | "green" | "orange" | "pink";
}) {
  const colors = {
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
    blue: "border-blue-400/30 bg-blue-400/10 text-blue-400",
    purple: "border-purple-400/30 bg-purple-400/10 text-purple-400",
    green: "border-green-400/30 bg-green-400/10 text-green-400",
    orange: "border-orange-400/30 bg-orange-400/10 text-orange-400",
    pink: "border-pink-400/30 bg-pink-400/10 text-pink-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

/* ─── Main Page ─── */

const techLogos = [
  "https://cdn.simpleicons.org/google/4285F4",
  "https://cdn.simpleicons.org/nextdotjs/ffffff",
  "https://cdn.simpleicons.org/react/61DAFB",
  "https://cdn.simpleicons.org/typescript/3178C6",
  "https://cdn.simpleicons.org/python/3776AB",
  "https://cdn.simpleicons.org/fastapi/009688",
  "https://cdn.simpleicons.org/redis/DC382D",
  "https://cdn.simpleicons.org/tailwindcss/06B6D4",
  "https://cdn.simpleicons.org/cesium/6CADDF",
  "https://cdn.simpleicons.org/googlemaps/4285F4",
  "https://cdn.simpleicons.org/googlechrome/4285F4",
  "https://cdn.simpleicons.org/webrtc/333333",
  "https://cdn.simpleicons.org/framer/0055FF",
  "https://cdn.simpleicons.org/vercel/ffffff",
];

export default function DemoPage() {
  const stats = [
    { value: "4", label: "ADK Agents", detail: "3 Pipeline + 1 Voice Agent" },
    {
      value: "5",
      label: "Gemini Models",
      detail: "Pro + Flash + Native Audio",
    },
    {
      value: "6+",
      label: "Google APIs",
      detail: "Places, Routes, Geocoding, 3D Tiles, Gemini, Search",
    },
    { value: "BIDI", label: "Audio Streaming", detail: "Real-time WebSocket" },
    { value: "<8s", label: "Pipeline Latency", detail: "3 agents, end-to-end" },
    {
      value: "16kHz",
      label: "Audio Capture",
      detail: "24kHz Playback via AudioWorklet",
    },
  ];

  const adkFeatures = [
    {
      icon: <Workflow className="w-5 h-5" />,
      badge: "Orchestration",
      badgeColor: "cyan" as const,
      title: "Sequential Agent Pipeline",
      description:
        "Three specialized AI agents execute in a strict sequence — research, planning, then formatting — guaranteeing consistent, high-quality results every time.",
      docUrl:
        "https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/",
    },
    {
      icon: <Code className="w-5 h-5" />,
      badge: "Custom Agent",
      badgeColor: "purple" as const,
      title: "Custom Flight Planning Agent",
      description:
        "A purpose-built agent that computes cinematic drone camera paths, fetching multiple walking routes simultaneously to create fluid, real-world flyover experiences.",
      docUrl: "https://google.github.io/adk-docs/agents/custom-agents/",
    },
    {
      icon: <Radio className="w-5 h-5" />,
      badge: "Streaming",
      badgeColor: "green" as const,
      title: "Bidirectional Audio Streaming",
      description:
        "Users speak naturally and hear responses instantly through a persistent two-way audio connection — no button presses, no waiting for transcription.",
      docUrl: "https://google.github.io/adk-docs/streaming/",
    },
    {
      icon: <Database className="w-5 h-5" />,
      badge: "State",
      badgeColor: "blue" as const,
      title: "Shared Agent Memory",
      description:
        "Every agent reads from and writes to a shared session, so the formatter knows exactly what the researcher found and the planner computed — zero information loss between stages.",
      docUrl: "https://google.github.io/adk-docs/sessions/state/",
    },
    {
      icon: <Search className="w-5 h-5" />,
      badge: "Grounding",
      badgeColor: "orange" as const,
      title: "Real-Time Web Grounding",
      description:
        "The research agent pulls live data from the web to ground its analysis in current facts — not stale training data — delivering up-to-the-minute neighborhood insights.",
      docUrl: "https://google.github.io/adk-docs/tools-custom/function-tools/",
    },
    {
      icon: <GitBranch className="w-5 h-5" />,
      badge: "Events",
      badgeColor: "pink" as const,
      title: "Event-Driven State Updates",
      description:
        "Agents publish structured updates as they work, letting the system track progress and pass rich data between pipeline stages without manual wiring.",
      docUrl: "https://google.github.io/adk-docs/runtime/event-loop/",
    },
    {
      icon: <AudioLines className="w-5 h-5" />,
      badge: "Audio",
      badgeColor: "green" as const,
      title: "Native Voice AI",
      description:
        "A dedicated Gemini model handles speech input and output natively — no separate speech-to-text or text-to-speech services — reducing latency and preserving conversational tone.",
      docUrl: "https://google.github.io/adk-docs/streaming/",
    },
    {
      icon: <Wrench className="w-5 h-5" />,
      badge: "Tools",
      badgeColor: "cyan" as const,
      title: "Voice-Activated Capabilities",
      description:
        "The voice assistant can search neighborhoods, surface personalized recommendations, and launch cinematic drone tours — all triggered by natural conversation.",
      docUrl: "https://google.github.io/adk-docs/tools-custom/function-tools/",
    },
  ];

  const googleAPIs = [
    {
      name: "Google Places API (New)",
      detail: "Autocomplete, nearby search, text search, place details",
    },
    {
      name: "Google Routes API v2",
      detail: "Walking directions + polyline encoding",
    },
    { name: "Google Geocoding API", detail: "Reverse geocoding for lat/lng" },
    {
      name: "Google 3D Map Tiles",
      detail: "Photorealistic rendering via CesiumJS",
    },
    {
      name: "Gemini API",
      detail:
        "5 model variants: gemini-2.5-pro, gemini-2.5-flash, native-audio-preview, gemini-3.1-pro-preview",
    },
    {
      name: "Google Search (ADK)",
      detail: "Grounding tool for ScriptWriterAgent",
    },
  ];

  const demoSteps = [
    {
      step: "01",
      title: "Location Resolution",
      tech: "Places Autocomplete → place_id → Details → lat/lng",
      description:
        "User searches via Google Places Autocomplete. The resolved place_id is used to fetch full details including coordinates, which populate session state.",
      stateKeys: ["origin_lat", "origin_lng"],
      docUrl: "https://google.github.io/adk-docs/sessions/state/",
    },
    {
      step: "02",
      title: "Data Aggregation",
      tech: "asyncio.gather(nearby_places, weather)",
      description:
        "Parallel fetches for nearby places and live weather data. Results are merged into context_payload and weather_summary session keys.",
      stateKeys: ["context_payload", "weather_summary"],
      docUrl: "https://google.github.io/adk-docs/sessions/state/",
    },
    {
      step: "03",
      title: "ScriptWriter Agent",
      tech: "LlmAgent + gemini-2.5-pro + google_search",
      description:
        "Generates a rich urban analysis narrative grounded with real-time web search. Temperature 0.5 for balanced creativity and accuracy.",
      stateKeys: ["raw_narrative"],
      docUrl: "https://google.github.io/adk-docs/agents/llm-agents/",
    },
    {
      step: "04",
      title: "GlobeController Agent",
      tech: "BaseAgent + gemini-2.5-flash + asyncio.gather(routes)",
      description:
        "Custom BaseAgent computes camera waypoints, fetches walking routes in parallel, and builds a complete drone flight plan with POI markers.",
      stateKeys: ["visualization_plan"],
      docUrl: "https://google.github.io/adk-docs/agents/custom-agents/",
    },
    {
      step: "05",
      title: "Formatter Agent",
      tech: "LlmAgent + output_schema=NeighborhoodProfile",
      description:
        "Combines raw_narrative and visualization_plan into a structured NeighborhoodProfile JSON. Temperature 0.1 for deterministic output.",
      stateKeys: ["final_ui_payload"],
      docUrl: "https://google.github.io/adk-docs/agents/llm-agents/",
    },
    {
      step: "06",
      title: "3D Visualization",
      tech: "CesiumJS + Google 3D Map Tiles + Weather Effects",
      description:
        "Frontend consumes final_ui_payload to render: drone camera animation, POI markers, weather particle effects, and narration overlay.",
      stateKeys: [],
    },
  ];

  const techStack = [
    {
      category: "AI / ML",
      icon: <Cpu className="w-5 h-5" />,
      items: [
        {
          label: "Google ADK (Agent Development Kit)",
          url: "https://google.github.io/adk-docs/",
        },
        {
          label: "Gemini 2.5 Pro",
          url: "https://google.github.io/adk-docs/agents/llm-agents/",
        },
        {
          label: "Gemini 2.5 Flash",
          url: "https://google.github.io/adk-docs/agents/llm-agents/",
        },
        {
          label: "Gemini Native Audio",
          url: "https://google.github.io/adk-docs/streaming/",
        },
        {
          label: "SequentialAgent / BaseAgent",
          url: "https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/",
        },
        {
          label: "google_search grounding",
          url: "https://google.github.io/adk-docs/tools-custom/function-tools/",
        },
      ],
    },
    {
      category: "Backend",
      icon: <Layers className="w-5 h-5" />,
      items: [
        { label: "Python FastAPI" },
        {
          label: "WebSocket BIDI streaming",
          url: "https://google.github.io/adk-docs/streaming/",
        },
        { label: "asyncio + gather" },
        {
          label: "InMemorySessionService",
          url: "https://google.github.io/adk-docs/sessions/state/",
        },
        {
          label: "LiveRequestQueue",
          url: "https://google.github.io/adk-docs/streaming/",
        },
        {
          label: "RunConfig + Runner",
          url: "https://google.github.io/adk-docs/runtime/configuration/",
        },
      ],
    },
    {
      category: "Frontend",
      icon: <Globe className="w-5 h-5" />,
      items: [
        { label: "Next.js 15 + React 19" },
        { label: "CesiumJS + 3D Tiles" },
        { label: "AudioWorklet (16kHz / 24kHz)" },
        { label: "Framer Motion" },
        { label: "Tailwind CSS" },
        { label: "TypeScript" },
      ],
    },
    {
      category: "Google APIs",
      icon: <MapPin className="w-5 h-5" />,
      items: [
        { label: "Places API (New)" },
        { label: "Routes API v2" },
        { label: "Geocoding API" },
        { label: "3D Map Tiles API" },
        { label: "Gemini API" },
        {
          label: "Google Search (ADK)",
          url: "https://google.github.io/adk-docs/tools-custom/function-tools/",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-purple-600/3 rounded-full blur-[150px]" />
      </div>

      {/* Interactive Grid Pattern Background */}
      <div className="fixed inset-0 z-[1] overflow-hidden opacity-40">
        <InteractiveGridPattern
          width={48}
          height={48}
          squares={[40, 30]}
          className="border-none stroke-white/[0.04] [&>rect]:stroke-white/[0.04]"
          squaresClassName="hover:fill-cyan-400/10"
        />
      </div>

      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center space-x-2 text-white font-bold text-lg tracking-tight"
            >
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span>POView</span>
            </Link>
            <TechBadge color="green">Built with Google ADK</TechBadge>
          </div>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            <span>Launch App</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-16">
        <FadeIn>
          <div className="mb-6 inline-flex items-center space-x-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              Google ADK Hackathon 2025
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              Multi-Agent
            </span>{" "}
            Urban Intelligence
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p className="max-w-3xl text-lg md:text-xl text-white/50 font-light leading-relaxed mb-10">
            An Agent ADK pipeline that transforms any location into a narrated,
            scored, 3D drone-flyover experience — powered by Gemini models,
            the Gemini Live API for real-time voice interaction, and Google 3D Map Tiles.
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
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href="#architecture"
              className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              <span>Architecture</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </FadeIn>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <FadeIn>
          <GlassCard className="p-2 md:p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-white/5">
              {stats.map((stat, i) => (
                <StatCard key={stat.label} {...stat} delay={0.1 + i * 0.08} />
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </section>

      {/* ─── How It Works — Pipeline Diagram ─── */}
      <section
        id="architecture"
        className="relative z-10 mx-auto max-w-6xl px-6 pb-24"
      >
        <SectionHeading
          label="Architecture"
          title="How It Works"
          subtitle="The autonomous intelligence pipeline powering POView."
        />

        {/* Main Pipeline Card */}
        <FadeIn delay={0.1}>
          <GlassCard className="p-8 md:p-10">
            {/* ── Desktop horizontal pipeline ── */}
            <div className="hidden lg:flex items-center justify-between gap-4">
              {/* User Input */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/50"
                  >
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                </div>
                <span className="text-xs text-white/50 font-medium">
                  User Input
                </span>
              </div>

              {/* Arrow */}
              <div className="flex items-center flex-shrink-0">
                <div className="h-px w-8 bg-white/20" />
                <ChevronRight className="w-4 h-4 text-white/20 -ml-1" />
              </div>

              {/* Intent Parsing */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-cyan-400" />
                </div>
                <span className="text-xs font-bold text-cyan-400">
                  Intent Parsing
                </span>
                <span className="text-[10px] text-white/40">
                  (Gemini Flash)
                </span>
              </div>

              {/* Arrow */}
              <div className="flex items-center flex-shrink-0">
                <div className="h-px w-8 bg-white/20" />
                <ChevronRight className="w-4 h-4 text-white/20 -ml-1" />
              </div>

              {/* 3-Agent ADK Pipeline Box */}
              <div className="relative flex-1 max-w-[480px] rounded-2xl border-2 border-dashed border-cyan-400/30 px-6 py-6">
                <a
                  href="https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute -top-3 left-6 bg-black px-3 text-[11px] font-mono font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                >
                  3-Agent ADK Pipeline
                  <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center justify-between gap-3">
                  {/* ScriptWriter */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl border border-purple-400/30 bg-purple-400/10 flex items-center justify-center">
                      <Code className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-[11px] text-white/60 font-medium">
                      ScriptWriter
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center flex-shrink-0">
                    <div className="h-px w-6 bg-white/15" />
                    <ChevronRight className="w-3 h-3 text-white/15 -ml-1" />
                  </div>

                  {/* GlobeController */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl border border-purple-400/30 bg-purple-400/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-[11px] text-white/60 font-medium">
                      GlobeController
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center flex-shrink-0">
                    <div className="h-px w-6 bg-white/15" />
                    <ChevronRight className="w-3 h-3 text-white/15 -ml-1" />
                  </div>

                  {/* Formatter */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-xl border border-purple-400/30 bg-purple-400/10 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-[11px] text-white/60 font-medium">
                      Formatter
                    </span>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center flex-shrink-0">
                <div className="h-px w-8 bg-white/20" />
                <ChevronRight className="w-4 h-4 text-white/20 -ml-1" />
              </div>

              {/* 3D Visualization */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <Layers className="w-6 h-6 text-white/50" />
                </div>
                <span className="text-xs text-white/50 font-medium">
                  3D Visualization
                </span>
              </div>
            </div>

            {/* ── Mobile vertical pipeline ── */}
            <div className="lg:hidden flex flex-col items-center gap-4">
              {/* User Input */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/50"
                  >
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                </div>
                <span className="text-sm text-white/50 font-medium">
                  User Input
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 rotate-90" />

              {/* Intent Parsing */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="text-sm font-bold text-cyan-400">
                    Intent Parsing
                  </span>
                  <span className="block text-[11px] text-white/40">
                    (Gemini Flash)
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 rotate-90" />

              {/* 3-Agent Pipeline Box */}
              <div className="relative w-full max-w-xs rounded-2xl border-2 border-dashed border-cyan-400/30 px-5 py-6">
                <a
                  href="https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute -top-3 left-4 bg-black px-2 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
                >
                  3-Agent ADK Pipeline
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <div className="flex flex-col items-center gap-3">
                  {[
                    {
                      icon: <Code className="w-5 h-5 text-purple-400" />,
                      name: "ScriptWriter",
                    },
                    {
                      icon: <Globe className="w-5 h-5 text-purple-400" />,
                      name: "GlobeController",
                    },
                    {
                      icon: <Layers className="w-5 h-5 text-purple-400" />,
                      name: "Formatter",
                    },
                  ].map((agent, idx) => (
                    <React.Fragment key={agent.name}>
                      {idx > 0 && (
                        <ChevronRight className="w-3 h-3 text-white/15 rotate-90" />
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg border border-purple-400/30 bg-purple-400/10 flex items-center justify-center">
                          {agent.icon}
                        </div>
                        <span className="text-xs text-white/60 font-medium">
                          {agent.name}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 rotate-90" />

              {/* 3D Visualization */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white/50" />
                </div>
                <span className="text-sm text-white/50 font-medium">
                  3D Visualization
                </span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* ── Voice Agent — Gemini Live API ── */}
        <FadeIn delay={0.3}>
          <div className="mt-8">
            <GlassCard className="p-8 md:p-10 border-green-400/20">
              <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Left — Icon + Label */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl border border-green-400/30 bg-green-400/10 flex items-center justify-center">
                      <Mic className="w-7 h-7 text-green-400" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                    </span>
                  </div>
                  <span className="text-sm font-bold text-green-400">
                    Voice Agent
                  </span>
                  <a
                    href="https://google.github.io/adk-docs/streaming/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <TechBadge color="green">Gemini Live API ↗</TechBadge>
                  </a>
                </div>

                {/* Right — Description + flow */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Real-Time Conversational AI via Gemini Live API
                  </h3>
                  <p className="text-sm text-white/50 leading-relaxed mb-5">
                    A dedicated voice agent runs in parallel with the main
                    pipeline, powered by the Gemini Live API for bidirectional
                    audio streaming. Users speak naturally and the agent
                    responds instantly — searching neighborhoods, surfacing
                    recommendations, and launching drone tours, all through
                    natural conversation with zero latency.
                  </p>

                  {/* Mini pipeline */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <AudioLines className="w-4 h-4 text-green-400/70" />
                      <span className="text-[11px] text-white/50 font-mono">
                        16kHz Mic Input
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/20 hidden sm:block" />
                    <div className="flex items-center gap-2 rounded-xl border border-green-400/20 bg-green-400/5 px-3 py-2">
                      <Radio className="w-4 h-4 text-green-400/70" />
                      <span className="text-[11px] text-green-400/70 font-mono">
                        WebSocket BIDI Stream
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/20 hidden sm:block" />
                    <div className="flex items-center gap-2 rounded-xl border border-green-400/20 bg-green-400/5 px-3 py-2">
                      <Sparkles className="w-4 h-4 text-green-400/70" />
                      <span className="text-[11px] text-green-400/70 font-mono">
                        Gemini Native Audio
                      </span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/20 hidden sm:block" />
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <AudioLines className="w-4 h-4 text-green-400/70" />
                      <span className="text-[11px] text-white/50 font-mono">
                        24kHz Playback
                      </span>
                    </div>
                  </div>

                  {/* Tool badges */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-[10px] text-white/30 font-mono mr-1 self-center">
                      tools:
                    </span>
                    <TechBadge color="cyan">search_neighborhood</TechBadge>
                    <TechBadge color="cyan">get_recommendations</TechBadge>
                    <TechBadge color="cyan">start_drone_tour</TechBadge>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </FadeIn>

        {/* Session State Bar */}
        <FadeIn delay={0.5}>
          <div className="mt-8">
            <GlassCard className="p-4">
              <div className="text-xs font-mono text-white/40 mb-3 flex items-center gap-2">
                <Database className="w-3 h-3" />
                <a
                  href="https://google.github.io/adk-docs/sessions/state/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white/60 transition-colors inline-flex items-center gap-1"
                >
                  InMemorySessionService — Shared State Keys
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "origin_lat", rw: "R" },
                  { key: "origin_lng", rw: "R" },
                  { key: "context_payload", rw: "R" },
                  { key: "weather_summary", rw: "R" },
                  { key: "intent", rw: "R" },
                  { key: "raw_narrative", rw: "W→R" },
                  { key: "visualization_plan", rw: "W→R" },
                  { key: "final_ui_payload", rw: "W" },
                  { key: "voice_session", rw: "W" },
                ].map((item) => (
                  <span
                    key={item.key}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono ${
                      item.rw.includes("W")
                        ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-400"
                        : "border-white/10 bg-white/5 text-white/50"
                    }`}
                  >
                    {item.key}{" "}
                    <span className="text-[9px] opacity-60">({item.rw})</span>
                  </span>
                ))}
              </div>
            </GlassCard>
          </div>
        </FadeIn>
      </section>

      {/* ─── ADK Features Deep Dive ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading
          label="What Makes It Special"
          title="Key Capabilities"
          subtitle="Eight distinct AI features working together to deliver an experience no single model could achieve alone."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adkFeatures.map((feature, i) => (
            <FadeIn key={feature.title} delay={0.1 + i * 0.08}>
              <GlassCard className="h-full transition-all duration-300 hover:border-cyan-400/30 hover:shadow-[0_0_30px_rgba(34,211,238,0.06)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400">
                    {feature.icon}
                  </div>
                  <TechBadge color={feature.badgeColor}>
                    {feature.badge}
                  </TechBadge>
                </div>
                <h3 className="text-base font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {feature.description}
                </p>
                {feature.docUrl && (
                  <a
                    href={feature.docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-xs font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
                  >
                    View ADK Docs
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Live Voice Agent Showcase ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading
          label="Live Voice"
          title="Real-Time Voice Agent"
          subtitle="Bidirectional audio streaming via ADK's LiveRequestQueue and Gemini Native Audio."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left - Technical Flow */}
          <FadeIn delay={0.1}>
            <GlassCard className="h-full">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5 text-cyan-400" />
                Audio Pipeline
              </h3>
              <div className="space-y-4">
                {[
                  {
                    label: "Capture",
                    detail: "AudioWorklet captures 16kHz PCM from microphone",
                  },
                  {
                    label: "Transport",
                    detail:
                      "WebSocket sends audio blobs → LiveRequestQueue.send_realtime()",
                  },
                  {
                    label: "Processing",
                    detail:
                      "Runner.run_live() streams to Gemini Native Audio model",
                  },
                  {
                    label: "Tool Calls",
                    detail:
                      "Agent invokes search_neighborhood / get_recommendations / start_drone_tour",
                  },
                  {
                    label: "Response",
                    detail:
                      "Audio response at 24kHz streamed back via WebSocket",
                  },
                  {
                    label: "Playback",
                    detail:
                      "Frontend AudioWorklet plays response audio in real-time",
                  },
                ].map((item, i) => (
                  <div key={item.label} className="flex gap-3">
                    <span className="text-xs font-mono text-cyan-400/60 w-20 flex-shrink-0 pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {item.label}
                      </span>
                      <p className="text-xs text-white/40 mt-0.5">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </FadeIn>

          {/* Right - Visual badges */}
          <FadeIn delay={0.2}>
            <GlassCard className="h-full">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-green-400" />
                Technical Specs
              </h3>
              <div className="space-y-5">
                <div>
                  <div className="text-xs text-white/40 font-mono mb-2">
                    Streaming Mode
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TechBadge color="green">BIDI</TechBadge>
                    <TechBadge color="cyan">AudioWorklet</TechBadge>
                    <TechBadge color="blue">WebSocket</TechBadge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 font-mono mb-2">
                    Audio Config
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TechBadge color="purple">16kHz Input</TechBadge>
                    <TechBadge color="purple">24kHz Output</TechBadge>
                    <TechBadge color="orange">PCM Blobs</TechBadge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 font-mono mb-2">
                    Model
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TechBadge color="green">
                      gemini-2.5-flash-native-audio-preview
                    </TechBadge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 font-mono mb-2">
                    Custom Tools
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TechBadge color="cyan">search_neighborhood</TechBadge>
                    <TechBadge color="cyan">get_recommendations</TechBadge>
                    <TechBadge color="cyan">start_drone_tour</TechBadge>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-white/40 font-mono mb-2">
                    <a
                      href="https://google.github.io/adk-docs/runtime/configuration/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white/60 transition-colors inline-flex items-center gap-1"
                    >
                      RunConfig
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <code className="block text-[11px] font-mono text-green-400/60 bg-black/30 rounded-lg px-3 py-2">
                    {`response_modalities=["AUDIO"]\ninput_audio_transcription=enabled\noutput_audio_transcription=enabled`}
                  </code>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        </div>
      </section>

      {/* ─── Google APIs Integration ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading
          label="Google APIs"
          title="Platform Integration"
          subtitle="6+ Google APIs powering location intelligence, 3D rendering, and AI reasoning."
        />

        <FadeIn delay={0.1}>
          <GlassCard>
            <div className="divide-y divide-white/5">
              {googleAPIs.map((api, i) => (
                <div
                  key={api.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-cyan-400/40 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {api.name}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 sm:text-right pl-9 sm:pl-0">
                    {api.detail}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>
      </section>

      {/* ─── Technical Demo Flow (Timeline) ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading
          label="Pipeline"
          title="End-to-End Demo Flow"
          subtitle="6 steps from location search to 3D drone flyover, orchestrated by ADK's SequentialAgent."
        />

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400/40 via-blue-500/40 to-transparent hidden md:block" />

          <div className="space-y-8">
            {demoSteps.map((step, i) => (
              <FadeIn key={step.step} delay={0.1 + i * 0.1}>
                <div className="flex gap-6">
                  {/* Step number */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-400/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-cyan-400">
                      {step.step}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <h3 className="text-lg font-bold text-white mb-1">
                      {step.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[11px] font-mono text-cyan-400/60">
                        {step.tech}
                      </code>
                      {step.docUrl && (
                        <a
                          href={step.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/40 hover:text-cyan-400 transition-colors"
                        >
                          docs
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-white/50 leading-relaxed mt-2">
                      {step.description}
                    </p>
                    {step.stateKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        <span className="text-[10px] font-mono text-white/30">
                          writes →
                        </span>
                        {step.stateKeys.map((key) => (
                          <span
                            key={key}
                            className="rounded border border-cyan-400/20 bg-cyan-400/5 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400/70"
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Tech Stack ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <SectionHeading label="Tech Stack" title="Built With" />

        <FadeIn>
          <div className="flex justify-center mb-16">
            <div className="relative">
              <IconCloud images={techLogos} />
              <div className="absolute inset-0 rounded-full bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
            </div>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {techStack.map((column, i) => (
            <FadeIn key={column.category} delay={0.1 + i * 0.1}>
              <GlassCard className="h-full">
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-cyan-400">{column.icon}</div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {column.category}
                  </h3>
                </div>
                <ul className="space-y-2">
                  {column.items.map((item) => (
                    <li
                      key={item.label}
                      className="text-sm text-white/50 flex items-start gap-2"
                    >
                      <ChevronRight className="w-3 h-3 text-cyan-400/40 mt-1 flex-shrink-0" />
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white/70 transition-colors inline-flex items-center gap-1"
                        >
                          {item.label}
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-40" />
                        </a>
                      ) : (
                        item.label
                      )}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">See It Live</h2>
          <p className="text-white/50 mb-8 max-w-lg mx-auto">
            Watch the multi-agent pipeline transform any location in real-time —
            from search to 3D drone flyover in under 8 seconds.
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

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs font-mono text-white/30 tracking-widest uppercase">
        POView — Built with Google ADK, Gemini, and Google Maps Platform
      </footer>
    </div>
  );
}
