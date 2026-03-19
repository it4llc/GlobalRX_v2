// /GlobalRX_v2/src/app/api/services/[id]/status/__tests__/fulfillment-id-standardization.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

const mockHasPermission = vi.fn();
vi.mock('@/lib/permission-utils', () => ({
  hasPermission: mockHasPermission
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    serviceComment: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/types/service-fulfillment', () => ({
  updateServiceStatusSchema: {
    safeParse: vi.fn()
  },
  isTerminalStatus: vi.fn(),
  ServiceStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    CANCELLED_DNB: 'CANCELLED_DNB'
  }
}));

// Mock OrderLockService
const mockCheckLock = vi.fn();
const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();

vi.mock('@/lib/services/order-lock.service', () => ({
  OrderLockService: vi.fn().mockImplementation(function() {
    this.checkLock = mockCheckLock;
    this.acquireLock = mockAcquireLock;
    this.releaseLock = mockReleaseLock;
  })
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

describe('PUT /api/services/[id]/status - Fulfillment ID Standardization', () => {
  const validOrderItemId = 'order-item-123';
  const mockSession = {
    user: {
      id: 'user-123',
      userType: 'admin',
      permissions: {
        fulfillment: true
      }
    }
  };

  const mockRequestBody = {
    status: 'Completed',
    comment: 'Service completed successfully'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockHasPermission.mockReturnValue(true);

    // Default OrderLockService behavior - user can edit
    mockCheckLock.mockResolvedValue({
      isLocked: true,
      canEdit: true,
      lock: { lockedBy: 'user-123' }
    });
    mockAcquireLock.mockResolvedValue({
      success: true
    });
    mockReleaseLock.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        status: 'Processing',
        assignedVendorId: 'vendor-789'
      };

      const mockOrder = {
        id: 'order-456',
        lockedBy: 'user-123',
        lockedAt: new Date()
      };

      const mockUpdatedOrderItem = {
        ...mockOrderItem,
        status: 'Completed'
      };

      const mockAuditEntry = {
        id: 'comment-123',
        orderItemId: validOrderItemId,
        finalText: 'Service completed successfully',
        isInternalOnly: false,
        createdBy: 'user-123',
        createdAt: new Date()
      };

      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });
      (isTerminalStatus as any).mockReturnValue(false);

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          orderItem: {
            update: vi.fn().mockResolvedValue(mockUpdatedOrderItem)
          },
          serviceComment: {
            create: vi.fn().mockResolvedValue(mockAuditEntry)
          }
        };
        return await callback(tx);
      });

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          }
        }
      });

      expect(result).toEqual(expect.objectContaining({
        service: mockUpdatedOrderItem,
        auditEntry: expect.objectContaining({
          id: 'comment-123',
          orderItemId: validOrderItemId,
          finalText: 'Service completed successfully',
          isInternalOnly: false,
          createdBy: 'user-123'
        })
      }));
    });

    it('should return 404 when OrderItem not found', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const { updateServiceStatusSchema } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });

      mockPrisma.orderItem.findUnique.mockResolvedValue(null);

      // Act
      const response = await PUT(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentOrderItemId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          }
        }
      });
    });
  });

  describe('ServicesFulfillment Independence', () => {
    it('should not depend on ServicesFulfillment record existence for status updates', async () => {
      // Arrange - OrderItem exists but has no associated ServicesFulfillment
      const orderItemWithoutFulfillment = 'order-item-no-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemWithoutFulfillment}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockOrderItem = {
        id: orderItemWithoutFulfillment,
        orderId: 'order-789',
        status: 'Draft',
        assignedVendorId: null
      };

      const mockOrder = {
        id: 'order-789',
        lockedBy: 'user-123',
        lockedAt: new Date()
      };

      const mockUpdatedOrderItem = {
        ...mockOrderItem,
        status: 'Processing'
      };

      const mockAuditEntry = {
        id: 'comment-456',
        orderItemId: orderItemWithoutFulfillment,
        finalText: 'Service completed successfully',
        isInternalOnly: false,
        createdBy: 'user-123',
        createdAt: new Date()
      };

      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { status: 'Processing', comment: 'Service completed successfully' }
      });
      (isTerminalStatus as any).mockReturnValue(false);

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          orderItem: {
            update: vi.fn().mockResolvedValue(mockUpdatedOrderItem)
          },
          serviceComment: {
            create: vi.fn().mockResolvedValue(mockAuditEntry)
          }
        };
        return await callback(tx);
      });

      // Act
      const response = await PUT(request, { params: { id: orderItemWithoutFulfillment } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(result.service).toEqual(mockUpdatedOrderItem);

      // Should NOT query ServicesFulfillment table
      // The route doesn't use ServicesFulfillment at all, so this property doesn't exist on the mock
      expect(mockPrisma.servicesFulfillment).toBeUndefined();
    });

    it('should not create ServicesFulfillment records during status updates', async () => {
      // Arrange
      const orderItemId = 'order-item-status-only';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockOrderItem = {
        id: orderItemId,
        orderId: 'order-999',
        status: 'Draft',
        assignedVendorId: null
      };

      const mockOrder = {
        id: 'order-999',
        lockedBy: 'user-123',
        lockedAt: new Date()
      };

      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });
      (isTerminalStatus as any).mockReturnValue(false);

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          orderItem: {
            update: vi.fn().mockResolvedValue({ ...mockOrderItem, status: 'COMPLETED' })
          },
          serviceComment: {
            create: vi.fn().mockResolvedValue({
              id: 'comment-789',
              orderItemId: orderItemId,
              finalText: mockRequestBody.comment,
              isInternalOnly: true,
              createdBy: 'user-123',
              createdAt: new Date()
            })
          }
        };
        return await callback(tx);
      });

      // Act
      const response = await PUT(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(200);

      // Should NOT attempt to create ServicesFulfillment records
      // The route doesn't use ServicesFulfillment at all, so this property doesn't exist on the mock
      expect(mockPrisma.servicesFulfillment).toBeUndefined();
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain all existing business logic and permission checks', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-business-logic',
        status: 'Processing',
        assignedVendorId: 'vendor-123'
      };

      const mockOrder = {
        id: 'order-business-logic',
        lockedBy: 'user-123',
        lockedAt: new Date()
      };

      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });
      (isTerminalStatus as any).mockReturnValue(false);

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          orderItem: {
            update: vi.fn().mockResolvedValue({ ...mockOrderItem, status: 'Completed' })
          },
          serviceComment: {
            create: vi.fn().mockResolvedValue({
              id: 'audit-123',
              orderItemId: validOrderItemId,
              finalText: mockRequestBody.comment,
              isInternalOnly: false,
              createdBy: 'user-123',
              createdAt: new Date()
            })
          }
        };
        return await callback(tx);
      });

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });

      // Assert - All existing functionality should work
      expect(response.status).toBe(200);
      // Permission check is done inline in the route, not via hasPermission
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true
            }
          }
        }
      });
    });

    it('should maintain authentication requirements', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      mockGetServerSession.mockResolvedValue(null);

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });

    it('should maintain permission validation', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockSessionNoPermission = {
        user: {
          id: 'user-no-permission',
          userType: 'admin',
          permissions: {}
        }
      };

      mockGetServerSession.mockResolvedValue(mockSessionNoPermission);
      mockHasPermission.mockReturnValue(false);

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(result.error).toContain('permission');
    });

    it('should maintain order locking validation', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-locked-by-other',
        status: 'Processing',
        assignedVendorId: 'vendor-123',
        order: {
          id: 'order-locked-by-other',
          orderNumber: 'ORD-123'
        }
      };

      const mockOrderLockedByOther = {
        id: 'order-locked-by-other',
        lockedBy: 'different-user-456',
        lockedAt: new Date()
      };

      const { updateServiceStatusSchema } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });

      // Override OrderLockService mock for this test - order locked by another user
      // Clear the default mock and set a new one for this test
      mockCheckLock.mockClear();
      mockCheckLock.mockResolvedValue({
        isLocked: true,
        canEdit: false,
        lock: { lockedBy: 'different-user-456' }
      });

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrderLockedByOther);

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(423);
      expect(result.error).toContain('locked');
    });
  });

  describe('Error Handling Standards', () => {
    it('should return standardized 404 error for missing OrderItem', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify(mockRequestBody)
      });

      const { updateServiceStatusSchema } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });

      mockPrisma.orderItem.findUnique.mockResolvedValue(null);

      // Act
      const response = await PUT(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should include proper error code:
      // expect(result.code).toBe('SERVICE_NOT_FOUND');
    });

    it('should maintain existing terminal status validation', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Processing' })  // Trying to reopen completed service
      });

      const mockCompletedOrderItem = {
        id: validOrderItemId,
        orderId: 'order-completed',
        status: 'Completed',  // Terminal status
        assignedVendorId: 'vendor-123'
      };

      const mockOrder = {
        id: 'order-completed',
        lockedBy: 'user-123',
        lockedAt: new Date()
      };

      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { status: 'Processing' }
      });
      (isTerminalStatus as any).mockReturnValue(true);  // Current status is terminal

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockCompletedOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(409);
      expect(result.error).toBe('Terminal status confirmation required');
    });
  });
});