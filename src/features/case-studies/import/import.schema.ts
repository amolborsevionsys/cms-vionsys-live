import { z } from 'zod';
import { INDUSTRIES_LIST } from '@/config/taxonomy';

/*
 * What Gemini must return when it reads a case-study document.
 *
 * Two copies of the same shape:
 *  - EXTRACTION_JSON_SCHEMA is sent to Gemini (responseJsonSchema) to constrain its output;
 *  - extractionSchema (Zod) re-validates the reply, because model output is untrusted.
 *
 * Rich sections use simple typed blocks instead of HTML, so the editor can turn
 * them into real, editable Editor.js blocks.
 */

const ENGAGEMENT = ['PROJECT', 'RETAINER', 'STAFF_AUGMENTATION', 'PRODUCT_BUILD'] as const;
const TEMPLATES = ['classic', 'results-first', 'story'] as const;
const RICH_TYPES = ['paragraph', 'heading', 'bullets', 'numbered'] as const;

const str = { type: 'string' } as const;
const strArray = { type: 'array', items: str } as const;

const RICH_CONTENT = {
  type: 'array',
  description: 'Ordered content blocks. Use paragraphs for prose; bullets/numbered with items for lists.',
  items: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: [...RICH_TYPES] },
      text: { ...str, description: 'Paragraph or heading text. Empty for lists.' },
      items: { ...strArray, description: 'List items. Empty for paragraphs and headings.' },
    },
    required: ['type', 'text', 'items'],
  },
} as const;

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { ...str, description: 'Case study title, ideally outcome-focused, under 90 characters.' },
    clientName: { ...str, description: 'Client company name exactly as written, or "" if not stated.' },
    industry: { type: 'string', enum: [...INDUSTRIES_LIST, ''] },
    engagementType: { type: 'string', enum: [...ENGAGEMENT] },
    summary: { ...str, description: 'One or two sentences on the outcome, under 160 characters.' },
    challenge: RICH_CONTENT,
    approach: RICH_CONTENT,
    metrics: {
      type: 'array',
      description: 'Quantified results stated in the document only.',
      items: {
        type: 'object',
        properties: { value: str, label: str, description: str },
        required: ['value', 'label', 'description'],
      },
    },
    processSteps: {
      type: 'array',
      items: { type: 'object', properties: { title: str, description: str }, required: ['title', 'description'] },
    },
    testimonial: {
      type: 'object',
      description: 'A direct quote from the client. All fields "" if there is none.',
      properties: { quote: str, name: str, role: str, company: str },
      required: ['quote', 'name', 'role', 'company'],
    },
    faqs: {
      type: 'array',
      items: { type: 'object', properties: { question: str, answer: str }, required: ['question', 'answer'] },
    },
    cta: {
      type: 'object',
      properties: { heading: str, body: str, buttonLabel: str },
      required: ['heading', 'body', 'buttonLabel'],
    },
    extraSections: {
      type: 'array',
      description: 'Meaningful content that fits none of the fields above (e.g. tech stack, team, timeline narrative).',
      items: {
        type: 'object',
        properties: { heading: str, content: RICH_CONTENT },
        required: ['heading', 'content'],
      },
    },
    tables: {
      type: 'array',
      description: 'Tables found in the document, cell text only.',
      items: {
        type: 'object',
        properties: { caption: str, header: strArray, rows: { type: 'array', items: strArray } },
        required: ['caption', 'header', 'rows'],
      },
    },
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
    keyTakeaways: { ...strArray, description: '3 to 5 short takeaways.' },
    suggestedTemplate: {
      type: 'string',
      enum: [...TEMPLATES],
      description: 'results-first when the document leads with strong numbers; story for long narratives with visuals; otherwise classic.',
    },
    missing: { ...strArray, description: 'Important case-study information the document does not contain.' },
  },
  required: [
    'title', 'clientName', 'industry', 'engagementType', 'summary', 'challenge', 'approach', 'metrics',
    'processSteps', 'testimonial', 'faqs', 'cta', 'extraSections', 'tables', 'seo', 'keyTakeaways',
    'suggestedTemplate', 'missing',
  ],
} as const;

// --- Zod re-validation (lenient: fills defaults, trims oversized output) ----------------

const s = (max: number) => z.string().catch('').transform((v) => v.trim().slice(0, max));
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z.array(item).catch([]).transform((a) => a.slice(0, max));

const richBlock = z.object({
  type: z.enum(RICH_TYPES).catch('paragraph'),
  text: s(4000),
  items: list(s(1000), 50),
});
const richContent = list(richBlock, 80);

export const extractionSchema = z.object({
  title: s(200),
  clientName: s(200),
  industry: z.string().catch('').transform((v) => ((INDUSTRIES_LIST as string[]).includes(v) ? v : '')),
  engagementType: z.enum(ENGAGEMENT).catch('PROJECT'),
  summary: s(300),
  challenge: richContent,
  approach: richContent,
  metrics: list(z.object({ value: s(40), label: s(200), description: s(300) }), 12),
  processSteps: list(z.object({ title: s(200), description: s(1000) }), 15),
  testimonial: z
    .object({ quote: s(1500), name: s(120), role: s(120), company: s(200) })
    .catch({ quote: '', name: '', role: '', company: '' }),
  faqs: list(z.object({ question: s(300), answer: s(2000) }), 15),
  cta: z.object({ heading: s(200), body: s(500), buttonLabel: s(60) }).catch({ heading: '', body: '', buttonLabel: '' }),
  extraSections: list(z.object({ heading: s(200), content: richContent }), 15),
  tables: list(
    z.object({ caption: s(300), header: list(s(200), 12), rows: list(list(s(500), 12), 100) }),
    10
  ),
  seo: z
    .object({ metaTitle: s(120), metaDescription: s(300), focusKeyword: s(100), secondaryKeywords: list(s(100), 10) })
    .catch({ metaTitle: '', metaDescription: '', focusKeyword: '', secondaryKeywords: [] }),
  keyTakeaways: list(s(300), 8),
  suggestedTemplate: z.enum(TEMPLATES).catch('classic'),
  missing: list(s(300), 15),
});

export type CaseStudyExtraction = z.infer<typeof extractionSchema>;
export type RichBlock = z.infer<typeof richBlock>;
