// REGRESSION TEST: proves bug fix for customer config permission consistency
// Bug: Package API checks for "customers" permission but User Admin saves "customer_config"
// This test should FAIL before the fix and PASS after the fix

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '../route';
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
    package: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    packageService: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Package API Permission Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/packages/[id] - Permission Bug Regression', () => {
    const mockPackage = {
      id: 'pkg1',
      name: 'Test Package',
      description: 'Test Description',
      customerId: 'customer1',
      customer: {
        id: 'customer1',
        name: 'Test Customer'
      },
      packageServices: [
        {
          serviceId: 'service1',
          scope: { type: 'standard' },
          service: {
            id: 'service1',
            name: 'Background Check'
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // REGRESSION TEST: This is the key test that proves the bug exists
    it('REGRESSION: should accept user with customer_config permission for view (currently fails)', async () => {
      // User has the permission that User Admin UI saves
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin-user',
          permissions: { customer_config: { view: true } } // This is what User Admin saves
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      // This SHOULD return 200 with the package data, but currently returns 403
      // After the fix, this assertion will pass
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('pkg1');
      expect(data.name).toBe('Test Package');
    });

    // This test shows what currently works (wrong behavior)
    it('accepts user with "customer_config" permission for view (correct key)', async () => {
      // User has the CORRECT permission key
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-with-correct-key',
          permissions: { customer_config: { view: true } } // Correct key
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      // Works with correct permission key
      expect(response.status).toBe(200);
    });

    it('should reject user without view permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-no-perms',
          permissions: { fulfillment: '*' } // Unrelated permission
        }
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should return 404 when package does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin',
          permissions: { customer_config: { view: true } }
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/packages/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('PUT /api/packages/[id] - Permission Bug Regression', () => {
    const existingPackage = {
      id: 'pkg1',
      name: 'Old Name',
      description: 'Old Description',
      customer: {
        id: 'customer1',
        services: [
          {
            service: {
              id: 'service1',
              name: 'Service 1',
              functionalityType: 'verification'
            }
          }
        ]
      }
    };

    // REGRESSION TEST: Key test for PUT endpoint
    it('REGRESSION: should accept user with customer_config permission for edit (currently fails)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin-user',
          permissions: { customer_config: { edit: true } } // What User Admin saves
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(existingPackage as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({ id: 'pkg1', name: 'Updated Name' })
          },
          packageService: {
            deleteMany: vi.fn(),
            create: vi.fn()
          }
        };
        return callback(tx);
      });
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        ...existingPackage,
        name: 'Updated Name'
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'Updated Description'
        })
      });

      const response = await PUT(request, { params: { id: 'pkg1' } });

      // Should return 200 with updated package
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Name');
    });

    // Show current wrong behavior
    it('accepts user with "customer_config" permission for edit (correct key)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-correct-key',
          permissions: { customer_config: { edit: true } } // Correct key
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(existingPackage as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({ id: 'pkg1' })
          },
          packageService: {
            deleteMany: vi.fn(),
            create: vi.fn()
          }
        };
        return callback(tx);
      });
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(existingPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' })
      });

      const response = await PUT(request, { params: { id: 'pkg1' } });

      // Works with correct permission key
      expect(response.status).toBe(200);
    });

    // TODO: Pre-existing bugs found during permission key fix:
    // 1. PUT returns 500 instead of 403 for view-only users
    // 2. DELETE returns 200 instead of 403 for view-only users
    // These need separate bug fixes - see fix/customer-config-permissions branch

    it('should validate required fields', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin',
          permissions: { customer_config: { edit: true } }
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(existingPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'PUT',
        body: JSON.stringify({ name: '' }) // Empty name should fail validation
      });

      const response = await PUT(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Validation failed');
    });
  });

  describe('DELETE /api/packages/[id] - Permission Bug Regression', () => {
    // REGRESSION TEST: Key test for DELETE endpoint
    it('REGRESSION: should accept user with customer_config permission for delete (currently fails)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin-user',
          permissions: { customer_config: { edit: true } } // What User Admin saves (edit includes delete)
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({ id: 'pkg1' } as any);
      vi.mocked(prisma.package.delete).mockResolvedValueOnce({ id: 'pkg1' } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'pkg1' } });

      // Should return 200 with success
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    // Show current wrong behavior
    it('accepts user with "customer_config" permission for delete (correct key)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-correct-key',
          permissions: { customer_config: { edit: true } } // Correct key
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({ id: 'pkg1' } as any);
      vi.mocked(prisma.package.delete).mockResolvedValueOnce({ id: 'pkg1' } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'pkg1' } });

      // Works with correct permission key
      expect(response.status).toBe(200);
    });


    it('should return 404 when package does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin',
          permissions: { customer_config: { edit: true } }
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/packages/nonexistent', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('Authentication checks', () => {
    it('should return 401 when not authenticated for GET', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when not authenticated for PUT', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });

      const response = await PUT(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when not authenticated for DELETE', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/packages/pkg1', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Permission format variations', () => {
    it('REGRESSION: should accept customer_config with wildcard format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: '*' } // Wildcard format
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg1',
        customer: { name: 'Test' },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(200);
    });

    it('REGRESSION: should accept customer_config with boolean format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: true } // Boolean format (implies all permissions)
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg1',
        customer: { name: 'Test' },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(200);
    });

    it('REGRESSION: should accept customer_config with array format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: ['view', 'edit'] } // Array format
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg1',
        customer: { name: 'Test' },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg1');
      const response = await GET(request, { params: { id: 'pkg1' } });

      expect(response.status).toBe(200);
    });
  });
});