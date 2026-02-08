/**
 * useFeatureAvailability Hook
 * Provides feature availability status based on configured providers
 * Components use this to conditionally render features
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getLLMService } from '../services/llmService';
import { getConfigManager } from '../config/configManager';
import { TaskType, ProviderId, Capability, TASK_REQUIRED_CAPABILITIES } from '../types/capabilities';
import { PROVIDERS } from '../config/providers';

// ============================================================================
// TYPES
// ============================================================================

export interface FeatureAvailability {
  isTextAvailable: boolean;
  isTTSAvailable: boolean;
  isSTTAvailable: boolean;
  isVideoAvailable: boolean;
  isRealtimeAvailable: boolean;
  isGraphAvailable: boolean;
  isVisionAvailable: boolean;
  isCodeAnalysisAvailable: boolean;
  isSearchGroundingAvailable: boolean;
  isThinkingAvailable: boolean;
}

export interface FeatureInfo {
  name: string;
  available: boolean;
  provider?: string;
  model?: string;
  configureMessage?: string;
}

export interface UseFeatureAvailabilityResult extends FeatureAvailability {
  loading: boolean;
  refresh: () => void;
  getFeatureInfo: (feature: keyof FeatureAvailability) => FeatureInfo;
  getConfigureMessage: (feature: keyof FeatureAvailability) => string | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const FEATURE_CONFIGURE_MESSAGES: Record<keyof FeatureAvailability, string> = {
  isTextAvailable: 'Configure any LLM provider to enable chat',
  isTTSAvailable: 'Configure OpenAI, Google, or ElevenLabs to enable Text-to-Speech',
  isSTTAvailable: 'Configure OpenAI (Whisper), Google, or ElevenLabs to enable Speech-to-Text',
  isVideoAvailable: 'Configure Google AI (Gemini) to enable video generation with Veo',
  isRealtimeAvailable: 'Configure Google AI or OpenAI to enable real-time voice',
  isGraphAvailable: 'Configure any provider with structured output to enable graph generation',
  isVisionAvailable: 'Configure a provider with vision capability (GPT-4o, Claude, Gemini) for image analysis',
  isCodeAnalysisAvailable: 'Configure any LLM provider to enable code analysis',
  isSearchGroundingAvailable: 'Configure Google AI (Gemini) for search grounding capabilities',
  isThinkingAvailable: 'Configure Claude, GPT o1/o3, or Gemini Pro for extended thinking'
};

const FEATURE_NAMES: Record<keyof FeatureAvailability, string> = {
  isTextAvailable: 'Chat',
  isTTSAvailable: 'Text-to-Speech',
  isSTTAvailable: 'Speech-to-Text',
  isVideoAvailable: 'Video Generation',
  isRealtimeAvailable: 'Real-time Voice',
  isGraphAvailable: 'Graph Generation',
  isVisionAvailable: 'Image Analysis',
  isCodeAnalysisAvailable: 'Code Analysis',
  isSearchGroundingAvailable: 'Search Grounding',
  isThinkingAvailable: 'Extended Thinking'
};

/**
 * Check if a specific capability is available from any configured provider
 */
function isCapabilityAvailable(capability: Capability): { available: boolean; providerId?: ProviderId; modelId?: string } {
  const configManager = getConfigManager();
  const enabledProviders = configManager.getEnabledProviders();

  for (const providerConfig of enabledProviders) {
    const providerDef = PROVIDERS[providerConfig.providerId];
    if (!providerDef) continue;

    for (const model of providerDef.models) {
      if (model.capabilities.includes(capability)) {
        return {
          available: true,
          providerId: providerConfig.providerId,
          modelId: model.id
        };
      }
    }
  }

  return { available: false };
}

/**
 * Get detailed feature availability
 */
function getDetailedAvailability(): FeatureAvailability & {
  providers: Record<keyof FeatureAvailability, { providerId?: ProviderId; modelId?: string }>
} {
  const llmService = getLLMService();
  const baseAvailability = llmService.getFeatureAvailability();

  // Additional capability checks
  const searchGrounding = isCapabilityAvailable('search_grounding');
  const thinking = isCapabilityAvailable('thinking');
  const codeAnalysis = isCapabilityAvailable('code');
  const stt = isCapabilityAvailable('stt');

  return {
    ...baseAvailability,
    isCodeAnalysisAvailable: codeAnalysis.available,
    isSearchGroundingAvailable: searchGrounding.available,
    isThinkingAvailable: thinking.available,
    isSTTAvailable: stt.available,
    providers: {
      isTextAvailable: isCapabilityAvailable('text'),
      isTTSAvailable: isCapabilityAvailable('tts'),
      isSTTAvailable: stt,
      isVideoAvailable: isCapabilityAvailable('video'),
      isRealtimeAvailable: isCapabilityAvailable('realtime_audio'),
      isGraphAvailable: isCapabilityAvailable('structured_output'),
      isVisionAvailable: isCapabilityAvailable('vision'),
      isCodeAnalysisAvailable: codeAnalysis,
      isSearchGroundingAvailable: searchGrounding,
      isThinkingAvailable: thinking
    }
  };
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to check feature availability based on configured providers
 * 
 * @example
 * ```tsx
 * const { isTTSAvailable, getConfigureMessage } = useFeatureAvailability();
 * 
 * return (
 *   <div>
 *     {isTTSAvailable ? (
 *       <TTSButton onClick={handleTTS} />
 *     ) : (
 *       <Tooltip text={getConfigureMessage('isTTSAvailable')}>
 *         <TTSButton disabled />
 *       </Tooltip>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useFeatureAvailability(): UseFeatureAvailabilityResult {
  const [availability, setAvailability] = useState<FeatureAvailability & {
    providers: Record<keyof FeatureAvailability, { providerId?: ProviderId; modelId?: string }>
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    // Small delay to allow config changes to propagate
    setTimeout(() => {
      const newAvailability = getDetailedAvailability();
      setAvailability(newAvailability);
      setLoading(false);
    }, 50);
  }, []);

  // Initial load and subscribe to config changes
  useEffect(() => {
    refresh();
    
    // Subscribe to config changes
    const configManager = getConfigManager();
    const unsubscribe = configManager.subscribe(() => {
      refresh();
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  const getFeatureInfo = useCallback((feature: keyof FeatureAvailability): FeatureInfo => {
    const providerInfo = availability?.providers?.[feature];
    const isAvailable = availability?.[feature] ?? false;
    
    return {
      name: FEATURE_NAMES[feature],
      available: isAvailable,
      provider: providerInfo?.providerId ? PROVIDERS[providerInfo.providerId]?.name : undefined,
      model: providerInfo?.modelId,
      configureMessage: isAvailable ? undefined : FEATURE_CONFIGURE_MESSAGES[feature]
    };
  }, [availability]);

  const getConfigureMessage = useCallback((feature: keyof FeatureAvailability): string | null => {
    if (availability?.[feature]) return null;
    return FEATURE_CONFIGURE_MESSAGES[feature];
  }, [availability]);

  // Default values while loading
  const defaultAvailability: FeatureAvailability = useMemo(() => ({
    isTextAvailable: false,
    isTTSAvailable: false,
    isSTTAvailable: false,
    isVideoAvailable: false,
    isRealtimeAvailable: false,
    isGraphAvailable: false,
    isVisionAvailable: false,
    isCodeAnalysisAvailable: false,
    isSearchGroundingAvailable: false,
    isThinkingAvailable: false
  }), []);

  return {
    ...(availability || defaultAvailability),
    loading,
    refresh,
    getFeatureInfo,
    getConfigureMessage
  };
}

/**
 * Simple hook for checking if a specific feature is available
 */
export function useFeature(feature: keyof FeatureAvailability): {
  available: boolean;
  loading: boolean;
  configureMessage: string | null;
} {
  const result = useFeatureAvailability();
  
  return {
    available: result[feature],
    loading: result.loading,
    configureMessage: result.getConfigureMessage(feature)
  };
}

export default useFeatureAvailability;
