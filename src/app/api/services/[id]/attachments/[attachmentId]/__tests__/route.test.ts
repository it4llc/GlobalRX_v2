// /GlobalRX_v2/src/app/api/services/[id]/attachments/[attachmentId]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { readFile, unlink } from 'fs/promises';
import * as fs from 'fs';

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
  default: {},
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
    serviceAttachment: {
      findUnique: vi.fn(),
      delete: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('fs/promises', () => ({
  default: {},
  readFile: vi.fn(),
  unlink: vi.fn()
}));

vi.mock('fs', () => ({
  default: {},
  existsSync: vi.fn(() => true)
}));

// Mock path module
vi.mock('path', () => ({
  default: {
    join: vi.fn((...args) => args.join('/'))
  }
}));

describe('GET /api/services/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization - internal users', () => {
    it('should allow internal users with fulfillment.view permission to download', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'report.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/abc_report.pdf',
        fileSize: 1024000,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      const mockFileContent = Buffer.from('PDF file content');

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // existsSync is already mocked to return true in the mock setup above
      // Mock readFile to return the content
      vi.mocked(readFile).mockResolvedValueOnce(mockFileContent);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);

      expect(response.status).toBe(200);

      // Check headers
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="report.pdf"');
      expect(response.headers.get('Content-Length')).toBe('1024000');

      // Check body
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      expect(buffer.toString()).toBe('PDF file content');
    });
  });

  describe('authorization - vendor users', () => {
    it('should allow vendor to download attachment for assigned service', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789,  // Must be a number to match serviceFulfillmentId
          assignedVendorId: 'vendor-123' // Matches user's vendorId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'vendor_doc.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/vendor_doc.pdf',
        fileSize: 500000,
        uploadedBy: 30,
        uploadedAt: new Date()
      };

      const mockFileContent = Buffer.from('Vendor PDF content');

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path (since path.join creates a full path)
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock readFile to return the content for any path
      vi.mocked(readFile).mockResolvedValueOnce(mockFileContent);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      expect(buffer.toString()).toBe('Vendor PDF content');
    });

    it('should return 403 when vendor tries to download attachment for non-assigned service', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789,  // Must be a number to match serviceFulfillmentId
          assignedVendorId: 'vendor-999' // Different vendor
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only download attachments for services assigned to your vendor organization');
    });
  });

  describe('authorization - customer users', () => {
    it('should allow customer to download attachment for their own order', async () => {
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
        status: 'completed',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        customerId: 'customer-123' // Matches user's customerId
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'final_report.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/final_report.pdf',
        fileSize: 1500000,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      const mockFileContent = Buffer.from('Customer PDF content');

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path (since path.join creates a full path)
      vi.mocked(fs.existsSync).mockImplementation(() => true);
      // Mock readFile to return the content for any path
      vi.mocked(readFile).mockImplementation(() => Promise.resolve(mockFileContent));

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      expect(buffer.toString()).toBe('Customer PDF content');
    });

    it('should return 403 when customer tries to download attachment for another customer\'s order', async () => {
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
        status: 'completed',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        customerId: 'customer-999' // Different customer
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only download attachments for your own orders');
    });
  });

  describe('business logic', () => {
    it('should return 404 when service does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 404 when attachment does not exist', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/999');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '999' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Attachment not found');
    });

    it('should return 404 when attachment belongs to different service', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 999, // Different service
        fileName: 'wrong.pdf',
        filePath: 'uploads/wrong.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Attachment not found for this service');
    });

    it('should return 404 when file does not exist on disk', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'missing.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/missing.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return false to simulate file not found
      vi.mocked(fs.existsSync).mockReturnValue(false); // File doesn't exist

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'File not found');
    });
  });

  describe('error handling', () => {
    it('should return 500 when file read fails', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'error.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/error.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock readFile to reject with an error
      vi.mocked(readFile).mockRejectedValueOnce(new Error('Permission denied'));

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await GET(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to read file');
    });
  });
});

describe('DELETE /api/services/[id]/attachments/[attachmentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization - internal users', () => {
    it('should allow internal users with fulfillment.edit permission to delete', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'to_delete.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/to_delete.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock unlink to succeed
      vi.mocked(unlink).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.delete).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('message', 'Attachment deleted successfully');

      // Verify file deletion was attempted
      expect(unlink).toHaveBeenCalled();

      // Verify database record was deleted
      expect(prisma.serviceAttachment.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('should return 403 when internal user lacks fulfillment.edit permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } } // Only view, not edit
        }
      });

      // Need to mock orderItem for permission check to occur
      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 789
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('authorization - vendor users', () => {
    it('should allow vendor to delete attachment for assigned service', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789,  // Must be a number to match serviceFulfillmentId
          assignedVendorId: 'vendor-123' // Matches user's vendorId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'vendor_file.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/vendor_file.pdf',
        fileSize: 2048,
        uploadedBy: 30,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock unlink to succeed
      vi.mocked(unlink).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.delete).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });

    it('should return 403 when vendor tries to delete attachment for non-assigned service', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789,  // Must be a number to match serviceFulfillmentId
          assignedVendorId: 'vendor-999' // Different vendor
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only delete attachments for services assigned to your vendor organization');
    });
  });

  describe('authorization - customer users', () => {
    it('should return 403 when customer tries to delete attachment', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Customers cannot delete attachments');
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

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 404 when attachment does not exist', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/999', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '999' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Attachment not found');
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
        status: 'completed',  // Terminal status is on OrderItem
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot delete attachments for service in terminal status');
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
        status: 'cancelled',  // Terminal status is on OrderItem
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot delete attachments for service in terminal status');
    });

    it('should still delete database record even if file does not exist on disk', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'missing.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/missing.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return false to simulate file not found
      vi.mocked(fs.existsSync).mockReturnValue(false); // File doesn't exist
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.delete).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(200);

      // File deletion should NOT be attempted
      expect(unlink).not.toHaveBeenCalled();

      // Database record should still be deleted
      expect(prisma.serviceAttachment.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });
  });

  describe('audit logging', () => {
    it('should create audit log entry for attachment deletion', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'audit_delete.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/audit_delete.pdf',
        fileSize: 2048,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock unlink to succeed
      vi.mocked(unlink).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.delete).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      await DELETE(request, params);

      // Verify audit log was created
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'service_attachment',
            entityId: '1',  // Uses attachmentId as string
            action: 'delete',
            userId: 'user-123'  // Uses user.id from session (string UUID)
          })
        })
      );
    });
  });

  describe('error handling', () => {
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

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Internal server error');
    });

    it('should handle file deletion error gracefully', async () => {
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
        status: 'processing',  // Status is on OrderItem, not ServiceFulfillment
        serviceFulfillment: {
          id: 789  // Must be a number to match serviceFulfillmentId
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 789,
        fileName: 'protected.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/protected.pdf',
        fileSize: 1024,
        uploadedBy: 10,
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.serviceAttachment.findUnique).mockResolvedValueOnce(mockAttachment);
      // Mock existsSync to return true for any path
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Mock unlink to fail with permission error
      vi.mocked(unlink).mockRejectedValueOnce(new Error('Permission denied'));
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.serviceAttachment.delete).mockResolvedValueOnce(mockAttachment);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments/1', {
        method: 'DELETE'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004', attachmentId: '1' } };

      const response = await DELETE(request, params);

      // Should still succeed even if file deletion fails
      expect(response.status).toBe(200);

      // Database record should still be deleted
      expect(prisma.serviceAttachment.delete).toHaveBeenCalled();

      const data = await response.json();
      expect(data).toHaveProperty('success', true);
    });
  });
});