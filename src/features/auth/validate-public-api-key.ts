import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/** SHA-256 hex digest. API keys are high-entropy random strings, so a fast hash is appropriate. */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

let devKeyWarningLogged = false;

/**
 * Validates the public API key sent in `x-vionsys-cms-key` (or `x-api-key`).
 *
 * 1. Shared dev key: accepted while PUBLIC_API_DEV_KEY_ENABLED (default true, because
 *    the live website currently uses it). Logged once per server instance in production.
 * 2. Database keys (ApiKey): stored as SHA-256 hashes (rule.md 7.8). A key stored in
 *    plaintext by older code still matches. Inactive or expired keys are rejected.
 */
export async function validatePublicApiKey(request: NextRequest): Promise<boolean> {
  const apiKey =
    request.headers.get('x-vionsys-cms-key') ||
    request.headers.get('x-api-key');

  if (!apiKey) return false;

  if (env.PUBLIC_API_DEV_KEY_ENABLED && safeEqual(apiKey, env.PUBLIC_API_DEV_KEY)) {
    if (env.IS_PRODUCTION && !devKeyWarningLogged) {
      devKeyWarningLogged = true;
      logger.warn(
        'Public API request authenticated with the shared dev key. Create a real key ' +
          '(node scripts/create-api-key.mjs), switch the website to it, then set PUBLIC_API_DISABLE_DEV_KEY=true.'
      );
    }
    return true;
  }

  const activeKey = await prisma.apiKey.findFirst({
    where: {
      keyHash: { in: [hashApiKey(apiKey), apiKey] },
      isActive: true,
    },
    select: { id: true, expiresAt: true },
  });

  if (!activeKey) return false;
  if (activeKey.expiresAt && activeKey.expiresAt.getTime() < Date.now()) return false;

  return true;
}
