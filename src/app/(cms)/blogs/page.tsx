import React from 'react';
import { prisma } from '@/lib/prisma';
import { requireAuthPage } from '@/features/auth/require-auth';
import { CmsShell } from '@/components/cms/layout/CmsShell';
import { BlogListTable } from '@/components/cms/shared/BlogListTable';
import { parseStatusParam } from '@/lib/list-filters';

interface BlogsListPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlogsListPage({ searchParams }: BlogsListPageProps) {
  await requireAuthPage();
  const { status } = await searchParams;

  // Select only what the table shows: never send full user records to the client.
  const posts = await prisma.blogPost.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      author: { select: { name: true } },
    },
  });

  return (
    <CmsShell>
      <BlogListTable posts={posts} initialStatus={parseStatusParam(status)} />
    </CmsShell>
  );
}

export const dynamic = 'force-dynamic';
