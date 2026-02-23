// This is a temporary API route to debug session information
// Create this file at: src/app/api/debug-session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Adjust the path as needed

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({
        error: 'Unauthorized - No session found',
        authenticated: false
      }, { status: 401 });
    }

    // Return session info for debugging (remove in production)
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user?.id,
        email: session.user?.email,
        permissions: session.user?.permissions
      },
      // Check specific permissions relevant to customers
      permissionChecks: {
        hasCustomersView: Boolean(session.user?.permissions?.customers?.view),
        hasCustomersAll: Boolean(session.user?.permissions?.customers?.all)
      }
    });
  } catch (error) {
    console.error('Session debug error:', error);
    return NextResponse.json({ error: 'Error fetching session data' }, { status: 500 });
  }
}