import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  contentMetaInputShape,
  contentStatusSchema,
  jsonValue,
  optionalString,
} from '../shared/content-input.validation';

export const resultStatSchema = z.object({
  value: z.string().min(1, 'Stat value is required (e.g. "+150%")'),
  label: z.string().min(1, 'Stat label is required (e.g. "Lead conversion")'),
  description: z.string().max(250, 'Stat description cannot exceed 250 characters').default('')
});

export const processStepSchema = z.object({
  title: z.string().min(1, 'Step title is required'),
  description: z.string().min(1, 'Step description is required'),
  icon: z.string().nullable().optional(),
  position: z.number().default(0)
});

export const mediaGalleryItemSchema = z.object({
  imagePath: z.string().min(1, 'Image path is required'),
  caption: z.string().nullable().optional(),
  alt: z.string().nullable().optional(),
  position: z.number().default(0)
});

export const caseStudyFaqSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required')
});

export const caseStudyFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  slug: z.string().min(1, 'Slug is required').regex(/^[a-z0-9-_]+$/, 'Slug can only contain lowercase letters, numbers, hyphens, and underscores'),
  clientName: z.string().min(1, 'Client name is required'),
  clientLogo: z.string().nullable().optional(),
  industry: z.string().min(1, 'Industry is required'),
  engagementType: z.enum(['PROJECT', 'RETAINER', 'STAFF_AUGMENTATION', 'PRODUCT_BUILD']).default('PROJECT'),
  heroImage: z.string().nullable().optional(),
  heroImageAlt: z.string().nullable().optional(),
  excerpt: z.string().max(160, 'Excerpt cannot exceed 160 characters'),
  isFeatured: z.boolean().default(false),
  showMetricsOnTop: z.boolean().default(false),
  serviceIds: z.array(z.string()).default([]),
  blogPostIds: z.array(z.string()).default([]),
  internalNote: z.string().nullable().optional(),
  
  // Testimonial
  testimonialQuote: z.string().nullable().optional(),
  testimonialName: z.string().nullable().optional(),
  testimonialDesignation: z.string().nullable().optional(),
  testimonialCompany: z.string().nullable().optional(),
  testimonialImage: z.string().nullable().optional(),

  // CTA
  ctaHeading: z.string().nullable().optional(),
  ctaBody: z.string().nullable().optional(),
  ctaButtonLabel: z.string().nullable().optional(),
  ctaButtonUrl: z.string().nullable().optional(),

  // Arrays
  resultStats: z.array(resultStatSchema).default([]),
  processSteps: z.array(processStepSchema).default([]),
  mediaGallery: z.array(mediaGalleryItemSchema).default([]),
  faqs: z.array(caseStudyFaqSchema).default([])
});

export type CaseStudyFormInput = z.infer<typeof caseStudyFormSchema>;

// ---------------------------------------------------------------------------
// API request schemas (server-side). See features/shared/content-input.validation.ts
// for why these check types only and do not repeat the form's editorial limits.
// ---------------------------------------------------------------------------

const resultStatInput = z.object({
  value: z.string().default(''),
  label: z.string().default(''),
  description: z.string().nullish(),
});

const processStepInput = z.object({
  title: z.string().default(''),
  description: z.string().default(''),
  icon: z.string().nullish(),
});

const mediaGalleryItemInput = z.object({
  imagePath: z.string().default(''),
  caption: z.string().nullish(),
  alt: z.string().nullish(),
});

const caseStudyFaqInput = z.object({
  question: z.string().default(''),
  answer: z.string().default(''),
});

const caseStudyInputShape = {
  title: z.string(),
  slug: optionalString,
  clientName: z.string(),
  clientLogo: optionalString,
  industry: z.string(),
  engagementType: z.enum(['PROJECT', 'RETAINER', 'STAFF_AUGMENTATION', 'PRODUCT_BUILD']),
  heroImage: optionalString,
  heroImageAlt: optionalString,
  excerpt: optionalString,
  isFeatured: z.boolean(),
  showMetricsOnTop: z.boolean(),
  serviceIds: z.array(z.string()),
  blogPostIds: z.array(z.string()),
  internalNote: optionalString,

  testimonialQuote: optionalString,
  testimonialName: optionalString,
  testimonialDesignation: optionalString,
  testimonialCompany: optionalString,
  testimonialImage: optionalString,

  ctaHeading: optionalString,
  ctaBody: optionalString,
  ctaButtonLabel: optionalString,
  ctaButtonUrl: optionalString,

  resultStats: z.array(resultStatInput),
  processSteps: z.array(processStepInput),
  mediaGallery: z.array(mediaGalleryItemInput),
  faqs: z.array(caseStudyFaqInput),

  challengeHtml: z.string(),
  challengeJson: jsonValue,
  approachHtml: z.string(),
  approachJson: jsonValue,

  // Case studies are "published" when publishedAt is set; DRAFT/ARCHIVED do not unpublish.
  status: contentStatusSchema,
  ...contentMetaInputShape,
};

/** POST /api/cms/case-studies */
export const caseStudyCreateApiSchema = z.object({
  ...caseStudyInputShape,
  clientName: caseStudyInputShape.clientName.default(''),
  industry: caseStudyInputShape.industry.default(''),
  engagementType: caseStudyInputShape.engagementType.default('PROJECT'),
  isFeatured: caseStudyInputShape.isFeatured.default(false),
  showMetricsOnTop: caseStudyInputShape.showMetricsOnTop.default(false),
  serviceIds: caseStudyInputShape.serviceIds.default([]),
  blogPostIds: caseStudyInputShape.blogPostIds.default([]),
  resultStats: caseStudyInputShape.resultStats.default([]),
  processSteps: caseStudyInputShape.processSteps.default([]),
  mediaGallery: caseStudyInputShape.mediaGallery.default([]),
  faqs: caseStudyInputShape.faqs.default([]),
  challengeHtml: caseStudyInputShape.challengeHtml.default(''),
  challengeJson: z.custom<Prisma.InputJsonValue>().optional().transform((v) => v ?? {}),
  approachHtml: caseStudyInputShape.approachHtml.default(''),
  approachJson: z.custom<Prisma.InputJsonValue>().optional().transform((v) => v ?? {}),
  status: caseStudyInputShape.status.default('DRAFT'),
});

/** PUT /api/cms/case-studies/:id. Every field optional, no defaults (missing = unchanged). */
export const caseStudyUpdateApiSchema = z.object(caseStudyInputShape).partial();

export type CaseStudyCreateApiInput = z.infer<typeof caseStudyCreateApiSchema>;
export type CaseStudyUpdateApiInput = z.infer<typeof caseStudyUpdateApiSchema>;

