import React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type {
  ActivityItem,
  ContentKind,
  DashboardData,
  DraftItem,
  PublishedItem,
} from '@/features/dashboard/dashboard.service';
import { formatDate, formatRelativeTime, getGreeting } from '@/lib/format-date';
import { getBlogLiveUrl, getCaseStudyLiveUrl } from '@/lib/frontend-urls';

/*
 * Dashboard for writers and editors. Answers two questions:
 *   1. What should I work on next?  → drafts with their publish readiness
 *   2. What is live right now?      → counts, recently published, activity
 * Server-rendered only (no client JS), so relative times never cause hydration mismatches.
 */

const KIND: Record<ContentKind, { label: string; icon: LucideIcon; editPath: string }> = {
  blog: { label: 'Blog post', icon: FileText, editPath: '/blogs' },
  'case-study': { label: 'Case study', icon: Briefcase, editPath: '/case-studies' },
};

const editHref = (kind: ContentKind, id: string) => `${KIND[kind].editPath}/${id}/edit`;
const liveHref = (kind: ContentKind, slug: string) =>
  kind === 'blog' ? getBlogLiveUrl(slug) : getCaseStudyLiveUrl(slug);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

interface DashboardViewProps {
  data: DashboardData;
  userName: string;
}

export function DashboardView({ data, userName }: DashboardViewProps) {
  const now = new Date();
  const live = data.blogs.published + data.caseStudies.published;
  const readyCount = data.drafts.filter((d) => d.missing.length === 0).length;

  const summary = [
    live > 0
      ? `${plural(live, 'piece is', 'pieces are')} live on vionsys.com.`
      : 'Nothing is live on vionsys.com yet.',
    data.draftTotal > 0
      ? `${plural(data.draftTotal, 'draft is', 'drafts are')} in progress${
          readyCount > 0 ? `, and ${readyCount} ${readyCount === 1 ? 'is' : 'are'} ready to publish` : ''
        }.`
      : 'No drafts in progress.',
  ].join(' ');

  return (
    <div className="w-full space-y-5">
      <header className="space-y-0.5">
        <h2 className="text-2xl text-slate-900 tracking-tight">
          {getGreeting(now)}, {userName}
        </h2>
        <p className="text-sm text-slate-600">{summary}</p>
      </header>

      <ContentOverview data={data} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <DraftQueue drafts={data.drafts} total={data.draftTotal} now={now} />
          <RecentlyPublished items={data.recentlyPublished} />
        </div>
        <ActivityFeed items={data.activity} now={now} />
      </div>
    </div>
  );
}

// --- Overview -----------------------------------------------------------------

interface OverviewPart {
  label: string;
  value: number;
  /** Swatch + bar colour. One hue (brand blue); "published" is the emphasised part. */
  color: string;
}

function ContentOverview({ data }: { data: DashboardData }) {
  const tiles: { label: string; icon: LucideIcon; href: string; parts: OverviewPart[] }[] = [
    {
      label: 'Blog posts',
      icon: FileText,
      href: '/blogs',
      parts: [
        { label: 'published', value: data.blogs.published, color: 'bg-brand-600' },
        { label: data.blogs.drafts === 1 ? 'draft' : 'drafts', value: data.blogs.drafts, color: 'bg-brand-200' },
        ...(data.blogs.scheduled > 0
          ? [{ label: 'scheduled', value: data.blogs.scheduled, color: 'bg-brand-400' }]
          : []),
        ...(data.blogs.archived > 0
          ? [{ label: 'archived', value: data.blogs.archived, color: 'bg-slate-300' }]
          : []),
      ],
    },
    {
      label: 'Case studies',
      icon: Briefcase,
      href: '/case-studies',
      parts: [
        { label: 'published', value: data.caseStudies.published, color: 'bg-brand-600' },
        {
          label: data.caseStudies.drafts === 1 ? 'draft' : 'drafts',
          value: data.caseStudies.drafts,
          color: 'bg-brand-200',
        },
      ],
    },
  ];

  return (
    <section aria-label="Content overview" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {tiles.map((tile) => {
        const total = tile.parts.reduce((sum, part) => sum + part.value, 0);
        const visibleParts = tile.parts.filter((part) => part.value > 0);
        const summary = tile.parts.map((part) => `${part.value} ${part.label}`).join(', ');

        return (
          <Link
            key={tile.label}
            href={tile.href}
            className={`group block rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30 ${focusRing}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <tile.icon className="h-4 w-4" aria-hidden />
                </span>
                {tile.label}
              </div>
              <span className="text-xs text-brand-600 group-hover:underline">View all</span>
            </div>

            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl leading-none text-slate-900">{total}</span>
              <span className="text-xs text-slate-500">in total</span>
            </p>

            {/* Thin segmented bar: published vs the rest. Text below carries the figures. */}
            <div
              role="img"
              aria-label={`${tile.label}: ${summary}`}
              className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100"
            >
              {visibleParts.map((part) => (
                <span
                  key={part.label}
                  className={`h-full rounded-full ${part.color}`}
                  style={{ width: `${(part.value / total) * 100}%` }}
                />
              ))}
            </div>

            <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
              {tile.parts.map((part) => (
                <li key={part.label} className="flex items-center gap-1.5">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${part.color}`} />
                  <span className="text-slate-900">{part.value}</span> {part.label}
                </li>
              ))}
            </ul>
          </Link>
        );
      })}
    </section>
  );
}

// --- Panels -------------------------------------------------------------------

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = `panel-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
        <h3 id={id} className="text-base text-slate-900">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-6 text-center text-sm text-slate-500">{children}</div>;
}

function KindIcon({ kind }: { kind: ContentKind }) {
  const Icon = KIND[kind].icon;
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  );
}

// --- Drafts ---------------------------------------------------------------------

function DraftQueue({ drafts, total, now }: { drafts: DraftItem[]; total: number; now: Date }) {
  return (
    <Panel
      title="Continue working"
      aside={
        total > drafts.length ? (
          <span className="text-xs text-slate-500">
            Showing {drafts.length} of {total} drafts
          </span>
        ) : null
      }
    >
      {drafts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-6 text-center">
          <p className="text-sm text-slate-500">Nothing in progress. What would you like to write?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/blogs/new"
              className={`inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm transition-colors hover:bg-brand-700 active-press ${focusRing}`}
            >
              <FileText className="h-4 w-4" aria-hidden />
              New blog post
            </Link>
            <Link
              href="/case-studies/new"
              className={`inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 active-press ${focusRing}`}
            >
              <Briefcase className="h-4 w-4 text-slate-500" aria-hidden />
              New case study
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {drafts.map((draft) => (
            <li key={`${draft.kind}-${draft.id}`}>
              <Link
                href={editHref(draft.kind, draft.id)}
                className={`flex gap-3 px-5 py-3 transition-colors hover:bg-slate-50 ${focusRing} focus-visible:-outline-offset-2`}
              >
                <KindIcon kind={draft.kind} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className={`truncate text-sm ${draft.title.trim() ? 'text-slate-900' : 'italic text-slate-500'}`}>
                      {draft.title.trim() || 'Untitled draft'}
                    </p>
                    <ReadinessBadge missing={draft.missing} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {KIND[draft.kind].label}, edited {formatRelativeTime(draft.updatedAt, now)}
                    {draft.authorName ? ` by ${draft.authorName}` : ''}
                  </p>
                  {draft.missing.length > 0 && (
                    <p className="text-xs text-amber-800">Still needed: {draft.missing.join(', ')}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReadinessBadge({ missing }: { missing: string[] }) {
  if (missing.length === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Ready to publish
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {missing.length} to fix
    </span>
  );
}

// --- Recently published ---------------------------------------------------------

function RecentlyPublished({ items }: { items: PublishedItem[] }) {
  return (
    <Panel title="Recently published">
      {items.length === 0 ? (
        <EmptyState>Nothing is live yet. Published blog posts and case studies appear here.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 px-5 py-2.5">
              <KindIcon kind={item.kind} />
              <div className="min-w-0 flex-1">
                <Link
                  href={editHref(item.kind, item.id)}
                  className={`block truncate rounded text-sm text-slate-900 hover:text-brand-700 hover:underline ${focusRing}`}
                >
                  {item.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {KIND[item.kind].label}, published {formatDate(item.publishedAt)}
                </p>
              </div>
              <a
                href={liveHref(item.kind, item.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${focusRing}`}
              >
                View on site
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// --- Activity -------------------------------------------------------------------

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ActivityFeed({ items, now }: { items: ActivityItem[]; now: Date }) {
  return (
    <Panel title="Recent activity">
      {items.length === 0 ? (
        <EmptyState>Changes to blog posts and case studies appear here.</EmptyState>
      ) : (
        <ul className="space-y-3 px-5 py-3">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600"
              >
                {initials(item.userName)}
              </span>
              <div className="min-w-0 space-y-0.5 text-sm leading-snug text-slate-700">
                <p>
                  <span className="text-slate-900">{item.userName}</span> {item.verb}
                  {item.title ? (
                    <>
                      {item.entity ? ` ${item.entity} ` : ' '}
                      {item.href ? (
                        <Link href={item.href} className={`rounded text-brand-600 hover:underline ${focusRing}`}>
                          “{item.title}”
                        </Link>
                      ) : (
                        <span className="text-slate-900">“{item.title}”</span>
                      )}
                    </>
                  ) : item.entity ? (
                    <>
                      {' '}
                      {item.href ? (
                        <Link href={item.href} className={`rounded text-brand-600 hover:underline ${focusRing}`}>
                          an untitled {item.entity}
                        </Link>
                      ) : (
                        `a ${item.entity}`
                      )}
                    </>
                  ) : null}
                  {item.repeat > 1 && item.verb === 'edited' ? (
                    <span className="text-slate-500"> ({item.repeat} saves)</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500">{formatRelativeTime(item.createdAt, now)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
