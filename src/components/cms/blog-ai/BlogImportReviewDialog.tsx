'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { BlogExtraction } from '@/features/blogs/import/blog-import.schema';
import { describeBlogSections, type BlogSectionId, type BodyMode } from './apply-blog-import';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export interface BlogImportReviewDialogProps {
  fileName: string;
  extraction: BlogExtraction;
  warnings: string[];
  /** True when the editor already has body content (offers "append"). */
  hasExistingBody: boolean;
  onApply: (selected: Set<BlogSectionId>, bodyMode: BodyMode) => void;
  onCancel: () => void;
}

export function BlogImportReviewDialog({ fileName, extraction, warnings, hasExistingBody, onApply, onCancel }: BlogImportReviewDialogProps) {
  const sections = useMemo(() => describeBlogSections(extraction), [extraction]);
  const [selected, setSelected] = useState<Set<BlogSectionId>>(
    () => new Set(sections.filter((s) => s.available).map((s) => s.id))
  );
  const [bodyMode, setBodyMode] = useState<BodyMode>('replace');
  const applyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    applyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const toggle = (id: BlogSectionId) =>
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
        aria-labelledby="blog-import-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 id="blog-import-title" className="text-lg text-slate-900">
            Review the converted blog post
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
            <legend className="mb-2 text-sm text-slate-900">What to apply</legend>
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
                  {section.id === 'body' && selected.has('body') && hasExistingBody && (
                    <div role="radiogroup" aria-label="How to add the article body" className="flex flex-wrap gap-4 px-10 pb-3 text-xs text-slate-700">
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input type="radio" name="body-mode" checked={bodyMode === 'replace'} onChange={() => setBodyMode('replace')} className="accent-brand-600" />
                        Replace the current body
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5">
                        <input type="radio" name="body-mode" checked={bodyMode === 'append'} onChange={() => setBodyMode('append')} className="accent-brand-600" />
                        Add after the current body
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>

          {extraction.missing.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm text-slate-900">
                <Info className="h-4 w-4 text-slate-500" aria-hidden />
                Worth adding yourself
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
            onClick={() => onApply(selected, bodyMode)}
            className={`cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            Apply {selected.size} section{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
