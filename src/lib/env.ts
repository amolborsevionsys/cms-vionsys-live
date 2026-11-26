/**
 * Single source of truth for environment configuration (rule.md 1.7 / 7.4).
 * Server-only: never import this from a 'use client' module.
 *
 * Backwards-compatibility note:
 * Secrets still fall back to the historical built-in defaults so that an
 * existing deployment that never set them keeps working. In production every
 * fallback is logged as an error. Set ENV_STRICT=true once all variables are
 * configured in Vercel to turn missing secrets into a hard startup failure.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isStrict = process.env.ENV_STRICT === 'true';

// Historical defaults. Kept only for backwards compatibility (see note above).
const LEGACY_DEFAULTS = {
  JWT_SECRET: 'vionsys-cms-jwt-super-secret-key-2026',
  FRONTEND_REVALIDATE_SECRET: 'vionsys-cms-revalidate-secret-2026',
  PUBLIC_API_DEV_KEY: 'vionsys-cms-public-key-dev-2026',
} as const;

function read(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function secret(key: keyof typeof LEGACY_DEFAULTS): string {
  const value = read(key);
  if (value) return value;

  if (isProduction && isStrict) {
    throw new Error(`[env] ${key} is required in production (ENV_STRICT=true).`);
  }
  if (isProduction) {
    console.error(
      `[env] ${key} is not set. Falling back to an insecure built-in default. ` +
        `Set ${key} in the Vercel project settings.`
    );
  }
  return LEGACY_DEFAULTS[key];
}

const JWT_SECRET = secret('JWT_SECRET');

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: isProduction,

  DATABASE_URL: read('DATABASE_URL') || 'mongodb://localhost:27017/vionsys_cms',

  /** Signs session JWTs. */
  JWT_SECRET,
  /** Signs draft-preview tokens. Falls back to JWT_SECRET so existing setups keep working. */
  PREVIEW_SECRET: read('PREVIEW_SECRET') || JWT_SECRET,

  VIONSYS_FRONTEND_BASE_URL: read('VIONSYS_FRONTEND_BASE_URL') || 'https://www.vionsys.com',
  CMS_BASE_URL: read('CMS_BASE_URL') || 'https://cms-vionsys-live.vercel.app',
  FRONTEND_REVALIDATE_URL:
    read('FRONTEND_REVALIDATE_URL') || 'https://www.vionsys.com/api/revalidate/cms',
  FRONTEND_REVALIDATE_SECRET: secret('FRONTEND_REVALIDATE_SECRET'),

  /**
   * Shared "dev" public API key. The live website currently authenticates with it,
   * so it stays enabled unless PUBLIC_API_DISABLE_DEV_KEY=true. Switch the website
   * to a real key (scripts/create-api-key.mjs) and then disable this.
   */
  PUBLIC_API_DEV_KEY: read('PUBLIC_API_DEV_KEY') || LEGACY_DEFAULTS.PUBLIC_API_DEV_KEY,
  PUBLIC_API_DEV_KEY_ENABLED: read('PUBLIC_API_DISABLE_DEV_KEY') !== 'true',

  /** Optional first-admin bootstrap for an empty database (see auth/login route). */
  BOOTSTRAP_ADMIN_EMAIL: read('CMS_BOOTSTRAP_ADMIN_EMAIL'),
  BOOTSTRAP_ADMIN_PASSWORD: read('CMS_BOOTSTRAP_ADMIN_PASSWORD'),
};

if (!read('DATABASE_URL') && isProduction) {
  console.warn('WARNING: DATABASE_URL is not set in environment variables! Using default fallback.');
}
