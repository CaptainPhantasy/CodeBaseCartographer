/**
 * useKeyboardShortcuts Hook - Global keyboard shortcut handling
 */

import { useEffect, useRef } from 'react';

export interface KeyboardShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * useKeyboardShortcuts Hook
 *
 * Registers global keyboard shortcuts with proper modifier key handling
 * Supports Cmd (Mac) and Ctrl (Windows/Linux)
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutConfig[],
  enabled: boolean = true
) {
  const handlersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    // Build handler map
    const handlerMap = new Map<string, () => void>();

    shortcuts.forEach((shortcut) => {
      const key = buildShortcutKey(shortcut);
      handlerMap.set(key, shortcut.handler);
    });

    handlersRef.current = handlerMap;

    // Keyboard event listener
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if in input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Cmd+K even in inputs
        if (!(event.metaKey || event.ctrlKey) || event.key !== 'k') {
          return;
        }
      }

      const key = buildShortcutKeyFromEvent(event);
      const handler = handlersRef.current.get(key);

      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

/**
 * Build a unique key for the shortcut configuration
 */
function buildShortcutKey(shortcut: KeyboardShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('ctrl');
  if (shortcut.metaKey) parts.push('meta');
  if (shortcut.shiftKey) parts.push('shift');
  if (shortcut.altKey) parts.push('alt');

  parts.push(shortcut.key.toLowerCase());

  return parts.join('+');
}

/**
 * Build a unique key from a keyboard event
 */
function buildShortcutKeyFromEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push('ctrl');
  if (event.metaKey) parts.push('meta');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');

  parts.push(event.key.toLowerCase());

  return parts.join('+');
}

/**
 * Format a shortcut for display in UI
 */
export function formatShortcut(shortcut: KeyboardShortcutConfig): string {
  const parts: string[] = [];

  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('Cmd');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');

  parts.push(shortcut.key.charAt(0).toUpperCase() + shortcut.key.slice(1));

  // Detect platform and use appropriate modifier
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return parts.join(isMac ? '' : '+').replace('CtrlCmd', isMac ? 'Cmd' : 'Ctrl');
}

/**
 * Default shortcuts for the app
 */
export function getDefaultShortcuts(handlers: {
  onOpenQuickActions: () => void;
  onFocusNode: () => void;
  onClearFocus: () => void;
  onCloseModals: () => void;
}): KeyboardShortcutConfig[] {
  return [
    {
      key: 'k',
      metaKey: true,
      handler: handlers.onOpenQuickActions,
      description: 'Open quick actions'
    },
    {
      key: 'f',
      metaKey: true,
      handler: handlers.onFocusNode,
      description: 'Focus selected node'
    },
    {
      key: 'f',
      metaKey: true,
      shiftKey: true,
      handler: handlers.onClearFocus,
      description: 'Clear focus'
    },
    {
      key: 'Escape',
      handler: handlers.onCloseModals,
      description: 'Close modals'
    }
  ];
}
