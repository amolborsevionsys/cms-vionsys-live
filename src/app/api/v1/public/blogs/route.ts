import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BlogMapper } from '@/features/blogs/blog.mapper';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { parseOptionalPagination } from '@/lib/pagination';
import { validatePublicApiKey } from '@/features/auth/validate-public-api-key';

export async function GET(request: NextRequest) {
  try {
    const isValid = await validatePublicApiKey(request);
    if (!isValid) {
      return ApiResponse.unauthorized('Missing or invalid API Key in header "x-vionsys-cms-key".');
    }

    // Optional ?limit=&page=. Without them every published post is returned (unchanged behaviour).
    const pagination = parseOptionalPagination(request.nextUrl.searchParams);
    const where = { status: 'PUBLISHED' as const };

    const [blogs, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        include: {
          category: true,
          tags: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true
        }
      }),
      pagination ? prisma.blogPost.count({ where }) : Promise.resolve(null),
    ]);

    const publicBlogs = blogs
      .map(BlogMapper.toPublicJson)
      .filter(Boolean); // Filter out null drafts

    return ApiResponse.success(
      publicBlogs,
      pagination ? { total, page: pagination.page, limit: pagination.limit } : undefined
    );
  } catch (err: unknown) {
    return handleApiError(err, 'Public blogs list API error');
  }
}
export const dynamic = 'force-dynamic';
