import { AppError } from '@/lib/errors';

export interface ValidationIssue {
  type: 'blocker' | 'warning';
  message: string;
  field?: string;
}

/**
 * The state of a document at the moment it is about to go live.
 * Built by the blog / case-study services from the saved record.
 */
export interface PublishCandidate {
  contentType: 'blog' | 'case-study';
  title: string | null | undefined;
  slug: string | null | undefined;
  seoTitle: string | null | undefined;
  seoDescription: string | null | undefined;
  imageUrl: string | null | undefined;
  imageAlt: string | null | undefined;
  /** Case studies only. */
  clientName?: string | null;
  /** Case studies only. */
  resultStatsCount?: number;
}

const isBlank = (value: string | null | undefined) => !value || value.trim() === '';

/**
 * Server-side publish checklist (rule.md 7.11).
 *
 * Mirrors the blockers in components/cms/editor/PublishPanel.tsx exactly, so
 * anything the editor UI lets you publish is also accepted here. The server copy
 * exists so the API cannot be used to bypass the checklist.
 */
export class PublishService {
  static getBlockers(candidate: PublishCandidate): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const blocker = (message: string, field: string) => issues.push({ type: 'blocker', message, field });

    if (isBlank(candidate.title)) blocker('Title is missing or empty.', 'title');
    if (isBlank(candidate.slug)) blocker('URL Slug is missing or empty.', 'slug');
    if (isBlank(candidate.seoTitle)) blocker('SEO Meta Title is empty.', 'seo.title');
    if (isBlank(candidate.seoDescription)) blocker('SEO Meta Description is empty.', 'seo.description');

    if (candidate.imageUrl && isBlank(candidate.imageAlt)) {
      blocker(
        candidate.contentType === 'blog'
          ? 'Featured image is missing Alt text.'
          : 'Hero image is missing Alt text.',
        'featuredImageAlt'
      );
    }

    if (candidate.contentType === 'case-study') {
      if (isBlank(candidate.clientName)) blocker('Client Name is required.', 'clientName');
      if ((candidate.resultStatsCount ?? 0) < 2) {
        blocker('Case study needs at least 2 metrics.', 'resultStats');
      }
    }

    return issues;
  }

  /** Throws 422 PUBLISH_BLOCKED (with the issue list in `details`) if any blocker is found. */
  static assertPublishable(candidate: PublishCandidate): void {
    const blockers = this.getBlockers(candidate);
    if (blockers.length > 0) {
      throw new AppError(
        `Cannot publish yet. Your changes were saved as a draft. Fix: ${blockers.map((b) => b.message).join(' ')}`,
        'PUBLISH_BLOCKED',
        422,
        blockers
      );
    }
  }
}
