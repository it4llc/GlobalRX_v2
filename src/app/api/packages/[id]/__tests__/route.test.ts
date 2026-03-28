// /GlobalRX_v2/src/app/api/packages/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { canManageCustomers } from '@/lib/auth-utils';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/auth-utils', () => ({
  canManageCustomers: vi.fn()
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
    error: vi.fn()
  }
}));

describe('GET /api/packages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REGRESSION TEST: proves bug fix for Next.js 15 params await requirement
  describe('REGRESSION TEST: params must be awaited before use in Next.js 15', () => {
    it('should correctly extract package ID from params without awaiting in GET handler', async () => {
      // This test verifies that params.id needs to be properly handled
      // Before fix: GET handler accesses params.id directly without awaiting
      // After fix: GET handler should await params and extract id correctly

      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      const packageId = 'package-123';
      const mockPackage = {
        id: packageId,
        name: 'Test Package',
        description: 'Test Description',
        customerId: 'customer-456',
        customer: { name: 'Test Customer' },
        createdAt: new Date(),
        updatedAt: new Date(),
        services: []
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage);

      const request = new NextRequest('http://localhost/api/packages/package-123');

      // Mock the params object that Next.js 15 provides as a Promise
      const params = Promise.resolve({ id: packageId });

      // Call the handler
      const response = await GET(request, { params });

      // Verify that prisma.package.findUnique was called with the correct ID
      expect(prisma.package.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: packageId }
        })
      );

      // The response should be 200, not a 500 error from trying to use params.id directly
      expect(response.status).toBe(200);
    });

    it('should handle async params correctly and not cause runtime errors in GET', async () => {
      // This test ensures the GET handler doesn't crash when params is a Promise
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { admin: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/packages/nonexistent-id');

      // Simulate Next.js 15 async params
      const params = Promise.resolve({ id: 'nonexistent-id' });

      const response = await GET(request, { params });

      // Should return 404 for package not found, not 500 for runtime error
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Package with ID nonexistent-id not found');
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/packages/123');
      const params = Promise.resolve({ id: '123' });

      const response = await GET(request, { params });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { some_other_permission: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/packages/123');
      const params = Promise.resolve({ id: '123' });

      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('successful package retrieval', () => {
    it('should return formatted package data', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: { view: true } }
        }
      };

      const mockPackage = {
        id: 'package-123',
        name: 'Test Package',
        description: 'Test Description',
        customerId: 'customer-456',
        customer: { name: 'Test Customer' },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        services: [
          {
            serviceId: 'service-1',
            scope: { type: 'basic' }
          }
        ]
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage);

      const request = new NextRequest('http://localhost/api/packages/package-123');
      const params = Promise.resolve({ id: 'package-123' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.id).toBe('package-123');
      expect(data.name).toBe('Test Package');
      expect(data.customerName).toBe('Test Customer');
      expect(data.services).toHaveLength(1);
      expect(data.services[0].serviceId).toBe('service-1');
    });
  });
});

describe('PUT /api/packages/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // REGRESSION TEST: proves bug fix for Next.js 15 params await requirement
  describe('REGRESSION TEST: params must be awaited before use in Next.js 15', () => {
    it('should correctly extract package ID from params without awaiting in PUT handler', async () => {
      // This test verifies that params.id needs to be properly handled
      // Before fix: PUT handler accesses params.id directly without awaiting
      // After fix: PUT handler should await params and extract id correctly

      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: { edit: true } }
        }
      };

      const packageId = 'package-123';
      const mockPackage = {
        id: packageId,
        customer: {
          services: []
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage);

      const requestBody = {
        name: 'Updated Package',
        description: 'Updated Description'
      };

      const request = new NextRequest('http://localhost/api/packages/package-123', {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      });

      // Mock the params object that Next.js 15 provides as a Promise
      const params = Promise.resolve({ id: packageId });

      // Mock transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return { id: packageId };
      });

      vi.mocked(prisma.package.findUnique)
        .mockResolvedValueOnce(mockPackage) // First call for checking existence
        .mockResolvedValueOnce({ // Second call for returning updated data
          ...mockPackage,
          name: 'Updated Package',
          services: []
        });

      // Call the handler
      const response = await PUT(request, { params });

      // Verify that prisma.package.findUnique was called with the correct ID
      expect(prisma.package.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: packageId }
        })
      );

      // The response should be 200, not a 500 error
      expect(response.status).toBe(200);
    });

    it('should handle async params correctly in PUT without runtime errors', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { admin: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/packages/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' })
      });

      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await PUT(request, { params });

      // Should return 404, not 500 for runtime error
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Package with ID nonexistent not found');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: { edit: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canManageCustomers).mockReturnValue(true);
    });

    it('should return 400 for invalid input', async () => {
      const mockPackage = {
        id: 'package-123',
        customer: { services: [] }
      };

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage);

      const request = new NextRequest('http://localhost/api/packages/package-123', {
        method: 'PUT',
        body: JSON.stringify({ name: '' }) // Empty name should fail validation
      });

      const params = Promise.resolve({ id: 'package-123' });
      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should validate services are available to customer', async () => {
      const mockPackage = {
        id: 'package-123',
        customer: {
          services: [
            { service: { id: 'service-1', name: 'Service 1' } }
          ]
        }
      };

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockPackage);

      const request = new NextRequest('http://localhost/api/packages/package-123', {
        method: 'PUT',
        body: JSON.stringify({
          services: [
            { serviceId: '123e4567-e89b-12d3-a456-426614174002', scope: {} } // valid UUID not available
          ]
        })
      });

      const params = Promise.resolve({ id: 'package-123' });
      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Package contains services not available to the customer');
      expect(data.unavailableServices).toEqual(['123e4567-e89b-12d3-a456-426614174002']);
    });
  });
});

describe('DELETE /api/packages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REGRESSION TEST: proves bug fix for Next.js 15 params await requirement
  describe('REGRESSION TEST: params must be awaited before use in Next.js 15', () => {
    it('should correctly extract package ID from params without awaiting in DELETE handler', async () => {
      // This test verifies that params.id needs to be properly handled
      // Before fix: DELETE handler accesses params.id directly without awaiting
      // After fix: DELETE handler should await params and extract id correctly

      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: ['*'] }
        }
      };

      const packageId = 'package-123';

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({ id: packageId });
      vi.mocked(prisma.package.delete).mockResolvedValueOnce({ id: packageId });

      const request = new NextRequest('http://localhost/api/packages/package-123', {
        method: 'DELETE'
      });

      // Mock the params object that Next.js 15 provides as a Promise
      const params = Promise.resolve({ id: packageId });

      // Call the handler
      const response = await DELETE(request, { params });

      // Verify that prisma operations were called with the correct ID
      expect(prisma.package.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: packageId }
        })
      );

      expect(prisma.package.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: packageId }
        })
      );

      // The response should be 200, not a 500 error
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should handle async params correctly in DELETE without runtime errors', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { admin: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/packages/nonexistent', {
        method: 'DELETE'
      });

      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await DELETE(request, { params });

      // Should return 404, not 500 for runtime error
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Package with ID nonexistent not found');
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/packages/123', {
        method: 'DELETE'
      });

      const params = Promise.resolve({ id: '123' });
      const response = await DELETE(request, { params });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { some_other_permission: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/packages/123', {
        method: 'DELETE'
      });

      const params = Promise.resolve({ id: '123' });
      const response = await DELETE(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('successful deletion', () => {
    it('should delete package successfully', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: { edit: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({ id: 'package-123' });
      vi.mocked(prisma.package.delete).mockResolvedValueOnce({ id: 'package-123' });

      const request = new NextRequest('http://localhost/api/packages/package-123', {
        method: 'DELETE'
      });

      const params = Promise.resolve({ id: 'package-123' });
      const response = await DELETE(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      expect(prisma.package.delete).toHaveBeenCalledWith({
        where: { id: 'package-123' }
      });
    });
  });
});