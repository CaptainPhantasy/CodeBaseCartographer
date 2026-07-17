/**
 * voiceOrchestrator.ts - TTS / STT / voice listing through the proxy
 */

import type { TTSOptions, TTSResult, STTOptions, STTResult } from '../adapters/base';
import { getTTSProvider, getSTTProvider } from './providerRouter';
import { proxyTTS, proxySTT, proxyFetchVoices } from './proxyClient';

/** Generate speech from text. */
export async function generateSpeech(text: string, options: TTSOptions = {}): Promise<TTSResult> {
  const provider = await getTTSProvider();

  if (!provider) {
    throw new Error('No TTS provider configured. Set an API key for Google, OpenAI, or ElevenLabs on the server.');
  }

  return proxyTTS(provider.providerId, provider.modelId, text, options);
}

/** Transcribe audio to text. */
export async function transcribeAudio(
  audioData: ArrayBuffer | string,
  options: STTOptions = {}
): Promise<STTResult> {
  const provider = await getSTTProvider();

  if (!provider) {
    throw new Error('No STT provider configured. Set an API key for ElevenLabs, OpenAI, or Google on the server.');
  }

  return proxySTT(provider.providerId, provider.modelId, audioData, options);
}

/** Get available TTS voices for the active provider; empty list when unavailable. */
export async function getAvailableTTSVoices(): Promise<string[]> {
  const provider = await getTTSProvider();
  if (!provider) return [];

  try {
    return await proxyFetchVoices(provider.providerId);
  } catch {
    return [];
  }
}
