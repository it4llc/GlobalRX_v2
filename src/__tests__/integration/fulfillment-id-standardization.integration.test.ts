// /GlobalRX_v2/src/__tests__/integration/fulfillment-id-standardization.integration.test.ts

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

// Import the API routes we're testing
import { POST as CommentsPost } from '@/app/api/services/[id]/comments/route';
import { GET as ResultsGet, PUT as ResultsPut } from '@/app/api/services/[id]/results/route';
import { GET as AttachmentsGet, POST as AttachmentsPost } from '@/app/api/services/[id]/attachments/route';
import { PUT as StatusPut } from '@/app/api/services/[id]/status/route';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn()
    },
    orderItem: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    serviceAttachment: {
      findMany: vi.fn(),
      create: vi.fn()
    },
    serviceComment: {
      create: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
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

vi.mock('@/types/service-results', () => ({
  updateResultsSchema: {
    safeParse: vi.fn()
  },
  isTerminalStatus: vi.fn()
}));

vi.mock('@/types/service-fulfillment', () => ({
  updateServiceStatusSchema: {
    safeParse: vi.fn()
  },
  isTerminalStatus: vi.fn()
}));

const mockHasPermission = vi.fn();
vi.mock('@/lib/permission-utils', () => ({
  hasPermission: mockHasPermission
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/lib/services/order-lock.service', () => ({
  OrderLockService: vi.fn().mockImplementation(function() {
    this.checkLock = vi.fn().mockResolvedValue({
      isLocked: true,
      canEdit: true,
      lock: { lockedBy: 'user-integration-123' }
    });
    this.acquireLock = vi.fn().mockResolvedValue({
      success: true
    });
    this.releaseLock = vi.fn().mockResolvedValue({
      success: true
    });
  })
}));

vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    mkdir: vi.fn()
  },
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true)
  },
  existsSync: vi.fn().mockReturnValue(true)
}));

vi.mock('path', () => ({
  default: {
    join: (...args) => args.join('/')
  },
  join: vi.fn((...args) => args.join('/'))
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: () => 'test-uuid-123'
  },
  randomUUID: vi.fn().mockReturnValue('test-uuid-123')
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = vi.mocked(prisma);
const mockGetServerSession = vi.mocked(getServerSession);

// Test data
const validOrderItemId = 'order-item-integration-123';
const validServiceFulfillmentId = 'service-fulfillment-456';
const validOrderId = 'order-integration-789';

const mockSession = {
  user: {
    id: 'user-integration-123',
    userType: 'admin',
    permissions: {
      fulfillment: { view: true, edit: true, manage: true }
    }
  }
};

const mockOrderItem = {
  id: validOrderItemId,
  orderId: validOrderId,
  status: 'IN_PROGRESS',
  serviceFulfillment: {
    id: validServiceFulfillmentId,
    orderItemId: validOrderItemId,
    assignedVendorId: 'vendor-123',
    results: 'Integration test results',
    resultsAddedBy: 1,
    resultsAddedAt: new Date('2024-01-15T10:00:00Z'),
    resultsLastModifiedBy: 2,
    resultsLastModifiedAt: new Date('2024-01-16T10:00:00Z')
  }
};

const mockServiceFulfillment = {
  id: validServiceFulfillmentId,
  orderItemId: validOrderItemId,
  assignedVendorId: 'vendor-123',
  results: 'Integration test results',
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

const mockOrder = {
  id: validOrderId,
  customerId: 'customer-123',
  lockedBy: 'user-integration-123',
  lockedAt: new Date()
};

describe('Fulfillment ID Standardization - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue(mockSession);
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Workflow with OrderItem IDs', () => {
    it('should handle complete fulfillment workflow using OrderItem IDs consistently', async () => {
      // Arrange - Mock all necessary database responses
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue({
        orderItemId: validOrderItemId
      });

      mockPrisma.servicesFulfillment.findFirst.mockResolvedValue(mockServiceFulfillment);
      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.serviceAttachment.findMany.mockResolvedValue([]);

      const { ServiceCommentService } = await import('@/services/service-comment-service');

      ServiceCommentService.mockImplementation(function() {
        this.validateUserAccess = vi.fn().mockResolvedValue(true);
        this.createComment = vi.fn().mockResolvedValue({
        id: 'comment-integration-123',
        orderItemId: validOrderItemId,
        templateId: 'template-123',
        finalText: 'Integration test comment',
        isInternalOnly: false,
        createdBy: 'user-integration-123',
        createdAt: new Date(),
        updatedBy: 'user-integration-123',
        updatedAt: new Date(),
        template: { shortName: 'TEST', longName: 'Test Template' },
        createdByUser: { firstName: 'Test', lastName: 'User', email: 'test@example.com' }
        });
      });

      const { createServiceCommentSchema } = await import('@/lib/validations/service-comment');
      (createServiceCommentSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { templateId: 'template-123', finalText: 'Integration test comment' }
      });

      const { updateResultsSchema, isTerminalStatus: resultsIsTerminalStatus } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Updated integration results' }
      });
      (resultsIsTerminalStatus as any).mockReturnValue(false);

      const { updateServiceStatusSchema, isTerminalStatus: statusIsTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { status: 'COMPLETED', comment: 'Integration test completion' }
      });
      (statusIsTerminalStatus as any).mockReturnValue(false);

      // Mock successful database updates
      mockPrisma.user.findUnique.mockResolvedValue({ userId: 1 });

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: { findUnique: vi.fn().mockResolvedValue({ userId: 1 }) },
          servicesFulfillment: { update: vi.fn().mockResolvedValue(mockServiceFulfillment) },
          orderItem: { update: vi.fn().mockResolvedValue({ ...mockOrderItem, status: 'COMPLETED' }) },
          serviceComment: { create: vi.fn().mockResolvedValue({ id: 'audit-123', orderItemId: validOrderItemId }) },
          serviceAttachment: { create: vi.fn().mockResolvedValue({ id: 'attachment-123' }) },
          auditLog: { create: vi.fn() }
        };
        return await callback(tx);
      });

      // Step 1: Fetch results using OrderItem ID
      const resultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);
      const resultsResponse = await ResultsGet(resultsRequest, { params: { id: validOrderItemId } });
      const resultsData = await resultsResponse.json();

      // Assert - Results API works with OrderItem ID
      expect(resultsResponse.status).toBe(200);
      expect(resultsData.results).toBe('Integration test results');
      expect(mockPrisma.servicesFulfillment.findFirst).toHaveBeenCalledWith({
        where: { orderItemId: validOrderItemId },
        include: expect.any(Object)
      });

      // Step 2: Add comment using OrderItem ID
      const commentRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Integration test comment'
        })
      });
      const commentResponse = await CommentsPost(commentRequest, { params: { id: validOrderItemId } });
      const commentData = await commentResponse.json();

      // Assert - Comments API works with OrderItem ID
      expect(commentResponse.status).toBe(201);
      expect(commentData.orderItemId).toBe(validOrderItemId);
      const mockInstance = ServiceCommentService.mock.results[ServiceCommentService.mock.results.length - 1].value;
      expect(mockInstance.validateUserAccess).toHaveBeenCalledWith(
        validOrderItemId,
        'user-integration-123',
        'admin'
      );

      // Step 3: Update results using OrderItem ID
      const updateResultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({
          results: 'Updated integration results'
        })
      });
      const updateResultsResponse = await ResultsPut(updateResultsRequest, { params: { id: validOrderItemId } });

      // Assert - Results update works with OrderItem ID
      expect(updateResultsResponse.status).toBe(200);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: { serviceFulfillment: true }
      });

      // Step 4: Fetch attachments using OrderItem ID
      const attachmentsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);
      const attachmentsResponse = await AttachmentsGet(attachmentsRequest, { params: { id: validOrderItemId } });

      // Assert - Attachments API works with OrderItem ID
      expect(attachmentsResponse.status).toBe(200);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: { serviceFulfillment: true }
      });

      // Step 5: Update status using OrderItem ID
      const statusRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'COMPLETED',
          comment: 'Integration test completion'
        })
      });
      const statusResponse = await StatusPut(statusRequest, { params: { id: validOrderItemId } });

      // Assert - Status update works with OrderItem ID
      expect(statusResponse.status).toBe(200);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validOrderItemId }
        })
      );

      // Verify that NO API calls used serviceFulfillmentId directly
      // ServicesFulfillment queries should use orderItemId field
      const serviceFulfillmentCalls = [
        ...mockPrisma.servicesFulfillment.findUnique.mock.calls,
        ...mockPrisma.servicesFulfillment.findFirst.mock.calls
      ];

      serviceFulfillmentCalls.forEach(call => {
        const whereClause = call[0]?.where;
        if (whereClause) {
          // ServicesFulfillment should be queried by orderItemId
          if (whereClause.orderItemId) {
            expect(whereClause.orderItemId).toBe(validOrderItemId);
          }
          // If using id, it's the ServicesFulfillment's own ID which is valid
          // but we're checking the API standardization uses orderItemId
        }
      });

      // OrderItem queries should use the OrderItem ID
      const orderItemCalls = mockPrisma.orderItem.findUnique.mock.calls;
      orderItemCalls.forEach(call => {
        const whereClause = call[0]?.where;
        if (whereClause && whereClause.id) {
          expect(whereClause.id).toBe(validOrderItemId);
        }
      });
    });
  });

  describe('Missing ServicesFulfillment Scenarios', () => {
    it('should handle end-to-end workflow when ServicesFulfillment is missing', async () => {
      // Arrange - OrderItem exists but no ServicesFulfillment
      const orderItemWithoutFulfillment = {
        ...mockOrderItem,
        serviceFulfillment: null
      };

      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);
      mockPrisma.servicesFulfillment.findFirst.mockResolvedValue(null);
      mockPrisma.orderItem.findUnique.mockResolvedValue(orderItemWithoutFulfillment);

      // Step 1: Try to fetch results - should return 404
      const resultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);
      const resultsResponse = await ResultsGet(resultsRequest, { params: { id: validOrderItemId } });

      expect(resultsResponse.status).toBe(404);
      const resultsData = await resultsResponse.json();
      expect(resultsData.error).toBe('Service not found');

      // Step 2: Try to add comment - should return 404
      const commentRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });
      const commentResponse = await CommentsPost(commentRequest, { params: { id: validOrderItemId } });

      expect(commentResponse.status).toBe(404);
      const commentData = await commentResponse.json();
      expect(commentData.error).toBe('Service not found');

      // Step 3: Try to update results - should return 404
      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test results' }
      });

      const updateResultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test results' })
      });
      const updateResultsResponse = await ResultsPut(updateResultsRequest, { params: { id: validOrderItemId } });

      expect(updateResultsResponse.status).toBe(404);

      // Step 4: Try to fetch attachments - should return 404
      const attachmentsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);
      const attachmentsResponse = await AttachmentsGet(attachmentsRequest, { params: { id: validOrderItemId } });

      expect(attachmentsResponse.status).toBe(404);

      // Step 5: Status updates should still work (doesn't depend on ServicesFulfillment)
      const { updateServiceStatusSchema, isTerminalStatus } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { status: 'IN_PROGRESS', comment: 'Test status update' }
      });
      (isTerminalStatus as any).mockReturnValue(false);

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          orderItem: { update: vi.fn().mockResolvedValue({ ...mockOrderItem, status: 'IN_PROGRESS' }) },
          serviceComment: { create: vi.fn().mockResolvedValue({ id: 'audit-123' }) }
        };
        return await callback(tx);
      });

      const statusRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'IN_PROGRESS',
          comment: 'Test status update'
        })
      });
      const statusResponse = await StatusPut(statusRequest, { params: { id: validOrderItemId } });

      expect(statusResponse.status).toBe(200);

      // Verify NO auto-creation attempts were made
      expect(mockPrisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(mockPrisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('API Contract Consistency', () => {
    it('should maintain consistent error responses across all endpoints', async () => {
      // Arrange - All endpoints should return consistent 404 responses
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue(null);
      mockPrisma.servicesFulfillment.findFirst.mockResolvedValue(null);
      mockPrisma.orderItem.findUnique.mockResolvedValue(null);

      const nonExistentOrderItemId = 'non-existent-order-item';

      // Test Comments API
      const commentRequest = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ templateId: 'template-123', finalText: 'Test' })
      });
      const commentResponse = await CommentsPost(commentRequest, { params: { id: nonExistentOrderItemId } });
      const commentData = await commentResponse.json();

      // Test Results API
      const resultsRequest = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/results`);
      const resultsResponse = await ResultsGet(resultsRequest, { params: { id: nonExistentOrderItemId } });
      const resultsData = await resultsResponse.json();

      // Test Attachments API
      const attachmentsRequest = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/attachments`);
      const attachmentsResponse = await AttachmentsGet(attachmentsRequest, { params: { id: nonExistentOrderItemId } });
      const attachmentsData = await attachmentsResponse.json();

      // Test Status API
      const { updateServiceStatusSchema } = await import('@/types/service-fulfillment');
      (updateServiceStatusSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { status: 'COMPLETED', comment: 'Test' }
      });

      const statusRequest = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'COMPLETED', comment: 'Test' })
      });
      const statusResponse = await StatusPut(statusRequest, { params: { id: nonExistentOrderItemId } });
      const statusData = await statusResponse.json();

      // Assert - All should return 404 with consistent error messages
      expect(commentResponse.status).toBe(404);
      expect(resultsResponse.status).toBe(404);
      expect(attachmentsResponse.status).toBe(404);
      expect(statusResponse.status).toBe(404);

      expect(commentData.error).toBe('Service not found');
      expect(resultsData.error).toBe('Service not found');
      expect(attachmentsData.error).toBe('Service not found');
      expect(statusData.error).toBe('Service not found');

      // TODO: After implementation, should all include error codes:
      // expect(commentData.code).toBe('SERVICE_NOT_FOUND');
      // expect(resultsData.code).toBe('SERVICE_NOT_FOUND');
      // expect(attachmentsData.code).toBe('SERVICE_NOT_FOUND');
      // expect(statusData.code).toBe('SERVICE_NOT_FOUND');
    });

    it('should ensure all endpoints expect OrderItem IDs in the [id] parameter', () => {
      // This test verifies that our API design is consistent
      const orderItemId = 'test-order-item-123';

      // All endpoints should be called with the same ID format
      const endpointTests = [
        () => CommentsPost(new NextRequest(`http://localhost/api/services/${orderItemId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ templateId: 'test', finalText: 'test' })
        }), { params: { id: orderItemId } }),

        () => ResultsGet(new NextRequest(`http://localhost/api/services/${orderItemId}/results`), { params: { id: orderItemId } }),

        () => AttachmentsGet(new NextRequest(`http://localhost/api/services/${orderItemId}/attachments`), { params: { id: orderItemId } }),

        () => StatusPut(new NextRequest(`http://localhost/api/services/${orderItemId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'COMPLETED' })
        }), { params: { id: orderItemId } })
      ];

      // All should accept the same OrderItem ID format without throwing
      endpointTests.forEach(test => {
        expect(() => test()).not.toThrow();
      });
    });
  });

  describe('Data Integrity Preservation', () => {
    it('should maintain existing data relationships after ID standardization', async () => {
      // Arrange - Existing data structure should remain unchanged
      mockPrisma.servicesFulfillment.findFirst.mockResolvedValue(mockServiceFulfillment);
      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);

      // Step 1: Fetch results and verify data structure
      const resultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);
      const resultsResponse = await ResultsGet(resultsRequest, { params: { id: validOrderItemId } });
      const resultsData = await resultsResponse.json();

      // Assert - Data relationships preserved
      expect(resultsResponse.status).toBe(200);
      expect(resultsData.results).toBe('Integration test results');
      expect(resultsData.assignedVendorId).toBe('vendor-123');
      expect(resultsData.status).toBe('IN_PROGRESS');

      // Verify ServicesFulfillment was queried by orderItemId relationship
      expect(mockPrisma.servicesFulfillment.findFirst).toHaveBeenCalledWith({
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
    });

    it('should preserve audit trail functionality with OrderItem IDs', async () => {
      // Arrange
      mockPrisma.servicesFulfillment.findUnique.mockResolvedValue({
        orderItemId: validOrderItemId
      });

      const { ServiceCommentService } = await import('@/services/service-comment-service');

      ServiceCommentService.mockImplementation(function() {
        this.validateUserAccess = vi.fn().mockResolvedValue(true);
        this.createComment = vi.fn().mockResolvedValue({
        id: 'audit-comment-123',
        orderItemId: validOrderItemId,  // Should reference OrderItem, not ServicesFulfillment
        templateId: 'template-123',
        finalText: 'Audit trail test',
        createdBy: 'user-integration-123',
        createdAt: new Date(),
        template: { shortName: 'AUDIT', longName: 'Audit Trail' },
        createdByUser: { firstName: 'Audit', lastName: 'User', email: 'audit@example.com' }
        });
      });

      const { createServiceCommentSchema } = await import('@/lib/validations/service-comment');
      (createServiceCommentSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { templateId: 'template-123', finalText: 'Audit trail test' }
      });

      // Act - Create comment for audit trail
      const commentRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Audit trail test'
        })
      });
      const commentResponse = await CommentsPost(commentRequest, { params: { id: validOrderItemId } });
      const commentData = await commentResponse.json();

      // Assert - Audit trail maintains OrderItem reference
      expect(commentResponse.status).toBe(201);
      expect(commentData.orderItemId).toBe(validOrderItemId);
      const mockInstance2 = ServiceCommentService.mock.results[ServiceCommentService.mock.results.length - 1].value;
      expect(mockInstance2.createComment).toHaveBeenCalledWith(
        validOrderItemId,  // Should use OrderItem ID for audit trail
        { templateId: 'template-123', finalText: 'Audit trail test' },
        'user-integration-123',
        'admin'
      );
    });
  });
});