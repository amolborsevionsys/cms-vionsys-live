import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  contentMetaInputShape,
  contentStatusSchema,
  jsonValue,
  optionalString,
} from '../shared/content-input.validation';

export const blogFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-_]+$/, 'Slug can only contain lowercase letters, numbers, hyphens, and underscores'),
  excerpt: z.string().max(160, 'Excerpt cannot exceed 160 characters'),
  featuredImage: z.string().nullable().optional(),
  featuredImageAlt: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  isFeatured: z.boolean().default(false),
  guestAuthor: z.string().nullable().optional(),
  internalNote: z.string().nullable().optional(),
  serviceIds: z.array(z.string()).default([]),
  caseStudyIds: z.array(z.string()).default([]),
  contentBriefUrl: z.string().url('Must be a valid URL').or(z.literal('')).nullable().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  scheduledAt: z.string().nullable().optional()
});

export type BlogFormInput = z.infer<typeof blogFormSchema>;

// ---------------------------------------------------------------------------
// API request schemas (server-side). See features/shared/content-input.validation.ts
// for why these check types only and do not repeat the form's editorial limits.
// ---------------------------------------------------------------------------

const blogInputShape = {
  title: z.string(),
  slug: optionalString,
  excerpt: optionalString,
  featuredImage: optionalString,
  featuredImageAlt: optionalString,
  categoryId: optionalString,
  isFeatured: z.boolean(),
  guestAuthor: optionalString,
  internalNote: optionalString,
  serviceIds: z.array(z.string()),
  caseStudyIds: z.array(z.string()),
  contentBriefUrl: optionalString,
  status: contentStatusSchema,
  contentHtml: z.string(),
  contentJson: jsonValue,
  ...contentMetaInputShape,
};

/** POST /api/cms/blogs */
export const blogCreateApiSchema = z.object({
  ...blogInputShape,
  isFeatured: blogInputShape.isFeatured.default(false),
  serviceIds: blogInputShape.serviceIds.default([]),
  caseStudyIds: blogInputShape.caseStudyIds.default([]),
  status: blogInputShape.status.default('DRAFT'),
  contentHtml: blogInputShape.contentHtml.default(''),
  contentJson: z.custom<Prisma.InputJsonValue>().optional().transform((v) => v ?? {}),
});

/** PUT /api/cms/blogs/:id. Every field optional, no defaults (missing = unchanged). */
export const blogUpdateApiSchema = z.object(blogInputShape).partial();

export type BlogCreateApiInput = z.infer<typeof blogCreateApiSchema>;
export type BlogUpdateApiInput = z.infer<typeof blogUpdateApiSchema>;
