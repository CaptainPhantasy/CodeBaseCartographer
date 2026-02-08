# Code Execution System - Phase 3

## Overview

The code execution system enables safe, automated code changes with real-time progress tracking and rollback capabilities.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   TaskCard      │────▶│ Subagent         │────▶│   File System   │
│ (Execute Button)│     │ Orchestrator     │     │   (write/read)  │
└─────────────────┘     │  - Pool mgmt     │     └─────────────────┘
                        │  - Timeouts      │             │
                        │  - Progress      │             ▼
                        └──────────────────┘     ┌─────────────────┐
                                                  │ Change Journal  │
                                                  │  - Track all    │
┌─────────────────┐     ┌──────────────────┐     │  - Rollback API │
│ LiveDiffViewer  │◀────│ ExecutionResult  │◀────└─────────────────┘
│ (Real-time)     │     │  - Progress      │
│  - Diffs        │     │  - File changes  │
│  - Statistics   │     │  - Errors       │
└─────────────────┘     └──────────────────┘
```

## Components

### 1. Subagent Orchestrator (`src/services/subagentOrchestrator.ts`)

**Purpose**: Manages pool of concurrent code executions

**Features**:
- Max 3 concurrent executions (configurable)
- 5-minute default timeout per execution
- Priority-based queue management
- Progress streaming via callbacks
- Automatic retry on failure

**Key Methods**:
```typescript
// Submit a task for execution
const executionId = await orchestrator.submit({
  taskId: 'task-123',
  taskTitle: 'Rename variable',
  taskDescription: 'Rename foo to bar',
  files: ['src/utils.ts'],
  priority: 'medium',
  timeout: 300000, // optional
});

// Get execution status
const execution = orchestrator.getExecution(executionId);

// Subscribe to events
const unsubscribe = orchestrator.onEvent((event) => {
  console.log(event.type, event.data);
});

// Cancel execution
orchestrator.cancel(executionId);

// Get statistics
const stats = orchestrator.getStatistics();
```

### 2. Code Execution Panel (`src/components/CodeExecutionPanel.tsx`)

**Purpose**: UI component for displaying execution progress

**Features**:
- Real-time progress bar (0-100%)
- Streaming message log
- File change list with diff previews
- Error display with stack traces
- Execution controls (Execute, Cancel)
- Summary statistics

**Usage**:
```tsx
<CodeExecutionPanel
  taskId={task.id}
  taskTitle={task.title}
  onClose={() => setShowPanel(false)}
/>
```

### 3. Live Diff Viewer (`src/components/LiveDiffViewer.tsx`)

**Purpose**: Real-time diff visualization

**Features**:
- Unified or side-by-side diff view
- Syntax highlighting for code
- Change statistics (additions/deletions)
- File list with change type indicators
- Auto-scroll to latest change

**Usage**:
```tsx
<LiveDiffViewer
  changes={execution.changes}
  autoScroll={true}
  maxHeight="500px"
/>
```

### 4. Rollback Service (`src/services/rollbackService.ts`)

**Purpose**: Undo changes via change journal API

**Features**:
- Single change rollback
- Batch rollback for multiple changes
- Rollback validation (conflict detection)
- Error handling and recovery

**Key Methods**:
```typescript
// Rollback a single change
const result = await rollbackService.rollbackChange(changeId);

// Rollback multiple changes
const result = await rollbackService.rollbackBatch({
  executionId: 'exec-123',
  changeIds: ['change-1', 'change-2'],
  reason: 'User requested',
});

// Validate before rollback
const validation = await rollbackService.validateRollback(changeId);
if (!validation.valid) {
  console.warn('Conflicts:', validation.conflicts);
}

// Get all changes
const changes = await rollbackService.getAllChanges();
```

### 5. Task Execution Hook (`src/hooks/useTaskExecution.ts`)

**Purpose**: React hook for managing task execution

**Features**:
- Execute tasks through orchestrator
- Track execution status and progress
- Handle rollback of completed tasks
- Real-time updates

**Usage**:
```tsx
function TaskView() {
  const { state, executeTask, undoTask } = useTaskExecution();

  const handleExecute = async (task) => {
    await executeTask(task);
  };

  const handleUndo = async (task) => {
    const success = await undoTask(task);
    if (success) {
      console.log('Changes rolled back');
    }
  };

  return (
    <>
      <button onClick={() => handleExecute(task)}>Execute</button>
      {state.status === 'running' && <Progress value={state.progress} />}
      {state.status === 'completed' && <button onClick={() => handleUndo(task)}>Undo</button>}
    </>
  );
}
```

## Backend API

### File Operations

**POST /api/files/:path**
```json
{
  "content": "file content here"
}
```

Response:
```json
{
  "path": "/path/to/file",
  "message": "File written successfully"
}
```

### Change Journal

**GET /api/changes**
- Query params: `limit`, `offset`, `path`
- Returns list of all recorded changes

Response:
```json
{
  "changes": [
    {
      "id": "uuid",
      "path": "/path/to/file",
      "oldContent": "original content",
      "newContent": "new content",
      "timestamp": 1234567890
    }
  ],
  "count": 1
}
```

**GET /api/changes/:id**
- Get specific change by ID

**POST /api/changes/:id/rollback**
- Rollback a change to previous state

Response:
```json
{
  "message": "Change rolled back successfully",
  "path": "/path/to/file"
}
```

## Task Card Updates

The TaskCard component has been enhanced with:

1. **Execute Button** (for pending/blocked tasks)
   - Green button with "Execute" label
   - Shows "Running..." during execution
   - Disabled when already running

2. **Undo Button** (for completed tasks)
   - Orange button with "Undo" label
   - Only appears after successful execution
   - Triggers rollback via change journal

3. **Destructive Operation Confirmation**
   - Warns user if task contains deletions
   - Shows task title and description
   - Requires explicit confirmation

## Type Definitions

### ExecutionResult
```typescript
interface ExecutionResult {
  executionId: string;
  taskId: string;
  status: ExecutionStatus;
  progress: number; // 0-100
  messages: ProgressMessage[];
  changes: FileChange[];
  startedAt: number;
  completedAt?: number;
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
  metadata: {
    filesModified: number;
    linesChanged: number;
    subagentVersion: string;
  };
}
```

### FileChange
```typescript
interface FileChange {
  path: string;
  changeType: 'create' | 'update' | 'delete';
  oldContent?: string;
  newContent?: string;
  diff?: string; // Unified diff format
  changeId?: string; // For rollback
}
```

## Testing

### Unit Tests

- `src/services/subagentOrchestrator.test.ts`
- `src/services/rollbackService.test.ts`

### Integration Tests

- `tests/integration/renameVariable.test.ts`
  - Complete end-to-end test
  - Executes a rename variable task
  - Verifies file changes
  - Tests rollback functionality

### Manual Tests

- `tests/manual/testRollback.ts`
  - Creates a test file
  - Modifies it
  - Rolls back the change
  - Verifies original content restored

Run manual test:
```bash
# Terminal 1: Start server
npm run server

# Terminal 2: Run test
npx tsx tests/manual/testRollback.ts
```

## Safety Features

### 1. Diff Previews
Every file change shows a diff preview before/after execution.

### 2. Destructive Operation Warnings
Tasks containing "delete" or "remove" trigger a confirmation dialog.

### 3. Rollback Capability
All changes are tracked and can be undone individually or in batches.

### 4. Conflict Detection
Rollback service detects conflicts with newer changes.

### 5. Timeout Protection
Executions automatically timeout after 5 minutes (configurable).

### 6. Progress Streaming
Real-time updates show exactly what's happening.

## Configuration

### Subagent Pool Configuration
```typescript
const config: SubagentPoolConfig = {
  maxConcurrent: 3,      // Maximum parallel executions
  defaultTimeout: 300000, // 5 minutes in milliseconds
  retryAttempts: 2,       // Retry failed executions
  retryDelay: 1000,       // Delay between retries (ms)
};
```

Modify in `src/services/subagentOrchestrator.ts`:
```typescript
const orchestrator = new SubagentOrchestrator({
  maxConcurrent: 5,        // Increase pool size
  defaultTimeout: 600000,  // 10 minutes
});
```

## Troubleshooting

### Execution Stuck at "Queued"
- Check if pool is full: `orchestrator.getStatistics()`
- Verify maxConcurrent setting
- Check for long-running executions

### Rollback Fails
- Verify change ID exists in journal
- Check for conflicts with newer changes
- Ensure file path is accessible

### No Diff Showing
- Verify file has both oldContent and newContent
- Check if changeType is 'delete' (no diff for deletions)
- Ensure diff generation is enabled

## Future Enhancements

1. **Real Subagent Integration**
   - Currently simulates execution
   - Integrate with actual AI service for code generation

2. **Conflict Resolution**
   - Smart merge for conflicting changes
   - Interactive conflict resolution UI

3. **Change Review**
   - Code review workflow before applying changes
   - Approve/reject individual changes

4. **Execution History**
   - Persistent execution history
   - Analytics and insights

5. **Multi-file Operations**
   - Atomic multi-file changes
   - Transaction-style commits

## Summary

Phase 3 delivers a complete code execution system with:
- ✅ Subagent orchestrator with pool management
- ✅ Real-time progress streaming
- ✅ Live diff viewer
- ✅ Rollback capabilities via change journal
- ✅ Safety features (confirmations, validation)
- ✅ Comprehensive test coverage
- ✅ Integration with existing task system
