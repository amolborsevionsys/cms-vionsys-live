import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { requireAuthPage } from '@/features/auth/require-auth';
import Link from 'next/link';
import { CaseStudyLayoutRenderer } from '@/components/case-study-layout/CaseStudyLayoutRenderer';
import { resolveLayout } from '@/features/case-studies/layout/layout.utils';
import { ArrowLeft, Info, Sparkles, Award, Eye } from 'lucide-react';

interface CaseStudyPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function CaseStudyPreviewPage({ params }: CaseStudyPreviewPageProps) {
  await requireAuthPage();
  const { id } = await params;

  const cs = await prisma.caseStudy.findUnique({
    where: { id },
    include: {
      author: true,
      resultStats: true,
      processSteps: {
        orderBy: { position: 'asc' }
      },
      mediaGallery: {
        orderBy: { position: 'asc' }
      },
      faqs: {
        orderBy: { position: 'asc' }
      },
      seoMeta: true,
      aeoGeoMeta: true,
      schemaSettings: true
    }
  });

  if (!cs) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-55 text-slate-800 font-sans pb-24">
      {/* Premium Preview Banner */}
      <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-6 py-3.5 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Preview Mode</span>
            <h1 className="text-[11px] text-slate-400 font-medium mt-0.5">Viewing local draft layout of: <span className="text-white font-semibold">{cs.title}</span></h1>
          </div>
        </div>
        <Link
          href={`/case-studies/${cs.id}/edit`}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 active-press rounded-lg transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Editor
        </Link>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        
        {/* Case study page, rendered from its layout exactly as vionsys.com will render it */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-3xs p-6 md:p-10">
          <CaseStudyLayoutRenderer
            cs={{
              title: cs.title,
              clientName: cs.clientName,
              clientLogo: cs.clientLogo,
              industry: cs.industry,
              engagementType: cs.engagementType,
              heroImage: cs.heroImage,
              heroImageAlt: cs.heroImageAlt,
              excerpt: cs.excerpt,
              challengeHtml: cs.challengeHtml,
              approachHtml: cs.approachHtml,
              resultStats: cs.resultStats,
              processSteps: cs.processSteps,
              mediaGallery: cs.mediaGallery,
              faqs: cs.faqs,
              testimonial: cs.testimonialQuote
                ? {
                    quote: cs.testimonialQuote,
                    name: cs.testimonialName,
                    designation: cs.testimonialDesignation,
                    company: cs.testimonialCompany,
                    avatarUrl: cs.testimonialImage,
                  }
                : null,
              cta: cs.ctaHeading
                ? { heading: cs.ctaHeading, body: cs.ctaBody, buttonLabel: cs.ctaButtonLabel, buttonUrl: cs.ctaButtonUrl }
                : null,
              layout: resolveLayout(cs.layoutJson),
            }}
          />
        </div>

        {/* Development Audit Intelligence Panels */}
        <div className="space-y-6">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Info className="w-4 h-4" /> SEO & Intelligence Metadata Check
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SEO Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-indigo-500" /> SERP Preview
              </h3>
              {cs.seoMeta ? (
                <div className="space-y-3">
                  <div className="border border-slate-100 p-3 rounded-lg bg-slate-50 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-mono">Google Snippet</span>
                    <h4 className="text-sm font-semibold text-blue-800 hover:underline cursor-pointer leading-tight">
                      {cs.seoMeta.title}
                    </h4>
                    <p className="text-[11px] text-green-700 font-normal">
                      vionsys.com/case-studies/{cs.slug}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {cs.seoMeta.description}
                    </p>
                  </div>
                  <div className="text-[11px] space-y-1 text-slate-600 font-medium">
                    <p><strong className="font-semibold text-slate-800">Focus Keyword:</strong> {cs.seoMeta.focusKeyword}</p>
                    <p><strong className="font-semibold text-slate-800">Robots:</strong> {cs.seoMeta.index ? 'index' : 'noindex'}, {cs.seoMeta.follow ? 'follow' : 'nofollow'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No SEO Metadata configured.</p>
              )}
            </div>

            {/* AEO / GEO Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI Engine (AEO) Context
              </h3>
              {cs.aeoGeoMeta ? (
                <div className="space-y-3 text-[11px] text-slate-600 font-medium">
                  {cs.aeoGeoMeta.snippetCandidate && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">AI Direct Answer Candidate</span>
                      <p className="text-slate-700 italic leading-relaxed">"{cs.aeoGeoMeta.snippetCandidate}"</p>
                    </div>
                  )}
                  {cs.aeoGeoMeta.keyTakeaways && cs.aeoGeoMeta.keyTakeaways.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Key Takeaways</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                        {cs.aeoGeoMeta.keyTakeaways.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p><strong className="font-semibold text-slate-800">Reviewed By:</strong> {cs.aeoGeoMeta.reviewedBy || 'N/A'}</p>
                  <p><strong className="font-semibold text-slate-800">AI Crawler Permission:</strong> {cs.aeoGeoMeta.allowAiCrawler ? 'Allowed' : 'Blocked'}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No AI Search Metadata configured.</p>
              )}
            </div>
          </div>

          {/* JSON-LD Schema Panel */}
          {cs.schemaSettings && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-3xs space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-emerald-500" /> Schema markup settings
              </h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-550 font-medium">Target JSON-LD Schema Type:</span>
                <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono text-[10px] font-semibold">
                  {cs.schemaSettings.type}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Embedded CSS styles for parser content */}
      <style dangerouslySetInnerHTML={{__html: `
        .preview-content p {
          font-size: 0.95rem;
          line-height: 1.65;
          color: #475569;
          margin-bottom: 1rem;
        }
        .preview-content h3 {
          font-size: 1.15rem;
          font-weight: 500 !important;
          color: #0f172a;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .preview-content ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin-bottom: 1rem;
          color: #475569;
        }
        .preview-content ol {
          list-style-type: decimal;
          padding-left: 1.25rem;
          margin-bottom: 1rem;
          color: #475569;
        }
        .preview-content li {
          margin-bottom: 0.25rem;
        }
        .preview-content blockquote {
          border-left: 4px solid #3b82f6;
          background-color: #f8fafc;
          padding: 0.75rem 1rem;
          font-style: italic;
          color: #475569;
          margin: 1.25rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .preview-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.25rem 0;
          font-size: 0.85rem;
        }
        .preview-content th, .preview-content td {
          border: 1px solid #e2e8f0;
          padding: 0.5rem 0.65rem;
          text-align: left;
        }
        .preview-content th {
          background-color: #f8fafc;
          font-weight: 500 !important;
          color: #0f172a;
        }
        .preview-content img {
          border-radius: 0.5rem;
          max-width: 100%;
          height: auto;
        }
      `}} />
    </div>
  );
}
