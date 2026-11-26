import { NextRequest } from 'next/server';
import { MediaService } from '@/features/media/media.service';
import { requireAuth, authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const searchParams = request.nextUrl.searchParams;
    const foldersOnly = searchParams.get('folders') === 'true';

    if (foldersOnly) {
      const folders = await MediaService.listFolders();
      return ApiResponse.success(folders);
    }

    const folderId = searchParams.get('folderId') === 'null' ? null : searchParams.get('folderId');
    const search = searchParams.get('search') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await MediaService.listAssets({
      folderId,
      search,
      tag,
      page,
      limit
    });

    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API media GET error');
  }
}

export async function POST(request: NextRequest) {
  try {
    await authorizeUser('media:upload');
    const body = await request.json();

    if (body.action === 'CREATE_FOLDER') {
      const result = await MediaService.createFolder(body.name, body.parentId);
      return ApiResponse.success(result);
    }

    return ApiResponse.error('INVALID_ACTION', 'Action is not supported.', null, 400);
  } catch (err: unknown) {
    return handleApiError(err, 'API media POST error');
  }
}
export const dynamic = 'force-dynamic';
