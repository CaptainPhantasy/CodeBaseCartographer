/**
 * Watch Mode Toggle Component
 * Enables/disables real-time file watching
 */

import React, { useState, useEffect } from 'react';
import { getWebSocketClient } from '../services/websocketClient';

interface WatchModeToggleProps {
  onEnabledChange?: (enabled: boolean) => void;
  className?: string;
}

const WatchModeToggle: React.FC<WatchModeToggleProps> = ({
  onEnabledChange,
  className = ''
}) => {
  const [isWatching, setIsWatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const wsClient = getWebSocketClient();

    // Check initial state
    setIsConnected(wsClient.isConnected());
    setIsWatching(wsClient.isActive());

    // Subscribe to connection changes
    const unsubscribe = wsClient.onConnectionChange((connected) => {
      setIsConnected(connected);
      setIsConnecting(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggle = () => {
    const wsClient = getWebSocketClient();

    if (isWatching) {
      // Stop watching
      wsClient.stopWatching();
      setIsWatching(false);
      onEnabledChange?.(false);
    } else {
      // Start watching
      setIsConnecting(true);
      wsClient.startWatching();
      setIsWatching(true);
      onEnabledChange?.(true);
    }
  };

  const getStatusColor = () => {
    if (isConnecting) {
      return 'bg-yellow-500';
    }
    if (isConnected && isWatching) {
      return 'bg-green-500';
    }
    return 'bg-slate-500';
  };

  const getStatusText = () => {
    if (isConnecting) {
      return 'Connecting...';
    }
    if (isConnected && isWatching) {
      return 'Watching';
    }
    if (isWatching) {
      return 'Reconnecting...';
    }
    return 'Paused';
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Watch Mode</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${getStatusColor()} ${
              isConnected && isWatching ? 'animate-pulse' : ''
            }`}
          />
          <span className="text-xs text-slate-500">{getStatusText()}</span>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={isConnecting}
        className={`
          relative w-10 h-6 rounded-full p-1 transition-colors duration-200
          ${isWatching ? 'bg-cyan-600' : 'bg-slate-700'}
          ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
        `}
        aria-label={isWatching ? 'Disable watch mode' : 'Enable watch mode'}
      >
        <span
          className={`
            block w-4 h-4 bg-white rounded-full transition-transform duration-200
            ${isWatching ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
};

export default WatchModeToggle;
