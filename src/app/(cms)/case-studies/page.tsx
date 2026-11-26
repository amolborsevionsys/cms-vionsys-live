import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuthPage } from '@/features/auth/require-auth';
import { CmsShell } from '@/components/cms/layout/CmsShell';
import { CaseStudyListTable } from '@/components/cms/shared/CaseStudyListTable';
import { parseStatusParam } from '@/lib/list-filters';

interface CaseStudiesListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CaseStudiesListPage({ searchParams }: CaseStudiesListPageProps) {
  await requireAuthPage();
  const { status } = await searchParams;

  // Select only what the table shows: never send full user records to the client.
  const caseStudies = await prisma.caseStudy.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      clientName: true,
      industry: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { resultStats: true } },
    },
  });

  return (
    <CmsShell>
      <CaseStudyListTable
        caseStudies={caseStudies.map(({ _count, ...cs }) => ({ ...cs, metricCount: _count.resultStats }))}
        initialStatus={parseStatusParam(status)}
      />
    </CmsShell>
  );
}

export const dynamic = 'force-dynamic';
