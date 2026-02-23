// src/middleware/api-auth.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-utils';
import { logDatabaseError, logPermissionDenied } from '@/lib/logger';

/**
 * Middleware to check authentication for API routes
 */
export async function withAuth(
  handler: (req: NextRequest, session: any) => Promise<NextResponse>,
  req: NextRequest
) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);

    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Call the handler with the session
    return handler(req, session);
  } catch (error) {
    logDatabaseError('auth_middleware', error as Error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Middleware to check permissions for API routes
 */
export async function withPermission(
  resource: string,
  action: string,
  handler: (req: NextRequest, session: any) => Promise<NextResponse>,
  req: NextRequest
) {
  return withAuth(async (req, session) => {
    // Check if user has permission
    if (!hasPermission(session.user, resource, action)) {
      logPermissionDenied(session.user.id, resource, action, req.url);

      return NextResponse.json(
        { 
          error: 'Forbidden', 
          code: 'FORBIDDEN',
          details: `Missing required permission: ${resource}.${action}`
        },
        { status: 403 }
      );
    }

    // Call the handler with the session
    return handler(req, session);
  }, req);
}

/**
 * Example of how to use these middleware functions in an API route:
 * 
 * // GET /api/customers
 * export async function GET(request: NextRequest) {
 *   return withPermission('customers', 'view', async (req, session) => {
 *     // Your handler logic here
 *     return NextResponse.json(data);
 *   }, request);
 * }
 * 
 * // POST /api/customers
 * export async function POST(request: NextRequest) {
 *   return withPermission('customers', 'create', async (req, session) => {
 *     // Your handler logic here
 *     return NextResponse.json(data, { status: 201 });
 *   }, request);
 * }
 */