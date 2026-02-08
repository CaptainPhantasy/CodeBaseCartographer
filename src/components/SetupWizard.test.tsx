import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetupWizard } from './SetupWizard';
import { ConfigProvider } from '../hooks/useConfig';

// Mock the config hook
vi.mock('../hooks/useConfig');

// Mock utils
vi.mock('../utils/apiKeyValidator');
vi.mock('../utils/capabilityMatrix');

// Mock providers config
vi.mock('../config/providers', () => ({
  PROVIDERS: {
    openai: { name: 'OpenAI', capabilities: ['text', 'code', 'vision', 'tts', 'realtime_audio'] },
    openrouter: { name: 'OpenRouter', capabilities: ['text', 'code', 'vision', 'structured_output', 'thinking'] },
    anthropic: { name: 'Anthropic', capabilities: ['text', 'code', 'vision', 'thinking'] },
    google: { name: 'Google', capabilities: ['text', 'code', 'vision', 'tts', 'video', 'realtime_audio'] },
    elevenlabs: { name: 'ElevenLabs', capabilities: ['tts'] },
    local_llm: { name: 'Local LLM', capabilities: ['text', 'code'] }
  },
  getAvailableProviders: vi.fn(() => ['openai', 'openrouter', 'anthropic', 'google', 'elevenlabs']),
  getProvider: vi.fn((id) => ({
    name: id === 'openai' ? 'OpenAI' : id === 'openrouter' ? 'OpenRouter' : 'Unknown',
    capabilities: ['text', 'code']
  }))
}));

// Mock capabilities
const mockGetCapableProvidersForTask = vi.fn();
const mockGetBestProviderForTask = vi.fn();

vi.mock('../utils/capabilityMatrix', () => ({
  getCapableProvidersForTask: mockGetCapableProvidersForTask,
  getBestProviderForTask: mockGetBestProviderForTask,
  TASK_REQUIRED_CAPABILITIES: {
    text_generation: ['text'],
    image_analysis: ['vision'],
    code_analysis: ['code'],
    tts: ['tts']
  }
}));

const mockUseConfig = {
  setProviderKey: vi.fn(),
  setProviderValidation: vi.fn(),
  setTaskMapping: vi.fn(),
  config: {
    providers: [],
    taskMappings: [],
    preferences: {
      defaultModel: 'gemini-3-flash-preview',
      temperature: 0.7,
      maxTokens: undefined,
      autoSave: true,
      theme: 'light'
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
    (require('../hooks/useConfig').useConfig as any).mockReturnValue(mockUseConfig);

    // Mock validation
    const { validateApiKey, quickValidateKeyFormat } = require('../utils/apiKeyValidator');
    validateApiKey.mockResolvedValue({ isValid: true, providerId: 'openai' });
    quickValidateKeyFormat.mockReturnValue(true);

    // Mock capability functions
    mockGetCapableProvidersForTask.mockReturnValue(['openai', 'openrouter']);
    mockGetBestProviderForTask.mockReturnValue('openai');
  });

  it('renders welcome step initially', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    expect(screen.getByText('Welcome to Codebase Cartographer')).toBeInTheDocument();
    expect(screen.getByText('Get started by configuring your AI providers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('navigates to providers step', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    expect(screen.getByText('Select AI Providers')).toBeInTheDocument();
    expect(screen.getByText('Choose which AI providers you want to use')).toBeInTheDocument();
  });

  it('allows selecting multiple providers', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    // Select OpenAI
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByText(/OpenRouter/));

    expect(screen.getByText(/OpenAI/)).toHaveClass('bg-blue-500');
    expect(screen.getByText(/OpenRouter/)).toHaveClass('bg-purple-500');
  });

  it('requires at least one provider selected to proceed', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    // Try to proceed without selecting any provider
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it('navigates to API keys step after selecting providers', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to providers step and select a provider
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));

    // Click next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Enter API Keys')).toBeInTheDocument();
  });

  it('validates API key format', () => {
    const { quickValidateKeyFormat } = require('../utils/apiKeyValidator');

    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to API keys step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Test quick validation
    quickValidateKeyFormat.mockReturnValue(true);
    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
      target: { value: 'sk-test123' }
    });

    expect(screen.getByText(/OpenAI/)).toHaveClass('bg-green-500');
  });

  it('validates API key when validate button is clicked', async () => {
    const { validateApiKey } = require('../utils/apiKeyValidator');

    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to API keys step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Enter API key and click validate
    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
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
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
      target: { value: 'sk-test123' }
    });

    const validateButton = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Assign Tasks to Providers')).toBeInTheDocument();
    });
  });

  it('allows assigning tasks to providers', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Navigate to tasks step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
      target: { value: 'sk-test123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      const taskSelect = screen.getByLabelText(/Text Generation/i).nextElementSibling;
      if (taskSelect) {
        fireEvent.click(taskSelect);
        fireEvent.click(screen.getByText(/OpenAI/));
      }
    });

    expect(screen.getByLabelText(/Text Generation/i)).toHaveValue('openai');
  });

  it('completes setup on last step', async () => {
    const mockOnComplete = vi.fn();

    renderWithProvider(<SetupWizard onComplete={mockOnComplete} />);

    // Navigate through all steps
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
      target: { value: 'sk-test123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
    });

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('shows back button on all steps except welcome', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Welcome step - no back button
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();

    // Navigate to providers step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    // Now back button should appear
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('progress indicator shows current step', () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Initially on welcome (step 1)
    expect(screen.getByText('1/5')).toBeInTheDocument();

    // Navigate to providers (step 2)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('shows completion summary', async () => {
    renderWithProvider(<SetupWizard onComplete={vi.fn()} />);

    // Complete setup
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    fireEvent.click(screen.getByText(/OpenAI/));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/Enter your OpenAI API key/i), {
      target: { value: 'sk-test123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /validate/i }));

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Setup Complete!')).toBeInTheDocument();
      expect(screen.getByText(/You have successfully configured/)).toBeInTheDocument();
      expect(screen.getByText(/OpenAI/)).toBeInTheDocument();
    });
  });
});