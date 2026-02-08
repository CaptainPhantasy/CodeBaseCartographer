# Provider Resource Selection Entry Points

## Overview

Add UI entry points for users to select from their available resources after API key validation.

## Current State

| Provider | Resources | Current Handling | API Endpoint |
|----------|-----------|------------------|--------------|
| **ElevenLabs** | Voices | Hardcoded map of ~30 popular voices | `GET /v1/voices` |
| **OpenRouter** | Models | Hardcoded ~8 models in `providers.ts` | `GET /api/v1/models` |

**Problem:** Users cannot see or select from their full catalog of resources:
- ElevenLabs: custom/cloned voices not visible
- OpenRouter: 400+ models available, only ~8 hardcoded

## Discovery Results

### ElevenLabs - GET /v1/voices
Returns ALL voices for the authenticated user including:
- Premade/default voices
- Custom cloned voices (`category: "cloned"`)
- Shared library voices

```typescript
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;         // 'cloned', 'generated', 'premade', etc.
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
}
```

**Source:** [ElevenLabs List voices endpoint](https://elevenlabs.io/docs/api-reference/voices/search)

### OpenRouter - GET /api/v1/models
Returns ALL available models (400+):

```typescript
interface OpenRouterModel {
  id: string;                // e.g., "openai/gpt-4"
  name: string;
  context_length: number;
  pricing: {
    prompt: string;          // per token
    completion: string;
  };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
}
```

**Source:** [OpenRouter Get models endpoint](https://openrouter.ai/docs/api/api-reference/models/get-models)

---

## Implementation Plan

### Step 1: Add API Fetching Utilities

**File:** `src/services/resourceFetchers.ts` (new)

```typescript
// ElevenLabs
export async function fetchElevenLabsVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey }
  });
  const data = await response.json();
  return data.voices || [];
}

// OpenRouter
export async function fetchOpenRouterModels(apiKey: string): Promise<OpenRouterModel[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await response.json();
  return data.data || [];
}
```

### Step 2: Add Types

**File:** `src/types/capabilities.ts`

```typescript
// ElevenLabs voice
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  description?: string;
  preview_url?: string;
}

// OpenRouter model
export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
  };
}

// Update ProviderConfig to cache fetched resources
export interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string;
  isEnabled: boolean;
  validatedAt?: string;
  isValid?: boolean;

  // NEW: Cache fetched resources
  cachedVoices?: ElevenLabsVoice[];      // elevenlabs only
  cachedModels?: OpenRouterModel[];      // openrouter only

  // NEW: User selections
  selectedVoiceId?: string;              // elevenlabs only
  selectedModelId?: string;              // openrouter only
}
```

### Step 3: Update SettingsPage - Fetch After Validation

**File:** `src/components/SettingsPage.tsx`

After successful API key validation (after line 112):

```typescript
const handleSaveKey = async () => {
  // ... existing validation code ...

  if (result.isValid) {
    await setProviderKey(editingProvider, editState.apiKey, true);
    setProviderValidation(editingProvider, true);

    // NEW: Fetch provider-specific resources
    if (editingProvider === 'elevenlabs') {
      const voices = await fetchElevenLabsVoices(editState.apiKey);
      if (voices.length > 0) {
        setCachedVoices('elevenlabs', voices);
      }
    }

    if (editingProvider === 'openrouter') {
      const models = await fetchOpenRouterModels(editState.apiKey);
      if (models.length > 0) {
        setCachedModels('openrouter', models);
      }
    }

    setEditingProvider(null);
  }
  // ...
};
```

### Step 4: Add Selection UI Components

**File:** `src/components/VoiceSelector.tsx` (new)

```typescript
interface VoiceSelectorProps {
  voices: ElevenLabsVoice[];
  selectedVoiceId?: string;
  onSelectVoice: (voiceId: string) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceId,
  onSelectVoice
}) => {
  // Group by category
  const grouped = voices.reduce((acc, voice) => {
    const cat = voice.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(voice);
    return acc;
  }, {} as Record<string, ElevenLabsVoice[]>);

  return (
    <select value={selectedVoiceId || ''} onChange={(e) => onSelectVoice(e.target.value)}>
      <option value="">Select a voice...</option>
      {Object.entries(grouped).map(([category, categoryVoices]) => (
        <optgroup key={category} label={category}>
          {categoryVoices.map(v => (
            <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};
```

**File:** `src/components/ModelSelector.tsx` (new)

```typescript
interface ModelSelectorProps {
  models: OpenRouterModel[];
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel
}) => {
  return (
    <select value={selectedModelId || ''} onChange={(e) => onSelectModel(e.target.value)}>
      <option value="">Select a model...</option>
      {models.map(m => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.id}) - {m.pricing.prompt}/{m.pricing.completion} per 1M
        </option>
      ))}
    </select>
  );
};
```

### Step 5: Display Selectors in SettingsPage

**File:** `src/components/SettingsPage.tsx`

In the configured providers section (after line 262):

```typescript
{providerConfig.providerId === 'elevenlabs' && providerConfig.cachedVoices && (
  <div className="mt-3 pt-3 border-t border-slate-700/50">
    <VoiceSelector
      voices={providerConfig.cachedVoices}
      selectedVoiceId={providerConfig.selectedVoiceId}
      onSelectVoice={(voiceId) => setSelectedVoice('elevenlabs', voiceId)}
    />
  </div>
)}

{providerConfig.providerId === 'openrouter' && providerConfig.cachedModels && (
  <div className="mt-3 pt-3 border-t border-slate-700/50">
    <ModelSelector
      models={providerConfig.cachedModels}
      selectedModelId={providerConfig.selectedModelId}
      onSelectModel={(modelId) => setSelectedModel('openrouter', modelId)}
    />
  </div>
)}
```

### Step 6: Update Adapters to Use Selections

**File:** `src/services/adapters/elevenlabs.ts`

```typescript
async generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
  // options.voice is now the direct voice_id from selection
  const voiceId = options.voice || '21m00Tcm4TlvDq8ikWAM'; // default Rachel
  // ... rest of implementation
}
```

**File:** `src/services/adapters/openrouter.ts`

Use the selected model ID if configured, otherwise fall back to default model selection logic.

---

## Implementation Checklist

- [ ] Add `ElevenLabsVoice` and `OpenRouterModel` types to `src/types/capabilities.ts`
- [ ] Update `ProviderConfig` with `cachedVoices`, `cachedModels`, `selectedVoiceId`, `selectedModelId`
- [ ] Create `src/services/resourceFetchers.ts` with `fetchElevenLabsVoices` and `fetchOpenRouterModels`
- [ ] Update `src/config/configManager.ts` with caching/setter methods
- [ ] Update `src/hooks/useConfig.tsx` to expose resource management
- [ ] Create `src/components/VoiceSelector.tsx`
- [ ] Create `src/components/ModelSelector.tsx`
- [ ] Update `src/components/SettingsPage.tsx` to fetch after validation and display selectors
- [ ] Update adapters to use user selections

---

## Sources

- [ElevenLabs List voices endpoint](https://elevenlabs.io/docs/api-reference/voices/search)
- [OpenRouter Get models endpoint](https://openrouter.ai/docs/api/api-reference/models/get-models)
