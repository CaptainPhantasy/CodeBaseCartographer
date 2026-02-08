# 🗺️ Codebase Cartographer

An AI-powered tool for mapping, visualizing, and understanding complex codebases. Uses multiple LLM providers to trace data flows, generate architecture diagrams, and provide intelligent code analysis.

![Codebase Cartographer](https://img.shields.io/badge/AI-Powered-cyan) ![Multi-Provider](https://img.shields.io/badge/Multi--Provider-LLM-blue) ![React](https://img.shields.io/badge/React-19-61dafb)

## ✨ Features

- **🤖 Multi-Provider LLM Support** - Works with Google Gemini, OpenAI, Anthropic Claude, OpenRouter, and ElevenLabs
- **💬 Intelligent Chat** - Ask questions about your codebase with optional thinking mode and search grounding
- **🗺️ Visual Architecture Maps** - Auto-generates interactive node-link diagrams of your system
- **🎙️ Real-time Voice** - Live audio conversations with your AI assistant
- **🔊 Text-to-Speech** - Read AI responses aloud with natural voices
- **🎬 Video Generation** - Create animated architecture walkthroughs with Veo
- **🎵 Voice Selection** - Choose from your ElevenLabs voice library with preview functionality
- **🔍 Model Selection** - Select from OpenRouter's model catalog with pricing information
- **📁 Codebase Ingestion** - Load and analyze project file structures
- **⚙️ Graceful Degradation** - Features automatically adapt based on configured providers

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- At least one LLM API key (see [Provider Setup](#provider-setup))

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

The app will open at `http://localhost:5173`

### First Run

On first launch, you'll see the **Setup Wizard** which guides you through:

1. **Select Providers** - Choose which LLM providers you want to use
2. **Enter API Keys** - Securely enter your API keys (stored locally)
3. **Configure Tasks** - Map features to your preferred providers
4. **Start Exploring** - Begin mapping your codebase!

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
| Video Generation | ✅ (Veo) | ❌ | ❌ | ❌ | ❌ |
| Real-time Voice | ✅ | ✅ | ❌ | ❌ | ❌ |
| Thinking Mode | ✅ | ✅ | ✅ | ✅ | ❌ |
| Search Grounding | ✅ | ❌ | ❌ | ❌ | ❌ |

### Resource Selection Features

After adding your API keys in the Settings → API Keys tab, the application automatically fetches and displays available resources:

**🎵 ElevenLabs Voice Selection**
- Automatically fetches your available voices after API key validation
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

**Note:** The in-app Settings UI is the recommended way to manage keys. Environment variables serve as fallbacks.

### Local Storage

All configuration is stored in browser localStorage:
- API keys are obfuscated (not encrypted - don't use in shared environments)
- Task mappings and preferences are JSON-stored
- Config can be exported/imported via Settings
- Voice and model selections are cached for faster loading

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

## 🔒 Security Notes

> **⚠️ IMPORTANT SECURITY WARNING**

This application is designed for **localhost development use only**. Before deploying or sharing, please understand the following security limitations:

### Key Storage Security
- API keys are stored in **browser localStorage** with basic obfuscation (not encryption)
- Anyone with access to the browser can extract stored API keys
- **Do not use this app on shared computers or public devices**
- **Do not commit `.env.local` files to version control** (already in .gitignore)

### Recommended Security Practices

1. **Local Development Only**: Run this application only on your personal development machine
2. **Environment Variables**: Use `.env.local` for API keys instead of the in-app settings when possible
3. **Key Rotation**: Regularly rotate your API keys, especially if you suspect exposure
4. **Permissions**: Use API keys with minimal required permissions/scopes
5. **Monitoring**: Monitor your API provider's usage dashboard for unusual activity

### Production Deployment
For production use, you must implement:
- **Server-side key management** (never expose keys to clients)
- **Authentication/Authorization** to control access
- **Backend proxy** for all LLM API calls
- **Secure key vault** (e.g., AWS Secrets Manager, Azure Key Vault)

### Data Privacy
- API keys are sent **directly to their respective providers only**
- No keys are sent to any third-party services or intermediaries
- No telemetry or analytics data is collected by this application

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vite.dev/)
- Visualization powered by [D3.js](https://d3js.org/)
- LLM providers: Google AI, OpenAI, Anthropic, OpenRouter, ElevenLabs