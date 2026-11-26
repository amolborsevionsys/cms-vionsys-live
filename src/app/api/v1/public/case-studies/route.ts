import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CaseStudyMapper } from '@/features/case-studies/case-study.mapper';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { parseOptionalPagination } from '@/lib/pagination';
import { validatePublicApiKey } from '@/features/auth/validate-public-api-key';

export async function GET(request: NextRequest) {
  try {
    const isValid = await validatePublicApiKey(request);
    if (!isValid) {
      return ApiResponse.unauthorized('Missing or invalid API Key in header "x-vionsys-cms-key".');
    }

    // Optional ?limit=&page=. Without them every published case study is returned (unchanged behaviour).
    const pagination = parseOptionalPagination(request.nextUrl.searchParams);
    const where = { publishedAt: { not: null } };

    const [caseStudies, total] = await Promise.all([
      prisma.caseStudy.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
        include: {
          resultStats: true,
          processSteps: true,
          mediaGallery: true,
          seoMeta: true,
          aeoGeoMeta: true,
          schemaSettings: true,
          faqs: true
        }
      }),
      pagination ? prisma.caseStudy.count({ where }) : Promise.resolve(null),
    ]);

    const publicCs = caseStudies
      .map(CaseStudyMapper.toPublicJson)
      .filter(Boolean); // Filter out unpublished ones

    return ApiResponse.success(
      publicCs,
      pagination ? { total, page: pagination.page, limit: pagination.limit } : undefined
    );
  } catch (err: unknown) {
    return handleApiError(err, 'Public case studies list API error');
  }
}
export const dynamic = 'force-dynamic';
