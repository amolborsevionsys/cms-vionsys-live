# Vionsys CMS: Frontend Integration Guide

This document describes how to integrate the CMS data into the public Vionsys website (`vionsys.com`).

## 1. Purging Caches / Revalidation Webhook

When published content changes (published, updated, slug changed, deleted), the CMS sends a POST request to `FRONTEND_REVALIDATE_URL`, which defaults to
`https://www.vionsys.com/api/revalidate/cms`. See [revalidation.service.ts](../src/features/publishing/revalidation.service.ts).

### Headers sent:
- `x-revalidate-secret: <FRONTEND_REVALIDATE_SECRET>`
- `Content-Type: application/json`

### Payload dispatched:
```json
{
  "paths": [
    "/",
    "/blog",
    "/blog/dynamic-article-slug",
    "/sitemap.xml",
    "/sitemap-blog.xml",
    "/blog/old-slug-if-changed"
  ],
  "action": "update",
  "contentType": "blog",
  "slug": "dynamic-article-slug",
  "blogSlug": "dynamic-article-slug"
}
```

For case studies the paths are `/case-studies/...` and `/sitemap-case-studies.xml`, with `contentType: "case-study"` and `caseStudySlug`. Deletes send `action: "delete"`. The request times out after 10 s, and a failure does not block the CMS save.

### Handler implementation in `vionsys.com` (`app/api/revalidate/cms/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  const provided = request.headers.get('x-revalidate-secret');
  const secret = process.env.FRONTEND_REVALIDATE_SECRET;

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { paths } = await request.json();
  if (Array.isArray(paths)) {
    for (const path of paths) {
      revalidatePath(path);
    }
  }

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
```

---

## 2. Dynamic 301 Redirection handling

To prevent broken SEO backlinks when writers change slugs, the main site should query `/api/v1/public/redirects` on start/build or run middleware checks:

```typescript
// middleware.ts in vionsys.com
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Fetch redirects index (cache this fetch in production!)
  const res = await fetch('https://cms.vionsys.com/api/v1/public/redirects', {
    headers: { 'x-vionsys-cms-key': process.env.CMS_API_KEY! }
  });
  const data = await res.json();

  if (data.success) {
    const matched = data.data.find((r: any) => r.fromPath === path);
    if (matched) {
      return NextResponse.redirect(new URL(matched.toPath, request.url), matched.statusCode);
    }
  }

  return NextResponse.next();
}
```
