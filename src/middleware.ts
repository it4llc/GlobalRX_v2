import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If user is a customer and trying to access admin areas, redirect to fulfillment
    // BUG FIX (March 9, 2026): Customers now use /fulfillment dashboard like all other users
    // IMPORTANT: Exclude /candidate paths - they use separate authentication
    if (token?.userType === 'customer') {
      if (!path.startsWith('/portal') && !path.startsWith('/api') && !path.startsWith('/fulfillment') && !path.startsWith('/candidate')) {
        return NextResponse.redirect(new URL('/fulfillment', req.url));
      }
    }

    // If user is admin and trying to access portal, redirect to admin
    // Note: /candidate paths are already allowed via the authorized callback below
    if (token?.userType === 'admin') {
      if (path.startsWith('/portal')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Allow access to login page
        if (path === '/login') {
          return true;
        }

        // Allow access to candidate portal (candidates use token auth, not session auth)
        if (path.startsWith('/candidate/')) {
          return true;
        }

        // Require authentication for all other pages
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth endpoints)
     * - api/candidate (candidate endpoints - use token auth, not session)
     * - api/health (health check endpoint)
     * - api/ready (readiness check endpoint)
     * - api/status (status endpoint - has its own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|api/candidate|api/health|api/ready|api/status|_next/static|_next/image|favicon.ico|public).*)',
  ],
};