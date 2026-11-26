import {
  BOUND_BLOCK_TYPES,
  FREE_BLOCK_TYPES,
  LAYOUT_VERSION,
  isBoundBlock,
  type Block,
  type BlockType,
  type BoundBlockType,
  type CaseStudyLayout,
  type LayoutColumn,
  type LayoutRow,
  type RowStyle,
  type TemplateId,
} from './layout.types';

/* Pure helpers shared by the editor (client) and the API (server). */

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlock(type: BlockType, id: string = newId()): Block {
  switch (type) {
    case 'heading':
      return { id, type, data: { text: '', level: 2 } };
    case 'text':
      return { id, type, data: { html: '', json: {} } };
    case 'image':
      return { id, type, data: { url: '', alt: '', caption: '' } };
    case 'table':
      return {
        id,
        type,
        data: {
          rows: [
            ['', ''],
            ['', ''],
          ],
          hasHeader: true,
          caption: '',
        },
      };
    case 'file':
      return { id, type, data: { url: '', label: '' } };
    case 'divider':
      return { id, type };
    default:
      return { id, type };
  }
}

export function createRow(spans: number[], blocks: Block[][] = []): LayoutRow {
  return {
    id: newId(),
    columns: spans.map((span, i) => ({ id: newId(), span, blocks: blocks[i] ?? [] })),
  };
}

/**
 * Template rows get deterministic ids (e.g. "classic-r0-c0-hero") so a template
 * rendered on the server and hydrated in the browser produces identical markup.
 * Blocks added later in the editor use random ids; they only ever exist client-side.
 */
function templateRows(templateId: TemplateId, rows: { spans: number[]; blocks: BlockType[][] }[]): LayoutRow[] {
  return rows.map((row, r) => ({
    id: `${templateId}-r${r}`,
    columns: row.spans.map((span, c) => ({
      id: `${templateId}-r${r}-c${c}`,
      span,
      blocks: (row.blocks[c] ?? []).map((type, b) => createBlock(type, `${templateId}-r${r}-c${c}-${type}${b ? `-${b}` : ''}`)),
    })),
  }));
}

/** One block per row, full width. */
const single = (type: BlockType) => ({ spans: [12], blocks: [[type]] });
const split = (spans: number[], ...types: BlockType[]) => ({ spans, blocks: types.map((t) => [t]) });

// --- Templates ---------------------------------------------------------------------

export const TEMPLATES: { id: TemplateId; name: string; description: string }[] = [
  {
    id: 'classic',
    name: 'Classic (current live layout)',
    description: 'Hero, metrics, challenge, approach, process, gallery, testimonial, FAQ and call to action, top to bottom.',
  },
  {
    id: 'results-first',
    name: 'Results first',
    description: 'Leads with the numbers. Challenge and approach side by side, then the testimonial. Best for quick scanners and sales.',
  },
  {
    id: 'story',
    name: 'Story',
    description: 'Long-form narrative with alternating text and image sections, the process timeline and a gallery. Best for in-depth reads.',
  },
];

export function buildTemplate(templateId: TemplateId): CaseStudyLayout {
  let rows: { spans: number[]; blocks: BlockType[][] }[];
  switch (templateId) {
    case 'results-first':
      rows = [
        single('hero'),
        single('metrics'),
        split([6, 6], 'challenge', 'approach'),
        single('testimonial'),
        single('process'),
        single('faq'),
        single('cta'),
      ];
      break;
    case 'story':
      rows = [
        single('hero'),
        split([8, 4], 'challenge', 'image'),
        split([4, 8], 'image', 'approach'),
        single('process'),
        single('metrics'),
        single('gallery'),
        single('testimonial'),
        single('faq'),
        single('cta'),
      ];
      break;
    case 'classic':
    default:
      rows = [
        single('hero'),
        single('metrics'),
        single('challenge'),
        single('approach'),
        single('process'),
        single('gallery'),
        single('testimonial'),
        single('faq'),
        single('cta'),
      ];
  }
  return { version: LAYOUT_VERSION, rows: templateRows(templateId, rows) };
}

const hasContent = (block: Block): boolean => {
  switch (block.type) {
    case 'heading':
      return block.data.text.trim() !== '';
    case 'text':
      return block.data.html.replace(/<[^>]*>/g, '').trim() !== '';
    case 'image':
    case 'file':
      return block.data.url !== '';
    case 'table':
      return block.data.rows.some((r) => r.some((c) => c.trim() !== ''));
    default:
      return false;
  }
};

/**
 * Switch template without losing work: bound blocks are re-placed by the template,
 * and free blocks that have content are kept, appended after the template.
 */
export function applyTemplate(current: CaseStudyLayout, templateId: TemplateId): CaseStudyLayout {
  const next = buildTemplate(templateId);
  const keptFreeBlocks = current.rows
    .flatMap((row) => row.columns.flatMap((col) => col.blocks))
    .filter((block) => !isBoundBlock(block.type) && hasContent(block));

  return {
    ...next,
    rows: [...next.rows, ...keptFreeBlocks.map((block) => createRow([12], [[block]]))],
  };
}

export function getUsedBoundTypes(layout: CaseStudyLayout): Set<BoundBlockType> {
  const used = new Set<BoundBlockType>();
  for (const row of layout.rows) {
    for (const col of row.columns) {
      for (const block of col.blocks) {
        if (isBoundBlock(block.type)) used.add(block.type);
      }
    }
  }
  return used;
}

// --- Validation / normalisation ------------------------------------------------------

const KNOWN_TYPES = new Set<string>([...BOUND_BLOCK_TYPES, ...FREE_BLOCK_TYPES]);
const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
const id = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : newId());

function normalizeBlock(raw: unknown, seenBound: Set<string>): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as { id?: unknown; type?: unknown; data?: Record<string, unknown> };
  if (typeof b.type !== 'string' || !KNOWN_TYPES.has(b.type)) return null;
  const type = b.type as BlockType;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as Record<string, unknown>;

  if (isBoundBlock(type)) {
    if (seenBound.has(type)) return null; // bound blocks appear once
    seenBound.add(type);
    return { id: id(b.id), type };
  }

  switch (type) {
    case 'heading':
      return { id: id(b.id), type, data: { text: str(data.text, 300), level: data.level === 3 ? 3 : 2 } };
    case 'text':
      return { id: id(b.id), type, data: { html: str(data.html, 200_000), json: data.json ?? {} } };
    case 'image':
      return {
        id: id(b.id),
        type,
        data: { url: str(data.url, 2000), alt: str(data.alt, 500), caption: str(data.caption, 500) },
      };
    case 'table': {
      const rows = Array.isArray(data.rows)
        ? (data.rows as unknown[])
            .slice(0, 100)
            .map((r) => (Array.isArray(r) ? (r as unknown[]).slice(0, 12).map((c) => str(c, 1000)) : []))
        : [['']];
      return {
        id: id(b.id),
        type,
        data: { rows: rows.length ? rows : [['']], hasHeader: data.hasHeader !== false, caption: str(data.caption, 500) },
      };
    }
    case 'file':
      return { id: id(b.id), type, data: { url: str(data.url, 2000), label: str(data.label, 200) } };
    case 'divider':
      return { id: id(b.id), type };
    default:
      return null;
  }
}

/**
 * Validates untrusted layout JSON (from the API or the database) into a clean layout.
 * Unknown block types are dropped, bound blocks are de-duplicated, column spans are
 * clamped and re-balanced to 12. Returns null if the input is not a layout at all.
 */
export function normalizeLayout(raw: unknown): CaseStudyLayout | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { rows?: unknown }).rows)) return null;
  const seenBound = new Set<string>();

  const rows: LayoutRow[] = ((raw as { rows: unknown[] }).rows)
    .slice(0, 200)
    .map((rawRow): LayoutRow | null => {
      if (!rawRow || typeof rawRow !== 'object') return null;
      const r = rawRow as { id?: unknown; columns?: unknown };
      if (!Array.isArray(r.columns) || r.columns.length === 0) return null;

      let columns: LayoutColumn[] = (r.columns as unknown[]).slice(0, 4).map((rawCol) => {
        const c = (rawCol && typeof rawCol === 'object' ? rawCol : {}) as {
          id?: unknown;
          span?: unknown;
          blocks?: unknown;
        };
        const blocks = Array.isArray(c.blocks)
          ? (c.blocks as unknown[]).map((blk) => normalizeBlock(blk, seenBound)).filter((x): x is Block => x !== null)
          : [];
        const span = typeof c.span === 'number' && c.span >= 1 && c.span <= 12 ? Math.round(c.span) : 12;
        return { id: id(c.id), span, blocks };
      });

      const total = columns.reduce((sum, col) => sum + col.span, 0);
      if (total !== 12) {
        const even = Math.floor(12 / columns.length);
        columns = columns.map((col, i) => ({
          ...col,
          span: i === columns.length - 1 ? 12 - even * (columns.length - 1) : even,
        }));
      }
      const style = normalizeRowStyle((rawRow as { style?: unknown }).style);
      return style ? { id: id(r.id), columns, style } : { id: id(r.id), columns };
    })
    .filter((row): row is LayoutRow => row !== null);

  return { version: LAYOUT_VERSION, rows };
}

function normalizeRowStyle(raw: unknown): RowStyle | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { background?: unknown; padding?: unknown };
  const background = s.background === 'muted' || s.background === 'brand' ? s.background : 'none';
  const padding = s.padding === 'sm' || s.padding === 'md' || s.padding === 'lg' ? s.padding : 'none';
  return background === 'none' && padding === 'none' ? null : { background, padding };
}

/** The stored layout, or the classic template for case studies created before the builder. */
export function resolveLayout(raw: unknown): CaseStudyLayout {
  return normalizeLayout(raw) ?? buildTemplate('classic');
}

export function isTemplateId(value: unknown): value is TemplateId {
  return value === 'classic' || value === 'results-first' || value === 'story';
}
