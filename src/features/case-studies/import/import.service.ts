import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { generateJson, type GeminiPart } from '@/lib/gemini';
import { extractDocument } from '@/features/ai/extract-text';
import { EXTRACTION_JSON_SCHEMA, extractionSchema, type CaseStudyExtraction } from './import.schema';
import { storeSource } from '@/features/ai/rag.service';

const SYSTEM_PROMPT = `You extract structured case-study content for Vionsys, an IT services company, from a client project document.

Rules:
- Use only information in the document. Never invent clients, numbers, dates, names or quotes. If something is not in the document, leave the field empty ("" or []) and list it in "missing".
- Keep figures exactly as written. You may tighten wording for readability, but keep the facts and the document's terminology.
- challenge: the client's situation and problem. approach: what was done and how. Use paragraphs, and bullets/numbered lists where the source lists things.
- metrics: only quantified outcomes from the document. value = the number with its unit (e.g. "40%", "3x", "$1.2M"); label = what it measures.
- testimonial: only a verbatim quote attributed to a person at the client.
- processSteps: the delivery phases in order, if the document describes them.
- faqs: up to 5 questions a prospective client would ask, answered strictly from the document. Empty if the document cannot answer them.
- cta: a short, factual closing call to action about working with Vionsys on similar projects.
- extraSections: substantial content that fits nowhere else (technology stack, team, integrations, timeline).
- tables: transcribe every table faithfully.
- seo: write the meta title and description from the document's content.`;

const USER_INSTRUCTION = 'Extract the case study from this document into the required JSON structure.';

export interface ImportResult {
  extraction: CaseStudyExtraction;
  source: { id: string; fileName: string; chunkCount: number; createdAt: Date };
  warnings: string[];
}

export async function importDocument(params: {
  caseStudyId: string;
  fileName: string;
  buffer: Buffer;
  userId: string;
}): Promise<ImportResult> {
  const { caseStudyId, fileName, buffer, userId } = params;

  const caseStudy = await prisma.caseStudy.findUnique({ where: { id: caseStudyId }, select: { id: true, title: true } });
  if (!caseStudy) throw new AppError('Case study not found.', 'NOT_FOUND', 404);

  const doc = await extractDocument(buffer);

  // PDFs go to Gemini as the original file (it reads layout, tables and scanned pages).
  // DOCX is sent as HTML from mammoth, which keeps headings, lists and tables.
  const parts: GeminiPart[] =
    doc.kind === 'pdf'
      ? [{ inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }, { text: USER_INSTRUCTION }]
      : [{ text: `${USER_INSTRUCTION}\n\nDOCUMENT (converted from Word to HTML):\n\n${doc.html ?? doc.text}` }];

  if (doc.kind === 'docx' && !doc.text) {
    throw new AppError('This Word file has no text to import.', 'EMPTY_FILE', 422);
  }

  const raw = await generateJson<unknown>({ system: SYSTEM_PROMPT, parts, schema: EXTRACTION_JSON_SCHEMA });
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error('AI extraction did not match the schema', parsed.error.issues.slice(0, 5));
    throw new AppError('The AI returned content in an unexpected format. Try again.', 'AI_BAD_OUTPUT', 502);
  }

  // Keep the extracted text (not the file) as a searchable source for "Ask AI".
  // The original file is not stored: the media bucket serves public URLs, and
  // client documents may be confidential.
  const stored = await storeSource({
    ownerType: 'case-study',
    ownerId: caseStudyId,
    fileName,
    doc,
    size: buffer.length,
    userId,
  });
  const warnings = stored.warnings;

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'CASE_STUDY_IMPORT',
      details: `Imported "${fileName.slice(0, 120)}" into case study: "${caseStudy.title}" (${caseStudyId})`,
    },
  });

  return { extraction: parsed.data, source: stored.source, warnings };
}
