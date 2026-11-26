import crypto from 'crypto';
import { env } from '@/lib/env';

export type PreviewContentType = 'blog' | 'case-study';

/** How long a draft-preview link stays valid. */
const PREVIEW_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Signed, expiring draft-preview tokens (rule.md 7.15).
 *
 * Format: `<expiresAtUnixSeconds>.<hex HMAC-SHA256(type:id:expiresAt)>`
 * The website treats the token as opaque and passes it back to
 * GET /api/cms/preview/<token>?id=…&type=…, which calls validateToken().
 */
export class PreviewTokenService {
  private static sign(id: string, type: PreviewContentType, expiresAt: number): string {
    return crypto
      .createHmac('sha256', env.PREVIEW_SECRET)
      .update(`${type}:${id}:${expiresAt}`)
      .digest('hex');
  }

  static generateToken(id: string, type: PreviewContentType): string {
    const expiresAt = Math.floor(Date.now() / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
    return `${expiresAt}.${this.sign(id, type, expiresAt)}`;
  }

  static validateToken(id: string, type: PreviewContentType, token: string): boolean {
    const [expiresAtRaw, signature] = token.split('.');
    const expiresAt = Number(expiresAtRaw);

    if (!signature || !Number.isInteger(expiresAt)) return false;
    if (expiresAt < Math.floor(Date.now() / 1000)) return false;

    const expected = Buffer.from(this.sign(id, type, expiresAt), 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    if (expected.length !== provided.length) return false;

    return crypto.timingSafeEqual(expected, provided);
  }
}
