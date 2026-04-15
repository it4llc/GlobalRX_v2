// /GlobalRX_v2/src/app/api/services/[id]/attachments/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import fsPromises from 'fs/promises';
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
  hasPermission: vi.fn((user, resource, action) => {
    if (!user?.permissions) return false;
    if (typeof user.permissions[resource] === 'object' && action) {
      return !!user.permissions[resource][action];
    }
    return !!user.permissions[resource];
  })
}));

// Removed local mock - using global mock from src/test/utils.ts

vi.mock('fs/promises', () => {
  const writeFileFn = vi.fn();
  const mkdirFn = vi.fn();
  return {
    default: { writeFile: writeFileFn, mkdir: mkdirFn },
    writeFile: writeFileFn,
    mkdir: mkdirFn
  };
});

// Only declare what the production code actually uses from 'fs'.
// Using importOriginal + spreading in Vitest 4 ESM mode does not reliably
// override named exports — the production import stays bound to the real function.
vi.mock('fs', () => {
  const existsSyncFn = vi.fn().mockReturnValue(false);
  return {
    default: { existsSync: existsSyncFn },
    existsSync: existsSyncFn
  };
});

vi.mock('@/types/service-results', () => ({
  isTerminalStatus: vi.fn().mockReturnValue(false)
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'report1.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/abc_report1.pdf',
          fileSize: 1024000,
          uploadedBy: 'user-uuid-1',
          uploadedAt: new Date('2024-03-01')
        },
        {
          id: 2,
          serviceFulfillmentId: 789,
          fileName: 'report2.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/xyz_report2.pdf',
          fileSize: 2048000,
          uploadedBy: 'user-uuid-2',
          uploadedAt: new Date('2024-03-02')
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('attachments');
      expect(data.attachments).toHaveLength(2);
      expect(data.attachments[0]).toHaveProperty('fileName', 'report1.pdf');
      expect(data.attachments[1]).toHaveProperty('fileName', 'report2.pdf');
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
          assignedVendorId: 'vendor-123'
        }
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'vendor_report.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/vendor_report.pdf',
          fileSize: 500000,
          uploadedBy: 'vendor-user-uuid',
          uploadedAt: new Date()
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('attachments');
      expect(data.attachments).toHaveLength(1);
      expect(data.attachments[0]).toHaveProperty('fileName', 'vendor_report.pdf');
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
          assignedVendorId: 'vendor-999'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);

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
        customerId: 'customer-123'
      };

      const mockAttachments = [
        {
          id: 1,
          serviceFulfillmentId: 789,
          fileName: 'final_report.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/item-123/final_report.pdf',
          fileSize: 1500000,
          uploadedBy: 'customer-user-uuid',
          uploadedAt: new Date()
        }
      ];

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce(mockAttachments);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('attachments');
      expect(data.attachments).toHaveLength(1);
      expect(data.attachments[0]).toHaveProperty('fileName', 'final_report.pdf');
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
        customerId: 'customer-999'
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder as any);

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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(prisma.serviceAttachment.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/services/item-123/attachments');
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('attachments');
      expect(data.attachments).toEqual([]);
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

  // Helper: creates a mock POST request that bypasses real FormData/Blob/File parsing.
  // In the Node.js/Vitest environment, creating a Request with a FormData body and then
  // calling request.formData() produces a File object whose arrayBuffer() method is not
  // reliably supported. This helper provides a properly mocked file with a working
  // arrayBuffer() so the production code can proceed past the file-read step.
  function makeMockPdfRequest(opts: { fileName?: string; fileSize?: number } = {}) {
    const { fileName = 'test.pdf', fileSize = 1024 } = opts;
    const mockFile = {
      name: fileName,
      type: 'application/pdf',
      size: fileSize,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(fileSize))
    };
    return {
      formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(mockFile) })
    } as unknown as Request;
  }

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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 'sf-789',
        fileName: 'test.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/660e8400-e29b-41d4-a716-446655440004/uuid_test.pdf',
        fileSize: 1024,
        uploadedBy: 'user-123',
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      // existsSync already mocked to return false at module level
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: { create: vi.fn().mockResolvedValue(mockAttachment) },
          auditLog: { create: vi.fn().mockResolvedValue({}) }
        };
        const result = await callback(tx);
        return result;
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest({ fileName: 'test.pdf', fileSize: 1024 });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await POST(request, params);
      const { default: logger } = await import('@/lib/logger');
      const errorCalls = vi.mocked(logger.error).mock.calls;
      if (errorCalls.length > 0) {
        errorCalls.forEach((call, i) => {
          console.log(`--- logger.error call ${i} ---`);
          call.forEach(arg => {
            if (arg && typeof arg === 'object' && 'error' in arg) {
              const e = arg.error;
              console.log('ERROR TYPE:', typeof e, Object.getPrototypeOf(e)?.constructor?.name);
              console.log('ERROR MESSAGE:', e?.message);
              console.log('ERROR STACK:', e?.stack);
            } else {
              console.log('ARG:', arg);
            }
          });
        });
      } else {
        console.log('No logger.error calls were made');
      }
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
          permissions: { fulfillment: { view: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);

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
      expect(data).toHaveProperty('error', 'Insufficient permissions - fulfillment.edit required');
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789',
          assignedVendorId: 'vendor-123'
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 'sf-789',
        fileName: 'vendor_report.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/660e8400-e29b-41d4-a716-446655440004/uuid_vendor_report.pdf',
        fileSize: 2048,
        uploadedBy: 'vendor-user',
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      // existsSync already mocked to return false at module level
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: { create: vi.fn().mockResolvedValue(mockAttachment) },
          auditLog: { create: vi.fn().mockResolvedValue({}) }
        };
        const result = await callback(tx);
        return result;
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest({ fileName: 'vendor_report.pdf', fileSize: 2048 });
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
          assignedVendorId: 'vendor-999'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);

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
      const largeContent = new Uint8Array(5 * 1024 * 1024 + 1);
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
        status: 'Completed',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);

      const { isTerminalStatus } = await import('@/types/service-results');
      vi.mocked(isTerminalStatus).mockReturnValueOnce(true);

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
        status: 'Cancelled',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);

      const { isTerminalStatus } = await import('@/types/service-results');
      vi.mocked(isTerminalStatus).mockReturnValueOnce(true);

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
  });

  describe('file operations', () => {
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      const mockAttachment = {
        id: 1,
        serviceFulfillmentId: 'sf-789',
        fileName: 'test.pdf',
        filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/660e8400-e29b-41d4-a716-446655440004/uuid_test.pdf',
        fileSize: 1024,
        uploadedBy: 'user-123',
        uploadedAt: new Date()
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(fs.existsSync).mockReturnValue(false); // Directory doesn't exist
      vi.mocked(fsPromises.mkdir).mockResolvedValueOnce(undefined);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: { create: vi.fn().mockResolvedValue(mockAttachment) },
          auditLog: { create: vi.fn().mockResolvedValue({}) }
        };
        const result = await callback(tx);
        return result;
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest({ fileName: 'test.pdf' });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('uploads/service-results/550e8400-e29b-41d4-a716-446655440002/660e8400-e29b-41d4-a716-446655440004'),
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      let capturedCreateArgs: any;
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: {
            create: vi.fn().mockImplementation((args) => {
              capturedCreateArgs = args;
              return Promise.resolve({
                id: 1,
                ...args.data,
                uploadedAt: new Date()
              });
            })
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) }
        };
        const result = await callback(tx);
        return result;
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest({ fileName: 'my_report_2024.pdf', fileSize: 1024 });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      expect(capturedCreateArgs).toBeDefined();
      expect(capturedCreateArgs.data.fileName).toBe('my_report_2024.pdf');
      expect(capturedCreateArgs.data.filePath).toMatch(
        /uploads\/service-results\/550e8400-e29b-41d4-a716-446655440002\/660e8400-e29b-41d4-a716-446655440004\/.*_my_report_2024\.pdf/
      );
      expect(capturedCreateArgs.data.uploadedBy).toBe('user-123');
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      let capturedAuditArgs: any;
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fsPromises.writeFile).mockResolvedValueOnce(undefined);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          serviceAttachment: {
            create: vi.fn().mockResolvedValue({
              id: 100,
              serviceFulfillmentId: 'sf-789',
              fileName: 'audit_test.pdf',
              filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440002/660e8400-e29b-41d4-a716-446655440004/uuid_audit_test.pdf',
              fileSize: 2048,
              uploadedBy: 'user-123',
              uploadedAt: new Date()
            })
          },
          auditLog: {
            create: vi.fn().mockImplementation((args) => {
              capturedAuditArgs = args;
              return Promise.resolve({});
            })
          }
        };
        const result = await callback(tx);
        return result;
      });

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest({ fileName: 'audit_test.pdf', fileSize: 2048 });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await POST(request, params);

      expect(capturedAuditArgs).toBeDefined();
      expect(capturedAuditArgs.data.entityType).toBe('service_attachment');
      expect(capturedAuditArgs.data.entityId).toBe('100');
      expect(capturedAuditArgs.data.action).toBe('upload');
      expect(capturedAuditArgs.data.userId).toBe('user-123');
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
        status: 'Processing',
        serviceFulfillment: {
          id: 'sf-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem as any);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // Reject writeFile so the inner catch returns 'Failed to save file'
      vi.mocked(fsPromises.writeFile).mockRejectedValueOnce(new Error('Disk full'));

      // Use mock request — real Blob.arrayBuffer() is unreliable in Vitest/Node.js
      const request = makeMockPdfRequest();
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
