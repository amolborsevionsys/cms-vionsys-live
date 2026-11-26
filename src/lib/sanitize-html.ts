import sanitize from 'sanitize-html';

/**
 * Server-side allow-list sanitiser for stored rich-text HTML (rule.md 6.5).
 *
 * The public website renders `contentHtml` / `challengeHtml` / `approachHtml`
 * directly, so this runs on every save. The allow-list is deliberately broad so
 * existing content keeps rendering the same:
 *  - everything the Editor.js parser emits (src/lib/editorjs-parser.ts)
 *  - the custom FAQ / Stats / CTA / Testimonial / Key-Takeaways snippets (Tailwind classes)
 *  - common Raw-HTML usage: inline styles, data-* attributes, video embeds, simple inline SVG
 * What it removes: <script>, <style>, event handlers (onclick, onerror, ...),
 * javascript: / vbscript: URLs, <object>/<embed>/<form>, and iframes from unknown hosts.
 */

const ALLOWED_TAGS = [
  // Structure & text
  'address', 'article', 'aside', 'footer', 'header', 'section', 'main', 'nav', 'div', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'p', 'br', 'hr', 'wbr',
  'blockquote', 'cite', 'q', 'figure', 'figcaption', 'pre', 'code', 'kbd', 'samp', 'var',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'abbr', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark',
  'small', 'sub', 'sup', 'time', 'bdi', 'bdo', 'dfn', 'details', 'summary', 'caption',
  // Tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'col', 'colgroup',
  // Media
  'img', 'picture', 'source', 'video', 'audio', 'track', 'iframe',
  // Simple inline SVG (icons in custom blocks)
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs',
  'lineargradient', 'stop', 'title', 'desc', 'use',
];

const GLOBAL_ATTRIBUTES = [
  'class', 'id', 'style', 'title', 'lang', 'dir', 'role', 'tabindex',
  'aria-*', 'data-*',
];

const SVG_ATTRIBUTES = [
  'viewbox', 'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'points', 'width', 'height', 'transform', 'opacity', 'fill-rule', 'clip-rule',
  'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'preserveaspectratio',
];

const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'www.google.com',
  'maps.google.com',
  'www.loom.com',
];

const OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    '*': GLOBAL_ATTRIBUTES,
    a: ['href', 'name', 'target', 'rel', 'download', 'hreflang'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'width', 'height', 'preload'],
    audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy'],
    td: ['colspan', 'rowspan', 'headers', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'align', 'valign'],
    col: ['span', 'width'],
    colgroup: ['span'],
    ol: ['start', 'reversed', 'type'],
    li: ['value'],
    time: ['datetime'],
    q: ['cite'],
    blockquote: ['cite'],
    details: ['open'],
    svg: SVG_ATTRIBUTES,
    g: SVG_ATTRIBUTES,
    path: SVG_ATTRIBUTES,
    circle: SVG_ATTRIBUTES,
    ellipse: SVG_ATTRIBUTES,
    rect: SVG_ATTRIBUTES,
    line: SVG_ATTRIBUTES,
    polyline: SVG_ATTRIBUTES,
    polygon: SVG_ATTRIBUTES,
    lineargradient: [...SVG_ATTRIBUTES, 'x1', 'x2', 'y1', 'y2'],
    stop: SVG_ATTRIBUTES,
    use: ['href', 'xlink:href'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
    source: ['http', 'https', 'data'],
  },
  allowProtocolRelative: true,
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  // Remove the content of dangerous tags entirely rather than unwrapping it as text.
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'template', 'object', 'embed'],
  parser: {
    lowerCaseAttributeNames: false,
  },
  transformTags: {
    // Links that open a new tab must not get access to window.opener.
    a: (tagName, attribs) => {
      if (attribs.target === '_blank') {
        const rel = new Set((attribs.rel || '').split(/\s+/).filter(Boolean));
        rel.add('noopener');
        rel.add('noreferrer');
        return { tagName, attribs: { ...attribs, rel: Array.from(rel).join(' ') } };
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitize(html, OPTIONS);
}
