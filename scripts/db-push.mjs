/**
 * Build-time `prisma db push` guard (rule.md 8.2).
 *
 * Runs `prisma db push` during `npm run build` EXCEPT on Vercel Preview / Development
 * deployments, which may point at the production database. Production builds and
 * local builds behave exactly as before.
 *
 * Override with PRISMA_DB_PUSH:
 *   PRISMA_DB_PUSH=always  → always push (e.g. a Preview with its own database)
 *   PRISMA_DB_PUSH=never   → never push from the build (run `npm run db:push` manually)
 */
import { execSync } from 'node:child_process';

const mode = (process.env.PRISMA_DB_PUSH || 'auto').toLowerCase();
const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined

let shouldPush;
let reason;

if (mode === 'always') {
  shouldPush = true;
  reason = 'PRISMA_DB_PUSH=always';
} else if (mode === 'never') {
  shouldPush = false;
  reason = 'PRISMA_DB_PUSH=never';
} else if (vercelEnv && vercelEnv !== 'production') {
  shouldPush = false;
  reason = `Vercel ${vercelEnv} deployment`;
} else {
  shouldPush = true;
  reason = vercelEnv ? 'Vercel production deployment' : 'non-Vercel build';
}

if (!shouldPush) {
  console.log(`[db-push] Skipping prisma db push (${reason}).`);
  process.exit(0);
}

console.log(`[db-push] Running prisma db push (${reason})...`);
execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
