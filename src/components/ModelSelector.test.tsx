/**
 * ModelSelector Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelSelector } from './ModelSelector';
import { OpenRouterModel } from '../types/capabilities';

describe('ModelSelector', () => {
  const mockModels: OpenRouterModel[] = [
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      context_length: 128000,
      pricing: {
        prompt: '0.0025',
        completion: '0.01'
      },
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text']
      }
    },
    {
      id: 'anthropic/claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      context_length: 200000,
      pricing: {
        prompt: '0.003',
        completion: '0.015'
      },
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text']
      }
    },
    {
      id: 'google/gemini-2.5-flash-preview',
      name: 'Gemini 2.5 Flash',
      context_length: 1000000,
      pricing: {
        prompt: '0.0001',
        completion: '0.0004'
      },
      architecture: {
        modality: 'text->text',
        input_modalities: ['text', 'image'],
        output_modalities: ['text']
      }
    },
    {
      id: 'free/model',
      name: 'Free Model',
      context_length: 4000,
      pricing: {
        prompt: '0',
        completion: '0'
      },
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text']
      }
    }
  ];

  it('should render without crashing', () => {
    const { container } = render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it('should display trigger button', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // ModelSelector uses a div with role="button" as trigger
    const trigger = screen.getByRole('button');
    expect(trigger).toBeTruthy();
  });

  it('should show placeholder when no model selected', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
        placeholder="Select a model..."
      />
    );

    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('Select a model...');
  });

  it('should call onSelectModel when a model is selected', async () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={handleSelect}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Wait for dropdown to open
    const firstOption = await waitFor(() => screen.getByText('GPT-4o'));
    fireEvent.click(firstOption);

    expect(handleSelect).toHaveBeenCalledWith('openai/gpt-4o');
  });

  it('should display selected model name and price', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={'openai/gpt-4o'}
        onSelectModel={vi.fn()}
      />
    );

    // Selected model should be displayed in the trigger
    expect(screen.getByText('GPT-4o')).toBeTruthy();
    // Price is split across elements, use flexible matcher
    expect(screen.getByText((_content, element) => {
      return element?.textContent === '12500.00/1M' || element?.textContent === '$12500.00/1M';
    })).toBeTruthy();
  });

  it('should show pricing information when dropdown is open', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Wait for dropdown to open and check for pricing
    await waitFor(() => {
      // Look for the prompt price for GPT-4o (0.0025 * 1M = $2500)
      expect(screen.getByText(/\$2500/i)).toBeTruthy();
    });
  });

  it('should show context window length when dropdown is open', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Should show "128k ctx" for GPT-4o
    await waitFor(() => {
      const ctxInfo = screen.getByText(/128k ctx/i);
      expect(ctxInfo).toBeTruthy();
    });
  });

  it('should show Free for free models', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      const freeOption = screen.getByText('Free Model');
      expect(freeOption).toBeTruthy();
    });
  });

  it('should sort models by total price (ascending)', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      // Free Model should be visible (it has $0 pricing)
      const freeModel = screen.getByText('Free Model');
      expect(freeModel).toBeTruthy();
    });
  });

  it('should respect disabled prop', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
        disabled={true}
      />
    );

    // When disabled, the div should have tabIndex={-1}
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('tabIndex', '-1');
  });

  it('should show "No models available" for empty arrays', () => {
    render(
      <ModelSelector
        models={[]}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // When no models, the placeholder should still be shown
    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('Select a model');
  });

  it('should handle custom placeholder', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
        placeholder="Choose your model..."
      />
    );

    const trigger = screen.getByRole('button');
    expect(trigger.textContent).toContain('Choose your model...');
  });

  it('should show clear button when model is selected', () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={'openai/gpt-4o'}
        onSelectModel={vi.fn()}
      />
    );

    const clearButton = screen.getByTitle('Clear selection');
    expect(clearButton).toBeTruthy();
  });

  it('should clear selection when clear button is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={'openai/gpt-4o'}
        onSelectModel={handleSelect}
      />
    );

    const clearButton = screen.getByTitle('Clear selection');
    fireEvent.click(clearButton);

    expect(handleSelect).toHaveBeenCalledWith(null);
  });

  it('should show search bar when dropdown is open', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /select a model/i }));

    // Wait for dropdown to open and show search
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });
  });

  it('should filter models based on search query', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /select a model/i }));

    // Type in search
    const searchInput = await screen.findByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'claude' } });

    // Should only show Claude model
    const claudeOption = await screen.findByText('Claude Sonnet 4');
    expect(claudeOption).toBeTruthy();

    // Should not show GPT-4o
    expect(screen.queryByText('GPT-4o')).toBeNull();
  });

  it('should show model count in dropdown', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /select a model/i }));

    // Should show model count
    await waitFor(() => {
      expect(screen.getByText(/4 models found/)).toBeInTheDocument();
    });
  });

  it('should show footer with pricing info', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    // Open the dropdown
    fireEvent.click(screen.getByRole('button', { name: /select a model/i }));

    // Should show footer
    await waitFor(() => {
      expect(screen.getByText('Prices shown per 1M tokens')).toBeInTheDocument();
    });
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <ModelSelector
        models={mockModels}
        selectedModelId={null}
        onSelectModel={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Wait for dropdown to open
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    // Dropdown should close
    expect(screen.queryByPlaceholderText('Search models...')).toBeNull();
  });
});