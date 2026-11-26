/**
 * Shared CORS origin allow-list (rule.md 7.13).
 * Used by src/proxy.ts (public API) and the draft-preview endpoint.
 * Safe for the proxy runtime: no Node-only imports.
 */

const FALLBACK_ORIGIN = 'https://www.vionsys.com';

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const CONFIGURED_ORIGINS = new Set(
  [
    'https://vionsys.com',
    'https://www.vionsys.com',
    'https://cms-vionsys-live.vercel.app',
    originOf(process.env.VIONSYS_FRONTEND_BASE_URL),
    originOf(process.env.NEXT_PUBLIC_VIONSYS_FRONTEND_BASE_URL),
    originOf(process.env.CMS_BASE_URL),
  ].filter((o): o is string => Boolean(o))
);

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (CONFIGURED_ORIGINS.has(origin)) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // Any https subdomain of vionsys.com (e.g. https://staging.vionsys.com).
  if (url.protocol === 'https:' && url.hostname.endsWith('.vionsys.com')) return true;

  // Local development.
  if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return true;
  }

  return false;
}

/** The value for Access-Control-Allow-Origin: the request origin if allowed, else the default site. */
export function resolveAllowedOrigin(origin: string | null): string {
  return isAllowedOrigin(origin) ? origin : FALLBACK_ORIGIN;
}
