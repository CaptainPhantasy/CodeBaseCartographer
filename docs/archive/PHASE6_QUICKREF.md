---

# ⚠️  ARCHIVED DOCUMENTATION

**Status:** ARCHIVAL - NOT RELEVANT TO CURRENT CODE WORK  
**Archived:** February 8, 2026  
**Location:** docs/archive/

This document is preserved for historical reference only. For current documentation, see:
- [Current Docs Index](../README.md)
- [Main README](../../README.md)

---
# PHASE 6 Quick Reference

## CLI Commands

```bash
# Analyze and export
codebase-cartographer analyze ./src --export diagram.png
codebase-cartographer analyze ./src --format json --output analysis.json
codebase-cartographer analyze ./src --complexity --depth 5

# Export existing
codebase-cartographer export graph.json diagram.svg

# Get info
codebase-cartographer info ./src
```

## Snapshot Service

```typescript
import { snapshotService } from './services/snapshotService';

// CRUD
const snap = snapshotService.saveSnapshot('name', data, { description, tags });
const data = snapshotService.loadSnapshot(id);
const list = snapshotService.listSnapshots();
snapshotService.deleteSnapshot(id);

// Compare
const diff = snapshotService.compareSnapshots(id1, id2);

// Export/Import
const json = snapshotService.exportSnapshot(id);
const snap = snapshotService.importSnapshot(jsonString);
```

## Complexity Service

```typescript
import {
  calculateComplexity,
  calculateProjectComplexity,
  getComplexityColor
} from './services/complexityService';

const metrics = calculateComplexity(code);
// { cyclomatic, linesOfCode, maintainabilityIndex, complexity }

const project = calculateProjectComplexity(files);
// { averageCyclomatic, totalLinesOfCode, distribution }

const color = getComplexityColor('high'); // '#f59e0b'
```

## Dependency Service

```typescript
import {
  calculateDependencyDepth,
  analyzeDependencies
} from './services/dependencyService';

const depthMap = calculateDependencyDepth(nodes, edges);
const analysis = analyzeDependencies(nodes, edges);
// { maxDepth, averageDepth, nodesByDepth, criticalPath, circularDependencies }
```

## Export Utilities

```typescript
import { exportDiagram, generateEmbedCode } from './utils/exportUtils';

// Export
await exportDiagram(data, { format: 'png', filename: 'diagram' });
await exportDiagram(data, { format: 'svg', filename: 'diagram' });
await exportDiagram(data, { format: 'json', includeMetadata: true });

// Embed code
const iframe = generateEmbedCode('snapshot-id', { width: '100%', height: '600px' });
```

## React Components

```tsx
// Complexity overlay
<ComplexityOverlay enabled showMetrics onNodeClick={handler} />

// Dependency rings
<DependencyRings enabled showLabels animated center={{ x: 400, y: 300 }} />
```

## Complexity Levels

| Level | Cyclomatic | Color | Description |
|-------|-----------|-------|-------------|
| Low | ≤ 5 | Green (#10b981) | Simple |
| Medium | 5-10 | Blue (#3b82f6) | Moderate |
| High | 10-20 | Orange (#f59e0b) | Complex |
| Very High | > 20 | Red (#ef4444) | Very Complex |

## File Locations

```
/server/src/cli.ts - CLI interface
/server/src/analyzer.ts - Codebase analysis
/server/src/exporter.ts - Server-side export

/src/services/snapshotService.ts - Snapshot management
/src/services/complexityService.ts - Complexity calculations
/src/services/dependencyService.ts - Dependency analysis

/src/components/ComplexityOverlay.tsx - Complexity UI
/src/components/DependencyRings.tsx - Depth visualization

/src/utils/exportUtils.ts - Client export utilities
/embed.tsx - Embed widget
```

## Build & Test

```bash
npm run build  # Frontend build
cd server && npm run build  # Backend build
npm test  # Run all tests
```

## Output

```
PHASE 6 COMPLETE
CLI: [analyze, export, info commands working]
Snapshots: [save/load/compare working]
Complexity: [cyclomatic/LOC/maintainability calculating]
Export: [PNG/SVG/JSON working]
Build: [PASS]
Tests: [PASS - 50+ tests]
```
