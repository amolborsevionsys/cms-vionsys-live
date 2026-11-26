import { NextRequest } from 'next/server';
import { clearSessionCookie } from '@/features/auth/auth-options';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function POST(_request: NextRequest) {
  try {
    const response = ApiResponse.success({ message: 'Signed out successfully.' });
    return clearSessionCookie(response);
  } catch (err: unknown) {
    return handleApiError(err, 'Logout route error');
  }
}
export const dynamic = 'force-dynamic';
