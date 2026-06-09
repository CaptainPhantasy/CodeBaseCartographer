# Changelog

All notable changes to Codebase Cartographer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **JWT authentication**: Bearer-token auth with access (15min) + refresh (7d) tokens.
  Server generates a one-time password at boot when `AUTH_PASSWORD` is unset — never fail-open.
  Client `apiFetch()` wrapper auto-attaches tokens and transparently refreshes on 401.
  `ServerAuthGate` component prompts for password when credentials are needed.
- **CORS hardening**: wildcard `origin: "*"` replaced with explicit `ALLOWED_ORIGINS` whitelist.
  Defaults to Vite dev server origins (`http://localhost:7443`).
- **Security headers**: `helmet()` middleware adds X-Frame-Options, CSP, X-Content-Type-Options, etc.
- **Rate limiting**: general limiter (100 req/15min) on all `/api` routes;
  strict limiter (10 req/min) on ElevenLabs proxy endpoint.
- **SSRF guard on preview proxy**: only `https:` URLs to known ElevenLabs hosts are proxied.

### Added
- `server/src/middleware/auth.ts` — JWT auth middleware, login/refresh routes, env-configurable.
- `server/src/middleware/rateLimit.ts` — tiered rate limiting with env overrides.
- `src/services/apiClient.ts` — authenticated `apiFetch()` wrapper with silent refresh.
- `src/components/ServerAuthGate.tsx` — modal prompting for server password on 401.
- `.github/workflows/ci.yml` — lint + build + test for both client and server.
- 7 new middleware behavioral tests (server).

### Changed
- All client→server `fetch()` calls replaced with `apiFetch()` (tasks, files, changes, voice preview, file open).
- `server/tsconfig.json` lib bumped to ES2024 for `Promise.withResolvers`.

### Planned
- Integration & E2E test suite
- Flowchart accuracy improvements
- Environment-specific configuration
- "Pneumatic tube" flow visualization
## [1.0.0] - 2026-02-10

### Added
- **Multi-Provider LLM Support**: Google Gemini, OpenAI, Anthropic Claude, OpenRouter, ElevenLabs
- **Intelligent Chat Interface**: Ask questions about your codebase with AI assistance
- **Thinking Mode**: Optional verbose reasoning from supported models
- **Search Grounding**: Google-only feature for web-enhanced responses
- **Visual Architecture Maps**: D3.js-powered interactive node-link diagrams
- **Flow Chart Editor**: React Flow-based diagram editor with auto-layout
- **Real-time Voice**: Bidirectional audio conversations with AI assistant
- **Text-to-Speech**: Read AI responses aloud with natural voices
  - Auto-Speak: Automatically reads AI responses
  - Queue Management: Pause, resume, skip, or stop playback
- **Video Generation**: Create animated architecture walkthroughs with Google Veo
- **Voice Selection**: ElevenLabs voice library with preview functionality
- **Model Selection**: OpenRouter model catalog with pricing information
- **Codebase Ingestion**: Load and analyze project file structures
- **File Watching**: Real-time updates when codebase changes
- **Task Management**: AI-generated task tracking with subagent orchestration
- **Setup Wizard**: First-run configuration wizard for provider setup
- **Settings Page**: In-app configuration management
- **Capability Matrix**: Visual display of provider capabilities
- **Feature Detection**: Automatic feature enabling/disabling based on configured providers
- **API Key Validation**: Real-time validation for all provider API keys
- **Graceful Degradation**: Features adapt based on available providers
- **Error Handling**: Centralized error classification and user-friendly messaging
- **Rate Limiting**: Intelligent request queuing and retry mechanisms
- **Configuration Export/Import**: Backup and restore settings

### Security
- **AES-GCM-256 Encryption**: API keys encrypted in localStorage
- **PIN Protection**: Optional 4-6 digit PIN for key access
- **Auto-Lock**: Session locks after 15 minutes of inactivity
- **Session-Only Keys**: Option to never persist API keys to disk
- **Key Sanitization**: API keys removed from error messages and logs

### Documentation
- Architecture documentation with diagrams
- API reference (1200+ lines)
- Troubleshooting guide (1200+ lines)
- Provider integration guide
- Security documentation

### Testing
- 904+ passing unit tests (544 frontend, 360 backend)
- Test coverage for adapters, services, hooks, components
- Error handler test suite (28 tests)

### Tech Stack
- React 19 with TypeScript
- Vite 6.x build system
- Tailwind CSS for styling
- D3.js for visualization
- React Flow (@xyflow/react) for flow charts
- Express backend server
- WebSocket for real-time updates
- sql.js for embedded SQLite database
- Vitest for testing

### Known Issues
- No authentication/authorization system
- Overly permissive CORS configuration
- No Content Security Policy headers
- No rate limiting on API endpoints
- Flowchart accuracy needs improvement (see docs/FLOWCHART_ACCURACY_PLAN.md)
- No integration or E2E tests
- No health check endpoints
- No production monitoring/observability

### Security Warning
> **CRITICAL: This application is designed for localhost development use only.**
> It is NOT production-ready and should NOT be deployed to public servers
> without implementing proper authentication, server-side key management,
> and security hardening. See README.md for details.

## [0.1.0] - 2025-XX-XX

### Added
- Initial proof of concept
- Basic chat interface
- Google Gemini integration
- Simple architecture visualization

---

## Release Stages

| Stage | Status | Description |
|-------|--------|-------------|
| PoC | ✅ Complete | Initial technical validation |
| MVP | ✅ Complete | Core value proposition demonstrated |
| Alpha | ✅ Current | Feature-complete for initial scope, internal testing |
| Beta | 🚧 Planned | External testing, monitoring, stability improvements |
| RC | ⏳ Future | Release candidate, no critical bugs |
| Production | ⏳ Future | Stable, monitored, supported |

---

## Migration Notes

### From 0.x to 1.0.0

No breaking changes. Upgrade by running:
```bash
npm install
npm run build
npm run dev
```

Your existing configuration in localStorage will be preserved. The new encryption system will automatically migrate your API keys on first launch.

---

[Unreleased]: https://github.com/yourusername/codebase-cartographer/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/codebase-cartographer/releases/tag/v1.0.0
[0.1.0]: https://github.com/yourusername/codebase-cartographer/releases/tag/v0.1.0
