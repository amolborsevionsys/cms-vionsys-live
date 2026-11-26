'use client';

import React, { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { RichTextEditor } from '../editor/RichTextEditor';
import { MediaPicker } from '../media/MediaPicker';
import { INDUSTRIES_LIST } from '@/config/taxonomy';
import type {
  Block,
  FileData,
  HeadingData,
  ImageData,
  TableData,
  TextData,
} from '@/features/case-studies/layout/layout.types';

/* eslint-disable @next/next/no-img-element -- media thumbnails come from S3 URLs */

// The editor's case-study document. Loosely typed to match ContentEditorShell's docData.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CaseStudyDoc = Record<string, any>;

export interface BoundEditorContext {
  doc: CaseStudyDoc;
  onFieldChange: (field: string, value: unknown) => void;
  challengeJson: unknown;
  onChallengeChange: (html: string, json: unknown, text: string) => void;
  onApproachChange: (html: string, json: unknown) => void;
}

// --- Small form primitives -----------------------------------------------------------

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400';

function Field({ label, children, hint }: { label: string; children: (id: string) => React.ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-slate-600">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[12px] text-slate-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <input id={id} type="text" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </Field>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} resize-y leading-relaxed`}
        />
      )}
    </Field>
  );
}

const smallButton =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50';
const iconButton =
  'inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

/** Picks an image from the media library and shows a thumbnail. */
function ImagePickerField({
  label,
  url,
  onPick,
  onClear,
}: {
  label: string;
  url: string | null | undefined;
  onPick: (url: string, alt: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" className="h-16 w-24 rounded-md border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-400">
            <ImagePlus className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className={smallButton}>
            {url ? 'Replace' : 'Choose image'}
          </button>
          {url && onClear && (
            <button type="button" onClick={onClear} className={smallButton}>
              Remove
            </button>
          )}
        </div>
      </div>
      <MediaPicker isOpen={open} onClose={() => setOpen(false)} onSelect={(u, alt) => onPick(u, alt)} />
    </div>
  );
}

/** Generic editor for a list of objects (metrics, steps, FAQs, gallery items). */
function ListEditor<T extends Record<string, unknown>>({
  items,
  onChange,
  createItem,
  addLabel,
  emptyText,
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel: string;
  emptyText: string;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="py-2 text-xs text-slate-400">{emptyText}</p>}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <div className="min-w-0 flex-1 space-y-2">
            {renderItem(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))), i)}
          </div>
          <div className="flex flex-col gap-0.5">
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} className={iconButton}>
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} className={iconButton}>
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className={`${iconButton} hover:bg-rose-50 hover:text-rose-700`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, createItem()])} className={smallButton}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {addLabel}
      </button>
    </div>
  );
}

// --- Bound block editors (edit the case study's own fields) -------------------------------

const ENGAGEMENT_TYPES = [
  { value: 'PROJECT', label: 'Project' },
  { value: 'RETAINER', label: 'Retainer' },
  { value: 'STAFF_AUGMENTATION', label: 'Staff augmentation' },
  { value: 'PRODUCT_BUILD', label: 'Product build' },
];

type Stat = { value: string; label: string; description: string };
type Step = { title: string; description: string; icon?: string | null };
type Faq = { question: string; answer: string };
type GalleryItem = { imagePath: string; alt: string; caption: string };

export function BoundBlockEditor({ type, ctx }: { type: Block['type']; ctx: BoundEditorContext }) {
  const { doc, onFieldChange: set } = ctx;

  switch (type) {
    case 'hero':
      return (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">The title and URL are edited at the top of the page.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Client name" value={doc.clientName} onChange={(v) => set('clientName', v)} placeholder="Acme Health" />
            <Field label="Industry">
              {(id) => (
                <select id={id} value={doc.industry ?? ''} onChange={(e) => set('industry', e.target.value)} className={inputClass}>
                  <option value="">Select an industry</option>
                  {INDUSTRIES_LIST.map((ind: string) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Engagement type">
              {(id) => (
                <select id={id} value={doc.engagementType ?? 'PROJECT'} onChange={(e) => set('engagementType', e.target.value)} className={inputClass}>
                  {ENGAGEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <TextArea label="Summary" value={doc.excerpt} onChange={(v) => set('excerpt', v)} placeholder="One or two sentences on the outcome." />
          <ImagePickerField
            label="Hero image"
            url={doc.featuredImage}
            onPick={(url, alt) => {
              set('featuredImage', url);
              if (!doc.featuredImageAlt && alt) set('featuredImageAlt', alt);
            }}
            onClear={() => set('featuredImage', null)}
          />
          {doc.featuredImage && (
            <TextInput
              label="Hero image alt text"
              value={doc.featuredImageAlt}
              onChange={(v) => set('featuredImageAlt', v)}
              hint="Required to publish. Describe what the image shows."
            />
          )}
        </div>
      );

    case 'metrics':
      return (
        <ListEditor<Stat>
          items={(doc.resultStats ?? []) as Stat[]}
          onChange={(items) => set('resultStats', items)}
          createItem={() => ({ value: '', label: '', description: '' })}
          addLabel="Add metric"
          emptyText="No metrics yet. Add at least 2 to publish."
          renderItem={(stat, update) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <TextInput label="Value" value={stat.value} onChange={(v) => update({ value: v })} placeholder="+145%" />
              <div className="sm:col-span-2">
                <TextInput label="Label" value={stat.label} onChange={(v) => update({ label: v })} placeholder="Monthly active users" />
              </div>
              <div className="sm:col-span-3">
                <TextInput label="Context (optional)" value={stat.description} onChange={(v) => update({ description: v })} />
              </div>
            </div>
          )}
        />
      );

    case 'challenge':
      return (
        <div className="editorjs-wrapper">
          <RichTextEditor compact initialJson={ctx.challengeJson} onChange={ctx.onChallengeChange} placeholder="Describe the problem the client faced…" />
        </div>
      );

    case 'approach':
      return (
        <div className="editorjs-wrapper">
          <RichTextEditor
            compact
            initialJson={doc.approachJson}
            onChange={(html, json) => ctx.onApproachChange(html, json)}
            placeholder="Explain how the problem was solved…"
          />
        </div>
      );

    case 'process':
      return (
        <ListEditor<Step>
          items={(doc.processSteps ?? []) as Step[]}
          onChange={(items) => set('processSteps', items)}
          createItem={() => ({ title: '', description: '', icon: null })}
          addLabel="Add step"
          emptyText="No steps yet."
          renderItem={(step, update, i) => (
            <>
              <TextInput label={`Step ${i + 1} title`} value={step.title} onChange={(v) => update({ title: v })} placeholder="Discovery workshop" />
              <TextArea label="Description" rows={2} value={step.description} onChange={(v) => update({ description: v })} />
            </>
          )}
        />
      );

    case 'gallery':
      return <GalleryEditor items={(doc.mediaGallery ?? []) as GalleryItem[]} onChange={(items) => set('mediaGallery', items)} />;

    case 'testimonial':
      return (
        <div className="space-y-3">
          <TextArea label="Quote" value={doc.testimonialQuote} onChange={(v) => set('testimonialQuote', v)} placeholder="Working with Vionsys…" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput label="Name" value={doc.testimonialName} onChange={(v) => set('testimonialName', v)} />
            <TextInput label="Role" value={doc.testimonialDesignation} onChange={(v) => set('testimonialDesignation', v)} placeholder="CTO" />
            <TextInput label="Company" value={doc.testimonialCompany} onChange={(v) => set('testimonialCompany', v)} />
          </div>
        </div>
      );

    case 'faq':
      return (
        <ListEditor<Faq>
          items={(doc.faqs ?? []) as Faq[]}
          onChange={(items) => set('faqs', items)}
          createItem={() => ({ question: '', answer: '' })}
          addLabel="Add question"
          emptyText="No questions yet."
          renderItem={(faq, update) => (
            <>
              <TextInput label="Question" value={faq.question} onChange={(v) => update({ question: v })} />
              <TextArea label="Answer" rows={2} value={faq.answer} onChange={(v) => update({ answer: v })} />
            </>
          )}
        />
      );

    case 'cta':
      return (
        <div className="space-y-3">
          <TextInput label="Heading" value={doc.ctaHeading} onChange={(v) => set('ctaHeading', v)} placeholder="Ready to modernise your platform?" />
          <TextArea label="Message" rows={2} value={doc.ctaBody} onChange={(v) => set('ctaBody', v)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Button label" value={doc.ctaButtonLabel} onChange={(v) => set('ctaButtonLabel', v)} placeholder="Talk to us" />
            <TextInput label="Button link" value={doc.ctaButtonUrl} onChange={(v) => set('ctaButtonUrl', v)} placeholder="/contact" />
          </div>
        </div>
      );

    default:
      return null;
  }
}

function GalleryEditor({ items, onChange }: { items: GalleryItem[]; onChange: (items: GalleryItem[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <ListEditor<GalleryItem>
        items={items}
        onChange={onChange}
        createItem={() => ({ imagePath: '', alt: '', caption: '' })}
        addLabel="Add empty slot"
        emptyText="No images yet."
        renderItem={(item, update) => (
          <div className="flex gap-3">
            {item.imagePath ? (
              <img src={item.imagePath} alt="" className="h-16 w-24 shrink-0 rounded-md border border-slate-200 object-cover" />
            ) : (
              <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
                No image
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <TextInput label="Alt text" value={item.alt} onChange={(v) => update({ alt: v })} />
              <TextInput label="Caption (optional)" value={item.caption} onChange={(v) => update({ caption: v })} />
            </div>
          </div>
        )}
      />
      <button type="button" onClick={() => setOpen(true)} className={smallButton}>
        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
        Add image from library
      </button>
      <MediaPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={(url, alt) => onChange([...items, { imagePath: url, alt: alt ?? '', caption: '' }])}
      />
    </div>
  );
}

// --- Free block editors (edit the block's own data) ----------------------------------------

export function FreeBlockEditor({ block, onChange }: { block: Block; onChange: (data: unknown) => void }) {
  switch (block.type) {
    case 'heading': {
      const data = block.data as HeadingData;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-3">
            <TextInput label="Heading text" value={data.text} onChange={(v) => onChange({ ...data, text: v })} />
          </div>
          <Field label="Size">
            {(id) => (
              <select
                id={id}
                value={data.level}
                onChange={(e) => onChange({ ...data, level: Number(e.target.value) === 3 ? 3 : 2 })}
                className={inputClass}
              >
                <option value={2}>Large (H2)</option>
                <option value={3}>Medium (H3)</option>
              </select>
            )}
          </Field>
        </div>
      );
    }
    case 'text': {
      const data = block.data as TextData;
      return (
        <div className="editorjs-wrapper">
          <RichTextEditor compact initialJson={data.json} onChange={(html, json) => onChange({ html, json })} placeholder="Write something…" />
        </div>
      );
    }
    case 'image': {
      const data = block.data as ImageData;
      return (
        <div className="space-y-3">
          <ImagePickerField
            label="Image"
            url={data.url}
            onPick={(url, alt) => onChange({ ...data, url, alt: data.alt || alt })}
            onClear={() => onChange({ ...data, url: '' })}
          />
          <TextInput label="Alt text" value={data.alt} onChange={(v) => onChange({ ...data, alt: v })} hint="Describe what the image shows." />
          <TextInput label="Caption (optional)" value={data.caption} onChange={(v) => onChange({ ...data, caption: v })} />
        </div>
      );
    }
    case 'table':
      return <TableEditor data={block.data as TableData} onChange={onChange} />;
    case 'file': {
      const data = block.data as FileData;
      return (
        <div className="space-y-3">
          <TextInput label="Button label" value={data.label} onChange={(v) => onChange({ ...data, label: v })} placeholder="Download the full report (PDF)" />
          <TextInput
            label="File URL"
            value={data.url}
            onChange={(v) => onChange({ ...data, url: v })}
            placeholder="https://…"
            hint="Upload the file in the Media library, then paste its URL here."
          />
        </div>
      );
    }
    case 'divider':
      return <p className="text-xs text-slate-500">A divider has no settings.</p>;
    default:
      return null;
  }
}

function TableEditor({ data, onChange }: { data: TableData; onChange: (data: TableData) => void }) {
  const cols = Math.max(1, ...data.rows.map((r) => r.length));
  const rows = data.rows.map((r) => [...r, ...Array(cols - r.length).fill('')]);

  const setCell = (r: number, c: number, value: string) =>
    onChange({ ...data, rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)) });
  const addRow = () => onChange({ ...data, rows: [...rows, Array(cols).fill('')] });
  const addCol = () => onChange({ ...data, rows: rows.map((row) => [...row, '']) });
  const removeRow = (r: number) => rows.length > 1 && onChange({ ...data, rows: rows.filter((_, i) => i !== r) });
  const removeCol = (c: number) => cols > 1 && onChange({ ...data, rows: rows.map((row) => row.filter((_, j) => j !== c)) });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-slate-200 p-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      className={`w-36 border-0 px-2 py-1.5 text-xs ${r === 0 && data.hasHeader ? 'bg-slate-50 font-medium' : 'bg-white'}`}
                    />
                  </td>
                ))}
                <td className="pl-1">
                  <button type="button" aria-label={`Remove row ${r + 1}`} disabled={rows.length <= 1} onClick={() => removeRow(r)} className={iconButton}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="pt-1 text-center">
                  <button type="button" aria-label={`Remove column ${c + 1}`} disabled={cols <= 1} onClick={() => removeCol(c)} className={iconButton}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addRow} className={smallButton}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add row
        </button>
        <button type="button" onClick={addCol} className={smallButton}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add column
        </button>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={data.hasHeader}
            onChange={(e) => onChange({ ...data, hasHeader: e.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          First row is a header
        </label>
      </div>
      <TextInput label="Caption (optional)" value={data.caption} onChange={(v) => onChange({ ...data, caption: v })} />
    </div>
  );
}
