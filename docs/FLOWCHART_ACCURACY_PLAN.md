# Codebase Cartographer: Flowchart Accuracy Improvement Plan

**Created:** 2026-02-09
**Status:** Design Phase
**Goal:** Make LLM-generated flowcharts accurate enough for reliable manipulation and visualization

---

## PROBLEM ANALYSIS

### Root Causes of Inaccuracy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ ISSUE                          │ CURRENT STATE                     │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Context Starvation           │ Graph generation uses ONLY text   │
│                                │ prompt, not actual file content    │
│                                │ File ingestion stores paths but   │
│                                │ doesn't pass content to LLM       │
├─────────────────────────────────────────────────────────────────────────┤
│ 2. Generic Prompt               │ generateGraphData() uses        │
│                                │ one-size-fits-all prompt        │
│                                │ No codebase-specific context    │
├─────────────────────────────────────────────────────────────────────────┤
│ 3. No Output Validation         │ LLM returns JSON directly     │
│                                │ No validation of link integrity  │
│                                │ Orphan nodes/edges not caught   │
├─────────────────────────────────────────────────────────────────────────┤
│ 4. No Repair Mechanism           │ Invalid graphs accepted as-is   │
│                                │ No auto-fix of broken links      │
├─────────────────────────────────────────────────────────────────────────┤
│ 5. Limited Schema                │ GraphData missing critical    │
│                                │ fields for advanced features   │
│                                │ (filePath, layer, function)    │
├─────────────────────────────────────────────────────────────────────────┤
│ 6. Single-Shot Generation        │ No feedback loop to improve     │
│                                │ based on validation results   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Evidence from Codebase

**Current generation pipeline** (`llmService.ts:361-427`):
```typescript
// Only receives text description - NO file content passed!
async generateGraphData(description: string): Promise<GraphData> {
  const prompt = `Generate a JSON object representing a node-link graph
    for a system described as: "${description}"`;
  // ← "description" is just user's chat text, not actual code
  return this.generateStructuredOutput<GraphData>(prompt, schema);
}
```

**Validation utilities exist but aren't used** (`diagramLayout.ts:169-236`):
- `validateDiagramConnectivity()` - finds orphan nodes
- `detectCycles()` - finds circular dependencies
- `calculateNodeLevels()` - hierarchical analysis
- **None called after LLM generation**

**Ingest service stores paths but not content** (`ingestService.ts`):
```typescript
export const processFileSelect = (
    files: FileList,
    options?: Partial<IngestOptions>
): string[] => {
  // Returns ONLY file paths, not content
  return paths;  // ← No file content passed to LLM
}
```

---

## SOLUTION ARCHITECTURE

### Phase 1: Context Injection

**Problem:** LLM generates graphs without seeing actual code

**Solution:** Pass analyzed file structure and key snippets to LLM

```typescript
// NEW: Enhanced graph generation with context
interface GraphGenerationContext {
  filePaths: string[];
  fileStructure: TreeNode[];
  keyFiles: Map<string, string>; // path → content (first 500 chars)
  imports: Map<string, string[]>; // file → imported modules
  exports: Map<string, string[]>; // file → exported symbols
}

async generateGraphDataWithContext(
  description: string,
  context: GraphGenerationContext
): Promise<GraphData>
```

**Implementation:**
1. Modify `processFileSelect` to capture file metadata
2. Create `src/services/contextExtractor.ts` to analyze imports/exports
3. Build context summary (top 20 files by import count)
4. Pass context to LLM in structured format

---

### Phase 2: Schema Enforcement

**Problem:** No validation, broken graphs accepted

**Solution:** Multi-layer validation with auto-repair

```typescript
// NEW: Graph validation pipeline
interface GraphValidationResult {
  isValid: boolean;
  errors: GraphError[];
  warnings: GraphWarning[];
  repaired?: GraphData;  // Auto-fixed version
}

class GraphValidator {
  validate(graph: GraphData): GraphValidationResult {
    // 1. Schema validation (required fields, types)
    // 2. Topological validation (orphans, cycles)
    // 3. Semantic validation (flow makes sense)
    // 4. Auto-repair where possible
  }
}
```

**Auto-repair strategies:**
- Orphan nodes: Remove if degree = 0
- Broken links: Remove if source/target doesn't exist
- Cycles: Highlight but don't remove (may be intentional)
- Missing entry/exit: Auto-detect from in-degree/out-degree

---

### Phase 3: Enhanced Graph Schema

**Problem:** Current schema too simple for advanced features

**Solution:** Extend GraphData for pneumatic tube visualization

```typescript
// ENHANCED: Rich node metadata
interface Node {
  id: string;
  label: string;
  type: NodeType;
  group: number;

  // NEW: For file linking and inspection
  filePath?: string;        // Source file path
  functionName?: string;    // Entry function
  startLine?: number;       // Line range
  endLine?: number;

  // NEW: For layering and vertical stack
  layer?: number;           // Vertical layer (1=User, 2=App, etc.)
  levelInLayer?: number;    // Horizontal position in layer

  // NEW: For data passport
  inputDataTypes?: string[];
  outputDataTypes?: string[];
  transforms?: string[];     // "add auth header", "parse JSON"
}
```

---

### Phase 4: Iterative Refinement

**Problem:** No feedback loop, LLM doesn't learn from mistakes

**Solution:** Multi-turn refinement with validation feedback

```typescript
async generateGraphDataIterative(
  description: string,
  context: GraphGenerationContext,
  maxAttempts: number = 3
): Promise<GraphData> {
  let attempt = 0;
  let lastError: string | null = null;

  while (attempt < maxAttempts) {
    const result = await attemptGeneration(attempt, description, context, lastError);
    const validation = validator.validate(result);

    if (validation.isValid || validation.repaired) {
      return validation.repaired || result;
    }

    lastError = formatErrorsForLLM(validation.errors);
    attempt++;
  }

  throw new Error(`Failed to generate valid graph after ${maxAttempts} attempts`);
}
```

---

## IMPLEMENTATION PLAN

### Sprint 1: Foundation (Immediate)

**File:** `src/services/graphGenerator.ts` (NEW)

```typescript
export class GraphGenerator {
  constructor(private llmService: LLMService) {}

  async generate(
    description: string,
    context: GraphGenerationContext,
    options?: GenerationOptions
  ): Promise<GraphData> {
    // 1. Build prompt with context
    // 2. Call LLM with structured output
    // 3. Validate result
    // 4. Repair or retry if needed
    // 5. Return validated graph
  }
}
```

**Deliverables:**
- [ ] `GraphGenerator` class with validation pipeline
- [ ] `GraphValidator` with auto-repair
- [ ] Context extractor for file analysis
- [ ] Updated prompt templates

---

### Sprint 2: Chat Integration

**File:** `src/App.tsx` (MODIFY)

```typescript
// When user asks about architecture:
// 1. Check if we have ingested file structure
// 2. If yes, use generateGraphWithContext()
// 3. Pass actual file context, not just user text

const handleArchitectureQuestion = async (question: string) => {
  const context = contextExtractor.buildContext();
  const graph = await graphGenerator.generate(question, context);

  setGraphData(graph);
  setMode(AppMode.FLOW_CHART);  // Auto-switch
};
```

**Deliverables:**
- [ ] Context builder integration
- [ ] Architecture question detection
- [ ] Auto-mode switching
- [ ] Progress indicator during generation

---

### Sprint 3: Visual Enhancement

**File:** `src/components/PneumaticTubeFlow.tsx` (NEW)

Implement the animated particle system from `proposed_feature_updates.md`:

```typescript
// Blue sphere (request) travels down
// Green cube (response) travels up
// Single translucent pipe
// Inspector panel shows "Data Passport"
```

**Deliverables:**
- [ ] Particle animation system
- [ ] Inspector panel component
- [ ] Layer-based auto-layout
- [ ] Click-to-open-file integration

---

## SUCCESS METRICS

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ METRIC                          │ TARGET                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Link validity rate              │ > 95% (links reference real nodes)│
│ Orphan node rate                │ < 5%                            │
│ Schema validation passes         │ > 90% on first attempt         │
│ Successful repair rate           │ > 70% (auto-fixable errors)    │
│ User satisfaction with graphs     │ Qualitative feedback            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## OPEN QUESTIONS

1. **Performance:** Will context extraction on large repos (1000+ files) slow down generation?
2. **Token limits:** How much context can we fit in a single LLM call?
3. **Model selection:** Which provider handles graph generation best? (Claude, GPT-4, etc.)

---

## NEXT STEPS

1. Review and approve this plan
2. Sprint 1: Build GraphGenerator and GraphValidator
3. Test with known codebase structures
4. Measure validation pass rate
5. Iterate based on results
