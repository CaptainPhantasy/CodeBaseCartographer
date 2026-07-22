import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoApiKeyWarning } from './NoApiKeyWarning';

let providers: Array<{ providerId: string; apiKey: string; isEnabled: boolean }> = [];
vi.mock('../hooks/useConfig', () => ({
  useConfig: () => ({ config: { providers } }),
}));

describe('NoApiKeyWarning', () => {
  it('hides when a server-backed provider is enabled', () => {
    providers = [{ providerId: 'openai', apiKey: '', isEnabled: true }];
    const { container } = render(<NoApiKeyWarning onOpenSetup={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('guides server configuration without claiming browser key storage', () => {
    providers = [];
    render(<NoApiKeyWarning onOpenSetup={vi.fn()} onOpenSettings={vi.fn()} />);
    expect(screen.getByText('No Server Providers Configured')).toBeInTheDocument();
    expect(screen.getByText(/backend environment/i)).toBeInTheDocument();
    expect(screen.getByText(/never stored in this browser/i)).toBeInTheDocument();
  });

  it('opens setup and settings actions', () => {
    providers = [];
    const openSetup = vi.fn();
    const openSettings = vi.fn();
    render(<NoApiKeyWarning onOpenSetup={openSetup} onOpenSettings={openSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /setup wizard/i }));
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(openSetup).toHaveBeenCalledOnce();
    expect(openSettings).toHaveBeenCalledOnce();
  });
});
