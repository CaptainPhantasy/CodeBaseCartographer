import { PDFParse } from 'pdf-parse';
import { ProcessedContent } from '../types.js';

/**
 * Process a PDF file and extract its text content and metadata.
 *
 * @param buffer - The PDF file content as a Buffer
 * @param filePath - The path to the PDF file
 * @returns ProcessedContent containing extracted text and metadata
 *
 * @throws Will return error message in text if PDF processing fails
 */
export async function processPdf(buffer: Buffer, filePath: string): Promise<ProcessedContent> {
  try {
    // Initialize PDF parser with the buffer data
    const parser = new PDFParse({ data: buffer });

    // Extract text content from all pages
    const textResult = await parser.getText();
    const fullText = textResult.text || '[No text content found in PDF]';

    // Extract metadata
    const infoResult = await parser.getInfo();
    const metadata: Record<string, any> = {
      numPages: infoResult.total,
    };

    // Add optional metadata if available from info dictionary
    if (infoResult.info) {
      if (infoResult.info.Title) {
        metadata.title = infoResult.info.Title;
      }
      if (infoResult.info.Author) {
        metadata.author = infoResult.info.Author;
      }
      if (infoResult.info.Subject) {
        metadata.subject = infoResult.info.Subject;
      }
      if (infoResult.info.Creator) {
        metadata.creator = infoResult.info.Creator;
      }
      if (infoResult.info.Producer) {
        metadata.producer = infoResult.info.Producer;
      }
    }

    // Add date information if available
    const dateNode = infoResult.getDateNode();
    if (dateNode.CreationDate) {
      metadata.creationDate = dateNode.CreationDate;
    }
    if (dateNode.ModDate) {
      metadata.modificationDate = dateNode.ModDate;
    }

    // Add fingerprints if available
    if (infoResult.fingerprints) {
      metadata.fingerprints = infoResult.fingerprints;
    }

    // Add permissions if available
    if (infoResult.permission) {
      metadata.permissions = infoResult.permission;
    }

    // Build a summary from the metadata
    const summaryParts = [`PDF with ${infoResult.total} page${infoResult.total !== 1 ? 's' : ''}`];
    if (metadata.title) {
      summaryParts.push(`titled "${metadata.title}"`);
    }
    if (metadata.author) {
      summaryParts.push(`by ${metadata.author}`);
    }

    // Return the processed content
    return {
      summary: summaryParts.join(' '),
      extracts: [
        {
          path: filePath,
          content: fullText,
        },
      ],
      metadata,
    };
  } catch (error) {
    // Handle errors gracefully for password-protected or corrupted PDFs
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      summary: `Failed to process PDF: ${errorMessage}`,
      extracts: [
        {
          path: filePath,
          content: `[Error processing PDF: ${errorMessage}]\n\nThis PDF may be password-protected, corrupted, or in an unsupported format.`,
        },
      ],
      metadata: {
        error: errorMessage,
        numPages: 0,
      },
    };
  }
}
