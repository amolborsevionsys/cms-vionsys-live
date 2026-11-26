import { arrayMove } from '@dnd-kit/sortable';
import {
  DEFAULT_ROW_STYLE,
  MAX_COLUMNS,
  MIN_COLUMN_SPAN,
  type Block,
  type CaseStudyLayout,
  type LayoutRow,
  type RowStyle,
} from '@/features/case-studies/layout/layout.types';
import { createBlock, createRow, newId } from '@/features/case-studies/layout/layout.utils';

/* Immutable layout operations used by the builder. Each returns a new layout. */

type Location = { rowIndex: number; colIndex: number; blockIndex: number };

export function findBlock(layout: CaseStudyLayout, blockId: string): Location | null {
  for (let r = 0; r < layout.rows.length; r++) {
    const cols = layout.rows[r].columns;
    for (let c = 0; c < cols.length; c++) {
      const b = cols[c].blocks.findIndex((blk) => blk.id === blockId);
      if (b !== -1) return { rowIndex: r, colIndex: c, blockIndex: b };
    }
  }
  return null;
}

/** Column id for a column id or a block id. */
export function findColumnId(layout: CaseStudyLayout, id: string): string | null {
  for (const row of layout.rows) {
    for (const col of row.columns) {
      if (col.id === id || col.blocks.some((b) => b.id === id)) return col.id;
    }
  }
  return null;
}

/** Row index for a row, column or block id. */
export function findRowIndex(layout: CaseStudyLayout, id: string): number {
  return layout.rows.findIndex(
    (row) => row.id === id || row.columns.some((col) => col.id === id || col.blocks.some((b) => b.id === id))
  );
}

const mapColumns = (layout: CaseStudyLayout, fn: (blocks: Block[], colId: string) => Block[]): CaseStudyLayout => ({
  ...layout,
  rows: layout.rows.map((row) => ({
    ...row,
    columns: row.columns.map((col) => ({ ...col, blocks: fn(col.blocks, col.id) })),
  })),
});

export function updateBlockData(layout: CaseStudyLayout, blockId: string, data: unknown): CaseStudyLayout {
  return mapColumns(layout, (blocks) =>
    blocks.map((b) => (b.id === blockId ? ({ ...b, data } as Block) : b))
  );
}

/** A row is disposable when every column is empty. */
const isEmptyRow = (row: LayoutRow) => row.columns.every((col) => col.blocks.length === 0);

export function removeBlock(layout: CaseStudyLayout, blockId: string): CaseStudyLayout {
  const loc = findBlock(layout, blockId);
  const next = mapColumns(layout, (blocks) => blocks.filter((b) => b.id !== blockId));
  // Drop the row if removing this block left it completely empty.
  if (loc && isEmptyRow(next.rows[loc.rowIndex])) {
    return { ...next, rows: next.rows.filter((_, i) => i !== loc.rowIndex) };
  }
  return next;
}

export function duplicateBlock(layout: CaseStudyLayout, blockId: string): CaseStudyLayout {
  return mapColumns(layout, (blocks) => {
    const i = blocks.findIndex((b) => b.id === blockId);
    if (i === -1) return blocks;
    const copy = { ...structuredClone(blocks[i]), id: newId() } as Block;
    return [...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)];
  });
}

export function insertBlock(layout: CaseStudyLayout, columnId: string, block: Block): CaseStudyLayout {
  return mapColumns(layout, (blocks, colId) => (colId === columnId ? [...blocks, block] : blocks));
}

export function addRow(layout: CaseStudyLayout, spans: number[], firstBlock?: Block): CaseStudyLayout {
  return { ...layout, rows: [...layout.rows, createRow(spans, firstBlock ? [[firstBlock]] : [])] };
}

export function removeRow(layout: CaseStudyLayout, rowId: string): CaseStudyLayout {
  return { ...layout, rows: layout.rows.filter((r) => r.id !== rowId) };
}

export function moveRow(layout: CaseStudyLayout, rowId: string, direction: -1 | 1): CaseStudyLayout {
  const i = layout.rows.findIndex((r) => r.id === rowId);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= layout.rows.length) return layout;
  return { ...layout, rows: arrayMove(layout.rows, i, j) };
}

/** Change a row's column split. Extra columns' blocks move into the last remaining column. */
export function setRowSpans(layout: CaseStudyLayout, rowId: string, spans: number[]): CaseStudyLayout {
  return {
    ...layout,
    rows: layout.rows.map((row) => {
      if (row.id !== rowId) return row;
      const columns = spans.map((span, i) => {
        const existing = row.columns[i];
        return existing ? { ...existing, span } : { id: newId(), span, blocks: [] as Block[] };
      });
      const overflow = row.columns.slice(spans.length).flatMap((c) => c.blocks);
      if (overflow.length > 0) {
        const last = columns[columns.length - 1];
        columns[columns.length - 1] = { ...last, blocks: [...last.blocks, ...overflow] };
      }
      return { ...row, columns };
    }),
  };
}

/** Move a block into another column, before `beforeBlockId` (or at the end). */
export function moveBlockToColumn(
  layout: CaseStudyLayout,
  blockId: string,
  targetColumnId: string,
  beforeBlockId: string | null
): CaseStudyLayout {
  const loc = findBlock(layout, blockId);
  if (!loc) return layout;
  const block = layout.rows[loc.rowIndex].columns[loc.colIndex].blocks[loc.blockIndex];
  const without = mapColumns(layout, (blocks) => blocks.filter((b) => b.id !== blockId));
  return mapColumns(without, (blocks, colId) => {
    if (colId !== targetColumnId) return blocks;
    const index = beforeBlockId ? blocks.findIndex((b) => b.id === beforeBlockId) : -1;
    return index === -1 ? [...blocks, block] : [...blocks.slice(0, index), block, ...blocks.slice(index)];
  });
}

export function reorderInColumn(layout: CaseStudyLayout, activeId: string, overId: string): CaseStudyLayout {
  return mapColumns(layout, (blocks) => {
    const from = blocks.findIndex((b) => b.id === activeId);
    const to = blocks.findIndex((b) => b.id === overId);
    return from !== -1 && to !== -1 ? arrayMove(blocks, from, to) : blocks;
  });
}

export function reorderRows(layout: CaseStudyLayout, activeRowId: string, overId: string): CaseStudyLayout {
  const from = layout.rows.findIndex((r) => r.id === activeRowId);
  const to = findRowIndex(layout, overId);
  return from !== -1 && to !== -1 && from !== to ? { ...layout, rows: arrayMove(layout.rows, from, to) } : layout;
}

// --- Containers (rows / columns) -------------------------------------------------------

const mapRow = (layout: CaseStudyLayout, rowId: string, fn: (row: LayoutRow) => LayoutRow): CaseStudyLayout => ({
  ...layout,
  rows: layout.rows.map((row) => (row.id === rowId ? fn(row) : row)),
});

/** Add a column by splitting the widest one in half. */
export function addColumn(layout: CaseStudyLayout, rowId: string): CaseStudyLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.columns.length >= MAX_COLUMNS) return row;
    let widest = 0;
    row.columns.forEach((col, i) => {
      if (col.span > row.columns[widest].span) widest = i;
    });
    const source = row.columns[widest];
    if (source.span < MIN_COLUMN_SPAN * 2) return row;
    const left = Math.ceil(source.span / 2);
    const columns = [...row.columns];
    columns[widest] = { ...source, span: left };
    columns.splice(widest + 1, 0, { id: newId(), span: source.span - left, blocks: [] });
    return { ...row, columns };
  });
}

/** Remove a column; its width and blocks go to its left neighbour (or right, for the first). */
export function removeColumn(layout: CaseStudyLayout, rowId: string, columnId: string): CaseStudyLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.columns.length <= 1) return row;
    const i = row.columns.findIndex((c) => c.id === columnId);
    if (i === -1) return row;
    const target = i === 0 ? 1 : i - 1;
    const removed = row.columns[i];
    const columns = row.columns.map((col, j) =>
      j === target
        ? {
            ...col,
            span: col.span + removed.span,
            blocks: target < i ? [...col.blocks, ...removed.blocks] : [...removed.blocks, ...col.blocks],
          }
        : col
    );
    return { ...row, columns: columns.filter((_, j) => j !== i) };
  });
}

/**
 * Resize the boundary between column `leftIndex` and the next one.
 * Total width of the pair is preserved; each side keeps at least MIN_COLUMN_SPAN.
 */
export function resizeColumns(layout: CaseStudyLayout, rowId: string, leftIndex: number, newLeftSpan: number): CaseStudyLayout {
  return mapRow(layout, rowId, (row) => {
    const left = row.columns[leftIndex];
    const right = row.columns[leftIndex + 1];
    if (!left || !right) return row;
    const pair = left.span + right.span;
    const span = Math.min(Math.max(Math.round(newLeftSpan), MIN_COLUMN_SPAN), pair - MIN_COLUMN_SPAN);
    if (span === left.span) return row;
    const columns = [...row.columns];
    columns[leftIndex] = { ...left, span };
    columns[leftIndex + 1] = { ...right, span: pair - span };
    return { ...row, columns };
  });
}

export function setRowStyle(layout: CaseStudyLayout, rowId: string, patch: Partial<RowStyle>): CaseStudyLayout {
  return mapRow(layout, rowId, (row) => {
    const style = { ...DEFAULT_ROW_STYLE, ...row.style, ...patch };
    const isDefault = style.background === 'none' && style.padding === 'none';
    if (isDefault) {
      const rest = { ...row };
      delete rest.style;
      return rest;
    }
    return { ...row, style };
  });
}

/** Insert a new row at `index` (append when index is beyond the end). */
export function insertRowAt(layout: CaseStudyLayout, index: number, spans: number[], firstBlock?: Block): CaseStudyLayout {
  const rows = [...layout.rows];
  rows.splice(Math.min(Math.max(index, 0), rows.length), 0, createRow(spans, firstBlock ? [[firstBlock]] : []));
  return { ...layout, rows };
}

/** Insert a block into a column before `beforeBlockId`, or at the end. */
export function insertBlockAt(layout: CaseStudyLayout, columnId: string, block: Block, beforeBlockId: string | null): CaseStudyLayout {
  return mapColumns(layout, (blocks, colId) => {
    if (colId !== columnId) return blocks;
    const i = beforeBlockId ? blocks.findIndex((b) => b.id === beforeBlockId) : -1;
    return i === -1 ? [...blocks, block] : [...blocks.slice(0, i), block, ...blocks.slice(i)];
  });
}

export { createBlock };
