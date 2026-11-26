import React from 'react';
import type {
  Block,
  BoundBlockType,
  CaseStudyLayout,
  RowStyle,
} from '@/features/case-studies/layout/layout.types';

/*
 * Renders a case study from its page-builder layout.
 *
 * Used by the CMS preview AND intended to be copied into vionsys.com (see
 * docs/CASE_STUDY_LAYOUTS.md), so it must stay self-contained:
 *   - no CMS imports except the layout types (copy layout.types.ts alongside it),
 *   - no client-side hooks (works as a React Server Component),
 *   - plain Tailwind classes; restyle freely on the website.
 *
 * Input is the public API case-study JSON (GET /api/v1/public/case-studies/:slug).
 */

export interface CaseStudyRenderData {
  title: string;
  clientDisplayName?: string | null;
  clientName?: string | null;
  clientLogo?: string | null;
  industry?: string | null;
  engagementType?: string | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  excerpt?: string | null;
  challengeHtml?: string | null;
  approachHtml?: string | null;
  resultStats?: { value: string; label: string; description?: string | null }[];
  processSteps?: { title: string; description: string }[];
  mediaGallery?: { imagePath: string; caption?: string | null; alt?: string | null }[];
  faqs?: { question: string; answer: string }[];
  testimonial?: {
    quote: string;
    name?: string | null;
    designation?: string | null;
    company?: string | null;
    avatarUrl?: string | null;
  } | null;
  cta?: { heading: string; body?: string | null; buttonLabel?: string | null; buttonUrl?: string | null } | null;
  layout: CaseStudyLayout;
}

/** Static class map so Tailwind can see every class at build time. */
const SPAN_CLASS: Record<number, string> = {
  1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
  5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
  9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
};

/** Row container styles (light backgrounds only, so body text stays readable). */
const ROW_BACKGROUND: Record<RowStyle['background'], string> = {
  none: '',
  muted: 'rounded-2xl bg-slate-50',
  brand: 'rounded-2xl bg-blue-50',
};
const ROW_PADDING: Record<RowStyle['padding'], string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6 md:p-8',
  lg: 'p-8 md:p-14',
};

export function rowContainerClass(style?: RowStyle): string {
  if (!style) return '';
  // A background without padding would touch the content; give it a minimum.
  const padding = style.background !== 'none' && style.padding === 'none' ? 'sm' : style.padding;
  return `${ROW_BACKGROUND[style.background] ?? ''} ${ROW_PADDING[padding] ?? ''}`.trim();
}

/** Typography for HTML coming from the rich-text editor. */
export const PROSE_CLASS =
  'text-slate-700 leading-relaxed [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:text-slate-900 [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:text-slate-900 [&_img]:rounded-lg [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:mb-4 [&_table]:w-full [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6';

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 text-2xl text-slate-900">{children}</h2>
);

const humanize = (value?: string | null) =>
  value ? value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null;

function BoundBlock({ type, cs }: { type: BoundBlockType; cs: CaseStudyRenderData }) {
  switch (type) {
    case 'hero': {
      const client = cs.clientDisplayName || cs.clientName;
      return (
        <header className="space-y-4">
          {(cs.industry || cs.engagementType) && (
            <div className="flex flex-wrap gap-2 text-sm text-slate-600">
              {cs.industry && <span className="rounded-full bg-slate-100 px-3 py-1">{cs.industry}</span>}
              {cs.engagementType && (
                <span className="rounded-full bg-slate-100 px-3 py-1">{humanize(cs.engagementType)}</span>
              )}
            </div>
          )}
          <h1 className="text-4xl leading-tight text-slate-900 md:text-5xl">{cs.title}</h1>
          {client && <p className="text-lg text-slate-600">Client: {client}</p>}
          {cs.excerpt && <p className="max-w-3xl text-lg text-slate-700">{cs.excerpt}</p>}
          {cs.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element -- portable renderer; the website may swap in next/image
            <img src={cs.heroImage} alt={cs.heroImageAlt ?? ''} className="mt-2 w-full rounded-2xl object-cover" />
          )}
        </header>
      );
    }
    case 'metrics': {
      const stats = (cs.resultStats ?? []).filter((s) => s.value || s.label);
      if (stats.length === 0) return null;
      return (
        <section aria-label="Results" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-3xl text-slate-900">{stat.value}</p>
              <p className="mt-1 text-slate-700">{stat.label}</p>
              {stat.description && <p className="mt-2 text-sm text-slate-500">{stat.description}</p>}
            </div>
          ))}
        </section>
      );
    }
    case 'challenge':
      if (!cs.challengeHtml) return null;
      return (
        <section>
          <SectionHeading>The challenge</SectionHeading>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: cs.challengeHtml }} />
        </section>
      );
    case 'approach':
      if (!cs.approachHtml) return null;
      return (
        <section>
          <SectionHeading>Our approach</SectionHeading>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: cs.approachHtml }} />
        </section>
      );
    case 'process': {
      const steps = (cs.processSteps ?? []).filter((s) => s.title || s.description);
      if (steps.length === 0) return null;
      return (
        <section>
          <SectionHeading>How we delivered it</SectionHeading>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-slate-900">{step.title}</p>
                  <p className="mt-1 text-slate-600">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      );
    }
    case 'gallery': {
      const images = (cs.mediaGallery ?? []).filter((m) => m.imagePath);
      if (images.length === 0) return null;
      return (
        <section aria-label="Gallery" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <figure key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element -- portable renderer */}
              <img src={img.imagePath} alt={img.alt ?? ''} className="aspect-video w-full rounded-xl object-cover" />
              {img.caption && <figcaption className="mt-2 text-sm text-slate-500">{img.caption}</figcaption>}
            </figure>
          ))}
        </section>
      );
    }
    case 'testimonial': {
      const t = cs.testimonial;
      if (!t?.quote) return null;
      return (
        <figure className="rounded-2xl bg-slate-50 p-8">
          <blockquote className="text-xl leading-relaxed text-slate-800">“{t.quote}”</blockquote>
          {(t.name || t.designation || t.company) && (
            <figcaption className="mt-4 text-slate-600">
              {t.name}
              {t.designation ? `, ${t.designation}` : ''}
              {t.company ? `, ${t.company}` : ''}
            </figcaption>
          )}
        </figure>
      );
    }
    case 'faq': {
      const faqs = (cs.faqs ?? []).filter((f) => f.question);
      if (faqs.length === 0) return null;
      return (
        <section>
          <SectionHeading>Frequently asked questions</SectionHeading>
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {faqs.map((faq, i) => (
              <details key={i} className="group p-4">
                <summary className="cursor-pointer list-none text-slate-900">{faq.question}</summary>
                <p className="mt-2 text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    case 'cta': {
      const cta = cs.cta;
      if (!cta?.heading) return null;
      return (
        <section className="rounded-2xl bg-blue-700 p-8 text-center text-white">
          <h2 className="text-2xl">{cta.heading}</h2>
          {cta.body && <p className="mx-auto mt-2 max-w-2xl text-blue-100">{cta.body}</p>}
          {cta.buttonLabel && cta.buttonUrl && (
            <a href={cta.buttonUrl} className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 text-blue-700 hover:bg-blue-50">
              {cta.buttonLabel}
            </a>
          )}
        </section>
      );
    }
    default:
      return null;
  }
}

export function LayoutBlock({ block, cs }: { block: Block; cs: CaseStudyRenderData }) {
  switch (block.type) {
    case 'heading': {
      if (!block.data.text) return null;
      const Tag = block.data.level === 3 ? 'h3' : 'h2';
      return <Tag className={block.data.level === 3 ? 'text-xl text-slate-900' : 'text-2xl text-slate-900'}>{block.data.text}</Tag>;
    }
    case 'text':
      if (!block.data.html) return null;
      return <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: block.data.html }} />;
    case 'image':
      if (!block.data.url) return null;
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- portable renderer */}
          <img src={block.data.url} alt={block.data.alt} className="w-full rounded-xl object-cover" />
          {block.data.caption && <figcaption className="mt-2 text-sm text-slate-500">{block.data.caption}</figcaption>}
        </figure>
      );
    case 'table': {
      const [head, ...body] = block.data.hasHeader ? block.data.rows : [null, ...block.data.rows];
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            {block.data.caption && <caption className="mb-2 text-left text-slate-500">{block.data.caption}</caption>}
            {head && (
              <thead>
                <tr>
                  {head.map((cell, i) => (
                    <th key={i} scope="col" className="border border-slate-200 bg-slate-50 p-2 text-slate-900">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, r) => (
                <tr key={r}>
                  {(row ?? []).map((cell, c) => (
                    <td key={c} className="border border-slate-200 p-2 text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'file':
      if (!block.data.url) return null;
      return (
        <a
          href={block.data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-800 hover:bg-slate-50"
        >
          {block.data.label || 'Download file'}
        </a>
      );
    case 'divider':
      return <hr className="border-slate-200" />;
    default:
      return <BoundBlock type={block.type} cs={cs} />;
  }
}

export function CaseStudyLayoutRenderer({ cs }: { cs: CaseStudyRenderData }) {
  return (
    <article className="space-y-12">
      {cs.layout.rows.map((row) => (
        <div key={row.id} className={`grid grid-cols-1 gap-8 md:grid-cols-12 ${rowContainerClass(row.style)}`}>
          {row.columns.map((col) => (
            <div key={col.id} className={`space-y-6 ${SPAN_CLASS[col.span] ?? 'md:col-span-12'}`}>
              {col.blocks.map((block) => (
                <LayoutBlock key={block.id} block={block} cs={cs} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </article>
  );
}

export default CaseStudyLayoutRenderer;
