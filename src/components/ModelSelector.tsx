/**
 * ModelSelector Component - Dropdown for selecting OpenRouter models
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { OpenRouterModel } from '../types/capabilities';

// ============================================================================
// TYPES
// ============================================================================

interface ModelSelectorProps {
  models: OpenRouterModel[];
  selectedModelId: string | null;
  onSelectModel: (modelId: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface ModelOption {
  model: OpenRouterModel;
  promptPrice: number;
  completionPrice: number;
  totalPrice: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert pricing string (e.g., "0.000005") to dollars per 1M tokens
 */
const parsePrice = (priceStr: string): number => {
  try {
    const price = parseFloat(priceStr);
    return isNaN(price) ? 0 : price * 1_000_000;
  } catch {
    return 0;
  }
};

/**
 * Format price for display
 */
const formatPrice = (pricePerMillion: number): string => {
  if (pricePerMillion === 0) return 'Free';
  if (pricePerMillion < 0.01) return `<$${pricePerMillion.toFixed(4)}`;
  if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}`;
  return `$${pricePerMillion.toFixed(2)}`;
};

/**
 * Get color class based on price tier
 */
const getPriceColor = (pricePerMillion: number): string => {
  if (pricePerMillion === 0) return 'text-green-400';
  if (pricePerMillion < 0.5) return 'text-green-400';
  if (pricePerMillion < 2) return 'text-yellow-400';
  if (pricePerMillion < 10) return 'text-orange-400';
  return 'text-red-400';
};

// ============================================================================
// MODEL SELECTOR COMPONENT
// ============================================================================

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  placeholder = 'Select a model...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse and enrich models with pricing info
  const modelOptions: ModelOption[] = useMemo(() => {
    return models.map(model => {
      const promptPrice = parsePrice(model.pricing.prompt);
      const completionPrice = parsePrice(model.pricing.completion);
      return {
        model,
        promptPrice,
        completionPrice,
        totalPrice: promptPrice + completionPrice
      };
    }).sort((a, b) => a.totalPrice - b.totalPrice); // Sort by price (ascending)
  }, [models]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return modelOptions;

    const query = searchQuery.toLowerCase();
    return modelOptions.filter(({ model }) =>
      model.name.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query)
    );
  }, [modelOptions, searchQuery]);

  // Find selected model
  const selectedOption = useMemo(() => {
    if (!selectedModelId) return null;
    return modelOptions.find(opt => opt.model.id === selectedModelId) || null;
  }, [modelOptions, selectedModelId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelId: string) => {
    onSelectModel(modelId === selectedModelId ? null : modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectModel(null);
    setIsOpen(false);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Area - using div to avoid nested button issue */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          w-full bg-slate-900 border rounded-lg px-4 py-2.5 text-left
          flex items-center justify-between gap-3
          focus:ring-2 focus:outline-none transition-all
          ${disabled
            ? 'border-slate-700 opacity-50 cursor-not-allowed'
            : 'border-slate-600 hover:border-slate-500 cursor-pointer focus:ring-cyan-500'
          }
        `}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">{selectedOption.model.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getPriceColor(selectedOption.totalPrice)} bg-slate-800`}>
                {formatPrice(selectedOption.totalPrice)}/1M
              </span>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              ✕
            </button>
          )}
          <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-700">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 pl-10 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                🔍
              </span>
            </div>
            {filteredModels.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {filteredModels.length} {filteredModels.length === 1 ? 'model' : 'models'} found
              </p>
            )}
          </div>

          {/* Model List */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredModels.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-lg mb-2">No models found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {filteredModels.map(({ model, promptPrice, completionPrice, totalPrice }) => {
                  const isSelected = model.id === selectedModelId;

                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => handleSelect(model.id)}
                      className={`
                        w-full px-4 py-3 text-left hover:bg-slate-800 transition-colors
                        ${isSelected ? 'bg-cyan-500/10 border-l-2 border-cyan-500' : ''}
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-medium truncate ${isSelected ? 'text-cyan-400' : 'text-white'}`}>
                              {model.name}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mb-2">
                            {model.id}
                          </p>
                          <div className="flex items-center gap-3 text-xs">
                            <span className={`flex items-center gap-1 ${getPriceColor(promptPrice)}`}>
                              <span>Prompt:</span>
                              <span className="font-medium">{formatPrice(promptPrice)}</span>
                            </span>
                            <span className={`flex items-center gap-1 ${getPriceColor(completionPrice)}`}>
                              <span>Completion:</span>
                              <span className="font-medium">{formatPrice(completionPrice)}</span>
                            </span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <span>📏</span>
                              <span>{(model.context_length / 1000).toFixed(0)}k ctx</span>
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-cyan-400 text-xl">✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredModels.length > 0 && (
            <div className="p-3 border-t border-slate-700 bg-slate-800/50">
              <p className="text-xs text-slate-500 text-center">
                Prices shown per 1M tokens
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
