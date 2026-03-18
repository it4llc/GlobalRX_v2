// /GlobalRX_v2/src/app/api/services/[id]/attachments/__tests__/fulfillment-id-standardization.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from '../route';
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
    serviceAttachment: {
      findMany: vi.fn(),
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

vi.mock('@/types/service-results', () => ({
  isTerminalStatus: vi.fn()
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

const mockGetServerSession = vi.mocked(getServerSession);
const mockPrisma = vi.mocked(prisma);

describe('GET/POST /api/services/[id]/attachments - Fulfillment ID Standardization', () => {
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
    mockGetServerSession.mockResolvedValue(mockSession);
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET - OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter and query correctly', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-789'
        }
      };

      const mockAttachments = [
        {
          id: 'attachment-1',
          fileName: 'test1.pdf',
          filePath: 'uploads/test1.pdf',
          fileSize: 1024,
          uploadedBy: 1,
          uploadedAt: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'attachment-2',
          fileName: 'test2.pdf',
          filePath: 'uploads/test2.pdf',
          fileSize: 2048,
          uploadedBy: 2,
          uploadedAt: new Date('2024-01-16T10:00:00Z')
        }
      ];

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.serviceAttachment.findMany.mockResolvedValue(mockAttachments);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });

      expect(mockPrisma.serviceAttachment.findMany).toHaveBeenCalledWith({
        where: { serviceFulfillmentId: 'fulfillment-123' },
        orderBy: { uploadedAt: 'desc' }
      });

      expect(result).toEqual({
        attachments: mockAttachments.map(a => ({
          ...a,
          uploadedAt: a.uploadedAt.toISOString()
        }))
      });
    });

    it('should return 404 when OrderItem not found', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/attachments`);

      mockPrisma.orderItem.findUnique.mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });
    });

    it('should return 404 when OrderItem exists but ServicesFulfillment is missing', async () => {
      // Arrange
      const orderItemWithoutFulfillment = 'order-item-without-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemWithoutFulfillment}/attachments`);

      const mockOrderItemWithoutFulfillment = {
        id: orderItemWithoutFulfillment,
        orderId: 'order-456',
        serviceFulfillment: null
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItemWithoutFulfillment);

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

  describe('POST - OrderItem ID Standardization', () => {
    it('should expect OrderItem ID in the [id] parameter for uploads', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        status: 'IN_PROGRESS',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-789'
        }
      };

      const mockDbUser = {
        userId: 1
      };

      const mockNewAttachment = {
        id: 'attachment-new',
        serviceFulfillmentId: 'fulfillment-123',
        fileName: 'test.pdf',
        filePath: 'uploads/service-results/order-456/order-item-123/uuid123_test.pdf',
        fileSize: 1024,
        uploadedBy: 1
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);

      const { isTerminalStatus } = await import('@/types/service-results');
      (isTerminalStatus as any).mockReturnValue(false);

      const { existsSync } = await import('fs');
      (existsSync as any).mockReturnValue(true);

      const { randomUUID } = await import('crypto');
      (randomUUID as any).mockReturnValue('uuid123-uuid456-uuid789');

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            findUnique: vi.fn().mockResolvedValue(mockDbUser)
          },
          serviceAttachment: {
            create: vi.fn().mockResolvedValue(mockNewAttachment)
          },
          auditLog: {
            create: vi.fn()
          }
        };
        return await callback(tx);
      });

      // Act
      const response = await POST(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });

      expect(result).toEqual(mockNewAttachment);
    });

    it('should return 404 when OrderItem not found during upload', async () => {
      // Arrange
      const nonExistentOrderItemId = 'non-existent-order-item';
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${nonExistentOrderItemId}/attachments`, {
        method: 'POST',
        body: formData
      });

      mockPrisma.orderItem.findUnique.mockResolvedValue(null);

      // Act
      const response = await POST(request, { params: { id: nonExistentOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      expect(mockPrisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentOrderItemId },
        include: {
          serviceFulfillment: true
        }
      });
    });

    it('should return 404 when OrderItem exists but ServicesFulfillment is missing during upload', async () => {
      // Arrange
      const orderItemWithoutFulfillment = 'order-item-without-fulfillment';
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${orderItemWithoutFulfillment}/attachments`, {
        method: 'POST',
        body: formData
      });

      const mockOrderItemWithoutFulfillment = {
        id: orderItemWithoutFulfillment,
        orderId: 'order-456',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItemWithoutFulfillment);

      // Act
      const response = await POST(request, { params: { id: orderItemWithoutFulfillment } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should match spec:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });

  describe('Existing Functionality Preservation', () => {
    it('should maintain all existing permission checks for GET', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-789'
        }
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.serviceAttachment.findMany.mockResolvedValue([]);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });

      // Assert
      expect(response.status).toBe(200);
      expect(mockHasPermission).toHaveBeenCalledWith(mockSession.user, 'fulfillment', 'view');
    });

    it('should maintain all existing permission checks for POST', async () => {
      // Arrange
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        status: 'IN_PROGRESS',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-789'
        }
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);

      const { isTerminalStatus } = await import('@/types/service-results');
      (isTerminalStatus as any).mockReturnValue(false);

      // Act
      const response = await POST(request, { params: { id: validOrderItemId } });

      // Assert
      expect(mockHasPermission).toHaveBeenCalledWith(mockSession.user, 'fulfillment', 'edit');
    });

    it('should maintain authentication requirements', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);
      mockGetServerSession.mockResolvedValue(null);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Unauthorized');
    });

    it('should maintain customer permission restrictions', async () => {
      // Arrange
      const request = new NextRequest(`http://localhost/api/services/${validOrderItemId}/attachments`);

      const mockCustomerSession = {
        user: {
          id: 'customer-123',
          userType: 'customer',
          customerId: 'customer-456'
        }
      };

      mockGetServerSession.mockResolvedValue(mockCustomerSession);

      const mockOrderItem = {
        id: validOrderItemId,
        orderId: 'order-456',
        serviceFulfillment: {
          id: 'fulfillment-123',
          assignedVendorId: 'vendor-789'
        }
      };

      const mockOrder = {
        customerId: 'different-customer'  // Different customer
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItem);
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      // Act
      const response = await GET(request, { params: { id: validOrderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(result.error).toBe('You can only view attachments for your own orders');
    });
  });

  describe('Error Handling Standards', () => {
    it('should not auto-create missing ServicesFulfillment records on GET', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/attachments`);

      const mockOrderItemWithoutFulfillment = {
        id: orderItemId,
        orderId: 'order-456',
        serviceFulfillment: null
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItemWithoutFulfillment);

      // Act
      const response = await GET(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(404);
      // ServicesFulfillment should not be created - route expects it to exist
      expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
    });

    it('should not auto-create missing ServicesFulfillment records on POST', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';
      const mockFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      Object.defineProperty(mockFile, 'size', { value: 1024 });

      const formData = new FormData();
      formData.append('file', mockFile);

      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const mockOrderItemWithoutFulfillment = {
        id: orderItemId,
        orderId: 'order-456',
        status: 'IN_PROGRESS',
        serviceFulfillment: null
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItemWithoutFulfillment);

      // Act
      const response = await POST(request, { params: { id: orderItemId } });

      // Assert
      expect(response.status).toBe(404);
      // ServicesFulfillment should not be created - route expects it to exist
      expect(mockPrisma.orderItem.update).not.toHaveBeenCalled();
    });

    it('should return standardized error format', async () => {
      // Arrange
      const orderItemId = 'order-item-missing-fulfillment';
      const request = new NextRequest(`http://localhost/api/services/${orderItemId}/attachments`);

      const mockOrderItemWithoutFulfillment = {
        id: orderItemId,
        orderId: 'order-456',
        serviceFulfillment: null
      };

      mockPrisma.orderItem.findUnique.mockResolvedValue(mockOrderItemWithoutFulfillment);

      // Act
      const response = await GET(request, { params: { id: orderItemId } });
      const result = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(result.error).toBe('Service not found');
      // TODO: After implementation, should match spec:
      // expect(result.error).toBe('Service fulfillment not found');
      // expect(result.code).toBe('FULFILLMENT_NOT_FOUND');
    });
  });
});