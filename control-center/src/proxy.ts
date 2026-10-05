import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthenticatedOperator } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public authentication endpoints and webhook receivers
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks/brevo') ||
    pathname.startsWith('/api/webhooks/n8n')
  ) {
    return NextResponse.next();
  }

  // 2. Verify operator session
  const session = getAuthenticatedOperator(request);

  if (!session.authenticated) {
    // API routes return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Operator authentication required' },
        { status: 401 }
      );
    }

    // Page routes redirect to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Set operator identity header for downstream tracking
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-operator-identity', session.username || 'operator');

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (.svg, .png, .jpg)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
