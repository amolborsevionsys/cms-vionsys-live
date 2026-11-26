import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

interface DeleteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, { params }: DeleteParams) {
  try {
    const session = await authorizeUser('taxonomy:manage');
    const { id } = await params;

    if (!id) {
      return ApiResponse.error('ID_REQUIRED', 'Category ID is required.', null, 400);
    }

    // Verify if it exists
    const category = await prisma.category.findUnique({
      where: { id }
    });

    if (!category) {
      return ApiResponse.error('NOT_FOUND', 'Category not found.', null, 404);
    }

    // Wrap in a transaction to safely update related posts and delete category
    await prisma.$transaction(async (tx) => {
      // 1. Unlink posts referencing this category
      await tx.blogPost.updateMany({
        where: { categoryId: id },
        data: { categoryId: null }
      });

      // 2. Delete the category itself
      await tx.category.delete({
        where: { id }
      });
    });

    // Log action
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: 'CATEGORY_DELETE',
        details: `Deleted category: "${category.name}"`
      }
    });

    return ApiResponse.success({ message: 'Category deleted successfully.' });
  } catch (err: unknown) {
    return handleApiError(err, 'API delete category error');
  }
}

export const dynamic = 'force-dynamic';
