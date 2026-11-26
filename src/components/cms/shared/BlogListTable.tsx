'use client';

import React from 'react';
import {
  ContentStatusBadge,
  ContentTable,
  type ContentColumn,
  type ContentRow,
  type ContentStatus,
} from '../content-list/ContentTable';
import { getBlogLiveUrl, isPublishedContent } from '@/lib/frontend-urls';
import { formatDate } from '@/lib/format-date';

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt?: string | Date | null;
  updatedAt: string | Date;
  category: { name: string } | null;
  author: { name: string } | null;
}

type BlogRow = ContentRow & { category: string; author: string; updatedAt: string | Date };

const columns: ContentColumn<BlogRow>[] = [
  { key: 'status', header: 'Status', cell: (row) => <ContentStatusBadge status={row.status} /> },
  { key: 'category', header: 'Category', className: 'hidden lg:table-cell', cell: (row) => row.category },
  { key: 'author', header: 'Author', className: 'hidden xl:table-cell', cell: (row) => row.author },
  {
    key: 'updated',
    header: 'Last updated',
    className: 'hidden md:table-cell whitespace-nowrap',
    cell: (row) => formatDate(row.updatedAt),
  },
];

interface BlogListTableProps {
  posts: BlogListItem[];
  initialStatus?: ContentStatus | 'ALL';
}

export function BlogListTable({ posts, initialStatus }: BlogListTableProps) {
  const rows: BlogRow[] = posts.map((post) => {
    const category = post.category?.name ?? 'Uncategorized';
    const author = post.author?.name ?? '—';
    const isLive = isPublishedContent(post.status, post.publishedAt);
    return {
      id: post.id,
      title: post.title,
      status: (post.status as ContentStatus) ?? 'DRAFT',
      searchText: `${post.title} ${post.slug} ${category} ${author}`.toLowerCase(),
      editHref: `/blogs/${post.id}/edit`,
      view: isLive
        ? { href: getBlogLiveUrl(post.slug), label: 'View on vionsys.com', external: true }
        : { href: `/blogs/${post.id}/preview`, label: 'Preview draft', external: false },
      category,
      author,
      updatedAt: post.updatedAt,
    };
  });

  return (
    <ContentTable
      rows={rows}
      columns={columns}
      noun={{ one: 'blog post', many: 'blog posts' }}
      newHref="/blogs/new"
      newLabel="New blog post"
      deleteEndpoint={(id) => `/api/cms/blogs/${id}`}
      initialStatus={initialStatus}
    />
  );
}

export default BlogListTable;
