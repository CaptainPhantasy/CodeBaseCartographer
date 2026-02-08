/**
 * VoiceSelector Component - Dropdown for selecting ElevenLabs voices with preview
 */

import React, { useState, useRef } from 'react';
import { ElevenLabsVoice } from '../types/capabilities';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceSelectorProps {
  voices: ElevenLabsVoice[];
  selectedVoiceId: string | undefined;
  onSelectVoice: (voiceId: string) => void;
  disabled?: boolean;
  className?: string;
}

type VoiceCategory = 'cloned' | 'premade' | 'generated' | 'other';

interface VoiceGroup {
  category: VoiceCategory;
  label: string;
  voices: ElevenLabsVoice[];
}

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

const CATEGORY_INFO: Record<VoiceCategory, { label: string; icon: string; color: string }> = {
  cloned: { label: 'Cloned Voices', icon: '🎤', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  premade: { label: 'Premade Voices', icon: '🎭', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  generated: { label: 'Generated Voices', icon: '✨', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  other: { label: 'Other Voices', icon: '📦', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Groups voices by their category
 */
const groupVoices = (voices: ElevenLabsVoice[]): VoiceGroup[] => {
  const groups: Record<VoiceCategory, ElevenLabsVoice[]> = {
    cloned: [],
    premade: [],
    generated: [],
    other: []
  };

  voices.forEach(voice => {
    const category = voice.category?.toLowerCase() as VoiceCategory;
    if (category === 'cloned' || category === 'premade' || category === 'generated') {
      groups[category].push(voice);
    } else {
      groups.other.push(voice);
    }
  });

  return Object.entries(groups)
    .filter(([_, voices]) => voices.length > 0)
    .map(([category, voices]) => ({
      category: category as VoiceCategory,
      label: CATEGORY_INFO[category as VoiceCategory].label,
      voices
    }));
};

/**
 * Gets the category of a voice
 */
const getVoiceCategory = (voice: ElevenLabsVoice): VoiceCategory => {
  const category = voice.category?.toLowerCase();
  if (category === 'cloned' || category === 'premade' || category === 'generated') {
    return category as VoiceCategory;
  }
  return 'other';
};

// ============================================================================
// VOICE SELECTOR COMPONENT
// ============================================================================

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceId,
  onSelectVoice,
  disabled = false,
  className = ''
}) => {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const voiceGroups = groupVoices(voices);
  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

  /**
   * Plays the preview audio for a voice
   */
  const handlePreview = async (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setPreviewingVoice(voice.voice_id);
    setPreviewError(null);

    try {
      // Use proxy to avoid CORS issues - use backend server on port 3000
      const backendUrl = window.location.port === '3002' ? 'http://localhost:3000' : '';
      const proxyUrl = `${backendUrl}/api/elevenlabs/preview?url=${encodeURIComponent(voice.preview_url)}`;
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = proxyUrl;
      audioRef.current = audio;

      audio.onloadeddata = () => {
        setPreviewingVoice(null);
      };

      audio.onended = () => {
        setPreviewingVoice(null);
      };

      audio.onerror = (e) => {
        console.error('Audio error:', e);
        setPreviewingVoice(null);
        setPreviewError('Failed to play preview');
        setTimeout(() => setPreviewError(null), 3000);
      };

      await audio.play();
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewingVoice(null);
      setPreviewError('Failed to play preview');
      setTimeout(() => setPreviewError(null), 3000);
    }
  };

  /**
   * Stops the currently playing preview
   */
  const handleStopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPreviewingVoice(null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Select Dropdown */}
      <div className="relative">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Voice
        </label>
        <select
          value={selectedVoiceId || ''}
          onChange={(e) => e.target.value && onSelectVoice(e.target.value)}
          disabled={disabled || voices.length === 0}
          className={`
            w-full bg-slate-900 border rounded-lg px-4 py-2.5 text-white
            focus:ring-2 focus:outline-none transition-colors appearance-none
            cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
            ${disabled || voices.length === 0
              ? 'border-slate-700'
              : 'border-slate-600 focus:ring-cyan-500 focus:border-cyan-500 hover:border-slate-500'
            }
          `}
        >
          <option value="" disabled>
            {voices.length === 0 ? 'No voices available' : 'Choose a voice...'}
          </option>
          {voiceGroups.map(group => (
            <optgroup key={group.category} label={group.label}>
              {group.voices.map(voice => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="absolute right-3 top-[2.6rem] pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Voice Details */}
      {selectedVoice && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          {/* Voice Name and Category Badge */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-white truncate">
                {selectedVoice.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                ID: {selectedVoice.voice_id}
              </p>
            </div>

            <span className={`
              flex-shrink-0 text-xs px-2.5 py-1 rounded-full border
              ${CATEGORY_INFO[getVoiceCategory(selectedVoice)].color}
            `}>
              {CATEGORY_INFO[getVoiceCategory(selectedVoice)].icon}{' '}
              {selectedVoice.category || 'Unknown'}
            </span>
          </div>

          {/* Voice Description */}
          {selectedVoice.description && (
            <p className="text-sm text-slate-400 border-t border-slate-700/50 pt-2">
              {selectedVoice.description}
            </p>
          )}

          {/* Voice Labels */}
          {selectedVoice.labels && Object.keys(selectedVoice.labels).length > 0 && (
            <div className="border-t border-slate-700/50 pt-2">
              <p className="text-xs text-slate-500 mb-1.5">Labels:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedVoice.labels).map(([key, value]) => (
                  <span
                    key={key}
                    className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded"
                  >
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview Button */}
          {selectedVoice.preview_url && (
            <div className="border-t border-slate-700/50 pt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {previewingVoice === selectedVoice.voice_id
                  ? 'Playing preview...'
                  : 'Preview this voice'
                }
              </span>

              {previewingVoice === selectedVoice.voice_id ? (
                <button
                  onClick={handleStopPreview}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => handlePreview(selectedVoice)}
                  disabled={disabled}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Preview
                </button>
              )}
            </div>
          )}

          {/* Preview Error Message */}
          {previewError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{previewError}</p>
            </div>
          )}
        </div>
      )}

      {/* No Voice Selected */}
      {!selectedVoice && voices.length > 0 && (
        <p className="text-sm text-slate-500 italic">
          Select a voice above to see details and preview
        </p>
      )}
    </div>
  );
};

export default VoiceSelector;
