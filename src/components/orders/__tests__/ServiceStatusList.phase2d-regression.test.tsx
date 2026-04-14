// /GlobalRX_v2/src/components/orders/__tests__/ServiceStatusList.phase2d-regression.test.tsx
// REGRESSION TESTS for Phase 2D Bug B - Zod schema stripping hasNewActivity field

/**
 * SOURCE FILES READ LOG:
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372)
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510)
 * - docs/CODING_STANDARDS.md (lines 1-100)
 * - docs/TESTING_STANDARDS.md (lines 1-100)
 * - prisma/schema.prisma (lines 318-396, 640-672) - Order, OrderItem, OrderView, OrderItemView models
 * - src/test/setup.ts (lines 1-239) - Global mock setup
 * - src/components/orders/ServiceStatusList.tsx (lines 1-199) - ServiceStatusList component
 * - src/components/ui/NewActivityDot.tsx (lines 1-46) - NewActivityDot component
 * - src/types/service-status-display.ts (lines 1-40) - Schema definitions
 *
 * PATTERN MATCH BLOCK:
 * - Existing tests read for reference:
 *   1. src/components/orders/__tests__/ServiceStatusList.test.tsx
 *   2. src/components/fulfillment/OrderDetailsView.test.tsx
 * - Import style for Prisma: Not needed (components don't import Prisma directly)
 * - Mock setup: Uses vi.mock() for contexts, minimal mocking
 * - Test data setup: Creates service item arrays with required fields
 * - Assertion style: Uses @testing-library/react queries and DOM assertions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceStatusList } from '../ServiceStatusList';
import { serviceStatusListPropsSchema, serviceDisplayItemSchema } from '@/types/service-status-display';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'services.noServices': 'No services',
        'services.showMore': 'Show',
        'services.more': 'more',
        'services.showLess': 'Show less',
        'services.hasNewActivity': 'Service has new activity'
      };
      return translations[key] || key;
    }
  })
}));

// Mock the NewActivityDot component to track its rendering
vi.mock('@/components/ui/NewActivityDot', () => ({
  NewActivityDot: ({ show, 'aria-label': ariaLabel, className }: any) => {
    // This mock returns a testable element when show=true, null when false
    // Critical for testing: we need to verify show prop value
    if (show) {
      return (
        <span
          data-testid="new-activity-dot"
          data-show="true"
          aria-label={ariaLabel}
          className={className}
        />
      );
    }
    return null;
  }
}));

describe('ServiceStatusList - Phase 2D Bug B Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug B: ServiceStatusList strips hasNewActivity via Zod validation', () => {
    // REGRESSION TEST: Phase 2D Bug B - Zod schema stripped hasNewActivity from ServiceStatusList items
    // Expected: FAIL before fix (Zod strips hasNewActivity), PASS after schema update

    it('REGRESSION TEST: should render NewActivityDot elements for items with hasNewActivity: true', () => {
      // Create items with hasNewActivity field
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Criminal Check' },
          location: { name: 'United States', code: 'US' },
          status: 'pending',
          hasNewActivity: true // This field should NOT be stripped
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Drug Test' },
          location: { name: 'California', code: 'CA' },
          status: 'completed',
          hasNewActivity: false // Should be preserved but not show dot
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should find exactly one NewActivityDot (for the first item with hasNewActivity: true)
      const dots = screen.getAllByTestId('new-activity-dot');
      expect(dots).toHaveLength(1);
      expect(dots[0]).toHaveAttribute('data-show', 'true');
      expect(dots[0]).toHaveAttribute('aria-label', 'Service has new activity');
    });

    it('REGRESSION TEST: should NOT render NewActivityDot elements for items with hasNewActivity: false', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Background Check' },
          location: { name: 'Texas', code: 'TX' },
          status: 'processing',
          hasNewActivity: false // Explicitly false
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Reference Check' },
          location: { name: 'New York', code: 'NY' },
          status: 'submitted',
          hasNewActivity: false
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should find NO NewActivityDot elements since all items have hasNewActivity: false
      const dots = screen.queryAllByTestId('new-activity-dot');
      expect(dots).toHaveLength(0);
    });

    it('REGRESSION TEST: should handle mixed hasNewActivity values correctly', () => {
      const items = [
        {
          id: 'item-1',
          service: { name: 'Service 1' },
          location: { name: 'Location 1', code: 'L1' },
          status: 'pending',
          hasNewActivity: true // Should show dot
        },
        {
          id: 'item-2',
          service: { name: 'Service 2' },
          location: { name: 'Location 2', code: 'L2' },
          status: 'processing',
          hasNewActivity: false // Should NOT show dot
        },
        {
          id: 'item-3',
          service: { name: 'Service 3' },
          location: { name: 'Location 3', code: null },
          status: 'completed',
          hasNewActivity: true // Should show dot
        },
        {
          id: 'item-4',
          service: { name: 'Service 4' },
          location: { name: 'Location 4', code: 'L4' },
          status: 'cancelled',
          // hasNewActivity undefined - should NOT show dot
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should find exactly 2 dots (for items 1 and 3)
      const dots = screen.getAllByTestId('new-activity-dot');
      expect(dots).toHaveLength(2);

      // Verify the service names are rendered
      expect(screen.getByText('Service 1')).toBeInTheDocument();
      expect(screen.getByText('Service 2')).toBeInTheDocument();
      expect(screen.getByText('Service 3')).toBeInTheDocument();
      expect(screen.getByText('Service 4')).toBeInTheDocument();
    });

    it('REGRESSION TEST: Zod schema should preserve hasNewActivity field when parsing', () => {
      // Direct test of the Zod schema to isolate the bug
      const inputItem = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        service: { name: 'Test Service' },
        location: { name: 'Test Location', code: 'TL' },
        status: 'pending',
        hasNewActivity: true // This field should be preserved
      };

      // Parse with the item schema
      const parsedItem = serviceDisplayItemSchema.parse(inputItem);

      // After fix, hasNewActivity should still be present
      // Before fix, this will fail because Zod strips unknown fields
      expect(parsedItem).toHaveProperty('hasNewActivity');
      expect((parsedItem as any).hasNewActivity).toBe(true);
    });

    it('REGRESSION TEST: serviceStatusListPropsSchema should preserve hasNewActivity in items', () => {
      const input = {
        items: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            service: { name: 'Service A' },
            location: { name: 'USA', code: 'US' },
            status: 'pending',
            hasNewActivity: true
          },
          {
            id: '660e8400-e29b-41d4-a716-446655440002',
            service: { name: 'Service B' },
            location: { name: 'Canada', code: 'CA' },
            status: 'completed',
            hasNewActivity: false
          }
        ],
        preferCountryCode: false,
        isMobile: false,
        maxInitialDisplay: 5
      };

      // Parse with the props schema
      const parsed = serviceStatusListPropsSchema.parse(input);

      // After fix, items should still have hasNewActivity field
      expect(parsed.items[0]).toHaveProperty('hasNewActivity');
      expect(parsed.items[1]).toHaveProperty('hasNewActivity');
      expect((parsed.items[0] as any).hasNewActivity).toBe(true);
      expect((parsed.items[1] as any).hasNewActivity).toBe(false);
    });

    it('REGRESSION TEST: should handle undefined hasNewActivity gracefully', () => {
      const items = [
        {
          id: 'item-1',
          service: { name: 'Service Without Activity Flag' },
          location: { name: 'Somewhere', code: 'SW' },
          status: 'draft'
          // hasNewActivity is not set (undefined)
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should render the service name
      expect(screen.getByText('Service Without Activity Flag')).toBeInTheDocument();

      // Should NOT render any dots when hasNewActivity is undefined
      const dots = screen.queryAllByTestId('new-activity-dot');
      expect(dots).toHaveLength(0);
    });

    it('REGRESSION TEST: should handle null service names with hasNewActivity', () => {
      const items = [
        {
          id: 'item-1',
          service: { name: null }, // null name
          location: { name: 'Test Location', code: 'TL' },
          status: 'pending',
          hasNewActivity: true // Should still show dot even with null name
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should render "Unnamed Service" for null name
      expect(screen.getByText('Unnamed Service')).toBeInTheDocument();

      // Should still show the activity dot
      const dots = screen.getAllByTestId('new-activity-dot');
      expect(dots).toHaveLength(1);
    });
  });
});