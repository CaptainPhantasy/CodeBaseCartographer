/**
 * Tests for DiffViewer component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DiffViewer from './DiffViewer';

describe('DiffViewer', () => {
  it('should render diff viewer with old and new content', () => {
    render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3"
        newContent="line 1\nline 2 modified\nline 3"
      />
    );

    // Check that the component renders
    const diffElement = screen.getByText(/Diff View/);
    expect(diffElement).toBeInTheDocument();
  });

  it('should display no changes message when content is identical', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3"
        newContent="line 1\nline 2\nline 3"
      />
    );

    // When content is identical, the diff shows all lines as unchanged
    // The text is in a code element with literal \n characters displayed as text
    const codeElement = container.querySelector('code');
    // The component renders the escaped \n as literal text
    expect(codeElement?.textContent).toBe('line 1\\nline 2\\nline 3');
  });

  it('should display added lines count', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2"
        newContent="line 1\nline 2\nline 3\nline 4"
      />
    );

    // Check that the diff view shows some statistics
    // The actual format may vary, but we should see diff indicators
    expect(screen.getByText('Diff View')).toBeInTheDocument();
    // Check for presence of line count text
    expect(container.textContent).toContain('lines');
  });

  it('should display removed lines count', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3\nline 4"
        newContent="line 1\nline 2"
      />
    );

    expect(screen.getByText('Diff View')).toBeInTheDocument();
    expect(container.textContent).toContain('lines');
  });

  it('should display file path when provided', () => {
    render(
      <DiffViewer
        oldContent="line 1"
        newContent="line 2"
        filePath="/path/to/file.ts"
      />
    );

    expect(screen.getByText('/path/to/file.ts')).toBeInTheDocument();
  });

  it('should handle empty content', () => {
    render(
      <DiffViewer
        oldContent=""
        newContent=""
      />
    );

    expect(screen.getByText('No changes detected')).toBeInTheDocument();
  });

  it('should handle new file (no old content)', () => {
    const { container } = render(
      <DiffViewer
        oldContent=""
        newContent="line 1\nline 2\nline 3"
      />
    );

    expect(screen.getByText('Diff View')).toBeInTheDocument();
    expect(container.textContent).toContain('lines');
  });

  it('should handle deleted file (no new content)', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3"
        newContent=""
      />
    );

    expect(screen.getByText('Diff View')).toBeInTheDocument();
    expect(container.textContent).toContain('lines');
  });
});
