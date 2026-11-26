'use client';

import React, { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, Layers, LayoutTemplate, Plus, Sparkles } from 'lucide-react';
import {
  BOUND_BLOCK_TYPES,
  FREE_BLOCK_TYPES,
  ROW_PRESETS,
  isBoundBlock,
  type BlockType,
  type CaseStudyLayout,
  type TemplateId,
} from '@/features/case-studies/layout/layout.types';
import { TEMPLATES, buildTemplate } from '@/features/case-studies/layout/layout.utils';
import { BLOCK_META } from './block-meta';
import { AiPanel, type ImportResultPayload } from '../ai/AiPanel';

const CASE_STUDY_PROMPTS = [
  'Summarise the project in 3 sentences',
  'List every result with its number',
  'Suggest 5 FAQs with answers',
  'Write the challenge section',
  'Describe the technology used',
];

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

type Tab = 'add' | 'templates' | 'layers' | 'ai';

export interface ToolboxProps {
  layout: CaseStudyLayout;
  templateId: TemplateId;
  usedBound: Set<string>;
  selectedId: string | null;
  onAddBlock: (type: BlockType) => void;
  onAddRow: (spans: number[]) => void;
  onPickTemplate: (id: TemplateId) => void;
  onSelectBlock: (blockId: string) => void;
  /** Saved case study id; AI import needs it. */
  caseStudyId?: string;
  onImported: (result: ImportResultPayload) => void;
  onInsertAnswer: (answer: string) => void;
}

export function Toolbox(props: ToolboxProps) {
  const [tab, setTab] = useState<Tab>('add');
  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'add', label: 'Add', icon: Plus },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'layers', label: 'Layers', icon: Layers },
    { id: 'ai', label: 'AI', icon: Sparkles },
  ];

  return (
    <aside aria-label="Toolbox" className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div role="tablist" aria-label="Toolbox sections" className="flex gap-1 border-b border-slate-200 p-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              aria-controls={`toolbox-${t.id}`}
              id={`toolbox-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[12px] transition-colors ${focusRing} ${
                active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <t.icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`toolbox-${tab}`}
        aria-labelledby={`toolbox-tab-${tab}`}
        className="flex-1 overflow-y-auto p-3"
      >
        {tab === 'add' && <AddPanel {...props} />}
        {tab === 'templates' && <TemplatesPanel {...props} />}
        {tab === 'layers' && <LayersPanel {...props} />}
        {/* Kept mounted so an upload or answer in progress survives switching tabs. */}
        <div hidden={tab !== 'ai'}>
          <AiPanel
            apiBase={props.caseStudyId ? `/api/cms/case-studies/${props.caseStudyId}` : undefined}
            noun="case study"
            quickPrompts={CASE_STUDY_PROMPTS}
            insertLabel="Insert as text block"
            onImported={props.onImported}
            onInsertAnswer={props.onInsertAnswer}
          />
        </div>
      </div>
    </aside>
  );
}

// --- Add -------------------------------------------------------------------------------------

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mt-1 mb-2">
      <h3 className="text-xs text-slate-900">{children}</h3>
      {hint && <p className="text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

function AddPanel({ usedBound, onAddBlock, onAddRow }: ToolboxProps) {
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
        Drag an item onto the page to place it, or click to add it at the bottom.
      </p>

      <section>
        <SectionTitle hint="A row with columns to hold blocks">Containers</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {ROW_PRESETS.map((preset) => (
            <ContainerTool key={preset.id} id={preset.id} label={preset.label} spans={preset.spans} onAdd={() => onAddRow(preset.spans)} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle hint="Add as many as you like">Content blocks</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {FREE_BLOCK_TYPES.map((type) => (
            <BlockTool key={type} type={type} disabled={false} onAdd={() => onAddBlock(type)} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle hint="Each can appear once on the page">Case study sections</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {BOUND_BLOCK_TYPES.map((type) => (
            <BlockTool key={type} type={type} disabled={usedBound.has(type)} onAdd={() => onAddBlock(type)} />
          ))}
        </div>
      </section>
    </div>
  );
}

const toolCard = `flex w-full touch-none select-none flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition-colors ${focusRing}`;

function BlockTool({ type, disabled, onAdd }: { type: BlockType; disabled: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tool:block:${type}`,
    data: { kind: 'tool-block', blockType: type },
    disabled,
  });
  const meta = BLOCK_META[type];
  const Icon = meta.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      onClick={onAdd}
      title={disabled ? 'Already on the page' : meta.description}
      className={`${toolCard} ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
          : 'cursor-grab border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/50 active:cursor-grabbing'
      } ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      // Pointer only: Enter/Space on a tool should add it (click), not start a keyboard drag.
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-[12px] leading-tight">{meta.label}</span>
      {disabled && <span className="text-[11px] text-slate-400">On page</span>}
    </button>
  );
}

function ContainerTool({ id, label, spans, onAdd }: { id: string; label: string; spans: number[]; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tool:row:${id}`,
    data: { kind: 'tool-row', spans },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onAdd}
      aria-label={`Add container: ${label}`}
      title={label}
      className={`${toolCard} cursor-grab border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/50 active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      // Pointer only: Enter/Space on a tool should add it (click), not start a keyboard drag.
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
    >
      <span aria-hidden className="flex w-full gap-1">
        {spans.map((span, i) => (
          <span key={i} className="h-6 rounded-sm border border-slate-300 bg-slate-100" style={{ flexGrow: span }} />
        ))}
      </span>
      <span className="text-[12px] leading-tight text-slate-600">{label}</span>
    </button>
  );
}

// --- Templates ---------------------------------------------------------------------------------

function TemplatesPanel({ templateId, onPickTemplate }: ToolboxProps) {
  const previews = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, buildTemplate(t.id)])), []);
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500">
        Switching rearranges the sections. Your content is kept, and extra blocks you added move to the end.
      </p>
      {TEMPLATES.map((t) => {
        const active = t.id === templateId;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onPickTemplate(t.id)}
            className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${focusRing} ${
              active ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-900">{t.name}</span>
              {active && (
                <span className="inline-flex items-center gap-1 text-[12px] text-brand-700">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  In use
                </span>
              )}
            </div>
            {/* Mini wireframe of the template */}
            <div aria-hidden className="space-y-1 rounded-md border border-slate-200 bg-white p-1.5">
              {previews[t.id].rows.map((row) => (
                <div key={row.id} className="flex gap-1">
                  {row.columns.map((col) => (
                    <div key={col.id} style={{ flexGrow: col.span }} className="flex flex-col gap-0.5">
                      {col.blocks.map((b) => (
                        <div
                          key={b.id}
                          title={BLOCK_META[b.type].label}
                          className={`rounded-[2px] ${b.type === 'hero' ? 'h-4 bg-slate-300' : isBoundBlock(b.type) ? 'h-2 bg-slate-200' : 'h-3 bg-brand-100'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-snug text-slate-500">{t.description}</p>
          </button>
        );
      })}
    </div>
  );
}

// --- Layers --------------------------------------------------------------------------------------

function LayersPanel({ layout, selectedId, onSelectBlock }: ToolboxProps) {
  if (layout.rows.length === 0) {
    return <p className="text-xs text-slate-500">The page is empty. Add a container or a block from the Add tab.</p>;
  }
  return (
    <ol className="space-y-2">
      {layout.rows.map((row, r) => (
        <li key={row.id} className="rounded-lg border border-slate-200">
          <p className="border-b border-slate-100 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-600">
            Row {r + 1}
            {row.columns.length > 1 ? `, ${row.columns.map((c) => c.span).join(' / ')}` : ''}
          </p>
          <ul className="space-y-0.5 p-1">
            {row.columns.map((col, c) => (
              <li key={col.id}>
                {row.columns.length > 1 && <p className="px-1.5 pt-1 text-[11px] text-slate-400">Column {c + 1}</p>}
                {col.blocks.length === 0 ? (
                  <p className="px-1.5 py-1 text-[12px] text-slate-400 italic">Empty</p>
                ) : (
                  col.blocks.map((block) => {
                    const meta = BLOCK_META[block.type];
                    const Icon = meta.icon;
                    const active = selectedId === block.id;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onSelectBlock(block.id)}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs ${focusRing} ${
                          active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{layerLabel(block)}</span>
                      </button>
                    );
                  })
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function layerLabel(block: CaseStudyLayout['rows'][number]['columns'][number]['blocks'][number]): string {
  const label = BLOCK_META[block.type].label;
  if (block.type === 'heading' && block.data.text) return `${label}: ${block.data.text}`;
  if (block.type === 'image' && block.data.alt) return `${label}: ${block.data.alt}`;
  if (block.type === 'file' && block.data.label) return `${label}: ${block.data.label}`;
  return label;
}
