import { z } from 'zod';

/*
 * What Gemini must return when it converts a document into a blog post.
 * The JSON Schema is built per request because the category list comes from the database.
 * The Zod schema re-validates the reply (model output is untrusted).
 */

export const BLOG_BLOCK_TYPES = ['paragraph', 'heading2', 'heading3', 'bullets', 'numbered', 'quote', 'table'] as const;

const str = { type: 'string' } as const;
const strArray = { type: 'array', items: str } as const;

export function buildBlogExtractionJsonSchema(categoryNames: string[]) {
  return {
    type: 'object',
    properties: {
      title: { ...str, description: 'The article title, under 90 characters.' },
      excerpt: { ...str, description: 'A summary for listings and search, 120 to 160 characters.' },
      category: {
        type: 'string',
        enum: [...categoryNames, ''],
        description: 'The best matching existing category, or "" if none fits.',
      },
      body: {
        type: 'array',
        description: 'The full article, in order, faithfully converted. Do not summarise or drop content.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...BLOG_BLOCK_TYPES] },
            text: { ...str, description: 'Text for paragraph, heading2, heading3 and quote. "" otherwise.' },
            items: { ...strArray, description: 'Items for bullets and numbered lists. [] otherwise.' },
            rows: {
              type: 'array',
              items: strArray,
              description: 'Table cells row by row (first row = header when the table has one). [] otherwise.',
            },
          },
          required: ['type', 'text', 'items', 'rows'],
        },
      },
      faqs: {
        type: 'array',
        description: 'Up to 5 questions readers ask, answered strictly from the document. [] if not supported.',
        items: { type: 'object', properties: { question: str, answer: str }, required: ['question', 'answer'] },
      },
      keyTakeaways: { ...strArray, description: '3 to 5 short takeaways.' },
      seo: {
        type: 'object',
        properties: {
          metaTitle: { ...str, description: '30 to 60 characters.' },
          metaDescription: { ...str, description: '120 to 160 characters.' },
          focusKeyword: str,
          secondaryKeywords: strArray,
        },
        required: ['metaTitle', 'metaDescription', 'focusKeyword', 'secondaryKeywords'],
      },
      aeo: {
        type: 'object',
        properties: {
          directQuestion: { ...str, description: 'The main question this article answers.' },
          snippet: { ...str, description: 'A direct answer to that question, at most 50 words.' },
          summary: { ...str, description: 'A 2 to 3 sentence factual summary for AI search engines.' },
        },
        required: ['directQuestion', 'snippet', 'summary'],
      },
      missing: { ...strArray, description: 'Important things a good B2B blog post needs that the document lacks.' },
    },
    required: ['title', 'excerpt', 'category', 'body', 'faqs', 'keyTakeaways', 'seo', 'aeo', 'missing'],
  } as const;
}

// --- Zod re-validation (lenient) ---------------------------------------------------------

const s = (max: number) => z.string().catch('').transform((v) => v.trim().slice(0, max));
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.array(item).catch([]).transform((a) => a.slice(0, max));

const blogBlock = z.object({
  type: z.enum(BLOG_BLOCK_TYPES).catch('paragraph'),
  text: s(6000),
  items: list(s(1500), 60),
  rows: list(list(s(1000), 12), 100),
});

export const blogExtractionSchema = z.object({
  title: s(200),
  excerpt: s(300),
  category: s(200),
  body: list(blogBlock, 400),
  faqs: list(z.object({ question: s(300), answer: s(2000) }), 10),
  keyTakeaways: list(s(300), 8),
  seo: z
    .object({ metaTitle: s(120), metaDescription: s(300), focusKeyword: s(100), secondaryKeywords: list(s(100), 10) })
    .catch({ metaTitle: '', metaDescription: '', focusKeyword: '', secondaryKeywords: [] }),
  aeo: z
    .object({ directQuestion: s(300), snippet: s(600), summary: s(1000) })
    .catch({ directQuestion: '', snippet: '', summary: '' }),
  missing: list(s(300), 15),
});

export type BlogExtraction = z.infer<typeof blogExtractionSchema>;
export type BlogBlock = z.infer<typeof blogBlock>;
