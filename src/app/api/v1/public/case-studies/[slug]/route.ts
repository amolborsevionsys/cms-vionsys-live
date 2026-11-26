import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CaseStudyMapper } from '@/features/case-studies/case-study.mapper';
import { ApiResponse } from '@/lib/api-response';
import { handleApiError } from '@/lib/api-error';
import { validatePublicApiKey } from '@/features/auth/validate-public-api-key';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const isValid = await validatePublicApiKey(request);
    if (!isValid) {
      return ApiResponse.unauthorized('Missing or invalid API Key in header "x-vionsys-cms-key".');
    }

    const { slug } = await params;

    const cs = await prisma.caseStudy.findUnique({
      where: { slug },
      include: {
        resultStats: true,
        processSteps: true,
        mediaGallery: true,
        seoMeta: true,
        aeoGeoMeta: true,
        schemaSettings: true,
        faqs: true
      }
    });

    if (!cs || cs.publishedAt == null) {
      return ApiResponse.notFound('Published case study not found.');
    }

    const publicCs = CaseStudyMapper.toPublicJson(cs);
    return ApiResponse.success(publicCs);
  } catch (err: unknown) {
    return handleApiError(err, 'Public case study detail API error');
  }
}
export const dynamic = 'force-dynamic';
