'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, Check, Columns3, Copy, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  MAX_COLUMNS,
  MIN_COLUMN_SPAN,
  ROW_PRESETS,
  isBoundBlock,
  type Block,
  type BlockType,
  type CaseStudyLayout,
  type LayoutColumn,
  type LayoutRow,
  type RowStyle,
  type TemplateId,
} from '@/features/case-studies/layout/layout.types';
import { TEMPLATES, getUsedBoundTypes } from '@/features/case-studies/layout/layout.utils';
import {
  LayoutBlock,
  rowContainerClass,
  type CaseStudyRenderData,
} from '@/components/case-study-layout/CaseStudyLayoutRenderer';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BLOCK_META } from './block-meta';
import { BoundBlockEditor, FreeBlockEditor, type BoundEditorContext } from './BlockEditors';
import { Toolbox } from './Toolbox';
import { ImportReviewDialog } from './import/ImportReviewDialog';
import { answerToTextBlock, type ImportSectionId } from './import/apply-import';
import type { ImportResultPayload } from '../ai/AiPanel';
import type { CaseStudyExtraction } from '@/features/case-studies/import/import.schema';
import * as ops from './layout-ops';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
const toolButton = `inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const smallSelect = 'cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700';

const SPAN_CLASS: Record<number, string> = {
  1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3', 4: 'lg:col-span-4',
  5: 'lg:col-span-5', 6: 'lg:col-span-6', 7: 'lg:col-span-7', 8: 'lg:col-span-8',
  9: 'lg:col-span-9', 10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
};

type DragKind = 'row' | 'block' | 'tool-block' | 'tool-row';

/**
 * Collision rules:
 *  - blocks and rows being re-ordered use closestCorners (smooth sortable feel);
 *  - items dragged from the toolbox use the element under the pointer, preferring
 *    the most specific target (block → column → row → end of page).
 */
const TOOL_PRIORITY: Record<string, number> = { block: 0, column: 1, row: 2, 'canvas-end': 3 };
const collisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind as DragKind | undefined;
  if (kind !== 'tool-block' && kind !== 'tool-row') return closestCorners(args);

  const allowed = kind === 'tool-row' ? ['row', 'canvas-end'] : ['block', 'column', 'row', 'canvas-end'];
  const kindOf = (c: { data?: { droppableContainer?: { data: { current?: { kind?: string } } } } }) =>
    c.data?.droppableContainer?.data.current?.kind ?? '';
  const hits = pointerWithin(args)
    .filter((c) => allowed.includes(kindOf(c)))
    .sort((a, b) => (TOOL_PRIORITY[kindOf(a)] ?? 9) - (TOOL_PRIORITY[kindOf(b)] ?? 9));
  return hits.length > 0 ? hits.slice(0, 1) : [];
};

export interface CaseStudyBuilderProps {
  layout: CaseStudyLayout;
  updateLayout: (updater: (prev: CaseStudyLayout) => CaseStudyLayout) => void;
  templateId: TemplateId;
  onTemplateChange: (templateId: TemplateId) => void;
  ctx: BoundEditorContext & { challengeHtml: string };
  /** Rendered above the canvas (title, slug, errors). */
  header?: React.ReactNode;
  /** Rendered below the canvas. */
  footer?: React.ReactNode;
  /** Saved case study id (AI import and Ask AI need it). */
  caseStudyId?: string;
  /** Apply reviewed AI-extracted content to the case study. */
  onApplyImport: (extraction: CaseStudyExtraction, selected: Set<ImportSectionId>, templateId: TemplateId) => void;
}

export function CaseStudyBuilder({
  layout,
  updateLayout,
  templateId,
  onTemplateChange,
  ctx,
  header,
  footer,
  caseStudyId,
  onApplyImport,
}: CaseStudyBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ kind: DragKind; label: string } | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Block | null>(null);
  const [importReview, setImportReview] = useState<ImportResultPayload<CaseStudyExtraction> | null>(null);

  // Stable id so dnd-kit's accessibility attributes match between server and client.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const usedBound = useMemo(() => getUsedBoundTypes(layout), [layout]);

  // Data the canvas preview renders, built from the live editor state.
  const { doc } = ctx;
  const preview: CaseStudyRenderData = {
    title: doc.title || 'Untitled case study',
    clientName: doc.clientName,
    industry: doc.industry,
    engagementType: doc.engagementType,
    heroImage: doc.featuredImage,
    heroImageAlt: doc.featuredImageAlt,
    excerpt: doc.excerpt,
    challengeHtml: ctx.challengeHtml,
    approachHtml: doc.approachHtml,
    resultStats: doc.resultStats,
    processSteps: doc.processSteps,
    mediaGallery: doc.mediaGallery,
    faqs: doc.faqs,
    testimonial: doc.testimonialQuote
      ? { quote: doc.testimonialQuote, name: doc.testimonialName, designation: doc.testimonialDesignation, company: doc.testimonialCompany }
      : null,
    cta: doc.ctaHeading
      ? { heading: doc.ctaHeading, body: doc.ctaBody, buttonLabel: doc.ctaButtonLabel, buttonUrl: doc.ctaButtonUrl }
      : null,
    layout,
  };

  const select = (blockId: string) => {
    setSelectedId(blockId);
    requestAnimationFrame(() =>
      document.getElementById(`block-${blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
  };

  // --- Adding from the toolbox (click = append at the bottom) ------------------------------

  const addBlockAtEnd = (type: BlockType) => {
    if (isBoundBlock(type) && usedBound.has(type)) return;
    const block = ops.createBlock(type);
    updateLayout((prev) => ops.addRow(prev, [12], block));
    select(block.id);
  };

  const addRowAtEnd = (spans: number[]) => updateLayout((prev) => ops.addRow(prev, spans));

  // --- Drag and drop ----------------------------------------------------------------------

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { kind?: DragKind; blockType?: BlockType; spans?: number[] } | undefined;
    if (!data?.kind) return;
    let label = 'Container';
    if (data.kind === 'tool-block' && data.blockType) label = BLOCK_META[data.blockType].label;
    if (data.kind === 'block') {
      const loc = ops.findBlock(layout, String(e.active.id));
      if (loc) label = BLOCK_META[layout.rows[loc.rowIndex].columns[loc.colIndex].blocks[loc.blockIndex].type].label;
    }
    if (data.kind === 'tool-row' && data.spans) label = `Container (${data.spans.join(' / ')})`;
    setDragging({ kind: data.kind, label });
  };

  // Moving an existing block into a different column previews in place while dragging.
  const onDragOver = (e: DragOverEvent) => {
    if (e.active.data.current?.kind !== 'block' || !e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    const overKind = e.over.data.current?.kind;
    if (overKind !== 'block' && overKind !== 'column') return;

    updateLayout((prev) => {
      const from = ops.findColumnId(prev, activeId);
      const to = ops.findColumnId(prev, overId);
      if (!from || !to || from === to) return prev;
      return ops.moveBlockToColumn(prev, activeId, to, overKind === 'block' ? overId : null);
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    const data = e.active.data.current as { kind?: DragKind; blockType?: BlockType; spans?: number[] } | undefined;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    const overKind = e.over.data.current?.kind as string | undefined;

    switch (data?.kind) {
      case 'row':
        updateLayout((prev) => ops.reorderRows(prev, activeId, overId));
        return;

      case 'block':
        if (overKind === 'block' && activeId !== overId) {
          updateLayout((prev) =>
            ops.findColumnId(prev, activeId) === ops.findColumnId(prev, overId) ? ops.reorderInColumn(prev, activeId, overId) : prev
          );
        }
        return;

      case 'tool-block': {
        const type = data.blockType;
        if (!type || (isBoundBlock(type) && usedBound.has(type))) return;
        const block = ops.createBlock(type);
        updateLayout((prev) => {
          if (overKind === 'block') {
            const col = ops.findColumnId(prev, overId);
            return col ? ops.insertBlockAt(prev, col, block, overId) : prev;
          }
          if (overKind === 'column') return ops.insertBlockAt(prev, overId, block, null);
          if (overKind === 'row') return ops.insertRowAt(prev, ops.findRowIndex(prev, overId) + 1, [12], block);
          return ops.addRow(prev, [12], block);
        });
        select(block.id);
        return;
      }

      case 'tool-row': {
        const spans = data.spans ?? [12];
        updateLayout((prev) =>
          overKind === 'row' ? ops.insertRowAt(prev, ops.findRowIndex(prev, overId) + 1, spans) : ops.addRow(prev, spans)
        );
        return;
      }
    }
  };

  const requestDelete = (block: Block) => {
    // Free blocks with content get a confirmation; bound blocks keep their content anyway.
    if (!isBoundBlock(block.type) && !isEmptyBlock(block, preview)) setPendingDelete(block);
    else updateLayout((prev) => ops.removeBlock(prev, block.id));
  };

  const isDraggingTool = dragging?.kind === 'tool-block' || dragging?.kind === 'tool-row';

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <Toolbox
          layout={layout}
          templateId={templateId}
          usedBound={usedBound}
          selectedId={selectedId}
          onAddBlock={addBlockAtEnd}
          onAddRow={addRowAtEnd}
          onPickTemplate={(id) => setPendingTemplate(id)}
          onSelectBlock={select}
          caseStudyId={caseStudyId}
          onImported={(result) => setImportReview(result as ImportResultPayload<CaseStudyExtraction>)}
          onInsertAnswer={(answer) => {
            const block = answerToTextBlock(answer);
            updateLayout((prev) => ops.addRow(prev, [12], block));
            select(block.id);
          }}
        />

        <div className="min-w-0 flex-1 overflow-y-auto bg-slate-100/60 px-6 py-6 pb-24">
          <div className="mx-auto w-full max-w-6xl space-y-4">
            {header}

            <SortableContext items={layout.rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {layout.rows.map((row, index) => (
                  <SortableRow
                    key={row.id}
                    row={row}
                    isFirst={index === 0}
                    isLast={index === layout.rows.length - 1}
                    isDraggingTool={isDraggingTool}
                    onSpans={(spans) => updateLayout((prev) => ops.setRowSpans(prev, row.id, spans))}
                    onStyle={(patch) => updateLayout((prev) => ops.setRowStyle(prev, row.id, patch))}
                    onAddColumn={() => updateLayout((prev) => ops.addColumn(prev, row.id))}
                    onMove={(dir) => updateLayout((prev) => ops.moveRow(prev, row.id, dir))}
                    onRemove={() => updateLayout((prev) => ops.removeRow(prev, row.id))}
                  >
                    {row.columns.map((col, colIndex) => (
                      <DroppableColumn
                        key={col.id}
                        column={col}
                        canRemove={row.columns.length > 1}
                        onRemove={() => updateLayout((prev) => ops.removeColumn(prev, row.id, col.id))}
                        resizeHandle={
                          colIndex < row.columns.length - 1 ? (
                            <ResizeHandle
                              leftSpan={col.span}
                              pairSpan={col.span + row.columns[colIndex + 1].span}
                              onResize={(span) => updateLayout((prev) => ops.resizeColumns(prev, row.id, colIndex, span))}
                            />
                          ) : null
                        }
                      >
                        {col.blocks.map((block) => (
                          <SortableBlock
                            key={block.id}
                            block={block}
                            isSelected={selectedId === block.id}
                            onSelect={() => setSelectedId(block.id)}
                            onDone={() => setSelectedId(null)}
                            onDuplicate={() => updateLayout((prev) => ops.duplicateBlock(prev, block.id))}
                            onRemove={() => requestDelete(block)}
                            preview={preview}
                            editor={
                              isBoundBlock(block.type) ? (
                                <BoundBlockEditor type={block.type} ctx={ctx} />
                              ) : (
                                <FreeBlockEditor
                                  block={block}
                                  onChange={(data) => updateLayout((prev) => ops.updateBlockData(prev, block.id, data))}
                                />
                              )
                            }
                          />
                        ))}
                      </DroppableColumn>
                    ))}
                  </SortableRow>
                ))}
              </div>
            </SortableContext>

            <CanvasEnd isEmpty={layout.rows.length === 0} isDraggingTool={isDraggingTool} onAddRow={() => addRowAtEnd([12])} />

            {footer}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="rounded-lg border border-brand-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-lg">{dragging.label}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {importReview && (
        <ImportReviewDialog
          fileName={importReview.source.fileName}
          extraction={importReview.extraction}
          warnings={importReview.warnings}
          currentTemplate={templateId}
          onCancel={() => setImportReview(null)}
          onApply={(selected, chosenTemplate) => {
            // Close any open block editor first so rich-text editors re-open with the imported content.
            setSelectedId(null);
            onApplyImport(importReview.extraction, selected, chosenTemplate);
            setImportReview(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingTemplate !== null}
        title={`Switch to the ${TEMPLATES.find((t) => t.id === pendingTemplate)?.name ?? ''} template?`}
        message="Sections are rearranged to match the template. Your content is kept, and any extra blocks you added move to the end of the page."
        confirmLabel="Switch template"
        onConfirm={() => {
          if (pendingTemplate) onTemplateChange(pendingTemplate);
          setPendingTemplate(null);
          setSelectedId(null);
        }}
        onCancel={() => setPendingTemplate(null)}
      />
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete this ${pendingDelete ? BLOCK_META[pendingDelete.type].label.toLowerCase() : ''} block?`}
        message="Its content is removed from the page."
        confirmLabel="Delete block"
        isDanger
        onConfirm={() => {
          if (pendingDelete) updateLayout((prev) => ops.removeBlock(prev, pendingDelete.id));
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// --- Row (container) ------------------------------------------------------------------------

const BACKGROUND_OPTIONS: { value: RowStyle['background']; label: string }[] = [
  { value: 'none', label: 'No background' },
  { value: 'muted', label: 'Light grey' },
  { value: 'brand', label: 'Light blue' },
];
const PADDING_OPTIONS: { value: RowStyle['padding']; label: string }[] = [
  { value: 'none', label: 'No spacing' },
  { value: 'sm', label: 'Small spacing' },
  { value: 'md', label: 'Medium spacing' },
  { value: 'lg', label: 'Large spacing' },
];

function SortableRow({
  row,
  isFirst,
  isLast,
  isDraggingTool,
  onSpans,
  onStyle,
  onAddColumn,
  onMove,
  onRemove,
  children,
}: {
  row: LayoutRow;
  isFirst: boolean;
  isLast: boolean;
  isDraggingTool: boolean;
  onSpans: (spans: number[]) => void;
  onStyle: (patch: Partial<RowStyle>) => void;
  onAddColumn: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: row.id,
    data: { kind: 'row' },
  });
  const presetId = row.columns.map((c) => c.span).join('-');
  const isPreset = ROW_PRESETS.some((p) => p.id === presetId);
  const style = row.style ?? { background: 'none', padding: 'none' };
  const canAddColumn =
    row.columns.length < MAX_COLUMNS && row.columns.some((c) => c.span >= MIN_COLUMN_SPAN * 2);

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label="Container"
      className={`group/row relative rounded-xl border bg-white p-2 shadow-sm transition-colors ${
        isDragging ? 'border-brand-300 opacity-60' : 'border-slate-200 hover:border-slate-300'
      } ${isOver && isDraggingTool ? 'ring-2 ring-brand-300' : ''}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag container"
          className={`${toolButton} cursor-grab active:cursor-grabbing`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <select aria-label="Columns" value={isPreset ? presetId : ''} onChange={(e) => {
          const preset = ROW_PRESETS.find((p) => p.id === e.target.value);
          if (preset) onSpans(preset.spans);
        }} className={smallSelect}>
          {!isPreset && <option value="">Custom ({row.columns.map((c) => c.span).join(' / ')})</option>}
          {ROW_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select aria-label="Background" value={style.background} onChange={(e) => onStyle({ background: e.target.value as RowStyle['background'] })} className={smallSelect}>
          {BACKGROUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Spacing" value={style.padding} onChange={(e) => onStyle({ padding: e.target.value as RowStyle['padding'] })} className={smallSelect}>
          {PADDING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-0.5 opacity-70 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
          <button type="button" aria-label="Add column" title="Add column" disabled={!canAddColumn} onClick={onAddColumn} className={toolButton}>
            <Columns3 className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="Move container up" disabled={isFirst} onClick={() => onMove(-1)} className={toolButton}>
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="Move container down" disabled={isLast} onClick={() => onMove(1)} className={toolButton}>
            <ArrowDown className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" aria-label="Delete container" onClick={onRemove} className={`${toolButton} hover:bg-rose-50 hover:text-rose-700`}>
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div data-row-grid className={`grid grid-cols-1 gap-3 lg:grid-cols-12 ${rowContainerClass(row.style)}`}>
        {children}
      </div>

      {isOver && isDraggingTool && (
        <p className="pointer-events-none absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] text-white">
          Drop to add below
        </p>
      )}
    </section>
  );
}

// --- Column -----------------------------------------------------------------------------------

function DroppableColumn({
  column,
  canRemove,
  onRemove,
  resizeHandle,
  children,
}: {
  column: LayoutColumn;
  canRemove: boolean;
  onRemove: () => void;
  resizeHandle: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { kind: 'column' } });
  return (
    <div
      ref={setNodeRef}
      className={`group/col relative flex min-h-24 flex-col gap-2 rounded-lg border border-dashed p-1.5 transition-colors ${
        SPAN_CLASS[column.span] ?? 'lg:col-span-12'
      } ${isOver ? 'border-brand-400 bg-brand-50/60' : 'border-transparent hover:border-slate-300'}`}
    >
      {canRemove && (
        <button
          type="button"
          aria-label="Remove column"
          title="Remove column (its blocks move to the neighbouring column)"
          onClick={onRemove}
          className={`absolute -top-2 -right-2 z-10 hidden h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm group-hover/col:flex hover:text-rose-700 focus-visible:flex ${focusRing}`}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
      <SortableContext items={column.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {column.blocks.length === 0 && (
        <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">
          Drag a block here from the toolbox
        </p>
      )}
      {resizeHandle}
    </div>
  );
}

/** Drag (or use arrow keys) to move the boundary between two columns, snapping to the 12-column grid. */
function ResizeHandle({ leftSpan, pairSpan, onResize }: { leftSpan: number; pairSpan: number; onResize: (span: number) => void }) {
  const [liveSpan, setLiveSpan] = useState<number | null>(null);
  const min = MIN_COLUMN_SPAN;
  const max = pairSpan - MIN_COLUMN_SPAN;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = (e.currentTarget as HTMLElement).closest('[data-row-grid]') as HTMLElement | null;
    if (!grid) return;
    const unit = grid.getBoundingClientRect().width / 12;
    const startX = e.clientX;
    const start = leftSpan;

    const move = (ev: PointerEvent) => {
      const span = Math.min(Math.max(start + Math.round((ev.clientX - startX) / unit), min), max);
      setLiveSpan(span);
      onResize(span);
    };
    const up = () => {
      setLiveSpan(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' && leftSpan > min) {
      e.preventDefault();
      onResize(leftSpan - 1);
    } else if (e.key === 'ArrowRight' && leftSpan < max) {
      e.preventDefault();
      onResize(leftSpan + 1);
    }
  };

  const shown = liveSpan ?? leftSpan;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize columns"
      aria-valuenow={leftSpan}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${leftSpan} of 12 and ${pairSpan - leftSpan} of 12`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={`group/handle absolute top-0 -right-[11px] z-20 hidden h-full w-[10px] cursor-col-resize touch-none items-center justify-center lg:flex ${focusRing}`}
    >
      <span
        aria-hidden
        className={`h-12 w-1 rounded-full transition-colors ${liveSpan !== null ? 'bg-brand-600' : 'bg-slate-300 group-hover/handle:bg-brand-500'}`}
      />
      {liveSpan !== null && (
        <span className="absolute top-2 rounded bg-slate-900 px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white">
          {shown} / {pairSpan - shown}
        </span>
      )}
    </div>
  );
}

// --- End of page drop zone --------------------------------------------------------------------

function CanvasEnd({ isEmpty, isDraggingTool, onAddRow }: { isEmpty: boolean; isDraggingTool: boolean; onAddRow: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas-end', data: { kind: 'canvas-end' } });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors ${
        isEmpty ? 'py-16' : 'py-6'
      } ${isOver ? 'border-brand-400 bg-brand-50' : isDraggingTool ? 'border-brand-200 bg-white' : 'border-slate-300'}`}
    >
      <p className="text-xs text-slate-500">
        {isEmpty ? 'The page is empty. Drag a container or block here from the toolbox.' : 'Drop here to add at the bottom of the page'}
      </p>
      <button
        type="button"
        onClick={onAddRow}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 ${focusRing}`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add empty container
      </button>
    </div>
  );
}

// --- Block -------------------------------------------------------------------------------------

function SortableBlock({
  block,
  isSelected,
  onSelect,
  onDone,
  onDuplicate,
  onRemove,
  preview,
  editor,
}: {
  block: Block;
  isSelected: boolean;
  onSelect: () => void;
  onDone: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  preview: CaseStudyRenderData;
  editor: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { kind: 'block' },
  });
  const meta = BLOCK_META[block.type];
  const Icon = meta.icon;
  const bound = isBoundBlock(block.type);
  const empty = isEmptyBlock(block, preview);

  return (
    <div
      id={`block-${block.id}`}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`scroll-mt-24 rounded-lg border bg-white transition-shadow ${isDragging ? 'opacity-50' : ''} ${
        isSelected ? 'border-brand-400 shadow-md ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center gap-1 border-b border-slate-100 px-1.5 py-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Drag ${meta.label} block`}
          className={`${toolButton} cursor-grab active:cursor-grabbing`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="truncate text-xs text-slate-700">{meta.label}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {isSelected ? (
            <button type="button" onClick={onDone} className={`inline-flex cursor-pointer items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 ${focusRing}`}>
              <Check className="h-3.5 w-3.5" aria-hidden />
              Done
            </button>
          ) : (
            <button type="button" aria-label={`Edit ${meta.label}`} onClick={onSelect} className={toolButton}>
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          )}
          {!bound && (
            <button type="button" aria-label={`Duplicate ${meta.label}`} onClick={onDuplicate} className={toolButton}>
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            aria-label={bound ? `Remove ${meta.label} from page` : `Delete ${meta.label}`}
            title={bound ? 'Removes it from the page. The content is kept and the section can be added back.' : 'Delete block'}
            onClick={onRemove}
            className={`${toolButton} hover:bg-rose-50 hover:text-rose-700`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {isSelected ? (
        <div className="p-3">{editor}</div>
      ) : (
        <button type="button" onClick={onSelect} aria-label={`Edit ${meta.label}`} className={`block w-full cursor-pointer rounded-b-lg p-3 text-left ${focusRing}`}>
          {empty ? (
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {meta.description}. Click to add content.
            </span>
          ) : (
            <div className="pointer-events-none max-h-80 overflow-hidden [mask-image:linear-gradient(to_bottom,black_85%,transparent)]">
              <LayoutBlock block={block} cs={preview} />
            </div>
          )}
        </button>
      )}
    </div>
  );
}

/** True when a block would render nothing on the live page. */
function isEmptyBlock(block: Block, cs: CaseStudyRenderData): boolean {
  switch (block.type) {
    case 'hero':
      return false;
    case 'metrics':
      return !(cs.resultStats ?? []).some((s) => s.value || s.label);
    case 'challenge':
      return !cs.challengeHtml?.replace(/<[^>]*>/g, '').trim();
    case 'approach':
      return !cs.approachHtml?.replace(/<[^>]*>/g, '').trim();
    case 'process':
      return !(cs.processSteps ?? []).some((s) => s.title || s.description);
    case 'gallery':
      return !(cs.mediaGallery ?? []).some((m) => m.imagePath);
    case 'testimonial':
      return !cs.testimonial?.quote;
    case 'faq':
      return !(cs.faqs ?? []).some((f) => f.question);
    case 'cta':
      return !cs.cta?.heading;
    case 'heading':
      return !block.data.text.trim();
    case 'text':
      return !block.data.html.replace(/<[^>]*>/g, '').trim();
    case 'image':
    case 'file':
      return !block.data.url;
    case 'table':
      return !block.data.rows.some((r) => r.some((c) => c.trim()));
    case 'divider':
      return false;
    default:
      return true;
  }
}

export default CaseStudyBuilder;
