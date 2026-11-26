/**
 * Case-study page layout (page builder).
 *
 *   Layout → rows → columns (12-column grid spans) → blocks
 *
 * Two kinds of blocks:
 *  - BOUND blocks show the case study's structured fields (title, metrics, challenge,
 *    testimonial, …). Their content lives in the existing CaseStudy columns, so the
 *    publish checklist, SEO schema and the legacy public API keep working. A bound
 *    block appears at most once per layout; `data` is empty.
 *  - FREE blocks carry their own content in `data` (headings, text, images, tables,
 *    downloads, dividers). Any number of them.
 *
 * This file is shared by the CMS editor, the CMS preview, the public API and the
 * website renderer. Keep it dependency-free.
 */

export const LAYOUT_VERSION = 1;

export const BOUND_BLOCK_TYPES = [
  'hero',
  'metrics',
  'challenge',
  'approach',
  'process',
  'gallery',
  'testimonial',
  'faq',
  'cta',
] as const;

export const FREE_BLOCK_TYPES = ['heading', 'text', 'image', 'table', 'file', 'divider'] as const;

export type BoundBlockType = (typeof BOUND_BLOCK_TYPES)[number];
export type FreeBlockType = (typeof FREE_BLOCK_TYPES)[number];
export type BlockType = BoundBlockType | FreeBlockType;

export interface HeadingData {
  text: string;
  level: 2 | 3;
}
export interface TextData {
  /** Rendered HTML (sanitised server-side once the hardening branch is merged). */
  html: string;
  /** Editor.js OutputData, used to re-open the block in the editor. */
  json: unknown;
}
export interface ImageData {
  url: string;
  alt: string;
  caption: string;
}
export interface TableData {
  /** rows[r][c]; when hasHeader, rows[0] is the header row. */
  rows: string[][];
  hasHeader: boolean;
  caption: string;
}
export interface FileData {
  url: string;
  label: string;
}

export type Block =
  | { id: string; type: BoundBlockType; data?: Record<string, never> }
  | { id: string; type: 'heading'; data: HeadingData }
  | { id: string; type: 'text'; data: TextData }
  | { id: string; type: 'image'; data: ImageData }
  | { id: string; type: 'table'; data: TableData }
  | { id: string; type: 'file'; data: FileData }
  | { id: string; type: 'divider'; data?: Record<string, never> };

export interface LayoutColumn {
  id: string;
  /** Width on a 12-column grid. Spans in a row add up to 12. */
  span: number;
  blocks: Block[];
}

export type RowBackground = 'none' | 'muted' | 'brand';
export type RowPadding = 'none' | 'sm' | 'md' | 'lg';

/** Visual container settings for a row. Light backgrounds only, so text stays readable. */
export interface RowStyle {
  background: RowBackground;
  padding: RowPadding;
}

export const DEFAULT_ROW_STYLE: RowStyle = { background: 'none', padding: 'none' };
export const MAX_COLUMNS = 4;
/** Narrowest a column can be resized to, in 12-grid units. */
export const MIN_COLUMN_SPAN = 2;

export interface LayoutRow {
  id: string;
  columns: LayoutColumn[];
  /** Optional; missing means DEFAULT_ROW_STYLE. */
  style?: RowStyle;
}

export interface CaseStudyLayout {
  version: typeof LAYOUT_VERSION;
  rows: LayoutRow[];
}

export type TemplateId = 'classic' | 'results-first' | 'story';

/** Column presets offered in the row toolbar. */
export const ROW_PRESETS: { id: string; label: string; spans: number[] }[] = [
  { id: '12', label: 'One column', spans: [12] },
  { id: '6-6', label: 'Two equal columns', spans: [6, 6] },
  { id: '8-4', label: 'Wide left, narrow right', spans: [8, 4] },
  { id: '4-8', label: 'Narrow left, wide right', spans: [4, 8] },
  { id: '4-4-4', label: 'Three columns', spans: [4, 4, 4] },
];

export const isBoundBlock = (type: BlockType): type is BoundBlockType =>
  (BOUND_BLOCK_TYPES as readonly string[]).includes(type);
