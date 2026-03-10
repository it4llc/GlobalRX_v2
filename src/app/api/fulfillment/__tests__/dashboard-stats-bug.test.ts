// /GlobalRX_v2/src/app/api/fulfillment/__tests__/dashboard-stats-bug.test.ts
// Tests for dashboard stats consolidation bug
//
// THE BUG:
// Currently shows 5 different stat cards, but should only show 3:
// 1. Total Orders
// 2. Total Services (sum of all OrderItems)
// 3. In Progress (orders not in Draft, Completed, or Cancelled)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Dashboard Stats Bug - API Level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Current broken behavior (proves bug exists)', () => {
    it('should NOT return Total Services metric (bug: missing)', async () => {
      // Arrange - Mock authenticated internal user
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // Mock orders with multiple services
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          statusCode: 'processing',
          subject: { firstName: 'John', lastName: 'Doe' },
          customer: { id: 'cust-1', name: 'Customer A' },
          items: [
            { id: 'item-1', service: { id: 'svc-1', name: 'Background Check' } },
            { id: 'item-2', service: { id: 'svc-2', name: 'Drug Test' } },
          ],
        },
        {
          id: 'order-2',
          orderNumber: 'ORD-002',
          statusCode: 'completed',
          subject: { firstName: 'Jane', lastName: 'Smith' },
          customer: { id: 'cust-1', name: 'Customer A' },
          items: [
            { id: 'item-3', service: { id: 'svc-1', name: 'Background Check' } },
          ],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(2);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert - This test SHOULD FAIL before fix
      // The API currently doesn't return stats, just raw orders
      expect(data.totalServices).toBeUndefined(); // BUG: No totalServices field exists
      expect(data.stats).toBeUndefined(); // BUG: No stats object exists

      // The current API only returns orders array, not computed stats
      expect(data.orders).toBeDefined();
      expect(data.total).toBeDefined();
    });

    it('should NOT return In Progress metric correctly (bug: missing)', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrders = [
        { id: '1', statusCode: 'draft', items: [] }, // Should NOT count
        { id: '2', statusCode: 'submitted', items: [] }, // Should count
        { id: '3', statusCode: 'processing', items: [] }, // Should count
        { id: '4', statusCode: 'completed', items: [] }, // Should NOT count
        { id: '5', statusCode: 'cancelled', items: [] }, // Should NOT count
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(5);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert - This test SHOULD FAIL before fix
      expect(data.inProgress).toBeUndefined(); // BUG: No inProgress field exists
      expect(data.stats?.inProgress).toBeUndefined(); // BUG: Not calculated
    });

    it('should NOT allow customer users to access fulfillment API (bug: excluded)', async () => {
      // Arrange - Customer user
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'customer',
          customerId: 'cust-1',
          permissions: { orders: true }, // Customer has orders permission, not fulfillment
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert - This test SHOULD FAIL before fix (customers should be allowed)
      expect(response.status).toBe(403); // BUG: Customer users get 403
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('Expected correct behavior (after fix)', () => {
    it('should return exactly 3 stats: Total Orders, Total Services, In Progress', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrders = [
        {
          id: 'order-1',
          statusCode: 'submitted',
          items: [
            { id: 'item-1', service: { name: 'Service A' } },
            { id: 'item-2', service: { name: 'Service B' } },
            { id: 'item-3', service: { name: 'Service C' } },
          ],
        },
        {
          id: 'order-2',
          statusCode: 'processing',
          items: [
            { id: 'item-4', service: { name: 'Service D' } },
          ],
        },
        {
          id: 'order-3',
          statusCode: 'draft',
          items: [
            { id: 'item-5', service: { name: 'Service E' } },
          ],
        },
        {
          id: 'order-4',
          statusCode: 'completed',
          items: [],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(4);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert - After fix, these should be the ONLY stats returned
      expect(data.stats).toBeDefined();
      expect(data.stats.totalOrders).toBe(4); // All 4 orders
      expect(data.stats.totalServices).toBe(5); // 3+1+1+0 = 5 services
      expect(data.stats.inProgress).toBe(2); // submitted + processing only

      // Should NOT have old stats
      expect(data.stats.submitted).toBeUndefined();
      expect(data.stats.processing).toBeUndefined();
      expect(data.stats.completed).toBeUndefined();
      expect(data.stats.cancelled).toBeUndefined();
      expect(data.stats.pending).toBeUndefined();
      expect(data.stats.drafts).toBeUndefined();
    });

    it('should calculate In Progress correctly (excludes Draft, Completed, Cancelled)', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrders = [
        { id: '1', statusCode: 'draft', items: [] }, // NOT in progress
        { id: '2', statusCode: 'submitted', items: [] }, // IN PROGRESS
        { id: '3', statusCode: 'processing', items: [] }, // IN PROGRESS
        { id: '4', statusCode: 'more_info_needed', items: [] }, // IN PROGRESS
        { id: '5', statusCode: 'completed', items: [] }, // NOT in progress
        { id: '6', statusCode: 'cancelled', items: [] }, // NOT in progress
        { id: '7', statusCode: 'pending_review', items: [] }, // IN PROGRESS
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(7);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.stats.inProgress).toBe(4); // Excludes draft, completed, cancelled
    });

    it('should allow customer users to access fulfillment API', async () => {
      // Arrange - Customer user should be allowed after fix
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'customer',
          customerId: 'cust-1',
          permissions: { orders: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrders = [
        {
          id: 'order-1',
          customerId: 'cust-1',
          statusCode: 'submitted',
          items: [],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(1);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert - After fix, customer users should get data
      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.stats.totalOrders).toBe(1);
    });

    it('should count Total Services correctly across all orders', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true },
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrders = [
        {
          id: 'order-1',
          items: [
            { id: '1', service: { name: 'Background Check' } },
            { id: '2', service: { name: 'Drug Test' } },
            { id: '3', service: { name: 'Employment Verification' } },
          ],
        },
        {
          id: 'order-2',
          items: [], // Order with no services
        },
        {
          id: 'order-3',
          items: [
            { id: '4', service: { name: 'Background Check' } },
            { id: '5', service: { name: 'Reference Check' } },
          ],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.order.count as any).mockResolvedValue(3);

      // Act
      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.stats.totalServices).toBe(5); // 3 + 0 + 2 = 5 total services
    });
  });
});