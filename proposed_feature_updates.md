# Proposed Feature Updates: "Pneumatic Tube" Runtime Flow Visualization

**Created:** 2026-02-08
**Last Updated:** 2026-02-08 21:30 PST
**Status:** Proposed - Awaiting Approval

---

## Overview

Enhance the Flow Chart view to visualize runtime request/response flow as an animated "pneumatic tube" data transport system, inspired by how bank pneumatic tubes transport physical capsules.

### Current State
- Static flow chart with colored edges
- Manual drag-and-drop editing
- Shows structure, not runtime behavior
- Single-path detection (input → output)

### Proposed State
- Animated particle system showing data flow through the system
- Vertical stack layout mirroring actual code architecture
- Two-way flow visualization (request down, response up)
- Live inspector panel showing data transformation at each layer
- Click-to-open-file for direct code access

---

## Visual Metaphor

**The Pneumatic Tube System:**
- User puts a "capsule" (request) into the tube
- Capsule shoots down through architectural layers
- System processes at each layer (visible in inspector panel)
- Response capsule shoots back up the same tubes to user
- Single transparent pipe, two-way traffic

---

## Technical Specifications

### 1. Layout - Vertical Stack Architecture

**Layers (top to bottom):**
```
Layer 1: User/CLI         (internal/cmd)   - Light blue box
Layer 2: Orchestration    (internal/app)    - Purple box
Layer 3: Subsystems       (horizontal row)
         ├── Agent Service (internal/agent)  - Green box
         ├── Database      (db)                  - Orange box
         └── Config        (config)             - Yellow box
Layer 4: LLM Endpoint      (gemini.api)       - Pink box (far bottom)
```

**Implementation:**
- Modify existing `applyAutoLayout()` in `src/utils/diagramLayout.ts`
- Add `direction: 'TB'` (top-to-bottom) algorithm
- Subsystems arranged horizontally at their layer
- Calculate Y-position based on layer depth
- Calculate X-position based on layer width

---

### 2. Edge Styling - Translucent Pipes

**Visual Properties:**
- Stroke width: 8px (thick, like a tube)
- Color: `rgba(255, 255, 255, 0.15)` - 15% opacity white
- Border radius: 4px (rounded corners)
- Line cap: `round`
- Line join: `round`

**Implementation:**
```typescript
// In DiagramView.tsx edge styling
style: {
  stroke: 'rgba(255, 255, 255, 0.15)',
  strokeWidth: 8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}
```

---

### 3. Particle System - Two-Way Flow

**Request Particle:**
- Type: Glowing sphere
- Color: `#06b6d4` (cyan-500)
- Size: 12px diameter
- Effects: Pulsing outer glow, trailing particle effect
- Movement: Downstream (user → LLM)
- Duration: 3 seconds for full journey

**Response Particle:**
- Type: Glowing cube
- Color: `#22c55e` (green-500)
- Size: 12px
- Effects: Slow rotation, trailing particle effect
- Movement: Upstream (LLM → user)
- Duration: 3 seconds for return journey

**Animation Pattern:**
1. Blue sphere departs from User/CLI layer
2. Sphere travels through tubes, each layer pulses as sphere passes
3. Sphere reaches LLM endpoint, pauses 0.5s
4. Green cube departs from LLM endpoint
5. Cube travels back up through same path
6. Cube reaches User, cycle repeats

**Implementation:**
- New component: `src/components/FlowParticles.tsx`
- Uses `requestAnimationFrame` for smooth animation
- Particles follow SVG path using `getPointAtLength()`
- State machine tracking: `requesting → processing → responding → idle`

---

### 4. Inspector Panel - Live "Data Passport"

**Panel Location:** Right side, 30% width, semi-transparent overlay

**Data Displayed:**
```
┌─────────────────────────────┐
│ 🔍 Data Passport               │
├─────────────────────────────┤
│ Current Layer: Orchestratio   │
│ File: internal/app/main.go    │
│                                │
│ 📦 Request Payload            │
│ {                              │
│   "query": "hello",            │
│   "context": {...},            │
│   "timestamp": 1234567890      │
│ }                              │
│                                │
│ ▼ Influence Accumulation:      │
│ • + Merged user context        │
│ • + Loaded .env                │
│ • + Added auth headers          │
│                                │
│ ➡ Next Hop: Agent Service      │
│ ⏱️  Latency: 45ms                │
└─────────────────────────────┘
```

**Triggering Updates:**
- When particle enters a layer's bounding box
- Panel shows that layer's file path and function
- Shows payload transformation (diff from previous layer)
- Shows accumulated "influences" (what changed)

**Implementation:**
- New component: `src/components/FlowInspector.tsx`
- State: `{ currentLayer, payload, influences, nextHop }`
- React context to share particle position with inspector

---

### 5. Click-to-Open File

**Interaction:**
- Click on a node → Opens corresponding file in native editor
- Uses backend API endpoint to open file system location

**Backend Endpoint:**
```
GET /api/open-file?path=/path/to/file.go
→ Executes system 'open' (macOS), 'start' (Windows), 'xdg-open' (Linux)
```

**Node Metadata Required:**
```typescript
interface Node {
  id: string;
  label: string;
  type: string;
  filePath?: string;  // NEW - path to source file
  functionName?: string;  // NEW - entry point function
  line?: number;  // NEW - line number if specific
}
```

**LLM Prompt Update:**
- Instruct LLM to include `filePath` and `functionName` when generating flow charts
- Map node types to their actual source files

---

## Implementation Phases

### Phase 1: Foundation (Immediate Value)
**Goal:** Enable file opening and improve layout

1. Add `filePath` to Node type
2. Update auto-layout to vertical stack
3. Implement click-to-open-file
4. Update LLM prompt for file path inclusion

**Deliverables:**
- Modified `src/types.ts` with filePath
- Updated `src/utils/diagramLayout.ts`
- Backend API endpoint `/api/open-file`
- Updated LLM generation prompt

---

### Phase 2: Visual Enhancement (Wow Factor)
**Goal:** Add particle animation

1. Create `FlowParticles.tsx` component
2. Implement particle movement along SVG paths
3. Add particle trails and glow effects
4. Two-way flow (blue down, green up)

**Deliverables:**
- New particle system component
- Animated request/response visualization
- Performance optimization (don't block main thread)

---

### Phase 3: Inspector Panel (Deep Understanding)
**Goal:** Show data transformation

1. Create `FlowInspector.tsx` component
2. Track particle position through layers
3. Display layer-specific information
4. Show payload diff and influences

**Deliverables:**
- Inspector panel component
- Real-time data tracking
- Context-aware display updates

---

### Phase 4: Live Rerouting (Advanced)
**Goal:** Enable dynamic path visualization

1. File watcher integration
2. Detect code changes affecting flow
3. Regenerate graph dynamically
4. Re-route particles to new path

**Deliverables:**
- Live code watching
- Dynamic graph regeneration
- Particle path recalculation

---

## Success Criteria

- [ ] Vertical stack layout correctly mirrors code architecture
- [ ] Blue sphere (request) flows downstream clearly visible
- [ ] Green cube (response) flows upstream clearly visible
- [ ] Inspector panel updates as particles pass through layers
- [ ] Click node opens correct file in native editor
- [ ] Animation is smooth (30+ FPS)
- [ ] No visual clutter despite showing full round-trip

---

## Dependencies

**Required MCP Tools:**
- `mcp__floyd-devtools__typescript_semantic_analyzer` - For code navigation
- `mcp__zread__search_doc` / `mcp__zread__read_file` - For understanding code structure

**External Dependencies:**
- None (uses existing React, D3, React Flow)

---

## Open Questions

1. **Performance:** Will particle animation impact diagram performance with 50+ nodes?
2. **LLM Accuracy:** Can we trust LLM to include accurate file paths in generated flow charts?
3. **Browser Compatibility:** Do animated SVG paths work consistently across browsers?

---

## Alternative Approaches Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Separate request/response lines | Clearer separation | Visual clutter | Rejected |
| Sequence diagram style | Standard pattern | Doesn't show architecture well | Rejected |
| Color gradient on edges | No additional elements | Hard to read direction | Considered |
| Single pipe with particles | Clean, intuitive, novel | More complex animation | **Selected** |

---

## References

- Distributed tracing visualization patterns
- Jaeger/Zipkin trace timeline views
- C4 model architecture diagrams
- Bank pneumatic tube systems (real-world analogy)

---

**Next Steps:**
1. Review and approve this plan
2. Begin Phase 1 implementation
3. Test with real Go codebase
4. Iterate based on user feedback
