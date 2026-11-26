import type { ContentStatus } from '@/components/cms/content-list/ContentTable';

const STATUSES: ContentStatus[] = ['PUBLISHED', 'DRAFT', 'SCHEDULED', 'ARCHIVED'];

/** `?status=draft` → 'DRAFT'. Anything unknown or missing → 'ALL'. */
export function parseStatusParam(value: string | string[] | undefined): ContentStatus | 'ALL' {
  const raw = (Array.isArray(value) ? value[0] : value)?.toUpperCase();
  return STATUSES.includes(raw as ContentStatus) ? (raw as ContentStatus) : 'ALL';
}
