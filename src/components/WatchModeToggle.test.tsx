/**
 * Tests for WatchModeToggle component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WatchModeToggle from './WatchModeToggle';
import { getWebSocketClient } from '../services/websocketClient';

// Mock WebSocket client
vi.mock('../services/websocketClient');

describe('WatchModeToggle', () => {
  const mockWsClient = {
    isActive: vi.fn(() => false),
    isConnected: vi.fn(() => false),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    onConnectionChange: vi.fn(() => vi.fn())
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWebSocketClient).mockReturnValue(mockWsClient as any);
  });

  it('should render watch mode toggle', () => {
    render(<WatchModeToggle />);

    expect(screen.getByText(/Watch Mode/)).toBeInTheDocument();
  });

  it('should display paused status when not watching', () => {
    mockWsClient.isActive.mockReturnValue(false);
    mockWsClient.isConnected.mockReturnValue(false);

    render(<WatchModeToggle />);

    expect(screen.getByText(/Paused/)).toBeInTheDocument();
  });

  it('should display watching status when active', () => {
    mockWsClient.isActive.mockReturnValue(true);
    mockWsClient.isConnected.mockReturnValue(true);

    render(<WatchModeToggle />);

    expect(screen.getByText(/Watching/)).toBeInTheDocument();
  });

  it('should call startWatching when toggled on', () => {
    mockWsClient.isActive.mockReturnValue(false);

    const onEnabledChange = vi.fn();
    render(<WatchModeToggle onEnabledChange={onEnabledChange} />);

    const toggle = screen.getByRole('button', { name: /Enable watch mode/i });

    fireEvent.click(toggle);

    expect(mockWsClient.startWatching).toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('should call stopWatching when toggled off', () => {
    mockWsClient.isActive.mockReturnValue(true);
    mockWsClient.isConnected.mockReturnValue(true);

    const onEnabledChange = vi.fn();
    render(<WatchModeToggle onEnabledChange={onEnabledChange} />);

    const toggle = screen.getByRole('button');

    fireEvent.click(toggle);

    expect(mockWsClient.stopWatching).toHaveBeenCalled();
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it('should apply custom className', () => {
    const { container } = render(<WatchModeToggle className="custom-class" />);

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
