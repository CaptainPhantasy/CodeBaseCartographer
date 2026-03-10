import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoApiKeyWarning } from './NoApiKeyWarning';

// Mock the useConfig hook
vi.mock('../hooks/useConfig', () => ({
  useConfig: vi.fn()
}));

import { useConfig } from '../hooks/useConfig';

describe('NoApiKeyWarning', () => {
  const mockOnOpenSetup = vi.fn();
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when API keys are configured', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [
          { providerId: 'openai', apiKey: 'sk-test123', isEnabled: true }
        ],
        taskMappings: [],
        preferences: {}
      }
    });

    const { container } = render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders warning banner when no API keys are configured', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [
          { providerId: 'openai', apiKey: '', isEnabled: true }
        ],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    expect(screen.getByText('No API Keys Configured')).toBeInTheDocument();
    expect(screen.getByText('Add at least one LLM provider key to enable AI features')).toBeInTheDocument();
  });

  it('renders warning when providers array is empty', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    expect(screen.getByText('No API Keys Configured')).toBeInTheDocument();
  });

  it('calls onOpenSetup when setup button is clicked', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /setup wizard/i }));

    expect(mockOnOpenSetup).toHaveBeenCalled();
  });

  it('calls onOpenSettings when settings button is clicked', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));

    expect(mockOnOpenSettings).toHaveBeenCalled();
  });

  it('shows security reminder at the bottom', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    // The text includes a lock emoji at the beginning
    expect(screen.getByText(/Keys are stored locally in your browser/)).toBeInTheDocument();
    expect(screen.getByText(/Never share your API keys/)).toBeInTheDocument();
  });

  it('has proper styling classes', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    const { container } = render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    const warningBanner = container.firstChild;
    expect(warningBanner).toHaveClass('bg-amber-500/10', 'border-b', 'border-amber-500/30');
  });

  it('displays warning icon', () => {
    vi.mocked(useConfig).mockReturnValue({
      config: {
        providers: [],
        taskMappings: [],
        preferences: {}
      }
    });

    render(
      <NoApiKeyWarning
        onOpenSetup={mockOnOpenSetup}
        onOpenSettings={mockOnOpenSettings}
      />
    );

    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });
});