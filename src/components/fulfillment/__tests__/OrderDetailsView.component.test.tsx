// /GlobalRX_v2/src/components/fulfillment/__tests__/OrderDetailsView.component.test.tsx
// Component tests for OrderDetailsView item-level dot rendering logic (Phase 2D)

/**
 * SCOPE: Tests OrderDetailsView's hasNewActivity computation for individual items
 * - Role gating (customer vs admin/vendor) is covered by regression tests
 * - Focus is on the item-level logic that determines which items get red dots
 * - Tests the actual hasNewActivity utility integration with component data
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderDetailsView } from '../OrderDetailsView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn()
  })),
  useParams: vi.fn()
}));

// Mock hasNewActivity utility with inline implementation that reads arguments
vi.mock('@/lib/utils/activity-comparison', () => ({
  hasNewActivity: vi.fn((lastActivityAt, lastViewedAt) => {
    if (!lastActivityAt) return false;
    if (!lastViewedAt) return true;
    return new Date(lastActivityAt) > new Date(lastViewedAt);
  })
}));

// Mock TranslationContext
const translationMap: Record<string, string> = {
  'module.fulfillment.firstName': 'First Name',
  'module.fulfillment.lastName': 'Last Name',
  'module.fulfillment.middleName': 'Middle Name',
  'module.fulfillment.address': 'Address',
  'module.fulfillment.subjectInformation': 'Subject Information',
  'module.fulfillment.services': 'Services',
  'module.fulfillment.dateOfBirth': 'Date of Birth',
  'module.fulfillment.phone': 'Phone',
  'module.fulfillment.email': 'Email',
  'module.fulfillment.ssn': 'SSN',
  'common.back': 'Back',
  'common.backToDashboard': 'Back to Dashboard'
};

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => translationMap[key] || key,
    locale: 'en-US'
  }))
}));


// Mock AuthContext - customer session for all tests
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('OrderDetailsView - Component Item-Level Dot Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup customer session for all tests
    mockUseAuth.mockReturnValue({
      user: {
        id: 'customer-123',
        userType: 'customer',
        permissions: {}
      }
    });
  });

  // Helper function to create base order structure
  const createBaseOrder = () => ({
    id: 'order-123',
    orderNumber: '20240401-TST-0001',
    statusCode: 'processing',
    createdAt: new Date('2024-04-01T10:00:00Z'),
    updatedAt: new Date('2024-04-01T11:00:00Z'),
    customer: {
      id: 'customer-456',
      name: 'Test Customer',
      code: 'TEST'
    },
    subject: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com'
    }
  });

  it('should show dots for items 0 and 2, no dots for items 1 and 3 in mixed list', () => {
    const order = {
      ...createBaseOrder(),
      items: [
        // Item 0: newer activity than last view - should show dot
        {
          id: 'item-0',
          status: 'pending',
          lastActivityAt: '2024-04-01T15:00:00Z',
          orderItemViews: [{ lastViewedAt: '2024-04-01T14:00:00Z' }],
          service: { id: 'service-0', name: 'Background Check', code: 'BGC' },
          location: { id: 'location-0', name: 'United States', code2: 'US' }
        },
        // Item 1: older activity than last view - should NOT show dot
        {
          id: 'item-1',
          status: 'completed',
          lastActivityAt: '2024-04-01T13:00:00Z',
          orderItemViews: [{ lastViewedAt: '2024-04-01T14:00:00Z' }],
          service: { id: 'service-1', name: 'Drug Test', code: 'DT' },
          location: { id: 'location-1', name: 'California', code2: 'CA' }
        },
        // Item 2: newer activity than last view - should show dot
        {
          id: 'item-2',
          status: 'processing',
          lastActivityAt: '2024-04-01T16:00:00Z',
          orderItemViews: [{ lastViewedAt: '2024-04-01T14:00:00Z' }],
          service: { id: 'service-2', name: 'Reference Check', code: 'REF' },
          location: { id: 'location-2', name: 'New York', code2: 'NY' }
        },
        // Item 3: older activity than last view - should NOT show dot
        {
          id: 'item-3',
          status: 'pending',
          lastActivityAt: '2024-04-01T12:00:00Z',
          orderItemViews: [{ lastViewedAt: '2024-04-01T14:00:00Z' }],
          service: { id: 'service-3', name: 'Credit Check', code: 'CC' },
          location: { id: 'location-3', name: 'Texas', code2: 'TX' }
        }
      ]
    };

    render(<OrderDetailsView order={order} />);

    // Verify exactly 2 dots render (items 0 and 2) by querying for real NewActivityDot elements
    const dots = screen.getAllByRole('status');
    expect(dots).toHaveLength(2);
  });

  it('should show dot for item with activity but no views (never viewed)', () => {
    const order = {
      ...createBaseOrder(),
      items: [
        {
          id: 'item-never-viewed',
          status: 'pending',
          lastActivityAt: '2024-04-01T15:00:00Z',
          orderItemViews: [], // Empty array - never viewed
          service: { id: 'service-1', name: 'Background Check', code: 'BGC' },
          location: { id: 'location-1', name: 'United States', code2: 'US' }
        }
      ]
    };

    render(<OrderDetailsView order={order} />);

    // Should show dot because item has activity but was never viewed
    const dots = screen.getAllByRole('status');
    expect(dots).toHaveLength(1);
  });

  it('should NOT show dot when lastActivityAt equals lastViewedAt', () => {
    const sameTime = '2024-04-01T15:00:00Z';
    const order = {
      ...createBaseOrder(),
      items: [
        {
          id: 'item-equal-times',
          status: 'completed',
          lastActivityAt: sameTime,
          orderItemViews: [{ lastViewedAt: sameTime }],
          service: { id: 'service-1', name: 'Drug Test', code: 'DT' },
          location: { id: 'location-1', name: 'California', code2: 'CA' }
        }
      ]
    };

    render(<OrderDetailsView order={order} />);

    // Should NOT show dot because times are equal (not strictly greater)
    const dots = screen.queryAllByRole('status');
    expect(dots).toHaveLength(0);
  });

  it('should NOT show dot when lastActivityAt is null', () => {
    const order = {
      ...createBaseOrder(),
      items: [
        {
          id: 'item-no-activity',
          status: 'pending',
          lastActivityAt: null, // No activity yet
          orderItemViews: [{ lastViewedAt: '2024-04-01T14:00:00Z' }],
          service: { id: 'service-1', name: 'Reference Check', code: 'REF' },
          location: { id: 'location-1', name: 'New York', code2: 'NY' }
        }
      ]
    };

    render(<OrderDetailsView order={order} />);

    // Should NOT show dot because there's no activity to indicate
    const dots = screen.queryAllByRole('status');
    expect(dots).toHaveLength(0);
  });

  it('should render without error when items array is empty', () => {
    const order = {
      ...createBaseOrder(),
      items: [] // Empty items array
    };

    render(<OrderDetailsView order={order} />);

    // Component should render the Services section header
    const servicesHeader = screen.getByRole('heading', { name: 'Services' });
    expect(servicesHeader).toBeInTheDocument();

    // No dots should be present
    const dots = screen.queryAllByRole('status');
    expect(dots).toHaveLength(0);
  });
});