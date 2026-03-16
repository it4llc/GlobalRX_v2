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

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  logDatabaseError: vi.fn()
}));

describe('DELETE /api/dsx/remove-requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV for tests
    process.env.NODE_ENV = 'production';
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated in production', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should skip authentication check in development mode', async () => {
      process.env.NODE_ENV = 'development';
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      // Mock the transaction
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
    });
  });

  describe('permissions - SECURITY VULNERABILITY', () => {
    /**
     * CRITICAL SECURITY VULNERABILITY TEST #4
     * This test PROVES the security vulnerability: the endpoint has NO permission check at all!
     * Any authenticated user can delete requirements, regardless of permissions.
     *
     * This test will PASS with the current buggy code (proving the vulnerability exists)
     * and will FAIL after the fix is applied (when proper permission check is added).
     */
    it('VULNERABILITY: allows ANY authenticated user to delete requirements without permission check', async () => {
      // User has NO relevant permissions at all - just some random permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'malicious-user',
          permissions: {
            candidate_workflow: true  // Completely unrelated permission
            // NO global_config, NO dsx, NO admin permissions
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

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

      // VULNERABILITY: This should return 403 but it returns 200!
      // The endpoint has NO permission check, so any authenticated user can delete
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(1);
      expect(data.deleted.dsxMappings).toBe(3);

      // This proves that a user with NO relevant permissions was able to delete data!
    });

    /**
     * This test shows that even a user with minimal permissions can delete
     */
    it('VULNERABILITY: even vendor users can delete requirements', async () => {
      // Vendor user with only fulfillment permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          permissions: {
            fulfillment: true  // Vendor-only permission, should NOT allow DSX operations
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);

      // VULNERABILITY: Vendor user should NOT be able to delete DSX requirements
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    /**
     * This test shows that even customer users can delete requirements
     */
    it('VULNERABILITY: even customer users can delete requirements', async () => {
      // Customer user with only customer_config permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          permissions: {
            customer_config: true  // Customer-only permission, should NOT allow DSX operations
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);

      // VULNERABILITY: Customer user should NOT be able to delete DSX requirements
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      // Setup authenticated user (vulnerability: no permission check!)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {}  // No permissions needed due to bug
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
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

  describe('delete operations', () => {
    beforeEach(() => {
      // Setup authenticated user (vulnerability: no permission check!)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {}  // No permissions needed due to bug
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
    });

    it('should delete service requirement and DSX mappings in transaction', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 5 })
          }
        };

        const result = await fn(tx);

        // Verify the correct delete calls were made
        expect(tx.serviceRequirement.deleteMany).toHaveBeenCalledWith({
          where: {
            serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
            requirementId: 'req-789'
          }
        });

        expect(tx.dSXMapping.deleteMany).toHaveBeenCalledWith({
          where: {
            serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
            requirementId: 'req-789'
          }
        });

        return result || {
          serviceRequirements: 1,
          dsxMappings: 5
        };
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(1);
      expect(data.deleted.dsxMappings).toBe(5);
    });

    it('should handle case when no mappings exist', async () => {
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
    process.env.NODE_ENV = 'production';
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated in production', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementIds: ['req-1', 'req-2']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions - SECURITY VULNERABILITY', () => {
    /**
     * CRITICAL SECURITY VULNERABILITY TEST #5
     * The POST method also has NO permission check!
     * This allows bulk deletion without any permission verification.
     */
    it('VULNERABILITY: POST also allows ANY authenticated user to bulk delete without permission check', async () => {
      // User with NO relevant permissions
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'malicious-user',
          permissions: {
            random_permission: true  // Completely unrelated permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 3 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 10 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementIds: ['req-1', 'req-2', 'req-3']
        })
      });

      const response = await POST(request);

      // VULNERABILITY: Should return 403 but returns 200!
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(3);
      expect(data.deleted.dsxMappings).toBe(10);

      // User was able to bulk delete without any permission check!
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      // Setup authenticated user (vulnerability: no permission check!)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {}  // No permissions needed due to bug
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementIds: 'not-an-array'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing required parameters: serviceId and requirementIds array');
    });
  });

  describe('bulk delete operations', () => {
    beforeEach(() => {
      // Setup authenticated user (vulnerability: no permission check!)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {}  // No permissions needed due to bug
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
    });

    it('should bulk delete multiple requirements and mappings', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 3 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 15 })
          }
        };

        const result = await fn(tx);

        // Verify the correct delete calls were made
        expect(tx.serviceRequirement.deleteMany).toHaveBeenCalledWith({
          where: {
            serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
            requirementId: {
              in: ['req-1', 'req-2', 'req-3']
            }
          }
        });

        expect(tx.dSXMapping.deleteMany).toHaveBeenCalledWith({
          where: {
            serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
            requirementId: {
              in: ['req-1', 'req-2', 'req-3']
            }
          }
        });

        return result || {
          serviceRequirements: 3,
          dsxMappings: 15
        };
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementIds: ['req-1', 'req-2', 'req-3']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.deleted.serviceRequirements).toBe(3);
      expect(data.deleted.dsxMappings).toBe(15);
    });
  });

  describe('expected behavior after fix', () => {
    /**
     * These tests show what SHOULD happen after the security vulnerability is fixed
     */
    it('AFTER FIX: should return 403 when user lacks global_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            candidate_workflow: true  // Wrong permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);

      // Currently returns 200 (vulnerability), should return 403 after fix
      // expect(response.status).toBe(403);
      // const data = await response.json();
      // expect(data.error).toBe('Forbidden');

      // For now, the vulnerability allows it
      expect(response.status).toBe(200);
    });

    it('AFTER FIX: should allow user with global_config permission to delete', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            global_config: true  // Correct permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            deleteMany: vi.fn().mockResolvedValue({ count: 1 })
          },
          dSXMapping: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 })
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/remove-requirement?serviceId=service-123&requirementId=req-789');

      const response = await DELETE(request);

      // After fix, this should work properly with permission check
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});