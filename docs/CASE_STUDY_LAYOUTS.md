# Case study layouts (page builder)

Editors can now arrange each case study freely: rows of 1–3 columns, with blocks dragged anywhere. They can start from one of three templates. This document is for the **vionsys.com team**: what the API now returns and how to render it.

## TL;DR

1. Nothing breaks today. The public API still returns every field the current case-study page uses (`challengeHtml`, `resultStats`, `testimonial`, `cta`, …).
2. The API also returns two new fields: `templateId` and `layout`.
3. To render the editor's layout, copy two files into the website and render `<CaseStudyLayoutRenderer cs={caseStudy} />`:
   - `src/features/case-studies/layout/layout.types.ts`
   - `src/components/case-study-layout/CaseStudyLayoutRenderer.tsx` (change its one import path to wherever you put the types file)

The renderer is a plain React component with no hooks, so it works in a Server Component. It uses Tailwind classes; restyle it freely.

## What the API returns

`GET /api/v1/public/case-studies/:slug` (and the list endpoint) now include:

```jsonc
{
  "title": "…",
  "challengeHtml": "…",          // unchanged legacy fields, still filled
  "resultStats": [ … ],
  "testimonial": { … },
  "cta": { … },

  "templateId": "classic",        // "classic" | "results-first" | "story"
  "layout": {
    "version": 1,
    "rows": [
      {
        "id": "r1",
        "columns": [
          { "id": "c1", "span": 8, "blocks": [ { "id": "b1", "type": "challenge" } ] },
          { "id": "c2", "span": 4, "blocks": [
              { "id": "b2", "type": "image", "data": { "url": "https://…", "alt": "…", "caption": "" } }
          ] }
        ]
      }
    ]
  }
}
```

- `span` is a width on a 12-column grid. The spans in a row always add up to 12.
- Case studies created before the builder have no stored layout. For those, the API returns the **classic** layout, which is the order the live page uses today.

## Block types

**Case-study sections** take their content from the case study's existing fields, have no `data`, and appear at most once per page:

| `type` | Renders from |
|---|---|
| `hero` | `title`, `clientDisplayName`, `industry`, `engagementType`, `excerpt`, `heroImage`, `heroImageAlt` |
| `metrics` | `resultStats` |
| `challenge` | `challengeHtml` |
| `approach` | `approachHtml` |
| `process` | `processSteps` |
| `gallery` | `mediaGallery` |
| `testimonial` | `testimonial` |
| `faq` | `faqs` |
| `cta` | `cta` |

**Content blocks** carry their own content in `data` and can appear any number of times:

| `type` | `data` |
|---|---|
| `heading` | `{ text, level: 2 \| 3 }` |
| `text` | `{ html, json }`. Render `html`; `json` is the editor's own state |
| `image` | `{ url, alt, caption }` |
| `table` | `{ rows: string[][], hasHeader, caption }`. When `hasHeader` is true, `rows[0]` is the header row |
| `file` | `{ url, label }`. A download link |
| `divider` | none |

Skip any block with an unknown `type`, so that future block types don't break the page. The bundled renderer already does this.

## Templates

| `templateId` | Order |
|---|---|
| `classic` | hero → metrics → challenge → approach → process → gallery → testimonial → FAQ → CTA (the current live page) |
| `results-first` | hero → metrics → challenge \| approach (side by side) → testimonial → process → FAQ → CTA |
| `story` | hero → challenge \| image → image \| approach → process → metrics → gallery → testimonial → FAQ → CTA |

The template is only a starting point. Editors can move, add and remove blocks afterwards, and `layout` always holds the final arrangement.

## Security note

`text` blocks contain HTML, as `challengeHtml` and `approachHtml` already do. The CMS sanitises stored HTML server-side once the hardening branch (`swap-dev`) is merged; extend that sanitising to `layout` text blocks at merge time.
