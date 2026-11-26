import { prisma } from '@/lib/prisma';

export type ContentKind = 'blog' | 'case-study';

export interface DraftItem {
  id: string;
  kind: ContentKind;
  title: string;
  updatedAt: Date;
  authorName: string | null;
  /** Plain-language list of what still blocks publishing. Empty = ready. */
  missing: string[];
}

export interface PublishedItem {
  id: string;
  kind: ContentKind;
  title: string;
  slug: string;
  publishedAt: Date;
}

export interface ActivityItem {
  id: string;
  userName: string;
  verb: string;
  entity: string | null;
  title: string | null;
  /** Edit page for the item, when it still exists. */
  href: string | null;
  createdAt: Date;
  /** How many consecutive identical entries were folded into this one (autosave). */
  repeat: number;
}

export interface DashboardData {
  blogs: { published: number; drafts: number; scheduled: number; archived: number };
  caseStudies: { published: number; drafts: number };
  drafts: DraftItem[];
  draftTotal: number;
  recentlyPublished: PublishedItem[];
  activity: ActivityItem[];
}

const isBlank = (value: string | null | undefined) => !value || value.trim() === '';

/**
 * Publish readiness. Mirrors the blockers in components/cms/editor/PublishPanel.tsx
 * so the dashboard and the editor never disagree about what "ready" means.
 */
function getMissing(input: {
  kind: ContentKind;
  title: string;
  slug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  clientName?: string | null;
  resultStats?: number;
}): string[] {
  const missing: string[] = [];
  if (isBlank(input.title)) missing.push('title');
  if (isBlank(input.slug)) missing.push('URL slug');
  if (isBlank(input.seoTitle)) missing.push('meta title');
  if (isBlank(input.seoDescription)) missing.push('meta description');
  if (input.image && isBlank(input.imageAlt)) missing.push('image alt text');
  if (input.kind === 'case-study') {
    if (isBlank(input.clientName)) missing.push('client name');
    if ((input.resultStats ?? 0) < 2) missing.push('at least 2 result metrics');
  }
  return missing;
}

// --- Activity log -----------------------------------------------------------

const ENTITY_LABELS: Record<string, string> = {
  BLOG: 'blog post',
  CASE_STUDY: 'case study',
  CATEGORY: 'category',
  MEDIA: 'media file',
};

const VERB_LABELS: Record<string, string> = {
  CREATE: 'created',
  UPDATE: 'edited',
  DELETE: 'deleted',
  PUBLISH: 'published',
  ARCHIVE: 'archived',
};

/** Turns `BLOG_UPDATE` + `Updated blog post: "Title" (uuid)` into a readable sentence. */
function describeLog(action: string, details: string | null) {
  const verbKey = action.split('_').pop() ?? '';
  const entityKey = action.slice(0, Math.max(action.length - verbKey.length - 1, 0));

  const verb = VERB_LABELS[verbKey] ?? action.toLowerCase().replace(/_/g, ' ');
  const entity = ENTITY_LABELS[entityKey] ?? null;
  const title = details?.match(/"(.+)"/)?.[1] ?? null;
  const id = details?.match(/\(([0-9a-f-]{36})\)/i)?.[1] ?? null;

  let href: string | null = null;
  if (id && verbKey !== 'DELETE') {
    if (entityKey === 'BLOG') href = `/blogs/${id}/edit`;
    if (entityKey === 'CASE_STUDY') href = `/case-studies/${id}/edit`;
  }

  return { verb, entity, title, href };
}

// --- Main query ---------------------------------------------------------------

const DRAFT_LIMIT = 6;
const PUBLISHED_LIMIT = 5;
const ACTIVITY_LIMIT = 8;
/** Raw log rows to read so that, after folding autosave repeats, ~8 entries remain. */
const ACTIVITY_SCAN = 80;

export async function getDashboardData(): Promise<DashboardData> {
  const [
    blogStatusCounts,
    caseStudyTotal,
    caseStudyPublished,
    blogDrafts,
    caseStudyDrafts,
    publishedBlogs,
    publishedCaseStudies,
    logs,
  ] = await Promise.all([
    prisma.blogPost.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.caseStudy.count(),
    prisma.caseStudy.count({ where: { publishedAt: { not: null } } }),
    prisma.blogPost.findMany({
      where: { status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      take: DRAFT_LIMIT,
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true,
        featuredImage: true,
        featuredImageAlt: true,
        author: { select: { name: true } },
        seoMeta: { select: { title: true, description: true } },
      },
    }),
    prisma.caseStudy.findMany({
      where: { publishedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: DRAFT_LIMIT,
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true,
        clientName: true,
        heroImage: true,
        heroImageAlt: true,
        author: { select: { name: true } },
        seoMeta: { select: { title: true, description: true } },
        _count: { select: { resultStats: true } },
      },
    }),
    prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: PUBLISHED_LIMIT,
      select: { id: true, title: true, slug: true, publishedAt: true, updatedAt: true },
    }),
    prisma.caseStudy.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: PUBLISHED_LIMIT,
      select: { id: true, title: true, slug: true, publishedAt: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: ACTIVITY_SCAN,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const blogCount = (status: string) =>
    blogStatusCounts.find((row) => row.status === status)?._count._all ?? 0;

  const blogDraftCount = blogCount('DRAFT');
  const caseStudyDraftCount = caseStudyTotal - caseStudyPublished;

  const drafts: DraftItem[] = [
    ...blogDrafts.map((b) => ({
      id: b.id,
      kind: 'blog' as const,
      title: b.title,
      updatedAt: b.updatedAt,
      authorName: b.author?.name ?? null,
      missing: getMissing({
        kind: 'blog',
        title: b.title,
        slug: b.slug,
        seoTitle: b.seoMeta?.title,
        seoDescription: b.seoMeta?.description,
        image: b.featuredImage,
        imageAlt: b.featuredImageAlt,
      }),
    })),
    ...caseStudyDrafts.map((c) => ({
      id: c.id,
      kind: 'case-study' as const,
      title: c.title,
      updatedAt: c.updatedAt,
      authorName: c.author?.name ?? null,
      missing: getMissing({
        kind: 'case-study',
        title: c.title,
        slug: c.slug,
        seoTitle: c.seoMeta?.title,
        seoDescription: c.seoMeta?.description,
        image: c.heroImage,
        imageAlt: c.heroImageAlt,
        clientName: c.clientName,
        resultStats: c._count.resultStats,
      }),
    })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, DRAFT_LIMIT);

  const recentlyPublished: PublishedItem[] = [
    ...publishedBlogs.map((b) => ({
      id: b.id,
      kind: 'blog' as const,
      title: b.title,
      slug: b.slug,
      publishedAt: b.publishedAt ?? b.updatedAt,
    })),
    ...publishedCaseStudies.map((c) => ({
      id: c.id,
      kind: 'case-study' as const,
      title: c.title,
      slug: c.slug,
      publishedAt: c.publishedAt as Date,
    })),
  ]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, PUBLISHED_LIMIT);

  // Fold consecutive identical entries (autosave writes an UPDATE every 30 s).
  const activity: ActivityItem[] = [];
  let previousKey = '';
  for (const log of logs) {
    const key = `${log.userId}|${log.action}|${log.details ?? ''}`;
    if (key === previousKey && activity.length > 0) {
      activity[activity.length - 1].repeat += 1;
      continue;
    }
    if (activity.length === ACTIVITY_LIMIT) break;
    previousKey = key;
    activity.push({
      id: log.id,
      userName: log.user?.name ?? 'Someone',
      createdAt: log.createdAt,
      repeat: 1,
      ...describeLog(log.action, log.details),
    });
  }

  return {
    blogs: {
      published: blogCount('PUBLISHED'),
      drafts: blogDraftCount,
      scheduled: blogCount('SCHEDULED'),
      archived: blogCount('ARCHIVED'),
    },
    caseStudies: { published: caseStudyPublished, drafts: caseStudyDraftCount },
    drafts,
    draftTotal: blogDraftCount + caseStudyDraftCount,
    recentlyPublished,
    activity,
  };
}
