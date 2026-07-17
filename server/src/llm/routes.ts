/**
 * LLM proxy Express routes
 * All routes require auth (mounted behind requireAuth in server.ts)
 */

import { Router, type Request, type Response } from 'express';
import { proxyGenerateText, proxyGenerateStructured, proxyTTS, proxySTT, getVoices } from './proxy.js';
import { getProviderStatus } from './keyStore.js';
import type {
  GenerateTextRequest,
  GenerateStructuredRequest,
  TTSRequest,
  STTRequest,
  ProxyProviderId,
} from './types.js';
import { ProxyError } from './types.js';

export function createLLMRouter(): Router {
  const router = Router();

  // GET /api/llm/providers — which providers have API keys configured
  router.get('/providers', (_req: Request, res: Response) => {
    res.json({ providers: getProviderStatus() });
  });

  // GET /api/llm/voices/:providerId — available TTS voices
  router.get('/voices/:providerId', (req: Request, res: Response) => {
    const { providerId } = req.params;
    const voices = getVoices(providerId as ProxyProviderId);
    res.json({ voices });
  });

  // GET /api/llm/elevenlabs/voices — fetch all voices from ElevenLabs API
  router.get('/elevenlabs/voices', async (_req: Request, res: Response) => {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
      if (!apiKey) {
        res.status(400).json({ voices: [], error: 'ElevenLabs API key not configured on server' });
        return;
      }
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } })) as { error?: { message?: string } };
        res.status(502).json({ voices: [], error: body.error?.message || `ElevenLabs API error: ${response.status}` });
        return;
      }
      const data = await response.json() as { voices: Array<{ voice_id: string; name?: string; category?: string; labels?: Record<string, string>; description?: string; preview_url?: string }> };
      const voices = (data.voices ?? []).map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
        description: v.description,
        preview_url: v.preview_url,
      }));
      res.json({ voices });
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  // GET /api/llm/openrouter/models — fetch available models from OpenRouter
  router.get('/openrouter/models', async (_req: Request, res: Response) => {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY?.trim();
      if (!apiKey) {
        res.status(400).json({ models: [], error: 'OpenRouter API key not configured on server' });
        return;
      }
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        res.status(502).json({ models: [], error: `OpenRouter API error: ${response.status}` });
        return;
      }
      const data = await response.json() as { data: Array<Record<string, unknown>> };
      res.json({ models: data.data || [] });
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  // POST /api/llm/generate — text generation
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const body = req.body as GenerateTextRequest;
      if (!body.providerId || !body.prompt) {
        res.status(400).json({ error: 'providerId and prompt are required' });
        return;
      }
      const result = await proxyGenerateText(body);
      res.json(result);
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  // POST /api/llm/structured — structured JSON output
  router.post('/structured', async (req: Request, res: Response) => {
    try {
      const body = req.body as GenerateStructuredRequest;
      if (!body.providerId || !body.prompt || !body.schema) {
        res.status(400).json({ error: 'providerId, prompt, and schema are required' });
        return;
      }
      const result = await proxyGenerateStructured(body);
      res.json({ data: result });
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  // POST /api/llm/tts — text-to-speech
  router.post('/tts', async (req: Request, res: Response) => {
    try {
      const body = req.body as TTSRequest;
      if (!body.providerId || !body.text) {
        res.status(400).json({ error: 'providerId and text are required' });
        return;
      }
      const result = await proxyTTS(body);

      // Return base64 audio in JSON envelope (matches client TTSResult type)
      res.json(result);
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  // POST /api/llm/stt — speech-to-text
  router.post('/stt', async (req: Request, res: Response) => {
    try {
      const body = req.body as STTRequest;
      if (!body.providerId || !body.audioData) {
        res.status(400).json({ error: 'providerId and audioData are required' });
        return;
      }
      const result = await proxySTT(body);
      res.json(result);
    } catch (error) {
      handleProxyError(error, res);
    }
  });

  return router;
}

function handleProxyError(error: unknown, res: Response): void {
  if (error instanceof ProxyError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      providerId: error.providerId,
    });
    return;
  }
  console.error('[LLM Proxy] Unexpected error:', error);
  res.status(500).json({ error: 'Internal proxy error' });
}
