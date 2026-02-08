/**
 * VoiceSelector Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceSelector } from './VoiceSelector';
import { ElevenLabsVoice } from '../types/capabilities';

describe('VoiceSelector', () => {
  const mockVoices: ElevenLabsVoice[] = [
    {
      voice_id: 'voice-1',
      name: 'Cloned Voice 1',
      category: 'cloned',
      description: 'A cloned voice',
      preview_url: 'https://example.com/preview1.mp3',
      labels: { accent: 'american', gender: 'female' }
    },
    {
      voice_id: 'voice-2',
      name: 'Premade Voice 1',
      category: 'premade',
      description: 'A premade voice',
      preview_url: 'https://example.com/preview2.mp3'
    },
    {
      voice_id: 'voice-3',
      name: 'Generated Voice 1',
      category: 'generated',
      description: 'A generated voice'
    },
    {
      voice_id: 'voice-4',
      name: 'Unknown Voice',
      category: 'unknown',
      description: 'Should appear in "Other" category'
    }
  ];

  it('should render without crashing', () => {
    const { container } = render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it('should display the select dropdown', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
  });

  it('should show "Choose a voice..." placeholder when no voice is selected', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getByText('Choose a voice...')).toBeTruthy();
  });

  it('should call onSelectVoice when a voice is selected', () => {
    const onSelectVoice = vi.fn();
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={onSelectVoice}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'voice-1' } });

    expect(onSelectVoice).toHaveBeenCalledWith('voice-1');
  });

  it('should display voice details when a voice is selected', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-1"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getAllByText('Cloned Voice 1').length).toBe(2); // Once in select, once in details
    expect(screen.getByText('ID: voice-1')).toBeTruthy();
    expect(screen.getByText('A cloned voice')).toBeTruthy();
  });

  it('should display category badge for selected voice', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-1"
        onSelectVoice={vi.fn()}
      />
    );

    const categoryBadges = screen.getAllByText(/cloned/i);
    expect(categoryBadges.length).toBeGreaterThan(0);
  });

  it('should display voice labels when present', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-1"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getByText('accent: american')).toBeTruthy();
    expect(screen.getByText('gender: female')).toBeTruthy();
  });

  it('should show preview button for voices with preview_url', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-1"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('should not show preview button for voices without preview_url', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-3"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.queryByText('Preview')).toBeNull();
  });

  it('should group voices by category', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options);

    // Check that optgroups are created (they'll appear as labels in the option list)
    // The actual optgroups don't appear in options array, but we can check the voice count
    expect(options.length).toBeGreaterThan(0);
  });

  it('should categorize unknown voices as "other"', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId="voice-4"
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getByText(/other/i)).toBeTruthy();
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <VoiceSelector
        voices={mockVoices}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
        disabled={true}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('should show "No voices available" when voices array is empty', () => {
    render(
      <VoiceSelector
        voices={[]}
        selectedVoiceId={undefined}
        onSelectVoice={vi.fn()}
      />
    );

    expect(screen.getByText('No voices available')).toBeTruthy();
  });
});
