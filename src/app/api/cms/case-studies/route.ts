import { NextRequest } from 'next/server';
import { CaseStudyService } from '@/features/case-studies/case-study.service';
import { caseStudyCreateApiSchema } from '@/features/case-studies/case-study.validation';
import { requireAuth, authorizeUser } from '@/features/auth/rbac';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    
    const searchParams = request.nextUrl.searchParams;
    const industry = searchParams.get('industry') || undefined;
    const approvalStatus = searchParams.get('approvalStatus') || undefined;
    const engagementType = searchParams.get('engagementType') || undefined;
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await CaseStudyService.listCaseStudies({
      industry,
      approvalStatus,
      engagementType,
      search,
      page,
      limit
    });

    return ApiResponse.success(result.items, {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (err: unknown) {
    return handleApiError(err, 'API case-studies list error');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authorizeUser('content:create');
    const input = caseStudyCreateApiSchema.parse(await request.json());

    const result = await CaseStudyService.createCaseStudy(session, input);
    return ApiResponse.success(result, null, 201);
  } catch (err: unknown) {
    return handleApiError(err, 'API case-study create error');
  }
}
export const dynamic = 'force-dynamic';
