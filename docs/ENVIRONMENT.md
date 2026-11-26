# Vionsys CMS: Environment Variables Configuration

This file outlines the configuration variables needed in a local `.env` file to run the CMS.

Create a `.env` file at the repository root (next to `package.json`). The values below are **examples only**. Use your own random secrets in every shared environment:

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

# Optional hardening switches (all default to the previous behaviour)
# PREVIEW_SECRET=""                  # signs draft-preview tokens; falls back to JWT_SECRET
# PUBLIC_API_DISABLE_DEV_KEY="true"  # turn off the legacy shared dev API key
# ENV_STRICT="true"                  # production: fail startup if JWT/revalidate secrets are missing
# CMS_BOOTSTRAP_ADMIN_EMAIL=""       # first admin on an EMPTY production database
# CMS_BOOTSTRAP_ADMIN_PASSWORD=""
# PRISMA_DB_PUSH="auto"              # auto | always | never (build-time prisma db push)
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
| Build command | `npm run build`. Runs Prisma generate, then `db push` (production only, skipped on Preview), then `next build` |

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
