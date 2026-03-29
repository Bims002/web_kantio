import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // ---- Security headers ----
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=()'
  );

  // ---- Admin API route protection ----
  const { pathname } = request.nextUrl;

  // Skip login and logout routes (public access needed)
  if (pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return response;
  }

  // Protect all /api/admin/* routes: require the session cookie to be present
  // (the actual validation is done server-side in requireAdminRequest)
  if (pathname.startsWith('/api/admin/')) {
    const sessionCookie = request.cookies.get('kantioo_admin_session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        { error: 'Session admin invalide ou expiree.' },
        { status: 401 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Apply to all routes except static files and _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
