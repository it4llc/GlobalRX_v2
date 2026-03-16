// src/app/api/dsx/remove-requirement/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceRequirement: {
      deleteMany: vi.fn()
    },
    dSXMapping: {
      deleteMany: vi.fn()
    }
  }
}));

// Mock auth-utils with the actual function used by the route
vi.mock('@/lib/auth-utils', () => ({
  canAccessDataRx: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  logDatabaseError: vi.fn()
}));

// Import the mocked canAccessDataRx after mocking
import { canAccessDataRx } from '@/lib/auth-utils';

describe('DELETE /api/dsx/remove-requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user lacks global_config permission', async () => {
      // User has NO relevant permissions
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-1',
          permissions: {
            candidate_workflow: true  // Unrelated permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // canAccessDataRx returns false for users without global_config
      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden - Insufficient permissions');
    });

    it('should return 403 when vendor user tries to delete requirements', async () => {
      // Vendor user with only fulfillment permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          permissions: {
            fulfillment: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });

    it('should return 403 when customer user tries to delete requirements', async () => {
      // Customer user with only customer_config permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          permissions: {
            customer_config: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });

    it('should allow internal user with global_config permission to delete requirements', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: {
            global_config: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // canAccessDataRx returns true for internal users with global_config
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 3 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(1);
      expect(data.deleted.dsxMappings).toBe(3);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { global_config: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);
    });

    it('should return 400 when serviceId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementId');
    });

    it('should return 400 when requirementId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123');

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementId');
    });

    it('should return 400 when both parameters are missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement');

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementId');
    });
  });

  describe('successful deletion', () => {
    it('should successfully delete requirement and mappings', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { global_config: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);

      // Mock the transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 5 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(1);
      expect(data.deleted.dsxMappings).toBe(5);
    });

    it('should handle case where no mappings exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { global_config: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);

      // Mock the transaction with no mappings
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(1);
      expect(data.deleted.dsxMappings).toBe(0);
    });
  });
});

describe('POST /api/dsx/remove-requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirementIds: ['req-1', 'req-2']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user lacks permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-1',
          permissions: {}
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirementIds: ['req-1']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should allow bulk deletion with proper permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { global_config: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);

      // Mock the transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 8 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirementIds: ['req-1', 'req-2']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(2);
      expect(data.deleted.dsxMappings).toBe(8);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { global_config: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);
    });

    it('should return 400 when serviceId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          requirementIds: ['req-1']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementIds array');
    });

    it('should return 400 when requirementIds is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementIds array');
    });

    it('should return 400 when requirementIds is not an array', async () => {
      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirementIds: 'not-an-array'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementIds array');
    });
  });
});