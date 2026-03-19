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

// /GlobalRX_v2/src/app/api/services/[id]/status/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { OrderLockService } from '@/lib/services/order-lock.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    serviceComment: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock OrderLockService
const mockCheckLock = vi.fn();
const mockAcquireLock = vi.fn();

vi.mock('@/lib/services/order-lock.service', () => ({
  OrderLockService: vi.fn(function() {
    return {
      checkLock: mockCheckLock,
      acquireLock: mockAcquireLock
    };
  })
}));

describe('PUT /api/services/[id]/status', () => {
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockUserId = 'user-456';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440003';
  const mockSession = {
    user: {
      id: mockUserId,
      email: 'user@example.com',
      userType: 'internal',
      permissions: { fulfillment: true }
    }
  };

  const mockService = {
    id: mockServiceId,
    orderId: mockOrderId,
    status: 'Draft',
    productType: 'Background Check',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: mockOrderId,
      clientName: 'John Doe'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks fulfillment permission', async () => {
      const noPermissionSession = {
        user: {
          id: mockUserId,
          email: 'user@example.com',
          userType: 'internal',
          permissions: {}
        }
      };

      (getServerSession as any).mockResolvedValue(noPermissionSession);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when vendor user tries to change status', async () => {
      const vendorSession = {
        user: {
          id: 'vendor-123',
          email: 'vendor@example.com',
          userType: 'vendor',
          permissions: { fulfillment: true }
        }
      };

      (getServerSession as any).mockResolvedValue(vendorSession);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Internal users only');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should return 400 when status is missing', async () => {
      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({})
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('status');
    });

    it('should return 400 when status is invalid', async () => {
      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'InvalidStatus'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid enum value');
    });

    it('should return 400 when comment exceeds 1000 characters', async () => {
      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing',
          comment: 'a'.repeat(1001)
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('1000 characters');
    });

    it('should return 404 when service does not exist', async () => {
      (prisma.orderItem.findUnique as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Service not found');
    });
  });

  describe('order locking', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      (prisma.orderItem.findUnique as any).mockResolvedValue(mockService);
    });

    it('should check lock status before allowing status change', async () => {
      mockCheckLock.mockResolvedValue({
        isLocked: false,
        canEdit: true
      });

      mockAcquireLock.mockResolvedValue({
        success: true,
        lock: {
          orderId: mockOrderId,
          lockedBy: mockUserId,
          lockedAt: new Date(),
          lockExpires: new Date(Date.now() + 15 * 60 * 1000)
        }
      });

      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        return await fn(prisma);
      });

      (prisma.orderItem.update as any).mockResolvedValue({
        ...mockService,
        status: 'Processing'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Draft',
        statusChangedTo: 'Processing',
        comment: null,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockCheckLock).toHaveBeenCalledWith(mockOrderId, mockUserId);
    });

    it('should return 423 when order is locked by another user', async () => {
      mockCheckLock.mockResolvedValue({
        isLocked: true,
        canEdit: false,
        lock: {
          orderId: mockOrderId,
          lockedBy: 'other-user-id',
          lockedAt: new Date(),
          lockExpires: new Date(Date.now() + 10 * 60 * 1000)
        }
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(423);
      expect(data.error).toContain('locked by another user');
      expect(data.lockedBy).toBe('other-user-id');
    });

    it('should automatically acquire lock if not locked', async () => {
      mockCheckLock.mockResolvedValue({
        isLocked: false,
        canEdit: true
      });

      mockAcquireLock.mockResolvedValue({
        success: true,
        lock: {
          orderId: mockOrderId,
          lockedBy: mockUserId,
          lockedAt: new Date(),
          lockExpires: new Date(Date.now() + 15 * 60 * 1000)
        }
      });

      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        return await fn(prisma);
      });

      (prisma.orderItem.update as any).mockResolvedValue({
        ...mockService,
        status: 'Processing'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Draft',
        statusChangedTo: 'Processing',
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(200);
      expect(mockAcquireLock).toHaveBeenCalledWith(mockOrderId, mockUserId);
    });
  });

  describe('status change logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      (prisma.orderItem.findUnique as any).mockResolvedValue(mockService);
      mockCheckLock.mockResolvedValue({ isLocked: false, canEdit: true });
      mockAcquireLock.mockResolvedValue({ success: true });
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        return await fn(prisma);
      });
    });

    it('should update service status and create audit entry', async () => {
      (prisma.orderItem.update as any).mockResolvedValue({
        ...mockService,
        status: 'Processing',
        updatedAt: new Date(),
        updatedById: mockUserId
      });

      const auditEntry = {
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Draft',
        statusChangedTo: 'Processing',
        comment: null,
        createdBy: mockUserId,
        createdAt: new Date()
      };

      (prisma.serviceComment.create as any).mockResolvedValue(auditEntry);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service.status).toBe('Processing');
      expect(data.auditEntry.isStatusChange).toBe(true);
      expect(data.auditEntry.statusChangedFrom).toBe('Draft');
      expect(data.auditEntry.statusChangedTo).toBe('Processing');

      expect(prisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: mockServiceId },
        data: {
          status: 'Processing',
          updatedAt: expect.any(Date),
          updatedById: mockUserId
        }
      });

      expect(prisma.serviceComment.create).toHaveBeenCalledWith({
        data: {
          orderItemId: mockServiceId,
          isStatusChange: true,
          statusChangedFrom: 'Draft',
          statusChangedTo: 'Processing',
          comment: expect.stringMatching(/Status changed from Draft to Processing/),
          createdBy: mockUserId,
          createdAt: expect.any(Date),
          isInternalOnly: false
        }
      });
    });

    it('should include optional comment with status change', async () => {
      (prisma.orderItem.update as any).mockResolvedValue({
        ...mockService,
        status: 'Missing Information'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Draft',
        statusChangedTo: 'Missing Information',
        comment: 'Status changed from Draft to Missing Information. Additional context: Need driver license copy',
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Missing Information',
          comment: 'Need driver license copy'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.auditEntry.comment).toContain('Need driver license copy');

      expect(prisma.serviceComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          comment: expect.stringContaining('Need driver license copy')
        })
      });
    });

    it('should require confirmation when changing from terminal status', async () => {
      const completedService = {
        ...mockService,
        status: 'Completed'
      };

      (prisma.orderItem.findUnique as any).mockResolvedValue(completedService);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('confirmation required');
      expect(data.requiresConfirmation).toBe(true);
      expect(data.currentStatus).toBe('Completed');
      expect(data.message).toContain('This service is currently Completed');
    });

    it('should allow reopening terminal status with confirmation', async () => {
      const completedService = {
        ...mockService,
        status: 'Completed'
      };

      (prisma.orderItem.findUnique as any).mockResolvedValue(completedService);
      (prisma.orderItem.update as any).mockResolvedValue({
        ...completedService,
        status: 'Processing'
      });
      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Completed',
        statusChangedTo: 'Processing',
        comment: 'Status changed from Completed to Processing (reopened)',
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing',
          confirmReopenTerminal: true
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service.status).toBe('Processing');
      expect(data.auditEntry.statusChangedFrom).toBe('Completed');
      expect(data.auditEntry.comment).toContain('reopened');
    });

    it('should handle all terminal statuses (Cancelled, Cancelled-DNB)', async () => {
      const cancelledService = {
        ...mockService,
        status: 'Cancelled-DNB'
      };

      (prisma.orderItem.findUnique as any).mockResolvedValue(cancelledService);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.requiresConfirmation).toBe(true);
      expect(data.currentStatus).toBe('Cancelled-DNB');
    });
  });

  describe('success response format', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      (prisma.orderItem.findUnique as any).mockResolvedValue(mockService);
      mockCheckLock.mockResolvedValue({ isLocked: false, canEdit: true });
      mockAcquireLock.mockResolvedValue({ success: true });
      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        return await fn(prisma);
      });
    });

    it('should return updated service with audit entry', async () => {
      const updatedService = {
        ...mockService,
        status: 'Processing',
        updatedAt: new Date(),
        updatedById: mockUserId
      };

      const auditEntry = {
        id: 'comment-123',
        orderItemId: mockServiceId,
        isStatusChange: true,
        statusChangedFrom: 'Draft',
        statusChangedTo: 'Processing',
        comment: 'Status changed from Draft to Processing',
        createdBy: mockUserId,
        createdAt: new Date(),
        createdByUser: {
          id: mockUserId,
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User'
        }
      };

      (prisma.orderItem.update as any).mockResolvedValue(updatedService);
      (prisma.serviceComment.create as any).mockResolvedValue(auditEntry);

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('service');
      expect(data).toHaveProperty('auditEntry');
      expect(data.service.id).toBe(mockServiceId);
      expect(data.service.status).toBe('Processing');
      expect(data.auditEntry.isStatusChange).toBe(true);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      (prisma.orderItem.findUnique as any).mockResolvedValue(mockService);
      mockCheckLock.mockResolvedValue({ isLocked: false, canEdit: true });
      mockAcquireLock.mockResolvedValue({ success: true });
    });

    it('should handle database transaction errors', async () => {
      (prisma.$transaction as any).mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update service status');
    });

    it('should handle lock acquisition failure', async () => {
      mockCheckLock.mockResolvedValue({ isLocked: false, canEdit: true });
      mockAcquireLock.mockResolvedValue({
        success: false,
        error: 'Failed to acquire lock'
      });

      const request = new Request('http://localhost/api/services/service-123/status', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Processing'
        })
      });

      const response = await PUT(request, { params: { id: mockServiceId } });
      const data = await response.json();

      expect(response.status).toBe(423);
      expect(data.error).toContain('Failed to acquire lock');
    });
  });
});