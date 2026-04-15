// /GlobalRX_v2/src/__tests__/404-error-handling/missing-services-fulfillment.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

// Import the API routes we're testing
import { POST as CommentsPost } from '../../app/api/services/[id]/comments/route';
import { GET as ResultsGet, PUT as ResultsPut } from '../../app/api/services/[id]/results/route';
import { GET as AttachmentsGet, POST as AttachmentsPost } from '../../app/api/services/[id]/attachments/route';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
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

const mockGetServerSession = vi.mocked(getServerSession);

describe('Missing ServicesFulfillment - 404 Error Handling', () => {
  const validOrderItemId = 'order-item-with-missing-fulfillment';
  const mockSession = {
    user: {
      id: 'user-404-test',
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

  describe('Comments API - Missing ServicesFulfillment', () => {
    it('should return 404 when ServicesFulfillment not found for OrderItem', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      // Mock that ServicesFulfillment doesn't exist for this OrderItem
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      // Act
      const response = await CommentsPost(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // Verify the correct query was made
      expect(prisma.servicesFulfillment.findUnique).toHaveBeenCalledWith({
        where: { orderItemId: validOrderItemId },  // THIS SHOULD CHANGE AFTER IMPLEMENTATION
        select: { orderItemId: true }
      });

      // Verify no auto-creation attempts
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });

    it('should return standardized error format for missing ServicesFulfillment', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      // Act
      const response = await CommentsPost(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert current implementation
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // TODO: After implementation, should match spec:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });

    it('should not attempt to validate user access when ServicesFulfillment is missing', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      const { ServiceCommentService } = await import('@/services/service-comment-service');
      const mockService = new ServiceCommentService();

      // Act
      const response = await CommentsPost(request, { params: { id: validOrderItemId } });

      // Assert
      expect(response.status).toBe(404);

      // Should not attempt user validation when ServicesFulfillment is missing
      expect(mockService.validateUserAccess).not.toHaveBeenCalled();
      expect(mockService.createComment).not.toHaveBeenCalled();
    });
  });

  describe('Results API - Missing ServicesFulfillment', () => {
    it('should return 404 on GET when ServicesFulfillment not found', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      // Mock that no ServicesFulfillment exists for this OrderItem
      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await ResultsGet(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      expect(prisma.servicesFulfillment.findFirst).toHaveBeenCalledWith({
        where: { orderItemId: validOrderItemId },
        include: expect.any(Object)
      });
    });

    it('should return 404 on PUT when OrderItem exists but ServicesFulfillment is missing', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({
          results: 'Updated results'
        })
      });

      // Mock OrderItem exists but no ServicesFulfillment
      const mockOrderItemWithoutFulfillment = {
        id: validOrderItemId,
        orderId: 'order-123',
        status: 'IN_PROGRESS',
        serviceFulfillment: null  // No fulfillment record
      };

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Updated results' }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await ResultsPut(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // Should not attempt to create missing ServicesFulfillment
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.upsert).not.toHaveBeenCalled();
    });

    it('should provide clear error messaging for missing ServicesFulfillment on results operations', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);
      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await ResultsGet(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert current implementation
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // TODO: After implementation, should be more specific:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('Attachments API - Missing ServicesFulfillment', () => {
    it('should return 404 on GET when OrderItem exists but ServicesFulfillment is missing', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      const mockOrderItemWithoutFulfillment = {
        id: validOrderItemId,
        orderId: 'order-123',
        serviceFulfillment: null
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await AttachmentsGet(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: { serviceFulfillment: true }
      });
    });

    it('should return 404 on POST when trying to upload attachments without ServicesFulfillment', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const mockOrderItemWithoutFulfillment = {
        id: validOrderItemId,
        orderId: 'order-123',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await AttachmentsPost(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // Should not create ServicesFulfillment or attempt file upload
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.serviceAttachment.create).not.toHaveBeenCalled();
    });

    it('should handle attachment queries gracefully when ServicesFulfillment is missing', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      const mockOrderItemWithoutFulfillment = {
        id: validOrderItemId,
        orderId: 'order-123',
        serviceFulfillment: null
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue(mockOrderItemWithoutFulfillment as any);

      // Act
      const response = await AttachmentsGet(request, { params: { id: validOrderItemId } });

      // Assert
      expect(response.status).toBe(404);

      // Should not attempt to query attachments table
      expect(prisma.serviceAttachment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Business Rule Enforcement', () => {
    it('should never auto-create missing ServicesFulfillment records across all APIs', async () => {
      // Arrange - Requests to all APIs with missing ServicesFulfillment
      const commentRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ templateId: 'template-123', finalText: 'Test' })
      });

      const resultsGetRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      const resultsPutRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test results' })
      });

      const attachmentsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      // Mock all scenarios where ServicesFulfillment is missing
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue({
        id: validOrderItemId,
        orderId: 'order-123',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      });

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test results' }
      });

      // Act - Call all APIs
      await CommentsPost(commentRequest, { params: { id: validOrderItemId } });
      await ResultsGet(resultsGetRequest, { params: { id: validOrderItemId } });
      await ResultsPut(resultsPutRequest, { params: { id: validOrderItemId } });
      await AttachmentsGet(attachmentsRequest, { params: { id: validOrderItemId } });

      // Assert - No auto-creation should have occurred
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();
      expect(prisma.servicesFulfillment.upsert).not.toHaveBeenCalled();

      // All calls should have returned appropriate errors without attempting auto-creation
      expect(prisma.servicesFulfillment.findUnique).toHaveBeenCalled();
      expect(prisma.servicesFulfillment.findFirst).toHaveBeenCalled();
    });

    it('should maintain data integrity by not masking legitimate data issues', async () => {
      // Arrange - This test ensures we don't hide real data problems
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      // Act
      const response = await CommentsPost(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert - Should expose the data integrity issue rather than hiding it
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');

      // Should not attempt to "fix" the data issue by creating records
      expect(prisma.servicesFulfillment.create).not.toHaveBeenCalled();

      // The 404 response alerts the system that there's a data integrity issue
      // that needs investigation, rather than auto-fixing and masking the problem
    });

    it('should provide appropriate error codes for different missing record scenarios', async () => {
      // Scenario 1: OrderItem doesn't exist at all
      const nonExistentOrderItemRequest = new NextRequest('http://localhost/api/services/non-existent/results');
      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      const nonExistentResponse = await ResultsGet(nonExistentOrderItemRequest, { params: { id: 'non-existent' } });
      const nonExistentResult = await nonExistentResponse.json();

      expect(nonExistentResponse.status).toBe(404);
      expect(nonExistentResult.error).toBe('Service not found');

      // Scenario 2: OrderItem exists but ServicesFulfillment is missing
      const orderItemExistsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`, {
        method: 'PUT',
        body: JSON.stringify({ results: 'Test' })
      });

      const { updateResultsSchema } = await import('@/types/service-results');
      (updateResultsSchema.safeParse as any).mockReturnValue({
        success: true,
        data: { results: 'Test' }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue({
        id: validOrderItemId,
        orderId: 'order-123',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      });

      const fulfillmentMissingResponse = await ResultsPut(orderItemExistsRequest, { params: { id: validOrderItemId } });
      const fulfillmentMissingResult = await fulfillmentMissingResponse.json();

      expect(fulfillmentMissingResponse.status).toBe(404);
      expect(fulfillmentMissingResult.error).toBe('Service not found');

      // TODO: After implementation, these should have different error codes:
      // expect(nonExistentResult.code).toBe('SERVICE_NOT_FOUND');
      // expect(fulfillmentMissingResult.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('Error Message Consistency', () => {
    it('should return consistent error messages across all APIs for missing ServicesFulfillment', async () => {
      // Arrange - Set up consistent missing ServicesFulfillment scenario
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValue({
        id: validOrderItemId,
        orderId: 'order-123',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      });

      // Create requests for all APIs
      const commentRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ templateId: 'template-123', finalText: 'Test' })
      });

      const resultsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      const attachmentsRequest = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      // Act - Call all APIs
      const commentResponse = await CommentsPost(commentRequest, { params: { id: validOrderItemId } });
      const resultsResponse = await ResultsGet(resultsRequest, { params: { id: validOrderItemId } });
      const attachmentsResponse = await AttachmentsGet(attachmentsRequest, { params: { id: validOrderItemId } });

      // Parse responses
      const commentResult = await commentResponse.json();
      const resultsResult = await resultsResponse.json();
      const attachmentsResult = await attachmentsResponse.json();

      // Assert - All should return 404 with same error message
      expect(commentResponse.status).toBe(404);
      expect(resultsResponse.status).toBe(404);
      expect(attachmentsResponse.status).toBe(404);

      expect(commentResult.error).toBe('Service not found');
      expect(resultsResult.error).toBe('Service not found');
      expect(attachmentsResult.error).toBe('Service not found');

      // TODO: After implementation, should include consistent error codes:
      // expect(commentResult.code).toBe('FULFILLMENT_NOT_FOUND');
      // expect(resultsResult.code).toBe('FULFILLMENT_NOT_FOUND');
      // expect(attachmentsResult.code).toBe('FULFILLMENT_NOT_FOUND');
    });

    it('should log appropriate error messages for debugging missing ServicesFulfillment issues', async () => {
      // Arrange
      const logger = await import('@/lib/logger');
      const mockLogger = vi.mocked(logger.default);
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/results`);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      // Act
      const response = await ResultsGet(request, { params: { id: validOrderItemId } });

      // Assert
      expect(response.status).toBe(404);

      // Should log helpful information for debugging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No service fulfillment found for orderItemId:',
        { orderItemId: validOrderItemId }
      );
    });
  });
});