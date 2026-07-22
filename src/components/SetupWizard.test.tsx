import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from './SetupWizard';

const configActions = vi.hoisted(() => ({
  setProviderKey: vi.fn().mockResolvedValue(undefined),
  setProviderValidation: vi.fn(),
  setTaskMapping: vi.fn(),
  importConfig: vi.fn().mockReturnValue(true),
  setConfig: vi.fn(),
}));

vi.mock('../hooks/useConfig', () => ({
  useConfig: () => ({ ...configActions, config: { providers: [], taskMappings: [] } }),
}));

vi.mock('../config/providers', () => {
  const providers = {
    openai: {
      id: 'openai', name: 'OpenAI', description: 'OpenAI models', models: [
        { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['text', 'code', 'vision', 'structured_output'] },
      ],
    },
    openrouter: {
      id: 'openrouter', name: 'OpenRouter', description: 'Multiple hosted models', models: [
        { id: 'vendor/model', name: 'Hosted model', capabilities: ['text', 'code', 'structured_output'] },
      ],
    },
  };
  return {
    PROVIDERS: providers,
    getAvailableProviders: () => Object.values(providers),
    getProvider: (id: keyof typeof providers) => providers[id],
  };
});

vi.mock('../config/configManager', () => ({
  getConfigManager: () => ({ getFullConfig: () => ({ providers: [], taskMappings: [] }) }),
}));

function selectOpenAI(): void {
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  fireEvent.click(screen.getByRole('button', { name: /OpenAI/i }));
}

describe('SetupWizard server-managed provider flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('explains that provider keys stay on the backend', () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    expect(screen.getByText('Welcome to Codebase Cartographer')).toBeInTheDocument();
    expect(screen.getByText(/backend environment/i)).toBeInTheDocument();
  });

  it('requires a provider preference before proceeding', () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('moves directly from provider selection to task mappings without requesting a secret', () => {
    render(<SetupWizard onComplete={vi.fn()} />);
    selectOpenAI();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Configure Tasks')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/API key/i)).not.toBeInTheDocument();
  });

  it('persists only provider enablement when setup completes', async () => {
    const onComplete = vi.fn();
    render(<SetupWizard onComplete={onComplete} />);
    selectOpenAI();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /start mapping/i }));

    await waitFor(() => expect(configActions.setProviderKey).toHaveBeenCalledWith('openai', '', true));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });
});
