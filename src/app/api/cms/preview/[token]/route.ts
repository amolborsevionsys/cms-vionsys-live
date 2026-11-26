import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PreviewTokenService, type PreviewContentType } from '@/features/publishing/preview-token.service';
import { BlogMapper } from '@/features/blogs/blog.mapper';
import { CaseStudyMapper } from '@/features/case-studies/case-study.mapper';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { isAllowedOrigin } from '@/lib/cors';

/**
 * CORS: only allow-listed origins are reflected (rule.md 7.13). Requests with no
 * Origin header (server-to-server fetches from the website) need no CORS headers.
 */
function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vionsys-cms-key',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(request),
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const corsHeaders = getCorsHeaders(request);
  const applyCors = (res: NextResponse) => {
    Object.entries(corsHeaders).forEach(([key, val]) => res.headers.set(key, val));
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  };

  try {
    const { token } = await params;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const typeParam = searchParams.get('type'); // 'blog' or 'case-study'

    if (!id || !typeParam) {
      return applyCors(
        ApiResponse.error('MISSING_PARAMS', 'Parameters "id" and "type" are required.', null, 400)
      );
    }

    // Anything other than "blog" has always been treated as a case study.
    const type: PreviewContentType = typeParam === 'blog' ? 'blog' : 'case-study';

    if (!PreviewTokenService.validateToken(id, type, token)) {
      return applyCors(
        ApiResponse.unauthorized('Invalid or expired preview link. Open the preview again from the CMS.')
      );
    }

    if (type === 'blog') {
      const blog = await prisma.blogPost.findUnique({
        where: { id },
        include: {
          author: { select: { id: true, name: true, role: true } },
          category: true,
          tags: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true,
        },
      });
      if (!blog) return applyCors(ApiResponse.notFound('Blog post not found.'));
      return applyCors(ApiResponse.success(BlogMapper.toAdminJson(blog)));
    }

    const cs = await prisma.caseStudy.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, role: true } },
        resultStats: true,
        processSteps: true,
        mediaGallery: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true,
        faqs: true,
      },
    });
    if (!cs) return applyCors(ApiResponse.notFound('Case study not found.'));
    return applyCors(ApiResponse.success(CaseStudyMapper.toAdminJson(cs)));
  } catch (err: unknown) {
    return applyCors(handleApiError(err, 'Preview token validation error'));
  }
}
export const dynamic = 'force-dynamic';
