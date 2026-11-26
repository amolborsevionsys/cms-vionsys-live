/**
 * Creates a public API key for the website (rule.md 7.8).
 * Only the SHA-256 hash is stored. The plaintext key is printed ONCE: copy it into
 * the website's environment (the value it sends as `x-vionsys-cms-key`).
 *
 * Usage:
 *   node scripts/create-api-key.mjs "vionsys.com production"
 *   node scripts/create-api-key.mjs "staging" --expires-days=90
 *
 * Uses DATABASE_URL from .env (Prisma loads it automatically). Check which
 * database that points at before running.
 */
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const expiresArg = args.find((a) => a.startsWith('--expires-days='));

if (!name) {
  console.error('Usage: node scripts/create-api-key.mjs "<key name>" [--expires-days=N]');
  process.exit(1);
}

const expiresDays = expiresArg ? Number(expiresArg.split('=')[1]) : null;
if (expiresArg && (!Number.isFinite(expiresDays) || expiresDays <= 0)) {
  console.error('--expires-days must be a positive number');
  process.exit(1);
}

const plaintext = `vcms_${crypto.randomBytes(32).toString('base64url')}`;
const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86_400_000) : null;

const prisma = new PrismaClient();

try {
  const created = await prisma.apiKey.create({
    data: { name, keyHash, role: 'VIEWER', isActive: true, expiresAt },
  });

  console.log('\nAPI key created.');
  console.log(`  id:       ${created.id}`);
  console.log(`  name:     ${created.name}`);
  console.log(`  expires:  ${expiresAt ? expiresAt.toISOString() : 'never'}`);
  console.log('\n  Key (shown once, store it now):\n');
  console.log(`  ${plaintext}\n`);
} catch (err) {
  console.error('Failed to create API key:', err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
