# Engineering Rules: Vionsys CMS (Next.js 16)

Production standards for this repository. They apply to every PR, whether a person or an AI agent wrote it.

**Keywords:** **MUST** / **MUST NOT** are hard rules, and a PR that breaks one is blocked. **SHOULD** is the default: you can deviate if you explain why in the PR.

**Version baseline:** Next.js 16.2 · React 19.2 · TypeScript 5 (strict) · Prisma 5 on MongoDB · Node.js ≥ 20.9.
Next.js 16 changed many APIs. The documentation for the installed version is in `node_modules/next/dist/docs/`, and it wins over blog posts, older answers, or memory.

Section 12 lists the places where the repo currently **breaks** these rules. Fix them when you touch the file, and never add new ones.

---

## Contents

1. [Project structure and layering](#1-project-structure-and-layering)
2. [TypeScript and code quality](#2-typescript-and-code-quality)
3. [Server and Client Components](#3-server-and-client-components)
4. [Data fetching, caching, and revalidation](#4-data-fetching-caching-and-revalidation)
5. [Route Handlers and API design](#5-route-handlers-and-api-design)
6. [Input validation and output shaping](#6-input-validation-and-output-shaping)
7. [Security](#7-security)
8. [Database (Prisma + MongoDB)](#8-database-prisma--mongodb)
9. [Errors, logging, and observability](#9-errors-logging-and-observability)
10. [Performance, SEO, and accessibility](#10-performance-seo-and-accessibility)
11. [Testing, CI, and Git workflow](#11-testing-ci-and-git-workflow)
12. [Known violations in this repo](#12-known-violations-in-this-repo)
13. [PR checklist](#13-pr-checklist)

---

## 1. Project structure and layering

```
app/ (pages, layouts, route handlers)   → thin: auth, parse, call service, respond
  └─► features/<domain>/*.service.ts    → business rules, transactions, side effects
        └─► lib/prisma.ts               → the only DB client
features/<domain>/*.mapper.ts           → the only place that shapes data leaving the server
features/<domain>/*.validation.ts       → Zod schemas, the single source for input types
```

- **1.1 MUST** keep business logic out of `page.tsx`, `layout.tsx`, and `route.ts`. They call a service in `src/features/<domain>/`.
- **1.2 MUST** import Prisma only from `@/lib/prisma`. Never call `new PrismaClient()` in app code. Scripts in `scripts/` are the one exception.
- **1.3 MUST** organise new code by domain: `features/<domain>/{service,mapper,validation}.ts`. Do not add a top-level `utils/` folder. Shared pure helpers go in `src/lib/`.
- **1.4 MUST** use the `@/` path alias. Do not use relative chains like `../../../../../lib/prisma`, and convert them when you touch a file.
- **1.5 MUST** use route groups such as `(cms)` and `(auth)` for layout boundaries. Put co-located private folders behind a `_` prefix (`_components/`) so they never become routes.
- **1.6 SHOULD** keep files under ~400 lines. Split large client components (e.g. `ContentEditorShell.tsx`, 1,060 lines) into hooks (`useAutosave`, `useEditorForm`) and child components.
- **1.7 MUST** keep a single source of truth for config: `src/config/*` for static app config and `src/lib/env.ts` for environment variables (see 7.4).

## 2. TypeScript and code quality

- **2.1 MUST** keep `"strict": true`. `npx tsc --noEmit` and `npm run lint` must pass with zero errors before you merge.
- **2.2 MUST NOT** add new `any` (the repo already has ~130). Use `unknown` and narrow it, Prisma's generated types (`Prisma.BlogPostGetPayload<…>`), or `z.infer<typeof schema>`.
- **2.3 MUST** type `catch (err)` as `unknown` and narrow it with `instanceof AppError` / `instanceof Error`.
- **2.4 MUST** type route params with the generated helpers instead of writing them by hand:
  ```ts
  export default async function Page(props: PageProps<'/blogs/[id]/edit'>) {
    const { id } = await props.params;
  }
  export async function GET(req: NextRequest, ctx: RouteContext<'/api/cms/blogs/[id]'>) {
    const { id } = await ctx.params;
  }
  ```
  Run `npx next typegen` if the helpers are missing.
- **2.5 MUST NOT** use `require()` in TypeScript. Use ESM `import`.
- **2.6 MUST NOT** leave dead code, unused imports, unused dependencies, or commented-out blocks. Delete them; git keeps the history.
- **2.7 SHOULD** prefer named exports, except where Next.js requires a default export (`page`, `layout`, `error`, `not-found`).
- **2.8 MUST** run linting through ESLint directly (`npm run lint`). In Next 16, `next lint` is removed and `next build` no longer lints.

## 3. Server and Client Components

- **3.1 MUST** treat Server Components as the default. Add `'use client'` only to the smallest leaf that needs state, effects, event handlers, or browser APIs.
- **3.2 MUST NOT** import server-only modules (`@/lib/prisma`, `@/lib/env`, `features/*/service`, `aws-sdk`, `jsonwebtoken`, `bcryptjs`) into a client module. Every server-only module **MUST** start with `import 'server-only'` so a mistake fails the build.
- **3.3 MUST** pass only serialisable, minimal props from server to client: plain objects, strings, and ISO dates. Map Prisma records through a mapper first. Never pass a full user record or anything that contains `passwordHash` or `keyHash`.
- **3.4 MUST** load browser-only libraries (Editor.js, heavy animation) with `await import()` inside `useEffect`, or with `next/dynamic` and `{ ssr: false }` from a client component.
- **3.5 SHOULD** use Server Functions (`'use server'`) for CMS form mutations when building new UI. They give typed inputs, avoid boilerplate fetch code, and enable `updateTag` / `refresh`. Keep Route Handlers for the public API, webhooks, uploads, and anything an external client calls.
- **3.6 MUST** re-check authentication and authorisation inside every Server Function. They are public HTTP endpoints.
- **3.7 MUST** use `<Link>` for internal navigation. `window.location` is only for a deliberate full reload, such as after login so the new cookie is sent.

## 4. Data fetching, caching, and revalidation

- **4.1 MUST** `await` request-time APIs. In Next 16, `cookies()`, `headers()`, `draftMode()`, `params`, and `searchParams` are async only.
- **4.2 MUST NOT** call this app's own Route Handlers from Server Components. Call the service directly.
- **4.3 MUST** run independent queries in parallel with `Promise.all`, as the dashboard already does.
- **4.4 Caching model:** admin pages are per-user and must stay dynamic. Public API responses are cacheable.
  - Today the repo uses `export const dynamic = 'force-dynamic'`. That is acceptable **until** `cacheComponents` is enabled.
  - When you enable `cacheComponents: true` in `next.config.ts`, you **MUST** remove the `dynamic`, `revalidate`, and `fetchCache` segment configs. Cache public reads with `'use cache'` + `cacheLife()` + `cacheTag()`, and wrap request-time data in `<Suspense>`.
- **4.5 MUST** use the Next 16 signatures:
  - `revalidateTag(tag, 'max')`. The single-argument form is deprecated.
  - `updateTag(tag)` for read-your-writes. Server Functions only.
  - `refresh()` to refresh the client router from a Server Function.
  - `cacheLife` / `cacheTag` without the `unstable_` prefix.
- **4.6 SHOULD** send public API responses with explicit cache headers, e.g. `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, so the CDN absorbs traffic. Admin responses **MUST** be `private, no-store`.
- **4.7 SHOULD** run side effects that must not block the response (frontend revalidation webhook, activity logs, version trimming) inside `after()` from `next/server`.
- **4.8 MUST** paginate every list endpoint with a server-enforced maximum `limit` (e.g. 100). Public list endpoints included.

## 5. Route Handlers and API design

- **5.1 MUST** follow this handler shape:
  ```ts
  export async function PUT(req: NextRequest, ctx: RouteContext<'/api/cms/blogs/[id]'>) {
    try {
      const session = await authorizeUser('content:edit');      // 1. authN + authZ
      const { id } = await ctx.params;
      const input = blogUpdateSchema.parse(await req.json());   // 2. validate
      const result = await BlogService.updateBlog(id, session, input); // 3. service
      return ApiResponse.success(result);                       // 4. envelope
    } catch (err) {
      return handleApiError(err);                               // 5. one error mapper
    }
  }
  ```
- **5.2 MUST** return the standard envelope from `ApiResponse` (`{ success, data, meta }` / `{ success, error: { code, message, details } }`). Error `code` values are `UPPER_SNAKE_CASE` and part of the contract.
- **5.3 MUST** use the correct status code: `200` read/update, `201` create, `204` no body, `400` malformed input, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (e.g. duplicate slug), `422` validation failed, `429` rate-limited, `500` unexpected.
- **5.4 MUST** version the public API (`/api/v1/…`). Breaking changes go to `/v2`. Additive changes are fine in place. Update `docs/API_CONTRACT.md` in the same PR.
- **5.5 MUST** map errors in one shared function (`handleApiError`). It returns `AppError` subclasses as-is and turns anything else into a generic `500` **without** the internal message (see 9.3).
- **5.6 MUST NOT** trust client-supplied identity fields (`authorId`, `role`, `userId`). They always come from the session.
- **5.7 SHOULD** make mutations idempotent where practical. Autosave `PUT`s will retry.

## 6. Input validation and output shaping

- **6.1 MUST** validate every request body, query string, and route param on the server with Zod before using it. Client-side validation is for UX only.
- **6.2 MUST** derive TypeScript input types from the schema (`z.infer`). Do not keep a hand-written interface next to the schema.
- **6.3 MUST** use separate schemas for create, update (`.partial()`), and publish (stricter: required SEO fields). Reject unknown keys with `.strict()` so clients cannot mass-assign fields like `status` or `authorId`.
- **6.4 MUST** coerce and bound query params: `z.coerce.number().int().min(1).max(100)` for `limit`.
- **6.5 MUST** sanitise all stored HTML **on the server**, before saving. Use an allow-list sanitiser (`sanitize-html` or `isomorphic-dompurify`), not regex. The website renders `contentHtml` with `dangerouslySetInnerHTML`, so unsanitised HTML is stored XSS on vionsys.com.
- **6.6 MUST** shape every response through a mapper (`toAdminJson`, `toPublicJson`). Public mappers use an **allow-list** of fields and never spread a Prisma record.
- **6.7 MUST** validate uploads on the server: MIME allow-list, size limit (`siteConfig.storage.maxFileSize`), and extension matching MIME. Prefer checking magic bytes. Treat `image/svg+xml` as active content: sanitise it or serve it with `Content-Disposition: attachment`.

## 7. Security

### Authentication and sessions
- **7.1 MUST** treat `proxy.ts` (formerly `middleware.ts`) as an optimistic redirect only. Every page, Route Handler, and Server Function **MUST** verify the session again on the server (`requireAuthPage`, `requireAuth`, `authorizeUser`).
- **7.2 MUST** keep session cookies `httpOnly`, `secure` in production, `sameSite=lax` or stricter, and `path=/`. Sessions **SHOULD** be invalidated server-side on password or role change, e.g. with a `tokenVersion` on `User`.
- **7.3 MUST NOT** ship default credentials or bootstrap backdoors in production code paths. Seed the first admin with a one-off script and credentials from an environment variable.

### Secrets and environment
- **7.4 MUST** read `process.env` only in `src/lib/env.ts`, and validate it with Zod at startup. In production, a missing secret **MUST** throw. Never fall back to a hard-coded value.
  ```ts
  import 'server-only';
  const schema = z.object({ JWT_SECRET: z.string().min(32), DATABASE_URL: z.string().url(), /* … */ });
  export const env = schema.parse(process.env);
  ```
- **7.5 MUST NOT** commit secrets, real keys, or `.env*` files. A secret that has been committed or written in docs is burned: rotate it.
- **7.6 MUST** prefix client-visible variables with `NEXT_PUBLIC_` and treat them as public. Server secrets never get the prefix.
- **7.7 MUST** use separate secrets for separate purposes: session JWT, preview-token HMAC, and revalidation webhook.

### API keys
- **7.8 MUST** store API keys **hashed** (SHA-256 is fine for high-entropy random keys) and compare the hash of the presented key. Show the plaintext once, at creation. Honour `isActive` and `expiresAt`.
- **7.9 MUST NOT** hard-code an API key that works in production. A dev key **MUST** be gated on `NODE_ENV !== 'production'` and come from an environment variable.

### Authorisation
- **7.10 MUST** check a specific permission (`authorizeUser('…')`) for every mutation, not just "signed in". Changing `status` to `PUBLISHED` or `ARCHIVED` **MUST** require `content:publish` / `content:archive`, whatever endpoint carries it.
- **7.11 MUST** run the server-side publish checklist (`PublishService.validate*`) before any transition to `PUBLISHED`.

### Web hardening
- **7.12 MUST** set security headers in `next.config.ts` `headers()`: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`), and `Permissions-Policy`. **SHOULD** add a Content Security Policy (see `docs/01-app/02-guides/content-security-policy.md`). **SHOULD** set `poweredByHeader: false`.
- **7.13 MUST** use an explicit origin allow-list for CORS. **MUST NOT** reflect an arbitrary `Origin` together with `Access-Control-Allow-Credentials: true`. Use exact-match or anchored-suffix checks (`https://*.vionsys.com`); `endsWith('.vionsys.com')` is acceptable only when the scheme is checked too.
- **7.14 MUST** rate-limit `POST /api/cms/auth/login` and the public API (e.g. Upstash Ratelimit or Vercel WAF).
- **7.15 MUST** make preview tokens expire (sign `id + type + exp`) and scope them to one content type.
- **7.16 MUST** keep `npm audit --omit=dev` free of high and critical issues. Dependabot or Renovate **SHOULD** be on.

## 8. Database (Prisma + MongoDB)

- **8.1 MUST** treat `prisma/schema.prisma` as the source of truth. Run `npx prisma db push` locally after you edit it, and commit the schema change together with the code that uses it.
- **8.2 MUST NOT** run `prisma db push` against production as part of an unattended build without review. Schema changes to production **SHOULD** be a deliberate, separate step (`npm run db:push` with production credentials), and Preview deployments **MUST** use a non-production database.
- **8.3 MUST** put a data migration (backfill or reshape) in a script under `scripts/` that is idempotent and safe to re-run, like `migrate-seo-fks.mjs`.
- **8.4 MUST** wrap multi-document writes that must succeed together in `runTransactionWithRetry`, which needs a MongoDB replica set. Keep transactions short: no network calls (S3, webhooks) inside them.
- **8.5 MUST** select only the fields you need (`select`/`include`) on hot paths and public endpoints. Never `include: { author: true }` on a public route, because that loads `passwordHash` into memory.
- **8.6 MUST** add `@@index` for fields used in `where` or `orderBy` on lists (`status`, `publishedAt`, `updatedAt`, `categoryId`).
- **8.7 MUST** keep checks such as slug uniqueness enforced by a DB unique index, not only by a pre-check (race condition). Catch `P2002` and map it to `409 DUPLICATE_SLUG`.
- **8.8 SHOULD** reuse the singleton client from `lib/prisma.ts` (it is already cached on `globalThis` in development).

## 9. Errors, logging, and observability

- **9.1 MUST** provide `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, and `loading.tsx` for the slow admin segments. Use `notFound()` / `forbidden()` / `unauthorized()` from `next/navigation` in Server Components.
- **9.2 MUST** throw `AppError` subclasses (`ValidationError`, `NotFoundError`, `ForbiddenError`, …) from services. Never throw strings.
- **9.3 MUST NOT** send internal error messages, stack traces, or Prisma errors to clients, especially on `/api/v1/public/*`. Log them server-side with a request ID and return a generic message.
- **9.4 MUST** log through `@/lib/logger`, not `console.log`. Logs **SHOULD** be structured JSON: `level`, `msg`, `requestId`, `userId`, `route`, `durationMs`. **MUST NOT** log secrets, tokens, passwords, cookies, or full request bodies.
- **9.5 SHOULD** set up `instrumentation.ts` (OpenTelemetry) and an error tracker (Sentry or similar) for production.
- **9.6 MUST** write an `ActivityLog` entry for every content, media, taxonomy, user, and API-key mutation.
- **9.7 SHOULD** log and alert on external call failures (S3, revalidation webhook) and retry them where safe. Do not swallow them silently.

## 10. Performance, SEO, and accessibility

- **10.1 MUST** use `next/image` for content and UI images (configure `images.remotePatterns` for the S3 bucket host). In Next 16, `images.domains` is deprecated. Plain `<img>` is acceptable only inside editor-rendered HTML.
- **10.2 MUST** load fonts with `next/font` (already done in `app/layout.tsx`). Do not add `<link>` tags to Google Fonts.
- **10.3 SHOULD** keep each admin route's client JS small. Lazy-load the editor, media picker, and heavy panels, and check bundle impact before adding a dependency.
- **10.4 SHOULD** respect `prefers-reduced-motion` in `framer-motion` animations.
- **10.5 MUST** export `metadata` / `generateMetadata` for every page. Admin pages **MUST** be `noindex` (`robots: { index: false, follow: false }`).
- **10.6 MUST** generate JSON-LD only from `features/seo/schema-generator.ts`, and escape it correctly (`JSON.stringify(...).replace(/</g, '\\u003c')`) when you embed it.
- **10.7 MUST** meet WCAG 2.2 AA in the admin UI:
  - Every input has an associated `<label htmlFor>`.
  - Icon-only buttons have an `aria-label`.
  - Focus is visible.
  - Colour contrast is ≥ 4.5:1. Watch the light-slate text classes.
  - Dialogs trap focus and close on `Esc`.
- **10.8 MUST** require alt text for every published image. The publish checklist enforces this, so keep it enforced.

## 11. Testing, CI, and Git workflow

### Testing
- **11.1 MUST** add unit tests (Vitest) for pure logic in `src/lib/*` and `features/*` (slugify, the Editor.js parser, the SEO score, publish validation, permission checks).
- **11.2 MUST** add integration tests for each Route Handler covering: unauthenticated → 401, wrong role → 403, invalid body → 422, and the happy path.
- **11.3 SHOULD** add Playwright end-to-end tests for the critical flows: login → create post → autosave → publish → appears on the public API.
- **11.4 MUST** add a regression test with every bug fix.

### CI (GitHub Actions or equivalent), required on every PR
```
npm ci → npx tsc --noEmit → npm run lint → npm test → next build (without db push)
```

### Git and releases
- **11.5 MUST** branch from `main` (`feat/…`, `fix/…`, `chore/…`) and merge through a reviewed PR. No direct pushes to `main`.
- **11.6 MUST** use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`), as the history already does.
- **11.7 MUST** keep PRs focused: one concern, ideally under ~400 changed lines. Schema changes are called out in the PR description.
- **11.8 MUST** update `README.md`, `docs/*`, or this file in the same PR when behaviour, the API contract, or the environment variables change.
- **11.9 SHOULD** check every Vercel Preview deployment before you merge.

---

## 12. Known violations in this repo

Fix these when you work near them. Severity: 🔴 critical (fix before the next release) · 🟠 high · 🟡 medium.

| # | Sev | Issue | Where | Rule | Fix |
|---|---|---|---|---|---|
| V1 | 🟠 | The shared dev API key `vionsys-cms-public-key-dev-2026` is still accepted in production, because the live website authenticates with it. It is now configurable and can be switched off, and its first use per server instance logs a warning | [validate-public-api-key.ts](src/features/auth/validate-public-api-key.ts), [env.ts](src/lib/env.ts) | 7.9 | **Ops step:** `npm run api-key:create -- "vionsys.com"`, put the printed key in the website's env, deploy the website, then set `PUBLIC_API_DISABLE_DEV_KEY=true` on the CMS |
| V2 | 🟠 | Missing secrets still fall back to the old built-in defaults (so a deploy without them keeps working). Production now logs an error for each fallback | [env.ts](src/lib/env.ts) | 7.4 | **Ops step:** confirm `JWT_SECRET` and `FRONTEND_REVALIDATE_SECRET` are set in Vercel with non-default values (check `/api/cms/env-check`), then set `ENV_STRICT=true` so a missing secret fails the deploy |
| V13 | 🟠 | No rate limiting on login or the public API | — | 7.14 | Upstash Ratelimit or Vercel WAF rules |
| V18 | 🟡 | `SCHEDULED` status has no scheduler. Case studies cannot be unpublished (`publishedAt` never cleared, no `status`) | services, `schema.prisma` | — | Vercel Cron route that publishes due posts. Add `status` to `CaseStudy` |
| V19 | 🟡 | No `error.tsx`, `not-found.tsx`, `loading.tsx`, security headers, or admin `noindex` | `src/app/`, [next.config.ts](next.config.ts) | 9.1, 7.12, 10.5 | Add them |
| V20 | 🟡 | ~120 `any` and some deep relative imports remain outside the API routes and services | across `src/` (mainly `components/`) | 2.2, 1.4 | Fix when you touch the file |
| V21 | 🟡 | Unused dependencies: 12 `@tiptap/*` packages, `lowlight`, `react-hook-form`, `@hookform/resolvers` | [package.json](package.json) | 2.6 | `npm uninstall …` |
| V22 | 🟡 | No `import 'server-only'` guard on server modules | `lib/prisma.ts`, `lib/env.ts`, `features/**` | 3.2 | Add the import |
| V23 | 🟡 | No tests, no CI | — | 11 | Vitest + a GitHub Actions workflow |
| V24 | 🟡 | `robots-generator.ts` disallows `/api/v1/private/` and `/admin/`, which do not exist | [robots-generator.ts](src/features/seo/robots-generator.ts) | — | Align it with the real frontend routes |

**Fixed (2026-11-26):**
- V3: HTML is sanitised server-side with an allow-list ([sanitize-html.ts](src/lib/sanitize-html.ts)).
- V4: request bodies are validated with Zod ([content-input.validation.ts](src/features/shared/content-input.validation.ts)).
- V5: publish and archive permissions are enforced on status changes ([content-permissions.ts](src/features/auth/content-permissions.ts)).
- V6: the `admin123` bootstrap runs only in development or with explicit env credentials.
- V7: API keys are hashed and their expiry is enforced.
- V8: preview CORS uses the allow-list, and preview tokens expire after 7 days, are bound to the content type, and are signed with `PREVIEW_SECRET`.
- V9: the publish checklist is enforced server-side ([publish.service.ts](src/features/publishing/publish.service.ts)).
- V10: all handlers use [handleApiError](src/lib/api-error.ts).
- V11: public routes no longer load `author`, and opt-in `?limit=&page=` pagination was added.
- V12: Vercel Preview builds skip `db push` ([db-push.mjs](scripts/db-push.mjs)).
- V14: renamed to [proxy.ts](src/proxy.ts).
- V15: folder creation needs `media:upload`.
- V16: create endpoints return 201.
- V17: duplicate values return 409.

When you fix one, delete its row in the same PR.

---

## 13. PR checklist

Copy into the PR description:

```markdown
- [ ] `npx tsc --noEmit` and `npm run lint` pass
- [ ] Tests added/updated; `npm test` passes
- [ ] Every new/changed handler: authorizeUser(<permission>) → Zod parse → service → ApiResponse
- [ ] No new `any`, `console.log`, hard-coded secrets, or relative `../../..` imports
- [ ] No server-only module imported into a `'use client'` file
- [ ] Public responses go through a mapper allow-list; no internal error messages leaked
- [ ] Stored HTML is sanitised server-side
- [ ] Schema change? Called out, `db push` plan noted, migration script if data reshaping
- [ ] Env var added? Added to `lib/env.ts` schema, README, docs/ENVIRONMENT.md, Vercel
- [ ] API contract change? docs/API_CONTRACT.md updated (and versioned if breaking)
- [ ] Touched a file listed in §12? Fixed or left a note why not
- [ ] Verified on the Vercel Preview deployment
```
