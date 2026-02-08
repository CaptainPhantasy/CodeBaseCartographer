import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from './SetupWizard';

// Mock all modules before importing
vi.mock('../hooks/useConfig', async () => {
  const actual = await vi.importActual<any>('../hooks/useConfig');
  return {
    ...actual,
    useConfig: vi.fn(),
  };
});

vi.mock('../utils/apiKeyValidator', () => ({
  validateApiKey: vi.fn(),
  quickValidateKeyFormat: vi.fn(),
}));

vi.mock('../utils/capabilityMatrix', () => ({
  getCapableProvidersForTask: vi.fn(),
  getBestProviderForTask: vi.fn(),
  TASK_REQUIRED_CAPABILITIES: {
    TEXT_GENERATION: ['text'],
    GRAPH_GENERATION: ['text', 'structured_output'],
    IMAGE_ANALYSIS: ['vision'],
    CODE_ANALYSIS: ['code'],
    TTS: ['tts']
  }
}));

vi.mock('../config/providers', () => ({
  PROVIDERS: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      capabilities: ['text', 'code', 'vision', 'tts', 'realtime_audio'],
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['text', 'code', 'vision'] }
      ]
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      capabilities: ['text', 'code', 'vision', 'structured_output', 'thinking'],
      models: [
        { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'code'] }
      ]
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      capabilities: ['text', 'code', 'vision', 'thinking'],
      models: []
    },
    google: {
      id: 'google',
      name: 'Google',
      capabilities: ['text', 'code', 'vision', 'tts', 'video', 'realtime_audio'],
      models: []
    },
    elevenlabs: {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      capabilities: ['tts'],
      models: []
    },
    local_llm: {
      id: 'local_llm',
      name: 'Local LLM',
      capabilities: ['text', 'code'],
      models: [],
      isAvailable: false
    }
  },
  getAvailableProviders: vi.fn(() => [
    { id: 'openai', name: 'OpenAI', capabilities: [], models: [] },
    { id: 'openrouter', name: 'OpenRouter', capabilities: [], models: [] },
    { id: 'anthropic', name: 'Anthropic', capabilities: [], models: [] },
    { id: 'google', name: 'Google', capabilities: [], models: [] },
    { id: 'elevenlabs', name: 'ElevenLabs', capabilities: [], models: [] }
  ]),
  getProvider: vi.fn((id) => {
    const providers: any = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        docsUrl: 'https://platform.openai.com/docs',
        keyInstructions: 'Get your API key',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', capabilities: ['text', 'code', 'vision'] }
        ]
      },
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        docsUrl: 'https://openrouter.ai/docs',
        keyInstructions: 'Get your API key',
        models: [
          { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', capabilities: ['text', 'code'] }
        ]
      }
    };
    return providers[id];
  })
}));

// Import mocked modules
import { useConfig, ConfigProvider } from '../hooks/useConfig';
import { validateApiKey, quickValidateKeyFormat } from '../utils/apiKeyValidator';
import { getCapableProvidersForTask, getBestProviderForTask } from '../utils/capabilityMatrix';

const mockUseConfig = {
  setProviderKey: vi.fn().mockResolvedValue(undefined),
  setProviderValidation: vi.fn(),
  setTaskMapping: vi.fn(),
  config: {
    version: '1.0.0',
    providers: [],
    taskMappings: [],
    preferences: {
      preferredTier: 'balanced',
      preferCost: false,
      preferSpeed: false
    },
    lastUpdated: new Date().toISOString()
  }
};

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      {ui}
    </ConfigProvider>
  );
}

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue(mockUseConfig);
    vi.mocked(validateApiKey).mockResolvedValue({ isValid: true, providerId: 'openai' });
    vi.mocked(quickValidateKeyFormat).mockReturnValue(true);
    vi.mocked(getCapableProvidersForTask).mockReturnValue(['openai', 'openrouter']);
    vi.mocked(getBestProviderForTask).mockReturnValue('openai');
  });

  it('renders welcome step initially', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Welcome to Codebase Cartographer')).toBeInTheDocument();
    expect(screen.getByText(/To get started, configure API keys/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('navigates to providers step', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Select Your Providers')).toBeInTheDocument();
    expect(screen.getByText('Choose which AI providers you want to configure')).toBeInTheDocument();
  });

  it('allows selecting multiple providers', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Select OpenAI - use getAllByText and get the first one (the card button)
    const openaiButtons = screen.getAllByText(/OpenAI/);
    const openaiButton = openaiButtons.find(el => el.closest('button'))?.closest('button');

    // Select OpenRouter - use more specific query to find the button
    const providerButtons = screen.getAllByRole('button').filter(btn =>
      btn.textContent?.includes('OpenRouter') && btn.querySelector('h3')
    );
    const openrouterButton = providerButtons[0];

    if (openaiButton) fireEvent.click(openaiButton);
    if (openrouterButton) fireEvent.click(openrouterButton);

    // Check that they have the selected styling (border-cyan-500)
    expect(openaiButton).toHaveClass('border-cyan-500');
    expect(openrouterButton).toHaveClass('border-cyan-500');
  });

  it('requires at least one provider selected to proceed', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Try to proceed without selecting any provider
    const nextButton = screen.getByRole('button', { name: /continue/i });
    expect(nextButton).toBeDisabled();
  });

  it('navigates to API keys step after selecting providers', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step and select a provider
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    // Click next
    const nextButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(nextButton);

    expect(screen.getByText('Enter API Keys')).toBeInTheDocument();
  });

  it('validates API key format', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to API keys step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Test quick validation
    vi.mocked(quickValidateKeyFormat).mockReturnValue(true);
    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    // Input should have the value
    expect(input).toHaveValue('sk-test123');
  });

  it('validates API key when validate button is clicked', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to API keys step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Enter API key and click validate
    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(validateApiKey).toHaveBeenCalledWith('openai', 'sk-test123');
    });
  });

  it('navigates to tasks step after successful validation', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to API keys step and validate
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    // Wait for validation to complete
    await waitFor(() => {
      expect(validateButton).toBeInTheDocument();
    });

    // Click continue to go to tasks step
    const nextButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(nextButton);

    expect(screen.getByText('Configure Tasks')).toBeInTheDocument();
  });

  it('allows assigning tasks to providers', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to tasks step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(validateButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Configure Tasks')).toBeInTheDocument();
    });

    // Check that task mapping controls are present
    expect(screen.getByText('Text Generation')).toBeInTheDocument();
    expect(screen.getByText('Chat and text responses')).toBeInTheDocument();
  });

  it('completes setup on last step', async () => {
    const mockOnComplete = vi.fn();

    renderWithProvider(<SetupWizard onComplete={mockOnComplete} />);

    // Navigate through all steps
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(validateButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Configure Tasks')).toBeInTheDocument();
    });

    // Click continue to go to complete step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("You're All Set!")).toBeInTheDocument();
    });

    // Click the start mapping button
    const finishButton = screen.getByRole('button', { name: /start mapping/i });
    fireEvent.click(finishButton);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('shows back button on all steps except welcome', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Welcome step - back button should be disabled
    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeDisabled();

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Now back button should be enabled
    expect(backButton).not.toBeDisabled();
  });

  it('progress indicator shows current step', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Initially on welcome (step 1)
    const stepIndicators = screen.getAllByRole('generic').filter(
      el => el.textContent && /^1$|^2$|^3$|^4$|^5$/.test(el.textContent)
    );
    expect(stepIndicators.length).toBeGreaterThan(0);

    // Navigate to providers (step 2)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Check that we're on step 2
    const secondStep = stepIndicators.find(el => el.textContent === '2');
    expect(secondStep).toBeInTheDocument();
  });

  it('shows completion summary', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Complete setup
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(validateButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Configure Tasks')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText("You're All Set!")).toBeInTheDocument();
      expect(screen.getByText(/Your API keys have been configured/)).toBeInTheDocument();
      expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
    });
  });

  it('displays provider selection cards with correct information', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Check that provider cards are displayed using more specific queries
    // Use querySelector to find the provider name within the button
    const providerNames = screen.getAllByRole('button').map(btn => {
      const h3 = btn.querySelector('h3');
      return h3?.textContent;
    }).filter(Boolean);

    expect(providerNames).toContain('OpenAI');
    expect(providerNames).toContain('OpenRouter');
    expect(providerNames).toContain('Anthropic');
    expect(providerNames).toContain('Google');
    expect(providerNames).toContain('ElevenLabs');
  });

  it('shows validation status for API keys', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Initially, no validation status badge should be shown
    // Check for the specific "Valid" badge with checkmark, not the "Validate" button
    expect(screen.queryByText(/✓ Valid/)).not.toBeInTheDocument();

    // Enter API key and validate
    const input = screen.getByPlaceholderText(/Enter your OpenAI API key/i);
    fireEvent.change(input, {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    // Wait for validation - check for the "Valid" badge with checkmark
    await waitFor(() => {
      expect(screen.getByText(/✓ Valid/)).toBeInTheDocument();
    });
  });

  it('prevents navigation without valid API key', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const openaiButton = screen.getByText(/OpenAI/).closest('button');
    if (openaiButton) fireEvent.click(openaiButton);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Try to continue without validating
    const nextButton = screen.getByRole('button', { name: /continue/i });

    // Should be disabled since no valid API key
    expect(nextButton).toBeDisabled();
  });
});
