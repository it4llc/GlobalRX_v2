// /GlobalRX_v2/src/app/api/fulfillment/__tests__/internal-users-unassigned-orders.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

/**
 * BUG PROOF TEST SUITE: Internal Users Can't See Unassigned Orders
 *
 * This test suite proves that the /api/fulfillment endpoint has a bug on line 64
 * where internal users are incorrectly filtered to only see orders with
 * assignedVendorId NOT null, preventing them from seeing unassigned orders.
 *
 * CURRENT BEHAVIOR (BUGGY):
 * - Line 64: whereClause.assignedVendorId = { not: null };
 * - This filters OUT all unassigned orders for internal users
 *
 * EXPECTED BEHAVIOR (CORRECT):
 * - Internal users should see ALL orders regardless of vendor assignment
 * - They need to see unassigned orders to assign them to vendors
 *
 * THE MAIN TEST (first one) MUST FAIL with the current buggy implementation
 * to prove the bug exists. After the fix, all tests should pass.
 */
describe('Internal Users Unassigned Orders Bug - Fulfillment Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock implementations that return valid data
    vi.mocked(prisma.order.findMany).mockResolvedValue([]);
    vi.mocked(prisma.order.count).mockResolvedValue(0);
  });

  // Test data with mix of assigned and unassigned orders
  const mockOrders = [
    {
      id: 'order-1',
      orderNumber: 'ORD-2024-001',
      customerId: 'customer-1',
      assignedVendorId: 'vendor-1',  // ASSIGNED
      statusCode: 'pending',
      subject: { firstName: 'John', lastName: 'Doe' },
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 'customer-1', name: 'Customer One' },
      assignedVendor: { id: 'vendor-1', name: 'Vendor One' },
      items: []
    },
    {
      id: 'order-2',
      orderNumber: 'ORD-2024-002',
      customerId: 'customer-2',
      assignedVendorId: null,  // UNASSIGNED - internal users should see this
      statusCode: 'pending',
      subject: { firstName: 'Jane', lastName: 'Smith' },
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 'customer-2', name: 'Customer Two' },
      assignedVendor: null,
      items: []
    },
    {
      id: 'order-3',
      orderNumber: 'ORD-2024-003',
      customerId: 'customer-1',
      assignedVendorId: 'vendor-2',  // ASSIGNED to different vendor
      statusCode: 'processing',
      subject: { firstName: 'Bob', lastName: 'Johnson' },
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 'customer-1', name: 'Customer One' },
      assignedVendor: { id: 'vendor-2', name: 'Vendor Two' },
      items: []
    },
    {
      id: 'order-4',
      orderNumber: 'ORD-2024-004',
      customerId: 'customer-3',
      assignedVendorId: null,  // UNASSIGNED - another one internal users should see
      statusCode: 'pending',
      subject: { firstName: 'Alice', lastName: 'Williams' },
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: { id: 'customer-3', name: 'Customer Three' },
      assignedVendor: null,
      items: []
    }
  ];

  describe('✅ BUG FIX VERIFICATION - Bug is now fixed', () => {
    it('should allow internal users to see both assigned and unassigned orders (BUG FIXED)', async () => {
      // Setup: Internal user with fulfillment permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'internal-user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      // Mock successful response - internal users see ALL orders now (bug is fixed)
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(mockOrders.length);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // VERIFY THE FIX: Internal users should NOT have any vendor filter
      expect(prisma.order.findMany).toHaveBeenCalled();

      // Get the actual where clause from the call
      const actualCall = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      const actualWhereClause = actualCall?.where || {};

      // AFTER THE FIX: There should be NO assignedVendorId filter for internal users
      expect(actualWhereClause.assignedVendorId).toBeUndefined();

      // The response should include all orders (both assigned and unassigned)
      expect(data.orders).toHaveLength(4); // We have 4 mock orders total
      expect(data.total).toBe(4);
    });

    it('should allow admin users to see both assigned and unassigned orders too (BUG FIXED)', async () => {
      // Admin users have the same bug as internal users
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user-1',
          userType: 'admin',
          permissions: { fulfillment: '*' }
        }
      });

      const assignedOnlyOrders = mockOrders.filter(o => o.assignedVendorId !== null);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(assignedOnlyOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(assignedOnlyOrders.length);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      await GET(request);

      // Admin users should also NOT have any vendor filter (BUG IS FIXED)
      const actualCall = vi.mocked(prisma.order.findMany).mock.calls[0]?.[0];
      const actualWhereClause = actualCall?.where || {};

      // AFTER THE FIX: There should be NO assignedVendorId filter for admin users
      expect(actualWhereClause.assignedVendorId).toBeUndefined();
    });
  });

  describe('Correct Behavior - Vendor users should be filtered', () => {
    it('should CORRECTLY filter by vendor ID for vendor users (NO BUG HERE)', async () => {
      // Vendor users should only see their assigned orders - this is correct
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user-1',
          userType: 'vendor',
          vendorId: 'vendor-1',
          permissions: { fulfillment: true }
        }
      });

      const vendor1Orders = mockOrders.filter(o => o.assignedVendorId === 'vendor-1');
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(vendor1Orders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      await GET(request);

      // Verify it filters by the vendor's ID - this is CORRECT behavior
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedVendorId: 'vendor-1' // CORRECT: Vendors should only see their orders
          })
        })
      );

      // For vendor users, the filter is a string (their vendor ID), not { not: null }
      const whereClause = vi.mocked(prisma.order.findMany).mock.calls[0][0].where;
      expect(whereClause.assignedVendorId).toBe('vendor-1');
      expect(whereClause.assignedVendorId).not.toEqual({ not: null });
    });
  });

  describe('Authentication and Permission Tests', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 if user lacks fulfillment permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'internal-user-no-perms',
          userType: 'internal',
          permissions: { customers: true } // Has other permissions but not fulfillment
        }
      });

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Impact of the Bug - What Internal Users Can\'t Do', () => {
    it('demonstrates that internal users cannot find unassigned orders even when searching', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'internal-user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      // Even when searching for "Jane" (who has an unassigned order), the filter blocks it
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);

      const request = new NextRequest('http://localhost:3000/api/fulfillment?search=Jane');
      await GET(request);

      // The bug: search is combined with assignedVendorId filter
      const whereClause = vi.mocked(prisma.order.findMany).mock.calls[0][0].where;

      // The search conditions are added
      expect(whereClause.OR).toBeDefined();

      // BUG IS FIXED: No vendor filter is applied for internal users anymore
      expect(whereClause.assignedVendorId).toBeUndefined();

      // This means Jane's unassigned order (order-2) CAN now be found
    });

    it('demonstrates that filtering by status still excludes unassigned orders', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'internal-user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      // There are 3 pending orders total (1 assigned, 2 unassigned)
      // But internal users can only see the 1 assigned one due to the bug
      const pendingAssignedOnly = mockOrders.filter(
        o => o.statusCode === 'pending' && o.assignedVendorId !== null
      );
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(pendingAssignedOnly);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/fulfillment?status=pending');
      await GET(request);

      // BUG IS FIXED: Status filter works but NO vendor filter for internal users
      const whereClause = vi.mocked(prisma.order.findMany).mock.calls[0][0].where;
      expect(whereClause.statusCode).toBe('pending');
      expect(whereClause.assignedVendorId).toBeUndefined(); // FIXED!

      // This means ALL 3 pending orders are now visible to internal users
    });
  });
});

/**
 * TEST SUMMARY
 *
 * This test suite PROVES the bug exists in /api/fulfillment route where:
 *
 * BUG LOCATION: Line 64 of route.ts
 * BUG CODE: whereClause.assignedVendorId = { not: null };
 *
 * IMPACT:
 * - Internal users CANNOT see unassigned orders
 * - Admin users CANNOT see unassigned orders
 * - This prevents internal users from assigning orders to vendors
 * - Unassigned orders are completely invisible in the fulfillment view
 *
 * THE FIX:
 * Remove line 64 entirely. Internal and admin users should NOT have any
 * assignedVendorId filter applied. Only vendor users need that filter.
 *
 * CORRECT BEHAVIOR:
 * - Vendor users: filter by their specific vendorId (working correctly)
 * - Internal users: NO filter on assignedVendorId (currently broken)
 * - Admin users: NO filter on assignedVendorId (currently broken)
 */