/**
 * NoApiKeyWarning Component - Shows warning banner when no API keys are configured
 */

import React from 'react';
import { useConfig } from '../hooks/useConfig';

interface NoApiKeyWarningProps {
  onOpenSetup: () => void;
  onOpenSettings: () => void;
}

export const NoApiKeyWarning: React.FC<NoApiKeyWarningProps> = ({ onOpenSetup, onOpenSettings }) => {
  const { config } = useConfig();
  const hasAnyKey = config.providers.some(p => p.isEnabled);

  if (hasAnyKey) {
    return null;
  }

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 text-xl">⚠️</span>
          <div>
            <p className="text-amber-200 font-medium">No Server Providers Configured</p>
            <p className="text-amber-300/70 text-sm">
              Add a provider key to the backend environment to enable AI features
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSetup}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Setup Wizard
          </button>
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Settings
          </button>
        </div>
      </div>

      {/* Security reminder */}
      <div className="max-w-7xl mx-auto px-4 pb-2">
        <p className="text-xs text-amber-400/60">
          🔒 Provider keys stay on the backend and are never stored in this browser.
        </p>
      </div>
    </div>
  );
};

export default NoApiKeyWarning;
