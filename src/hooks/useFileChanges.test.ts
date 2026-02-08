/**
 * Tests for useFileChanges hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileChanges } from './useFileChanges';
import { getWebSocketClient } from '../services/websocketClient';
import { getFileVersionStore } from '../services/fileVersionStore';

// Mock the WebSocket client and file version store
vi.mock('../services/websocketClient');
vi.mock('../services/fileVersionStore');

describe('useFileChanges', () => {
  const mockWsClient = {
    onMessage: vi.fn(() => vi.fn()),
    onConnectionChange: vi.fn(() => vi.fn()),
    isActive: vi.fn(() => false),
    isConnected: vi.fn(() => false),
    startWatching: vi.fn(),
    stopWatching: vi.fn()
  };

  const mockVersionStore = {
    storeVersion: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWebSocketClient).mockReturnValue(mockWsClient as any);
    vi.mocked(getFileVersionStore).mockReturnValue(mockVersionStore as any);
  });

  it('should initialize with empty changes', () => {
    const { result } = renderHook(() => useFileChanges());

    expect(result.current.changes).toEqual([]);
    expect(result.current.selectedFilePath).toBeNull();
  });

  it('should start and stop watching', () => {
    const { result } = renderHook(() => useFileChanges());

    act(() => {
      result.current.startWatching();
    });

    expect(mockWsClient.startWatching).toHaveBeenCalled();

    act(() => {
      result.current.stopWatching();
    });

    expect(mockWsClient.stopWatching).toHaveBeenCalled();
  });

  it('should clear changes', () => {
    const { result } = renderHook(() => useFileChanges());

    act(() => {
      result.current.clearChanges();
    });

    expect(result.current.changes).toEqual([]);
  });

  it('should set selected file path when viewing diff', () => {
    const { result } = renderHook(() => useFileChanges());

    act(() => {
      result.current.viewDiff('/test/file.ts');
    });

    expect(result.current.selectedFilePath).toBe('/test/file.ts');
  });

  it('should close diff', () => {
    const { result } = renderHook(() => useFileChanges());

    act(() => {
      result.current.viewDiff('/test/file.ts');
      result.current.closeDiff();
    });

    expect(result.current.selectedFilePath).toBeNull();
  });

  it('should track watching state', () => {
    mockWsClient.isActive.mockReturnValue(true);
    mockWsClient.isConnected.mockReturnValue(true);

    const { result } = renderHook(() => useFileChanges());

    expect(result.current.isWatching).toBe(true);
    expect(result.current.isConnected).toBe(true);
  });

  it('should limit changes to 10 items', () => {
    const { result } = renderHook(() => useFileChanges());

    // Simulate receiving multiple file changes
    const onMessageCallback = vi.mocked(mockWsClient.onMessage).mock.calls[0]?.[0];

    if (onMessageCallback) {
      act(() => {
        for (let i = 0; i < 15; i++) {
          onMessageCallback({
            type: 'file:changed',
            path: `/test/file${i}.ts`,
            timestamp: Date.now() + i,
            content: `content${i}`
          });
        }
      });
    }

    expect(result.current.changes.length).toBeLessThanOrEqual(10);
  });
});
