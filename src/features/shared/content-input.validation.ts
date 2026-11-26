import { z } from 'zod';
import type { Prisma } from '@prisma/client';

/**
 * Building blocks for API request validation shared by blogs and case studies
 * (rule.md 6.1).
 *
 * These schemas validate TYPES, not editorial rules. The editor sends the whole
 * document object on every autosave (including read-only keys like id, author,
 * createdAt), so:
 *  - unknown keys are stripped (Zod's default), which also blocks mass-assignment;
 *  - no new required fields or length limits are added, so every save the editor
 *    could make before still succeeds. Editorial rules are enforced at publish time
 *    by PublishService.
 */

export const optionalString = z.string().nullish();

/** Any JSON value (Editor.js output, People-Also-Ask lists, custom schema). */
export const jsonValue = z.custom<Prisma.InputJsonValue>((value) => value !== undefined);

export const contentStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);

export const seoInputSchema = z.object({
  title: optionalString,
  description: optionalString,
  focusKeyword: optionalString,
  secondaryKeywords: z.array(z.string()).nullish(),
  canonicalUrl: optionalString,
  index: z.boolean().optional(),
  follow: z.boolean().optional(),
  ogTitle: optionalString,
  ogDescription: optionalString,
  ogImage: optionalString,
  twitterCardType: optionalString,
});

export const aeoGeoInputSchema = z.object({
  directAnswerPrompt: optionalString,
  snippetCandidate: optionalString,
  peopleAlsoAsk: jsonValue.nullish(),
  semanticSummary: optionalString,
  keyTakeaways: z.array(z.string()).nullish(),
  statsSources: jsonValue.nullish(),
  authorCredibility: optionalString,
  reviewedBy: optionalString,
  allowAiCrawler: z.boolean().optional(),
});

export const schemaSettingsInputSchema = z.object({
  type: optionalString,
  customSchemaJson: jsonValue.nullish(),
});

/** Fields every content type accepts for its SEO / AEO / schema side panels. */
export const contentMetaInputShape = {
  seo: seoInputSchema.nullish(),
  aeoGeo: aeoGeoInputSchema.nullish(),
  schema: schemaSettingsInputSchema.nullish(),
};
