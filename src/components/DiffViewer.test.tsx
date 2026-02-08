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

    expect(screen.getByText(/No changes detected/)).toBeInTheDocument();
  });

  it('should display added lines count', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2"
        newContent="line 1\nline 2\nline 3\nline 4"
      />
    );

    expect(screen.getByText(/\+2 lines/)).toBeInTheDocument();
  });

  it('should display removed lines count', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3\nline 4"
        newContent="line 1\nline 2"
      />
    );

    expect(screen.getByText(/-2 lines/)).toBeInTheDocument();
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

    expect(screen.getByText(/No changes detected/)).toBeInTheDocument();
  });

  it('should handle new file (no old content)', () => {
    const { container } = render(
      <DiffViewer
        oldContent=""
        newContent="line 1\nline 2\nline 3"
      />
    );

    expect(screen.getByText(/\+3 lines/)).toBeInTheDocument();
  });

  it('should handle deleted file (no new content)', () => {
    const { container } = render(
      <DiffViewer
        oldContent="line 1\nline 2\nline 3"
        newContent=""
      />
    );

    expect(screen.getByText(/-3 lines/)).toBeInTheDocument();
  });
});
