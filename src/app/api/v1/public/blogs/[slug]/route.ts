import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BlogMapper } from '@/features/blogs/blog.mapper';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { validatePublicApiKey } from '@/features/auth/validate-public-api-key';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const isValid = await validatePublicApiKey(request);
    if (!isValid) {
      return ApiResponse.unauthorized('Missing or invalid API Key in header "x-vionsys-cms-key".');
    }

    const { slug } = await params;

    const blog = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        category: true,
        tags: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true
      }
    });

    if (!blog || blog.status !== 'PUBLISHED') {
      return ApiResponse.notFound('Published blog post not found.');
    }

    const publicBlog = BlogMapper.toPublicJson(blog);
    return ApiResponse.success(publicBlog);
  } catch (err: unknown) {
    return handleApiError(err, 'Public blog detail API error');
  }
}
export const dynamic = 'force-dynamic';
