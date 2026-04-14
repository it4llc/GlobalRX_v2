// /GlobalRX_v2/src/components/fulfillment/__tests__/OrderDetailsView.phase2d-regression.test.tsx
// REGRESSION TESTS for Phase 2D bugs discovered during browser verification

/**
 * SOURCE FILES READ LOG:
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372)
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510)
 * - docs/CODING_STANDARDS.md (lines 1-100)
 * - docs/TESTING_STANDARDS.md (lines 1-100)
 * - prisma/schema.prisma (lines 318-396, 640-672) - Order, OrderItem, OrderView, OrderItemView models
 * - src/test/setup.ts (lines 1-239) - Global mock setup
 * - src/test/utils.ts (lines 1-584) - Mock utilities
 * - src/app/portal/dashboard/page.tsx (lines 1-50) - Dashboard component
 * - src/components/orders/ServiceStatusList.tsx (lines 1-199) - ServiceStatusList component
 * - src/components/fulfillment/OrderDetailsView.tsx (lines 1-408) - OrderDetailsView component
 * - src/components/ui/NewActivityDot.tsx (lines 1-46) - NewActivityDot component
 * - src/types/service-status-display.ts (lines 1-40) - Schema definitions
 *
 * PATTERN MATCH BLOCK:
 * - Existing tests read for reference:
 *   1. src/components/fulfillment/OrderDetailsView.test.tsx
 *   2. src/components/orders/__tests__/ServiceStatusList.test.tsx
 * - Import style for Prisma: Not needed (components don't import Prisma directly)
 * - Mock setup: Uses vi.mock() for contexts and navigation
 * - Test data setup: Creates mock order objects with all required fields
 * - Assertion style: Uses @testing-library/react queries and DOM assertions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OrderDetailsView } from '../OrderDetailsView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn()
  })),
  useParams: vi.fn()
}));

// Mock the NewActivityDot component to track its rendering
vi.mock('@/components/ui/NewActivityDot', () => ({
  NewActivityDot: ({ show, 'aria-label': ariaLabel, className }: any) => {
    if (!show) return null;
    return (
      <span
        data-testid="new-activity-dot"
        data-show={show}
        aria-label={ariaLabel}
        className={className}
      />
    );
  }
}));

// Mock hasNewActivity utility to control behavior in tests
vi.mock('@/lib/utils/activity-comparison', () => ({
  hasNewActivity: vi.fn((lastActivityAt, lastViewedAt) => {
    // Return true if there's activity and no view record
    if (lastActivityAt && !lastViewedAt) return true;
    // Return false otherwise
    return false;
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

// Mock ServiceFulfillmentTable to check props passed to it
vi.mock('../ServiceFulfillmentTable', () => ({
  ServiceFulfillmentTable: ({ services }: any) => {
    return (
      <div data-testid="service-fulfillment-table">
        {services.map((service: any, index: number) => (
          <div key={service.id} data-testid={`service-${index}`}>
            <span data-testid={`service-${index}-name`}>{service.service?.name || 'Unknown'}</span>
            {service.hasNewActivity && (
              <span data-testid={`service-${index}-has-new-activity`}>Has New Activity</span>
            )}
          </div>
        ))}
      </div>
    );
  }
}));

// Mock AuthContext - this will be changed per test
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('OrderDetailsView - Phase 2D Regression Tests', () => {
  // Common test order data
  const createTestOrder = () => ({
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
      email: 'jane@example.com',
      phone: '555-1234',
      dateOfBirth: '1985-05-15',
      ssn: '123456789'
    },
    items: [
      {
        id: 'item-1',
        status: 'pending',
        lastActivityAt: '2024-04-01T12:00:00Z',
        orderItemViews: [], // No views - should trigger hasNewActivity
        service: {
          id: 'service-1',
          name: 'Background Check',
          code: 'BGC',
          category: 'Screening'
        },
        location: {
          id: 'location-1',
          name: 'United States',
          code2: 'US'
        }
      },
      {
        id: 'item-2',
        status: 'completed',
        lastActivityAt: '2024-04-01T13:00:00Z',
        orderItemViews: [], // No views - should trigger hasNewActivity
        service: {
          id: 'service-2',
          name: 'Drug Test',
          code: 'DT',
          category: 'Medical'
        },
        location: {
          id: 'location-2',
          name: 'California',
          code2: 'CA'
        }
      }
    ]
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug A: Internal users see red dots on /fulfillment/orders/[id]', () => {
    // REGRESSION TEST: Phase 2D Bug A - non-customer users saw red dots on order details page
    // Expected: FAIL before fix (dots appear for admin/vendor), PASS after fix (no dots for admin/vendor)

    it('REGRESSION TEST: customer users should see NewActivityDot elements for items with new activity', () => {
      // Setup: customer session
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-123',
          userType: 'customer',
          permissions: {}
        }
      });

      const testOrder = createTestOrder();

      render(<OrderDetailsView order={testOrder} />);

      // Check that ServiceFulfillmentTable received services with hasNewActivity: true
      const table = screen.getByTestId('service-fulfillment-table');
      expect(table).toBeInTheDocument();

      // Both items should have hasNewActivity indicators because they have lastActivityAt but no views
      const item1HasActivity = screen.getByTestId('service-0-has-new-activity');
      const item2HasActivity = screen.getByTestId('service-1-has-new-activity');

      expect(item1HasActivity).toBeInTheDocument();
      expect(item2HasActivity).toBeInTheDocument();
    });

    it('REGRESSION TEST: admin users should NOT see NewActivityDot elements for any items', () => {
      // Setup: admin session
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-456',
          userType: 'admin',
          permissions: { fulfillment: true }
        }
      });

      const testOrder = createTestOrder();

      render(<OrderDetailsView order={testOrder} />);

      // Check that ServiceFulfillmentTable is rendered
      const table = screen.getByTestId('service-fulfillment-table');
      expect(table).toBeInTheDocument();

      // No items should have hasNewActivity indicators for admin users
      const item1HasActivity = screen.queryByTestId('service-0-has-new-activity');
      const item2HasActivity = screen.queryByTestId('service-1-has-new-activity');

      // After fix, these should NOT be in the document for admin users
      expect(item1HasActivity).not.toBeInTheDocument();
      expect(item2HasActivity).not.toBeInTheDocument();
    });

    it('REGRESSION TEST: vendor users should NOT see NewActivityDot elements for any items', () => {
      // Setup: vendor session
      mockUseAuth.mockReturnValue({
        user: {
          id: 'vendor-789',
          userType: 'vendor',
          vendorId: 'vendor-org-123',
          permissions: {}
        }
      });

      const testOrder = createTestOrder();

      render(<OrderDetailsView order={testOrder} />);

      // Check that ServiceFulfillmentTable is rendered
      const table = screen.getByTestId('service-fulfillment-table');
      expect(table).toBeInTheDocument();

      // No items should have hasNewActivity indicators for vendor users
      const item1HasActivity = screen.queryByTestId('service-0-has-new-activity');
      const item2HasActivity = screen.queryByTestId('service-1-has-new-activity');

      // After fix, these should NOT be in the document for vendor users
      expect(item1HasActivity).not.toBeInTheDocument();
      expect(item2HasActivity).not.toBeInTheDocument();
    });

    it('REGRESSION TEST: undefined userType should NOT see NewActivityDot elements', () => {
      // Setup: session with undefined userType (edge case)
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-unknown',
          userType: undefined,
          permissions: {}
        }
      });

      const testOrder = createTestOrder();

      render(<OrderDetailsView order={testOrder} />);

      // Check that ServiceFulfillmentTable is rendered
      const table = screen.getByTestId('service-fulfillment-table');
      expect(table).toBeInTheDocument();

      // No items should have hasNewActivity indicators when userType is undefined
      const item1HasActivity = screen.queryByTestId('service-0-has-new-activity');
      const item2HasActivity = screen.queryByTestId('service-1-has-new-activity');

      // Should NOT be in the document for undefined userType
      expect(item1HasActivity).not.toBeInTheDocument();
      expect(item2HasActivity).not.toBeInTheDocument();
    });
  });
});