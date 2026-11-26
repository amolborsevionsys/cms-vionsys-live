import { NextRequest } from 'next/server';
import { requireAuth } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { listSources } from '@/features/ai/rag.service';
import { toErrorResponse } from '@/features/ai/route-error';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    return ApiResponse.success(await listSources(id));
  } catch (err: unknown) {
    return toErrorResponse(err, 'List blog sources error');
  }
}

export const dynamic = 'force-dynamic';
