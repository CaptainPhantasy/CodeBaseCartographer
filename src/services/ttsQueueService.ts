/**
 * TTS Queue Service
 *
 * Manages text-to-speech playback with:
 * - Sequential playback queue
 * - Pause/resume/skip controls
 * - Prevents overlapping audio
 */

import React from 'react';

interface QueuedSpeech {
  id: string;
  text: string;
  voice?: string;
  priority?: number;
}

type PlaybackState = 'idle' | 'playing' | 'paused' | 'loading' | 'error';

class TTSQueueService {
  public queue: QueuedSpeech[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private currentState: PlaybackState = 'idle';
  private currentSpeechId: string | null = null;
  private pausedTime: number = 0;
  private listeners: Set<(state: PlaybackState, currentId: string | null) => void> = new Set();

  // Subscribe to state changes
  onStateChange(callback: (state: PlaybackState, currentId: string | null) => void): () => void {
    this.listeners.add(callback);
    // Immediately call with current state
    callback(this.currentState, this.currentSpeechId);
    return () => this.listeners.delete(callback);
  }

  private notifyStateChange() {
    this.listeners.forEach(callback => callback(this.currentState, this.currentSpeechId));
  }

  // Get current state
  getState(): { state: PlaybackState; currentId: string | null; queueLength: number } {
    return {
      state: this.currentState,
      currentId: this.currentSpeechId,
      queueLength: this.queue.length
    };
  }

  // Add speech to queue
  enqueue(text: string, voice?: string, priority: number = 0): string {
    const id = `speech-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Remove any existing queued speech with same text (deduplication)
    this.queue = this.queue.filter(item => item.text !== text);

    const speech: QueuedSpeech = { id, text, voice, priority };

    // Insert in priority order (higher priority first)
    if (priority > 0) {
      const index = this.queue.findIndex(item => (item.priority || 0) < priority);
      if (index === -1) {
        this.queue.push(speech);
      } else {
        this.queue.splice(index, 0, speech);
      }
    } else {
      this.queue.push(speech);
    }

    // If idle, start processing
    if (this.currentState === 'idle') {
      this.processQueue();
    }

    return id;
  }

  // Remove a specific speech from queue (if not yet playing)
  dequeue(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    // If it's currently playing, skip instead
    if (this.currentSpeechId === id) {
      this.skip();
      return true;
    }
    return false;
  }

  // Clear all queued items (doesn't stop current)
  clearQueue(): void {
    this.queue = [];
  }

  // Clear everything including current
  stop(): void {
    this.clearQueue();
    this.skip();
  }

  // Pause current playback
  pause(): void {
    if (this.currentState === 'playing' && this.currentAudio) {
      this.currentAudio.pause();
      this.pausedTime = this.currentAudio.currentTime;
      this.currentState = 'paused';
      this.notifyStateChange();
    }
  }

  // Resume playback
  async resume(): Promise<void> {
    if (this.currentState === 'paused' && this.currentAudio) {
      try {
        // Set playback position before resuming
        this.currentAudio.currentTime = this.pausedTime;
        await this.currentAudio.play();
        this.currentState = 'playing';
        this.notifyStateChange();
      } catch (error) {
        console.error('Failed to resume TTS playback:', error);
        // If resume fails, try to recover by moving to next item
        this.currentState = 'error';
        this.notifyStateChange();
        // Skip to next after a short delay
        setTimeout(() => this.skip(), 500);
      }
    }
  }

  // Skip current speech and move to next
  skip(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentSpeechId = null;
    this.pausedTime = 0;
    this.processQueue();
  }

  // Toggle pause/resume
  togglePause(): void {
    if (this.currentState === 'playing') {
      this.pause();
    } else if (this.currentState === 'paused') {
      this.resume();
    }
  }

  private async processQueue(): Promise<void> {
    // If already processing or nothing in queue, return
    if (this.queue.length === 0) {
      this.currentState = 'idle';
      this.currentSpeechId = null;
      this.notifyStateChange();
      return;
    }

    const speech = this.queue.shift()!;
    this.currentSpeechId = speech.id;
    this.currentState = 'loading';
    this.notifyStateChange();

    try {
      // Import dynamically to avoid circular dependencies
      const { getLLMService } = await import('../services/llmService');
      const { getConfigManager } = await import('../config/configManager');

      // Get user's selected voice if not provided
      let voiceOption = speech.voice;
      if (!voiceOption) {
        const configManager = getConfigManager();
        const elevenlabsConfig = configManager.getEnabledProviders().find(p => p.providerId === 'elevenlabs');
        voiceOption = elevenlabsConfig?.selectedVoiceId;
      }

      const llmService = getLLMService();
      const result = await llmService.generateSpeech(speech.text, voiceOption ? { voice: voiceOption } : undefined);

      if (result.audioData && this.currentSpeechId === speech.id) {
        // Check if we were stopped while loading
        this.currentState = 'playing';
        this.notifyStateChange();

        const audio = new Audio(`data:audio/mp3;base64,${result.audioData}`);
        this.currentAudio = audio;

        audio.onended = () => {
          this.currentAudio = null;
          this.currentSpeechId = null;
          this.pausedTime = 0;
          // Continue to next in queue
          this.processQueue();
        };

        audio.onerror = () => {
          this.currentAudio = null;
          this.currentSpeechId = null;
          this.pausedTime = 0;
          // Continue to next in queue even on error
          this.processQueue();
        };

        await audio.play();
      } else {
        // Speech was cancelled or no audio data
        this.processQueue();
      }
    } catch (error) {
      console.error('TTS Queue playback error:', error);
      this.currentAudio = null;
      this.currentSpeechId = null;
      this.pausedTime = 0;
      // Continue to next in queue even on error
      this.processQueue();
    }
  }
}

// Singleton instance
export const ttsQueueService = new TTSQueueService();

// Hook for React components
export function useTTSQueue() {
  const [state, setState] = React.useState(() => ttsQueueService.getState());

  React.useEffect(() => {
    return ttsQueueService.onStateChange((newState, currentId) => {
      setState({ state: newState, currentId, queueLength: ttsQueueService.queue.length });
    });
  }, []);

  return {
    state: state.state,
    currentId: state.currentId,
    queueLength: state.queueLength,
    isPlaying: state.state === 'playing',
    isPaused: state.state === 'paused',
    isLoading: state.state === 'loading',
    enqueue: (text: string, voice?: string, priority?: number) => ttsQueueService.enqueue(text, voice, priority),
    pause: () => ttsQueueService.pause(),
    resume: () => ttsQueueService.resume(),
    togglePause: () => ttsQueueService.togglePause(),
    skip: () => ttsQueueService.skip(),
    stop: () => ttsQueueService.stop(),
    clearQueue: () => ttsQueueService.clearQueue()
  };
}
