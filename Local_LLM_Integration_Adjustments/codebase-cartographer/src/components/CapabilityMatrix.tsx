/**
 * CapabilityMatrix Component - Visual grid showing provider capabilities
 */

import React, { useState } from 'react';
import { Capability, ProviderId, TaskType, TASK_REQUIRED_CAPABILITIES } from '../types/capabilities';
import { getProvider, getAvailableProviders } from '../config/providers';
import { useConfig } from '../hooks/useConfig';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_CAPABILITIES: Capability[] = [
  'text', 'code', 'structured_output', 'vision', 
  'tts', 'video', 'realtime_audio', 'thinking', 'search_grounding'
];

const CAPABILITY_INFO: Record<Capability, { label: string; icon: string; description: string }> = {
  text: { label: 'Text', icon: '💬', description: 'Basic text generation and chat' },
  code: { label: 'Code', icon: '💻', description: 'Code generation and analysis' },
  structured_output: { label: 'JSON', icon: '📋', description: 'Structured JSON output' },
  vision: { label: 'Vision', icon: '👁️', description: 'Image understanding' },
  tts: { label: 'TTS', icon: '🔊', description: 'Text-to-speech synthesis' },
  video: { label: 'Video', icon: '🎬', description: 'Video generation' },
  realtime_audio: { label: 'Live', icon: '🎙️', description: 'Real-time audio/voice' },
  thinking: { label: 'Think', icon: '🧠', description: 'Extended reasoning mode' },
  search_grounding: { label: 'Search', icon: '🔍', description: 'Web search grounding' }
};

const PROVIDER_INFO: Record<ProviderId, { color: string }> = {
  openrouter: { color: 'bg-purple-500' },
  openai: { color: 'bg-green-500' },
  anthropic: { color: 'bg-orange-500' },
  google: { color: 'bg-blue-500' },
  elevenlabs: { color: 'bg-pink-500' },
  local_llm: { color: 'bg-slate-500' }
};

// ============================================================================
// COMPONENT
// ============================================================================

interface CapabilityMatrixProps {
  compact?: boolean;
}

export const CapabilityMatrix: React.FC<CapabilityMatrixProps> = ({ compact = false }) => {
  const { config } = useConfig();
  const [hoveredCell, setHoveredCell] = useState<{ provider: ProviderId; cap: Capability } | null>(null);
  const [showModels, setShowModels] = useState<ProviderId | null>(null);

  // Get configured providers
  const configuredProviders = config.providers
    .filter(p => p.isEnabled && p.apiKey)
    .map(p => getProvider(p.providerId))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  // Get assigned tasks for highlighting
  const taskAssignments = new Map<string, TaskType[]>();
  config.taskMappings.forEach(mapping => {
    const key = `${mapping.primaryProviderId}:${mapping.primaryModelId}`;
    const existing = taskAssignments.get(key) || [];
    taskAssignments.set(key, [...existing, mapping.taskType]);
  });

  if (configuredProviders.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p>No providers configured yet.</p>
        <p className="text-sm mt-1">Add API keys to see the capability matrix.</p>
      </div>
    );
  }

  // Compact view - just show provider-level capabilities
  if (compact) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Provider</th>
              {ALL_CAPABILITIES.map(cap => (
                <th key={cap} className="py-2 px-2 text-center" title={CAPABILITY_INFO[cap].description}>
                  <span className="text-lg">{CAPABILITY_INFO[cap].icon}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configuredProviders.map(provider => {
              // Aggregate capabilities from all models
              const providerCaps = new Set<Capability>();
              provider.models.forEach(m => m.capabilities.forEach(c => providerCaps.add(c)));
              
              return (
                <tr key={provider.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${PROVIDER_INFO[provider.id].color}`} />
                      <span className="text-slate-200">{provider.name}</span>
                    </div>
                  </td>
                  {ALL_CAPABILITIES.map(cap => (
                    <td key={cap} className="py-2 px-2 text-center">
                      {providerCaps.has(cap) ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Full view - show model-level details
  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-4">
        <div className="flex items-center gap-1">
          <span className="text-green-400">✓</span> Supported
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-600">—</span> Not supported
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-cyan-500"></span> Assigned to task
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium min-w-[200px]">Model</th>
              {ALL_CAPABILITIES.map(cap => (
                <th 
                  key={cap} 
                  className="py-2 px-2 text-center min-w-[50px]"
                  title={CAPABILITY_INFO[cap].description}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">{CAPABILITY_INFO[cap].icon}</span>
                    <span className="text-[10px] text-slate-500">{CAPABILITY_INFO[cap].label}</span>
                  </div>
                </th>
              ))}
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Tier</th>
            </tr>
          </thead>
          <tbody>
            {configuredProviders.map(provider => (
              <React.Fragment key={provider.id}>
                {/* Provider header row */}
                <tr className="bg-slate-800/50">
                  <td 
                    colSpan={ALL_CAPABILITIES.length + 2} 
                    className="py-2 px-3 cursor-pointer"
                    onClick={() => setShowModels(showModels === provider.id ? null : provider.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${PROVIDER_INFO[provider.id].color}`} />
                      <span className="font-medium text-white">{provider.name}</span>
                      <span className="text-slate-500 text-xs">({provider.models.length} models)</span>
                      <span className="ml-auto text-slate-400">
                        {showModels === provider.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </td>
                </tr>
                
                {/* Model rows */}
                {(showModels === provider.id || showModels === null) && provider.models.map(model => {
                  const assignedTasks = taskAssignments.get(`${provider.id}:${model.id}`) || [];
                  const isAssigned = assignedTasks.length > 0;
                  
                  return (
                    <tr 
                      key={model.id} 
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${
                        isAssigned ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      <td className="py-2 px-3 pl-8">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300">{model.name}</span>
                          {isAssigned && (
                            <span 
                              className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded"
                              title={`Assigned to: ${assignedTasks.map(t => t.replace('_', ' ')).join(', ')}`}
                            >
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      {ALL_CAPABILITIES.map(cap => {
                        const hasCapability = model.capabilities.includes(cap);
                        const isHovered = hoveredCell?.provider === provider.id && hoveredCell?.cap === cap;
                        
                        return (
                          <td 
                            key={cap} 
                            className="py-2 px-2 text-center"
                            onMouseEnter={() => setHoveredCell({ provider: provider.id, cap })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <span className={`${
                              hasCapability 
                                ? 'text-green-400' 
                                : 'text-slate-700'
                            } ${isHovered ? 'scale-125' : ''} inline-block transition-transform`}>
                              {hasCapability ? '✓' : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          model.tier === 'fast' 
                            ? 'bg-green-500/20 text-green-400'
                            : model.tier === 'balanced'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-purple-500/20 text-purple-400'
                        }`}>
                          {model.tier}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl z-50 max-w-xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{CAPABILITY_INFO[hoveredCell.cap].icon}</span>
            <span className="font-medium text-white">{CAPABILITY_INFO[hoveredCell.cap].label}</span>
          </div>
          <p className="text-sm text-slate-400">{CAPABILITY_INFO[hoveredCell.cap].description}</p>
        </div>
      )}

      {/* Task Coverage Summary */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <h4 className="text-sm font-medium text-slate-300 mb-3">Task Coverage</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {Object.values(TaskType).map(taskType => {
            const required = TASK_REQUIRED_CAPABILITIES[taskType];
            const canHandle = configuredProviders.some(provider =>
              provider.models.some(model =>
                required.every(cap => model.capabilities.includes(cap))
              )
            );
            
            return (
              <div 
                key={taskType}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                  canHandle 
                    ? 'bg-green-500/10 text-green-400' 
                    : 'bg-red-500/10 text-red-400'
                }`}
              >
                <span>{canHandle ? '✓' : '✗'}</span>
                <span>{taskType.replace(/_/g, ' ')}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CapabilityMatrix;
