'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Globe,
  Eye,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Briefcase,
  TrendingUp,
  MessageSquare,
  Link2,
  Plus,
  Trash,
  FileText,
  HelpCircle,
  History
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from './RichTextEditor';
import { EditorSidebar } from './EditorSidebar';
import { ContentIntelligenceBar } from './ContentIntelligenceBar';
import { StatusBadge } from '../shared/StatusBadge';
import { CaseStudyBuilder } from '../case-study-builder/CaseStudyBuilder';
import { AiPanel, type ImportResultPayload } from '../ai/AiPanel';
import { BlogImportReviewDialog } from '../blog-ai/BlogImportReviewDialog';
import { appendAnswerToBody, buildBlogUpdates, type BlogSectionId, type BodyMode } from '../blog-ai/apply-blog-import';
import type { BlogExtraction } from '@/features/blogs/import/blog-import.schema';
import type { SidebarTab } from './EditorSidebar';
import { applyTemplate, isTemplateId, resolveLayout } from '@/features/case-studies/layout/layout.utils';
import type { CaseStudyLayout, TemplateId } from '@/features/case-studies/layout/layout.types';
import type { CaseStudyExtraction } from '@/features/case-studies/import/import.schema';
import {
  buildFieldUpdates,
  buildImportedLayout,
  type ImportSectionId,
} from '../case-study-builder/import/apply-import';
import {
  getBlogLiveUrl,
  getCaseStudyLiveUrl,
  isPublishedContent,
} from '@/lib/frontend-urls';

interface ContentEditorShellProps {
  id?: string;
  initialData?: any;
  contentType: 'blog' | 'case-study';
  categories: { id: string; name: string }[];
  services: { id: string; label: string }[];
}

export function ContentEditorShell({
  id,
  initialData,
  contentType,
  categories,
  services
}: ContentEditorShellProps) {
  const router = useRouter();
  const [isNew] = useState(!id);

  // 1. Form States
  const [docData, setDocData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    excerpt: initialData?.excerpt || '',
    featuredImage: initialData?.featuredImage || initialData?.heroImage || null,
    featuredImageAlt: initialData?.featuredImageAlt || initialData?.heroImageAlt || null,
    categoryId: initialData?.categoryId || null,
    tags: initialData?.tags || [],
    isFeatured: initialData?.isFeatured || false,
    guestAuthor: initialData?.guestAuthor || null,
    internalNote: initialData?.internalNote || null,
    serviceIds: initialData?.serviceIds || [],
    caseStudyIds: initialData?.caseStudyIds || [],
    contentBriefUrl: initialData?.contentBriefUrl || null,
    status: initialData?.status || (initialData?.publishedAt ? 'PUBLISHED' : 'DRAFT'),
    
    // Case study specific structured fields
    clientName: initialData?.clientName || '',
    clientLogo: initialData?.clientLogo || null,
    industry: initialData?.industry || '',
    engagementType: initialData?.engagementType || 'PROJECT',
    showMetricsOnTop: initialData?.showMetricsOnTop || false,
    testimonialQuote: initialData?.testimonialQuote || null,
    testimonialName: initialData?.testimonialName || null,
    testimonialDesignation: initialData?.testimonialDesignation || null,
    testimonialCompany: initialData?.testimonialCompany || null,
    testimonialImage: initialData?.testimonialImage || null,
    ctaHeading: initialData?.ctaHeading || null,
    ctaBody: initialData?.ctaBody || null,
    ctaButtonLabel: initialData?.ctaButtonLabel || null,
    ctaButtonUrl: initialData?.ctaButtonUrl || null,
    resultStats: initialData?.resultStats || [],
    processSteps: initialData?.processSteps || [],
    mediaGallery: initialData?.mediaGallery || [],
    faqs: initialData?.faqs || [],
    // Case-study page builder
    approachHtml: initialData?.approachHtml || '',
    approachJson: initialData?.approachJson || {},
    templateId: (isTemplateId(initialData?.templateId) ? initialData.templateId : 'classic') as TemplateId,
    layout: (contentType === 'case-study' ? resolveLayout(initialData?.layout) : null) as CaseStudyLayout | null,
  });

  // Tiptap Content
  const [contentHtml, setContentHtml] = useState(
    contentType === 'blog'
      ? initialData?.contentHtml || ''
      : initialData?.challengeHtml || '' // Case studies load challengeHtml as main content block
  );
  const [contentJson, setContentJson] = useState(
    contentType === 'blog'
      ? initialData?.contentJson || {}
      : initialData?.challengeJson || {}
  );
  const [contentText, setContentText] = useState(
    contentType === 'blog'
      ? initialData?.contentText || ''
      : initialData?.excerpt || ''
  );

  // SEO, AEO/GEO, Schema states
  const [seo, setSeo] = useState({
    title: initialData?.seo?.title || '',
    description: initialData?.seo?.description || '',
    focusKeyword: initialData?.seo?.focusKeyword || '',
    secondaryKeywords: initialData?.seo?.secondaryKeywords || [],
    canonicalUrl: initialData?.seo?.canonicalUrl || '',
    index: initialData?.seo?.index !== false,
    follow: initialData?.seo?.follow !== false,
    ogTitle: initialData?.seo?.ogTitle || '',
    ogDescription: initialData?.seo?.ogDescription || '',
    ogImage: initialData?.seo?.ogImage || '',
    twitterCardType: initialData?.seo?.twitterCardType || 'summary_large_image'
  });

  const [aeoGeo, setAeoGeo] = useState({
    directAnswerPrompt: initialData?.aeoGeo?.directAnswerPrompt || '',
    snippetCandidate: initialData?.aeoGeo?.snippetCandidate || '',
    peopleAlsoAsk: initialData?.aeoGeo?.peopleAlsoAsk || [],
    semanticSummary: initialData?.aeoGeo?.semanticSummary || '',
    keyTakeaways: initialData?.aeoGeo?.keyTakeaways || [],
    statsSources: initialData?.aeoGeo?.statsSources || [],
    authorCredibility: initialData?.aeoGeo?.authorCredibility || '',
    reviewedBy: initialData?.aeoGeo?.reviewedBy || '',
    allowAiCrawler: initialData?.aeoGeo?.allowAiCrawler !== false
  });

  const [schema, setSchema] = useState({
    type: initialData?.schema?.type || (contentType === 'blog' ? 'BlogPosting' : 'CaseStudy/WebPage'),
    customSchemaJson: initialData?.schema?.customSchemaJson || null
  });

  // Autosave and Loading indicators
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lifted Sidebar States for Smooth Synchronized Animations
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('doc');

  const scrollToField = (fieldKey: string) => {
    let targetTab: SidebarTab | null = null;
    let inputId = '';

    if (fieldKey === 'title') {
      inputId = 'document-title-input';
    } else if (fieldKey === 'slug') {
      inputId = 'document-slug-input';
    } else if (fieldKey === 'featuredImageAlt' || fieldKey === 'heroImageAlt') {
      targetTab = 'doc';
      inputId = 'document-image-alt-input';
    } else if (fieldKey === 'resultStats') {
      targetTab = 'doc';
      inputId = 'document-result-stats-section';
    } else if (fieldKey === 'faqs') {
      targetTab = 'doc';
      inputId = 'document-faqs-section';
    } else if (fieldKey === 'clientName') {
      targetTab = 'doc';
      inputId = 'document-client-name-input';
    } else if (fieldKey.startsWith('seo.')) {
      targetTab = 'seo';
      if (fieldKey === 'seo.title') inputId = 'seo-title-input';
      if (fieldKey === 'seo.description') inputId = 'seo-description-input';
    } else if (fieldKey === 'schema.type') {
      targetTab = 'schema';
      inputId = 'schema-type-select';
    } else if (fieldKey === 'authorId') {
      targetTab = 'doc';
      inputId = 'document-author-select';
    }

    if (targetTab) {
      setSidebarTab(targetTab);
      setSidebarOpen(true);
    }

    setTimeout(() => {
      const el = document.getElementById(inputId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 150);
  };

  // Track changes to trigger save
  const hasChangesRef = useRef(false);
  const isSavingRef = useRef(false);
  const docDataRef = useRef({ docData, contentHtml, contentJson, contentText, seo, aeoGeo, schema });

  useEffect(() => {
    docDataRef.current = { docData, contentHtml, contentJson, contentText, seo, aeoGeo, schema };
  }, [docData, contentHtml, contentJson, contentText, seo, aeoGeo, schema]);

  // Handle any field update
  const updateField = (field: string, value: any) => {
    setDocData(prev => {
      const next = { ...prev, [field]: value };
      docDataRef.current = { ...docDataRef.current, docData: next };
      return next;
    });
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  // Functional updates so rapid drag events never work from a stale layout.
  const updateLayout = (updater: (prev: CaseStudyLayout) => CaseStudyLayout) => {
    setDocData(prev => {
      if (!prev.layout) return prev;
      const next = { ...prev, layout: updater(prev.layout) };
      docDataRef.current = { ...docDataRef.current, docData: next };
      return next;
    });
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  // --- Blog AI import / Ask AI ---------------------------------------------------
  // Bumping this remounts the blog's rich-text editor so it shows content set from outside.
  const [bodyVersion, setBodyVersion] = useState(0);
  const [blogImportReview, setBlogImportReview] = useState<ImportResultPayload<BlogExtraction> | null>(null);

  const setBody = (body: { json: unknown; html: string; text: string }) => {
    setContentJson(body.json);
    setContentHtml(body.html);
    setContentText(body.text);
    setBodyVersion(v => v + 1);
  };

  const applyBlogImport = (extraction: BlogExtraction, selected: Set<BlogSectionId>, bodyMode: BodyMode) => {
    const updates = buildBlogUpdates(extraction, selected, bodyMode, contentJson, categories);
    Object.entries(updates.fields).forEach(([field, value]) => updateField(field, value));
    if (updates.body) setBody(updates.body);
    if (updates.seo) setSeo(prev => ({ ...prev, ...updates.seo }));
    if (updates.aeoGeo) setAeoGeo(prev => ({ ...prev, ...updates.aeoGeo }));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  const insertAnswerIntoBody = (answer: string) => {
    setBody(appendAnswerToBody(contentJson, answer));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  const hasBodyContent = Boolean(contentText && contentText.trim());

  // Apply AI-imported content (reviewed by the editor) in one state update.
  const applyImport = (extraction: CaseStudyExtraction, selected: Set<ImportSectionId>, templateId: TemplateId) => {
    const updates = buildFieldUpdates(extraction, selected, docDataRef.current.docData.ctaButtonUrl);
    setDocData(prev => {
      const next = {
        ...prev,
        ...updates.fields,
        ...(updates.approach ? { approachHtml: updates.approach.html, approachJson: updates.approach.json } : {}),
        templateId,
        layout: prev.layout ? buildImportedLayout(prev.layout, templateId, extraction, selected) : prev.layout,
      } as typeof prev;
      docDataRef.current = { ...docDataRef.current, docData: next };
      return next;
    });
    if (updates.challenge) {
      setContentHtml(updates.challenge.html);
      setContentJson(updates.challenge.json);
      setContentText(updates.challenge.text);
    }
    if (updates.seo) setSeo(prev => ({ ...prev, ...updates.seo }));
    if (updates.keyTakeaways) setAeoGeo(prev => ({ ...prev, keyTakeaways: updates.keyTakeaways as string[] }));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  const updateSeo = (field: string, value: any) => {
    setSeo(prev => ({ ...prev, [field]: value }));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  const updateAeoGeo = (field: string, value: any) => {
    setAeoGeo(prev => ({ ...prev, [field]: value }));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  const updateSchema = (field: string, value: any) => {
    setSchema(prev => ({ ...prev, [field]: value }));
    hasChangesRef.current = true;
    setSaveStatus('unsaved');
  };

  // --- SAVE OPERATION ---
  const handleSave = async (isDraft = true, statusOverride?: string): Promise<boolean> => {
    if (isSavingRef.current) {
      if (statusOverride === 'PUBLISHED') {
        const started = Date.now();
        while (isSavingRef.current && Date.now() - started < 10000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (isSavingRef.current) return false;
      } else {
        return false;
      }
    }
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus('saving');
    setErrorMessage(null);

    const activeState = docDataRef.current;
    
    // Prepare endpoint
    const route = contentType === 'blog' ? '/api/cms/blogs' : '/api/cms/case-studies';
    const endpoint = id ? `${route}/${id}` : route;
    const method = id ? 'PUT' : 'POST';

    // Format body data
    const body: any = {
      ...activeState.docData,
      contentHtml: activeState.contentHtml,
      contentJson: activeState.contentJson,
      seo: activeState.seo,
      aeoGeo: activeState.aeoGeo,
      schema: activeState.schema
    };

    if (contentType === 'case-study') {
      body.challengeHtml = activeState.contentHtml;
      body.challengeJson = activeState.contentJson;
      body.heroImage = activeState.docData.featuredImage ?? null;
      body.heroImageAlt = activeState.docData.featuredImageAlt ?? null;
    }

    if (contentType === 'blog') {
      delete body.approachHtml;
      delete body.approachJson;
      delete body.templateId;
      delete body.layout;
    }

    if (statusOverride) {
      body.status = statusOverride;
    } else {
      body.status = activeState.docData.status || 'DRAFT';
    }

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const resData = await res.json();

      if (!resData.success) {
        throw new Error(resData.error?.message || 'Failed to save document.');
      }

      hasChangesRef.current = false;
      setSaveStatus('saved');
      
      if (resData.data?.status) {
        setDocData(prev => ({ ...prev, status: resData.data.status }));
      } else if (statusOverride) {
        setDocData(prev => ({ ...prev, status: statusOverride }));
      }

      if (contentType === 'case-study' && resData.data) {
        setDocData(prev => ({
          ...prev,
          featuredImage: resData.data.heroImage ?? prev.featuredImage,
          featuredImageAlt: resData.data.heroImageAlt ?? prev.featuredImageAlt,
        }));
      } else if (contentType === 'blog' && resData.data) {
        setDocData(prev => ({
          ...prev,
          featuredImage: resData.data.featuredImage ?? prev.featuredImage,
          featuredImageAlt: resData.data.featuredImageAlt ?? prev.featuredImageAlt,
        }));
      }
      
      // If it was a new document, redirect to the edit path
      if (isNew && resData.data?.id) {
        router.push(
          contentType === 'blog'
            ? `/blogs/${resData.data.id}/edit`
            : `/case-studies/${resData.data.id}/edit`
        );
      }
      return true;
    } catch (err: any) {
      console.error('Save error:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'An error occurred during save.');
      return false;
    } finally {
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const persistHeroImage = (url: string, alt: string) => {
    const nextDocData = {
      ...docDataRef.current.docData,
      featuredImage: url,
      featuredImageAlt: alt,
    };
    docDataRef.current = { ...docDataRef.current, docData: nextDocData };
    setDocData(nextDocData);
    void handleSave(true);
  };

  // --- PUBLISH OPERATION ---
  const handlePublish = async () => {
    setIsPublishing(true);
    setErrorMessage(null);
    try {
      const ok = await handleSave(false, 'PUBLISHED');
      if (ok) {
        setDocData(prev => ({ ...prev, status: 'PUBLISHED' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPublishing(false);
    }
  };

  // Autosave interval loop (30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      if (hasChangesRef.current && id) {
        handleSave(true);
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [id]);

  // Autosave on tab blur
  useEffect(() => {
    const handleBlur = () => {
      if (hasChangesRef.current && id) {
        handleSave(true);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [id]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/20">
      {/* Editor Top Bar */}
      <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-40 select-none">
        <div className="flex items-center gap-3">
          <Link
            href={contentType === 'blog' ? '/blogs' : '/case-studies'}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-5 bg-slate-200" />
          <StatusBadge status={docData.status} />
          
          {/* Save Status Indicators */}
          <span className="text-xs text-slate-400 font-medium">
            {saveStatus === 'saved' && 'Autosaved'}
            {saveStatus === 'saving' && 'Saving draft...'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
            {saveStatus === 'error' && 'Save failed'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {id && (
            <>
              <Link
                href={contentType === 'blog' ? `/blogs/${id}/preview` : `/case-studies/${id}/preview`}
                target="_blank"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active-press rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Local Preview
              </Link>
              {isPublishedContent(docData.status) && docData.slug && (
                <a
                  href={
                    contentType === 'blog'
                      ? getBlogLiveUrl(docData.slug)
                      : getCaseStudyLiveUrl(docData.slug)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="View published page on vionsys.com"
                >
                  <Globe className="w-3.5 h-3.5" />
                  Live URL
                </a>
              )}
            </>
          )}
          
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-slate-400" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-755 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      {/* Editor Inner Layout Workspace */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
        {contentType === 'case-study' && docData.layout ? (
          /* Case-study page builder: toolbox + canvas */
          <CaseStudyBuilder
                layout={docData.layout}
                updateLayout={updateLayout}
                templateId={docData.templateId}
                onTemplateChange={templateId => {
                  updateLayout(prev => applyTemplate(prev, templateId));
                  updateField('templateId', templateId);
                }}
                ctx={{
                  doc: docData,
                  onFieldChange: updateField,
                  challengeJson: contentJson,
                  challengeHtml: contentHtml,
                  onChallengeChange: (html, json, text) => {
                    setContentHtml(html);
                    setContentJson(json);
                    setContentText(text);
                    hasChangesRef.current = true;
                    setSaveStatus('unsaved');
                  },
                  onApproachChange: (html, json) => {
                    updateField('approachHtml', html);
                    updateField('approachJson', json);
                  },
                }}
                caseStudyId={id}
                onApplyImport={applyImport}
                header={
                  <>
                  {errorMessage && (
                    <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      {errorMessage}
                    </div>
                  )}
      
                  <div className="space-y-2">
                    <input
                      id="document-title-input"
                      type="text"
                      aria-label="Case study title"
                      placeholder="Case study title (e.g. Scaling a HealthTech SaaS platform)"
                      value={docData.title}
                      onChange={e => {
                        const val = e.target.value;
                        updateField('title', val);
                        if (isNew) {
                          updateField(
                            'slug',
                            val
                              .toLowerCase()
                              .replace(/\s+/g, '-')
                              .replace(/[^\w\-]+/g, '')
                          );
                        }
                      }}
                      className="w-full bg-transparent text-2xl text-slate-900 border-none outline-hidden placeholder-slate-300 focus:ring-0 leading-tight"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="text-slate-500">https://vionsys.com/case-studies/</span>
                      <input
                        id="document-slug-input"
                        type="text"
                        aria-label="URL slug"
                        value={docData.slug}
                        onChange={e => updateField('slug', e.target.value)}
                        placeholder="case-study-slug"
                        className="border-b border-slate-200 hover:border-slate-400 focus:border-brand-500 outline-hidden pb-0.5 px-0.5 bg-transparent text-slate-700"
                      />
                    </div>
                  </div>
                  </>
                }
                footer={
                  <ContentIntelligenceBar
                    contentText={contentText}
                    contentHtml={contentHtml}
                    focusKeyword={seo.focusKeyword}
                  />
                }
              />
        ) : (
          /* Main Writing Canvas for Blog Posts */
          <div className="flex-1 flex flex-col p-8 overflow-y-auto gap-6 bg-slate-50/20 max-w-4xl mx-auto w-full pb-20">
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Title Area */}
            <div className="space-y-2 pl-3 border-l-4 border-l-amber-400">
              <input
                id="document-title-input"
                type="text"
                placeholder="Title of your post..."
                value={docData.title}
                onChange={e => {
                  const val = e.target.value;
                  updateField('title', val);
                  // Auto generate slug if new
                  if (isNew) {
                    updateField(
                      'slug',
                      val
                        .toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^\w\-]+/g, '')
                    );
                  }
                }}
                className="w-full text-3xl font-extrabold text-slate-900 border-none outline-hidden placeholder-slate-200 focus:ring-0 leading-tight focus:border-transparent focus:box-shadow-none"
              />

              {/* Editable Slug indicator with live url preview */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="font-medium text-slate-500">https://vionsys.com/{contentType === 'blog' ? 'blog' : 'case-studies'}/</span>
                <input
                  id="document-slug-input"
                  type="text"
                  value={docData.slug}
                  onChange={e => updateField('slug', e.target.value)}
                  placeholder="url-slug"
                  className="border-b border-slate-200 hover:border-slate-400 focus:border-indigo-500 outline-hidden pb-0.5 px-0.5 bg-transparent font-semibold text-slate-700"
                />
              </div>
            </div>

            {/* RichText Editor Component Canvas */}
            <div className="flex-1 flex flex-col min-h-[400px] editorjs-wrapper bg-white border border-slate-200 border-l-4 border-l-rose-400 rounded-xl p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600 ring-1 ring-rose-100">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Content Canvas</span>
              </div>
              <RichTextEditor
                key={`body-${bodyVersion}`}
                initialJson={contentJson}
                onChange={(html, json, text) => {
                  setContentHtml(html);
                  setContentJson(json);
                  setContentText(text);
                  hasChangesRef.current = true;
                  setSaveStatus('unsaved');
                }}
              />
            </div>


            {/* Bottom intelligence statistics bar */}
            <ContentIntelligenceBar
              contentText={contentText}
              contentHtml={contentHtml}
              focusKeyword={seo.focusKeyword}
            />
          </div>
        )}

        {/* Right Tab Sidebar */}
        <EditorSidebar
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          activeTab={sidebarTab}
          setActiveTab={setSidebarTab}
          onChecklistItemClick={scrollToField}
          data={docData}
          onChange={updateField}
          seo={seo}
          onChangeSeo={updateSeo}
          aeoGeo={aeoGeo}
          onChangeAeoGeo={updateAeoGeo}
          schema={schema}
          onChangeSchema={updateSchema}
          categories={categories}
          services={services}
          contentType={contentType}
          onSaveDraft={() => handleSave(true)}
          onPublish={handlePublish}
          onImageSelected={id ? persistHeroImage : undefined}
          isSaving={isSaving}
          isPublishing={isPublishing}
          aiPanel={
            contentType === 'blog' ? (
              <AiPanel
                apiBase={id ? `/api/cms/blogs/${id}` : undefined}
                noun="blog post"
                quickPrompts={BLOG_PROMPTS}
                insertLabel="Add to the end of the article"
                onImported={result => setBlogImportReview(result as ImportResultPayload<BlogExtraction>)}
                onInsertAnswer={insertAnswerIntoBody}
              />
            ) : undefined
          }
        />
      </div>

      {blogImportReview && (
        <BlogImportReviewDialog
          fileName={blogImportReview.source.fileName}
          extraction={blogImportReview.extraction}
          warnings={blogImportReview.warnings}
          hasExistingBody={hasBodyContent}
          onCancel={() => setBlogImportReview(null)}
          onApply={(selected, bodyMode) => {
            applyBlogImport(blogImportReview.extraction, selected, bodyMode);
            setBlogImportReview(null);
          }}
        />
      )}
    </div>
  );
}

const BLOG_PROMPTS = [
  'Summarise the article in 2 sentences',
  'Suggest 5 FAQs with answers',
  'List the key takeaways',
  'Suggest 3 alternative titles',
  'Write a meta description under 160 characters',
];

export default ContentEditorShell;
