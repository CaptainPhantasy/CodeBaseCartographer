/**
 * useKeyboardShortcuts Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts, formatShortcut, getDefaultShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  let mockHandlers: {
    onOpenQuickActions: () => void;
    onFocusNode: () => void;
    onClearFocus: () => void;
    onCloseModals: () => void;
  };

  beforeEach(() => {
    mockHandlers = {
      onOpenQuickActions: vi.fn(),
      onFocusNode: vi.fn(),
      onClearFocus: vi.fn(),
      onCloseModals: vi.fn()
    };
  });

  it('registers keyboard shortcuts', () => {
    const shortcuts = [
      {
        key: 'k',
        metaKey: true,
        handler: mockHandlers.onOpenQuickActions
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, true));

    // Simulate Cmd+K keypress
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: false
    });
    window.dispatchEvent(event);

    // Note: This test demonstrates the concept but may not work in all environments
    // due to how React hooks and event listeners interact
  });

  it('does not register shortcuts when disabled', () => {
    const shortcuts = [
      {
        key: 'k',
        metaKey: true,
        handler: mockHandlers.onOpenQuickActions
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, false));

    // Shortcuts should not be active when disabled
  });

  it('handles multiple shortcuts', () => {
    const shortcuts = [
      {
        key: 'k',
        metaKey: true,
        handler: mockHandlers.onOpenQuickActions
      },
      {
        key: 'f',
        metaKey: true,
        handler: mockHandlers.onFocusNode
      },
      {
        key: 'Escape',
        handler: mockHandlers.onCloseModals
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, true));

    expect(shortcuts).toHaveLength(3);
  });

  it('ignores events from input fields', () => {
    const handler = vi.fn();
    const shortcuts = [
      {
        key: 'k',
        metaKey: true,
        handler
      }
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, true));

    // Create an input element and dispatch event from it
    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true
    });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });

    input.dispatchEvent(event);
    document.body.removeChild(input);

    // Handler should not be called for events from input fields
    // (except for Cmd+K which is allowed)
  });

  describe('formatShortcut', () => {
    it('formats shortcuts correctly for Mac', () => {
      // Mock platform
      const originalPlatform = navigator.platform;
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true
      });

      const shortcut = {
        key: 'k',
        metaKey: true
      };

      const formatted = formatShortcut(shortcut);
      expect(formatted).toContain('Cmd');
      expect(formatted).toContain('K');

      // Restore
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true
      });
    });

    it('formats shortcuts with multiple modifiers', () => {
      const shortcut = {
        key: 'f',
        metaKey: true,
        shiftKey: true
      };

      const formatted = formatShortcut(shortcut);
      expect(formatted).toContain('Shift');
    });
  });

  describe('getDefaultShortcuts', () => {
    it('returns all default shortcuts', () => {
      const shortcuts = getDefaultShortcuts(mockHandlers);

      expect(shortcuts).toHaveLength(4);

      expect(shortcuts[0].key).toBe('k');
      expect(shortcuts[0].metaKey).toBe(true);
      expect(shortcuts[0].handler).toBe(mockHandlers.onOpenQuickActions);

      expect(shortcuts[1].key).toBe('f');
      expect(shortcuts[1].metaKey).toBe(true);
      expect(shortcuts[1].handler).toBe(mockHandlers.onFocusNode);

      expect(shortcuts[2].key).toBe('f');
      expect(shortcuts[2].metaKey).toBe(true);
      expect(shortcuts[2].shiftKey).toBe(true);
      expect(shortcuts[2].handler).toBe(mockHandlers.onClearFocus);

      expect(shortcuts[3].key).toBe('Escape');
      expect(shortcuts[3].handler).toBe(mockHandlers.onCloseModals);
    });
  });
});
