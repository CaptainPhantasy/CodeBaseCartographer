/**
 * SetupWizard Component - Multi-step onboarding wizard for first-run configuration
 */

import React, { useState, useCallback, useRef } from 'react';
import { ProviderId, TaskType, TASK_REQUIRED_CAPABILITIES, Capability } from '../types/capabilities';
import { PROVIDERS, getAvailableProviders, getProvider } from '../config/providers';
import { validateApiKey, quickValidateKeyFormat } from '../utils/apiKeyValidator';
import { getCapableProvidersForTask, getBestProviderForTask } from '../utils/capabilityMatrix';
import { useConfig } from '../hooks/useConfig';
import { getConfigManager } from '../config/configManager';

// ============================================================================
// TYPES
// ============================================================================

interface ProviderSetupState {
  apiKey: string;
  showKey: boolean;
  validating: boolean;
  validated: boolean;
  isValid: boolean;
  formatValid: boolean;
  error?: string;
}

type WizardStep = 'welcome' | 'providers' | 'apikeys' | 'tasks' | 'complete';

// ============================================================================
// PROVIDER INFO
// ============================================================================

const PROVIDER_INFO: Record<ProviderId, { icon: string; color: string; description: string }> = {
  openrouter: { 
    icon: '🌐', 
    color: 'from-purple-500 to-indigo-600',
    description: 'Access Claude, GPT-4, Gemini, and more through one API'
  },
  openai: { 
    icon: '🤖', 
    color: 'from-green-500 to-emerald-600',
    description: 'Direct access to GPT-4o, o1, TTS, and Realtime API'
  },
  anthropic: { 
    icon: '🧠', 
    color: 'from-orange-500 to-amber-600',
    description: 'Direct access to Claude models with extended thinking'
  },
  google: { 
    icon: '✨', 
    color: 'from-blue-500 to-cyan-600',
    description: 'Gemini models with video, TTS, and Live API'
  },
  elevenlabs: {
    icon: '🎵',
    color: 'from-pink-500 to-rose-600',
    description: 'Premium text-to-speech with natural voices'
  },
  local_llm: { 
    icon: '💻', 
    color: 'from-slate-500 to-slate-600',
    description: 'Run models locally via Ollama (coming soon)'
  }
};

const TASK_INFO: Record<TaskType, { name: string; icon: string; description: string }> = {
  [TaskType.TEXT_GENERATION]: { name: 'Text Generation', icon: '💬', description: 'Chat and text responses' },
  [TaskType.GRAPH_GENERATION]: { name: 'Graph Generation', icon: '🗺️', description: 'Generate structured graph data' },
  [TaskType.TTS]: { name: 'Text-to-Speech', icon: '🔊', description: 'Convert text to audio' },
  [TaskType.VIDEO]: { name: 'Video Generation', icon: '🎬', description: 'Generate videos from prompts' },
  [TaskType.REALTIME_VOICE]: { name: 'Live Voice', icon: '🎙️', description: 'Real-time voice conversations' },
  [TaskType.IMAGE_ANALYSIS]: { name: 'Image Analysis', icon: '🖼️', description: 'Analyze and understand images' },
  [TaskType.CODE_ANALYSIS]: { name: 'Code Analysis', icon: '💻', description: 'Analyze and understand code' },
  [TaskType.TASK_GENERATION]: { name: 'Task Generation', icon: '✅', description: 'AI-powered task suggestions' }
};

// ============================================================================
// SETUP WIZARD COMPONENT
// ============================================================================

interface SetupWizardProps {
  onComplete: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const { setProviderKey, setProviderValidation, setTaskMapping, config, importConfig, setConfig } = useConfig();
  const configManager = getConfigManager();

  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedProviders, setSelectedProviders] = useState<Set<ProviderId>>(new Set());
  const [providerStates, setProviderStates] = useState<Partial<Record<ProviderId, ProviderSetupState>>>({});
  const [taskMappings, setTaskMappings] = useState<Record<TaskType, { providerId: ProviderId; modelId: string } | null>>({} as any);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step navigation
  const steps: WizardStep[] = ['welcome', 'providers', 'tasks', 'complete'];
  const stepIndex = steps.indexOf(currentStep);
  
  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'welcome': return true;
      case 'providers': return selectedProviders.size > 0;
      case 'tasks': return true;
      case 'complete': return true;
      default: return false;
    }
  }, [currentStep, selectedProviders, providerStates]);

  const goNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  // Provider selection handlers
  const toggleProvider = (providerId: ProviderId) => {
    setSelectedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
    
    // Initialize state if not exists
    if (!providerStates[providerId]) {
      setProviderStates(prev => ({
        ...prev,
        [providerId]: { apiKey: '', showKey: false, validating: false, validated: false, isValid: false, formatValid: true }
      }));
    }
  };

  // API key handlers
  const updateApiKey = (providerId: ProviderId, apiKey: string) => {
    const formatValid = apiKey === '' || quickValidateKeyFormat(providerId, apiKey);
    setProviderStates(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], apiKey, validated: false, isValid: false, formatValid, error: undefined }
    }));
  };

  const getFormatError = (providerId: ProviderId): string => {
    switch (providerId) {
      case 'openrouter':
        return 'Invalid format. OpenRouter keys must start with "sk-or-"';
      case 'openai':
        return 'Invalid format. OpenAI keys must start with "sk-"';
      case 'anthropic':
        return 'Invalid format. Anthropic keys must start with "sk-ant-"';
      case 'google':
        return 'Invalid format. Google AI keys are typically 39+ characters';
      case 'elevenlabs':
        return 'Invalid format. ElevenLabs keys appear too short';
      case 'local_llm':
        return 'Enter a valid local endpoint URL';
      default:
        return 'Invalid API key format';
    }
  };

  const toggleShowKey = (providerId: ProviderId) => {
    setProviderStates(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], showKey: !prev[providerId]?.showKey }
    }));
  };

  const validateKey = async (providerId: ProviderId) => {
    const state = providerStates[providerId];
    if (!state?.apiKey) return;

    // Quick format validation before making API call
    if (!quickValidateKeyFormat(providerId, state.apiKey)) {
      setProviderStates(prev => ({
        ...prev,
        [providerId]: { ...prev[providerId], validating: false, validated: true, isValid: false, error: getFormatError(providerId) }
      }));
      return;
    }

    setProviderStates(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], validating: true, error: undefined }
    }));

    const trimmedKey = state.apiKey.trim();
    const result = await validateApiKey(providerId, trimmedKey);

    setProviderStates(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        validating: false,
        validated: true,
        isValid: result.isValid,
        error: result.errorMessage
      }
    }));

    // If valid, save to config
    if (result.isValid) {
      await setProviderKey(providerId, trimmedKey, true);
      setProviderValidation(providerId, true);
    }
  };

  // Import config from file
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = importConfig(content);
        if (!success) {
          setImportError('Failed to import configuration. Please check the file format.');
        } else {
          setImportError(null);
          // Trigger re-render with new config
          setConfig(configManager.getFullConfig());
          // Complete setup immediately after successful import
          onComplete();
        }
      } catch (err) {
        setImportError('Invalid JSON file');
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
      setImporting(false);
    };
    reader.readAsText(file);
  };

  // Complete setup
  const handleComplete = async () => {
    // Persist provider enablement only. Secrets remain in the backend env.
    await Promise.all(Array.from(selectedProviders).map(providerId =>
      setProviderKey(providerId, '', true)
    ));

    // Save task mappings
    Object.entries(taskMappings).forEach(([taskType, mapping]) => {
      if (mapping) {
        setTaskMapping({
          taskType: taskType as TaskType,
          primaryProviderId: mapping.providerId,
          primaryModelId: mapping.modelId
        });
      }
    });
    
    onComplete();
  };

  // Selected providers contain non-secret routing preferences only.
  const validProviders = Array.from(selectedProviders);

  // ============================================================================
  // RENDER STEPS
  // ============================================================================

  const renderWelcome = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg shadow-cyan-500/20">
        CC
      </div>
      <h2 className="text-3xl font-bold text-white">Welcome to Codebase Cartographer</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        To get started, choose providers already configured in the backend environment or import non-secret settings.
      </p>

      {/* Import Config Option */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-w-md mx-auto text-left">
        <h4 className="font-medium text-slate-200 mb-3">Already have a config?</h4>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          disabled={importing}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing...' : '📥 Import Config JSON'}
        </button>
        {importError && (
          <p className="text-red-400 text-sm mt-2">{importError}</p>
        )}
        <p className="text-xs text-slate-500 mt-2">Import task mappings and preferences; provider keys are never imported.</p>
      </div>

      <div className="text-sm text-slate-500">— or set up manually —</div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-w-md mx-auto text-left">
        <h4 className="font-medium text-slate-200 mb-2">What you'll need:</h4>
        <ul className="text-sm text-slate-400 space-y-2">
          <li className="flex items-center gap-2">
            <span className="text-green-400">✓</span> At least one backend provider key (OpenRouter recommended)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-slate-500">○</span> Optional: Multiple providers for different tasks
          </li>
        </ul>
      </div>
    </div>
  );

  const renderProviderSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Select Your Providers</h2>
        <p className="text-slate-400">Choose which server-configured AI providers you want to use</p>
      </div>
      
      <div className="grid gap-4">
        {getAvailableProviders().map(provider => {
          const info = PROVIDER_INFO[provider.id];
          const isSelected = selectedProviders.has(provider.id);
          
          return (
            <button
              key={provider.id}
              onClick={() => toggleProvider(provider.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                isSelected 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} flex items-center justify-center text-2xl`}>
                {info.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{provider.name}</h3>
                <p className="text-sm text-slate-400">{info.description}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-slate-600'
              }`}>
                {isSelected && <span className="text-white text-xs">✓</span>}
              </div>
            </button>
          );
        })}
      </div>
      
      <p className="text-sm text-slate-500 text-center">
        🔒 Keys are read from the backend environment and never enter this browser
      </p>
    </div>
  );

  const renderApiKeyEntry = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Enter API Keys</h2>
        <p className="text-slate-400">Configure your selected providers</p>
      </div>
      
      <div className="space-y-4">
        {Array.from(selectedProviders).map(providerId => {
          const provider = getProvider(providerId);
          if (!provider) return null;
          
          const state = providerStates[providerId] || { apiKey: '', showKey: false, validating: false, validated: false, isValid: false, formatValid: true, error: undefined };
          const info = PROVIDER_INFO[providerId];
          
          return (
            <div key={providerId} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-xl`}>
                  {info.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-white">{provider.name}</h3>
                  {provider.keyInstructions && (
                    <a 
                      href={provider.docsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:underline"
                    >
                      {provider.keyInstructions} ↗
                    </a>
                  )}
                </div>
                {state.validated && (
                  <div className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
                    state.isValid 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {state.isValid ? '✓ Valid' : '✗ Invalid'}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={state.showKey ? 'text' : 'password'}
                    value={state.apiKey}
                    onChange={(e) => updateApiKey(providerId, e.target.value)}
                    placeholder={`Enter your ${provider.name} API key`}
                    className={`w-full bg-slate-900 border rounded-lg px-4 py-3 pr-12 text-white focus:ring-2 focus:outline-none ${
                      state.apiKey && !state.formatValid
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-600 focus:ring-cyan-500'
                    }`}
                  />
                  <button
                    onClick={() => toggleShowKey(providerId)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title={state.showKey ? 'Hide' : 'Show'}
                  >
                    {state.showKey ? '🙈' : '👁️'}
                  </button>
                </div>
                <button
                  onClick={() => validateKey(providerId)}
                  disabled={!state.apiKey || state.validating || !state.formatValid}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors min-w-[100px]"
                >
                  {state.validating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </span>
                  ) : 'Validate'}
                </button>
              </div>

              {state.error && (
                <p className="mt-2 text-sm text-red-400">{state.error}</p>
              )}
              {state.apiKey && !state.formatValid && !state.error && (
                <p className="mt-2 text-sm text-amber-400">{getFormatError(providerId)}</p>
              )}
            </div>
          );
        })}
      </div>
      
      {validProviders.length === 0 && (
        <p className="text-amber-400 text-sm text-center bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          ⚠️ Please validate at least one API key to continue
        </p>
      )}
    </div>
  );

  const renderTaskMapping = () => {
    // Get capable providers for each task from validated providers
    const getCapableForTask = (taskType: TaskType) => {
      const required = TASK_REQUIRED_CAPABILITIES[taskType];
      const capable: Array<{ providerId: ProviderId; modelId: string; modelName: string }> = [];
      
      validProviders.forEach(providerId => {
        const provider = getProvider(providerId);
        if (!provider) return;
        
        provider.models.forEach(model => {
          if (required.every(cap => model.capabilities.includes(cap))) {
            capable.push({
              providerId,
              modelId: model.id,
              modelName: `${provider.name} - ${model.name}`
            });
          }
        });
      });
      
      return capable;
    };
    
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Configure Tasks</h2>
          <p className="text-slate-400">Choose which provider handles each type of task</p>
        </div>
        
        <div className="space-y-3">
          {Object.values(TaskType).map(taskType => {
            const taskInfo = TASK_INFO[taskType];
            const capable = getCapableForTask(taskType);
            const currentMapping = taskMappings[taskType];
            
            return (
              <div key={taskType} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{taskInfo.icon}</span>
                    <div>
                      <h4 className="font-medium text-white">{taskInfo.name}</h4>
                      <p className="text-xs text-slate-400">{taskInfo.description}</p>
                    </div>
                  </div>
                  
                  {capable.length > 0 ? (
                    <select
                      value={currentMapping ? `${currentMapping.providerId}:${currentMapping.modelId}` : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [providerId, modelId] = e.target.value.split(':');
                          setTaskMappings(prev => ({
                            ...prev,
                            [taskType]: { providerId: providerId as ProviderId, modelId }
                          }));
                        } else {
                          setTaskMappings(prev => ({ ...prev, [taskType]: null }));
                        }
                      }}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none min-w-[200px]"
                    >
                      <option value="">Auto-select</option>
                      {capable.map(opt => (
                        <option key={`${opt.providerId}:${opt.modelId}`} value={`${opt.providerId}:${opt.modelId}`}>
                          {opt.modelName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-500 bg-slate-700/50 px-3 py-2 rounded-lg">
                      No capable provider
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <p className="text-sm text-slate-500 text-center">
          💡 Leave on "Auto-select" to let the app choose the best provider automatically
        </p>
      </div>
    );
  };

  const renderComplete = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-4xl shadow-lg shadow-green-500/20">
        ✓
      </div>
      <h2 className="text-3xl font-bold text-white">You're All Set!</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        Your provider preferences are saved. Backend keys remain server-side, and you can now start mapping your codebase.
      </p>
      
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 max-w-md mx-auto text-left">
        <h4 className="font-medium text-slate-200 mb-3">Configuration Summary:</h4>
        <div className="space-y-2">
          {validProviders.map(providerId => {
            const provider = getProvider(providerId);
            const info = PROVIDER_INFO[providerId];
            return (
              <div key={providerId} className="flex items-center gap-2 text-sm">
                <span>{info.icon}</span>
                <span className="text-slate-300">{provider?.name}</span>
                <span className="text-green-400 ml-auto">✓ Configured</span>
              </div>
            );
          })}
        </div>
      </div>
      
      <p className="text-sm text-slate-500">
        You can change these settings anytime from the Settings page
      </p>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <React.Fragment key={step}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                index < stepIndex 
                  ? 'bg-cyan-500 text-white' 
                  : index === stepIndex 
                    ? 'bg-cyan-500/20 text-cyan-400 border-2 border-cyan-500' 
                    : 'bg-slate-800 text-slate-500'
              }`}>
                {index < stepIndex ? '✓' : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-1 rounded ${
                  index < stepIndex ? 'bg-cyan-500' : 'bg-slate-800'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {currentStep === 'welcome' && renderWelcome()}
          {currentStep === 'providers' && renderProviderSelection()}
          {currentStep === 'apikeys' && renderApiKeyEntry()}
          {currentStep === 'tasks' && renderTaskMapping()}
          {currentStep === 'complete' && renderComplete()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="px-6 py-3 text-slate-400 hover:text-white disabled:opacity-0 transition-colors"
          >
            ← Back
          </button>
          
          {currentStep === 'complete' ? (
            <button
              onClick={handleComplete}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-cyan-500/20"
            >
              Start Mapping 🚀
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canProceed()}
              className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
