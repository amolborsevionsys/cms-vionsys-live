import { NextRequest } from 'next/server';
import { RobotsGenerator } from '@/features/seo/robots-generator';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { validatePublicApiKey } from '@/features/auth/validate-public-api-key';

export async function GET(request: NextRequest) {
  try {
    const isValid = await validatePublicApiKey(request);
    if (!isValid) {
      return ApiResponse.unauthorized('Missing or invalid API Key.');
    }

    const robotsTxt = RobotsGenerator.generateRobotsTxt();
    return ApiResponse.success({ robotsTxt });
  } catch (err: unknown) {
    return handleApiError(err, 'Public robots API error');
  }
}
export const dynamic = 'force-dynamic';
