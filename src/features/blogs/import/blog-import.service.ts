import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { generateJson, type GeminiPart } from '@/lib/gemini';
import { extractDocument } from '@/features/ai/extract-text';
import { storeSource } from '@/features/ai/rag.service';
import { blogExtractionSchema, buildBlogExtractionJsonSchema, type BlogExtraction } from './blog-import.schema';

const SYSTEM_PROMPT = `You convert a document into a blog post for Vionsys, an IT services company.

Rules:
- body: convert the WHOLE document faithfully, in order. Keep the author's wording, facts, figures and structure. Do not summarise, shorten, reorder or add content. Only fix formatting: real headings become heading2 (main sections) or heading3 (sub-sections), lists become bullets/numbered, quotations become quote, tables become table.
- Do not repeat the article title as the first heading of the body.
- Never invent facts, statistics, names or quotes. If something is missing, leave the field empty and list it in "missing".
- excerpt, seo and aeo fields are written by you from the document's content: accurate, specific, no hype.
- category: pick the closest existing category only if it clearly fits; otherwise "".
- faqs: only questions the document can actually answer.`;

const USER_INSTRUCTION = 'Convert this document into the required blog post JSON structure.';

export interface BlogImportResult {
  extraction: BlogExtraction;
  source: { id: string; fileName: string; chunkCount: number; createdAt: Date };
  warnings: string[];
}

export async function importBlogDocument(params: {
  blogPostId: string;
  fileName: string;
  buffer: Buffer;
  userId: string;
}): Promise<BlogImportResult> {
  const { blogPostId, fileName, buffer, userId } = params;

  const post = await prisma.blogPost.findUnique({ where: { id: blogPostId }, select: { id: true, title: true } });
  if (!post) throw new AppError('Blog post not found.', 'NOT_FOUND', 404);

  const doc = await extractDocument(buffer);
  if (doc.kind === 'docx' && !doc.text) {
    throw new AppError('This Word file has no text to import.', 'EMPTY_FILE', 422);
  }

  const categories = await prisma.category.findMany({ select: { name: true }, orderBy: { name: 'asc' } });
  const parts: GeminiPart[] =
    doc.kind === 'pdf'
      ? [{ inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }, { text: USER_INSTRUCTION }]
      : [{ text: `${USER_INSTRUCTION}\n\nDOCUMENT (converted from Word to HTML):\n\n${doc.html ?? doc.text}` }];

  const raw = await generateJson<unknown>({
    system: SYSTEM_PROMPT,
    parts,
    schema: buildBlogExtractionJsonSchema(categories.map((c) => c.name)),
  });
  const parsed = blogExtractionSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error('AI blog extraction did not match the schema', parsed.error.issues.slice(0, 5));
    throw new AppError('The AI returned content in an unexpected format. Try again.', 'AI_BAD_OUTPUT', 502);
  }

  // Keep the extracted text (not the file) as a searchable source for Ask AI.
  const stored = await storeSource({ ownerType: 'blog', ownerId: blogPostId, fileName, doc, size: buffer.length, userId });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'BLOG_IMPORT',
      details: `Imported "${fileName.slice(0, 120)}" into blog post: "${post.title}" (${blogPostId})`,
    },
  });

  return { extraction: parsed.data, source: stored.source, warnings: stored.warnings };
}
