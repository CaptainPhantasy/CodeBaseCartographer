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

## 🛠️ Development

### Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Type-check with TypeScript
```

### Adding a New Provider

1. Create adapter in `src/services/adapters/newprovider.ts`:
```typescript
import { BaseLLMAdapter } from './base';

export class NewProviderAdapter extends BaseLLMAdapter {
  readonly providerId = 'newprovider' as const;
  readonly name = 'New Provider';
  
  // Implement required methods...
}
```

2. Add to `src/config/providers.ts`:
```typescript
export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  // ... existing providers
  newprovider: {
    id: 'newprovider',
    name: 'New Provider',
    models: [/* model definitions */],
    // ...
  }
};
```

3. Export in `src/services/adapters/index.ts`
4. Add to `createAdapter()` factory function
5. Update `ProviderId` type in `src/types/capabilities.ts`

## 🔒 Security Notes

- API keys are stored in browser localStorage with basic obfuscation
- **Do not use in shared/public environments**
- For production, implement proper server-side key management
- No keys are ever sent to third parties (only to their respective API endpoints)

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- Built with [React](https://react.dev/) and [Vite](https://vite.dev/)
- Visualization powered by [D3.js](https://d3js.org/)
- LLM providers: Google AI, OpenAI, Anthropic, OpenRouter, ElevenLabs
