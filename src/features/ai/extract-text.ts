import { AppError } from '@/lib/errors';

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB

export type ImportFileKind = 'pdf' | 'docx';

export interface ExtractedDocument {
  kind: ImportFileKind;
  mimeType: string;
  /** Plain text, used for search chunks (RAG). */
  text: string;
  /** DOCX only: HTML that keeps headings, lists and tables for the AI. */
  html?: string;
}

/** Identify the file from its first bytes, not its name or the browser's MIME type. */
export function detectFileKind(buffer: Buffer): ImportFileKind | 'doc' | null {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  // DOCX is a ZIP container with a word/ folder.
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from('word/'))) return 'docx';
  // Legacy Word 97-2003 (.doc) OLE container.
  if (buffer.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) return 'doc';
  return null;
}

/** Normalise whitespace so chunks are clean. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function extractDocument(buffer: Buffer): Promise<ExtractedDocument> {
  if (buffer.length > MAX_IMPORT_BYTES) {
    throw new AppError('The file is larger than 4 MB. Compress it or split it into smaller files.', 'FILE_TOO_LARGE', 413);
  }

  const kind = detectFileKind(buffer);
  if (kind === 'doc') {
    throw new AppError('Old Word files (.doc) are not supported. Save it as .docx or PDF and upload again.', 'UNSUPPORTED_FILE', 415);
  }
  if (!kind) {
    throw new AppError('Only PDF and Word (.docx) files can be imported.', 'UNSUPPORTED_FILE', 415);
  }

  if (kind === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return { kind, mimeType: 'application/pdf', text: tidy(text) };
    } catch {
      throw new AppError('This PDF could not be read. It may be password-protected or damaged.', 'UNREADABLE_FILE', 422);
    }
  }

  const mammoth = (await import('mammoth')).default;
  try {
    const [{ value: html }, { value: raw }] = await Promise.all([
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);
    return {
      kind,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      text: tidy(raw),
      html,
    };
  } catch {
    throw new AppError('This Word file could not be read. Re-save it as .docx and try again.', 'UNREADABLE_FILE', 422);
  }
}
