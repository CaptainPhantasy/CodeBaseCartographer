# CodeBaseCartographer Server

Backend service for CodeBaseCartographer - provides file operations, watching, and task persistence.

## Features

- **File Watching**: Real-time file system monitoring with debounced events and .gitignore support
- **File Operations**: Safe read/write operations with path validation and automatic backups
- **Change Journal**: Complete audit trail with rollback capabilities
- **Task Management**: SQLite-based task persistence with CRUD operations
- **WebSocket Server**: Real-time event broadcasting to connected clients
- **REST API**: Complete HTTP API for all operations

## Installation

```bash
cd server
npm install
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm run test:server

# Build for production
npm run build
```

## Production

```bash
# Build and start
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Files
- `GET /api/files` - List all watched files
- `GET /api/files/:path` - Read file content
- `POST /api/files/:path` - Write file content
- `DELETE /api/files/:path` - Delete a file

### Tasks
- `GET /api/tasks` - List all tasks (with optional filters: status, priority, limit, offset)
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:id` - Get a specific task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task
- `GET /api/tasks/stats/summary` - Get task statistics

### Changes
- `GET /api/changes` - List change journal (with optional filters: limit, offset, path)
- `GET /api/changes/:id` - Get a specific change
- `POST /api/changes/:id/rollback` - Rollback a change

## WebSocket Events

The server broadcasts the following events on port 3001:

- `file:added` - New file detected
- `file:changed` - File modified
- `file:deleted` - File removed
- `task:updated` - Task created, updated, or deleted

## Environment Variables

- `PORT` - HTTP server port (default: 3000)
- `WS_PORT` - WebSocket server port (default: 3001)
- `WATCH_PATH` - Directory to watch (default: current working directory)
- `DB_PATH` - SQLite database path (default: ./tasks.db)

## Architecture

### Modules

- **fileWatcher.ts** - Chokidar wrapper with .gitignore support
- **fileOperator.ts** - Safe file operations with path validation
- **changeJournal.ts** - In-memory change tracking with rollback
- **taskStore.ts** - SQLite database for task persistence
- **webSocketServer.ts** - WebSocket server for real-time updates
- **server.ts** - Express REST API server
- **index.ts** - Application entry point

### Data Models

#### Task
```typescript
{
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  files: string[];
  dependencies: string[];
  createdAt: number;
  updatedAt: number;
}
```

#### Change Record
```typescript
{
  id: string;
  path: string;
  oldContent: string | null;
  newContent: string;
  timestamp: number;
}
```

## Testing

Run the test server to verify all functionality:

```bash
npm run test:server
```

This will:
1. Create a test directory with sample files
2. Start the server
3. Verify file watching works
4. Verify database persistence
5. Display endpoint URLs for manual testing

## License

MIT
