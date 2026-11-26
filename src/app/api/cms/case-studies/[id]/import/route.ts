import { NextRequest } from 'next/server';
import { authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { importDocument } from '@/features/case-studies/import/import.service';
import { MAX_IMPORT_BYTES } from '@/features/ai/extract-text';
import { toErrorResponse } from '@/features/ai/route-error';

/** POST multipart/form-data { file } → AI extraction for review + stored source for Ask AI. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorizeUser('content:edit');
    const { id } = await params;

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return ApiResponse.error('NO_FILE', 'Choose a PDF or Word (.docx) file to import.', null, 400);
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return ApiResponse.error('FILE_TOO_LARGE', 'The file is larger than 4 MB. Compress it or split it into smaller files.', null, 413);
    }

    const result = await importDocument({
      caseStudyId: id,
      fileName: file.name || 'document',
      buffer: Buffer.from(await file.arrayBuffer()),
      userId: session.userId,
    });
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return toErrorResponse(err, 'Case study import error');
  }
}

export const dynamic = 'force-dynamic';
// Reading a document with the AI can take a while.
export const maxDuration = 60;
