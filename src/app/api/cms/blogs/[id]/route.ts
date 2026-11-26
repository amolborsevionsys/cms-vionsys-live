import { NextRequest } from 'next/server';
import { BlogService } from '@/features/blogs/blog.service';
import { blogUpdateApiSchema } from '@/features/blogs/blog.validation';
import { requireAuth, authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const result = await BlogService.getBlogById(id);
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API blog fetch error');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authorizeUser('content:edit');
    const { id } = await params;
    const input = blogUpdateApiSchema.parse(await request.json());

    const result = await BlogService.updateBlog(id, session, input);
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API blog update error');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authorizeUser('content:delete');
    const { id } = await params;

    await BlogService.deleteBlog(id, session.userId);
    return ApiResponse.success({ message: 'Blog post deleted successfully.' });
  } catch (err: unknown) {
    return handleApiError(err, 'API blog delete error');
  }
}
export const dynamic = 'force-dynamic';
