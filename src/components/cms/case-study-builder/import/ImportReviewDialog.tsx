'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';
import type { CaseStudyExtraction } from '@/features/case-studies/import/import.schema';
import type { TemplateId } from '@/features/case-studies/layout/layout.types';
import { TEMPLATES } from '@/features/case-studies/layout/layout.utils';
import { describeSections, type ImportSectionId } from './apply-import';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export interface ImportReviewDialogProps {
  fileName: string;
  extraction: CaseStudyExtraction;
  warnings: string[];
  currentTemplate: TemplateId;
  onApply: (selected: Set<ImportSectionId>, templateId: TemplateId) => void;
  onCancel: () => void;
}

export function ImportReviewDialog({ fileName, extraction, warnings, currentTemplate, onApply, onCancel }: ImportReviewDialogProps) {
  const sections = useMemo(() => describeSections(extraction), [extraction]);
  const [selected, setSelected] = useState<Set<ImportSectionId>>(
    () => new Set(sections.filter((s) => s.available).map((s) => s.id))
  );
  const [templateId, setTemplateId] = useState<TemplateId>(extraction.suggestedTemplate ?? currentTemplate);
  const applyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    applyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const toggle = (id: ImportSectionId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-review-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="import-review-title" className="text-lg text-slate-900">
            Review what the AI found
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            From <span className="text-slate-700">{fileName}</span>. Ticked sections replace what is in the editor now. You can edit everything afterwards.
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {warnings.map((w) => (
            <p key={w} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {w}
            </p>
          ))}

          <fieldset>
            <legend className="mb-2 text-sm text-slate-900">Sections to apply</legend>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {sections.map((section) => (
                <li key={section.id}>
                  <label
                    className={`flex items-start gap-3 px-3 py-2.5 ${section.available ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(section.id)}
                      disabled={!section.available}
                      onChange={() => toggle(section.id)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-900">{section.label}</span>
                      <span className="block truncate text-xs text-slate-500">{section.preview}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm text-slate-900">Page template</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => {
                const active = templateId === t.id;
                return (
                  <label
                    key={t.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      active ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input type="radio" name="import-template" value={t.id} checked={active} onChange={() => setTemplateId(t.id)} className="sr-only" />
                    <span className="flex items-center justify-between gap-2 text-sm text-slate-900">
                      {t.name}
                      {active && <Check className="h-4 w-4 text-brand-600" aria-hidden />}
                    </span>
                    {extraction.suggestedTemplate === t.id && <span className="mt-1 block text-[12px] text-brand-700">Suggested for this document</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {extraction.missing.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm text-slate-900">
                <Info className="h-4 w-4 text-slate-500" aria-hidden />
                Not in the document, so add these yourself
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-9 text-sm text-slate-600">
                {extraction.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className={`cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${focusRing}`}
          >
            Cancel
          </button>
          <button
            ref={applyRef}
            type="button"
            disabled={selected.size === 0}
            onClick={() => onApply(selected, templateId)}
            className={`cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            Apply {selected.size} section{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
