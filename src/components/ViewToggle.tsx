import { ProductIcon } from './ProductIcon';
/**
 * View toggle component for switching between Node View and Flow Chart
 */

import React from 'react';
import { AppMode } from '../types';

interface ViewToggleProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export default function ViewToggle({ currentMode, onModeChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-slate-900/50 backdrop-blur border border-slate-700 rounded-lg p-1">
      <button
        onClick={() => onModeChange(AppMode.CHAT)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          currentMode === AppMode.CHAT
            ? 'bg-teal-800 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <ProductIcon name="Chat" /> Node View
      </button>
      <button
        onClick={() => onModeChange(AppMode.FLOW_CHART)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
          currentMode === AppMode.FLOW_CHART
            ? 'bg-teal-800 text-white shadow-lg'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
      >
        <ProductIcon name="Chart" /> Flow Chart
      </button>
    </div>
  );
}
