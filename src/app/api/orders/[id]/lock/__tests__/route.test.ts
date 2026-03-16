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

// /GlobalRX_v2/src/app/api/orders/[id]/lock/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE, GET } from '../route';
import { getServerSession } from 'next-auth';
import { OrderLockService } from '@/lib/services/order-lock.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock OrderLockService
const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();
const mockCheckLock = vi.fn();
const mockForceReleaseLock = vi.fn();
const mockExtendLock = vi.fn();

vi.mock('@/lib/services/order-lock.service', () => ({
  OrderLockService: vi.fn(function() {
    return {
      acquireLock: mockAcquireLock,
      releaseLock: mockReleaseLock,
      checkLock: mockCheckLock,
      forceReleaseLock: mockForceReleaseLock,
      extendLock: mockExtendLock
    };
  })
}));

describe('Order Lock API Routes', () => {
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = 'user-456';
  const mockSession = {
    user: {
      id: mockUserId,
      email: 'user@example.com',
      type: 'internal',
      permissions: { fulfillment: true }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/orders/[id]/lock', () => {
    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 403 when user lacks fulfillment permission', async () => {
        const noPermissionSession = {
          user: {
            id: mockUserId,
            email: 'user@example.com',
            type: 'internal',
            permissions: {}
          }
        };

        (getServerSession as any).mockResolvedValue(noPermissionSession);

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Insufficient permissions');
      });
    });

    describe('lock acquisition', () => {
      beforeEach(() => {
        (getServerSession as any).mockResolvedValue(mockSession);
      });

      it('should successfully acquire lock when available', async () => {
        const lock = {
          orderId: mockOrderId,
          lockedBy: mockUserId,
          lockedAt: new Date(),
          lockExpires: new Date(Date.now() + 15 * 60 * 1000)
        };

        mockAcquireLock.mockResolvedValue({
          success: true,
          lock
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.lock.orderId).toBe(mockOrderId);
        expect(data.lock.lockedBy).toBe(mockUserId);
        expect(mockAcquireLock).toHaveBeenCalledWith(mockOrderId, mockUserId);
      });

      it('should return 423 when lock is held by another user', async () => {
        mockAcquireLock.mockResolvedValue({
          success: false,
          error: 'Order is locked by another user',
          lockedBy: 'other-user-id'
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(423);
        expect(data.error).toContain('locked by another user');
        expect(data.lockedBy).toBe('other-user-id');
      });

      it('should extend lock when already held by same user', async () => {
        const extendedLock = {
          orderId: mockOrderId,
          lockedBy: mockUserId,
          lockedAt: new Date(Date.now() - 5 * 60 * 1000),
          lockExpires: new Date(Date.now() + 15 * 60 * 1000)
        };

        mockAcquireLock.mockResolvedValue({
          success: true,
          lock: extendedLock
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.lock.lockedBy).toBe(mockUserId);
      });

      it('should handle database errors', async () => {
        mockAcquireLock.mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'POST'
        });

        const response = await POST(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to acquire lock');
      });
    });
  });

  describe('DELETE /api/orders/[id]/lock', () => {
    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('lock release', () => {
      beforeEach(() => {
        (getServerSession as any).mockResolvedValue(mockSession);
      });

      it('should successfully release lock held by user', async () => {
        mockReleaseLock.mockResolvedValue({
          success: true
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe('Lock released successfully');
        expect(mockReleaseLock).toHaveBeenCalledWith(mockOrderId, mockUserId);
      });

      it('should return 404 when no lock exists', async () => {
        mockReleaseLock.mockResolvedValue({
          success: false,
          error: 'No lock exists for this order'
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toContain('No lock exists');
      });

      it('should return 403 when trying to release lock held by another user', async () => {
        mockReleaseLock.mockResolvedValue({
          success: false,
          error: 'You are not authorized to release this lock'
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain('not authorized');
      });

      it('should allow admin to force release lock', async () => {
        const adminSession = {
          user: {
            id: 'admin-id',
            email: 'admin@example.com',
            type: 'internal',
            permissions: { fulfillment: true, admin: true }
          }
        };

        (getServerSession as any).mockResolvedValue(adminSession);

        mockForceReleaseLock.mockResolvedValue({
          success: true
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock?force=true', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain('force-released');
        expect(mockForceReleaseLock).toHaveBeenCalledWith(
          mockOrderId,
          'admin-id',
          true
        );
      });

      it('should handle database errors', async () => {
        mockReleaseLock.mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'DELETE'
        });

        const response = await DELETE(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to release lock');
      });
    });
  });

  describe('GET /api/orders/[id]/lock', () => {
    describe('authentication', () => {
      it('should return 401 when not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('lock status check', () => {
      beforeEach(() => {
        (getServerSession as any).mockResolvedValue(mockSession);
      });

      it('should return lock info when locked', async () => {
        const lock = {
          orderId: mockOrderId,
          lockedBy: 'other-user-id',
          lockedAt: new Date(Date.now() - 5 * 60 * 1000),
          lockExpires: new Date(Date.now() + 10 * 60 * 1000)
        };

        mockCheckLock.mockResolvedValue({
          isLocked: true,
          lock,
          canEdit: false
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.isLocked).toBe(true);
        expect(data.lock.lockedBy).toBe('other-user-id');
        expect(data.canEdit).toBe(false);
        expect(mockCheckLock).toHaveBeenCalledWith(mockOrderId, mockUserId);
      });

      it('should indicate user can edit when they hold the lock', async () => {
        const lock = {
          orderId: mockOrderId,
          lockedBy: mockUserId,
          lockedAt: new Date(Date.now() - 5 * 60 * 1000),
          lockExpires: new Date(Date.now() + 10 * 60 * 1000)
        };

        mockCheckLock.mockResolvedValue({
          isLocked: true,
          lock,
          canEdit: true
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.isLocked).toBe(true);
        expect(data.canEdit).toBe(true);
        expect(data.lock.lockedBy).toBe(mockUserId);
      });

      it('should return not locked when no lock exists', async () => {
        mockCheckLock.mockResolvedValue({
          isLocked: false,
          lock: null,
          canEdit: true
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.isLocked).toBe(false);
        expect(data.lock).toBeNull();
        expect(data.canEdit).toBe(true);
      });

      it('should handle expired locks', async () => {
        mockCheckLock.mockResolvedValue({
          isLocked: false,
          lock: null,
          canEdit: true
        });

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.isLocked).toBe(false);
        expect(data.canEdit).toBe(true);
      });

      it('should handle database errors', async () => {
        mockCheckLock.mockRejectedValue(new Error('Database error'));

        const request = new Request('http://localhost/api/orders/550e8400-e29b-41d4-a716-446655440001/lock', {
          method: 'GET'
        });

        const response = await GET(request, { params: { id: mockOrderId } });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to check lock status');
      });
    });
  });
});