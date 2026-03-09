// /GlobalRX_v2/src/app/api/orders/[id]/lock/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderLockService } from '@/lib/services/order-lock.service';
import logger from '@/lib/logger';

/**
 * POST /api/orders/[id]/lock
 *
 * Acquire a lock on an order
 *
 * Required permissions: fulfillment
 *
 * Returns: { success: boolean, lock?: OrderLock, error?: string }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   423: Order already locked by another user
 *   500: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check
    const hasFulfillmentPermission =
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment?.['*'] === true ||
      session.user.permissions?.fulfillment?.view === true;

    if (!hasFulfillmentPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const orderId = params.id;
    const userId = session.user.id;

    // Step 3: Acquire lock
    const lockService = new OrderLockService();
    const result = await lockService.acquireLock(orderId, userId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          lockedBy: result.lockedBy
        },
        { status: 423 }
      );
    }

    logger.info('Order lock acquired via API', {
      orderId,
      userId
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    logger.error('Failed to acquire order lock via API', {
      orderId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Failed to acquire lock' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]/lock
 *
 * Release a lock on an order
 *
 * Required permissions: fulfillment
 * Query params:
 *   - force?: boolean (admin only)
 *
 * Returns: { success: boolean, message?: string, error?: string }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: No lock exists
 *   500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check
    const hasFulfillmentPermission =
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment?.['*'] === true ||
      session.user.permissions?.fulfillment?.view === true;

    if (!hasFulfillmentPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const orderId = params.id;
    const userId = session.user.id;
    const isAdmin = session.user.permissions?.admin === true || session.user.type === 'admin';

    // Check for force parameter
    const { searchParams } = new URL(request.url);
    const forceRelease = searchParams.get('force') === 'true';

    const lockService = new OrderLockService();

    let result;
    if (forceRelease) {
      // Admin force release
      result = await lockService.forceReleaseLock(orderId, userId, isAdmin);
    } else {
      // Normal release
      result = await lockService.releaseLock(orderId, userId);
    }

    if (!result.success) {
      const status = result.error?.includes('No lock exists') ? 404 : 403;
      return NextResponse.json(
        { error: result.error },
        { status }
      );
    }

    logger.info('Order lock released via API', {
      orderId,
      userId,
      forced: forceRelease
    });

    const message = result.message || (forceRelease ? 'Lock force-released by admin' : 'Lock released successfully');

    return NextResponse.json({
      ...result,
      message
    }, { status: 200 });

  } catch (error) {
    logger.error('Failed to release order lock via API', {
      orderId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Failed to release lock' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[id]/lock
 *
 * Check lock status for an order
 *
 * Required permissions: fulfillment
 *
 * Returns: { isLocked: boolean, lock?: OrderLock, canEdit?: boolean }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   500: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check
    const hasFulfillmentPermission =
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment?.['*'] === true ||
      session.user.permissions?.fulfillment?.view === true;

    if (!hasFulfillmentPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const orderId = params.id;
    const userId = session.user.id;

    // Step 3: Check lock status
    const lockService = new OrderLockService();
    const result = await lockService.checkLock(orderId, userId);

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    logger.error('Failed to check order lock via API', {
      orderId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Failed to check lock status' },
      { status: 500 }
    );
  }
}