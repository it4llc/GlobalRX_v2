// /GlobalRX_v2/src/app/api/portal/orders/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrderService } from '@/lib/services/order.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/order.service', () => ({
  OrderService: {
    getCustomerOrders: vi.fn()
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

describe('GET /api/portal/orders - Phase 2D View Tracking Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call service with includeViews: true and userId for customer session', async () => {
    // Test that customer sessions get view-tracking data for activity indicators

    const mockSession = {
      user: {
        id: 'customer-user-123',
        userType: 'customer',
        customerId: 'customer-456'
      }
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    vi.mocked(OrderService.getCustomerOrders).mockResolvedValueOnce({
      orders: [
        {
          id: 'order-123',
          orderNumber: '20240101-TEST-001',
          lastActivityAt: new Date('2024-01-15T10:00:00Z'),
          orderViews: [{ lastViewedAt: new Date('2024-01-14T10:00:00Z') }],
          items: [
            {
              id: 'item-123',
              lastActivityAt: new Date('2024-01-15T11:00:00Z'),
              orderItemViews: [{ lastViewedAt: new Date('2024-01-14T11:00:00Z') }]
            }
          ]
        }
      ],
      total: 1
    });

    // Create proper NextRequest with nextUrl
    const request = {
      nextUrl: new URL('http://localhost:3000/api/portal/orders')
    } as NextRequest;

    const response = await GET(request);

    // Verify service was called with includeViews: true and correct userId
    expect(OrderService.getCustomerOrders).toHaveBeenCalledWith(
      'customer-456',
      {
        status: undefined,
        search: undefined,
        limit: 50,
        offset: 0
      },
      true, // includeViews
      'customer-user-123' // userId
    );
  });

  it('should return 200 for authenticated customer', async () => {
    // Smoke test to ensure basic customer access works

    const mockSession = {
      user: {
        id: 'customer-user-123',
        userType: 'customer',
        customerId: 'customer-456'
      }
    };

    vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    vi.mocked(OrderService.getCustomerOrders).mockResolvedValueOnce({
      orders: [],
      total: 0
    });

    const request = {
      nextUrl: new URL('http://localhost:3000/api/portal/orders')
    } as NextRequest;

    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('should return 401 for unauthenticated request', async () => {
    // Security test for Phase 2D - ensure unauthorized access is blocked

    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = {
      nextUrl: new URL('http://localhost:3000/api/portal/orders')
    } as NextRequest;

    const response = await GET(request);

    expect(response.status).toBe(401);

    // Verify service was not called
    expect(OrderService.getCustomerOrders).not.toHaveBeenCalled();
  });
});