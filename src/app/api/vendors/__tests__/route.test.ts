// /GlobalRX_v2/src/app/api/vendors/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendorOrganization: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock vendorUtils with the actual function used by the route
vi.mock('@/lib/vendorUtils', () => ({
  canUserManageVendors: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Import the mocked canUserManageVendors after mocking
import { canUserManageVendors } from '@/lib/vendorUtils';

describe('POST /api/vendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks vendor management permission', async () => {
      const mockUser = {
        id: '1',
        userType: 'internal',
        permissions: { candidate_workflow: true }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      // canUserManageVendors returns false for users without proper permissions
      vi.mocked(canUserManageVendors).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');

      // Verify it checked using canUserManageVendors
      expect(canUserManageVendors).toHaveBeenCalledWith(mockUser);
    });

    it('should return 403 when vendor user tries to create vendor', async () => {
      const mockUser = {
        id: '2',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: {}
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      // Vendor users cannot manage vendors
      vi.mocked(canUserManageVendors).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        userType: 'internal',
        permissions: { global_config: true }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(canUserManageVendors).mockReturnValueOnce(true);
    });

    it('should return 400 when name is missing', async () => {
      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when phone number is missing', async () => {
      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 when email is invalid', async () => {
      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'not-an-email',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        userType: 'internal',
        permissions: { global_config: true }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser
      });

      vi.mocked(canUserManageVendors).mockReturnValueOnce(true);
    });

    it('should unset other primary vendors when creating new primary', async () => {
      const mockTransaction = {
        vendorOrganization: {
          findFirst: vi.fn().mockResolvedValueOnce({ id: 'existing-primary', isPrimary: true }),
          updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
          create: vi.fn().mockResolvedValueOnce({
            id: 'new-vendor',
            name: 'Primary Vendor',
            isActive: true,
            isPrimary: true,
            contactEmail: 'primary@vendor.com',
            contactPhone: '555-1111',
            address: null,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
        }
      };

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        return fn(mockTransaction as any);
      });

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Primary Vendor',
          isActive: true,
          isPrimary: true,
          contactEmail: 'primary@vendor.com',
          contactPhone: '555-1111'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should create vendor successfully with valid data', async () => {
      vi.mocked(prisma.vendorOrganization.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.vendorOrganization.create).mockResolvedValueOnce({
        id: 'new-vendor',
        name: 'Test Vendor',
        isActive: true,
        isPrimary: false,
        contactEmail: 'test@vendor.com',
        contactPhone: '555-0000',
        address: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBe('new-vendor');
      expect(data.name).toBe('Test Vendor');
    });

    it('should return 409 when vendor name already exists', async () => {
      vi.mocked(prisma.vendorOrganization.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.vendorOrganization.create).mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['name'] }
      });

      const request = new Request('http://localhost:3000/api/vendors', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Existing Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });
});

describe('GET /api/vendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('permissions', () => {
    it('should return all vendors for internal users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const mockVendors = [
        { id: 'v1', name: 'Vendor 1' },
        { id: 'v2', name: 'Vendor 2' }
      ];

      vi.mocked(prisma.vendorOrganization.findMany).mockResolvedValueOnce(mockVendors);

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
    });

    it('should return only assigned vendor for vendor users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockVendor = {
        id: 'vendor-123',
        name: 'My Vendor'
      };

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('vendor-123');
    });

    it('should return empty array for customer users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(0);
    });
  });

  describe('query parameters', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { global_config: true }
        }
      });
    });

    it('should filter by active status', async () => {
      const mockVendors = [
        { id: 'v1', name: 'Active Vendor', isActive: true }
      ];

      vi.mocked(prisma.vendorOrganization.findMany).mockResolvedValueOnce(mockVendors);

      const request = new Request('http://localhost:3000/api/vendors?active=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.vendorOrganization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true
          })
        })
      );
    });

    it('should filter by primary status', async () => {
      const mockVendors = [
        { id: 'v1', name: 'Primary Vendor', isPrimary: true }
      ];

      vi.mocked(prisma.vendorOrganization.findMany).mockResolvedValueOnce(mockVendors);

      const request = new Request('http://localhost:3000/api/vendors?primary=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.vendorOrganization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPrimary: true
          })
        })
      );
    });
  });
});