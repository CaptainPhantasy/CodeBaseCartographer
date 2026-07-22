/**
 * LLM Proxy — forwards requests to provider APIs using raw fetch()
 * No SDK dependencies. API keys injected from env vars.
 */

import { getApiKey } from './keyStore.js';
import type {
  ProxyProviderId,
  GenerateTextRequest,
  GenerateStructuredRequest,
  TTSRequest,
  STTRequest,
  TextGenerationResult,
  TTSResult,
  STTResult,
} from './types.js';
import { ProxyError } from './types.js';

// ---------- Provider API response types ----------

interface ProviderEndpoint {
  baseUrl: string;
  headers: (apiKey: string) => Record<string, string>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

interface AnthropicBlock {
  type: 'text' | 'thinking';
  text?: string;
  thinking?: string;
}

interface AnthropicResponse {
  content: AnthropicBlock[];
  usage: { input_tokens: number; output_tokens: number };
}

interface GooglePart {
  text?: string;
  inlineData?: { data: string; mimeType: string };
}

interface GoogleCandidate {
  content: { parts: GooglePart[] };
  groundingMetadata?: {
    groundingChunks: Array<{ web?: { uri: string } }>;
  };
}

interface GoogleResponse {
  candidates: GoogleCandidate[];
}

interface ElevenLabsSTTResponse {
  text: string;
  language?: string;
  confidence?: number;
  word_count?: number;
}

interface OpenAIWhisperResponse {
  text: string;
  language?: string;
}

interface ProviderErrorBody {
  error?: { message?: string };
  message?: string;
}

const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    headers: (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }),
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    headers: (key) => ({
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://codebasecartographer.app',
    }),
  },
};

// ---------- Helpers ----------

function requireKey(providerId: ProxyProviderId): string {
  const key = getApiKey(providerId);
  if (!key) {
    throw new ProxyError(`No API key configured for ${providerId}`, 'NO_KEY', 400, providerId);
  }
  return key;
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'Provider request timed out'
      : 'Provider request failed';
    throw new ProxyError(message, 'PROVIDER_ERROR', 502);
  }
  if (!response.ok) {
    let body: ProviderErrorBody = {};
    try { body = await response.json() as ProviderErrorBody; } catch { /* keep default empty */ }
    const msg = body.error?.message || body.message || `HTTP ${response.status}`;
    throw new ProxyError(msg, 'PROVIDER_ERROR', 502);
  }
  return response.json();
}

function buildOpenAIHistory(options: GenerateTextRequest['options']): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (options?.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  if (options?.history) {
    for (const msg of options.history.slice(0, -1)) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text,
      });
    }
  }
  return messages;
}

// ---------- Text generation ----------

export async function proxyGenerateText(req: GenerateTextRequest): Promise<TextGenerationResult> {
  const { providerId, modelId, prompt, options = {} } = req;
  const apiKey = requireKey(providerId);

  switch (providerId) {
    case 'openai':
    case 'openrouter':
      return openaiGenerateText(apiKey, providerId, modelId, prompt, options);
    case 'anthropic':
      return anthropicGenerateText(apiKey, providerId, modelId, prompt, options);
    case 'google':
      return googleGenerateText(apiKey, providerId, modelId, prompt, options);
    case 'local_llm':
      return localLLMGenerateText(apiKey, providerId, modelId, prompt, options);
    default:
      throw new ProxyError(`Provider ${providerId} does not support text generation`, 'UNSUPPORTED', 400, providerId);
  }
}

// ---------- Structured output ----------

export async function proxyGenerateStructured<T>(req: GenerateStructuredRequest): Promise<T> {
  const { providerId, modelId, prompt, schema, options = {} } = req;
  const apiKey = requireKey(providerId);

  switch (providerId) {
    case 'openai':
    case 'openrouter':
      return openaiStructuredOutput<T>(apiKey, providerId, modelId, prompt, schema, options);
    case 'anthropic':
      return anthropicStructuredOutput<T>(apiKey, providerId, modelId, prompt, schema, options);
    case 'google':
      return googleStructuredOutput<T>(apiKey, providerId, modelId, prompt, schema, options);
    case 'local_llm':
      return localLLMStructuredOutput<T>(apiKey, providerId, modelId, prompt, schema, options);
    default:
      throw new ProxyError(`Provider ${providerId} does not support structured output`, 'UNSUPPORTED', 400, providerId);
  }
}

// ---------- TTS ----------

export async function proxyTTS(req: TTSRequest): Promise<TTSResult> {
  const { providerId, modelId, text, options = {} } = req;
  const apiKey = requireKey(providerId);

  switch (providerId) {
    case 'openai':
      return openaiTTS(apiKey, modelId, text, options);
    case 'elevenlabs':
      return elevenlabsTTS(apiKey, modelId, text, options);
    case 'google':
      return googleTTS(apiKey, modelId, text, options);
    default:
      throw new ProxyError(`Provider ${providerId} does not support TTS`, 'UNSUPPORTED', 400, providerId);
  }
}

// ---------- STT ----------

export async function proxySTT(req: STTRequest): Promise<STTResult> {
  const { providerId, modelId, audioData, options = {} } = req;
  const apiKey = requireKey(providerId);

  switch (providerId) {
    case 'elevenlabs':
      return elevenlabsSTT(apiKey, modelId, audioData, options);
    case 'openai':
      return openaiSTT(apiKey, modelId, audioData, options);
    case 'google':
      return googleSTT(apiKey, modelId, audioData, options);
    default:
      throw new ProxyError(`Provider ${providerId} does not support STT`, 'UNSUPPORTED', 400, providerId);
  }
}

// ---------- Provider-specific: OpenAI-compatible (openai, openrouter) ----------

async function openaiGenerateText(
  apiKey: string, providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, options: GenerateTextRequest['options'] = {}
): Promise<TextGenerationResult> {
  const ep = PROVIDER_ENDPOINTS[providerId];
  if (!ep) throw new ProxyError(`Unknown endpoint for ${providerId}`, 'NO_ENDPOINT', 500, providerId);
  const model = modelId || 'gpt-4o-mini';
  const messages = buildOpenAIHistory(options);

  if (options.imagePart && options.mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${options.mimeType};base64,${options.imagePart}` } },
        { type: 'text', text: prompt },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const data = await fetchJson(`${ep.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: ep.headers(apiKey),
    body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens }),
  }) as OpenAIResponse;

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 },
  };
}

async function openaiStructuredOutput<T>(
  apiKey: string, providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, schema: object, options: GenerateStructuredRequest['options'] = {}
): Promise<T> {
  const ep = PROVIDER_ENDPOINTS[providerId];
  if (!ep) throw new ProxyError(`Unknown endpoint for ${providerId}`, 'NO_ENDPOINT', 500, providerId);
  const model = modelId || 'gpt-4o-mini';
  const messages: ChatMessage[] = [
    { role: 'system', content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations.` },
    { role: 'user', content: prompt },
  ];

  const data = await fetchJson(`${ep.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: ep.headers(apiKey),
    body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.3, max_tokens: options.maxTokens, response_format: { type: 'json_object' } }),
  }) as OpenAIResponse;

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProxyError('Empty response from provider', 'EMPTY_RESPONSE', 502, providerId);
  return JSON.parse(content) as T;
}

// ---------- Provider-specific: Anthropic ----------

async function anthropicGenerateText(
  apiKey: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, options: GenerateTextRequest['options'] = {}
): Promise<TextGenerationResult> {
  const model = modelId || 'claude-3-5-haiku-20241022';
  const messages: Array<{ role: string; content: string | unknown[] }> = [];
  if (options.history) {
    for (const msg of options.history.slice(0, -1)) {
      messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.text });
    }
  }
  if (options.imagePart && options.mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: options.mimeType, data: options.imagePart } },
        { type: 'text', text: prompt },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const body: Record<string, unknown> = { model, messages, max_tokens: options.maxTokens || 4096 };
  if (options.systemPrompt) body.system = options.systemPrompt;
  if (options.useThinking) body.thinking = { type: 'enabled', budget_tokens: 16000 };

  const data = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  }) as AnthropicResponse;

  let text = '';
  let thinkingContent = '';
  for (const block of data.content || []) {
    if (block.type === 'text' && block.text) text += block.text;
    else if (block.type === 'thinking' && block.thinking) thinkingContent += block.thinking;
  }
  return {
    text,
    thinkingContent: thinkingContent || undefined,
    usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 },
  };
}

async function anthropicStructuredOutput<T>(
  apiKey: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, schema: object, options: GenerateStructuredRequest['options'] = {}
): Promise<T> {
  const model = modelId || 'claude-3-5-haiku-20241022';
  const systemPrompt = `You must respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\nRespond ONLY with valid JSON, no explanations or markdown code blocks.`;

  const data = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, system: systemPrompt, messages: [{ role: 'user', content: prompt }], max_tokens: options.maxTokens || 4096 }),
  }) as AnthropicResponse;

  const text = data.content?.[0]?.text || '{}';
  return JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim()) as T;
}

// ---------- Provider-specific: Google Gemini (REST API) ----------

async function googleGenerateText(
  apiKey: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, options: GenerateTextRequest['options'] = {}
): Promise<TextGenerationResult> {
  const model = modelId || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: Array<{ role: string; parts: GooglePart[] }> = [];
  if (options.history) {
    for (const msg of options.history.slice(0, -1)) {
      contents.push({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] });
    }
  }

  const parts: GooglePart[] = [];
  if (options.imagePart && options.mimeType) {
    parts.push({ inlineData: { data: options.imagePart, mimeType: options.mimeType } });
  }
  parts.push({ text: prompt });
  contents.push({ role: 'user', parts });

  const body: Record<string, unknown> = { contents };
  if (options.systemPrompt) body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  if (options.useSearch) body.tools = [{ googleSearch: {} }];

  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as GoogleResponse;

  let text = '';
  const groundingUrls: string[] = [];
  const candidate = data.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) text += part.text;
    }
  }
  if (candidate?.groundingMetadata?.groundingChunks) {
    for (const chunk of candidate.groundingMetadata.groundingChunks) {
      if (chunk.web?.uri) groundingUrls.push(chunk.web.uri);
    }
  }

  return { text, groundingUrls };
}

async function googleStructuredOutput<T>(
  apiKey: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, schema: object, _options: GenerateStructuredRequest['options'] = {}
): Promise<T> {
  const model = modelId || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
  }) as GoogleResponse;

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new ProxyError('Empty response from Google', 'EMPTY_RESPONSE', 502, 'google');
  return JSON.parse(text) as T;
}

// ---------- Provider-specific: Local LLM (OpenAI-compatible) ----------

async function localLLMGenerateText(
  endpoint: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, options: GenerateTextRequest['options'] = {}
): Promise<TextGenerationResult> {
  const baseUrl = endpoint || 'http://localhost:11434/v1';
  const model = modelId || 'llama3.3';
  const messages = buildOpenAIHistory(options);
  messages.push({ role: 'user', content: prompt });

  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens }),
  }) as OpenAIResponse;

  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 },
  };
}

async function localLLMStructuredOutput<T>(
  endpoint: string, _providerId: ProxyProviderId, modelId: string | undefined,
  prompt: string, schema: object, options: GenerateStructuredRequest['options'] = {}
): Promise<T> {
  const baseUrl = endpoint || 'http://localhost:11434/v1';
  const model = modelId || 'qwen2.5-coder';
  const messages: ChatMessage[] = [
    { role: 'system', content: `Respond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}` },
    { role: 'user', content: prompt },
  ];

  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: options.temperature ?? 0.3, max_tokens: options.maxTokens }),
  }) as OpenAIResponse;

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProxyError('Empty response from local LLM', 'EMPTY_RESPONSE', 502, 'local_llm');
  return JSON.parse(content.replace(/```json\n?|```\n?/g, '').trim()) as T;
}

// ---------- Provider-specific: ElevenLabs ----------

const ELEVENLABS_VOICES: Record<string, string> = {
  rachel: '21m00Tcm4TlvDq8ikWAM', drew: '29vD33N1CtxCmqQRPOHJ', clyde: '2EiwWnXFnvU5JabPnv8n',
  paul: '5Q0t7uMcjvnagumLfvZi', domi: 'AZnzlk1XvdvUeBnXmlld', antoni: 'ErXwobaYiN019PkySvjV',
  adam: 'pNInz6obpgDQGcFmaJgB', bella: 'EXAVITQu4vr4xnSDxMaL',
};

async function elevenlabsTTS(
  apiKey: string, _modelId: string | undefined, text: string, options: TTSRequest['options'] = {}
): Promise<TTSResult> {
  let voiceId = options.voice || '21m00Tcm4TlvDq8ikWAM';
  if (voiceId in ELEVENLABS_VOICES) voiceId = ELEVENLABS_VOICES[voiceId];

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ProviderErrorBody;
    const msg = body.error?.message || `ElevenLabs TTS failed: ${response.status}`;
    throw new ProxyError(msg, 'PROVIDER_ERROR', 502, 'elevenlabs');
  }

  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return { audioData: base64, format: 'mp3' };
}

async function elevenlabsSTT(
  apiKey: string, _modelId: string | undefined, audioData: string, options: STTRequest['options'] = {}
): Promise<STTResult> {
  const audioBuffer = Buffer.from(audioData, 'base64');
  // Node.js 18+ provides global FormData and Blob
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'audio.wav');
  formData.append('model', 'scribe-v2');
  if (options.language) formData.append('language_code', options.language);

  const response = await fetch('https://api.elevenlabs.io/v1/scribe', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ProviderErrorBody;
    const msg = body.error?.message || `ElevenLabs STT failed: ${response.status}`;
    throw new ProxyError(msg, 'PROVIDER_ERROR', 502, 'elevenlabs');
  }

  const result = await response.json() as ElevenLabsSTTResponse;
  return { text: result.text, language: result.language, confidence: result.confidence, word_count: result.word_count };
}

// ---------- Provider-specific: OpenAI TTS/STT ----------

async function openaiTTS(
  apiKey: string, _modelId: string | undefined, text: string, options: TTSRequest['options'] = {}
): Promise<TTSResult> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: options.voice || 'alloy', speed: options.speed }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ProviderErrorBody;
    const msg = body.error?.message || `OpenAI TTS failed: ${response.status}`;
    throw new ProxyError(msg, 'PROVIDER_ERROR', 502, 'openai');
  }

  const audioBuffer = await response.arrayBuffer();
  return { audioData: Buffer.from(audioBuffer).toString('base64'), format: 'mp3' };
}

async function openaiSTT(
  apiKey: string, _modelId: string | undefined, audioData: string, options: STTRequest['options'] = {}
): Promise<STTResult> {
  const audioBuffer = Buffer.from(audioData, 'base64');
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), 'audio.wav');
  formData.append('model', 'whisper-1');
  if (options.language) formData.append('language', options.language);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ProviderErrorBody;
    const msg = body.error?.message || `OpenAI STT failed: ${response.status}`;
    throw new ProxyError(msg, 'PROVIDER_ERROR', 502, 'openai');
  }

  const result = await response.json() as OpenAIWhisperResponse;
  return { text: result.text, language: result.language };
}

// ---------- Provider-specific: Google TTS/STT ----------

async function googleTTS(
  apiKey: string, _modelId: string | undefined, text: string, options: TTSRequest['options'] = {}
): Promise<TTSResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: { parts: [{ text }] },
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voice || 'Kore' } } },
      },
    }),
  }) as GoogleResponse;

  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new ProxyError('No audio data from Google TTS', 'NO_AUDIO', 502, 'google');
  return { audioData, format: 'pcm' };
}

async function googleSTT(
  apiKey: string, _modelId: string | undefined, audioData: string, _options: STTRequest['options'] = {}
): Promise<STTResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const data = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inlineData: { data: audioData, mimeType: 'audio/wav' } }] }],
      systemInstruction: { parts: [{ text: 'Transcribe the audio to text.' }] },
    }),
  }) as GoogleResponse;

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text };
}

// ---------- Voice list ----------

export function getVoices(providerId: ProxyProviderId): string[] {
  switch (providerId) {
    case 'openai': return ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    case 'elevenlabs': return Object.keys(ELEVENLABS_VOICES);
    case 'google': return ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Leda'];
    default: return [];
  }
}
