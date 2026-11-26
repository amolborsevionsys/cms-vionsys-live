import { editorJsToHtml, editorJsToText } from '@/lib/editorjs-parser';
import type { BlogBlock, BlogExtraction } from '@/features/blogs/import/blog-import.schema';
import { answerToRich } from '../case-study-builder/import/apply-import';

/* Turns an AI blog conversion into editor state: post fields, SEO, AEO and the Editor.js body. */

export type BlogSectionId = 'basics' | 'category' | 'body' | 'seo' | 'aeo';
export type BodyMode = 'replace' | 'append';

export interface BlogSection {
  id: BlogSectionId;
  label: string;
  preview: string;
  available: boolean;
}

interface EditorJsData {
  time: number;
  blocks: unknown[];
  version: string;
}

export interface BodyContent {
  json: EditorJsData;
  html: string;
  text: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const blockId = (i: number) => `ai-${i}-${Math.random().toString(36).slice(2, 8)}`;

/** AI blog blocks → Editor.js blocks (header, paragraph, list, quote, table). */
export function blogBlocksToEditorJs(blocks: BlogBlock[]): unknown[] {
  return blocks.flatMap((b, i): unknown[] => {
    const id = blockId(i);
    switch (b.type) {
      case 'heading2':
      case 'heading3':
        return b.text ? [{ id, type: 'header', data: { text: escapeHtml(b.text), level: b.type === 'heading2' ? 2 : 3 } }] : [];
      case 'bullets':
      case 'numbered': {
        const items = b.items.filter(Boolean);
        return items.length
          ? [
              {
                id,
                type: 'list',
                data: {
                  style: b.type === 'numbered' ? 'ordered' : 'unordered',
                  meta: {},
                  items: items.map((item) => ({ content: escapeHtml(item), meta: {}, items: [] })),
                },
              },
            ]
          : [];
      }
      case 'quote':
        return b.text ? [{ id, type: 'quote', data: { text: escapeHtml(b.text), caption: '', alignment: 'left' } }] : [];
      case 'table': {
        const rows = b.rows.filter((r) => r.some((c) => c.trim()));
        if (!rows.length) return [];
        const cols = Math.max(...rows.map((r) => r.length));
        const content = rows.map((r) => [...r, ...Array(cols - r.length).fill('')].map(escapeHtml));
        return [{ id, type: 'table', data: { withHeadings: rows.length > 1, content } }];
      }
      default:
        return b.text ? [{ id, type: 'paragraph', data: { text: escapeHtml(b.text) } }] : [];
    }
  });
}

function toBody(blocks: unknown[]): BodyContent {
  const json = { time: Date.now(), blocks, version: '2.31.0' };
  return { json, html: editorJsToHtml(json), text: editorJsToText(json) };
}

/** Existing editor JSON (any shape) → its blocks array. */
const existingBlocks = (json: unknown): unknown[] =>
  json && typeof json === 'object' && Array.isArray((json as { blocks?: unknown }).blocks)
    ? ((json as { blocks: unknown[] }).blocks)
    : [];

export function buildBody(x: BlogExtraction, mode: BodyMode, currentJson: unknown): BodyContent {
  const imported = blogBlocksToEditorJs(x.body);
  return toBody(mode === 'append' ? [...existingBlocks(currentJson), ...imported] : imported);
}

/** Append an Ask AI answer (paragraphs / "- " bullets, citations removed) to the body. */
export function appendAnswerToBody(currentJson: unknown, answer: string): BodyContent {
  const blocks: BlogBlock[] = answerToRich(answer).map((r) => ({
    type: r.type === 'bullets' ? 'bullets' : 'paragraph',
    text: r.text,
    items: r.items,
    rows: [],
  }));
  return toBody([...existingBlocks(currentJson), ...blogBlocksToEditorJs(blocks)]);
}

const words = (x: BlogExtraction) =>
  x.body.reduce((n, b) => n + `${b.text} ${b.items.join(' ')} ${b.rows.flat().join(' ')}`.trim().split(/\s+/).filter(Boolean).length, 0);
const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function describeBlogSections(x: BlogExtraction): BlogSection[] {
  const headings = x.body.filter((b) => b.type === 'heading2').length;
  const tables = x.body.filter((b) => b.type === 'table').length;
  return [
    {
      id: 'basics',
      label: 'Title and excerpt',
      preview: [x.title, clip(x.excerpt, 80)].filter(Boolean).join(': ') || 'Nothing found',
      available: Boolean(x.title || x.excerpt),
    },
    { id: 'category', label: 'Category', preview: x.category || 'No matching category', available: Boolean(x.category) },
    {
      id: 'body',
      label: 'Article body',
      preview: `${words(x).toLocaleString('en-IN')} words, ${headings} section${headings === 1 ? '' : 's'}${tables ? `, ${tables} table${tables === 1 ? '' : 's'}` : ''}`,
      available: x.body.length > 0,
    },
    {
      id: 'seo',
      label: 'SEO',
      preview: x.seo.metaTitle || 'Nothing found',
      available: Boolean(x.seo.metaTitle || x.seo.metaDescription || x.seo.focusKeyword),
    },
    {
      id: 'aeo',
      label: `AEO: FAQs (${x.faqs.length}), key takeaways, answer snippet`,
      preview: x.aeo.directQuestion || x.faqs[0]?.question || 'Nothing found',
      available: Boolean(x.faqs.length || x.keyTakeaways.length || x.aeo.snippet || x.aeo.summary),
    },
  ];
}

export interface BlogImportUpdates {
  fields: Record<string, unknown>;
  body?: BodyContent;
  seo?: Record<string, unknown>;
  aeoGeo?: Record<string, unknown>;
}

export function buildBlogUpdates(
  x: BlogExtraction,
  selected: Set<BlogSectionId>,
  bodyMode: BodyMode,
  currentBodyJson: unknown,
  categories: { id: string; name: string }[]
): BlogImportUpdates {
  const fields: Record<string, unknown> = {};
  const out: BlogImportUpdates = { fields };

  if (selected.has('basics')) {
    if (x.title) fields.title = x.title;
    if (x.excerpt) fields.excerpt = x.excerpt;
  }
  if (selected.has('category')) {
    const match = categories.find((c) => c.name.toLowerCase() === x.category.toLowerCase());
    if (match) fields.categoryId = match.id;
  }
  if (selected.has('body')) out.body = buildBody(x, bodyMode, currentBodyJson);
  if (selected.has('seo')) {
    out.seo = {
      ...(x.seo.metaTitle ? { title: x.seo.metaTitle } : {}),
      ...(x.seo.metaDescription ? { description: x.seo.metaDescription } : {}),
      ...(x.seo.focusKeyword ? { focusKeyword: x.seo.focusKeyword } : {}),
      ...(x.seo.secondaryKeywords.length ? { secondaryKeywords: x.seo.secondaryKeywords } : {}),
    };
  }
  if (selected.has('aeo')) {
    out.aeoGeo = {
      ...(x.aeo.directQuestion ? { directAnswerPrompt: x.aeo.directQuestion } : {}),
      ...(x.aeo.snippet ? { snippetCandidate: x.aeo.snippet } : {}),
      ...(x.aeo.summary ? { semanticSummary: x.aeo.summary } : {}),
      ...(x.keyTakeaways.length ? { keyTakeaways: x.keyTakeaways } : {}),
      ...(x.faqs.length ? { peopleAlsoAsk: x.faqs.map((f) => ({ question: f.question, answer: f.answer })) } : {}),
    };
  }
  return out;
}
