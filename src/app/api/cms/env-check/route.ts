import { NextRequest } from 'next/server';
import { requireAuth } from '@/features/auth/rbac';
import { getEnvDiagnostics } from '@/lib/env-diagnostics';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const revealSecrets =
      request.nextUrl.searchParams.get('reveal') === '1' &&
      process.env.NODE_ENV !== 'production';

    return ApiResponse.success(getEnvDiagnostics({ revealSecrets }));
  } catch (err: unknown) {
    return handleApiError(err, 'Env check error');
  }
}

export const dynamic = 'force-dynamic';
