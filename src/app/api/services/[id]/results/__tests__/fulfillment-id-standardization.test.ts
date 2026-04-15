// /GlobalRX_v2/src/app/api/services/[id]/results/__tests__/fulfillment-id-standardization.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, PUT } from '../route';
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


vi.mock('@/types/service-results', () => ({
  updateResultsSchema: {
    safeParse: vi.fn()
  },
  isTerminalStatus: vi.fn()
}));

const mockGetServerSession = vi.mocked(getServerSession);

describe('GET/PUT /api/services/[id]/results - Fulfillment ID Standardization', () => {
  const validOrderItemId = 'order-item-123';
  const mockSession = {
    user: {
      id: 'user-123',
      userType: 'admin',
      permissions: {
        fulfillment: { view: true, edit: true }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession as any);
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET - OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter and query ServicesFulfillment correctly', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      const mockServiceFulfillment = {
        orderItemId: validOrderItemId,
        results: 'Test results content',
        assignedVendorId: 'vendor-123',
        resultsAddedBy: 1,
        resultsAddedAt: new Date(),
        resultsLastModifiedBy: 2,
        resultsLastModifiedAt: new Date(),
        orderItem: {
          status: 'IN_PROGRESS',
          order: {
            customerId: 'customer-123'
          }
        },
        resultsAddedByUser: {
          email: 'user1@test.com',
          firstName: 'User',
          lastName: 'One'
        },
        resultsModifiedByUser: {
          email: 'user2@test.com',
          firstName: 'User',
          lastName: 'Two'
        }
      };

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(mockServiceFulfillment as any);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(prisma.servicesFulfillment.findFirst).toHaveBeenCalledWith({
        where: { orderItemId: validOrderItemId },
        include: expect.objectContaining({
          orderItem: expect.objectContaining({
            include: expect.objectContaining({
              order: expect.objectContaining({
                select: { customerId: true }
              })
            })
          })
        })
      });

      expect(result).toEqual(expect.objectContaining({
        results: 'Test results content',
        assignedVendorId: 'vendor-123',
        status: 'IN_PROGRESS'
      }));
    });

    it('should return 404 when ServicesFulfillment not found for OrderItem ID', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/results`);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(prisma.servicesFulfillment.findFirst).toHaveBeenCalledWith({
        where: { orderItemId: nonExistentOrderItemId },
        include: expect.any(Object)
      });
    });

    it('should return proper error format for missing ServicesFulfillment', async () => {
      // Arrange
      const orderItemWithoutFulfillment = 'order-item-without-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemWithoutFulfillment}/results`);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: orderItemWithoutFulfillment } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should match spec:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('PUT - OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter for updates', async () => {
      // Arrange
      const updateData = { results: 'Updated results content' };
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const mockOrderItem = {
        id: validOrderItemId,
        status: 'IN_PROGRESS',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-123',
          results: 'Original results',
          resultsAddedBy: 1
        }
      };

      const mockDbUser = {
        userId: 2
      };

      const mockUpdatedFulfillment = {
        id: 'fulfillment-123',
        results: 'Updated results content',
        resultsLastModifiedBy: 2,
        resultsLastModifiedAt: new Date()
      };

      const mockUpdatedWithRelations = {
        ...mockUpdatedFulfillment,
        resultsAddedByUser: {
          email: 'user1@test.com',
          firstName: 'User',
          lastName: 'One'
        },
        resultsModifiedByUser: {
          email: 'user2@test.com',
          firstName: 'User',
          lastName: 'Two'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItem as any);

      const { updateResultsSchema, isTerminalStatus } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: updateData
      });
      (isTerminalStatus as any).mockReturnValue(false);

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          user: {
            findUnique: vi.fn().mockResolvedValue(mockDbUser)
          },
          servicesFulfillment: {
            update: vi.fn().mockResolvedValue(mockUpdatedFulfillment)
          },
          auditLog: {
            create: vi.fn()
          }
        };
        return await callback(tx);
      });

      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(mockUpdatedWithRelations as any);

      // Act
      const response = await PUT(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });

      expect(result).toEqual(expect.objectContaining({
        results: 'Updated results content'
      }));
    });

    it('should return 404 when OrderItem not found', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test results' })
      });

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test results' }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(null);

      // Act
      const response = await PUT(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });
    });

    it('should return 404 when OrderItem exists but ServicesFulfillment is missing', async () => {
      // Arrange
      const orderItemId = 'order-item-without-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test results' })
      });

      const mockOrderItemWithoutFulfillment = {
        id: orderItemId,
        status: 'IN_PROGRESS',
        serviceFulfillment: null  // No fulfillment record
      };

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test results' }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await PUT(request, { params: { id: orderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should include proper error code:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain all existing business logic and permission checks', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      const mockServiceFulfillment = {
        orderItemId: validOrderItemId,
        results: 'Business logic test results',
        assignedVendorId: 'vendor-456',
        orderItem: {
          status: 'IN_PROGRESS',
          order: {
            customerId: 'customer-456'
          }
        },
        resultsAddedByUser: null,
        resultsModifiedByUser: null
      };

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(mockServiceFulfillment as any);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert - All existing functionality should work
      expect(response.status).toBe(200);
      expect(mockHasPermission).toHaveBeenCalledWith(mockSession.user, 'fulfillment', 'view');
      expect(mockHasPermission).toHaveBeenCalledWith(mockSession.user, 'fulfillment', 'edit');

      expect(result).toEqual(expect.objectContaining({
        results: 'Business logic test results',
        assignedVendorId: 'vendor-456',
        status: 'IN_PROGRESS'
      }));
    });

    it('should maintain authentication requirements', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);
      mockGetServerSession.mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });

    it('should maintain permission validation', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      const mockSessionNoPermission = {
        user: {
          id: 'user-no-permission',
          userType: 'admin',
          permissions: {},
          customerId: null,
          vendorId: null
        }
      };

      mockGetServerSession.mockResolvedValue(mockSessionNoPermission as any);
      mockHasPermission.mockReturnValue(false);

      const mockServiceFulfillment = {
        orderItemId: validOrderItemId,
        assignedVendorId: 'different-vendor',
        orderItem: {
          order: {
            customerId: 'different-customer'
          }
        }
      };

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(mockServiceFulfillment as any);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(result.error).toBe('Forbidden');
    });
  });

  describe('Error Handling Standards', () => {
    it('should not auto-create missing ServicesFulfillment records on GET', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/results`);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(404);
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });

    it('should not auto-create missing ServicesFulfillment records on PUT', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test results' })
      });

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test results' }
      });

      const mockOrderItemWithoutFulfillment = {
        id: orderItemId,
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await PUT(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(404);
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });
  });
});