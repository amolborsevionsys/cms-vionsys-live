'use client';

import React from 'react';
import {
  ContentStatusBadge,
  ContentTable,
  type ContentColumn,
  type ContentRow,
  type ContentStatus,
} from '../content-list/ContentTable';
import { getCaseStudyLiveUrl } from '@/lib/frontend-urls';
import { formatDate } from '@/lib/format-date';

export interface CaseStudyListItem {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  industry: string;
  publishedAt: string | Date | null;
  updatedAt: string | Date;
  metricCount: number;
}

type CaseStudyRow = ContentRow & {
  clientName: string;
  industry: string;
  metricCount: number;
  updatedAt: string | Date;
};

const columns: ContentColumn<CaseStudyRow>[] = [
  { key: 'status', header: 'Status', cell: (row) => <ContentStatusBadge status={row.status} /> },
  {
    key: 'client',
    header: 'Client',
    className: 'hidden lg:table-cell',
    wrap: true,
    cell: (row) => row.clientName || <span className="text-slate-400">Not set</span>,
  },
  {
    key: 'industry',
    header: 'Industry',
    className: 'hidden xl:table-cell',
    cell: (row) => row.industry || <span className="text-slate-400">Not set</span>,
  },
  {
    key: 'metrics',
    header: 'Result metrics',
    className: 'hidden xl:table-cell',
    cell: (row) => row.metricCount,
  },
  {
    key: 'updated',
    header: 'Last updated',
    className: 'hidden md:table-cell whitespace-nowrap',
    cell: (row) => formatDate(row.updatedAt),
  },
];

interface CaseStudyListTableProps {
  caseStudies: CaseStudyListItem[];
  initialStatus?: ContentStatus | 'ALL';
}

export function CaseStudyListTable({ caseStudies, initialStatus }: CaseStudyListTableProps) {
  const rows: CaseStudyRow[] = caseStudies.map((cs) => {
    // Case studies have no status column: published = has a publishedAt date.
    const isLive = cs.publishedAt != null;
    return {
      id: cs.id,
      title: cs.title,
      status: isLive ? 'PUBLISHED' : 'DRAFT',
      searchText: `${cs.title} ${cs.slug} ${cs.clientName} ${cs.industry}`.toLowerCase(),
      editHref: `/case-studies/${cs.id}/edit`,
      view: isLive
        ? { href: getCaseStudyLiveUrl(cs.slug), label: 'View on vionsys.com', external: true }
        : { href: `/case-studies/${cs.id}/preview`, label: 'Preview draft', external: false },
      clientName: cs.clientName,
      industry: cs.industry,
      metricCount: cs.metricCount,
      updatedAt: cs.updatedAt,
    };
  });

  return (
    <ContentTable
      rows={rows}
      columns={columns}
      noun={{ one: 'case study', many: 'case studies' }}
      newHref="/case-studies/new"
      newLabel="New case study"
      deleteEndpoint={(id) => `/api/cms/case-studies/${id}`}
      initialStatus={initialStatus}
    />
  );
}

export default CaseStudyListTable;
