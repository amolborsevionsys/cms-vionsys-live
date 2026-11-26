import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAllowedOrigin } from '@/lib/cors';

/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * 1. CORS for the public API (/api/v1/public/*).
 * 2. Optimistic auth redirect for admin pages. This only checks that a session
 *    cookie exists. Real verification happens server-side in every page and
 *    route handler (rule.md 7.1).
 */

const CORS_METHODS = 'GET, POST, OPTIONS, PUT, DELETE';
const CORS_HEADERS = 'Content-Type, Authorization, x-api-key, x-vionsys-cms-key';

const ADMIN_PREFIXES = ['/dashboard', '/blogs', '/case-studies', '/media', '/seo-tools', '/settings'];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/api/v1/public/')) {
    const allowedOrigin = resolveAllowedOrigin(request.headers.get('origin'));

    if (request.method === 'OPTIONS') {
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      preflight.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
      preflight.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
      preflight.headers.set('Access-Control-Max-Age', '86400');
      preflight.headers.set('Vary', 'Origin');
      return preflight;
    }

    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
    response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
    response.headers.set('Vary', 'Origin');
    return response;
  }

  const token = request.cookies.get('vionsys_cms_token')?.value;
  const isAuthPage = path.startsWith('/login');
  const isAdminPage = ADMIN_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isAdminPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/blogs/:path*',
    '/case-studies/:path*',
    '/media/:path*',
    '/seo-tools/:path*',
    '/settings/:path*',
    '/login',
    '/api/v1/public/:path*',
  ],
};
