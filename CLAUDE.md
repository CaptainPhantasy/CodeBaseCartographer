---

# ⚠️  ARCHIVED DOCUMENTATION

**Status:** ARCHIVAL - NOT RELEVANT TO CURRENT CODE WORK  
**Archived:** February 8, 2026  
**Location:** docs/archive/

This document is preserved for historical reference only. For current documentation, see:
- [Current Docs Index](../README.md)
- [Main README](../../README.md)

---
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Codebase Cartographer** is an AI-powered tool for mapping, visualizing, and understanding complex codebases. It uses multiple LLM providers (Google Gemini, OpenAI, Anthropic, OpenRouter, ElevenLabs) to trace data flows, generate architecture diagrams, and provide intelligent code analysis.

## Common Commands

### Development
```bash
npm run dev        # Start development server on port 3000
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build
npm run lint       # TypeScript type check only (no ESLint)
```

### Testing
```bash
npm test                # Run Vitest tests
npm run test:ui         # Run tests with Vitest UI
npm run test:coverage   # Run tests with coverage report
```

### Single Test
```bash
npx vitest run <test-file-pattern>
```

## Architecture Overview

### Adapter Pattern (Multi-Provider LLM)

The core architecture uses an **adapter pattern** to support multiple LLM providers through a unified interface:

- **Base Adapter**: `src/services/adapters/base.ts` - Abstract `BaseLLMAdapter` class defining the interface
- **Provider Adapters**: `src/services/adapters/` - Individual implementations (google.ts, openai.ts, anthropic.ts, openrouter.ts, elevenlabs.ts)
- **Service Layer**: `src/services/llmService.ts` - `LLMService` class routes requests to appropriate adapters based on task mappings
- **Provider Config**: `src/config/providers.ts` - Provider definitions with models and capabilities
- **Type Definitions**: `src/types/capabilities.ts` - Core types for `ProviderId`, `Capability`, `TaskType`, `ModelDefinition`

### App Modes

The application has multiple views (`AppMode` enum):
- `CHAT` - Main chat interface for asking questions about code
- `MAP` - D3.js-based node-link architecture visualization
- `FLOW_CHART` - Flow chart editor using xyflow
- `ASSETS` - Video/asset generation (if provider supports)
- `TASKS` - Task management interface

### Configuration System

Configuration is managed through:
- **Primary**: In-app Settings UI (localStorage with obfuscation, not encryption)
- **Fallback**: Environment variables in `.env.local` (VITE_* prefix)
- **ConfigManager**: `src/config/configManager.ts` handles persistence and retrieval
- **Context**: `src/hooks/useConfig.tsx` provides config to components

### Capability-Based Feature Detection

Features auto-enable/disable based on configured providers:
- `useFeatureAvailability()` hook checks which capabilities are available
- `TASK_REQUIRED_CAPABILITIES` maps tasks to required capabilities
- UI components use `FeatureTooltip` to show configuration messages for unavailable features

## Key Type Definitions

### ProviderId
```typescript
type ProviderId = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'elevenlabs' | 'local_llm'
```

### Capability
```typescript
type Capability = 'text' | 'code' | 'structured_output' | 'vision' | 'tts' | 'video' | 'realtime_audio' | 'thinking' | 'search_grounding'
```

### TaskType
```typescript
enum TaskType {
  TEXT_GENERATION = 'TEXT_GENERATION',
  GRAPH_GENERATION = 'GRAPH_GENERATION',
  TTS = 'TTS',
  VIDEO = 'VIDEO',
  REALTIME_VOICE = 'REALTIME_VOICE',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  TASK_GENERATION = 'TASK_GENERATION'
}
```

## Adding a New LLM Provider

1. Create adapter in `src/services/adapters/[provider].ts` extending `BaseLLMAdapter`
2. Add provider definition to `src/config/providers.ts`
3. Update `ProviderId` type in `src/types/capabilities.ts`
4. Add to adapter factory in `src/services/adapters/index.ts`
5. Update environment variable loading in `src/config/configManager.ts`
6. Update UI components (SettingsPage.tsx, SetupWizard.tsx, CapabilityMatrix.tsx)
7. Add validation logic in `src/utils/apiKeyValidator.ts`

See `docs/ADDING_A_PROVIDER.md` for detailed instructions.

## Build System

- **Vite** with React plugin
- **TypeScript** with `tsconfig.json` (target ES2022, bundler resolution)
- **Vitest** for testing with jsdom environment
- **Tailwind CSS** for styling
- No ESLint/Prettier configured (uses `tsc --noEmit` for linting)

## Security Notes

- Designed for **localhost development only**
- API keys stored in localStorage (obfuscated, not encrypted)
- No backend - all API calls go directly to LLM providers
- Never commit `.env.local` files (already in .gitignore)
- For production, implement server-side key management

## Documentation

- `docs/ARCHITECTURE.md` - System architecture diagrams and component relationships
- `docs/ADDING_A_PROVIDER.md` - Integration guide for new LLM providers
- `docs/API_REFERENCE.md` - Complete API documentation
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
