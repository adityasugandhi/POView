# POView — Latency & UX Optimization: Definitive Implementation Plan
# Version: FINAL — March 16, 2026

> **Context**: The POView voice-globe system has a 10-20 second dead zone between
> the user's voice command and visible UI response. The voice agent says "I'm looking
> into that..." but nothing happens until the full ADK pipeline completes. This plan
> eliminates perceived latency to zero and cuts actual pipeline time by 40-60%.

---

## The Latency Budget: Where Time Is Spent Today

```
User: "Tell me about Williamsburg"
  │
  ├─ 0.0s   Voice agent recognizes intent, emits tool_call
  ├─ 0.3s   Backend receives tool_call, begins execution
  │          ┌─────────────────────────────────────────────┐
  │          │ SEQUENTIAL BOTTLENECK (10-20s)              │
  │          │                                             │
  │          │ 1. Autocomplete + Place Details    ~1.5s    │
  │          │ 2. Nearby POIs + Weather (parallel) ~1.5s   │
  │          │ 3. ScriptWriter (Gemini 2.5 Pro)   ~4-6s   │
  │          │ 4. GlobeController (Gemini Flash)   ~2-3s   │
  │          │ 5. NarrationPlanner (Gemini Flash)  ~2-3s   │
  │          │ 6. Formatter (Gemini Flash)         ~1-2s   │
  │          └─────────────────────────────────────────────┘
  ├─ 12-20s  tool_result returns to Gemini Live session
  ├─ 12.5s   Agent begins speaking answer
  ├─ 13s     Frontend receives data, renders UI
  └─ 13.5s   Camera starts moving
```

**The user sees NOTHING for 12-20 seconds.** This is unacceptable.

---

## The Three-Layer Solution

### Layer 1: Instant Perceived Response (0ms delay)
Hook into the WebSocket `processing` state signal that fires the microsecond the agent
decides to call a tool. Show skeleton UI immediately.

### Layer 2: Progressive Streaming (results arrive in chunks, not one blob)
Break the monolithic tool return into a stream of intermediate results pushed over the
WebSocket. The frontend renders each chunk as it arrives.

### Layer 3: Pipeline Parallelization (cut actual time 40-60%)
Restructure the ADK pipeline to run independent agents concurrently using `ParallelAgent`,
and decouple the tool response from the data delivery.

---

## Layer 1: Instant Skeleton UI

### Research Finding: The `processing` Signal Already Exists

When the Gemini Live agent decides to invoke a tool, the ADK/WebSocket emits a state
message BEFORE the tool executes. Your system already receives this:

```json
{"type": "state", "state": "processing", "tool": "search_neighborhood"}
```

This arrives at ~0.3s (the moment Gemini decides to call the tool). The full result
doesn't arrive until 12-20s later. This 0.3s signal is your trigger for instant UI.

### Implementation

```
[AGENTIC PROMPT — LAYER 1: INSTANT SKELETON UI]

Reference: .cursorrules, architecture_review.md

OBJECTIVE: Eliminate perceived latency by showing loading UI the instant
the voice agent decides to run an analysis tool. The user must see visual
feedback within 500ms of speaking their request.

INSTRUCTIONS:

1. Add new Zustand reactive state (src/store/useSimulationStore.ts):

   In the REACTIVE partition, add:
   ```typescript
   // Analysis pipeline state
   analysisState: {
     isAnalyzing: boolean;
     activeTool: string | null;       // 'search_neighborhood' | 'tour_recommendations' | etc.
     currentStage: string | null;     // 'resolving_location' | 'writing_narrative' | etc.
     stageProgress: number;           // 0-100 (updated by streaming stage events)
     startedAt: number | null;        // performance.now() timestamp
   };
   ```

   Add actions:
   ```typescript
   startAnalysis: (toolName: string) => void;
   updateAnalysisStage: (stage: string, progress: number) => void;
   completeAnalysis: () => void;
   ```

2. Hook into the processing signal (src/hooks/useLiveWebSocket.ts):

   In the WebSocket message handler, locate where state/processing messages
   are received. When you detect a tool_call or processing state:

   ```typescript
   if (msgType === 'state' && data.state === 'processing') {
     const toolName = data.tool || data.tool_name;
     if (toolName) {
       useSimulationStore.getState().startAnalysis(toolName);

       // ALSO: immediately show the relevant panel
       if (toolName === 'search_neighborhood' || toolName === 'start_narrated_tour') {
         useSimulationStore.setState({ insightPanelVisible: true });
       }
       if (toolName === 'tour_recommendations' || toolName === 'get_recommendations') {
         useSimulationStore.setState({
           insightPanelVisible: true,
           recommendationsPanelVisible: true,
         });
       }
     }
   }
   ```

   When the final tool_result arrives:
   ```typescript
   useSimulationStore.getState().completeAnalysis();
   ```

3. Create component: src/components/AnalysisSkeleton.tsx

   A shimmering skeleton loader that appears in the InsightPanel when
   isAnalyzing is true and profileData is null.

   ```typescript
   /**
    * AnalysisSkeleton — Shimmer loading state for the analysis pipeline.
    *
    * Shows:
    * - Animated shimmer bars mimicking the profile card layout
    * - Current stage text: "Resolving location...", "Writing narrative...", etc.
    * - Elapsed time counter (subtle, bottom-right)
    * - Pulsing dot animation next to stage text
    *
    * Design: Match the glassmorphic InsightPanel aesthetic exactly.
    * The skeleton should feel like a "ghost" of the real card —
    * same dimensions, same layout, just shimmer placeholders.
    *
    * Transition: When real data arrives, crossfade from skeleton to
    * populated card using a CSS transition (opacity + transform).
    * Do NOT unmount skeleton → mount card (causes layout shift).
    * Instead, render BOTH and crossfade.
    */
   ```

   Stage progression text (updated by Layer 2 streaming):
   - "Resolving location..." → "Fetching nearby places..."
   - → "AI agents analyzing neighborhood..." → "Writing narrative..."
   - → "Computing camera trajectory..." → "Preparing your experience..."

4. Modify InsightPanel.tsx:

   At the top of the component, check analysis state:
   ```typescript
   const { isAnalyzing, currentStage } = useSimulationStore(
     state => state.analysisState
   );
   const profileData = useSimulationStore(state => state.profileData);

   // Render skeleton if analyzing and no data yet
   if (isAnalyzing && !profileData) {
     return <AnalysisSkeleton stage={currentStage} />;
   }
   ```

   Apply the same pattern to RecommendationsPanel for recommendation skeletons.

5. Verify:
   - Say "Tell me about Williamsburg"
   - InsightPanel skeleton MUST appear within 500ms of speaking
   - Skeleton shows animated shimmer + stage text
   - When real data arrives (10-20s later), crossfade to real card
   - No layout shift during transition

Provide: Screenshot/recording of skeleton appearing instantly after voice command.
```

---

## Layer 2: Progressive Streaming via WebSocket

### Research Finding: NON_BLOCKING Has a Critical Gotcha

The Gemini Live API's `NON_BLOCKING` tool behavior lets the agent keep talking while
the tool runs. However, there's a **known issue** (googleapis/python-genai#1894):
the model hallucinate facts while waiting for the tool result. For factual queries
like neighborhood analysis, this means the agent might say incorrect information
before the real data arrives.

**The solution: Two-phase tool response pattern.**

Phase 1 (immediate): Return a lightweight acknowledgment so the agent can narrate filler.
Phase 2 (streaming): Push intermediate results directly to the frontend over the WebSocket,
bypassing the Gemini tool_result pipeline entirely.

### Implementation

```
[AGENTIC PROMPT — LAYER 2: PROGRESSIVE STREAMING]

Reference: .cursorrules, backend/agents/live_tools.py, backend/main.py,
frontend/src/hooks/useLiveWebSocket.ts

OBJECTIVE: Stream intermediate pipeline results to the frontend as they
complete, rather than waiting for the entire pipeline to finish. This lets
the UI progressively fill in — location resolves first, then POI data,
then the full profile — each arriving seconds apart.

INSTRUCTIONS:

1. Backend — Create a streaming pipeline runner:

   File: backend/services/streaming_workflow.py (NEW)

   The key insight: instead of the tool awaiting the full pipeline and
   returning one massive result, the tool immediately returns a lightweight
   ack, and the pipeline PUSHES intermediate results directly to the
   frontend WebSocket.

   ```python
   import asyncio
   from typing import Callable

   async def run_streaming_workflow(
       place_id: str,
       intent: str,
       send_to_frontend: Callable,  # function that sends JSON over WebSocket
   ) -> dict:
       """
       Runs the analysis pipeline with intermediate result streaming.

       send_to_frontend pushes messages directly to the WebSocket,
       bypassing the Gemini tool_result chokepoint.
       """

       # Stage 1: Resolve location (~1.5s)
       send_to_frontend({
           "type": "pipeline_stage",
           "stage": "resolving_location",
           "progress": 10,
       })
       place_details = await get_places_details(place_id)
       # Push location immediately — frontend can start camera fly-in NOW
       send_to_frontend({
           "type": "pipeline_partial",
           "partial": "location",
           "data": {
               "location": {"lat": place_details["lat"], "lng": place_details["lng"]},
               "viewport": place_details.get("viewport", {}),
               "place_name": place_details["display_name"],
           }
       })

       # Stage 2: Nearby POIs + Weather in parallel (~1.5s)
       send_to_frontend({
           "type": "pipeline_stage",
           "stage": "fetching_nearby",
           "progress": 25,
       })
       nearby, weather = await asyncio.gather(
           get_nearby_places(place_details["lat"], place_details["lng"]),
           fetch_weather_forecast(place_details["lat"], place_details["lng"]),
       )
       # Push weather immediately — frontend can apply weather effects NOW
       send_to_frontend({
           "type": "pipeline_partial",
           "partial": "weather",
           "data": {"weather": weather},
       })

       # Stage 3: Run ADK agents (~6-12s, parallelized in Layer 3)
       send_to_frontend({
           "type": "pipeline_stage",
           "stage": "analyzing",
           "progress": 40,
       })
       result = await run_neighborhood_workflow(
           place_details, nearby, weather, intent,
           on_stage=lambda stage, pct: send_to_frontend({
               "type": "pipeline_stage",
               "stage": stage,
               "progress": pct,
           })
       )

       # Push final result
       send_to_frontend({
           "type": "pipeline_complete",
           "data": result,
       })

       return result
   ```

2. Backend — Modify tool to use immediate return + background streaming:

   File: backend/agents/live_tools.py

   Change the search_neighborhood tool:

   ```python
   async def search_neighborhood(place_query: str, intent: str = "") -> dict:
       """Runs neighborhood analysis. Returns immediately with acknowledgment.
       Full results stream progressively via WebSocket."""

       # Resolve place_id quickly (needed for ack)
       predictions = await get_autocomplete_predictions(place_query)
       if not predictions:
           return {"status": "error", "message": "Location not found"}

       place_id = predictions[0]["place_id"]
       place_name = predictions[0].get("description", place_query)

       # Launch the streaming pipeline in the background
       # The ws_sender is injected into the tool context
       asyncio.create_task(
           run_streaming_workflow(
               place_id=place_id,
               intent=intent,
               send_to_frontend=_get_ws_sender(),
           )
       )

       # Return lightweight ack immediately (< 1s total tool time)
       return {
           "status": "analysis_started",
           "place_name": place_name,
           "message": f"Analysis of {place_name} is underway. Results will stream progressively."
       }
   ```

   CRITICAL: The tool now returns in < 1 second instead of 10-20 seconds.
   The Gemini agent receives this ack immediately and can say:
   "I'm pulling up Williamsburg now — let me walk you through what I find..."

   The actual data streams to the frontend via WebSocket pipeline_partial
   messages, which the frontend handles independently of the voice agent.

3. Backend — Inject the WebSocket sender into the tool context:

   In main.py, when handling tool_calls from the Gemini session, you need
   to make the WebSocket send function available to the tools. Options:

   A) Store it as a module-level reference when the WS connects:
      ```python
      _active_ws_senders = {}  # session_id → send function

      # In WebSocket connect handler:
      _active_ws_senders[session_id] = lambda msg: asyncio.create_task(
          websocket.send_json(msg)
      )
      ```

   B) Or pass it through the ADK tool_context if your setup supports it.

   The tool retrieves the sender via `_get_ws_sender()` which returns
   the active WebSocket send function for the current session.

4. Frontend — Handle progressive messages:

   In useLiveWebSocket.ts, add handlers for the new message types:

   ```typescript
   // Pipeline stage progress
   if (msgType === 'pipeline_stage') {
     useSimulationStore.getState().updateAnalysisStage(
       data.stage,
       data.progress
     );
   }

   // Partial results — render immediately
   if (msgType === 'pipeline_partial') {
     switch (data.partial) {
       case 'location':
         // Fly camera to location NOW (don't wait for full profile)
         useSimulationStore.setState({
           viewport: data.data.viewport,
           currentLocation: data.data.location,
         });
         // Trigger camera fly-in via existing mechanism
         break;

       case 'weather':
         // Apply weather effects NOW
         useSimulationStore.setState({
           weatherState: data.data.weather,
         });
         break;
     }
   }

   // Final complete result
   if (msgType === 'pipeline_complete') {
     // Set the full profile data, narration timeline, etc.
     useSimulationStore.setState({
       profileData: data.data.profile_data,
     });
     useSimulationStore.getState().completeAnalysis();
     // Handle narration timeline if present
     if (data.data.narration_timeline) {
       onNarratedTourResult?.(data.data);
     }
   }
   ```

   RESULT: The user experience becomes:
   ```
   0.0s  — User speaks
   0.3s  — Skeleton UI appears (Layer 1)
   1.5s  — Camera flies to location (partial: location)
   2.0s  — Weather effects apply (partial: weather)
   3.0s  — Stage text: "AI agents analyzing..."
   5.0s  — Stage text: "Writing narrative..."
   8.0s  — Stage text: "Computing trajectory..."
   10.0s — Full profile card crossfades in
   10.5s — Drone tour begins (if narrated tour)
   ```

   The user sees meaningful visual progress from 1.5s onward,
   not a blank screen until 12-20s.

5. Verify:
   - Time from voice command to camera fly-in: must be < 2s
   - Time from voice command to skeleton: must be < 0.5s
   - Stage text updates at least 3 times during pipeline
   - Final crossfade to real data is smooth (no flash/layout shift)

Provide: Timeline measurements for each stage arrival.
```

---

## Layer 3: Pipeline Parallelization

### Research Finding: ADK ParallelAgent Is Production-Ready

Google's ADK provides `ParallelAgent` that runs sub-agents concurrently. Sub-agents
share the same `session.state` but must write to distinct keys. This is the officially
supported pattern for fan-out/gather workflows.

### The Parallelization Opportunity

Your current pipeline is strictly sequential:

```
ScriptWriter (4-6s) → GlobeController (2-3s) → NarrationPlanner (2-3s) → Formatter (1-2s)
Total: 9-14s
```

Analysis of dependencies:
- **ScriptWriter** needs: place data, nearby POIs, weather, intent
- **GlobeController** needs: extracted POIs (currently from ScriptWriter's narrative)
- **NarrationPlanner** needs: ScriptWriter output + GlobeController waypoints
- **Formatter** needs: ScriptWriter narrative

**Key insight**: GlobeController does NOT actually need the narrative text. It needs
POI coordinates, which come from the Google Places API data that's ALREADY AVAILABLE
before ScriptWriter runs. The current architecture extracts POIs from the narrative
as a convenience, but the raw nearby POIs data has the same coordinates.

### Restructured Pipeline

```
                    ┌─ ScriptWriter (4-6s) ─────────┐
Place Data ─────────┤                                ├──→ NarrationPlanner (2-3s) → Formatter (1-2s)
                    └─ GlobeController (2-3s) ──────┘
                         (uses raw POI coords)

Total: max(4-6, 2-3) + 2-3 + 1-2 = 7-11s
Savings: 2-3s (the GlobeController no longer waits for ScriptWriter)
```

### Implementation

```
[AGENTIC PROMPT — LAYER 3: PIPELINE PARALLELIZATION]

Reference: .cursorrules, backend/agents/workflow.py, backend/agents/globe_controller.py

OBJECTIVE: Restructure the ADK pipeline to run ScriptWriter and
GlobeController in parallel, saving 2-3 seconds of wall-clock time.
Then add stage callbacks for Layer 2 streaming.

INSTRUCTIONS:

1. Modify GlobeController to accept raw POI data instead of narrative:

   File: backend/agents/globe_controller.py

   Currently, GlobeController reads `raw_narrative` from session state and
   extracts POI names + coordinates from the text. This creates a dependency
   on ScriptWriter completing first.

   Change: GlobeController should ALSO accept a `nearby_pois` key from
   session state (the raw Google Places API results). When `nearby_pois`
   is available, use those coordinates directly instead of extracting
   from the narrative.

   In _run_async_impl:
   ```python
   # Try raw POI data first (available before ScriptWriter)
   nearby_pois = ctx.session.state.get("nearby_pois", [])
   if nearby_pois:
       # Use raw coordinates directly
       extracted_pois = [
           ExtractedPOI(
               name=poi["name"],
               lat=poi["lat"],
               lng=poi["lng"],
               type=poi.get("primaryType", "point_of_interest"),
           )
           for poi in nearby_pois[:8]  # limit to top 8
       ]
   else:
       # Fallback: extract from narrative (existing logic)
       raw_narrative = ctx.session.state.get("raw_narrative", "")
       extracted_pois = await self._extract_pois_from_narrative(raw_narrative)
   ```

   This makes GlobeController independent of ScriptWriter.

2. Restructure workflow to use ParallelAgent:

   File: backend/agents/workflow.py

   Change from:
   ```python
   # OLD: Strictly sequential
   pipeline = SequentialAgent(
       name="NeighborhoodPipeline",
       sub_agents=[script_writer, globe_controller, narration_planner, formatter]
   )
   ```

   To:
   ```python
   from google.adk.agents.parallel_agent import ParallelAgent

   # NEW: ScriptWriter and GlobeController run in parallel
   parallel_research = ParallelAgent(
       name="ParallelResearch",
       sub_agents=[script_writer, globe_controller],
   )

   # NarrationPlanner needs BOTH outputs, so it runs after parallel phase
   # Formatter needs ScriptWriter output, so it also runs after
   pipeline = SequentialAgent(
       name="NeighborhoodPipeline",
       sub_agents=[parallel_research, narration_planner, formatter],
   )
   ```

   IMPORTANT: Ensure ScriptWriter writes to `raw_narrative` output_key
   and GlobeController writes to `visualization_plan` output_key.
   ParallelAgent sub-agents share session.state but must write to
   DISTINCT keys (they already do).

   NarrationPlanner reads both `raw_narrative` and `visualization_plan`
   from session state — both will be available after the parallel phase.

3. Add stage callbacks for streaming:

   Modify workflow.py to accept an optional `on_stage` callback:

   ```python
   async def run_neighborhood_workflow(
       place_details, nearby, weather, intent,
       on_stage=None  # callback(stage_name, progress_pct)
   ):
       # Before parallel phase
       if on_stage:
           on_stage("writing_narrative", 40)

       # Run pipeline
       # ... existing ADK execution ...

       # After parallel phase completes (detect via session state)
       if on_stage:
           on_stage("planning_narration", 65)

       # After NarrationPlanner
       if on_stage:
           on_stage("formatting_output", 80)

       # After Formatter
       if on_stage:
           on_stage("finalizing", 95)
   ```

   If the ADK SequentialAgent doesn't support mid-pipeline callbacks natively,
   implement this by switching from SequentialAgent to a CustomAgent (BaseAgent)
   that manually runs each phase and emits callbacks between them:

   ```python
   class StreamingWorkflowAgent(BaseAgent):
       async def _run_async_impl(self, ctx):
           # Phase 1: Parallel research
           if self._on_stage:
               self._on_stage("analyzing", 40)
           parallel = ParallelAgent(
               name="research",
               sub_agents=[self.script_writer, self.globe_controller]
           )
           async for event in parallel.run_async(ctx):
               yield event

           # Phase 2: NarrationPlanner
           if self._on_stage:
               self._on_stage("planning_narration", 65)
           async for event in self.narration_planner.run_async(ctx):
               yield event

           # Phase 3: Formatter
           if self._on_stage:
               self._on_stage("formatting", 85)
           async for event in self.formatter.run_async(ctx):
               yield event

           if self._on_stage:
               self._on_stage("complete", 100)
   ```

4. Verify parallelization savings:

   Add timing measurements around each phase:
   ```python
   import time
   t0 = time.monotonic()
   # ... run parallel phase ...
   t1 = time.monotonic()
   print(f"Parallel phase: {t1-t0:.1f}s")
   # ... run narration planner ...
   t2 = time.monotonic()
   print(f"NarrationPlanner: {t2-t1:.1f}s")
   ```

   Expected results:
   - OLD sequential: ScriptWriter(5s) + GlobeController(3s) = 8s
   - NEW parallel: max(ScriptWriter(5s), GlobeController(3s)) = 5s
   - Savings: ~3 seconds

5. Verify end-to-end:
   - Full pipeline must complete in < 10s (down from 12-20s)
   - NarrationPlanner still produces correct output (has both narrative + waypoints)
   - Formatter still produces valid NeighborhoodProfile
   - Stage callbacks fire at correct intervals

Provide: Timing comparison table: before vs. after parallelization.
```

---

## Combined Impact: Before vs. After

### Before (Current State)

```
0.0s  ── User speaks ──────────────────────────────────────
0.3s  ── Agent says "Looking into it..."
      ── ████████████████████████████████ DEAD ZONE ████████
12-20s── Data arrives, UI renders, camera moves
```

**Perceived latency: 12-20 seconds**
**Actual latency: 12-20 seconds**

### After (All Three Layers)

```
0.0s  ── User speaks ──────────────────────────────────────
0.3s  ── Skeleton UI appears with shimmer animation
0.5s  ── Agent says "Let me pull up Williamsburg..."
1.5s  ── Camera flies to location (partial: location)
2.0s  ── Weather effects apply (partial: weather)
2.5s  ── Stage: "AI agents analyzing neighborhood..."
4.0s  ── Stage: "Writing narrative..." (ScriptWriter running)
5.0s  ── Stage: "Planning camera trajectory..." (parallel)
6.5s  ── Stage: "Formatting your experience..."
7.0s  ── Profile card crossfades in from skeleton
7.5s  ── Agent begins speaking insights (from tool_result)
8.0s  ── Drone tour camera starts (if narrated tour)
```

**Perceived latency: 0.3 seconds** (skeleton appears)
**Meaningful visual feedback: 1.5 seconds** (camera flies)
**Full data available: 7-10 seconds** (down from 12-20)

### Latency Reduction Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Perceived latency (first visual) | 12-20s | 0.3s | **98% reduction** |
| First camera movement | 12-20s | 1.5s | **88% reduction** |
| Full profile available | 12-20s | 7-10s | **40-50% reduction** |
| Agent silent duration | 12-20s | 0.5s | **97% reduction** |

---

## Implementation Order

| Phase | Est. Time | Dependencies | Impact |
|-------|-----------|-------------|--------|
| Layer 1: Skeleton UI | 2-3 hours | None | Perceived latency → 0.3s |
| Layer 3: Pipeline parallelization | 3-4 hours | None | Actual latency -3s |
| Layer 2: Progressive streaming | 4-6 hours | Layer 1, Layer 3 | Camera at 1.5s, weather at 2s |

**Recommendation**: Implement Layer 1 first — it's the highest impact for the least effort.
Then Layer 3 (parallelization is a backend-only change). Then Layer 2 (streaming requires
coordinated frontend + backend changes).

---

## Gotchas and Edge Cases

### NON_BLOCKING Hallucination Risk

When using `NON_BLOCKING` tool behavior, the Gemini model may hallucinate facts while
waiting for the tool result (confirmed bug: googleapis/python-genai#1894). For POView's
use case, the agent might say incorrect neighborhood facts before the real data arrives.

**Mitigation**: The Layer 2 approach avoids this entirely. The tool returns an
acknowledgment ("analysis_started") with NO factual content, so the model has nothing
to hallucinate about. It can only say process-oriented filler like "I'm analyzing the
neighborhood now..." The real facts arrive via WebSocket, not via tool_result.

**System prompt addition**:
```
When you call search_neighborhood or tour_recommendations and receive a response
with status "analysis_started", do NOT speculate about the neighborhood or make up
facts. Only speak about the process: "I'm pulling up the data now", "My analysis
agents are working on it", etc. Wait for the actual results before stating any facts
about the location.
```

### Race Condition: Voice Agent vs. Streaming Data

With the two-phase approach, data arrives at the frontend via TWO channels:
1. WebSocket `pipeline_partial` / `pipeline_complete` messages (direct streaming)
2. Gemini tool_result (when the background task eventually completes)

The frontend must handle receiving data from BOTH channels without duplication.

**Solution**: Use a `pipelineId` (UUID) generated at tool invocation time. Include
it in all streaming messages AND the final tool_result. The frontend deduplicates
by ignoring tool_result data if it already received pipeline_complete for that ID.

### Audio Stall During Skeleton Phase

If the voice agent returns the lightweight ack and begins narrating filler, but the
user's AudioContext is paused or the agent goes silent, the skeleton UI is the only
feedback. Ensure the skeleton animation is engaging enough to hold attention for
up to 10 seconds alone.

**Enhancement**: Add a subtle ambient sound effect (low hum or typing sounds) to
the skeleton state to reinforce that "work is happening." This is optional but
significantly improves perceived performance.