# POView
**Autonomous Urban Intelligence & Spatial Telemetry**

POView is a next-generation analytical platform that merges an immersive 3D geospatial engine with a conversational AI voice assistant. Built on Google's Gemini Live API and the Agent Development Kit (ADK), POView enables users to explore neighborhoods through cinematic drone flyovers, natural voice dialogue, and real-time AI-powered neighborhood profiling.

## Key Features

* **Voice-Powered Exploration:** A real-time voice assistant (Gemini Live API over WebSocket) lets users discover neighborhoods through natural conversation. Ask about a place and POView flies you there with cinematic camera work.
* **Cinematic Drone Flyovers:** Three-phase camera sequences — high orbit, sweeping approach, and street-level arrival — create an immersive exploration experience for every location.
* **Narrated Tours:** AI-generated guided tours with synchronized camera movements, narration timelines, and contextual commentary about each point of interest.
* **Neighborhood Analysis & AI Profiling:** Deep contextual analysis of any neighborhood including vibe descriptions, demographics, safety scores, and location-specific recommendations powered by Gemini.
* **Real-Time Weather-Reactive 3D Environment:** Built on CesiumJS with Google 3D Photorealistic Tiles, the globe dynamically adjusts fog, atmosphere, and lighting based on live weather conditions.
* **Contextual Recommendations:** AI-driven location matching based on user intent — describe what you want to do and POView finds the best matching spots nearby.
* **Interactive Glassmorphic UI:** A sleek dashboard with floating insight panels, transcript overlays, tour progress controls, and recommendation cards.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Resium (CesiumJS)
- **Backend:** Python FastAPI, Google ADK (Agent Development Kit), Pydantic
- **AI/Voice:** Google Gemini Live API, WebSocket real-time audio streaming
- **3D Engine:** CesiumJS with Google Maps 3D Photorealistic Tiles
- **State Management:** Zustand (reactive + transient partitions)
- **APIs:** Google Places API, Google Routes API v2, Google Geocoding API, Open-Meteo Weather API

### Architecture

1. **Voice Session:** User speaks → audio streams via WebSocket → Gemini Live API processes intent → triggers tools (fly_to_location, search_neighborhood, get_recommendations)
2. **Cinematic Flight:** Tool calls trigger a 3-phase camera sequence (high-orbit → approach → street-level arrive) on the CesiumJS globe
3. **Spatial Profiling:** Backend aggregates Google Places data, weather context, and spatial analysis → Gemini generates structured NeighborhoodProfile JSON
4. **Reactive Rendering:** Frontend receives tool results → updates Zustand store → CesiumJS camera flies, weather effects adjust, UI panels populate

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.11+
- Redis Server (running on `localhost:6379`)
- API Keys: `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY` in `backend/.env`; `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_CESIUM_ION_TOKEN` in `frontend/.env.local`

### Run the Backend
```bash
cd backend
uv run python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Run the Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` to begin. Click the voice button to start a conversation, or use the search box for manual exploration.
