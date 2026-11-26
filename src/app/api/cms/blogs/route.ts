import { NextRequest } from 'next/server';
import { BlogService } from '@/features/blogs/blog.service';
import { blogCreateApiSchema } from '@/features/blogs/blog.validation';
import { requireAuth, authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const authorId = searchParams.get('authorId') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await BlogService.listBlogs({
      status,
      categoryId,
      authorId,
      search,
      page,
      limit
    });

    return ApiResponse.success(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: unknown) {
    return handleApiError(err, 'API blogs list error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorizeUser('content:create');
    const input = blogCreateApiSchema.parse(await request.json());

    const result = await BlogService.createBlog(session, input);
    return ApiResponse.success(result, null, 201);
  } catch (err: unknown) {
    return handleApiError(err, 'API blog create error');
  }
}
export const dynamic = 'force-dynamic';
