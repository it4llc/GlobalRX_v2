// /GlobalRX_v2/src/app/api/vendors/[id]/__tests__/usertype-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendorOrganization: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

/**
 * BUG PROOF TEST SUITE
 *
 * These tests prove that /api/vendors/[id] routes incorrectly use `session.user.type`
 * on lines 33 and 38 instead of the correct `session.user.userType` property.
 *
 * EXPECTED BEHAVIOR: These tests should ALL FAIL with the current buggy implementation
 * and PASS after the fix is applied.
 */
describe('UserType Bug - Vendor [id] Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockVendor = {
    id: 'vendor-123',
    name: 'Test Vendor',
    isActive: true,
    isPrimary: false,
    contactEmail: 'vendor@example.com',
    contactPhone: '555-0000',
    address: '123 Main St',
    notes: 'Test notes',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  describe('GET /api/vendors/[id] - userType bug', () => {
    it('should allow internal users with userType to view any vendor', async () => {
      // Internal user with ONLY userType set (not type)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property - this proves the bug
          permissions: { vendor_management: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);

      const request = new Request('http://localhost:3000/api/vendors/vendor-123');
      const response = await GET(request, { params: { id: 'vendor-123' } });

      // Internal users should be able to view any vendor
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('vendor-123');
    });

    it('should allow vendor users with userType to view their own vendor', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-123',  // Same as requested vendor
          permissions: {}
        }
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);

      const request = new Request('http://localhost:3000/api/vendors/vendor-123');
      const response = await GET(request, { params: { id: 'vendor-123' } });

      // Vendor users should be able to view their own vendor
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('vendor-123');
    });

    it('should block vendor users with userType from viewing other vendors', async () => {
      // Vendor user trying to view a DIFFERENT vendor
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-456',  // Different vendor!
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123');
      const response = await GET(request, { params: { id: 'vendor-123' } });

      // Vendor users should NOT be able to view other vendors
      // This will FAIL if code doesn't properly check userType
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Access denied');
    });

    it('should block customer users with userType from viewing vendors', async () => {
      // Customer user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          userType: 'customer',  // CORRECT property
          // Note: NO 'type' property
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123');
      const response = await GET(request, { params: { id: 'vendor-123' } });

      // Customer users should NOT be able to view vendors
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Access denied');
    });
  });

  describe('PUT /api/vendors/[id] - userType bug', () => {
    it('should allow internal users with userType to update vendors', async () => {
      // Internal user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);
      vi.mocked(prisma.vendorOrganization.update).mockResolvedValueOnce({
        ...mockVendor,
        name: 'Updated Vendor'
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Vendor'
        })
      });

      const response = await PUT(request, { params: { id: 'vendor-123' } });

      // Internal users should be allowed to update
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Vendor');
    });

    it('should block vendor users with userType from updating vendors', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-123',
          permissions: { global_config: true }  // Even with permission
        }
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Vendor'
        })
      });

      const response = await PUT(request, { params: { id: 'vendor-123' } });

      // Vendor users should NOT be allowed to update even their own vendor
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should block customer users with userType from updating vendors', async () => {
      // Customer user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          userType: 'customer',  // CORRECT property
          // Note: NO 'type' property
          customerId: 'customer-123',
          permissions: { global_config: true }  // Even with permission
        }
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Vendor'
        })
      });

      const response = await PUT(request, { params: { id: 'vendor-123' } });

      // Customer users should NOT be allowed to update vendors
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('DELETE /api/vendors/[id] - userType bug', () => {
    it('should allow internal users with userType to delete vendors', async () => {
      // Internal user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.delete).mockResolvedValueOnce(mockVendor);

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'vendor-123' } });

      // Internal users should be allowed to delete
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Vendor deleted successfully');
    });

    it('should block vendor users with userType from deleting vendors', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-123',
          permissions: { global_config: true }  // Even with permission
        }
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'vendor-123' } });

      // Vendor users should NOT be allowed to delete even their own vendor
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Edge case - conflicting type vs userType', () => {
    it('should use userType when both exist but differ', async () => {
      // This tests the case where both properties exist but have different values
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Correct property says internal
          type: 'vendor' as any,  // Wrong property says vendor
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);
      vi.mocked(prisma.vendorOrganization.update).mockResolvedValueOnce({
        ...mockVendor,
        name: 'Conflict Test Update'
      });

      const request = new Request('http://localhost:3000/api/vendors/vendor-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Conflict Test Update'
        })
      });

      const response = await PUT(request, { params: { id: 'vendor-123' } });

      // Should respect userType (internal) and allow, not type (vendor) which would block
      // This will FAIL if code uses type instead of userType
      expect(response.status).toBe(200);
    });
  });
});