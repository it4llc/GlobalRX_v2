// /GlobalRX_v2/src/app/api/fulfillment/orders/[id]/__tests__/route.phase2d.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      findUnique: vi.fn()
    },
    servicesFulfillment: {
      findMany: vi.fn()
    },
    serviceComment: {
      findMany: vi.fn()
    },
    orderItem: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/lib/utils/customer-order-permissions', () => ({
  canCustomerViewOrder: vi.fn(() => true),
  filterDataForCustomer: vi.fn((data) => data),
  getVisibleCommentCount: vi.fn(() => 0)
}));

describe('GET /api/fulfillment/orders/[id] - Phase 2D View Tracking Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include view-tracking relations filtered by userId for customer session', async () => {
    // Test that customer sessions get orderViews and orderItemViews filtered by their userId

    const mockSession = {
      user: {
        id: 'customer-user-123',
        userType: 'customer',
        customerId: 'customer-456'
      }
    };

    const mockOrder = {
      id: 'order-123',
      orderNumber: '20240101-TEST-001',
      customerId: 'customer-456',
      lastActivityAt: new Date('2024-01-15T10:00:00Z'),
      orderViews: [{ lastViewedAt: new Date('2024-01-14T10:00:00Z') }],
      customer: { id: 'customer-456', name: 'Test Customer', disabled: false },
      user: { id: 'user-456', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      assignedVendor: null,
      items: [
        {
          id: 'item-123',
          lastActivityAt: new Date('2024-01-15T11:00:00Z'),
          orderItemViews: [{ lastViewedAt: new Date('2024-01-14T11:00:00Z') }],
          service: { id: 'service-123', name: 'Test Service', code: 'TS', category: 'Test' },
          location: { id: 'location-123', name: 'Test Location', code2: 'US' },
          data: [],
          serviceFulfillment: null
        }
      ],
      statusHistory: []
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
    vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

    const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
    await GET(request as any, { params: Promise.resolve({ id: 'order-123' }) });

    // Verify Prisma query included view-tracking relations filtered by userId
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      include: expect.objectContaining({
        orderViews: {
          where: { userId: 'customer-user-123' },
          select: { lastViewedAt: true },
          take: 1
        },
        items: expect.objectContaining({
          include: expect.objectContaining({
            orderItemViews: {
              where: { userId: 'customer-user-123' },
              select: { lastViewedAt: true },
              take: 1
            }
          })
        })
      })
    });
  });

  it('should exclude view-tracking relations for internal user session', async () => {
    // Test that internal users don't get view-tracking data (performance optimization)

    const mockSession = {
      user: {
        id: 'internal-user-123',
        userType: 'internal',
        permissions: { fulfillment: true }
      }
    };

    const mockOrder = {
      id: 'order-123',
      orderNumber: '20240101-TEST-001',
      customerId: 'customer-456',
      lastActivityAt: new Date('2024-01-15T10:00:00Z'),
      customer: { id: 'customer-456', name: 'Test Customer', disabled: false },
      user: { id: 'user-456', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      assignedVendor: null,
      items: [
        {
          id: 'item-123',
          lastActivityAt: new Date('2024-01-15T11:00:00Z'),
          service: { id: 'service-123', name: 'Test Service', code: 'TS', category: 'Test' },
          location: { id: 'location-123', name: 'Test Location', code2: 'US' },
          data: [],
          serviceFulfillment: null
        }
      ],
      statusHistory: []
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
    vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

    const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
    await GET(request as any, { params: Promise.resolve({ id: 'order-123' }) });

    // Verify Prisma query did NOT include view-tracking relations
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      include: expect.not.objectContaining({
        orderViews: expect.anything()
      })
    });

    // Also verify items don't have orderItemViews
    const callArgs = vi.mocked(prisma.order.findUnique).mock.calls[0][0];
    expect(callArgs.include.items.include).not.toHaveProperty('orderItemViews');
  });

  it('should exclude view-tracking relations for vendor user session', async () => {
    // Test that vendor users don't get view-tracking data (they don't need activity indicators)

    const mockSession = {
      user: {
        id: 'vendor-user-123',
        userType: 'vendor',
        vendorId: 'vendor-456'
      }
    };

    const mockOrder = {
      id: 'order-123',
      orderNumber: '20240101-TEST-001',
      customerId: 'customer-456',
      assignedVendorId: 'vendor-456',
      lastActivityAt: new Date('2024-01-15T10:00:00Z'),
      customer: { id: 'customer-456', name: 'Test Customer', disabled: false },
      user: { id: 'user-456', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      assignedVendor: { id: 'vendor-456', name: 'Test Vendor' },
      items: [
        {
          id: 'item-123',
          lastActivityAt: new Date('2024-01-15T11:00:00Z'),
          service: { id: 'service-123', name: 'Test Service', code: 'TS', category: 'Test' },
          location: { id: 'location-123', name: 'Test Location', code2: 'US' },
          data: [],
          serviceFulfillment: null
        }
      ],
      statusHistory: []
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
    vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

    const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
    await GET(request as any, { params: Promise.resolve({ id: 'order-123' }) });

    // Verify Prisma query did NOT include view-tracking relations
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      include: expect.not.objectContaining({
        orderViews: expect.anything()
      })
    });

    // Also verify items don't have orderItemViews
    const callArgs = vi.mocked(prisma.order.findUnique).mock.calls[0][0];
    expect(callArgs.include.items.include).not.toHaveProperty('orderItemViews');
  });

  it('should return response containing view data for customer vs excluding view data for internal user', async () => {
    // Test the differential behavior in response structure between customer and internal users
    // This regression test prevents Bug A from reoccurring (non-customer users getting view data)

    // First test: Customer user gets view data
    const customerSession = {
      user: {
        id: 'customer-user-123',
        userType: 'customer',
        customerId: 'customer-456'
      }
    };

    const mockOrderWithViews = {
      id: 'order-123',
      orderNumber: '20240101-TEST-001',
      customerId: 'customer-456',
      lastActivityAt: new Date('2024-01-15T10:00:00Z'),
      orderViews: [{ lastViewedAt: new Date('2024-01-14T10:00:00Z') }], // Customer should get this
      customer: { id: 'customer-456', name: 'Test Customer', disabled: false },
      user: { id: 'user-456', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      assignedVendor: null,
      items: [
        {
          id: 'item-123',
          lastActivityAt: new Date('2024-01-15T11:00:00Z'),
          orderItemViews: [{ lastViewedAt: new Date('2024-01-14T11:00:00Z') }], // Customer should get this
          service: { id: 'service-123', name: 'Test Service', code: 'TS', category: 'Test' },
          location: { id: 'location-123', name: 'Test Location', code2: 'US' },
          data: [],
          serviceFulfillment: null
        }
      ],
      statusHistory: []
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(customerSession);
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderWithViews);
    vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

    const customerRequest = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
    const customerResponse = await GET(customerRequest as any, { params: Promise.resolve({ id: 'order-123' }) });
    const customerData = await customerResponse.json();

    // Customer response should contain view data
    expect(customerData.orderViews).toBeDefined();
    expect(customerData.orderViews).toHaveLength(1);
    expect(customerData.items[0].orderItemViews).toBeDefined();
    expect(customerData.items[0].orderItemViews).toHaveLength(1);

    // Reset mocks for internal user test
    vi.clearAllMocks();

    // Second test: Internal user does not get view data
    const internalSession = {
      user: {
        id: 'internal-user-123',
        userType: 'internal',
        permissions: { fulfillment: true }
      }
    };

    const mockOrderWithoutViews = {
      id: 'order-123',
      orderNumber: '20240101-TEST-001',
      customerId: 'customer-456',
      lastActivityAt: new Date('2024-01-15T10:00:00Z'),
      // No orderViews for internal user
      customer: { id: 'customer-456', name: 'Test Customer', disabled: false },
      user: { id: 'user-456', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      assignedVendor: null,
      items: [
        {
          id: 'item-123',
          lastActivityAt: new Date('2024-01-15T11:00:00Z'),
          // No orderItemViews for internal user
          service: { id: 'service-123', name: 'Test Service', code: 'TS', category: 'Test' },
          location: { id: 'location-123', name: 'Test Location', code2: 'US' },
          data: [],
          serviceFulfillment: null
        }
      ],
      statusHistory: []
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(internalSession);
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderWithoutViews);
    vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

    const internalRequest = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
    const internalResponse = await GET(internalRequest as any, { params: Promise.resolve({ id: 'order-123' }) });
    const internalData = await internalResponse.json();

    // Internal response should NOT contain view data
    expect(internalData.orderViews).toBeUndefined();
    expect(internalData.items[0].orderItemViews).toBeUndefined();
  });
});