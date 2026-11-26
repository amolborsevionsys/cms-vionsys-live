'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ExternalLink, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export type ContentStatus = 'PUBLISHED' | 'DRAFT' | 'SCHEDULED' | 'ARCHIVED';

export interface ContentRow {
  id: string;
  title: string;
  status: ContentStatus;
  /** Lower-cased text the search box matches against. */
  searchText: string;
  editHref: string;
  /** Live page for published items, preview for everything else. */
  view: { href: string; label: string; external: boolean };
}

export interface ContentColumn<T extends ContentRow> {
  key: string;
  header: string;
  className?: string;
  /** Let long values wrap onto more lines instead of being cut off with "…". */
  wrap?: boolean;
  cell: (row: T) => React.ReactNode;
}

interface ContentTableProps<T extends ContentRow> {
  rows: T[];
  columns: ContentColumn<T>[];
  noun: { one: string; many: string };
  newHref: string;
  newLabel: string;
  /** API endpoint for one item, e.g. (id) => `/api/cms/blogs/${id}` */
  deleteEndpoint: (id: string) => string;
  initialStatus?: ContentStatus | 'ALL';
}

const STATUS_TABS: { value: ContentStatus | 'ALL'; label: string; alwaysShow: boolean }[] = [
  { value: 'ALL', label: 'All', alwaysShow: true },
  { value: 'PUBLISHED', label: 'Published', alwaysShow: true },
  { value: 'DRAFT', label: 'Drafts', alwaysShow: true },
  { value: 'SCHEDULED', label: 'Scheduled', alwaysShow: false },
  { value: 'ARCHIVED', label: 'Archived', alwaysShow: false },
];

const STATUS_BADGE: Record<ContentStatus, { label: string; className: string }> = {
  PUBLISHED: { label: 'Published', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-brand-50 text-brand-700 ring-brand-200' },
  ARCHIVED: { label: 'Archived', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.8125rem] whitespace-nowrap ring-1 ${badge.className}`}>
      {badge.label}
    </span>
  );
}

export function ContentTable<T extends ContentRow>({
  rows,
  columns,
  noun,
  newHref,
  newLabel,
  deleteEndpoint,
  initialStatus = 'ALL',
}: ContentTableProps<T>) {
  const router = useRouter();
  const [status, setStatus] = useState<ContentStatus | 'ALL'>(initialStatus);
  const [query, setQuery] = useState('');
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: rows.length };
    for (const row of rows) result[row.status] = (result[row.status] ?? 0) + 1;
    return result;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (row) => (status === 'ALL' || row.status === status) && (!q || row.searchText.includes(q))
    );
  }, [rows, status, query]);

  // Only rows that are currently visible count as selected (filters can hide earlier picks).
  const selectedIds = useMemo(() => {
    const visible = new Set(visibleRows.map((r) => r.id));
    return pickedIds.filter((id) => visible.has(id));
  }, [pickedIds, visibleRows]);

  const allSelected = visibleRows.length > 0 && selectedIds.length === visibleRows.length;
  const someSelected = selectedIds.length > 0 && !allSelected;
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = () => setPickedIds(allSelected ? [] : visibleRows.map((r) => r.id));
  const toggleOne = (id: string) =>
    setPickedIds(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const label = (count: number) => `${count} ${count === 1 ? noun.one : noun.many}`;

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setError(null);

    const results = await Promise.all(
      pendingDelete.map(async (id) => {
        try {
          const res = await fetch(deleteEndpoint(id), { method: 'DELETE' });
          const body = await res.json().catch(() => null);
          return res.ok && body?.success !== false
            ? null
            : body?.error?.message || `Request failed (${res.status}).`;
        } catch {
          return 'Network error.';
        }
      })
    );

    const failures = results.filter((r): r is string => r !== null);
    if (failures.length > 0) {
      setError(`Couldn't delete ${label(failures.length)}: ${failures[0]}`);
    }

    setIsDeleting(false);
    setPendingDelete(null);
    setPickedIds([]);
    router.refresh();
  };

  const hasFilters = status !== 'ALL' || query.trim() !== '';
  const tabs = STATUS_TABS.filter((tab) => tab.alwaysShow || (counts[tab.value] ?? 0) > 0);

  return (
    <div className="space-y-3">
      {/* Toolbar: status filter, search, primary action */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="group"
          aria-label={`Filter ${noun.many} by status`}
          className="inline-flex w-fit rounded-lg bg-slate-100 p-1"
        >
          {tabs.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(tab.value)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${focusRing} ${
                  active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
                <span className={active ? 'text-slate-500' : 'text-slate-400'}>{counts[tab.value] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun.many}`}
              aria-label={`Search ${noun.many}`}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400"
            />
          </div>
          <Link
            href={newHref}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs text-white shadow-sm transition-colors hover:bg-brand-700 active-press ${focusRing}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {newLabel}
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className={`cursor-pointer rounded p-0.5 text-rose-700 hover:bg-rose-100 ${focusRing}`}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-4 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs">
            <span className="text-brand-800">{label(selectedIds.length)} selected</span>
            <button
              type="button"
              onClick={() => setPendingDelete(selectedIds)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-rose-700 hover:bg-rose-50 ${focusRing}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setPickedIds([])}
              className={`cursor-pointer rounded-md px-2 py-1 text-slate-600 hover:bg-white ${focusRing}`}
            >
              Clear selection
            </button>
          </div>
        )}

        {visibleRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            {rows.length === 0 ? (
              <>
                <p className="text-sm text-slate-500">No {noun.many} yet.</p>
                <Link
                  href={newHref}
                  className={`inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700 ${focusRing}`}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {newLabel}
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500">
                  No {noun.many} match {query.trim() ? `“${query.trim()}”` : 'this filter'}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatus('ALL');
                  }}
                  className={`cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ${focusRing}`}
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs text-slate-600">
                  <th scope="col" className="w-10 py-3 pr-2 pl-4">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={`Select all ${label(visibleRows.length)}`}
                      className="h-4 w-4 cursor-pointer accent-brand-600"
                    />
                  </th>
                  <th scope="col" className="w-full px-3 py-3 font-medium">Title</th>
                  {columns.map((col) => (
                    <th key={col.key} scope="col" className={`px-3 py-3 font-medium whitespace-nowrap ${col.className ?? ''}`}>
                      {col.header}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row) => {
                  const checked = selectedIds.includes(row.id);
                  return (
                    <tr key={row.id} className={`transition-colors ${checked ? 'bg-brand-50/60' : 'even:bg-slate-50/50 hover:bg-brand-50/40'}`}>
                      <td className="py-2.5 pr-2 pl-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(row.id)}
                          aria-label={`Select “${row.title || 'Untitled'}”`}
                          className="h-4 w-4 cursor-pointer accent-brand-600"
                        />
                      </td>
                      <td className="w-full max-w-0 px-3 py-2.5">
                        <Link
                          href={row.editHref}
                          className={`block truncate rounded text-xs font-medium text-slate-900 hover:text-brand-700 hover:underline ${focusRing} ${
                            row.title.trim() ? '' : 'italic text-slate-500'
                          }`}
                        >
                          {row.title.trim() || 'Untitled'}
                        </Link>
                      </td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 text-slate-600 ${
                            col.wrap ? 'min-w-40 max-w-64 break-words' : 'max-w-48 truncate whitespace-nowrap'
                          } ${col.className ?? ''}`}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-0.5">
                          <RowAction
                            href={row.view.href}
                            label={row.view.label}
                            external={row.view.external}
                            icon={row.view.external ? ExternalLink : Eye}
                          />
                          <RowAction href={row.editHref} label="Edit" icon={Pencil} />
                          <button
                            type="button"
                            onClick={() => setPendingDelete([row.id])}
                            aria-label={`Delete “${row.title || 'Untitled'}”`}
                            title="Delete"
                            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visibleRows.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-500">
            {hasFilters ? `Showing ${visibleRows.length} of ${label(rows.length)}` : label(rows.length)}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={pendingDelete && pendingDelete.length > 1 ? `Delete ${label(pendingDelete.length)}?` : `Delete this ${noun.one}?`}
        message={`This removes it from the CMS, and from vionsys.com if it is live. Visitors to a live URL are redirected to the ${noun.many} list. This can't be undone.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        isDanger
        isBusy={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function RowAction({
  href,
  label,
  icon: Icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  external?: boolean;
}) {
  const className = `inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:shadow-sm hover:text-slate-900 ${focusRing}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} title={label} className={className}>
        <Icon className="h-4 w-4" aria-hidden />
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} title={label} className={className}>
      <Icon className="h-4 w-4" aria-hidden />
    </Link>
  );
}
