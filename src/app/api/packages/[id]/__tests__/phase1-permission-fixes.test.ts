// /GlobalRX_v2/src/app/api/packages/[id]/__tests__/phase1-permission-fixes.test.ts

// Phase 1 Candidate Invite - Test for Business Rules 8 & 9
// Tests that view-only users get proper 403 responses (not 500 or 200)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '../route';
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
    workflow: {
      findUnique: vi.fn()
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
    error: vi.fn()
  }
}));

describe('Phase 1 - Package API Permission Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPackage = {
    id: 'pkg-123',
    name: 'Test Package',
    description: 'Test Description',
    workflowId: null,
    customer: {
      id: 'cust-123',
      name: 'Test Customer',
      services: []  // customer.services for service availability check
    }
  };

  const mockPackageForExistingCheck = {
    ...mockPackage,
    customer: {
      ...mockPackage.customer,
      services: []  // The first findUnique includes customer.services
    }
  };

  describe('PUT /api/packages/[id] - Business Rule 8', () => {
    it('should return 403 when user has only view permission', async () => {
      // User has view permission only - should not be able to edit
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'view-only-user',
          permissions: { customer_config: { view: true } } // Only view, not edit
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name'
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      // Should return 403 Forbidden, not 500
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should allow user with edit permission to update', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'edit-user',
          permissions: { customer_config: { edit: true } }
        }
      } as any);

      vi.mocked(prisma.package.findUnique)
        .mockResolvedValueOnce(mockPackage as any) // First call - check if package exists
        .mockResolvedValueOnce({  // Second call - get updated package with services
          ...mockPackage,
          name: 'Updated Name',
          workflow: null,
          services: []  // The response includes 'services', not 'packageServices'
        } as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({ id: 'pkg-123', name: 'Updated Name' })
          },
          packageService: {
            deleteMany: vi.fn(),
            create: vi.fn()
          }
        };
        return callback(tx);
      });

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name'
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('should allow user with wildcard customer_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'wildcard-user',
          permissions: { customer_config: '*' } // Wildcard permission
        }
      } as any);

      vi.mocked(prisma.package.findUnique)
        .mockResolvedValueOnce(mockPackage as any) // First call - check if package exists
        .mockResolvedValueOnce(mockPackage as any); // Second call - get updated package

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({ id: 'pkg-123' })
          },
          packageService: {
            deleteMany: vi.fn()
          }
        };
        return callback(tx);
      });

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({ description: 'New description' })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
    });

    it('should allow admin users regardless of customer_config permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          permissions: { admin: true }
        }
      } as any);

      vi.mocked(prisma.package.findUnique)
        .mockResolvedValueOnce(mockPackage as any) // First call - check if package exists
        .mockResolvedValueOnce(mockPackage as any); // Second call - get updated package

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({ id: 'pkg-123' })
          },
          packageService: {
            deleteMany: vi.fn()
          }
        };
        return callback(tx);
      });

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Admin Update' })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/packages/[id] - Business Rule 9', () => {
    it('should return 403 when user has only view permission', async () => {
      // User has view permission only - should not be able to delete
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'view-only-user',
          permissions: { customer_config: { view: true } } // Only view, not edit
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      // Should return 403 Forbidden, not 200
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should allow user with edit permission to delete', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'edit-user',
          permissions: { customer_config: { edit: true } }
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);
      vi.mocked(prisma.package.delete).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should allow user with boolean customer_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'boolean-user',
          permissions: { customer_config: true } // Boolean format implies all permissions
        }
      } as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage as any);
      vi.mocked(prisma.package.delete).mockResolvedValueOnce(mockPackage as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should reject user without any customer_config permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'no-perms-user',
          permissions: { fulfillment: '*' } // Different permission domain
        }
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });
});