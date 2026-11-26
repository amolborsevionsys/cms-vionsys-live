import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { cosineSimilarity, embedQuery, embedTexts, generateText } from '@/lib/gemini';
import type { ExtractedDocument } from './extract-text';

/*
 * Per-item retrieval-augmented generation, shared by case studies and blog posts.
 *
 * Each uploaded document is split into overlapping chunks, embedded once, and stored
 * in ContentSourceChunk under its owner (a case study or blog post id). A question is
 * embedded, compared against that owner's chunks only (cosine similarity, in-app; fine
 * for hundreds of chunks), and the best passages are given to Gemini with instructions
 * to answer from them alone and cite them.
 */

export type SourceOwnerType = 'case-study' | 'blog';

const CHUNK_SIZE = 1200; // characters
const CHUNK_OVERLAP = 200;
const MAX_CHUNKS_PER_SOURCE = 300;
const TOP_K = 6;
const MIN_SCORE = 0.35;

const OWNER_LABEL: Record<SourceOwnerType, string> = {
  'case-study': 'a B2B case study',
  blog: 'a B2B blog post',
};

/** Split on paragraph boundaries into ~CHUNK_SIZE pieces with a small overlap. */
export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = current.slice(-CHUNK_OVERLAP); // carry context into the next chunk
  };

  for (const paragraph of paragraphs) {
    // Very long paragraphs are hard-split.
    const pieces = paragraph.length > CHUNK_SIZE ? paragraph.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [] : [paragraph];
    for (const piece of pieces) {
      if (current.length + piece.length + 2 > CHUNK_SIZE && current.length > CHUNK_OVERLAP) push();
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current.trim() && (chunks.length === 0 || !chunks[chunks.length - 1].endsWith(current.trim()))) {
    chunks.push(current.trim());
  }
  return chunks.slice(0, MAX_CHUNKS_PER_SOURCE);
}

/** Embed a source's text and store its chunks. Returns the number of chunks stored. */
async function indexSource(ownerId: string, sourceId: string, text: string): Promise<number> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;
  const vectors = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT');
  await prisma.contentSourceChunk.createMany({
    data: chunks.map((chunk, position) => ({ sourceId, ownerId, position, text: chunk, embedding: vectors[position] })),
  });
  await prisma.contentSource.update({ where: { id: sourceId }, data: { chunkCount: chunks.length } });
  return chunks.length;
}

/**
 * Save an uploaded document's text as a source and index it for Ask AI.
 * Indexing failures don't fail the import; they come back as warnings.
 */
export async function storeSource(params: {
  ownerType: SourceOwnerType;
  ownerId: string;
  fileName: string;
  doc: ExtractedDocument;
  size: number;
  userId: string;
}) {
  const { ownerType, ownerId, fileName, doc, size, userId } = params;
  const warnings: string[] = [];
  const source = await prisma.contentSource.create({
    data: { ownerType, ownerId, fileName: fileName.slice(0, 200), mimeType: doc.mimeType, size, text: doc.text, uploadedBy: userId },
  });

  let chunkCount = 0;
  if (!doc.text) {
    warnings.push('This PDF has no selectable text (it may be scanned), so Ask AI cannot search it. The import itself still worked.');
  } else {
    try {
      chunkCount = await indexSource(ownerId, source.id, doc.text);
    } catch (err) {
      logger.error('Indexing document for Ask AI failed', err);
      warnings.push('The document was imported, but indexing it for Ask AI failed. Remove it and upload again to retry.');
    }
  }
  return { source: { id: source.id, fileName: source.fileName, chunkCount, createdAt: source.createdAt }, warnings };
}

export interface AskResult {
  answer: string;
  citations: { n: number; sourceName: string; excerpt: string }[];
}

const askSystem = (ownerType: SourceOwnerType) => `You help an editor write ${OWNER_LABEL[ownerType]} for Vionsys, an IT services company.
Answer ONLY from the numbered source passages provided. Rules:
- If the passages do not contain the answer, say "I couldn't find that in the uploaded documents." and stop.
- Never invent numbers, names, dates or quotes. Keep figures exactly as written.
- Cite passages inline as [1], [2] after the sentence they support.
- Write clear, professional copy. Use short paragraphs, or "- " bullet lines for lists. No markdown headings, no bold.`;

export async function askSources(ownerType: SourceOwnerType, ownerId: string, question: string): Promise<AskResult> {
  const chunks = await prisma.contentSourceChunk.findMany({
    where: { ownerId },
    select: { sourceId: true, text: true, embedding: true },
  });
  if (chunks.length === 0) {
    throw new AppError(
      'Upload a PDF or Word document in the AI tab first. Answers come only from documents uploaded here.',
      'NO_SOURCES',
      409
    );
  }

  const queryVector = await embedQuery(question);
  const ranked = chunks
    .map((c) => ({ ...c, score: cosineSimilarity(queryVector, c.embedding) }))
    .sort((a, b) => b.score - a.score);
  const relevant = ranked.filter((c) => c.score >= MIN_SCORE).slice(0, TOP_K);
  // Always give the model something to work with for broad requests ("summarise…").
  const passages = relevant.length > 0 ? relevant : ranked.slice(0, 3);

  const sources = await prisma.contentSource.findMany({
    where: { id: { in: [...new Set(passages.map((p) => p.sourceId))] } },
    select: { id: true, fileName: true },
  });
  const nameOf = (id: string) => sources.find((s) => s.id === id)?.fileName ?? 'Document';

  const context = passages.map((p, i) => `[${i + 1}] (${nameOf(p.sourceId)})\n${p.text}`).join('\n\n');
  const answer = await generateText({ system: askSystem(ownerType), prompt: `Source passages:\n\n${context}\n\nRequest: ${question}` });

  return {
    answer: answer.trim(),
    citations: passages.map((p, i) => ({
      n: i + 1,
      sourceName: nameOf(p.sourceId),
      excerpt: p.text.length > 280 ? `${p.text.slice(0, 280)}…` : p.text,
    })),
  };
}

export async function listSources(ownerId: string) {
  return prisma.contentSource.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, mimeType: true, size: true, chunkCount: true, createdAt: true },
  });
}

export async function deleteSource(ownerId: string, sourceId: string) {
  const source = await prisma.contentSource.findFirst({ where: { id: sourceId, ownerId } });
  if (!source) throw new AppError('Document not found.', 'NOT_FOUND', 404);
  await prisma.$transaction([
    prisma.contentSourceChunk.deleteMany({ where: { sourceId } }),
    prisma.contentSource.delete({ where: { id: sourceId } }),
  ]);
}

/** Prisma operations that remove every document of an owner; add them to the owner's delete transaction. */
export function deleteAllSourcesOps(ownerId: string) {
  return [
    prisma.contentSourceChunk.deleteMany({ where: { ownerId } }),
    prisma.contentSource.deleteMany({ where: { ownerId } }),
  ];
}
