# Codebase Cartographer

Codebase Cartographer maps, visualizes, and explains complex codebases. It uses
configurable LLM providers to trace data flows, generate architecture diagrams,
and support interactive code analysis from a local development workstation.

API keys stay on the machine that runs the app. Treat provider credentials as
secrets, prefer the in-app Settings UI or a local `.env.local` file, and do not
publish unauthenticated builds to shared or public hosts.

## Features

- **Multi-provider LLM support** — Google Gemini, OpenAI, Anthropic Claude, OpenRouter, and ElevenLabs
- **Intelligent chat** — Ask questions about your codebase with optional thinking mode and search grounding
- **Visual architecture maps** — Auto-generates interactive node-link diagrams of your system
- **Real-time voice** — Live audio conversations with your AI assistant
- **Text-to-speech** — Read AI responses aloud with natural voices, including auto-speak, queue, pause, resume, skip, and stop controls
- **Video generation** — Create animated architecture walkthroughs with Veo
- **Voice selection** — Choose from your ElevenLabs voice library with preview
- **Model selection** — Browse OpenRouter's model catalog with pricing information
- **Codebase ingestion** — Load and analyze project file structures
- **Graceful degradation** — Features adapt based on the providers you configure

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- At least one LLM API key (see [Provider Setup](#provider-setup))

### Installation

```bash
git clone <repository-url>
cd codebase-cartographer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app opens at `http://localhost:5173`.

### First Run

On first launch, the **Setup Wizard** guides you through:

1. **Select Providers** — Choose which LLM providers you want to use
2. **Enter API Keys** — Enter your API keys (stored locally)
3. **Configure Tasks** — Map features to your preferred providers
4. **Start Exploring** — Begin mapping your codebase

## Provider Setup

### Supported Providers

| Provider | Capabilities | Get API Key |
|----------|-------------|-------------|
| **Google AI (Gemini)** | Text, Code, Vision, TTS, Video, Real-time Voice, Thinking, Search | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **OpenAI** | Text, Code, Vision, TTS, Real-time Voice | [OpenAI Platform](https://platform.openai.com/api-keys) |
| **Anthropic (Claude)** | Text, Code, Vision, Thinking | [Anthropic Console](https://console.anthropic.com/) |
| **OpenRouter** | Text, Code, Vision (via 200+ models) | [OpenRouter](https://openrouter.ai/keys) |
| **ElevenLabs** | Premium TTS | [ElevenLabs](https://elevenlabs.io/api) |

### Capability Matrix

| Feature | Google | OpenAI | Anthropic | OpenRouter | ElevenLabs |
|---------|--------|--------|-----------|------------|------------|
| Chat | Yes | Yes | Yes | Yes | No |
| Code Analysis | Yes | Yes | Yes | Yes | No |
| Vision | Yes | Yes | Yes | Yes | No |
| Text-to-Speech | Yes | Yes | No | No | Yes |
| Speech-to-Text | Yes | Yes | No | No | Yes |
| Video Generation | Yes (Veo) | No | No | No | No |
| Real-time Voice | Yes | Yes | No | No | Yes |
| Thinking Mode | Yes | Yes | Yes | Yes | No |
| Search Grounding | Yes | No | No | No | No |

### Resource Selection Features

After adding your API keys in Settings → API Keys, the application fetches and displays available resources:

**ElevenLabs Voice Selection**
- Fetches available voices after API key validation
- Categorizes voices by type (Cloned, Premade, Generated, Other)
- Plays voice previews directly in the UI
- Shows voice descriptions and labels
- Selects your preferred voice for TTS tasks

**OpenRouter Model Selection**
- Fetches available models from your OpenRouter account
- Sorts models by price (most affordable first)
- Shows pricing per 1M tokens for input and output
- Searches models by name or ID
- Displays context length and capabilities

### Recommended Configuration

For the best experience:

1. **Google AI (Gemini)** — Broadest feature set, including video generation and search grounding
2. **+ OpenAI** — Reliable fallback for text and TTS
3. **+ ElevenLabs** (optional) — Premium voice quality for TTS

### Minimum Configuration

For basic functionality, configure at least one of:

- Google AI (most features)
- OpenAI (core features)
- Anthropic (text/code only)

## Project Structure

```
codebase-cartographer/
├── App.tsx                    # Main application component
├── index.tsx                  # Entry point with ConfigProvider
├── types.ts                   # Core TypeScript types
├── constants.ts               # App constants and prompts
├── components/
│   ├── FlowMap.tsx           # D3-based architecture visualization
│   ├── LiveSession.tsx       # Real-time voice component
│   ├── AssetGenerator.tsx    # Video generation UI
│   └── RepoIngest.tsx        # Codebase file loader
├── services/
│   └── geminiService.ts      # Legacy service (deprecated)
└── src/
    ├── components/
    │   ├── SetupWizard.tsx   # First-run configuration wizard
    │   ├── SettingsPage.tsx  # Settings management UI
    │   ├── VoiceSelector.tsx  # ElevenLabs voice selection UI
    │   ├── ModelSelector.tsx # OpenRouter model selection UI
    │   └── CapabilityMatrix.tsx # Visual capability display
    ├── config/
    │   ├── configManager.ts  # Persistent config storage
    │   └── providers.ts      # Provider definitions
    ├── hooks/
    │   ├── useConfig.tsx     # Config context hook
    │   └── useFeatureAvailability.ts # Feature availability hook
    ├── services/
    │   ├── llmService.ts     # Unified LLM service layer
    │   ├── resourceFetchers.ts # API resource fetching
    │   └── adapters/         # Provider-specific adapters
    │       ├── base.ts       # Base adapter interface
    │       ├── google.ts     # Google/Gemini adapter
    │       ├── openai.ts     # OpenAI adapter
    │       ├── anthropic.ts  # Anthropic adapter
    │       ├── openrouter.ts # OpenRouter adapter
    │       └── elevenlabs.ts # ElevenLabs adapter
    ├── types/
    │   └── capabilities.ts   # Capability type definitions
    └── utils/
        ├── apiKeyValidator.ts # API key validation
        └── capabilityMatrix.ts # Task-provider matching
```

## Configuration

### Environment Variables (Optional)

You can pre-configure API keys via environment variables. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your keys:

```env
VITE_GOOGLE_API_KEY=your_google_key
VITE_OPENAI_API_KEY=your_openai_key
# etc.
```

The in-app Settings UI is the recommended way to manage keys. Environment variables serve as fallbacks.

### Local Storage

Configuration is stored in browser localStorage:

- API keys are obfuscated for local use; do not treat client storage as a vault on shared machines
- Task mappings and preferences are JSON-stored
- Config can be exported/imported via Settings
- Voice and model selections are cached for faster loading

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System architecture diagrams and component relationships
- [Adding a Provider](docs/ADDING_A_PROVIDER.md) — Guide for adding new LLM providers
- [API Reference](docs/API_REFERENCE.md) — Services, hooks, and types
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues and solutions

| Document | Purpose | Audience |
|---------|---------|----------|
| **Architecture** | Understanding system design and patterns | Developers, Architects |
| **Adding a Provider** | Integration guide for new LLM providers | Developers |
| **API Reference** | Technical API documentation | Developers |
| **Troubleshooting** | Fixing common issues | Users, Developers |

## Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type-check with TypeScript
npm test         # Run Vitest suite
```

### Adding a New Provider

For detailed instructions, see [Adding a Provider](docs/ADDING_A_PROVIDER.md). Summary:

1. Create adapter in `src/services/adapters/[provider].ts`
2. Add to `src/config/providers.ts`
3. Update type definitions in `src/types/capabilities.ts`
4. Update adapter factory and UI components

## Security Notes

Codebase Cartographer is intended for local workstation use. It does not ship
with multi-user authentication, server-side key management, rate limiting, or
production CORS/CSP defaults. Keep provider keys private, rotate them if
exposure is suspected, and avoid running the UI on shared or public devices.

### Key Storage

- API keys may be stored in browser localStorage with AES-GCM-256 encryption and PIN protection
- Auto-lock after 15 minutes of inactivity
- Do not commit `.env.local` files (already listed in `.gitignore`)

### Known Hardening Gaps

| Issue | Severity | Status |
|-------|----------|--------|
| No authentication | High | Not implemented |
| Permissive CORS | High | Allows all origins in local server |
| No CSP headers | High | Not implemented |
| No rate limiting | Medium | Not implemented |
| Client-side key storage | Medium | Encrypted but client-accessible |

### Recommended Practices

1. Run on a personal development machine
2. Prefer `.env.local` or the Settings UI for keys; never commit secrets
3. Rotate API keys if you suspect exposure
4. Use keys with the minimum required scopes
5. Monitor provider usage dashboards for unusual activity

### Production Deployment Requirements

Before any shared or hosted deployment, implement:

- Server-side key management (never expose keys to clients)
- Authentication and authorization
- A backend proxy for LLM API calls
- A secure key vault
- Restricted CORS origins
- CSP headers
- Rate limiting

### Data Privacy

- API keys are sent only to their respective providers
- No keys are sent to third-party intermediaries by this application
- No telemetry or analytics are collected by this application

## License

MIT License — see LICENSE for details.

## Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vite.dev/)
- Visualization powered by [D3.js](https://d3js.org/)
- LLM providers: Google AI, OpenAI, Anthropic, OpenRouter, ElevenLabs
