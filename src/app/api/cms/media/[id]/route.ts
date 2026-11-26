import { NextRequest } from 'next/server';
import { MediaService } from '@/features/media/media.service';
import { authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authorizeUser('media:upload');
    const { id } = await params;
    const body = await request.json();

    const result = await MediaService.updateAsset(id, body);
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API media update error');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await authorizeUser('media:delete');
    const { id } = await params;

    await MediaService.deleteAsset(id);
    return ApiResponse.success({ message: 'Media asset deleted successfully.' });
  } catch (err: unknown) {
    return handleApiError(err, 'API media delete error');
  }
}
export const dynamic = 'force-dynamic';
