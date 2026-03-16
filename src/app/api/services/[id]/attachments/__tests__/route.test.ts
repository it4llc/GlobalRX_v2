// /GlobalRX_v2/src/app/api/services/[id]/attachments/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

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

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn((user, resource, action) => {
    if (!user?.permissions) return false;
    if (typeof user.permissions[resource] === 'object' && action) {
      return !!user.permissions[resource][action];
    }
    return !!user.permissions[resource];
  })
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn()
    },
    servicesFulfillment: {
      findUnique: vi.fn()
    },
    serviceAttachment: {
      findMany: vi.fn(),
      create: vi.fn()
    },
    order: {
      findUnique: vi.fn()
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

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

describe('GET /api/services/[id]/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization - internal users', () => {
    it('should allow internal users with fulfillment.view permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'report1.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/abc_report1.pdf',
          fileSize: 1024000,
          uploadedBy: 10,
          uploadedAt: new Date('2024-03-01')
        },
        {
          id: 2,
          serviceFulfillmentId: 789,
          fileName: 'report2.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/xyz_report2.pdf',
          fileSize: 2048000,
          uploadedBy: 20,
          uploadedAt: new Date('2024-03-02')
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toHaveProperty('fileName', 'report1.pdf');
      expect(data[1]).toHaveProperty('fileName', 'report2.pdf');
    });
  });

  describe('authorization - vendor users', () => {
    it('should allow vendor to view attachments for assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-123' // Matches user's vendorId
        }
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'vendor_report.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/vendor_report.pdf',
          fileSize: 500000,
          uploadedBy: 30,
          uploadedAt: new Date()
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('fileName', 'vendor_report.pdf');
    });

    it('should return 403 when vendor tries to view attachments for non-assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-999' // Different vendor
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only view attachments for services assigned to your vendor organization');
    });
  });

  describe('authorization - customer users', () => {
    it('should allow customer to view attachments for their own order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'completed'
        }
      };

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        customerId: 'customer-123' // Matches user's customerId
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'final_report.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/final_report.pdf',
          fileSize: 1500000,
          uploadedBy: 10,
          uploadedAt: new Date()
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('fileName', 'final_report.pdf');
    });

    it('should return 403 when customer tries to view attachments for another customer\'s order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'completed'
        }
      };

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        customerId: 'customer-999' // Different customer
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only view attachments for your own orders');
    });
  });

  describe('business logic', () => {
    it('should return empty array when no attachments exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual([]);
    });

    it('should return 404 when service does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });
  });
});

describe('POST /api/services/[id]/attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization - internal users', () => {
    it('should allow internal users with fulfillment.edit permission to upload', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'test.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/uuid_test.pdf',
        fileSize: 1024,
        uploadedBy: 123,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.create).mockResolvedValueOnce(mockAttachment);

      const formData = new FormData();
      const file = new Blob(['test content'], { type: 'application/pdf' });
      formData.append('file', file, 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('fileName', 'test.pdf');
      expect(data).toHaveProperty('fileSize', 1024);
    });

    it('should return 403 when internal user lacks fulfillment.edit permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } } // Only view, not edit
        }
      });

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('authorization - vendor users', () => {
    it('should allow vendor to upload attachment for assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-123' // Matches user's vendorId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'vendor_report.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/uuid_vendor_report.pdf',
        fileSize: 2048,
        uploadedBy: 456,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.create).mockResolvedValueOnce(mockAttachment);

      const formData = new FormData();
      const file = new Blob(['vendor content'], { type: 'application/pdf' });
      formData.append('file', file, 'vendor_report.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data).toHaveProperty('fileName', 'vendor_report.pdf');
    });

    it('should return 403 when vendor tries to upload to non-assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-999' // Different vendor
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only upload attachments for services assigned to your vendor organization');
    });
  });

  describe('authorization - customer users', () => {
    it('should return 403 when customer tries to upload attachment', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Customers cannot upload attachments');
    });
  });

  describe('validation', () => {
    it('should return 400 when no file is provided', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const formData = new FormData();
      // No file appended

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'No file provided');
    });

    it('should return 400 when file is not a PDF', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const formData = new FormData();
      const file = new Blob(['content'], { type: 'image/jpeg' });
      formData.append('file', file, 'image.jpg');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'File must be a PDF');
    });

    it('should return 400 when file exceeds 5MB', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const formData = new FormData();
      const largeContent = new Uint8Array(5 * 1024 * 1024 + 1); // 5MB + 1 byte
      const file = new Blob([largeContent], { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
      formData.append('file', file, 'large.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'File size cannot exceed 5MB');
    });
  });

  describe('business logic', () => {
    it('should return 404 when service does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 409 when service is in terminal status (completed)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'completed' // Terminal status
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot upload attachments for service in terminal status');
    });

    it('should return 409 when service is in terminal status (cancelled)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'cancelled' // Terminal status
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot upload attachments for service in terminal status');
    });

    it('should create directory structure if it does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(false); // Directory doesn't exist
      vi.mocked(mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.create).mockResolvedValueOnce({
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'test.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/uuid_test.pdf',
        fileSize: 1024,
        uploadedBy: 123,
        uploadedAt: new Date()
      });

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      // Verify directory creation was called with correct path
      expect(mkdir).toHaveBeenCalledWith(
        expect.stringContaining('uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123'),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should preserve original filename with unique identifier', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'my_report_2024.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      // Verify the create call preserves original filename
      expect(prisma.serviceAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName: 'my_report_2024.pdf', // Original filename preserved
            filePath: expect.stringMatching(/uploads\/service-results\/550e8400-e29b-41d4-a716-446655440002\/item-123\/.*_my_report_2024\.pdf/) // Path includes UUID prefix
          })
        })
      );
    });
  });

  describe('audit logging', () => {
    it('should create audit log entry for attachment upload', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.create).mockResolvedValueOnce({
        id: 100,
        serviceFulfillmentId: 789,
        fileName: 'audit_test.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/uuid_audit_test.pdf',
        fileSize: 2048,
        uploadedBy: 123,
        uploadedAt: new Date()
      });

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'audit_test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      // Verify audit log was created
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'service_attachment',
            entityId: 'sf-789',
            action: 'upload',
            userId: expect.any(Number),
            changes: expect.objectContaining({
              fileName: 'audit_test.pdf',
              fileSize: 2048,
              attachmentId: 100
            })
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 when file write fails', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(writeFile).mockRejectedValueOnce(new Error('Disk full'));

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to save file');
    });

    it('should return 500 when database error occurs', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const formData = new FormData();
      formData.append('file', new Blob(['content'], { type: 'application/pdf' }), 'test.pdf');

      const request = new Request('http://localhost:3000/api/services/item-123/attachments', {
        method: 'POST',
        body: formData
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Internal server error');
    });
  });
});