import { NextRequest } from 'next/server';
import { CaseStudyService } from '@/features/case-studies/case-study.service';
import { caseStudyUpdateApiSchema } from '@/features/case-studies/case-study.validation';
import { requireAuth, authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const result = await CaseStudyService.getCaseStudyById(id);
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API case-study fetch error');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authorizeUser('content:edit');
    const { id } = await params;
    const input = caseStudyUpdateApiSchema.parse(await request.json());

    const result = await CaseStudyService.updateCaseStudy(id, session, input);
    return ApiResponse.success(result);
  } catch (err: unknown) {
    return handleApiError(err, 'API case-study update error');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authorizeUser('content:delete');
    const { id } = await params;

    await CaseStudyService.deleteCaseStudy(id, session.userId);
    return ApiResponse.success({ message: 'Case study deleted successfully.' });
  } catch (err: unknown) {
    return handleApiError(err, 'API case-study delete error');
  }
}
export const dynamic = 'force-dynamic';
