/**
 * useGraphUpdates Hook
 * Automatically updates the graph when architecture files change
 */

import { useEffect, useRef } from 'react';
import { getWebSocketClient, FileChangeEvent } from '../services/websocketClient';
import { GraphData } from '../types';

interface ArchitectureFile {
  pattern: RegExp;
  priority: number;
}

const ARCHITECTURE_FILES: ArchitectureFile[] = [
  { pattern: /architecture\.(ts|tsx|js|json|yaml|yml)$/i, priority: 1 },
  { pattern: /structure\.(ts|tsx|js|json|yaml|yml)$/i, priority: 2 },
  { pattern: /system\.(ts|tsx|js|json|yaml|yml)$/i, priority: 3 },
  { pattern: /config\.(ts|tsx|js|json|yaml|yml)$/i, priority: 4 },
  { pattern: /package\.json$/i, priority: 5 },
  { pattern: /tsconfig\.json$/i, priority: 6 },
  { pattern: /README\.(md|txt)$/i, priority: 7 }
];

interface UseGraphUpdatesOptions {
  enabled?: boolean;
  onUpdate?: (fileChangeEvent: FileChangeEvent) => void;
  debounceMs?: number;
}

export function useGraphUpdates(
  updateGraph: (data: GraphData) => void,
  options: UseGraphUpdatesOptions = {}
) {
  const { enabled = true, onUpdate, debounceMs = 2000 } = options;
  const debounceTimerRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<FileChangeEvent | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const wsClient = getWebSocketClient();

    const unsubscribe = wsClient.onMessage((message) => {
      if (
        message.type === 'file:changed' ||
        message.type === 'file:added' ||
        message.type === 'file:deleted'
      ) {
        const event = message as FileChangeEvent;

        // Check if file is an architecture file
        const isArchitectureFile = ARCHITECTURE_FILES.some((archFile) =>
          archFile.pattern.test(event.path)
        );

        if (!isArchitectureFile) {
          return;
        }

        // Store the pending update
        pendingUpdateRef.current = event;

        // Clear existing timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Set new debounce timer
        debounceTimerRef.current = window.setTimeout(() => {
          if (pendingUpdateRef.current) {
            // Call the update callback
            onUpdate?.(pendingUpdateRef.current);
            pendingUpdateRef.current = null;
          }
        }, debounceMs);
      }
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [enabled, onUpdate, debounceMs]);

  return {
    isMonitoring: enabled
  };
}

export default useGraphUpdates;
