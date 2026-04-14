// /GlobalRX_v2/src/app/portal/dashboard/__tests__/page.test.tsx

/**
 * SOURCE FILES READ LOG:
 * - docs/CODING_STANDARDS.md (lines 1-940)
 * - docs/TESTING_STANDARDS.md (lines 1-276)
 * - docs/COMPONENT_STANDARDS.md (lines 1-276)
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372)
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510)
 * - src/app/portal/dashboard/page.tsx (lines 1-532) - Dashboard page component being tested
 * - src/app/fulfillment/__tests__/page.test.tsx (lines 1-624) - Pattern source for session mocking
 * - src/components/ui/NewActivityDot.tsx (lines 1-47) - Real component (NOT mocked)
 * - src/components/orders/ServiceStatusList.tsx (lines 1-199) - Real component (NOT mocked)
 * - src/lib/utils/activity-comparison.ts (lines 1-32) - Real utility (NOT mocked)
 * - src/components/fulfillment/__tests__/OrderDetailsView.phase2d-regression.test.tsx (lines 1-290)
 * - src/components/orders/__tests__/ServiceStatusList.phase2d-regression.test.tsx (lines 1-268)
 */

/**
 * PATTERN MATCH BLOCK:
 * Primary pattern source: src/app/fulfillment/__tests__/page.test.tsx
 * - Session mocking via next-auth/react useSession mock
 * - Context mocking: @/contexts/AuthContext, @/contexts/TranslationContext, next/navigation
 * - Global fetch mock setup
 * - Per-test session configuration with user object fields: id, userType, customerId
 * - Render and DOM assertion style using @testing-library/react
 * - Mock structure: top-level vi.mock calls, beforeEach cleanup, per-test session setup
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CustomerDashboard from '../page';

// Mock next-auth/react - following fulfillment page test pattern
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn()
}));

// Mock AuthContext - following fulfillment page test pattern
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    hasPermission: vi.fn(() => false),
    checkPermission: vi.fn(() => false),
    canAccessCustomer: vi.fn(() => false),
    canEditOrder: vi.fn(() => false)
  }))
}));

// Mock TranslationContext - following fulfillment page test pattern
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'en'
  }))
}));

// Mock next/navigation - following fulfillment page test pattern
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn()
  })
}));

// Mock fetch globally - following fulfillment page test pattern
global.fetch = vi.fn();

// Import useSession after mocking
import { useSession } from 'next-auth/react';

describe('Dashboard Page - Phase 2D Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: Customer session with a "new" order renders an order-level NewActivityDot
  it('customer session with new order should render order-level NewActivityDot', async () => {
    // Mock customer session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'customer-user-1',
          userType: 'customer',
          customerId: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch responses for both stats and orders
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0001',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            items: [],
            totalPrice: null,
            lastActivityAt: '2024-04-01T12:00:00Z', // Has activity
            orderViews: [] // Never viewed by customer = should show dot
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify order is rendered
      expect(screen.getByText('20240401-ABC-0001')).toBeInTheDocument();
    });

    // Verify NewActivityDot appears for this order (order-level dot)
    const activityDots = screen.getAllByRole('status');
    expect(activityDots.length).toBeGreaterThan(0);

    // Check for aria-label indicating order activity
    const orderDot = screen.getByLabelText('Order has new activity');
    expect(orderDot).toBeInTheDocument();
  });

  // Test 2: Customer session with a "viewed" order does NOT render an order-level dot
  it('customer session with viewed order should NOT render order-level dot', async () => {
    // Mock customer session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'customer-user-1',
          userType: 'customer',
          customerId: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch responses
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0002',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            items: [],
            totalPrice: null,
            lastActivityAt: '2024-04-01T12:00:00Z', // Has activity
            orderViews: [{ lastViewedAt: '2024-04-01T13:00:00Z' }] // Viewed AFTER activity
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify order is rendered
      expect(screen.getByText('20240401-ABC-0002')).toBeInTheDocument();
    });

    // Should NOT have order activity dot since viewed after activity
    const orderDot = screen.queryByLabelText('Order has new activity');
    expect(orderDot).not.toBeInTheDocument();
  });

  // Test 3: Customer session with a "new" item renders an item-level NewActivityDot inside ServiceStatusList
  it('customer session with new item should render item-level NewActivityDot in ServiceStatusList', async () => {
    // Mock customer session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'customer-user-1',
          userType: 'customer',
          customerId: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch responses
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0003',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            totalPrice: null,
            lastActivityAt: null, // No order-level activity
            orderViews: [],
            items: [{
              id: 'item-1',
              service: { id: 'service-1', name: 'Criminal Check' },
              location: { id: 'loc-1', name: 'United States', code: 'US' },
              status: 'pending',
              lastActivityAt: '2024-04-01T12:00:00Z', // Has item activity
              orderItemViews: [] // Never viewed = should show dot
            }]
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify order and service are rendered
      expect(screen.getByText('20240401-ABC-0003')).toBeInTheDocument();
      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
    });

    // Verify item-level activity dot appears
    const activityDots = screen.getAllByRole('status');
    expect(activityDots.length).toBeGreaterThan(0);

    // Check for aria-label indicating service activity (should use translation key)
    const serviceDot = screen.getByLabelText('services.hasNewActivity');
    expect(serviceDot).toBeInTheDocument();
  });

  // Test 4: Mixed order: some items have dots, some don't
  it('mixed order with some new items and some viewed items should show dots correctly', async () => {
    // Mock customer session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'customer-user-1',
          userType: 'customer',
          customerId: 'customer-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch responses
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0004',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            totalPrice: null,
            lastActivityAt: null,
            orderViews: [],
            items: [
              {
                id: 'item-1',
                service: { id: 'service-1', name: 'Service A' },
                location: { id: 'loc-1', name: 'USA', code: 'US' },
                status: 'pending',
                lastActivityAt: '2024-04-01T12:00:00Z',
                orderItemViews: [] // New - should have dot
              },
              {
                id: 'item-2',
                service: { id: 'service-2', name: 'Service B' },
                location: { id: 'loc-2', name: 'Canada', code: 'CA' },
                status: 'processing',
                lastActivityAt: '2024-04-01T12:00:00Z',
                orderItemViews: [{ lastViewedAt: '2024-04-01T13:00:00Z' }] // Viewed - should NOT have dot
              },
              {
                id: 'item-3',
                service: { id: 'service-3', name: 'Service C' },
                location: { id: 'loc-3', name: 'UK', code: 'GB' },
                status: 'completed',
                lastActivityAt: '2024-04-01T12:00:00Z',
                orderItemViews: [] // New - should have dot
              }
            ]
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify all services are rendered
      expect(screen.getByText('Service A')).toBeInTheDocument();
      expect(screen.getByText('Service B')).toBeInTheDocument();
      expect(screen.getByText('Service C')).toBeInTheDocument();
    });

    // Should have exactly 2 activity dots (for Service A and Service C)
    const activityDots = screen.getAllByRole('status');
    expect(activityDots).toHaveLength(2);

    // Both should be service-level dots
    const serviceDots = screen.getAllByLabelText('services.hasNewActivity');
    expect(serviceDots).toHaveLength(2);
  });

  // Test 5: Non-customer session: no dots render anywhere
  it('non-customer session should not render any dots', async () => {
    // Mock non-customer session (internal user) - needs customerId to trigger data fetch
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'internal-user-1',
          userType: 'internal',
          customerId: 'customer-123', // Added to trigger data fetch even for non-customer
          name: 'Admin User',
          email: 'admin@globalrx.com',
          permissions: { fulfillment: '*' }
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch with orders that WOULD trigger dots for a customer
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0005',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            totalPrice: null,
            lastActivityAt: '2024-04-01T12:00:00Z', // Would trigger order dot for customer
            orderViews: [], // No views
            items: [{
              id: 'item-1',
              service: { id: 'service-1', name: 'Criminal Check' },
              location: { id: 'loc-1', name: 'USA', code: 'US' },
              status: 'pending',
              lastActivityAt: '2024-04-01T12:00:00Z', // Would trigger item dot for customer
              orderItemViews: [] // No views
            }]
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify content is rendered
      expect(screen.getByText('20240401-ABC-0005')).toBeInTheDocument();
      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
    });

    // Should have NO activity dots anywhere for non-customer users
    const activityDots = screen.queryAllByRole('status');
    expect(activityDots).toHaveLength(0);

    // Specifically check for both order and service dots
    const orderDot = screen.queryByLabelText('Order has new activity');
    const serviceDot = screen.queryByLabelText('services.hasNewActivity');
    expect(orderDot).not.toBeInTheDocument();
    expect(serviceDot).not.toBeInTheDocument();
  });

  // Test 6: Session with no userType field: no dots render
  it('session with no userType should not render any dots', async () => {
    // Mock session with missing userType field (malformed session) - needs customerId to trigger data fetch
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'unknown-user-1',
          customerId: 'customer-123', // Added to trigger data fetch
          // userType is missing/undefined
          name: 'Unknown User',
          email: 'unknown@example.com'
        },
        expires: '2099-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock fetch with orders that would trigger dots for a customer
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 1, pending: 0, completed: 0, draft: 0, submitted: 0, processing: 0, cancelled: 0 })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          orders: [{
            id: 'order-1',
            orderNumber: '20240401-ABC-0006',
            statusCode: 'processing',
            createdAt: '2024-04-01T10:00:00Z',
            updatedAt: '2024-04-01T11:00:00Z',
            subject: { firstName: 'Jane', lastName: 'Smith' },
            notes: null,
            totalPrice: null,
            lastActivityAt: '2024-04-01T12:00:00Z', // Would trigger order dot for customer
            orderViews: [],
            items: [{
              id: 'item-1',
              service: { id: 'service-1', name: 'Background Check' },
              location: { id: 'loc-1', name: 'USA', code: 'US' },
              status: 'pending',
              lastActivityAt: '2024-04-01T12:00:00Z', // Would trigger item dot for customer
              orderItemViews: []
            }]
          }]
        })
      } as Response);

    render(<CustomerDashboard />);

    await waitFor(() => {
      // Verify content is rendered
      expect(screen.getByText('20240401-ABC-0006')).toBeInTheDocument();
      expect(screen.getByText('Background Check')).toBeInTheDocument();
    });

    // Should have NO activity dots when userType is undefined (default to safe behavior)
    const activityDots = screen.queryAllByRole('status');
    expect(activityDots).toHaveLength(0);

    // Verify no dots of either type
    const orderDot = screen.queryByLabelText('Order has new activity');
    const serviceDot = screen.queryByLabelText('services.hasNewActivity');
    expect(orderDot).not.toBeInTheDocument();
    expect(serviceDot).not.toBeInTheDocument();
  });
});