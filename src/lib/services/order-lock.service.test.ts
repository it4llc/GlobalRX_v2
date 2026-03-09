/**
 * SPEC CONFIRMATION BLOCK
 * Specification: docs/specs/service-comment-status-change.md
 *
 * Key Requirements:
 * - Internal users only can change status (Phase 2d)
 * - Status dropdown separate from comment form
 * - All 7 statuses available (Draft, Submitted, Processing, Missing Information, Completed, Cancelled, Cancelled-DNB)
 * - Terminal status changes require confirmation (Completed, Cancelled, Cancelled-DNB)
 * - Status changes recorded as ServiceComment with isStatusChange=true
 * - Order locking prevents concurrent edits
 * - 15-minute lock timeout
 * - Admin can force-release locks
 */

// /GlobalRX_v2/src/lib/services/order-lock.service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderLockService } from './order-lock.service';
import { prisma } from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderLock: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('OrderLockService', () => {
  let service: OrderLockService;
  const mockOrderId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUserId = '987fcdeb-51a2-43d1-9876-543210fedcba';
  const mockAdminUserId = 'admin-id-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderLockService();
    // Mock Date.now() for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('acquireLock', () => {
    it('should create a new lock when none exists', async () => {
      const expectedLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 15 * 60 * 1000)
      };

      // Mock the transaction to simulate no existing lock and successful upsert
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          orderLock: {
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue(expectedLock)
          }
        };
        return fn(tx);
      });

      const result = await service.acquireLock(mockOrderId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.lock).toEqual(expectedLock);
    });

    it('should return existing lock if held by same user', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(Date.now() - 5 * 60 * 1000),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      const updatedLock = {
        ...existingLock,
        lockExpires: new Date(Date.now() + 15 * 60 * 1000)
      };

      // Mock the transaction to simulate existing lock held by same user
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          orderLock: {
            findUnique: vi.fn().mockResolvedValue(existingLock),
            update: vi.fn().mockResolvedValue(updatedLock)
          }
        };
        return fn(tx);
      });

      const result = await service.acquireLock(mockOrderId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.lock?.lockedBy).toBe(mockUserId);
    });

    it('should fail when locked by another user', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(Date.now() - 5 * 60 * 1000),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      // Mock the transaction to simulate lock held by another user
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          orderLock: {
            findUnique: vi.fn().mockResolvedValue(existingLock)
          }
        };
        return fn(tx);
      });

      const result = await service.acquireLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Order is locked by another user');
      expect(result.lockedBy).toBe('other-user-id');
    });

    it('should acquire lock if existing lock is expired', async () => {
      const expiredLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(Date.now() - 20 * 60 * 1000),
        lockExpires: new Date(Date.now() - 5 * 60 * 1000) // Expired 5 minutes ago
      };

      const newLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 15 * 60 * 1000)
      };

      // Mock the transaction to simulate expired lock that gets replaced
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          orderLock: {
            findUnique: vi.fn().mockResolvedValue(expiredLock),
            upsert: vi.fn().mockResolvedValue(newLock)
          }
        };
        return fn(tx);
      });

      const result = await service.acquireLock(mockOrderId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.lock?.lockedBy).toBe(mockUserId);
    });

    it('should handle database errors gracefully', async () => {
      // Mock transaction to throw an error
      (prisma.$transaction as any).mockRejectedValue(new Error('Database error'));

      const result = await service.acquireLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to acquire lock');
    });
  });

  describe('releaseLock', () => {
    it('should release lock when held by the requesting user', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);
      (prisma.orderLock.delete as any).mockResolvedValue(existingLock);

      const result = await service.releaseLock(mockOrderId, mockUserId);

      expect(result.success).toBe(true);
      expect(prisma.orderLock.delete).toHaveBeenCalledWith({
        where: { orderId: mockOrderId }
      });
    });

    it('should fail when no lock exists', async () => {
      (prisma.orderLock.findUnique as any).mockResolvedValue(null);

      const result = await service.releaseLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No lock exists');
      expect(prisma.orderLock.delete).not.toHaveBeenCalled();
    });

    it('should fail when lock is held by another user', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.releaseLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authorized');
      expect(prisma.orderLock.delete).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (prisma.orderLock.findUnique as any).mockRejectedValue(new Error('Database error'));

      const result = await service.releaseLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to release lock');
    });
  });

  describe('forceReleaseLock', () => {
    it('should allow admin to release any lock', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);
      (prisma.orderLock.delete as any).mockResolvedValue(existingLock);

      const result = await service.forceReleaseLock(mockOrderId, mockAdminUserId, true);

      expect(result.success).toBe(true);
      expect(prisma.orderLock.delete).toHaveBeenCalledWith({
        where: { orderId: mockOrderId }
      });
    });

    it('should fail when non-admin tries to force release', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.forceReleaseLock(mockOrderId, mockUserId, false);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Admin permission required');
      expect(prisma.orderLock.delete).not.toHaveBeenCalled();
    });

    it('should succeed even when no lock exists', async () => {
      (prisma.orderLock.findUnique as any).mockResolvedValue(null);

      const result = await service.forceReleaseLock(mockOrderId, mockAdminUserId, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain('No lock existed');
    });
  });

  describe('checkLock', () => {
    it('should return lock info when lock exists', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.checkLock(mockOrderId);

      expect(result.isLocked).toBe(true);
      expect(result.lock).toEqual(existingLock);
      expect(result.canEdit).toBeUndefined(); // No userId provided
    });

    it('should indicate when current user can edit', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.checkLock(mockOrderId, mockUserId);

      expect(result.isLocked).toBe(true);
      expect(result.canEdit).toBe(true);
    });

    it('should indicate when current user cannot edit', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.checkLock(mockOrderId, mockUserId);

      expect(result.isLocked).toBe(true);
      expect(result.canEdit).toBe(false);
    });

    it('should return not locked when no lock exists', async () => {
      (prisma.orderLock.findUnique as any).mockResolvedValue(null);

      const result = await service.checkLock(mockOrderId);

      expect(result.isLocked).toBe(false);
      expect(result.lock).toBeNull();
      expect(result.canEdit).toBeUndefined();
    });

    it('should treat expired locks as not locked', async () => {
      const expiredLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(Date.now() - 20 * 60 * 1000),
        lockExpires: new Date(Date.now() - 5 * 60 * 1000) // Expired
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(expiredLock);

      const result = await service.checkLock(mockOrderId, mockUserId);

      expect(result.isLocked).toBe(false);
      expect(result.canEdit).toBe(true);
    });
  });

  describe('cleanupExpiredLocks', () => {
    it('should delete all expired locks', async () => {
      (prisma.orderLock.deleteMany as any).mockResolvedValue({ count: 3 });

      const result = await service.cleanupExpiredLocks();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(3);
      expect(prisma.orderLock.deleteMany).toHaveBeenCalledWith({
        where: {
          lockExpires: {
            lt: expect.any(Date)
          }
        }
      });
    });

    it('should handle no expired locks', async () => {
      (prisma.orderLock.deleteMany as any).mockResolvedValue({ count: 0 });

      const result = await service.cleanupExpiredLocks();

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it('should handle database errors', async () => {
      (prisma.orderLock.deleteMany as any).mockRejectedValue(new Error('Database error'));

      const result = await service.cleanupExpiredLocks();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to cleanup expired locks');
    });
  });

  describe('extendLock', () => {
    it('should extend lock expiration time', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: mockUserId,
        lockedAt: new Date(Date.now() - 5 * 60 * 1000),
        lockExpires: new Date(Date.now() + 5 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const extendedLock = {
        ...existingLock,
        lockExpires: new Date(Date.now() + 15 * 60 * 1000)
      };

      (prisma.orderLock.update as any).mockResolvedValue(extendedLock);

      const result = await service.extendLock(mockOrderId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.lock?.lockExpires.getTime()).toBeGreaterThan(existingLock.lockExpires.getTime());
      expect(prisma.orderLock.update).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        data: { lockExpires: expect.any(Date) }
      });
    });

    it('should fail when lock held by another user', async () => {
      const existingLock = {
        orderId: mockOrderId,
        lockedBy: 'other-user-id',
        lockedAt: new Date(),
        lockExpires: new Date(Date.now() + 10 * 60 * 1000)
      };

      (prisma.orderLock.findUnique as any).mockResolvedValue(existingLock);

      const result = await service.extendLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not authorized');
      expect(prisma.orderLock.update).not.toHaveBeenCalled();
    });

    it('should fail when no lock exists', async () => {
      (prisma.orderLock.findUnique as any).mockResolvedValue(null);

      const result = await service.extendLock(mockOrderId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No lock exists');
      expect(prisma.orderLock.update).not.toHaveBeenCalled();
    });
  });
});