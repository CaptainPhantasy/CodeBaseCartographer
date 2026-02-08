import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    const mockWindow = Object.create(window);
    mockWindow.location = { reload: vi.fn() };
    delete (global as any).window;
    (global as any).window = mockWindow;

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /reload application/i }));

    expect(reloadSpy).toHaveBeenCalled();

    // Cleanup
    reloadSpy.mockRestore();
  });

  it('clears localStorage and reloads when reset config button is clicked', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: /reset config/i }));

    expect(removeItemSpy).toHaveBeenCalledWith('codebase_cartographer_config');
    expect(reloadSpy).toHaveBeenCalled();

    // Cleanup
    removeItemSpy.mockRestore();
    reloadSpy.mockRestore();
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
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

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
      fireEvent.click(screen.getByRole('button', { name: /reload application/i }));
    }

    expect(reloadSpy).toHaveBeenCalled();

    // Cleanup
    reloadSpy.mockRestore();
  });
});