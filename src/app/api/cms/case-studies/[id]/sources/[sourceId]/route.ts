import { NextRequest } from 'next/server';
import { authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { deleteSource } from '@/features/ai/rag.service';
import { toErrorResponse } from '@/features/ai/route-error';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  try {
    await authorizeUser('content:edit');
    const { id, sourceId } = await params;
    await deleteSource(id, sourceId);
    return ApiResponse.success({ message: 'Document removed.' });
  } catch (err: unknown) {
    return toErrorResponse(err, 'Delete case study source error');
  }
}

export const dynamic = 'force-dynamic';
