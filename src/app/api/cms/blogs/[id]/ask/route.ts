import { NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { askSources } from '@/features/ai/rag.service';
import { toErrorResponse } from '@/features/ai/route-error';

const askSchema = z.object({ question: z.string().trim().min(3).max(1000) });

/** POST { question } → answer grounded in this blog post's uploaded documents, with citations. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await authorizeUser('content:edit');
    const { id } = await params;
    const parsed = askSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return ApiResponse.error('VALIDATION_ERROR', 'Ask a question between 3 and 1,000 characters.', null, 422);
    }
    return ApiResponse.success(await askSources('blog', id, parsed.data.question));
  } catch (err: unknown) {
    return toErrorResponse(err, 'Ask AI error');
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
