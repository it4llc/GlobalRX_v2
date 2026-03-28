// /GlobalRX_v2/src/app/api/customers/[id]/packages/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../route';
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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn()
    },
    package: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn()
    },
    packageService: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/auth-utils', () => ({
  canManageCustomers: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/lib/utils', () => ({
  getErrorDetails: vi.fn((error) => ({
    message: error?.message || 'Unknown error',
    stack: error?.stack || ''
  }))
}));

describe('POST /api/customers/[id]/packages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REGRESSION TEST: proves bug fix for Next.js 15 params await requirement
  describe('REGRESSION TEST: params must be awaited before use in Next.js 15', () => {
    it('should correctly extract customer ID from awaited params in POST handler', async () => {
      // This test verifies that params.id is properly awaited before use
      // Before fix: The POST handler uses `id` directly without awaiting params
      // After fix: The POST handler should await params and extract id correctly

      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      const customerId = 'customer-123';
      const mockCustomer = {
        id: customerId,
        name: 'Test Customer',
        services: []
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);
      vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(prisma));
      vi.mocked(prisma.package.create).mockResolvedValueOnce({ id: 'new-package-id', name: 'Test Package', customerId: 'customer-123', createdAt: new Date(), updatedAt: new Date() });
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(null);

      // Create a mock request
      const requestBody = {
        name: 'Test Package',
        description: 'Test Description',
        services: []
      };

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      // Mock the params object that Next.js 15 provides as a Promise
      const params = Promise.resolve({ id: customerId });

      // Call the handler
      const response = await POST(request, { params });

      // Verify that prisma.customer.findUnique was called with the correct ID
      expect(prisma.customer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: customerId }
        })
      );

      // The response should be 400 (no services) or 201, not a 500 error
      expect(response.status).not.toBe(500);
    });

    it('should handle async params correctly and not cause runtime errors', async () => {
      // This test ensures the POST handler doesn't crash when params is a Promise
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);

      // Mock customer not found to test error handling
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/customers/test-id/packages', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', services: [] })
      });

      // Simulate Next.js 15 async params
      const params = Promise.resolve({ id: 'test-id' });

      const response = await POST(request, { params });

      // Should return 404 for customer not found, not 500 for runtime error
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Customer with ID test-id not found');
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/customers/123/packages', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Package' })
      });

      const params = Promise.resolve({ id: '123' });
      const response = await POST(request, { params });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/customers/123/packages', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Package' })
      });

      const params = Promise.resolve({ id: '123' });
      const response = await POST(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canManageCustomers).mockReturnValue(true);
    });

    it('should return 400 when package name is missing', async () => {
      const mockCustomer = {
        id: 'customer-123',
        name: 'Test Customer',
        services: []
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages', {
        method: 'POST',
        body: JSON.stringify({ description: 'No name provided', services: [] })
      });

      const params = Promise.resolve({ id: 'customer-123' });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 when services are not available to customer', async () => {
      const mockCustomer = {
        id: 'customer-123',
        name: 'Test Customer',
        services: [
          {
            service: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Service 1' }
          }
        ]
      };

      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Package',
          services: [
            { serviceId: '123e4567-e89b-12d3-a456-426614174001', scope: {} } // different UUID not available
          ]
        })
      });

      const params = Promise.resolve({ id: 'customer-123' });
      const response = await POST(request, { params });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Package contains services not available to the customer');
      expect(data.unavailableServices).toEqual(['123e4567-e89b-12d3-a456-426614174001']);
    });
  });

  describe('successful package creation', () => {
    it('should create package with services successfully', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      const mockCustomer = {
        id: 'customer-123',
        name: 'Test Customer',
        services: [
          {
            service: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Service 1',
              functionalityType: 'standard'
            }
          }
        ]
      };

      const mockCreatedPackage = {
        id: 'package-456',
        name: 'Test Package',
        description: 'Test Description',
        customerId: 'customer-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        packageServices: [
          {
            service: { id: '123e4567-e89b-12d3-a456-426614174000', name: 'Service 1' },
            scope: { type: 'basic' }
          }
        ]
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);
      vi.mocked(prisma.package.create).mockResolvedValueOnce({ id: 'package-456' });
      vi.mocked(prisma.packageService.create).mockResolvedValue({});
      vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(prisma));
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce(mockCreatedPackage);

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Package',
          description: 'Test Description',
          services: [
            { serviceId: '123e4567-e89b-12d3-a456-426614174000', scope: { type: 'basic' } }
          ]
        })
      });

      const params = Promise.resolve({ id: 'customer-123' });
      const response = await POST(request, { params });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('package-456');
      expect(data.name).toBe('Test Package');
      expect(data.services).toHaveLength(1);
    });
  });
});

describe('GET /api/customers/[id]/packages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('params handling verification', () => {
    it('should correctly handle awaited params in GET handler', async () => {
      // GET handler already awaits params correctly, this test verifies it continues to work
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      const customerId = 'customer-123';
      const mockCustomer = {
        id: customerId,
        name: 'Test Customer'
      };

      const mockPackages = [
        {
          id: 'package-1',
          name: 'Package 1',
          description: 'Description 1',
          createdAt: new Date(),
          updatedAt: new Date(),
          packageServices: []
        }
      ];

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);
      vi.mocked(prisma.package.findMany).mockResolvedValueOnce(mockPackages);

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages');
      const params = Promise.resolve({ id: customerId });

      const response = await GET(request, { params });

      expect(prisma.customer.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: customerId }
        })
      );

      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: customerId }
        })
      );

      expect(response.status).toBe(200);
    });
  });

  describe('authentication and authorization', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/customers/123/packages');
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
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/customers/123/packages');
      const params = Promise.resolve({ id: '123' });

      const response = await GET(request, { params });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('customer validation', () => {
    it('should return 404 when customer does not exist', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/customers/invalid-id/packages');
      const params = Promise.resolve({ id: 'invalid-id' });

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Customer with ID invalid-id not found');
    });
  });

  describe('successful package retrieval', () => {
    it('should return formatted packages with services', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          permissions: { customer_config: true }
        }
      };

      const mockCustomer = {
        id: 'customer-123',
        name: 'Test Customer'
      };

      const mockPackages = [
        {
          id: 'package-1',
          name: 'Package 1',
          description: 'Description 1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          packageServices: [
            {
              service: { id: 'service-1', name: 'Service 1' },
              scope: { type: 'basic' }
            }
          ]
        },
        {
          id: 'package-2',
          name: 'Package 2',
          description: null,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-04'),
          packageServices: []
        }
      ];

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(canManageCustomers).mockReturnValueOnce(true);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);
      vi.mocked(prisma.package.findMany).mockResolvedValueOnce(mockPackages);

      const request = new NextRequest('http://localhost/api/customers/customer-123/packages');
      const params = Promise.resolve({ id: 'customer-123' });

      const response = await GET(request, { params });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveLength(2);
      expect(data[0].id).toBe('package-1');
      expect(data[0].services).toHaveLength(1);
      expect(data[0].services[0].service.id).toBe('service-1');
      expect(data[1].id).toBe('package-2');
      expect(data[1].services).toHaveLength(0);
    });
  });
});