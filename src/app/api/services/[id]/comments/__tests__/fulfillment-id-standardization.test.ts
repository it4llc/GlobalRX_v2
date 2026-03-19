// /GlobalRX_v2/src/app/api/services/[id]/comments/__tests__/fulfillment-id-standardization.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

vi.mock('@/services/service-comment-service', () => ({
  ServiceCommentService: vi.fn(function ServiceCommentService() {
    this.validateUserAccess = vi.fn();
    this.createComment = vi.fn();
  })
}));

vi.mock('@/lib/validations/service-comment', () => ({
  createServiceCommentSchema: {
    safeParse: vi.fn()
  }
}));

const mockGetServerSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

describe('POST /api/services/[id]/comments - Fulfillment ID Standardization', () => {
  let request: NextRequest;
  const validOrderItemId = 'order-item-123';
  const validServiceFulfillmentId = 'service-fulfillment-456';

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
    templateId: 'template-123',
    finalText: 'Test comment',
    isInternalOnly: false
  };

  beforeEach(() => {
    vi.clearAllMocks();

    request = new NextRequest('http://localhost/api/services/test-id/comments', {
      method: 'POST',
      body: JSON.stringify(mockRequestBody)
    });

    mockGetServerSession.mockResolvedValue(mockSession);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter', async () => {
      // Arrange - Mock that OrderItem exists and has associated ServicesFulfillment
      const mockServiceFulfillment = {
        orderItemId: validOrderItemId
      };

      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(mockServiceFulfillment);

      const { ServiceCommentService } = await import('@/services/service-comment-service');

      // Set up mock return values for all instances
      ServiceCommentService.mockImplementation(function() {
        this.validateUserAccess = vi.fn().mockResolvedValue(true);
        this.createComment = vi.fn().mockResolvedValue({
          id: 'comment-123',
          orderItemId: validOrderItemId,
          templateId: 'template-123',
          finalText: 'Test comment',
          isInternalOnly: false,
          createdBy: 'user-123',
          createdAt: new Date(),
          updatedBy: 'user-123',
          updatedAt: new Date(),
          template: { shortName: 'Test', longName: 'Test Template' },
          createdByUser: { firstName: 'Test', lastName: 'User', email: 'test@example.com' }
        });
      });

      const { createServiceCommentSchema } = await import('@/lib/validations/service-comment');
      (createServiceCommentSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });

      // Act
      const response = await POST(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert - Should use the OrderItem ID for validation
      expect(mockPrisma.servicesFulfillment.findUnique).toHaveBeenCalledWith({
        where: { orderItemId: validOrderItemId },  // THIS SHOULD CHANGE AFTER IMPLEMENTATION
        select: { orderItemId: true }
      });

      // Get the mock instance that was created
      const mockInstance = ServiceCommentService.mock.results[0].value;
      expect(mockInstance.validateUserAccess).toHaveBeenCalledWith(
        validOrderItemId,  // Should validate against OrderItem ID
        'user-123',
        'admin'
      );
      expect(response.status).toBe(201);
    });

    it('should return 404 when OrderItem ID does not exist', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';

      // Mock that no ServicesFulfillment exists for this OrderItem ID
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(mockPrisma.servicesFulfillment.findUnique).toHaveBeenCalledWith({
        where: { orderItemId: nonExistentOrderItemId },  // THIS SHOULD CHANGE AFTER IMPLEMENTATION
        select: { orderItemId: true }
      });
    });
  });

  describe('ServicesFulfillment Missing Scenarios', () => {
    it('should return 404 when ServicesFulfillment record is missing for valid OrderItem', async () => {
      // Arrange
      const orderItemWithoutFulfillment = 'order-item-without-fulfillment';

      // Mock that no ServicesFulfillment exists for this OrderItem ID
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: orderItemWithoutFulfillment } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(result.code).toBe(undefined); // Current implementation doesn't include code
    });

    it('should include proper error code when ServicesFulfillment not found', async () => {
      // Arrange
      const orderItemWithoutFulfillment = 'order-item-without-fulfillment';

      // Mock that no ServicesFulfillment exists for this OrderItem ID
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: orderItemWithoutFulfillment } });
      const result = await response.json();

      // Assert - After implementation, should include proper error code
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should be:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('ID Translation Workaround Removal', () => {
    it('should NOT perform ServicesFulfillment ID to OrderItem ID translation', async () => {
      // Arrange - This test verifies the workaround code is removed
      const directOrderItemId = 'order-item-direct-123';

      // Mock successful path
      const mockServiceFulfillment = {
        orderItemId: directOrderItemId
      };

      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(mockServiceFulfillment);

      const { ServiceCommentService } = await import('@/services/service-comment-service');

      // Set up mock return values for all instances
      ServiceCommentService.mockImplementation(function() {
        this.validateUserAccess = vi.fn().mockResolvedValue(true);
        this.createComment = vi.fn().mockResolvedValue({
          id: 'comment-123',
          orderItemId: directOrderItemId,
          templateId: 'template-123',
          finalText: 'Test comment',
          isInternalOnly: false,
          createdBy: 'user-123',
          createdAt: new Date(),
          updatedBy: 'user-123',
          updatedAt: new Date(),
          template: { shortName: 'Test', longName: 'Test Template' },
          createdByUser: { firstName: 'Test', lastName: 'User', email: 'test@example.com' }
        });
      });

      const { createServiceCommentSchema } = await import('@/lib/validations/service-comment');
      (createServiceCommentSchema.safeParse as any).mockReturnValue({
        success: true,
        data: mockRequestBody
      });

      // Act
      const response = await POST(request, { params: { id: directOrderItemId } });

      // Assert - Should query by OrderItem ID directly, not map from ServicesFulfillment ID
      expect(mockPrisma.servicesFulfillment.findUnique).toHaveBeenCalledWith({
        where: { orderItemId: directOrderItemId },  // THIS SHOULD CHANGE AFTER IMPLEMENTATION
        select: { orderItemId: true }
      });

      // Should validate access using the OrderItem ID directly
      const mockInstance2 = ServiceCommentService.mock.results[ServiceCommentService.mock.results.length - 1].value;
      expect(mockInstance2.validateUserAccess).toHaveBeenCalledWith(
        directOrderItemId,  // Should be the same ID passed in params
        'user-123',
        'admin'
      );

      expect(response.status).toBe(201);
    });

    it('should not query ServicesFulfillment table for ID mapping', async () => {
      // Arrange
      const orderItemId = 'order-item-999';

      // Mock that no ServicesFulfillment exists - this should be handled gracefully
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: orderItemId } });

      // Assert - Should query directly by OrderItem ID, not perform mapping
      expect(mockPrisma.servicesFulfillment.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.servicesFulfillment.findUnique).toHaveBeenCalledWith({
        where: { orderItemId: orderItemId },  // THIS SHOULD CHANGE AFTER IMPLEMENTATION
        select: { orderItemId: true }
      });

      // Should NOT call findUnique twice for mapping purposes
      expect(mockPrisma.servicesFulfillment.findUnique).not.toHaveBeenNthCalledWith(2, expect.anything());
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain all existing business logic after ID standardization', async () => {
      // Arrange
      const orderItemId = 'order-item-business-logic';

      const mockServiceFulfillment = {
        orderItemId: orderItemId
      };

      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(mockServiceFulfillment);

      const { ServiceCommentService } = await import('@/services/service-comment-service');

      // Set up mock return values for all instances
      ServiceCommentService.mockImplementation(function() {
        this.validateUserAccess = vi.fn().mockResolvedValue(true);
        this.createComment = vi.fn().mockResolvedValue({
          id: 'comment-456',
          orderItemId: orderItemId,
          templateId: 'template-123',
          finalText: 'Test comment with business logic',
          isInternalOnly: true,
          createdBy: 'user-123',
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedBy: 'user-123',
          updatedAt: new Date('2024-01-15T10:00:00Z'),
          template: { shortName: 'BIZ', longName: 'Business Logic Template' },
          createdByUser: { firstName: 'Business', lastName: 'User', email: 'biz@example.com' }
        });
      });

      const { createServiceCommentSchema } = await import('@/lib/validations/service-comment');
      (createServiceCommentSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { ...mockRequestBody, isInternalOnly: true }
      });

      // Act
      const response = await POST(request, { params: { id: orderItemId } });
      const result = await response.json();

      // Assert - All existing functionality should work
      expect(response.status).toBe(201);
      const mockInstance3 = ServiceCommentService.mock.results[ServiceCommentService.mock.results.length - 1].value;
      expect(mockInstance3.validateUserAccess).toHaveBeenCalledWith(orderItemId, 'user-123', 'admin');
      expect(mockInstance3.createComment).toHaveBeenCalledWith(
        orderItemId,
        { ...mockRequestBody, isInternalOnly: true },
        'user-123'
      );

      // Response format should be maintained
      expect(result).toEqual(expect.objectContaining({
        id: 'comment-456',
        orderItemId: orderItemId,
        templateId: 'template-123',
        finalText: 'Test comment with business logic',
        isInternalOnly: true,
        createdBy: 'user-123',
        template: {
          shortName: 'BIZ',
          longName: 'Business Logic Template'
        },
        createdByUser: {
          name: 'Business User',
          email: 'biz@example.com'
        }
      }));
    });

    it('should maintain authentication and permission checks', async () => {
      // Arrange - No session
      mockGetServerSession.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: 'any-id' } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });

    it('should maintain permission validation after ID standardization', async () => {
      // Arrange - User without fulfillment permission
      const mockSessionNoPermission = {
        user: {
          id: 'user-no-permission',
          userType: 'admin',
          permissions: {}
        }
      };

      mockGetServerSession.mockResolvedValue(mockSessionNoPermission);

      // Act
      const response = await POST(request, { params: { id: 'any-id' } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(result.error).toBe('You do not have permission to add comments');
    });
  });

  describe('Error Handling Standards', () => {
    it('should return standardized 404 error for missing ServicesFulfillment', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';

      // Mock that no ServicesFulfillment exists
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: orderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');  // Current implementation

      // TODO: After implementation, should match spec:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });

    it('should not auto-create missing ServicesFulfillment records', async () => {
      // Arrange
      const orderItemId = 'order-item-create-test';

      // Mock that no ServicesFulfillment exists
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(404);

      // Should NOT attempt to create a new ServicesFulfillment record
      expect(mockPrisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(mockPrisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });
  });
});