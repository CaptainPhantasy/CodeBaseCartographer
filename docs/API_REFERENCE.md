# 📚 API Reference

This document provides comprehensive API documentation for the Codebase Cartographer application, including service methods, hooks, type definitions, and UI components.

## Table of Contents

- [LLMService](#llmservice)
  - [Public Methods](#public-methods)
  - [Usage Examples](#usage-examples)
- [Resource Fetchers](#resource-fetchers)
  - [fetchElevenLabsVoices](#fetchelevenlabsvoices)
  - [fetchOpenRouterModels](#fetchopenroutermodels)
- [TTS Queue Service](#tts-queue-service)
  - [Overview](#tts-queue-overview)
  - [Singleton Instance](#singleton-instance)
  - [useTTSQueue Hook](#usettsqueue-hook)
- [Configuration API](#configuration-api)
  - [useConfig Hook](#useconfig-hook)
  - [ConfigManager](#configmanager)
  - [Resource Caching Methods](#resource-caching-methods)
- [UI Components](#ui-components)
  - [VoiceSelector](#voiceselector)
  - [ModelSelector](#modelselector)
- [Adapter Interface](#adapter-interface)
  - [BaseLLMAdapter](#basellmadapter)
  - [Provider-Specific Adapters](#provider-specific-adapters)
- [Type Definitions](#type-definitions)
  - [Core Types](#core-types)
  - [Provider Types](#provider-types)
  - [Request/Response Types](#requestresponse-types)
- [Error Types](#error-types)

---

## LLMService

The `LLMService` is the central service class that orchestrates communication with LLM providers through adapter instances.

### Constructor

```typescript
class LLMService {
  constructor(config?: Partial<ServiceConfig>)
}
```

**Parameters:**
- `config` (optional): Configuration object
  - `enableFallback`: Enable automatic fallback to other providers (default: `true`)
  - `maxRetries`: Maximum number of retry attempts (default: `2`)
  - `retryDelay`: Delay between retries in milliseconds (default: `1000`)

### Public Methods

#### `generateText(prompt: string, options?: TextGenerationOptions): Promise<TextGenerationResult>`

Generate text response from a prompt.

**Parameters:**
- `prompt` (string): The text prompt to generate a response for
- `options` (optional): Text generation options
  - `systemPrompt`?: string: System instruction for the model
  - `history`?: Array<{ role: string; text: string }>: Conversation history
  - `temperature`?: number: Randomness (0-2, default: 0.7)
  - `maxTokens`?: number: Maximum output tokens
  - `useThinking`?: boolean: Enable thinking mode (if supported)
  - `useSearch`?: boolean: Enable web search (if supported)
  - `imagePart`?: string: Base64 encoded image for vision models
  - `mimeType`?: string: MIME type of the image

**Returns:** `Promise<TextGenerationResult>`

**Example:**
```typescript
const llmService = getLLMService();
const result = await llmService.generateText(
  'Explain quantum computing in simple terms',
  {
    systemPrompt: 'You are a helpful assistant specialized in technology.',
    temperature: 0.5,
    maxTokens: 500
  }
);

console.log(result.text); // Generated text
console.log(result.usage); // Token usage information
```

#### `chat(history: Array<{ role: string; text: string }>, options?: ChatOptions): Promise<ChatResult>`

Generate a chat response with conversation history.

**Parameters:**
- `history`: Array of conversation messages with `role` and `text` properties
- `options` (optional): Chat-specific options
  - `systemPrompt`?: string: System instruction
  - `useThinking`?: boolean: Enable thinking mode
  - `useSearchGrounding`?: boolean: Enable web search
  - `imagePart`?: string: Base64 image data
  - `mimeType`?: string: Image MIME type

**Returns:** `Promise<ChatResult>` (extends `TextGenerationResult` with metadata)

**Example:**
```typescript
const history = [
  { role: 'user', text: 'Hello, how are you?' },
  { role: 'assistant', text: 'I am doing well, thank you!' },
  { role: 'user', text: 'Can you help me understand machine learning?' }
];

const result = await llmService.chat(history, {
  systemPrompt: 'You are a machine learning expert.',
  useThinking: true
});

console.log(result.text); // Response with conversation context
console.log(result.metadata?.thinking); // Thinking content (if enabled)
console.log(result.metadata?.provider); // Provider used
```

#### `generateStructuredOutput<T>(prompt: string, schema: object, options?: StructuredOutputOptions): Promise<T>`

Generate structured JSON output based on a schema.

**Parameters:**
- `prompt` (string): The prompt for generation
- `schema` (object): JSON schema for the output
- `options` (optional): Structured output options
  - `temperature`?: number: Randomness (default: 0.3)
  - `maxTokens`?: number: Maximum output tokens

**Returns:** `Promise<T>` (Type matches the schema)

**Example:**
```typescript
const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    hobbies: { type: 'array', items: { type: 'string' } }
  },
  required: ['name', 'age']
};

const result = await llmService.generateStructuredOutput<{
  name: string;
  age: number;
  hobbies: string[];
}>(
  'Generate a profile for a software developer',
  schema
);

console.log(result.name); // Developer's name
console.log(result.age); // Developer's age
console.log(result.hobbies); // Array of hobbies
```

#### `generateGraphData(description: string): Promise<GraphData>`

Generate graph data for architecture visualization.

**Parameters:**
- `description` (string): Description of the system to map

**Returns:** `Promise<GraphData>`

**Example:**
```typescript
const graphData = await llmService.generateGraphData(
  'An e-commerce application with user authentication, product catalog, shopping cart, and payment processing'
);

console.log(graphData.nodes); // Array of nodes
console.log(graphData.links); // Array of links between nodes
```

#### `generateSpeech(text: string, options?: TTSOptions): Promise<TTSResult>`

Generate speech from text (Text-to-Speech).

**Parameters:**
- `text` (string): Text to convert to speech
- `options` (optional): TTS options
  - `voice`?: string: Voice identifier
  - `speed`?: number: Speech speed (0.25-4.0, default: 1.0)
  - `format`?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm': Audio format

**Returns:** `Promise<TTSResult>`

**Example:**
```typescript
const audioResult = await llmService.generateSpeech(
  'Hello, this is a text-to-speech conversion.',
  {
    voice: 'alloy',
    speed: 1.2,
    format: 'mp3'
  }
);

// Play audio
const audio = new Audio(`data:audio/mp3;base64,${audioResult.audioData}`);
audio.play();
```

#### `generateVideo(prompt: string, options?: VideoGenerationOptions): Promise<VideoResult>`

Generate video from text prompt (Video Generation).

**Parameters:**
- `prompt` (string): Text prompt for video generation
- `options` (optional): Video generation options
  - `imageBase64`?: string: Base64 image for image-to-video
  - `imageMimeType`?: string: MIME type of the image
  - `aspectRatio`?: '16:9' | '9:16': Video aspect ratio
  - `resolution`?: '720p' | '1080p': Video resolution
  - `duration`?: number: Video duration in seconds

**Returns:** `Promise<VideoResult>`

**Example:**
```typescript
const videoResult = await llmService.generateVideo(
  'A serene mountain landscape at sunrise',
  {
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: 30
  }
);

console.log(videoResult.videoUrl); // URL to the generated video
console.log(videoResult.duration); // Duration in seconds
```

#### `connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection>`

Connect to real-time audio API for bidirectional voice communication.

**Parameters:**
- `config`: Real-time configuration
  - `voice`?: string: Voice for AI
  - `systemPrompt`?: string: System instruction
  - `onOpen`?: () => void: Callback when connection opens
  - `onMessage`?: (message: any) => void: Callback for messages
  - `onAudio`?: (audioData: string) => void: Callback for audio data
  - `onError`?: (error: Error) => void: Callback for errors
  - `onClose`?: () => void: Callback when connection closes

**Returns:** `Promise<RealtimeConnection>`

**Example:**
```typescript
const realtime = await llmService.connectRealtime({
  voice: 'alloy',
  systemPrompt: 'You are a helpful assistant.',
  onOpen: () => console.log('Connection opened'),
  onMessage: (msg) => console.log('Received message:', msg),
  onAudio: (audio) => {
    // Process incoming audio
    const audioElement = new Audio(`data:audio/webm;base64,${audio}`);
    audioElement.play();
  },
  onError: (error) => console.error('Realtime error:', error),
  onClose: () => console.log('Connection closed')
});

// Send audio data
realtime.sendAudio(audioBuffer);

// Send text message
realtime.send({
  type: 'conversation.item.create',
  content: { type: 'text', text: 'Hello!' }
});
```

#### `getFeatureAvailability(): FeatureAvailability`

Check availability of all features based on current configuration.

**Returns:** `FeatureAvailability` object with boolean flags

**Example:**
```typescript
const features = llmService.getFeatureAvailability();
console.log(features.isTextAvailable); // true if text generation is available
console.log(features.isTTSAvailable); // true if TTS is available
console.log(features.isVideoAvailable); // true if video generation is available
```

#### `isTaskAvailable(taskType: TaskType): boolean`

Check if a specific task is available with current configuration.

**Parameters:**
- `taskType`: The task type to check

**Returns:** `boolean` indicating availability

**Example:**
```typescript
if (llmService.isTaskAvailable(TaskType.VIDEO)) {
  console.log('Video generation is available');
} else {
  console.log('Video generation is not configured');
}
```

#### `clearCache(): void`

Clear the adapter cache (call when API keys change).

---

## Resource Fetchers

### fetchElevenLabsVoices

Fetch all available voices for an ElevenLabs API key.

```typescript
async function fetchElevenLabsVoices(
  apiKey: string
): Promise<{ voices: ElevenLabsVoice[]; error?: string }>
```

**Parameters:**
- `apiKey` (string): Valid ElevenLabs API key

**Returns:** `Promise<{ voices: ElevenLabsVoice[]; error?: string }>`
- `voices`: Array of available ElevenLabs voices
- `error`: Error message if request failed

**Example:**
```typescript
import { fetchElevenLabsVoices } from '../services/resourceFetchers';

const result = await fetchElevenLabsVoices('your-api-key');

if (result.error) {
  console.error('Failed to fetch voices:', result.error);
} else {
  console.log('Available voices:', result.voices);
  // Use voices in UI or save to config
}
```

### fetchOpenRouterModels

Fetch all available models from OpenRouter.

```typescript
async function fetchOpenRouterModels(
  apiKey: string
): Promise<{ models: OpenRouterModel[]; error?: string }>
```

**Parameters:**
- `apiKey` (string): Valid OpenRouter API key

**Returns:** `Promise<{ models: OpenRouterModel[]; error?: string }>`
- `models`: Array of available OpenRouter models
- `error`: Error message if request failed

**Example:**
```typescript
import { fetchOpenRouterModels } from '../services/resourceFetchers';

const result = await fetchOpenRouterModels('your-api-key');

if (result.error) {
  console.error('Failed to fetch models:', result.error);
} else {
  console.log('Available models:', result.models);
  // Use models in UI or save to config
}
```

---

## TTS Queue Service

### TTS Queue Overview

The TTS Queue Service (`src/services/ttsQueueService.ts`) manages text-to-speech playback with:
- **Sequential queue** - Speech requests play one at a time, in order
- **Deduplication** - Identical text in queue is automatically removed
- **Playback controls** - Pause/resume/skip/stop functionality
- **State tracking** - Real-time playback state (idle, loading, playing, paused)

This prevents overlapping audio when multiple TTS requests are triggered rapidly (e.g., streaming responses or auto-speak).

### Singleton Instance

```typescript
import { ttsQueueService } from '../services/ttsQueueService';
```

#### Methods

##### `enqueue(text: string, voice?: string, priority?: number): string`

Add text to the speech queue.

**Parameters:**
- `text` (string): Text to speak
- `voice` (optional): Voice ID to use
- `priority` (optional): Higher values jump the queue (default: 0)

**Returns:** `string` - Unique speech ID

##### `dequeue(id: string): boolean`

Remove a speech from queue or skip if currently playing.

**Parameters:**
- `id` (string): Speech ID to remove

**Returns:** `boolean` - True if found and removed

##### `pause(): void`

Pause current playback.

##### `resume(): void`

Resume paused playback.

##### `skip(): void`

Skip current speech and play next in queue.

##### `togglePause(): void`

Toggle between pause and resume.

##### `stop(): void`

Stop all playback and clear the queue.

##### `clearQueue(): void`

Clear queued items without stopping current playback.

##### `getState(): { state: PlaybackState; currentId: string | null; queueLength: number }`

Get current playback state.

**Returns:** State object with:
- `state`: `'idle' | 'loading' | 'playing' | 'paused'`
- `currentId`: Currently playing speech ID or null
- `queueLength`: Number of items in queue

### useTTSQueue Hook

React hook for accessing TTS queue state and controls.

```typescript
import { useTTSQueue } from '../services/ttsQueueService';

function Component() {
  const ttsQueue = useTTSQueue();

  return (
    <div>
      <button onClick={() => ttsQueue.enqueue('Hello world')}>
        Speak
      </button>
      {ttsQueue.isPlaying && (
        <button onClick={ttsQueue.pause}>Pause</button>
      )}
      {ttsQueue.isPaused && (
        <button onClick={ttsQueue.resume}>Resume</button>
      )}
    </div>
  );
}
```

#### Return Type

```typescript
{
  // State
  state: 'idle' | 'loading' | 'playing' | 'paused';
  currentId: string | null;
  queueLength: number;
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;

  // Methods
  enqueue: (text: string, voice?: string, priority?: number) => string;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  skip: () => void;
  stop: () => void;
  clearQueue: () => void;
}
```

#### Usage Examples

**Basic speech enqueue:**
```typescript
const { enqueue } = useTTSQueue();
enqueue('The code analysis is complete.', '21m00Tcm4TlvDq8ikWAM');
```

**Queue state monitoring:**
```typescript
const { isPlaying, queueLength, state } = useTTSQueue();

useEffect(() => {
  if (isPlaying) {
    console.log('Currently speaking');
  }
  if (queueLength > 0) {
    console.log(`${queueLength} items in queue`);
  }
}, [isPlaying, queueLength, state]);
```

**Playback controls:**
```typescript
const { isPlaying, isPaused, togglePause, skip, stop } = useTTSQueue();

return (
  <div className="tts-controls">
    <button onClick={togglePause}>
      {isPlaying ? '⏸' : '▶️'}
    </button>
    <button onClick={skip} disabled={!isPlaying && !isPaused}>
      ⏭
    </button>
    <button onClick={stop}>⏹</button>
  </div>
);
```

**Auto-speak integration:**
```typescript
const { enqueue } = useTTSQueue();
const [autoSpeak, setAutoSpeak] = useState(false);

// Trigger after AI response
useEffect(() => {
  if (autoSpeak && aiResponse) {
    enqueue(aiResponse.text);
  }
}, [aiResponse, autoSpeak]);
```

---

## Configuration API

### useConfig Hook

React hook for accessing configuration context.

```typescript
function useConfig(): ConfigContextValue
```

**Returns:** Configuration context value with:
- `config`: Complete app configuration
- `setProviderKey`: Function to set provider API key
- `setTaskMapping`: Function to set task mappings
- `setPreferences`: Function to set user preferences
- `exportConfig`: Function to export configuration
- `importConfig`: Function to import configuration
- `clearConfig`: Function to clear all configuration

**Example:**
```typescript
import { useConfig } from '../hooks/useConfig';

function Component() {
  const {
    config,
    setProviderKey,
    setTaskMapping,
    exportConfig
  } = useConfig();

  // Set API key for a provider
  setProviderKey('openai', 'sk-...');

  // Set task mapping
  setTaskMapping({
    taskType: TaskType.TEXT_GENERATION,
    primaryProviderId: 'openai',
    primaryModelId: 'gpt-4'
  });

  // Export configuration
  const configJson = exportConfig();

  return <div>Configuration UI</div>;
}
```

### ConfigManager

Core configuration management class.

#### Constructor

```typescript
class ConfigManager
```

#### Methods

##### `getProvider(providerId: ProviderId): ProviderConfig | undefined`

Get configuration for a specific provider.

##### `getApiKey(providerId: ProviderId): string | undefined`

Get decrypted API key for a provider.

##### `setProviderKey(providerId: ProviderId, apiKey: string, isEnabled?: boolean): void`

Set or update a provider's API key.

##### `getEnabledProviders(): ProviderConfig[]`

Get all enabled providers with valid API keys.

##### `getTaskMapping(taskType: TaskType): TaskProviderMapping | undefined`

Get task-to-provider mapping for a specific task.

##### `setTaskMapping(mapping: TaskProviderMapping): void`

Set or update task mapping.

##### `getPreferences(): UserPreferences`

Get user preferences.

##### `setPreferences(preferences: Partial<UserPreferences>): void`

Update user preferences.

##### `exportConfig(): string`

Export configuration as JSON string.

##### `importConfig(jsonString: string): boolean`

Import configuration from JSON string.

**Example:**
```typescript
import { getConfigManager } from '../config/configManager';

const configManager = getConfigManager();

// Set API key
configManager.setProviderKey('google', 'your-api-key');

// Get task mapping
const mapping = configManager.getTaskMapping(TaskType.TEXT_GENERATION);

// Export configuration
const configJson = configManager.exportConfig();
```

### Resource Caching Methods

The following methods manage caching of provider resources (voices and models) in the configuration:

##### `setCachedVoices(providerId: 'elevenlabs', voices: ElevenLabsVoice[]): void`

Cache ElevenLabs voices for a provider.

**Parameters:**
- `providerId`: Must be `'elevenlabs'`
- `voices`: Array of ElevenLabs voices to cache

##### `getCachedVoices(providerId: 'elevenlabs'): ElevenLabsVoice[]`

Get cached ElevenLabs voices for a provider.

**Parameters:**
- `providerId`: Must be `'elevenlabs'`

**Returns:** Array of cached voices or empty array if none cached

##### `setCachedModels(providerId: 'openrouter', models: OpenRouterModel[]): void`

Cache OpenRouter models for a provider.

**Parameters:**
- `providerId`: Must be `'openrouter'`
- `models`: Array of OpenRouter models to cache

##### `getCachedModels(providerId: 'openrouter'): OpenRouterModel[]`

Get cached OpenRouter models for a provider.

**Parameters:**
- `providerId`: Must be `'openrouter'`

**Returns:** Array of cached models or empty array if none cached

##### `setSelectedVoice(providerId: 'elevenlabs', voiceId: string): void`

Set the selected voice ID for ElevenLabs.

**Parameters:**
- `providerId`: Must be `'elevenlabs'`
- `voiceId`: ID of the selected voice

##### `setSelectedModel(providerId: 'openrouter', modelId: string): void`

Set the selected model ID for OpenRouter.

**Parameters:**
- `providerId`: Must be `'openrouter'`
- `modelId`: ID of the selected model

##### `getSelectedResource(providerId: ProviderId): string | undefined`

Get the selected resource (voice or model) ID for a provider.

**Parameters:**
- `providerId`: The provider ID

**Returns:** Selected voice ID (for ElevenLabs) or model ID (for OpenRouter), or undefined if none selected

---

## UI Components

### VoiceSelector

A React component for selecting ElevenLabs voices with preview functionality.

#### Props

```typescript
interface VoiceSelectorProps {
  voices: ElevenLabsVoice[];           // Array of available voices
  selectedVoiceId: string | undefined; // Currently selected voice ID
  onSelectVoice: (voiceId: string) => void; // Callback when voice is selected
  disabled?: boolean;                  // Disable interactions (default: false)
  className?: string;                  // Additional CSS classes (default: '')
}
```

#### Features
- Groups voices by category (cloned, premade, generated, other)
- Shows voice details including name, description, and labels
- Audio preview functionality with play/stop controls
- Visual category badges with icons
- Responsive design with Tailwind CSS

#### Example Usage
```typescript
import { VoiceSelector } from '../components/VoiceSelector';
import { ElevenLabsVoice } from '../types/capabilities';

function VoiceSettings() {
  const voices: ElevenLabsVoice[] = [/* voices from fetchElevenLabsVoices */];
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>();

  return (
    <VoiceSelector
      voices={voices}
      selectedVoiceId={selectedVoiceId}
      onSelectVoice={setSelectedVoiceId}
      disabled={!voices.length}
      className="max-w-md"
    />
  );
}
```

### ModelSelector

A React component for selecting OpenRouter models with pricing information.

#### Props

```typescript
interface ModelSelectorProps {
  models: OpenRouterModel[];           // Array of available models
  selectedModelId: string | null;      // Currently selected model ID
  onSelectModel: (modelId: string | null) => void; // Callback when model is selected
  placeholder?: string;                // Placeholder text (default: 'Select a model...')
  disabled?: boolean;                  // Disable interactions (default: false)
  className?: string;                  // Additional CSS classes (default: '')
}
```

#### Features
- Dropdown with searchable model list
- Pricing information (prompt, completion, total per 1M tokens)
- Color-coded price indicators (green=cheap, red=expensive)
- Context length display
- Clear selection option
- Click-outside-to-close behavior
- Sorted by price (ascending)

#### Example Usage
```typescript
import { ModelSelector } from '../components/ModelSelector';
import { OpenRouterModel } from '../types/capabilities';

function ModelSettings() {
  const models: OpenRouterModel[] = [/* models from fetchOpenRouterModels */];
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  return (
    <ModelSelector
      models={models}
      selectedModelId={selectedModelId}
      onSelectModel={setSelectedModelId}
      placeholder="Choose a model..."
      disabled={!models.length}
      className="max-w-lg"
    />
  );
}
```

---

## Adapter Interface

### BaseLLMAdapter

Abstract base class for all provider adapters.

#### Abstract Methods

##### `supportsCapability(capability: string): boolean`

Check if the adapter supports a specific capability.

**Parameters:**
- `capability` (string): Capability to check

**Returns:** `boolean`

**Example:**
```typescript
if (adapter.supportsCapability('vision')) {
  // Use vision capabilities
}
```

##### `generateText(prompt: string, options?: TextGenerationOptions): Promise<TextGenerationResult>`

Generate text response.

**Parameters:**
- `prompt` (string): Text prompt
- `options` (optional): Generation options

**Returns:** `Promise<TextGenerationResult>`

##### `generateStructuredOutput<T>(prompt: string, schema: object, options?: StructuredOutputOptions): Promise<T>`

Generate structured JSON output.

**Parameters:**
- `prompt` (string): Text prompt
- `schema` (object): JSON schema
- `options` (optional): Generation options

**Returns:** `Promise<T>`

##### `getModelForTask(taskType: TaskType): string | null`

Get the best model for a specific task.

#### Concrete Methods

##### `getAvailableVoices(): string[]`

Get available TTS voices (if supported).

##### `generateSpeech(text: string, options?: TTSOptions): Promise<TTSResult>`

Generate speech (throws `UnsupportedCapabilityError` if not supported).

##### `generateVideo(prompt: string, options?: VideoGenerationOptions): Promise<VideoResult>`

Generate video (throws `UnsupportedCapabilityError` if not supported).

##### `connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection>`

Connect to real-time audio (throws `UnsupportedCapabilityError` if not supported).

---

## Type Definitions

### Core Types

#### TaskType

Enum of supported task types.

```typescript
enum TaskType {
  TEXT_GENERATION = 'TEXT_GENERATION',
  GRAPH_GENERATION = 'GRAPH_GENERATION',
  TTS = 'TTS',
  VIDEO = 'VIDEO',
  REALTIME_VOICE = 'REALTIME_VOICE',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  CODE_ANALYSIS = 'CODE_ANALYSIS'
}
```

#### Capability

Union type of all possible capabilities.

```typescript
type Capability =
  | 'text'
  | 'code'
  | 'structured_output'
  | 'vision'
  | 'tts'
  | 'video'
  | 'realtime_audio'
  | 'thinking'
  | 'search_grounding';
```

#### ProviderId

Union type of supported provider identifiers.

```typescript
type ProviderId =
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'elevenlabs'
  | 'local_llm';
```

### Provider Types

#### ProviderConfig

Provider configuration stored locally.

```typescript
interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string; // Obfuscated
  isEnabled: boolean;
  validatedAt?: string; // ISO date
  isValid?: boolean;
  cachedVoices?: ElevenLabsVoice[]; // For ElevenLabs
  cachedModels?: OpenRouterModel[]; // For OpenRouter
  selectedVoiceId?: string; // For ElevenLabs
  selectedModelId?: string; // For OpenRouter
}
```

#### TaskProviderMapping

Task-to-provider mapping preferences.

```typescript
interface TaskProviderMapping {
  taskType: TaskType;
  primaryProviderId: ProviderId;
  primaryModelId: string;
  fallbackProviderId?: ProviderId;
  fallbackModelId?: string;
}
```

#### UserPreferences

User preference settings.

```typescript
interface UserPreferences {
  preferredTier: 'fast' | 'balanced' | 'smart';
  preferCost: boolean;
  preferSpeed: boolean;
}
```

#### ElevenLabsVoice

Voice information from ElevenLabs.

```typescript
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, any>;
  preview_url?: string;
}
```

#### OpenRouterModel

Model information from OpenRouter.

```typescript
interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    family: string;
    top_k: number;
    top_p: number;
    temperature: number;
    max_length: number;
  };
}
```

### Request/Response Types

#### TextGenerationOptions

Options for text generation.

```typescript
interface TextGenerationOptions {
  systemPrompt?: string;
  history?: Array<{ role: string; text: string }>;
  temperature?: number;
  maxTokens?: number;
  useThinking?: boolean;
  useSearch?: boolean;
  imagePart?: string; // Base64
  mimeType?: string;
}
```

#### TextGenerationResult

Result of text generation.

```typescript
interface TextGenerationResult {
  text: string;
  groundingUrls?: string[];
  thinkingContent?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

#### TTSOptions

Options for text-to-speech.

```typescript
interface TTSOptions {
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}
```

#### TTSResult

Result of text-to-speech generation.

```typescript
interface TTSResult {
  audioData: string; // Base64
  format: string;
}
```

#### VideoGenerationOptions

Options for video generation.

```typescript
interface VideoGenerationOptions {
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  duration?: number;
}
```

#### VideoResult

Result of video generation.

```typescript
interface VideoResult {
  videoUrl: string;
  duration?: number;
}
```

#### RealtimeConfig

Configuration for real-time connections.

```typescript
interface RealtimeConfig {
  voice?: string;
  systemPrompt?: string;
  onOpen?: () => void;
  onMessage?: (message: any) => void;
  onAudio?: (audioData: string) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}
```

#### RealtimeConnection

Real-time connection interface.

```typescript
interface RealtimeConnection {
  send: (data: any) => void;
  sendAudio: (audioData: ArrayBuffer | string) => void;
  close: () => void;
  isConnected: boolean;
}
```

---

## Error Types

### AdapterError

Base error class for adapter-related errors.

```typescript
class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly providerId: ProviderId,
    public readonly isRetryable: boolean = false,
    public readonly retryAfter?: number
  );
}
```

#### RateLimitError

Thrown when rate limits are exceeded.

```typescript
class RateLimitError extends AdapterError {
  constructor(providerId: ProviderId, retryAfter?: number);
}
```

#### AuthenticationError

Thrown when authentication fails.

```typescript
class AuthenticationError extends AdapterError {
  constructor(providerId: ProviderId, message?: string);
}
```

#### UnsupportedCapabilityError

Thrown when requesting an unsupported capability.

```typescript
class UnsupportedCapabilityError extends AdapterError {
  constructor(providerId: ProviderId, capability: string);
}
```

---

## Error Handling Best Practices

1. **Always catch AdapterError** specifically when working with LLMService
2. **Check `isRetryable`** before retrying requests
3. **Handle `retryAfter`** for rate limit errors
4. **Use fallback providers** when available
5. **Show user-friendly messages** for common errors

**Example:**
```typescript
try {
  const result = await llmService.generateText(prompt);
  return result.text;
} catch (error) {
  if (error instanceof RateLimitError) {
    // Handle rate limiting
    await new Promise(resolve => setTimeout(resolve, error.retryAfter));
    return retryGeneration(prompt);
  } else if (error instanceof AuthenticationError) {
    // Handle authentication issues
    showError('Invalid API key. Please check your configuration.');
  } else {
    // Handle other errors
    showError(`Generation failed: ${error.message}`);
  }
}
```