/**
 * SettingsPage Component - Tabbed settings interface for managing configuration
 */

import React, { useState, useRef } from 'react';
import {
  ProviderId,
  TaskType,
  TASK_REQUIRED_CAPABILITIES,
  ModelTier,
  ElevenLabsVoice,
  OpenRouterModel
} from '../types/capabilities';
import { PROVIDERS, getAvailableProviders, getProvider } from '../config/providers';
import { validateApiKey, quickValidateKeyFormat } from '../utils/apiKeyValidator';
import { useConfig } from '../hooks/useConfig';
import CapabilityMatrix from './CapabilityMatrix';
import { VoiceSelector } from './VoiceSelector';
import { ModelSelector } from './ModelSelector';
import { fetchElevenLabsVoices, fetchOpenRouterModels } from '../services/resourceFetchers';

// ============================================================================
// TYPES
// ============================================================================

type SettingsTab = 'apikeys' | 'tasks' | 'preferences';

interface ProviderEditState {
  apiKey: string;
  showKey: boolean;
  validating: boolean;
  formatValid: boolean;
  error?: string;
}

// ============================================================================
// PROVIDER INFO
// ============================================================================

const PROVIDER_INFO: Record<ProviderId, { icon: string; color: string }> = {
  openrouter: { icon: '🌐', color: 'from-purple-500 to-indigo-600' },
  openai: { icon: '🤖', color: 'from-green-500 to-emerald-600' },
  anthropic: { icon: '🧠', color: 'from-orange-500 to-amber-600' },
  google: { icon: '✨', color: 'from-blue-500 to-cyan-600' },
  elevenlabs: { icon: '🎵', color: 'from-pink-500 to-rose-600' },
  local_llm: { icon: '💻', color: 'from-slate-500 to-slate-600' }
};

const TASK_INFO: Record<TaskType, { name: string; icon: string }> = {
  [TaskType.TEXT_GENERATION]: { name: 'Text Generation', icon: '💬' },
  [TaskType.GRAPH_GENERATION]: { name: 'Graph Generation', icon: '🗺️' },
  [TaskType.TTS]: { name: 'Text-to-Speech', icon: '🔊' },
  [TaskType.VIDEO]: { name: 'Video Generation', icon: '🎬' },
  [TaskType.REALTIME_VOICE]: { name: 'Live Voice', icon: '🎙️' },
  [TaskType.IMAGE_ANALYSIS]: { name: 'Image Analysis', icon: '🖼️' },
  [TaskType.CODE_ANALYSIS]: { name: 'Code Analysis', icon: '💻' },
  [TaskType.TASK_GENERATION]: { name: 'Task Generation', icon: '✅' }
};

// ============================================================================
// SETTINGS PAGE COMPONENT
// ============================================================================

interface SettingsPageProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ isOpen, onClose }) => {
  const {
    config,
    getApiKey,
    setProviderKey,
    removeProvider,
    setProviderValidation,
    setTaskMapping,
    setPreferences,
    exportConfig,
    importConfig,
    setCachedVoices,
    getCachedVoices,
    setCachedModels,
    getCachedModels,
    setSelectedVoice,
    setSelectedModel
  } = useConfig();

  const [activeTab, setActiveTab] = useState<SettingsTab>('apikeys');
  const [editingProvider, setEditingProvider] = useState<ProviderId | null>(null);
  const [editState, setEditState] = useState<ProviderEditState>({ apiKey: '', showKey: false, validating: false, formatValid: true });
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading states for resource fetching
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  if (!isOpen) return null;

  // ============================================================================
  // API KEYS TAB
  // ============================================================================

  const handleEditProvider = (providerId: ProviderId) => {
    const existingKey = getApiKey(providerId) || '';
    setEditingProvider(providerId);
    setEditState({
      apiKey: existingKey,
      showKey: false,
      validating: false,
      formatValid: existingKey === '' || quickValidateKeyFormat(providerId, existingKey)
    });
  };

  const handleSaveKey = async () => {
    if (!editingProvider || !editState.apiKey) return;

    // Quick format validation before making API call
    if (!quickValidateKeyFormat(editingProvider, editState.apiKey)) {
      setEditState(prev => ({
        ...prev,
        error: getFormatError(editingProvider)
      }));
      return;
    }

    setEditState(prev => ({ ...prev, validating: true, error: undefined }));

    const result = await validateApiKey(editingProvider, editState.apiKey);

    if (result.isValid) {
      await setProviderKey(editingProvider, editState.apiKey, true);
      setProviderValidation(editingProvider, true);

      // Fetch provider-specific resources after successful validation
      if (editingProvider === 'elevenlabs') {
        setLoadingVoices(true);
        const voiceResult = await fetchElevenLabsVoices(editState.apiKey);
        if (voiceResult.voices.length > 0) {
          setCachedVoices('elevenlabs', voiceResult.voices);
        }
        setLoadingVoices(false);
      }

      if (editingProvider === 'openrouter') {
        setLoadingModels(true);
        const modelResult = await fetchOpenRouterModels(editState.apiKey);
        if (modelResult.models.length > 0) {
          setCachedModels('openrouter', modelResult.models);
        }
        setLoadingModels(false);
      }

      setEditingProvider(null);
    } else {
      setEditState(prev => ({ ...prev, validating: false, error: result.errorMessage }));
    }
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

  const handleApiKeyChange = (providerId: ProviderId, value: string) => {
    const formatValid = value === '' || quickValidateKeyFormat(providerId, value);
    setEditState(prev => ({
      ...prev,
      apiKey: value,
      formatValid,
      error: undefined
    }));
  };

  const handleRemoveProvider = (providerId: ProviderId) => {
    if (confirm(`Remove ${getProvider(providerId)?.name} API key? This cannot be undone.`)) {
      removeProvider(providerId);
    }
  };

  const renderApiKeysTab = () => {
    const configuredProviders = config.providers.filter(p => p.apiKey);
    const unconfiguredProviders = getAvailableProviders().filter(
      p => !configuredProviders.find(cp => cp.providerId === p.id)
    );

    return (
      <div className="space-y-6">
        {/* Configured Providers */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Configured Providers</h3>
          {configuredProviders.length === 0 ? (
            <p className="text-slate-400 text-sm">No providers configured yet.</p>
          ) : (
            <div className="space-y-3">
              {configuredProviders.map(providerConfig => {
                const provider = getProvider(providerConfig.providerId);
                if (!provider) return null;
                const info = PROVIDER_INFO[providerConfig.providerId];
                const isEditing = editingProvider === providerConfig.providerId;
                
                return (
                  <div key={providerConfig.providerId} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-xl`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{provider.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            providerConfig.isValid 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {providerConfig.isValid ? '✓ Valid' : '? Not validated'}
                          </span>
                          {providerConfig.validatedAt && (
                            <span className="text-xs text-slate-500">
                              {new Date(providerConfig.validatedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProvider(providerConfig.providerId)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveProvider(providerConfig.providerId)}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    {/* Edit form */}
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={editState.showKey ? 'text' : 'password'}
                              value={editState.apiKey}
                              onChange={(e) => handleApiKeyChange(providerConfig.providerId, e.target.value)}
                              placeholder="Enter API key"
                              className={`w-full bg-slate-900 border rounded-lg px-4 py-2 pr-12 text-white focus:ring-2 focus:outline-none ${
                                editState.apiKey && !editState.formatValid
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-slate-600 focus:ring-cyan-500'
                              }`}
                            />
                            <button
                              onClick={() => setEditState(prev => ({ ...prev, showKey: !prev.showKey }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {editState.showKey ? '🙈' : '👁️'}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveKey}
                            disabled={editState.validating || !editState.apiKey || !editState.formatValid}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            {editState.validating ? 'Validating...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingProvider(null)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        {editState.error && (
                          <p className="mt-2 text-sm text-red-400">{editState.error}</p>
                        )}
                        {editState.apiKey && !editState.formatValid && !editState.error && (
                          <p className="mt-2 text-sm text-amber-400">
                            {getFormatError(providerConfig.providerId)}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Available models */}
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 mb-2">Available models:</p>
                      <div className="flex flex-wrap gap-1">
                        {provider.models.slice(0, 5).map(model => (
                          <span key={model.id} className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded">
                            {model.name}
                          </span>
                        ))}
                        {provider.models.length > 5 && (
                          <span className="text-xs text-slate-500 px-2 py-1">
                            +{provider.models.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resource Selectors */}
                    {providerConfig.providerId === 'elevenlabs' && providerConfig.cachedVoices && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <VoiceSelector
                          voices={providerConfig.cachedVoices}
                          selectedVoiceId={providerConfig.selectedVoiceId}
                          onSelectVoice={(voiceId) => setSelectedVoice('elevenlabs', voiceId)}
                          disabled={loadingVoices}
                        />
                        {loadingVoices && (
                          <p className="text-xs text-slate-400 mt-2">Loading voices...</p>
                        )}
                      </div>
                    )}

                    {providerConfig.providerId === 'openrouter' && providerConfig.cachedModels && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <ModelSelector
                          models={providerConfig.cachedModels}
                          selectedModelId={providerConfig.selectedModelId}
                          onSelectModel={(modelId) => setSelectedModel('openrouter', modelId)}
                          disabled={loadingModels}
                        />
                        {loadingModels && (
                          <p className="text-xs text-slate-400 mt-2">Loading models...</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add New Provider */}
        {unconfiguredProviders.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Add Provider</h3>
            <div className="grid gap-3">
              {unconfiguredProviders.map(provider => {
                const info = PROVIDER_INFO[provider.id];
                const isEditing = editingProvider === provider.id;
                
                return (
                  <div key={provider.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${info.color} flex items-center justify-center text-xl opacity-60`}>
                        {info.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-300">{provider.name}</h4>
                        <p className="text-xs text-slate-500">{provider.description}</p>
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => handleEditProvider(provider.id)}
                          className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-sm rounded-lg transition-colors"
                        >
                          + Add Key
                        </button>
                      )}
                    </div>
                    
                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        {provider.keyInstructions && (
                          <a
                            href={provider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:underline mb-2 block"
                          >
                            {provider.keyInstructions} ↗
                          </a>
                        )}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={editState.showKey ? 'text' : 'password'}
                              value={editState.apiKey}
                              onChange={(e) => handleApiKeyChange(provider.id, e.target.value)}
                              placeholder="Enter API key"
                              className={`w-full bg-slate-900 border rounded-lg px-4 py-2 pr-12 text-white focus:ring-2 focus:outline-none ${
                                editState.apiKey && !editState.formatValid
                                  ? 'border-red-500 focus:ring-red-500'
                                  : 'border-slate-600 focus:ring-cyan-500'
                              }`}
                            />
                            <button
                              onClick={() => setEditState(prev => ({ ...prev, showKey: !prev.showKey }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              {editState.showKey ? '🙈' : '👁️'}
                            </button>
                          </div>
                          <button
                            onClick={handleSaveKey}
                            disabled={editState.validating || !editState.apiKey || !editState.formatValid}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                          >
                            {editState.validating ? 'Validating...' : 'Validate & Save'}
                          </button>
                          <button
                            onClick={() => setEditingProvider(null)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                        {editState.error && (
                          <p className="mt-2 text-sm text-red-400">{editState.error}</p>
                        )}
                        {editState.apiKey && !editState.formatValid && !editState.error && (
                          <p className="mt-2 text-sm text-amber-400">
                            {getFormatError(provider.id)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // TASK MAPPINGS TAB
  // ============================================================================

  const renderTaskMappingsTab = () => {
    const enabledProviders = config.providers.filter(p => p.isEnabled && p.apiKey);
    
    const getCapableModels = (taskType: TaskType) => {
      const required = TASK_REQUIRED_CAPABILITIES[taskType];
      const capable: Array<{ providerId: ProviderId; modelId: string; modelName: string }> = [];
      
      enabledProviders.forEach(providerConfig => {
        const provider = getProvider(providerConfig.providerId);
        if (!provider) return;
        
        provider.models.forEach(model => {
          if (required.every(cap => model.capabilities.includes(cap))) {
            capable.push({
              providerId: providerConfig.providerId,
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
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Task Mappings</h3>
          <p className="text-sm text-slate-400 mb-4">
            Choose which provider and model handles each type of task
          </p>
        </div>

        <div className="space-y-3">
          {Object.values(TaskType).map(taskType => {
            const taskInfo = TASK_INFO[taskType];
            const capable = getCapableModels(taskType);
            const currentMapping = config.taskMappings.find(m => m.taskType === taskType);
            
            return (
              <div key={taskType} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{taskInfo.icon}</span>
                    <div>
                      <h4 className="font-medium text-white">{taskInfo.name}</h4>
                      <p className="text-xs text-slate-500">
                        Requires: {TASK_REQUIRED_CAPABILITIES[taskType].join(', ')}
                      </p>
                    </div>
                  </div>
                  
                  {capable.length > 0 ? (
                    <select
                      value={currentMapping ? `${currentMapping.primaryProviderId}:${currentMapping.primaryModelId}` : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const [providerId, modelId] = e.target.value.split(':');
                          setTaskMapping({
                            taskType,
                            primaryProviderId: providerId as ProviderId,
                            primaryModelId: modelId
                          });
                        }
                      }}
                      className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none min-w-[220px]"
                    >
                      <option value="">Auto-select best</option>
                      {capable.map(opt => (
                        <option key={`${opt.providerId}:${opt.modelId}`} value={`${opt.providerId}:${opt.modelId}`}>
                          {opt.modelName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-red-400/80 bg-red-500/10 px-3 py-2 rounded-lg">
                      ⚠️ No capable provider
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Capability Matrix */}
        <div className="pt-4 border-t border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Capability Matrix</h3>
          <CapabilityMatrix />
        </div>
      </div>
    );
  };

  // ============================================================================
  // PREFERENCES TAB
  // ============================================================================

  const renderPreferencesTab = () => {
    const preferences = config.preferences;

    const handleExport = () => {
      const configJson = exportConfig();
      const blob = new Blob([configJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cartographer-config.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const success = importConfig(content);
        if (!success) {
          setImportError('Failed to import configuration. Please check the file format.');
        } else {
          setImportError(null);
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="space-y-6">
        {/* Model Preferences */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Model Preferences</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Preferred Model Tier</label>
              <div className="flex gap-2">
                {(['fast', 'balanced', 'smart'] as ModelTier[]).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setPreferences({ preferredTier: tier })}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      preferences.preferredTier === tier
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {tier === 'fast' && '⚡'} {tier === 'balanced' && '⚖️'} {tier === 'smart' && '🧠'} {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Fast: Quick responses, lower cost | Balanced: Good mix | Smart: Best quality
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm text-slate-300">Prefer Lower Cost</label>
                <p className="text-xs text-slate-500">Choose cheaper models when available</p>
              </div>
              <button
                onClick={() => setPreferences({ preferCost: !preferences.preferCost })}
                className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  preferences.preferCost ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.preferCost ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <label className="text-sm text-slate-300">Prefer Speed</label>
                <p className="text-xs text-slate-500">Prioritize faster response times</p>
              </div>
              <button
                onClick={() => setPreferences({ preferSpeed: !preferences.preferSpeed })}
                className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  preferences.preferSpeed ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  preferences.preferSpeed ? 'translate-x-5' : ''
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Export/Import */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Configuration Backup</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex gap-4">
              <button
                onClick={handleExport}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                📤 Export Config
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                📥 Import Config
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
            {importError && (
              <p className="mt-3 text-sm text-red-400">{importError}</p>
            )}
            <p className="text-xs text-slate-500 mt-3">
              Export your configuration to backup API keys and settings, or import from a previous backup.
            </p>
          </div>
        </div>

        {/* Danger Zone */}
        <div>
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-white">Reset All Settings</h4>
                <p className="text-xs text-slate-400">Delete all API keys and reset to defaults</p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure? This will delete all API keys and reset all settings. This cannot be undone.')) {
                    // Clear would need to be exposed from useConfig
                    localStorage.removeItem('codebase_cartographer_config');
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl my-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-800/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ⚙️ Settings
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            {[
              { id: 'apikeys' as const, label: 'API Keys', icon: '🔑' },
              { id: 'tasks' as const, label: 'Task Mappings', icon: '🔗' },
              { id: 'preferences' as const, label: 'Preferences', icon: '⚡' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {activeTab === 'apikeys' && renderApiKeysTab()}
            {activeTab === 'tasks' && renderTaskMappingsTab()}
            {activeTab === 'preferences' && renderPreferencesTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
