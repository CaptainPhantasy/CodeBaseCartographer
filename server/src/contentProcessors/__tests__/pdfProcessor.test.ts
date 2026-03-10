/**
 * Tests for PDF processor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pdf-parse module at the top level
const mockGetText = vi.fn();
const mockGetInfo = vi.fn();
const mockGetDateNode = vi.fn();

vi.mock('pdf-parse', () => {
  return {
    PDFParse: class MockPDFParse {
      constructor(options: any) {
        // Store the data buffer if needed
      }
      async getText() {
        return mockGetText();
      }
      async getInfo() {
        return mockGetInfo();
      }
    },
  };
});

// Import after mocking
import { processPdf } from '../pdfProcessor.js';

describe('PDF Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock functions
    mockGetText.mockReset();
    mockGetInfo.mockReset();
    mockGetDateNode.mockReset();
    // Set up default return values
    mockGetDateNode.mockReturnValue({});
  });

  describe('processPdf - basic functionality', () => {
    it('should extract text content from PDF', async () => {
      const mockText = 'This is sample PDF content';
      mockGetText.mockResolvedValue({ text: mockText });
      mockGetInfo.mockResolvedValue({
        total: 5,
        info: null,
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toBe('PDF with 5 pages');
      expect(result.extracts).toHaveLength(1);
      expect(result.extracts[0].path).toBe('/path/to/document.pdf');
      expect(result.extracts[0].content).toBe(mockText);
      expect(result.metadata?.numPages).toBe(5);
    });

    it('should handle PDFs with no text content', async () => {
      mockGetText.mockResolvedValue({ text: null });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: null,
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/empty.pdf');

      expect(result.extracts[0].content).toBe('[No text content found in PDF]');
      expect(result.metadata?.numPages).toBe(1);
    });

    it('should handle single page PDFs', async () => {
      const mockText = 'Single page content';
      mockGetText.mockResolvedValue({ text: mockText });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: null,
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/single.pdf');

      expect(result.summary).toBe('PDF with 1 page');
      expect(result.metadata?.numPages).toBe(1);
    });

    it('should handle multi-page PDFs with correct pluralization', async () => {
      mockGetText.mockResolvedValue({ text: 'Multi page content' });
      mockGetInfo.mockResolvedValue({
        total: 10,
        info: null,
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/multi.pdf');

      expect(result.summary).toBe('PDF with 10 pages');
      expect(result.metadata?.numPages).toBe(10);
    });
  });

  describe('processPdf - metadata extraction', () => {
    it('should extract title metadata', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 3,
        info: { Title: 'Sample Document Title' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toContain('titled "Sample Document Title"');
      expect(result.metadata?.title).toBe('Sample Document Title');
    });

    it('should extract author metadata', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 2,
        info: { Author: 'John Doe' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toContain('by John Doe');
      expect(result.metadata?.author).toBe('John Doe');
    });

    it('should extract both title and author in summary', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 5,
        info: { Title: 'My Document', Author: 'Jane Smith' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toBe('PDF with 5 pages titled "My Document" by Jane Smith');
      expect(result.metadata?.title).toBe('My Document');
      expect(result.metadata?.author).toBe('Jane Smith');
    });

    it('should extract subject metadata', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: { Subject: 'Annual Report' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.subject).toBe('Annual Report');
    });

    it('should extract creator metadata', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: { Creator: 'Adobe Acrobat' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.creator).toBe('Adobe Acrobat');
    });

    it('should extract producer metadata', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: { Producer: 'PDF Library v2.0' },
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.producer).toBe('PDF Library v2.0');
    });

    it('should extract creation and modification dates', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: vi.fn().mockReturnValue({
          CreationDate: '2024-01-15T10:30:00Z',
          ModDate: '2024-02-01T14:20:00Z',
        }),
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.creationDate).toBe('2024-01-15T10:30:00Z');
      expect(result.metadata?.modificationDate).toBe('2024-02-01T14:20:00Z');
    });

    it('should extract fingerprints if available', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
        fingerprints: ['abc123', 'def456'],
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.fingerprints).toEqual(['abc123', 'def456']);
    });

    it('should extract permissions if available', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
        permission: { print: true, copy: false, modify: false },
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.permissions).toEqual({ print: true, copy: false, modify: false });
    });

    it('should extract all available metadata fields', async () => {
      mockGetText.mockResolvedValue({ text: 'Complete content' });
      mockGetInfo.mockResolvedValue({
        total: 8,
        info: {
          Title: 'Complete Test',
          Author: 'Test Author',
          Subject: 'Test Subject',
          Creator: 'Test Creator',
          Producer: 'Test Producer',
        },
        getDateNode: vi.fn().mockReturnValue({
          CreationDate: '2024-01-01T00:00:00Z',
          ModDate: '2024-01-02T00:00:00Z',
        }),
        fingerprints: ['fingerprint1'],
        permission: { print: true },
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.title).toBe('Complete Test');
      expect(result.metadata?.author).toBe('Test Author');
      expect(result.metadata?.subject).toBe('Test Subject');
      expect(result.metadata?.creator).toBe('Test Creator');
      expect(result.metadata?.producer).toBe('Test Producer');
      expect(result.metadata?.creationDate).toBe('2024-01-01T00:00:00Z');
      expect(result.metadata?.modificationDate).toBe('2024-01-02T00:00:00Z');
      expect(result.metadata?.fingerprints).toEqual(['fingerprint1']);
      expect(result.metadata?.permissions).toEqual({ print: true });
      expect(result.metadata?.numPages).toBe(8);
    });
  });

  describe('processPdf - error handling', () => {
    it('should handle password-protected PDFs gracefully', async () => {
      mockGetText.mockRejectedValue(new Error('Password protected'));

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/protected.pdf');

      expect(result.summary).toBe('Failed to process PDF: Password protected');
      expect(result.extracts[0].content).toContain('Error processing PDF');
      expect(result.extracts[0].content).toContain('Password protected');
      expect(result.metadata?.error).toBe('Password protected');
      expect(result.metadata?.numPages).toBe(0);
    });

    it('should handle corrupted PDFs gracefully', async () => {
      mockGetText.mockRejectedValue(new Error('Invalid PDF structure'));

      const buffer = Buffer.from('corrupted pdf data');
      const result = await processPdf(buffer, '/path/to/corrupted.pdf');

      expect(result.summary).toBe('Failed to process PDF: Invalid PDF structure');
      expect(result.extracts[0].content).toContain('Error processing PDF');
      expect(result.extracts[0].content).toContain('Invalid PDF structure');
      expect(result.metadata?.error).toBe('Invalid PDF structure');
      expect(result.metadata?.numPages).toBe(0);
    });

    it('should handle unsupported PDF formats', async () => {
      mockGetText.mockRejectedValue(new Error('Unsupported PDF version'));

      const buffer = Buffer.from('unsupported pdf');
      const result = await processPdf(buffer, '/path/to/unsupported.pdf');

      expect(result.summary).toBe('Failed to process PDF: Unsupported PDF version');
      expect(result.extracts[0].content).toContain('may be password-protected, corrupted, or in an unsupported format');
    });

    it('should handle non-Error objects thrown', async () => {
      mockGetText.mockRejectedValue('String error');

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      // The library likely wraps non-Error objects, so we expect an Error message
      expect(result.summary).toContain('Failed to process PDF');
      expect(result.metadata?.error).toBeDefined();
      expect(result.metadata?.numPages).toBe(0);
    });

    it('should handle unknown errors', async () => {
      mockGetText.mockRejectedValue(new Error('Unknown error'));

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toBe('Failed to process PDF: Unknown error');
      expect(result.metadata?.error).toBe('Unknown error');
    });

    it('should include helpful error message for failed processing', async () => {
      mockGetText.mockRejectedValue(new Error('File is encrypted'));

      const buffer = Buffer.from('encrypted pdf');
      const result = await processPdf(buffer, '/path/to/encrypted.pdf');

      expect(result.extracts[0].content).toContain('[Error processing PDF: File is encrypted]');
      expect(result.extracts[0].content).toContain('This PDF may be password-protected, corrupted, or in an unsupported format.');
    });
  });

  describe('processPdf - edge cases', () => {
    it('should handle empty text content', async () => {
      mockGetText.mockResolvedValue({ text: '' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/empty.pdf');

      expect(result.extracts[0].content).toBe('[No text content found in PDF]');
    });

    it('should handle whitespace-only text content', async () => {
      mockGetText.mockResolvedValue({ text: '   \n\t  \n   ' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/whitespace.pdf');

      expect(result.extracts[0].content).toBe('   \n\t  \n   ');
    });

    it('should handle very long text content', async () => {
      const longText = 'A'.repeat(100000);
      mockGetText.mockResolvedValue({ text: longText });
      mockGetInfo.mockResolvedValue({
        total: 100,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/large.pdf');

      expect(result.extracts[0].content).toBe(longText);
      expect(result.metadata?.numPages).toBe(100);
    });

    it('should handle PDF with special characters in text', async () => {
      const specialText = 'Text with émojis 🎉 and spëcial çharacters';
      mockGetText.mockResolvedValue({ text: specialText });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/special.pdf');

      expect(result.extracts[0].content).toBe(specialText);
    });

    it('should handle PDF with newlines in text', async () => {
      const multilineText = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      mockGetText.mockResolvedValue({ text: multilineText });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/multiline.pdf');

      expect(result.extracts[0].content).toBe(multilineText);
    });

    it('should handle zero page PDF', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 0,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/nopage.pdf');

      expect(result.summary).toBe('PDF with 0 pages');
      expect(result.metadata?.numPages).toBe(0);
    });

    it('should handle large page count', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 9999,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/large.pdf');

      expect(result.summary).toBe('PDF with 9999 pages');
      expect(result.metadata?.numPages).toBe(9999);
    });

    it('should preserve file path in extracts', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 1,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const testPath = '/absolute/path/to/document.pdf';
      const result = await processPdf(buffer, testPath);

      expect(result.extracts[0].path).toBe(testPath);
    });

    it('should handle PDF with null info object', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 5,
        info: null,
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.metadata?.numPages).toBe(5);
      expect(result.metadata?.title).toBeUndefined();
      expect(result.metadata?.author).toBeUndefined();
    });

    it('should handle PDF with empty info object', async () => {
      mockGetText.mockResolvedValue({ text: 'Content' });
      mockGetInfo.mockResolvedValue({
        total: 3,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/path/to/document.pdf');

      expect(result.summary).toBe('PDF with 3 pages');
      expect(result.metadata?.numPages).toBe(3);
    });
  });

  describe('processPdf - integration scenarios', () => {
    it('should process a typical business document', async () => {
      mockGetText.mockResolvedValue({
        text: 'ANNUAL REPORT 2024\n\nExecutive Summary\nThis document contains the annual report...',
      });
      mockGetInfo.mockResolvedValue({
        total: 15,
        info: {
          Title: 'Annual Report 2024',
          Author: 'Finance Department',
          Subject: 'Annual Financial Report',
          Creator: 'Microsoft Word',
          Producer: 'Adobe PDF Library 15.0',
        },
        getDateNode: vi.fn().mockReturnValue({
          CreationDate: '2024-01-15T09:00:00Z',
          ModDate: '2024-01-20T14:30:00Z',
        }),
        fingerprints: ['sha256:abc123'],
        permission: { print: true, copy: true, modify: false },
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/documents/annual-report-2024.pdf');

      expect(result.summary).toBe('PDF with 15 pages titled "Annual Report 2024" by Finance Department');
      expect(result.metadata?.title).toBe('Annual Report 2024');
      expect(result.metadata?.author).toBe('Finance Department');
      expect(result.metadata?.subject).toBe('Annual Financial Report');
      expect(result.metadata?.creator).toBe('Microsoft Word');
      expect(result.metadata?.producer).toBe('Adobe PDF Library 15.0');
      expect(result.metadata?.numPages).toBe(15);
      expect(result.extracts[0].content).toContain('ANNUAL REPORT 2024');
    });

    it('should process a simple scanned document', async () => {
      mockGetText.mockResolvedValue({
        text: null,
      });
      mockGetInfo.mockResolvedValue({
        total: 3,
        info: {},
        getDateNode: mockGetDateNode,
      });

      const buffer = Buffer.from('fake pdf content');
      const result = await processPdf(buffer, '/scanned/doc.pdf');

      expect(result.summary).toBe('PDF with 3 pages');
      expect(result.extracts[0].content).toBe('[No text content found in PDF]');
    });
  });
});
