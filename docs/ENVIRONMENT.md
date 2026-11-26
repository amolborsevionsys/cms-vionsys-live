# Vionsys CMS: Environment Variables Configuration

This file outlines the configuration variables needed in a local `.env` file to run the CMS.

Create a `.env` file at the root of the `cms` folder:

```bash
# Database connections URL (MongoDB — must match prisma/schema.prisma)
DATABASE_URL="mongodb://localhost:27017/vionsys_cms"

# Session JWT authentication secret key
JWT_SECRET="vionsys-cms-jwt-super-secret-key-2026"

# Frontend website domains for URL previews & webhooks
VIONSYS_FRONTEND_BASE_URL="https://www.vionsys.com"
CMS_BASE_URL="https://cms-vionsys-live.vercel.app"

# Revalidation Webhook secrets
FRONTEND_REVALIDATE_URL="https://www.vionsys.com/api/revalidate/cms"
FRONTEND_REVALIDATE_SECRET="vionsys-cms-revalidate-secret-2026"

# AWS S3 (media uploads) — required for /api/cms/upload
REGION="ap-south-1"
BUCKET="vionsys-wms"
ACCESS_KEY_ID=""
SECRET_ACCESS_KEY=""
```

## Environment diagnostics

While logged in, open:

`GET /api/cms/env-check`

Shows which variables are configured, their source (`env` / `default` / `missing`), and masked values for secrets.

In local development only, append `?reveal=1` to see full raw values.

## Vercel deployment

Use this repository root as the Vercel project root (the folder that contains `package.json`, `next.config.ts`, and `src/app/`).

| Setting | Value |
|--------|--------|
| Git repository | `pawanvionsys/cms-vionsys-live` (or this repo mirrored to your org) |
| Production branch | `main` |
| **Root Directory** | **Leave empty** — do not set `src`, `docs`, or `cms` |
| Build command | `npm run build` (runs Prisma generate, `db push`, then `next build`) |

If the build fails with **“Couldn't find any `pages` or `app` directory”**, the Root Directory is almost always wrong: Vercel is building a subfolder that is not the Next.js app. Clear **Root Directory** in **Project Settings → General** and redeploy.

Required Vercel environment variables (Production and Preview): `DATABASE_URL`, `JWT_SECRET`, `REGION`, `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, plus revalidation URLs/secrets as needed.

## Running Locally

1. Set up MongoDB and configure `DATABASE_URL`. For Atlas, use a `mongodb+srv://...` connection string.
2. Generate Prisma Client bindings:
   ```bash
   npx prisma generate
   ```
3. Push the database models:
   ```bash
   npx prisma db push
   ```
4. Start Next.js development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`. You can log in using:
   - Email: `admin@vionsys.com`
   - Password: `admin123`
   (The login route will auto-create this account on first login attempt if it doesn't exist).

## AI document import and Ask AI (Google Gemini)

Used by the case-study builder's **AI** tab: import a PDF or DOCX into the template, and ask questions answered only from that case study's uploaded documents.

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | for AI features | Server-only key from [AI Studio](https://aistudio.google.com/apikey). New keys start with `AQ.` (Google's "Auth key" format since mid-2026); older keys start with `AIza`. Both work. Use **Copy key** on the key's details page: the full key is 53 characters, and the list view shows a shortened version. |
| `GEMINI_MODEL` | | Generation model. Default `gemini-3.5-flash-lite` |
| `GEMINI_EMBEDDING_MODEL` | | Embedding model for search. Default `gemini-embedding-001` (768 dimensions stored) |
| `GEMINI_PROVIDER` | | Leave unset for AI Studio keys. Set `vertex` only to use a Google Cloud Vertex AI key (enable the "Agent Platform" API in that project; billed via Google Cloud) |

> On the AI Studio **free tier**, Google may use submitted content to improve its products. The upload screen warns editors not to upload confidential client documents. Use a paid (billing-enabled) key, or Vertex AI, for confidential material.

Limits: files up to 4 MB (Vercel's request-body limit); PDFs are sent to Gemini as files, DOCX as converted HTML. Original files are **not** stored. Only their extracted text is kept for search, because the media bucket serves public URLs.
