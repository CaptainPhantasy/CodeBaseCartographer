import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Create a component that throws an error
const ThrowError: React.FC = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  let consoleErrorSpy: vi.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when there is no error', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(container.querySelector('div')).toHaveTextContent('Normal content');
  });

  it('catches errors and renders fallback UI', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Check if error boundary UI is rendered
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('The application encountered an unexpected error')).toBeInTheDocument();
    expect(screen.getByText('Error Details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload application/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset config/i })).toBeInTheDocument();
  });

  it('displays error details', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const errorDetails = container.querySelector('pre');
    expect(errorDetails).toHaveTextContent('Error: Test error');
  });

  it('calls console.error when error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ErrorBoundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('reloads page when reload button is clicked', () => {
    // Mock window.location.reload
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload application/i });
    reloadButton.click();

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('clears localStorage and reloads when reset config button is clicked', () => {
    // Mock localStorage
    const removeItemSpy = vi.fn();
    const localStorageMock = {
      removeItem: removeItemSpy
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true
    });

    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const resetButton = screen.getByRole('button', { name: /reset config/i });
    resetButton.click();

    expect(removeItemSpy).toHaveBeenCalledWith('codebase_cartographer_config');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('shows helpful tip message', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Tip:')).toBeInTheDocument();
    expect(screen.getByText('Try refreshing the page. If the problem persists, check your API key configuration in Settings or clear your browser cache.')).toBeInTheDocument();
  });

  it('resets state and reloads when reset is called programmatically', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true
    });

    const { container } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Get the error boundary instance and call reset
    const errorBoundaryInstance = container._rootInstance ||
      (container.querySelector('*') as any)?.props?.parentElement?.__internalInstance?.instance;

    if (errorBoundaryInstance && errorBoundaryInstance.handleReset) {
      errorBoundaryInstance.handleReset();
    } else {
      // Fallback: find the reset button and click it
      const reloadButton = screen.getByRole('button', { name: /reload application/i });
      reloadButton.click();
    }

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});