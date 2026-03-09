// /GlobalRX_v2/src/lib/services/order-lock.service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { OrderLock } from '@prisma/client';

interface LockResult {
  success: boolean;
  lock?: OrderLock;
  error?: string;
  message?: string;
  lockedBy?: string;
}

interface CheckLockResult {
  isLocked: boolean;
  lock: OrderLock | null;
  canEdit?: boolean;
}

interface CleanupResult {
  success: boolean;
  deletedCount?: number;
  error?: string;
}

/**
 * Order Lock Service - Phase 2d Service Status Change Feature
 *
 * Manages concurrent access control for order editing to prevent multiple users
 * from simultaneously modifying services within the same order. Uses database-level
 * locks with automatic expiration to ensure data consistency during status changes.
 *
 * Business Rules:
 * - Only one user can edit services in an order at a time (order-level locking)
 * - Locks automatically expire after 15 minutes to prevent indefinite holds
 * - Lock holders can extend their own locks via activity detection
 * - Admin users can force-release locks if needed for emergency access
 * - All lock operations are logged for audit purposes
 *
 * Technical Design:
 * - Uses atomic database transactions to prevent race conditions
 * - Employs upsert operations for lock acquisition to handle concurrent requests
 * - Implements proper error handling and cleanup for failed operations
 * - Integrates with structured logging system for operational monitoring
 */
export class OrderLockService {
  // 15-minute lock duration balances user workflow needs with system resource management
  // Long enough for typical service status updates, short enough to prevent indefinite holds
  private readonly LOCK_DURATION_MS = 15 * 60 * 1000;

  /**
   * Acquire a lock on an order for a specific user
   * Uses atomic operations to prevent race conditions
   */
  async acquireLock(orderId: string, userId: string): Promise<LockResult> {
    try {
      const now = new Date();
      const lockExpires = new Date(now.getTime() + this.LOCK_DURATION_MS);

      // Use database transaction to ensure atomic lock acquisition
      // This prevents race conditions where multiple users try to acquire the same lock simultaneously
      const result = await prisma.$transaction(async (tx) => {
        // First check if any lock currently exists for this order
        const existingLock = await tx.orderLock.findUnique({
          where: { orderId }
        });

        // If lock exists and is not expired, handle based on ownership
        if (existingLock && existingLock.lockExpires > now) {
          // Same user requesting lock again - extend the expiration time
          // This handles cases where user refreshes page or makes multiple requests
          if (existingLock.lockedBy === userId) {
            const updatedLock = await tx.orderLock.update({
              where: { orderId },
              data: {
                lockExpires
              }
            });

            return {
              type: 'extended' as const,
              lock: updatedLock
            };
          }

          // Different user has the lock - deny acquisition request
          // This enforces the business rule that only one user can edit an order at a time
          return {
            type: 'locked' as const,
            lockedBy: existingLock.lockedBy
          };
        }

        // Lock doesn't exist or is expired - attempt to create/update the lock
        // Upsert operation is atomic and prevents race conditions between concurrent requests
        const lock = await tx.orderLock.upsert({
          where: { orderId },
          update: {
            lockedBy: userId,
            lockedAt: now,
            lockExpires
          },
          create: {
            orderId,
            lockedBy: userId,
            lockedAt: now,
            lockExpires
          }
        });

        // Verify the lock was acquired by this user
        // (in case another transaction got there first)
        if (lock.lockedBy !== userId) {
          return {
            type: 'locked' as const,
            lockedBy: lock.lockedBy
          };
        }

        return {
          type: 'acquired' as const,
          lock
        };
      });

      // Handle transaction result
      if (result.type === 'locked') {
        return {
          success: false,
          error: 'Order is locked by another user',
          lockedBy: result.lockedBy
        };
      }

      logger.info('Order lock acquired', {
        orderId,
        userId,
        expiresAt: result.lock.lockExpires,
        type: result.type
      });

      return {
        success: true,
        lock: result.lock
      };
    } catch (error) {
      logger.error('Failed to acquire order lock', {
        orderId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to acquire lock'
      };
    }
  }

  /**
   * Release a lock on an order
   */
  async releaseLock(orderId: string, userId: string): Promise<LockResult> {
    try {
      const existingLock = await prisma.orderLock.findUnique({
        where: { orderId }
      });

      if (!existingLock) {
        return {
          success: false,
          error: 'No lock exists for this order'
        };
      }

      if (existingLock.lockedBy !== userId) {
        return {
          success: false,
          error: 'You are not authorized to release this lock'
        };
      }

      await prisma.orderLock.delete({
        where: { orderId }
      });

      logger.info('Order lock released', {
        orderId,
        userId
      });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to release order lock', {
        orderId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to release lock'
      };
    }
  }

  /**
   * Force release a lock (admin only)
   */
  async forceReleaseLock(orderId: string, adminUserId: string, isAdmin: boolean): Promise<LockResult> {
    try {
      if (!isAdmin) {
        return {
          success: false,
          error: 'Admin permission required to force release locks'
        };
      }

      const existingLock = await prisma.orderLock.findUnique({
        where: { orderId }
      });

      if (!existingLock) {
        return {
          success: true,
          message: 'No lock existed for this order'
        };
      }

      await prisma.orderLock.delete({
        where: { orderId }
      });

      logger.warn('Order lock force released by admin', {
        orderId,
        adminUserId,
        previousHolder: existingLock.lockedBy
      });

      return {
        success: true,
        message: `Lock force-released by admin`
      };
    } catch (error) {
      logger.error('Failed to force release order lock', {
        orderId,
        adminUserId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to force release lock'
      };
    }
  }

  /**
   * Check if an order is locked
   */
  async checkLock(orderId: string, currentUserId?: string): Promise<CheckLockResult> {
    try {
      const lock = await prisma.orderLock.findUnique({
        where: { orderId }
      });

      if (!lock) {
        return {
          isLocked: false,
          lock: null,
          canEdit: currentUserId ? true : undefined
        };
      }

      const now = new Date();
      const isExpired = lock.lockExpires <= now;

      if (isExpired) {
        return {
          isLocked: false,
          lock: lock,
          canEdit: currentUserId ? true : undefined
        };
      }

      const canEdit = currentUserId ? lock.lockedBy === currentUserId : undefined;

      return {
        isLocked: true,
        lock,
        canEdit
      };
    } catch (error) {
      logger.error('Failed to check order lock', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isLocked: false,
        lock: null
      };
    }
  }

  /**
   * Extend an existing lock
   */
  async extendLock(orderId: string, userId: string): Promise<LockResult> {
    try {
      const existingLock = await prisma.orderLock.findUnique({
        where: { orderId }
      });

      if (!existingLock) {
        return {
          success: false,
          error: 'No lock exists for this order'
        };
      }

      if (existingLock.lockedBy !== userId) {
        return {
          success: false,
          error: 'You are not authorized to extend this lock'
        };
      }

      const updatedLock = await prisma.orderLock.update({
        where: { orderId },
        data: {
          lockExpires: new Date(Date.now() + this.LOCK_DURATION_MS)
        }
      });

      logger.info('Order lock extended', {
        orderId,
        userId,
        newExpiry: updatedLock.lockExpires
      });

      return {
        success: true,
        lock: updatedLock
      };
    } catch (error) {
      logger.error('Failed to extend order lock', {
        orderId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to extend lock'
      };
    }
  }

  /**
   * Clean up all expired locks
   */
  async cleanupExpiredLocks(): Promise<CleanupResult> {
    try {
      const result = await prisma.orderLock.deleteMany({
        where: {
          lockExpires: {
            lt: new Date()
          }
        }
      });

      if (result.count > 0) {
        logger.info('Expired order locks cleaned up', {
          count: result.count
        });
      }

      return {
        success: true,
        deletedCount: result.count
      };
    } catch (error) {
      logger.error('Failed to cleanup expired locks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Failed to cleanup expired locks'
      };
    }
  }
}