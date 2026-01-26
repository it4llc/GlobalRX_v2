import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // If user is a customer and trying to access admin areas, redirect to portal
    if (token?.userType === 'customer') {
      if (!path.startsWith('/portal') && !path.startsWith('/api')) {
        return NextResponse.redirect(new URL('/portal/dashboard', req.url));
      }
    }

    // If user is admin and trying to access portal, redirect to admin
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};