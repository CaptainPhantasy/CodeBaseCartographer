/**
 * useFileChanges Hook
 * Manages file change notifications and diff viewing
 */

import { useState, useEffect, useCallback } from 'react';
import { getWebSocketClient, FileChangeEvent } from '../services/websocketClient';
import { getFileVersionStore } from '../services/fileVersionStore';
import { FileChange } from '../components/FileChangeNotification';

export interface UseFileChangesOptions {
  autoDismiss?: boolean;
  dismissDelay?: number;
}

export interface UseFileChangesReturn {
  changes: FileChange[];
  selectedFilePath: string | null;
  isWatching: boolean;
  isConnected: boolean;
  startWatching: () => void;
  stopWatching: () => void;
  viewDiff: (path: string) => void;
  closeDiff: () => void;
  clearChanges: () => void;
}

export function useFileChanges(
  options: UseFileChangesOptions = {}
): UseFileChangesReturn {
  const { autoDismiss = true, dismissDelay = 5000 } = options;

  const [changes, setChanges] = useState<FileChange[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsClient = getWebSocketClient();
    const versionStore = getFileVersionStore();

    // Subscribe to WebSocket messages
    const unsubscribeMessage = wsClient.onMessage((message) => {
      try {
        if (message.type === 'file:changed' || message.type === 'file:added' || message.type === 'file:deleted') {
          const fileChangeEvent = message as FileChangeEvent;

          // Validate required fields
          if (!fileChangeEvent.path || !fileChangeEvent.timestamp) {
            console.warn('[useFileChanges] Invalid file change event - missing required fields:', fileChangeEvent);
            return;
          }

          // Store version for changed/added files
          if (fileChangeEvent.content && (fileChangeEvent.type === 'file:changed' || fileChangeEvent.type === 'file:added')) {
            versionStore.storeVersion(
              fileChangeEvent.path,
              fileChangeEvent.content,
              fileChangeEvent.timestamp
            );
          }

          // Add to changes list
          const newChange: FileChange = {
            id: `${fileChangeEvent.path}-${fileChangeEvent.timestamp}`,
            type: fileChangeEvent.type,
            path: fileChangeEvent.path,
            timestamp: fileChangeEvent.timestamp
          };

          setChanges((prev) => [newChange, ...prev.slice(0, 9)]); // Keep max 10 changes
        }
      } catch (error) {
        console.error('[useFileChanges] Error processing WebSocket message:', error);
      }
    });

    // Subscribe to connection changes
    const unsubscribeConnection = wsClient.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    // Check initial state
    setIsWatching(wsClient.isActive());
    setIsConnected(wsClient.isConnected());

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
    };
  }, []);

  const startWatching = useCallback(() => {
    const wsClient = getWebSocketClient();
    wsClient.startWatching();
    setIsWatching(true);
  }, []);

  const stopWatching = useCallback(() => {
    const wsClient = getWebSocketClient();
    wsClient.stopWatching();
    setIsWatching(false);
  }, []);

  const viewDiff = useCallback((path: string) => {
    setSelectedFilePath(path);
  }, []);

  const closeDiff = useCallback(() => {
    setSelectedFilePath(null);
  }, []);

  const clearChanges = useCallback(() => {
    setChanges([]);
  }, []);

  return {
    changes,
    selectedFilePath,
    isWatching,
    isConnected,
    startWatching,
    stopWatching,
    viewDiff,
    closeDiff,
    clearChanges
  };
}

export default useFileChanges;
