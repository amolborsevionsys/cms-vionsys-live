import { editorJsToHtml, editorJsToText } from '@/lib/editorjs-parser';
import type { CaseStudyExtraction, RichBlock } from '@/features/case-studies/import/import.schema';
import type { Block, CaseStudyLayout, TemplateId } from '@/features/case-studies/layout/layout.types';
import { applyTemplate, createBlock, createRow } from '@/features/case-studies/layout/layout.utils';

/* Turns an AI extraction into editor state: case-study fields, Editor.js content and layout. */

export type ImportSectionId =
  | 'basics'
  | 'challenge'
  | 'approach'
  | 'metrics'
  | 'process'
  | 'testimonial'
  | 'faqs'
  | 'cta'
  | 'seo'
  | 'extraSections'
  | 'tables';

export interface ImportSection {
  id: ImportSectionId;
  label: string;
  /** Short plain-text preview of what will be applied. */
  preview: string;
  available: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface EditorContent {
  json: { time: number; blocks: unknown[]; version: string };
  html: string;
  text: string;
}

/** Typed rich blocks → Editor.js OutputData (+ HTML and plain text). */
export function richToEditor(blocks: RichBlock[]): EditorContent {
  const ejsBlocks = blocks.flatMap((b, i): unknown[] => {
    const id = `imp-${i}-${Math.random().toString(36).slice(2, 8)}`;
    if (b.type === 'heading' && b.text) return [{ id, type: 'header', data: { text: escapeHtml(b.text), level: 3 } }];
    if ((b.type === 'bullets' || b.type === 'numbered') && b.items.length > 0) {
      return [
        {
          id,
          type: 'list',
          data: {
            style: b.type === 'numbered' ? 'ordered' : 'unordered',
            meta: {},
            items: b.items.filter(Boolean).map((item) => ({ content: escapeHtml(item), meta: {}, items: [] })),
          },
        },
      ];
    }
    return b.text ? [{ id, type: 'paragraph', data: { text: escapeHtml(b.text) } }] : [];
  });
  const json = { time: Date.now(), blocks: ejsBlocks, version: '2.31.0' };
  return { json, html: editorJsToHtml(json), text: editorJsToText(json) };
}

/** Plain AI answer ("- " lines become a list) → rich blocks. Strips [n] citation markers. */
export function answerToRich(answer: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push({ type: 'bullets', text: '', items: bullets });
    bullets = [];
  };
  for (const raw of answer.split('\n')) {
    const line = raw.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*•]\s+/.test(line)) bullets.push(line.replace(/^[-*•]\s+/, ''));
    else {
      flush();
      blocks.push({ type: 'paragraph', text: line, items: [] });
    }
  }
  flush();
  return blocks;
}

const hasRich = (blocks: RichBlock[]) => blocks.some((b) => b.text || b.items.length > 0);
const firstText = (blocks: RichBlock[]) => blocks.find((b) => b.text)?.text ?? blocks.find((b) => b.items.length)?.items[0] ?? '';
const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function describeSections(x: CaseStudyExtraction): ImportSection[] {
  return [
    {
      id: 'basics',
      label: 'Title, client and summary',
      preview: [x.title, x.clientName, x.industry].filter(Boolean).join(', ') || 'Nothing found',
      available: Boolean(x.title || x.clientName || x.summary),
    },
    { id: 'challenge', label: 'Challenge', preview: clip(firstText(x.challenge)) || 'Nothing found', available: hasRich(x.challenge) },
    { id: 'approach', label: 'Approach', preview: clip(firstText(x.approach)) || 'Nothing found', available: hasRich(x.approach) },
    {
      id: 'metrics',
      label: `Results metrics (${x.metrics.length})`,
      preview: x.metrics.map((m) => `${m.value} ${m.label}`).join(', ') || 'No numbers found',
      available: x.metrics.length > 0,
    },
    {
      id: 'process',
      label: `Process steps (${x.processSteps.length})`,
      preview: x.processSteps.map((s) => s.title).join(', ') || 'Nothing found',
      available: x.processSteps.length > 0,
    },
    {
      id: 'testimonial',
      label: 'Testimonial',
      preview: x.testimonial.quote ? clip(`“${x.testimonial.quote}”`) : 'No client quote found',
      available: Boolean(x.testimonial.quote),
    },
    {
      id: 'faqs',
      label: `FAQ (${x.faqs.length})`,
      preview: x.faqs.map((f) => f.question).join(' ') || 'Nothing found',
      available: x.faqs.length > 0,
    },
    { id: 'cta', label: 'Call to action', preview: x.cta.heading || 'Nothing found', available: Boolean(x.cta.heading) },
    {
      id: 'seo',
      label: 'SEO and key takeaways',
      preview: x.seo.metaTitle || 'Nothing found',
      available: Boolean(x.seo.metaTitle || x.seo.metaDescription || x.keyTakeaways.length),
    },
    {
      id: 'extraSections',
      label: `Extra sections (${x.extraSections.length})`,
      preview: x.extraSections.map((s) => s.heading).join(', ') || 'None',
      available: x.extraSections.length > 0,
    },
    {
      id: 'tables',
      label: `Tables (${x.tables.length})`,
      preview: x.tables.map((t) => t.caption || `${t.header.join(', ')}`).join('; ') || 'None',
      available: x.tables.length > 0,
    },
  ];
}

export interface ImportUpdates {
  fields: Record<string, unknown>;
  challenge?: EditorContent;
  approach?: EditorContent;
  seo?: Record<string, unknown>;
  keyTakeaways?: string[];
}

export function buildFieldUpdates(x: CaseStudyExtraction, selected: Set<ImportSectionId>, currentCtaUrl?: string | null): ImportUpdates {
  const fields: Record<string, unknown> = {};
  const out: ImportUpdates = { fields };

  if (selected.has('basics')) {
    if (x.title) fields.title = x.title;
    if (x.clientName) fields.clientName = x.clientName;
    if (x.industry) fields.industry = x.industry;
    fields.engagementType = x.engagementType;
    if (x.summary) fields.excerpt = x.summary;
  }
  if (selected.has('challenge')) out.challenge = richToEditor(x.challenge);
  if (selected.has('approach')) out.approach = richToEditor(x.approach);
  if (selected.has('metrics')) fields.resultStats = x.metrics.map((m) => ({ value: m.value, label: m.label, description: m.description }));
  if (selected.has('process')) fields.processSteps = x.processSteps.map((s) => ({ title: s.title, description: s.description, icon: null }));
  if (selected.has('testimonial')) {
    fields.testimonialQuote = x.testimonial.quote;
    fields.testimonialName = x.testimonial.name || null;
    fields.testimonialDesignation = x.testimonial.role || null;
    fields.testimonialCompany = x.testimonial.company || null;
  }
  if (selected.has('faqs')) fields.faqs = x.faqs.map((f) => ({ question: f.question, answer: f.answer }));
  if (selected.has('cta')) {
    fields.ctaHeading = x.cta.heading;
    fields.ctaBody = x.cta.body || null;
    fields.ctaButtonLabel = x.cta.buttonLabel || 'Talk to us';
    if (!currentCtaUrl) fields.ctaButtonUrl = '/contact';
  }
  if (selected.has('seo')) {
    out.seo = {
      ...(x.seo.metaTitle ? { title: x.seo.metaTitle } : {}),
      ...(x.seo.metaDescription ? { description: x.seo.metaDescription } : {}),
      ...(x.seo.focusKeyword ? { focusKeyword: x.seo.focusKeyword } : {}),
      ...(x.seo.secondaryKeywords.length ? { secondaryKeywords: x.seo.secondaryKeywords } : {}),
    };
    if (x.keyTakeaways.length) out.keyTakeaways = x.keyTakeaways;
  }
  return out;
}

/** Arrange the page with the chosen template, then add extra sections and tables at the end. */
export function buildImportedLayout(
  current: CaseStudyLayout,
  templateId: TemplateId,
  x: CaseStudyExtraction,
  selected: Set<ImportSectionId>
): CaseStudyLayout {
  const layout = applyTemplate(current, templateId);
  const extraRows = [];

  if (selected.has('extraSections')) {
    for (const section of x.extraSections) {
      const blocks: Block[] = [];
      if (section.heading) {
        const heading = createBlock('heading');
        if (heading.type === 'heading') heading.data.text = section.heading;
        blocks.push(heading);
      }
      if (hasRich(section.content)) {
        const text = createBlock('text');
        if (text.type === 'text') {
          const content = richToEditor(section.content);
          text.data = { html: content.html, json: content.json };
        }
        blocks.push(text);
      }
      if (blocks.length) extraRows.push(createRow([12], [blocks]));
    }
  }

  if (selected.has('tables')) {
    for (const table of x.tables) {
      const block = createBlock('table');
      if (block.type === 'table') {
        const hasHeader = table.header.length > 0;
        block.data = {
          rows: hasHeader ? [table.header, ...table.rows] : table.rows.length ? table.rows : [['']],
          hasHeader,
          caption: table.caption,
        };
      }
      extraRows.push(createRow([12], [[block]]));
    }
  }

  return { ...layout, rows: [...layout.rows, ...extraRows] };
}

/** A text block holding an AI answer, ready to drop on the page. */
export function answerToTextBlock(answer: string): Block {
  const block = createBlock('text');
  if (block.type === 'text') {
    const content = richToEditor(answerToRich(answer));
    block.data = { html: content.html, json: content.json };
  }
  return block;
}
