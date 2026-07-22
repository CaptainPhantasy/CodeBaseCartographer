# 🗺️ Codebase Cartographer

> **Local development tool with production-grade security architecture.**
>
> All provider keys are stored server-side (environment variables, never sent
> to the browser). Authentication uses JWT (15-min access + 7-day refresh).
> CORS is restricted to a configured origin whitelist. Rate limiting and
> Helmet security headers are active. Safe for local development — for
> public deployment, configure a strong `JWT_SECRET` and an explicit
> `ALLOWED_ORIGINS` env var before exposing to a network.

An AI-powered tool for mapping, visualizing, and understanding complex codebases. Uses multiple LLM providers to trace data flows, generate architecture diagrams, and provide intelligent code analysis.

![Codebase Cartographer](https://img.shields.io/badge/AI-Powered-cyan) ![Multi-Provider](https://img.shields.io/badge/Multi--Provider-LLM-blue) ![React](https://img.shields.io/badge/React-19-61dafb) ![Security-JWT-green) ![CORS-Whitelisted-blue)

## ✨ Features

- **🤖 Multi-Provider LLM Support** - Works with Google Gemini, OpenAI, Anthropic Claude, OpenRouter, and ElevenLabs
- **💬 Intelligent Chat** - Ask questions about your codebase with optional thinking mode and search grounding
- **🗺️ Visual Architecture Maps** - Auto-generates interactive node-link diagrams of your system
- **🎙️ Real-time Voice** - Live audio conversations with your AI assistant
- **🔊 Text-to-Speech** - Read AI responses aloud with natural voices
  - **Auto-Speak** - Automatically reads AI responses with queuing and playback controls
  - **Queue Management** - Pause, resume, skip, or stop speech playback
- **🎬 Video Generation** - Create animated architecture walkthroughs with Veo
- **🎵 Voice Selection** - Choose from your ElevenLabs voice library with preview functionality
- **🔍 Model Selection** - Select from OpenRouter's model catalog with pricing information
- **📁 Codebase Ingestion** - Load and analyze project file structures
- **⚙️ Graceful Degradation** - Features automatically adapt based on configured providers

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- At least one LLM provider key configured in the backend environment (see [Provider Setup](#provider-setup))

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd codebase-cartographer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:7443`

### First Run

On first launch, you'll see the **Setup Wizard** which guides you through:

1. **Select Providers** - Choose which LLM providers you want to use
2. **Configure Tasks** - Map features to your preferred providers
3. **Start Exploring** - Begin mapping your codebase; keys remain server-side

## 🔑 Provider Setup

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
| Chat | ✅ | ✅ | ✅ | ✅ | ❌ |
| Code Analysis | ✅ | ✅ | ✅ | ✅ | ❌ |
| Vision | ✅ | ✅ | ✅ | ✅ | ❌ |
| Text-to-Speech | ✅ | ✅ | ❌ | ❌ | ✅ |
| Speech-to-Text | ✅ | ✅ | ❌ | ❌ | ✅ |
| Video Generation | ✅ (Veo) | ❌ | ❌ | ❌ | ❌ |
| Real-time Voice | ✅ | ✅ | ❌ | ❌ | ✅ |
| Thinking Mode | ✅ | ✅ | ✅ | ✅ | ❌ |
| Search Grounding | ✅ | ❌ | ❌ | ❌ | ❌ |

### Resource Selection Features

After configuring provider keys in the backend environment, the application fetches available resources through the authenticated proxy:

**🎵 ElevenLabs Voice Selection**
- Automatically fetches your available voices through the backend proxy
- Categorizes voices by type (Cloned, Premade, Generated, Other)
- Play voice previews directly in the UI
- View detailed voice information including descriptions and labels
- Select your preferred voice for TTS tasks

**🔍 OpenRouter Model Selection**
- Fetches available models from your OpenRouter account
- Sort models by price (most affordable first)
- View detailed pricing per 1M tokens for both input and output
- Search through hundreds of models by name or ID
- See context length and model capabilities
- Real-time model selection with visual feedback

### Recommended Configuration

For the **best experience**, we recommend:

1. **Google AI (Gemini)** - Best all-around provider with video generation and search grounding
2. **+ OpenAI** - Fallback for text/TTS with high reliability
3. **+ ElevenLabs** (optional) - Premium voice quality for TTS

### Minimum Configuration

For **basic functionality**, you need at least one of:
- Google AI (most features)
- OpenAI (core features)
- Anthropic (text/code only)

## 📁 Project Structure

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
    │   └── adapters/         # Provider-specific adapters
    │       ├── base.ts       # Base adapter interface
    │       ├── google.ts     # Google/Gemini adapter
    │       ├── openai.ts     # OpenAI adapter
    │       ├── anthropic.ts  # Anthropic adapter
    │       ├── openrouter.ts # OpenRouter adapter
    │       └── elevenlabs.ts # ElevenLabs adapter
    ├── services/
    │   ├── resourceFetchers.ts # API resource fetching
    │   └── adapters/         # Provider-specific adapters
    ├── types/
    │   └── capabilities.ts   # Capability type definitions
    └── utils/
        ├── apiKeyValidator.ts # API key validation
        └── capabilityMatrix.ts # Task-provider matching
```

## ⚙️ Configuration

### Environment Variables

Provider API keys are configured server-side. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your keys:

```env
GOOGLE_API_KEY=your_google_key
OPENAI_API_KEY=your_openai_key
# etc. — see .env.example for the full list (auth, CORS, rate limits)
```

**Note:** Keys are read by the backend proxy only (`server/src/llm/keyStore.ts`). The browser never receives them.

### Non-Secret Configuration (browser storage)

The browser stores non-secret settings only. Provider API keys are never
written here — those live in server-side env vars.

- Task mappings and preferences (JSON)
- Voice and model selections (for faster load)
- Import/export via Settings

## 📚 Documentation

Comprehensive documentation is available for different aspects of the application:

- 🏗️ [Architecture](docs/ARCHITECTURE.md) - System architecture diagrams and component relationships
- 🔌 [Adding a Provider](docs/ADDING_A_PROVIDER.md) - Step-by-step guide for adding new LLM providers
- 📚 [API Reference](docs/API_REFERENCE.md) - Complete API documentation for services, hooks, and types
- 🛠️ [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions for providers and setup

### Documentation Overview

| Document | Purpose | Audience |
|---------|---------|----------|
| **Architecture** | Understanding system design and patterns | Developers, Architects |
| **Adding a Provider** | Integration guide for new LLM providers | Developers |
| **API Reference** | Technical API documentation | Developers |
| **Troubleshooting** | Fixing common issues | Users, Developers |

## 🛠️ Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type-check with TypeScript
```

### Adding a New Provider

For detailed instructions, see [Adding a Provider](docs/ADDING_A_PROVIDER.md). Summary:

1. Create adapter in `src/services/adapters/[provider].ts`
2. Add to `src/config/providers.ts`
3. Update type definitions in `src/types/capabilities.ts`
4. Update adapter factory and UI components

### Test Coverage

Run `npm run test:coverage` (client) and `cd server && npm run test:coverage` (server).
Coverage thresholds act as regression guards and fail CI when coverage drops
(baseline 2026-06-11):

| Project | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| Client  | 70% (gate: 68) | 59% (gate: 56) | 73% (gate: 71) | 71% (gate: 69) |
| Server  | 39% (gate: 37) | 78% (gate: 75) | 74% (gate: 71) | 39% (gate: 37) |

HTML reports land in `coverage/index.html` in each project.

## 🔒 Security Notes

> All LLM provider calls are proxied through the authenticated backend
> (`/api/llm/*`). The browser never handles raw API keys.

### Key Storage Security
- Keys live server-side in environment variables: `GOOGLE_API_KEY`, `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `LOCAL_LLM_ENDPOINT`
- The browser never sees the raw keys — it only sends prompts to the authenticated
  `/api/llm/*` proxy
- Configure keys via `.env.local` (already in .gitignore) or your shell environment
- For multi-user deployments, swap `process.env` reads for AWS Secrets Manager /
  HashiCorp Vault (see `server/src/llm/keyStore.ts`)

### Security Posture (Implemented)
| Layer | Implementation | Location |
|-------|----------------|----------|
| Authentication | JWT (access + refresh) | `server/src/middleware/auth.ts` |
| CORS | Origin whitelist (env) | `server/src/server.ts` |
| Security headers | Helmet defaults | `server/src/server.ts` |
| Rate limiting | 100/15m general, 10/1m strict | `server/src/middleware/rateLimit.ts` |
| Key storage | Server-side env vars only | `server/src/llm/keyStore.ts` |
| LLM proxy | All provider calls server-side | `server/src/llm/proxy.ts` |

### Recommended Operational Practices

1. **Strong `JWT_SECRET`**: Set a 32+ byte random value before exposing to a network
2. **Set `ALLOWED_ORIGINS`**: Lock the CORS origin to your exact frontend URL
3. **Key Rotation**: Rotate provider API keys on a regular schedule
4. **Least Privilege**: Issue provider keys with the minimum scopes you need
5. **Usage Monitoring**: Watch your provider dashboards for unusual activity

### Production Hardening Checklist
Before deploying to a shared/public network:
- [ ] Set a strong `JWT_SECRET` (32+ random bytes)
- [ ] Set `ALLOWED_ORIGINS` to your exact frontend URL
- [ ] Enable HTTPS at the proxy layer (Caddy, nginx, or cloud LB)
- [ ] Move provider keys from `.env` to a secret manager
- [ ] Configure log rotation and centralized logging
- [ ] Review and tighten rate-limit windows for your traffic profile

### Data Privacy
- API keys remain on the backend and are attached only to outbound requests to their respective providers
- No keys are sent to any third-party services or intermediaries
- No telemetry or analytics data is collected by this application

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vite.dev/)
- Visualization powered by [D3.js](https://d3js.org/)
- LLM providers: Google AI, OpenAI, Anthropic, OpenRouter, ElevenLabs
