# 🔌 Adding a New LLM Provider

This guide provides a step-by-step process for adding a new LLM provider to the Codebase Cartographer application. Follow these steps to integrate a new provider with minimal friction.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: Create the Adapter](#step-1-create-the-adapter)
- [Step 2: Update Provider Definitions](#step-2-update-provider-definitions)
- [Step 3: Update Type Definitions](#step-3-update-type-definitions)
- [Step 4: Update Adapter Factory](#step-4-update-adapter-factory)
- [Step 5: Add to Config Manager](#step-5-add-to-config-manager)
- [Step 6: Update UI Components](#step-6-update-ui-components)
- [Step 7: Add Validation Logic](#step-7-add-validation-logic)
- [Step 8: Testing Checklist](#step-8-testing-checklist)
- [Common Pitfalls](#common-pitfalls)

## Prerequisites

Before starting, ensure you have:

1. **API Access** to the new LLM provider
2. **API Documentation** for the provider
3. **SDK or HTTP API** specifications
4. **Authentication mechanism** (API key, OAuth, etc.)
5. **Rate limits** and quotas information
6. **Capability matrix** (which features the provider supports)

---

## Step 1: Create the Adapter

Create a new adapter file in `src/services/adapters/[provider].ts`:

```bash
touch src/services/adapters/newprovider.ts
```

### Implementation Template

```typescript
// src/services/adapters/newprovider.ts
import {
  BaseLLMAdapter,
  TextGenerationOptions,
  TextGenerationResult,
  StructuredOutputOptions,
  TTSOptions,
  TTSResult,
  VideoGenerationOptions,
  VideoResult,
  RealtimeConfig,
  RealtimeConnection,
  AdapterError,
  UnsupportedCapabilityError
} from './base';
import type { TaskType, Capability } from '../../types/capabilities';

export interface NewProviderGenerationOptions extends TextGenerationOptions {
  // Add any provider-specific options
  customParam?: string;
}

export interface NewProviderTTSOptions extends TTSOptions {
  // Add any TTS-specific options
  voiceId?: string;
  speakingRate?: number;
}

export class NewProviderAdapter extends BaseLLMAdapter {
  readonly providerId = 'newprovider' as const;
  readonly name = 'New Provider';

  protected apiEndpoint = 'https://api.newprovider.com/v1';
  protected apiKey: string;

  constructor(apiKey: string, modelId?: string) {
    super(apiKey);
    this.apiKey = apiKey;
    // Set default model if provided
    this.defaultModel = modelId || 'new-provider-default-model';
  }

  /**
   * Check if this adapter supports a specific capability
   */
  supportsCapability(capability: string): boolean {
    const capabilities: Capability[] = ['text']; // Add supported capabilities
    return capabilities.includes(capability as Capability);
  }

  /**
   * Generate text response
   */
  async generateText(
    prompt: string,
    options: NewProviderGenerationOptions = {}
  ): Promise<TextGenerationResult> {
    try {
      const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
            ...options.history?.map(h => ({ role: h.role, content: h.text })) || [],
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 1000,
          // Add provider-specific options
          custom_param: options.customParam,
        }),
      });

      if (!response.ok) {
        throw this.parseError(response.status, await response.text());
      }

      const data = await response.json();

      return {
        text: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        // Add any provider-specific metadata
        groundingUrls: data.grounding_urls,
        thinkingContent: data.thinking_content,
      };
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        `NewProvider text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'GENERATION_ERROR',
        this.providerId,
        true // Retryable
      );
    }
  }

  /**
   * Generate structured output
   */
  async generateStructuredOutput<T>(
    prompt: string,
    schema: object,
    options: StructuredOutputOptions = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: `You must respond with a valid JSON object that matches this schema: ${JSON.stringify(schema)}`
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: options.temperature || 0.3,
          max_tokens: options.maxTokens || 2000,
        }),
      });

      if (!response.ok) {
        throw this.parseError(response.status, await response.text());
      }

      const data = await response.json();
      return data.choices[0].message.content as T;
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        `NewProvider structured output failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STRUCTURED_OUTPUT_ERROR',
        this.providerId,
        false // Not retryable
      );
    }
  }

  /**
   * Generate speech from text (if supported)
   */
  async generateSpeech(
    text: string,
    options: NewProviderTTSOptions = {}
  ): Promise<TTSResult> {
    if (!this.supportsCapability('tts')) {
      throw new UnsupportedCapabilityError(this.providerId, 'tts');
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1', // Default TTS model
          input: text,
          voice: options.voice || 'alloy',
          speed: options.speed || 1.0,
          format: options.format || 'mp3',
          // Add any TTS-specific parameters
          voice_id: options.voiceId,
          speaking_rate: options.speakingRate,
        }),
      });

      if (!response.ok) {
        throw this.parseError(response.status, await response.text());
      }

      const audioBlob = await response.blob();
      const audioBase64 = await this.blobToBase64(audioBlob);

      return {
        audioData: audioBase64,
        format: options.format || 'mp3',
      };
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        `NewProvider TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'TTS_ERROR',
        this.providerId,
        true // Retryable
      );
    }
  }

  /**
   * Get available voices for TTS
   */
  getAvailableVoices(): string[] {
    // Return list of available voices
    return ['alloy', 'echo', 'fable', 'nova', 'shimmer'];
  }

  /**
   * Generate video (if supported)
   */
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<VideoResult> {
    if (!this.supportsCapability('video')) {
      throw new UnsupportedCapabilityError(this.providerId, 'video');
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/videos/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3', // Or appropriate video model
          prompt: prompt,
          size: options.resolution || '1024x1024',
          // Add any video-specific parameters
          aspect_ratio: options.aspectRatio,
          duration: options.duration,
        }),
      });

      if (!response.ok) {
        throw this.parseError(response.status, await response.text());
      }

      const data = await response.json();

      return {
        videoUrl: data.video_url,
        duration: data.duration,
      };
    } catch (error) {
      if (error instanceof AdapterError) {
        throw error;
      }
      throw new AdapterError(
        `NewProvider video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VIDEO_ERROR',
        this.providerId,
        false // Not retryable
      );
    }
  }

  /**
   * Connect to real-time audio (if supported)
   */
  async connectRealtime(config: RealtimeConfig): Promise<RealtimeConnection> {
    if (!this.supportsCapability('realtime_audio')) {
      throw new UnsupportedCapabilityError(this.providerId, 'realtime_audio');
    }

    // Implement WebSocket connection or similar
    const ws = new WebSocket(`wss://api.newprovider.com/v1/realtime`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          voice: config.voice || 'alloy',
          system_prompt: config.systemPrompt,
        }
      }));
      config.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        config.onMessage?.(data);

        if (data.type === 'audio_chunk') {
          config.onAudio?.(data.audio);
        }
      } catch (error) {
        console.error('Realtime message error:', error);
      }
    };

    ws.onerror = (error) => {
      config.onError?.(new Error('WebSocket error'));
    };

    ws.onclose = () => {
      config.onClose?.();
    };

    return {
      send: (data: any) => ws.send(JSON.stringify(data)),
      sendAudio: (audioData: ArrayBuffer | string) => {
        if (typeof audioData === 'string') {
          // Convert base64 to ArrayBuffer if needed
          audioData = this.base64ToArrayBuffer(audioData);
        }
        ws.send(audioData);
      },
      close: () => ws.close(),
      isConnected: ws.readyState === WebSocket.OPEN,
    };
  }

  /**
   * Get the best model for a specific task
   */
  getModelForTask(taskType: TaskType): string | null {
    const modelMap = {
      [TaskType.TEXT_GENERATION]: 'new-provider-text-model',
      [TaskType.GRAPH_GENERATION]: 'new-provider-structured-model',
      [TaskType.TTS]: 'new-provider-tts-model',
      [TaskType.VIDEO]: 'new-provider-video-model',
      [TaskType.REALTIME_VOICE]: 'new-provider-realtime-model',
      [TaskType.IMAGE_ANALYSIS]: 'new-provider-vision-model',
      [TaskType.CODE_ANALYSIS]: 'new-provider-code-model',
    };

    return modelMap[taskType] || this.defaultModel;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Parse API error responses
   */
  private parseError(status: number, body: string): AdapterError {
    let errorData;
    try {
      errorData = JSON.parse(body);
    } catch {
      errorData = { error: { message: body } };
    }

    if (status === 401 || status === 403) {
      return new AuthenticationError(this.providerId, errorData.error?.message);
    }

    if (status === 429) {
      const retryAfter = parseInt(errorData.error?.retry_after || '60', 10);
      return new RateLimitError(this.providerId, retryAfter);
    }

    return new AdapterError(
      errorData.error?.message || `API error: ${status}`,
      errorData.error?.code || 'API_ERROR',
      this.providerId,
      status >= 500 // Retry for server errors
    );
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
```

---

## Step 2: Update Provider Definitions

Update `src/config/providers.ts` to include your new provider:

```typescript
// src/config/providers.ts
import type { ProviderDefinition, ModelDefinition } from '../types/capabilities';

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  // ... existing providers

  newprovider: {
    id: 'newprovider' as const,
    name: 'New Provider',
    description: 'Description of New Provider and its capabilities',
    apiEndpoint: 'https://api.newprovider.com/v1',
    authHeaderFormat: 'Authorization: Bearer {apiKey}',
    isAvailable: true,
    docsUrl: 'https://docs.newprovider.com',
    keyInstructions: 'Get your API key from https://newprovider.com/dashboard',
    models: [
      {
        id: 'new-provider-text-model',
        name: 'Text Model',
        capabilities: ['text', 'structured_output'],
        tier: 'balanced',
        contextWindow: 100000,
        maxOutputTokens: 4000,
        supportsStreaming: true,
        costPerMillionTokens: {
          input: 2.50,
          output: 5.00
        }
      },
      {
        id: 'new-provider-vision-model',
        name: 'Vision Model',
        capabilities: ['text', 'vision', 'structured_output'],
        tier: 'smart',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsStreaming: false,
        costPerMillionTokens: {
          input: 5.00,
          output: 10.00
        }
      },
      {
        id: 'new-provider-tts-model',
        name: 'TTS Model',
        capabilities: ['tts'],
        tier: 'fast',
        contextWindow: null,
        maxOutputTokens: null,
        supportsStreaming: false,
        costPerMillionTokens: {
          input: 0,
          output: 15.00
        }
      },
      // Add more models as needed
    ]
  }
};
```

---

## Step 3: Update Type Definitions

Update `src/types/capabilities.ts` to include the new provider:

```typescript
// src/types/capabilities.ts

// Add to ProviderId type
export type ProviderId =
  // ... existing providers
  | 'newprovider';

// Update MODEL_TIERS if needed
export type ModelTier = 'fast' | 'balanced' | 'smart';

// Add any new capabilities if needed
export type Capability =
  // ... existing capabilities
  | 'new_capability'; // Optional
```

---

## Step 4: Update Adapter Factory

Update `src/services/adapters/index.ts` to export the new adapter:

```typescript
// src/services/adapters/index.ts
import { BaseLLMAdapter } from './base';
import { GoogleAdapter } from './google';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { OpenRouterAdapter } from './openrouter';
import { ElevenLabsAdapter } from './elevenlabs';
import { NewProviderAdapter } from './newprovider'; // Add this import

export { BaseLLMAdapter } from './base';
export * from './google';
export * from './openai';
export * from './anthropic';
export * from './openrouter';
export * from './elevenlabs';
export * from './newprovider'; // Add this export

/**
 * Factory function to create adapters
 */
export function createAdapter(
  providerId: ProviderId,
  apiKey: string,
  modelId?: string
): BaseLLMAdapter {
  switch (providerId) {
    case 'google':
      return new GoogleAdapter(apiKey, modelId);
    case 'openai':
      return new OpenAIAdapter(apiKey, modelId);
    case 'anthropic':
      return new AnthropicAdapter(apiKey, modelId);
    case 'openrouter':
      return new OpenRouterAdapter(apiKey, modelId);
    case 'elevenlabs':
      return new ElevenLabsAdapter(apiKey, modelId);
    case 'newprovider': // Add this case
      return new NewProviderAdapter(apiKey, modelId);
    default:
      throw new Error(`Unsupported provider: ${providerId}`);
  }
}
```

---

## Step 5: Add to Config Manager

Update `src/config/configManager.ts` to handle the new provider in environment variable loading:

```typescript
// In loadFromEnvVars method, add:
if (env.VITE_NEWPROVIDER_API_KEY) envKeys.newprovider = env.VITE_NEWPROVIDER_API_KEY;
```

---

## Step 6: Update UI Components

### Update Settings Page

Add the new provider to the settings UI in `src/components/SettingsPage.tsx`:

```typescript
// Add to provider options
const PROVIDER_OPTIONS = [
  { value: 'google', label: 'Google AI (Gemini)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'newprovider', label: 'New Provider' }, // Add this
] as const;
```

### Update Setup Wizard

Add the new provider to the setup wizard in `src/components/SetupWizard.tsx`:

```typescript
// Add to provider list
const PROVIDERS = [
  {
    id: 'newprovider',
    name: 'New Provider',
    description: 'Description of New Provider',
    capabilities: ['text', 'code', 'vision'],
    icon: 'NewProviderIcon',
    website: 'https://newprovider.com',
    pricingLink: 'https://newprovider.com/pricing'
  },
  // ... other providers
];
```

### Update Capability Matrix

Update `src/components/CapabilityMatrix.tsx` to include the new provider:

```typescript
// Add to capability matrix data
const CAPABILITY_MATRIX = {
  google: {
    text: true,
    code: true,
    vision: true,
    tts: true,
    video: false,
    realtime: false,
    thinking: true,
    search: true,
  },
  // ... other providers
  newprovider: {
    text: true,
    code: true,
    vision: true,
    tts: true,
    video: true,
    realtime: false,
    thinking: true,
    search: false,
  },
};
```

---

## Step 7: Add Validation Logic

Update `src/utils/apiKeyValidator.ts` to include validation for the new provider:

```typescript
// Add to validateApiKey function
case 'newprovider':
  return validateNewProviderApiKey(apiKey);
```

Create a validation function:

```typescript
async function validateNewProviderApiKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.newprovider.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return {
        isValid: true,
        providerId: 'newprovider',
      };
    } else {
      const error = await response.json();
      return {
        isValid: false,
        providerId: 'newprovider',
        errorMessage: error.error?.message || 'Invalid API key',
        errorCode: error.error?.code,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      providerId: 'newprovider',
      errorMessage: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}
```

---

## Step 8: Testing Checklist

### Unit Tests

- [ ] Test adapter instantiation
- [ ] Test text generation with various prompts
- [ ] Test structured output generation
- [ ] Test error handling for network errors
- [ ] Test error handling for invalid API keys
- [ ] Test TTS generation (if supported)
- [ ] Test video generation (if supported)
- [ ] Test real-time connection (if supported)

### Integration Tests

- [ ] Test provider selection in LLMService
- [ ] Test fallback logic when primary provider fails
- [ ] Test configuration persistence
- [ ] Test UI integration (settings, setup wizard)

### End-to-End Tests

- [ ] Test complete flow: setup → configuration → usage
- [ ] Test API key validation
- [ ] Test all supported features
- [ ] Test error scenarios (rate limits, auth failures)

### Manual Testing

- [ ] Verify all UI elements appear correctly
- [ ] Test API key entry and validation
- [ ] Test task/provider mappings
- [ ] Test real usage scenarios
- [ ] Test edge cases (empty inputs, large files)

---

## Common Pitfalls

### 1. Missing Capability Declarations
**Problem**: Forgetting to declare all supported capabilities in the adapter.
**Solution**: Double-check the `supportsCapability()` method and ensure it matches the provider's actual capabilities.

### 2. Incorrect Error Handling
**Problem**: Not properly mapping provider-specific errors to AdapterError types.
**Solution**: Implement thorough error parsing and ensure all API errors are wrapped in appropriate error types.

### 3. Missing Rate Limit Handling
**Problem**: Not implementing proper rate limit handling.
**Solution**: Check for 429 status codes and implement retry logic with backoff.

### 4. Authentication Issues
**Problem**: Incorrect authentication header format.
**Solution**: Verify the exact format required by the provider (Bearer token, API key in header, etc.).

### 5. Type Mismatches
**Problem**: TypeScript type mismatches between the base adapter interface and provider-specific implementation.
**Solution**: Ensure all method signatures match exactly and implement all required methods.

### 6. Missing Models Configuration
**Problem**: Forgetting to add the new provider to the PROVIDERS configuration.
**Solution**: Double-check `src/config/providers.ts` and ensure all models are properly defined.

### 7. UI Not Updating
**Problem**: UI components not showing the new provider.
**Solution**: Verify all UI components are updated with the new provider ID and name.

### 8. Environment Variables Not Working
**Problem**: Environment variables not being detected.
**Solution**: Ensure the variable name follows the VITE_ prefix convention and restart the development server.

### 9. Real-time Connection Issues
**Problem**: WebSocket or real-time connection not working.
**Solution**: Verify the WebSocket URL and ensure proper event handling for open, message, error, and close events.

### 10. Performance Issues
**Problem**: Adapter causing performance problems.
**Solution**: Implement proper caching and cleanup mechanisms, especially for connections and large responses.

---

## Additional Resources

- [Adapter Base Interface](../src/services/adapters/base.ts)
- [Provider Configuration](../src/config/providers.ts)
- [Type Definitions](../src/types/capabilities.ts)
- [Example Implementations](../src/services/adapters/)

After completing these steps, your new provider should be fully integrated into the Codebase Cartographer application!