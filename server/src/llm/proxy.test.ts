import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProviderStatus } from './keyStore.js';
import {
  getVoices,
  proxyGenerateStructured,
  proxyGenerateText,
  proxySTT,
  proxyTTS,
} from './proxy.js';
import { ProxyError } from './types.js';

describe('server LLM proxy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reports only provider availability and never key values', () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-secret');
    expect(getProviderStatus()).toMatchObject({ openai: true, anthropic: false });
    expect(JSON.stringify(getProviderStatus())).not.toContain('server-secret');
  });

  it('rejects a provider call when its server key is absent', async () => {
    await expect(proxyGenerateText({ providerId: 'openai', modelId: 'gpt-test', prompt: 'map' }))
      .rejects.toMatchObject({ code: 'NO_KEY', statusCode: 400, providerId: 'openai' });
  });

  it('injects the server key into the provider request and returns normalized output', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'mapped' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(proxyGenerateText({ providerId: 'openai', modelId: 'gpt-test', prompt: 'map' }))
      .resolves.toEqual({ text: 'mapped', usage: { inputTokens: 3, outputTokens: 2 } });
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer server-secret' }),
    }));
  });

  it('normalizes provider failures for client fallback without echoing the key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'service unavailable' },
    }), { status: 503 })));

    const error = await proxyGenerateText({ providerId: 'openai', modelId: 'gpt-test', prompt: 'map' }).catch(value => value);
    expect(error).toBeInstanceOf(ProxyError);
    expect(error).toMatchObject({ code: 'PROVIDER_ERROR', statusCode: 502 });
    expect(JSON.stringify(error)).not.toContain('server-secret');
  });

  it('supports Anthropic text with system, history, image, thinking, and usage', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'anthropic-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      content: [{ type: 'thinking', thinking: 'reasoning' }, { type: 'text', text: 'answer' }],
      usage: { input_tokens: 4, output_tokens: 5 },
    }), { status: 200 })));

    await expect(proxyGenerateText({
      providerId: 'anthropic', modelId: 'claude-test', prompt: 'map',
      options: {
        systemPrompt: 'system', useThinking: true, imagePart: 'aW1hZ2U=', mimeType: 'image/png',
        history: [{ role: 'user', text: 'before' }, { role: 'model', text: 'map' }],
      },
    })).resolves.toEqual({
      text: 'answer', thinkingContent: 'reasoning', usage: { inputTokens: 4, outputTokens: 5 },
    });
  });

  it('supports Google text with image, history, system prompt, and grounding', async () => {
    vi.stubEnv('GOOGLE_API_KEY', 'google-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{
        content: { parts: [{ text: 'grounded answer' }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.test/source' } }, {}] },
      }],
    }), { status: 200 })));

    await expect(proxyGenerateText({
      providerId: 'google', prompt: 'map', options: {
        systemPrompt: 'system', useSearch: true, imagePart: 'aW1hZ2U=', mimeType: 'image/png',
        history: [{ role: 'model', text: 'before' }, { role: 'user', text: 'map' }],
      },
    })).resolves.toEqual({ text: 'grounded answer', groundingUrls: ['https://example.test/source'] });
  });

  it('supports local OpenAI-compatible generation at the configured endpoint', async () => {
    vi.stubEnv('LOCAL_LLM_ENDPOINT', 'http://127.0.0.1:11434/v1');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'local answer' } }], usage: {},
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(proxyGenerateText({ providerId: 'local_llm', prompt: 'map' }))
      .resolves.toMatchObject({ text: 'local answer' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/v1/chat/completions', expect.any(Object)
    );
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', { choices: [{ message: { content: '{"ok":true}' } }], usage: {} }],
    ['openrouter', 'OPENROUTER_API_KEY', { choices: [{ message: { content: '{"ok":true}' } }], usage: {} }],
    ['anthropic', 'ANTHROPIC_API_KEY', { content: [{ type: 'text', text: '```json\n{"ok":true}\n```' }], usage: {} }],
    ['google', 'GOOGLE_API_KEY', { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }],
    ['local_llm', 'LOCAL_LLM_ENDPOINT', { choices: [{ message: { content: '```json\n{"ok":true}\n```' } }], usage: {} }],
  ] as const)('supports %s structured output', async (providerId, envName, payload) => {
    vi.stubEnv(envName, providerId === 'local_llm' ? 'http://127.0.0.1:11434/v1' : 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    await expect(proxyGenerateStructured({ providerId, prompt: 'map', schema: { type: 'object' } }))
      .resolves.toEqual({ ok: true });
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', 'mp3'],
    ['elevenlabs', 'ELEVENLABS_API_KEY', 'mp3'],
  ] as const)('supports %s text-to-speech', async (providerId, envName, format) => {
    vi.stubEnv(envName, 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    await expect(proxyTTS({ providerId, text: 'hello', options: { voice: providerId === 'elevenlabs' ? 'rachel' : 'nova' } }))
      .resolves.toMatchObject({ format, audioData: 'AQID' });
  });

  it('supports Google text-to-speech', async () => {
    vi.stubEnv('GOOGLE_API_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { data: 'AQID', mimeType: 'audio/pcm' } }] } }],
    }), { status: 200 })));
    await expect(proxyTTS({ providerId: 'google', text: 'hello' }))
      .resolves.toEqual({ audioData: 'AQID', format: 'pcm' });
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', { text: 'openai transcript', language: 'en' }],
    ['elevenlabs', 'ELEVENLABS_API_KEY', { text: 'eleven transcript', language: 'en', confidence: 0.9, word_count: 2 }],
  ] as const)('supports %s speech-to-text', async (providerId, envName, payload) => {
    vi.stubEnv(envName, 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    await expect(proxySTT({ providerId, audioData: 'AQID', options: { language: 'en' } }))
      .resolves.toMatchObject({ text: payload.text, language: 'en' });
  });

  it('supports Google speech-to-text', async () => {
    vi.stubEnv('GOOGLE_API_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'google transcript' }] } }],
    }), { status: 200 })));
    await expect(proxySTT({ providerId: 'google', audioData: 'AQID' }))
      .resolves.toEqual({ text: 'google transcript' });
  });

  it('rejects unsupported modality/provider combinations', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'server-secret');
    vi.stubEnv('ELEVENLABS_API_KEY', 'server-secret');
    await expect(proxyGenerateText({ providerId: 'elevenlabs', prompt: 'map' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(proxyGenerateStructured({ providerId: 'elevenlabs', prompt: 'map', schema: {} })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(proxyTTS({ providerId: 'anthropic', text: 'hello' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(proxySTT({ providerId: 'anthropic', audioData: 'AQID' })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('returns supported voice names without exposing credentials', () => {
    expect(getVoices('openai')).toContain('alloy');
    expect(getVoices('elevenlabs')).toContain('rachel');
    expect(getVoices('google')).toContain('Kore');
    expect(getVoices('anthropic')).toEqual([]);
  });

  it('normalizes network failures as retryable provider errors', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket closed')));
    await expect(proxyGenerateText({ providerId: 'openai', prompt: 'map' }))
      .rejects.toMatchObject({ code: 'PROVIDER_ERROR', statusCode: 502 });
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', { choices: [], usage: {} }],
    ['google', 'GOOGLE_API_KEY', { candidates: [] }],
    ['local_llm', 'LOCAL_LLM_ENDPOINT', { choices: [], usage: {} }],
  ] as const)('rejects empty %s structured output', async (providerId, envName, payload) => {
    vi.stubEnv(envName, providerId === 'local_llm' ? 'http://127.0.0.1:11434/v1' : 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    await expect(proxyGenerateStructured({ providerId, prompt: 'map', schema: {} }))
      .rejects.toMatchObject({ code: 'EMPTY_RESPONSE' });
  });

  it('rejects Google TTS responses without audio', async () => {
    vi.stubEnv('GOOGLE_API_KEY', 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 })));
    await expect(proxyTTS({ providerId: 'google', text: 'hello' }))
      .rejects.toMatchObject({ code: 'NO_AUDIO' });
  });

  it.each([
    ['openai', 'OPENAI_API_KEY', 'tts'],
    ['elevenlabs', 'ELEVENLABS_API_KEY', 'tts'],
    ['openai', 'OPENAI_API_KEY', 'stt'],
    ['elevenlabs', 'ELEVENLABS_API_KEY', 'stt'],
  ] as const)('normalizes %s %s upstream failures', async (providerId, envName, modality) => {
    vi.stubEnv(envName, 'server-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'upstream rejected request' },
    }), { status: 429 })));
    const request = modality === 'tts'
      ? proxyTTS({ providerId, text: 'hello' })
      : proxySTT({ providerId, audioData: 'AQID' });
    await expect(request).rejects.toMatchObject({ code: 'PROVIDER_ERROR', statusCode: 502 });
  });
});
