import { ContentStatus, type Prisma } from '@prisma/client';
import { prisma, runTransactionWithRetry } from '@/lib/prisma';
import type { BlogCreateApiInput, BlogUpdateApiInput } from './blog.validation';
import { slugify } from '@/lib/slugify';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { AppError } from '@/lib/errors';
import { BlogMapper } from './blog.mapper';
import { RevalidationService } from '../publishing/revalidation.service';
import { PublishService } from '../publishing/publish.service';
import { assertCanChangeStatus } from '../auth/content-permissions';
import { createDefaultContentMeta } from '@/lib/content-meta';
import {
  hasBlogContentChanged,
  recordBlogVersionHistory,
} from '@/lib/version-history';
import type { SessionPayload } from '@/types/user';

const htmlToText = (html: string) => html.replace(/<\/?[^>]+(>|$)/g, ' ');

export class BlogService {
  static async listBlogs(params: {
    status?: string;
    categoryId?: string;
    authorId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, categoryId, authorId, search, page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BlogPostWhereInput = {};
    if (status && status in ContentStatus) where.status = status as ContentStatus;
    if (categoryId) where.categoryId = categoryId;
    if (authorId) where.authorId = authorId;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          author: true,
          category: true,
          tags: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true,
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      items: items.map(BlogMapper.toAdminJson),
    };
  }

  static async getBlogById(id: string) {
    const blog = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: true,
        category: true,
        tags: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true,
      },
    });

    if (!blog) throw new AppError('Blog post not found', 'NOT_FOUND', 404);
    return BlogMapper.toAdminJson(blog);
  }

  static async getBlogBySlug(slug: string) {
    const blog = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: true,
        category: true,
        tags: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true,
      },
    });

    if (!blog) return null;
    return blog;
  }

  static async createBlog(actor: SessionPayload, input: BlogCreateApiInput) {
    const authorId = actor.userId;
    assertCanChangeStatus(actor.role, 'DRAFT', input.status);

    const contentHtml = sanitizeHtml(input.contentHtml);
    const textContent = htmlToText(contentHtml);
    const finalSlug = input.slug ? slugify(input.slug) : slugify(input.title);

    // Verify slug uniqueness
    const existing = await prisma.blogPost.findUnique({ where: { slug: finalSlug } });
    if (existing) {
      throw new AppError(`Slug "${finalSlug}" is already in use`, 'DUPLICATE_SLUG', 409);
    }

    // Default SEO tags if empty
    const metaTitle = input.title.substring(0, 60);
    const metaDesc = input.excerpt ? input.excerpt.substring(0, 160) : input.title.substring(0, 160);

    if (input.status === 'PUBLISHED') {
      PublishService.assertPublishable({
        contentType: 'blog',
        title: input.title,
        slug: finalSlug,
        seoTitle: metaTitle,
        seoDescription: metaDesc,
        imageUrl: input.featuredImage,
        imageAlt: input.featuredImageAlt,
      });
    }

    const result = await runTransactionWithRetry(async (tx) => {
      const metaIds = await createDefaultContentMeta(tx, {
        title: metaTitle,
        description: metaDesc,
        focusKeyword: input.title.split(' ')[0] || 'vionsys',
        schemaType: 'BlogPosting',
      });

      const blog = await tx.blogPost.create({
        data: {
          title: input.title,
          slug: finalSlug,
          contentJson: input.contentJson,
          contentHtml,
          contentText: textContent,
          excerpt: input.excerpt || '',
          featuredImage: input.featuredImage || null,
          featuredImageAlt: input.featuredImageAlt || null,
          isFeatured: input.isFeatured,
          status: input.status,
          guestAuthor: input.guestAuthor || null,
          internalNote: input.internalNote || null,
          serviceIds: input.serviceIds,
          caseStudyIds: input.caseStudyIds,
          contentBriefUrl: input.contentBriefUrl || null,
          authorId,
          categoryId: input.categoryId || null,
          publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
          seoMetaId: metaIds.seoMetaId,
          aeoGeoMetaId: metaIds.aeoGeoMetaId,
          schemaSettingsId: metaIds.schemaSettingsId,
        },
        include: {
          author: true,
          category: true,
          tags: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: authorId,
          action: 'BLOG_CREATE',
          details: `Created blog post: "${blog.title}" (${blog.id})`,
        },
      });

      return BlogMapper.toAdminJson(blog);
    });

    if (result.status === 'PUBLISHED') {
      await RevalidationService.onBlogChange(result.slug);
    }

    return result;
  }

  static async updateBlog(id: string, actor: SessionPayload, input: BlogUpdateApiInput) {
    const authorId = actor.userId;
    const existing = await prisma.blogPost.findUnique({
      where: { id },
      include: { seoMeta: true },
    });

    if (!existing) {
      throw new AppError('Blog post not found', 'NOT_FOUND', 404);
    }

    assertCanChangeStatus(actor.role, existing.status, input.status);

    const previousSlug = existing.slug;
    const wasPublished = existing.status === 'PUBLISHED';
    // Going live is applied only after the publish checklist passes (see below).
    const isGoingLive = input.status === 'PUBLISHED' && !wasPublished;
    const contentHtml = input.contentHtml !== undefined ? sanitizeHtml(input.contentHtml) : undefined;
    const shouldRecordVersion = hasBlogContentChanged(existing, {
      contentHtml,
      contentJson: input.contentJson,
    });

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.excerpt !== undefined) updates.excerpt = input.excerpt ?? '';
    if (input.featuredImage !== undefined) updates.featuredImage = input.featuredImage;
    if (input.featuredImageAlt !== undefined) updates.featuredImageAlt = input.featuredImageAlt;
    if (input.isFeatured !== undefined) updates.isFeatured = input.isFeatured;
    if (input.status !== undefined && !isGoingLive) updates.status = input.status;
    if (input.guestAuthor !== undefined) updates.guestAuthor = input.guestAuthor;
    if (input.internalNote !== undefined) updates.internalNote = input.internalNote;
    if (input.serviceIds !== undefined) updates.serviceIds = input.serviceIds;
    if (input.caseStudyIds !== undefined) updates.caseStudyIds = input.caseStudyIds;
    if (input.contentBriefUrl !== undefined) updates.contentBriefUrl = input.contentBriefUrl;
    if (input.categoryId !== undefined) updates.categoryId = input.categoryId;

    if (contentHtml !== undefined) {
      updates.contentHtml = contentHtml;
      updates.contentText = htmlToText(contentHtml);
    }
    if (input.contentJson !== undefined) {
      updates.contentJson = input.contentJson;
    }

    // Handle slug change & Redirects
    if (typeof input.slug === 'string' && input.slug !== existing.slug) {
      const finalSlug = slugify(input.slug);
      
      // Verify slug uniqueness
      const isSlugTaken = await prisma.blogPost.findFirst({
        where: { slug: finalSlug, id: { not: id } },
      });
      if (isSlugTaken) {
        throw new AppError(`Slug "${finalSlug}" is already taken`, 'DUPLICATE_SLUG', 409);
      }
      
      updates.slug = finalSlug;

      // If it was already published (or is now being updated as published), generate redirect
      if (existing.status === 'PUBLISHED') {
        const fromPath = `/blog/${existing.slug}`;
        const toPath = `/blog/${finalSlug}`;
        
        await prisma.redirect.upsert({
          where: { fromPath },
          update: { toPath, statusCode: 301 },
          create: { fromPath, toPath, statusCode: 301 },
        });
      }
    }

    await runTransactionWithRetry(async (tx) => {
      const updated = await tx.blogPost.update({
        where: { id },
        data: updates,
        include: {
          author: true,
          category: true,
          tags: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true,
        },
      });

      // Update SEO
      if (input.seo && updated.seoMetaId) {
        await tx.seoMeta.update({
          where: { id: updated.seoMetaId },
          data: {
            title: input.seo.title || updated.title,
            description: input.seo.description || updated.excerpt,
            focusKeyword: input.seo.focusKeyword || '',
            secondaryKeywords: input.seo.secondaryKeywords || [],
            canonicalUrl: input.seo.canonicalUrl || null,
            index: input.seo.index !== undefined ? input.seo.index : true,
            follow: input.seo.follow !== undefined ? input.seo.follow : true,
            ogTitle: input.seo.ogTitle || null,
            ogDescription: input.seo.ogDescription || null,
            ogImage: input.seo.ogImage || null,
            twitterCardType: input.seo.twitterCardType || 'summary_large_image',
          },
        });
      }

      // Update AEO/GEO
      if (input.aeoGeo && updated.aeoGeoMetaId) {
        await tx.aeoGeoMeta.update({
          where: { id: updated.aeoGeoMetaId },
          data: {
            directAnswerPrompt: input.aeoGeo.directAnswerPrompt || null,
            snippetCandidate: input.aeoGeo.snippetCandidate || null,
            peopleAlsoAsk: input.aeoGeo.peopleAlsoAsk || null,
            semanticSummary: input.aeoGeo.semanticSummary || null,
            keyTakeaways: input.aeoGeo.keyTakeaways || [],
            statsSources: input.aeoGeo.statsSources || null,
            authorCredibility: input.aeoGeo.authorCredibility || null,
            reviewedBy: input.aeoGeo.reviewedBy || null,
            allowAiCrawler: input.aeoGeo.allowAiCrawler !== undefined ? input.aeoGeo.allowAiCrawler : true,
          },
        });
      }

      // Update Schema Settings
      if (input.schema && updated.schemaSettingsId) {
        await tx.schemaSettings.update({
          where: { id: updated.schemaSettingsId },
          data: {
            type: input.schema.type || 'BlogPosting',
            customSchemaJson: input.schema.customSchemaJson || null,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId: authorId,
          action: 'BLOG_UPDATE',
          details: `Updated blog post: "${updated.title}" (${id})`,
        },
      });
    });

    if (shouldRecordVersion) {
      await recordBlogVersionHistory({
        blogPostId: id,
        authorId,
        contentJson: input.contentJson ?? existing.contentJson ?? {},
        contentHtml: contentHtml ?? existing.contentHtml,
      });
    }

    // Publish only after the content is saved and passes the checklist. If it is
    // blocked, the edits above are kept and the post stays in its current status.
    if (isGoingLive) {
      const saved = await prisma.blogPost.findUnique({
        where: { id },
        include: { seoMeta: true },
      });
      PublishService.assertPublishable({
        contentType: 'blog',
        title: saved?.title,
        slug: saved?.slug,
        seoTitle: saved?.seoMeta?.title ?? input.seo?.title,
        seoDescription: saved?.seoMeta?.description ?? input.seo?.description,
        imageUrl: saved?.featuredImage,
        imageAlt: saved?.featuredImageAlt,
      });

      await prisma.$transaction([
        prisma.blogPost.update({
          where: { id },
          data: { status: 'PUBLISHED', publishedAt: new Date() },
        }),
        prisma.activityLog.create({
          data: {
            userId: authorId,
            action: 'BLOG_PUBLISH',
            details: `Published blog post: "${saved?.title}" (${id})`,
          },
        }),
      ]);
    }

    const finalResult = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: true,
        category: true,
        tags: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true,
      },
    });

    const result = BlogMapper.toAdminJson(finalResult!);

    if (result.status === 'PUBLISHED' || wasPublished) {
      await RevalidationService.onBlogChange(result.slug, previousSlug);
    }

    return result;
  }

  static async deleteBlog(id: string, userId: string) {
    const blog = await prisma.blogPost.findUnique({ where: { id } });
    if (!blog) throw new AppError('Blog post not found', 'NOT_FOUND', 404);

    const wasLive = blog.status === 'PUBLISHED' || blog.publishedAt != null;
    const slug = blog.slug;

    if (wasLive) {
      await prisma.redirect.upsert({
        where: { fromPath: `/blog/${slug}` },
        update: { toPath: '/blog', statusCode: 301 },
        create: { fromPath: `/blog/${slug}`, toPath: '/blog', statusCode: 301 },
      });
    }

    await prisma.$transaction([
      prisma.blogPost.delete({ where: { id } }),
      prisma.activityLog.create({
        data: {
          userId,
          action: 'BLOG_DELETE',
          details: `Deleted blog post: "${blog.title}" (${id})`,
        },
      }),
    ]);

    if (wasLive) {
      await RevalidationService.onBlogDelete(slug);
    }

    return { success: true };
  }
}
