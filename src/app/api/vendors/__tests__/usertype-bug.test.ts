// /GlobalRX_v2/src/app/api/vendors/__tests__/usertype-bug.test.ts

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

/**
 * BUG PROOF TEST SUITE
 *
 * These tests prove that the current implementation incorrectly uses `session.user.type`
 * instead of the correct `session.user.userType` property.
 *
 * EXPECTED BEHAVIOR: These tests should ALL FAIL with the current buggy implementation
 * and PASS after the fix is applied.
 *
 * The bug manifests when a session has ONLY userType set (the correct property)
 * but not type (the incorrect property being accessed).
 */
describe('UserType Bug - Vendor Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/vendors - userType bug', () => {
    it('should correctly identify internal users using userType (not type)', async () => {
      // This session has ONLY userType (correct), not type
      // This test will FAIL with the buggy code that checks session.user.type
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property - this is what proves the bug
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

      // This SHOULD work for internal users, but will fail if code uses session.user.type
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(prisma.vendorOrganization.findMany).toHaveBeenCalled();
    });

    it('should correctly identify vendor users using userType (not type)', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockVendor = {
        id: 'vendor-123',
        name: 'My Vendor',
        isActive: true,
        isPrimary: false,
        contactEmail: 'vendor@example.com',
        contactPhone: '555-0000'
      };

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      // Vendor users should get their own vendor, but will fail if code uses session.user.type
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('vendor-123');
    });

    it('should correctly identify customer users using userType (not type)', async () => {
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

      const request = new Request('http://localhost:3000/api/vendors');
      const response = await GET(request);

      // Customer users should get empty array, but will fail if code uses session.user.type
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(0);
    });
  });

  describe('POST /api/vendors - userType bug', () => {
    it('should allow internal users with userType to create vendors', async () => {
      // Internal user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property
          permissions: { global_config: true }
        }
      });

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

      // Internal users should be allowed, but will fail if code uses session.user.type
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Test Vendor');
    });

    it('should block vendor users with userType from creating vendors', async () => {
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

      // Vendor users should be blocked, but buggy code might not recognize userType
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should block customer users with userType from creating vendors', async () => {
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

      // Customer users should be blocked, but buggy code might not recognize userType
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Edge cases - fallback patterns', () => {
    it('should NOT rely on type || userType fallback pattern', async () => {
      // This test specifically targets the fallback pattern bug
      // where code tries: session.user.type || session.user.userType
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Only correct property
          // type is undefined, which makes (type || userType) work
          // but (type) alone fails
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.vendorOrganization.create).mockResolvedValueOnce({
        id: 'new-vendor',
        name: 'Fallback Test Vendor',
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
          name: 'Fallback Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);

      // Should work with just userType, no fallback needed
      expect(response.status).toBe(201);
    });

    it('should handle when both type and userType exist but differ', async () => {
      // This edge case tests what happens if both exist but have different values
      // The correct behavior is to use userType
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Correct value
          type: 'vendor' as any,  // Wrong value in wrong property
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.vendorOrganization.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.vendorOrganization.create).mockResolvedValueOnce({
        id: 'new-vendor',
        name: 'Conflict Test Vendor',
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
          name: 'Conflict Test Vendor',
          isActive: true,
          isPrimary: false,
          contactEmail: 'test@vendor.com',
          contactPhone: '555-0000'
        })
      });

      const response = await POST(request);

      // Should use userType (internal) and allow, not type (vendor) which would block
      // This will FAIL if code uses type instead of userType
      expect(response.status).toBe(201);
    });
  });
});