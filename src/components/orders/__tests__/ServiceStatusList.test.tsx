// /GlobalRX_v2/src/components/orders/__tests__/ServiceStatusList.test.tsx

/**
 * SOURCE FILES READ LOG
 *
 * Files read before writing this test:
 * - docs/CODING_STANDARDS.md (lines 1-940) - Core development rules
 * - docs/TESTING_STANDARDS.md (lines 1-276) - Testing patterns and TDD workflow
 * - docs/COMPONENT_STANDARDS.md (lines 1-276) - Component and styling standards
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372) - Feature specification
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510) - Technical implementation plan
 * - src/components/orders/ServiceStatusList.tsx (lines 1-199) - Component under test
 * - src/components/ui/NewActivityDot.tsx (lines 1-47) - NewActivityDot component
 * - src/components/ui/__tests__/NewActivityDot.test.tsx (lines 1-192) - Pattern reference for testing
 * - src/components/orders/__tests__/ServiceStatusList.phase2d-regression.test.tsx (lines 1-268) - Regression tests
 * - src/types/service-status-display.ts (lines 1-41) - Schema and type definitions
 *
 * PATTERN MATCH BLOCK
 *
 * Test file I am creating: src/components/orders/__tests__/ServiceStatusList.test.tsx
 *
 * Existing tests I read for reference:
 * 1. src/components/ui/__tests__/NewActivityDot.test.tsx
 * 2. src/components/ui/__tests__/checkbox.test.tsx
 *
 * Patterns I am copying from those existing tests:
 * - Import style for component: Direct import from parent directory
 * - Mock setup: Mock TranslationContext, NO mocking of NewActivityDot or cn()
 * - Test data setup: Create item arrays with all required fields from schema
 * - Assertion style: Uses screen queries and DOM property assertions
 *
 * I will NOT do any of the following:
 * - Mock ServiceStatusList component itself
 * - Mock NewActivityDot component (real component used)
 * - Mock cn() helper from @/lib/utils
 * - Mock React
 * - Mock Zod schemas
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceStatusList } from '../ServiceStatusList';

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

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('ServiceStatusList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render services with proper format: "Service Name - Country - Status"', () => {
      const services = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Criminal Check' },
          location: { name: 'United States', code: 'US' },
          status: 'Submitted'
        }
      ];

      render(<ServiceStatusList items={services} />);

      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Submitted')).toBeInTheDocument();
    });

    it('renders nothing unusual for empty items array', () => {
      render(<ServiceStatusList items={[]} />);

      expect(screen.getByText('No services')).toBeInTheDocument();
      expect(screen.getByTestId('no-services')).toBeInTheDocument();
    });

    it('renders service names from provided items (2-3 items)', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Background Check' },
          location: { name: 'United States', code: 'US' },
          status: 'pending'
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Drug Test' },
          location: { name: 'California', code: 'CA' },
          status: 'completed'
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440003',
          service: { name: 'Reference Check' },
          location: { name: 'New York', code: 'NY' },
          status: 'processing'
        }
      ];

      render(<ServiceStatusList items={items} />);

      expect(screen.getByText('Background Check')).toBeInTheDocument();
      expect(screen.getByText('Drug Test')).toBeInTheDocument();
      expect(screen.getByText('Reference Check')).toBeInTheDocument();
    });

    it('renders status badges for each item', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Service 1' },
          location: { name: 'Location 1', code: 'L1' },
          status: 'pending'
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Service 2' },
          location: { name: 'Location 2', code: 'L2' },
          status: 'completed'
        }
      ];

      render(<ServiceStatusList items={items} />);

      const statusBadges = screen.getAllByTestId('service-status-badge');
      expect(statusBadges).toHaveLength(2);

      // Check that each badge has the expected text
      expect(statusBadges[0]).toHaveTextContent('Pending');
      expect(statusBadges[1]).toHaveTextContent('Completed');
    });
  });

  describe('NewActivityDot rendering', () => {
    it('renders NewActivityDot for items where hasNewActivity is true', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Background Check' },
          location: { name: 'United States', code: 'US' },
          status: 'pending',
          hasNewActivity: true
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Drug Test' },
          location: { name: 'California', code: 'CA' },
          status: 'completed',
          hasNewActivity: true
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Find dots by their aria-label
      const dots = screen.getAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(2);

      // Verify dots have expected classes (from NewActivityDot component)
      dots.forEach(dot => {
        expect(dot).toHaveClass('bg-red-500');
        expect(dot).toHaveClass('rounded-full');
        expect(dot).toHaveClass('w-2');
        expect(dot).toHaveClass('h-2');
      });
    });

    it('does NOT render NewActivityDot for items where hasNewActivity is false/undefined', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Background Check' },
          location: { name: 'United States', code: 'US' },
          status: 'pending',
          hasNewActivity: false
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Drug Test' },
          location: { name: 'California', code: 'CA' },
          status: 'completed'
          // hasNewActivity is undefined
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should not find any dots
      const dots = screen.queryAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(0);
    });

    it('correctly renders dots for mixed list (4 items, positions 0 and 2 have dots)', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Service One' },
          location: { name: 'Location 1', code: 'L1' },
          status: 'pending',
          hasNewActivity: true // Position 0: has dot
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Service Two' },
          location: { name: 'Location 2', code: 'L2' },
          status: 'processing',
          hasNewActivity: false // Position 1: no dot
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440003',
          service: { name: 'Service Three' },
          location: { name: 'Location 3', code: 'L3' },
          status: 'completed',
          hasNewActivity: true // Position 2: has dot
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440004',
          service: { name: 'Service Four' },
          location: { name: 'Location 4', code: 'L4' },
          status: 'cancelled'
          // Position 3: no dot (undefined)
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should find exactly 2 dots
      const dots = screen.getAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(2);

      // Verify all service names are rendered
      expect(screen.getByText('Service One')).toBeInTheDocument();
      expect(screen.getByText('Service Two')).toBeInTheDocument();
      expect(screen.getByText('Service Three')).toBeInTheDocument();
      expect(screen.getByText('Service Four')).toBeInTheDocument();
    });

    it('renders dots correctly in both desktop and mobile layouts', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Mobile Service' },
          location: { name: 'Mobile Location', code: 'ML' },
          status: 'pending',
          hasNewActivity: true
        }
      ];

      // Test desktop layout
      const { rerender } = render(<ServiceStatusList items={items} isMobile={false} />);

      let dot = screen.getByLabelText('Service has new activity');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('mr-1'); // Desktop layout adds margin

      // Test mobile layout
      rerender(<ServiceStatusList items={items} isMobile={true} />);

      dot = screen.getByLabelText('Service has new activity');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('mr-1'); // Mobile layout also has margin
    });
  });

  describe('maxInitialDisplay handling', () => {
    it('respects maxInitialDisplay prop if component supports it', () => {
      const items = Array.from({ length: 8 }, (_, i) => ({
        id: `660e8400-e29b-41d4-a716-44665544000${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: `Location ${i + 1}`, code: `L${i + 1}` },
        status: 'pending'
      }));

      render(<ServiceStatusList items={items} maxInitialDisplay={5} />);

      // Should only show first 5 items initially
      expect(screen.getByText('Service 1')).toBeInTheDocument();
      expect(screen.getByText('Service 2')).toBeInTheDocument();
      expect(screen.getByText('Service 3')).toBeInTheDocument();
      expect(screen.getByText('Service 4')).toBeInTheDocument();
      expect(screen.getByText('Service 5')).toBeInTheDocument();
      expect(screen.queryByText('Service 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Service 7')).not.toBeInTheDocument();
      expect(screen.queryByText('Service 8')).not.toBeInTheDocument();

      // Should show "Show 3 more" button
      const showMoreButton = screen.getByTestId('show-more');
      expect(showMoreButton).toBeInTheDocument();
      expect(showMoreButton).toHaveTextContent('Show 3 more');
    });

    it('shows all items when Show More is clicked', async () => {
      const items = Array.from({ length: 6 }, (_, i) => ({
        id: `660e8400-e29b-41d4-a716-44665544000${i}`,
        service: { name: `Service ${i + 1}` },
        location: { name: `Location ${i + 1}`, code: `L${i + 1}` },
        status: 'pending'
      }));

      render(<ServiceStatusList items={items} maxInitialDisplay={3} />);

      // Initially only 3 visible
      expect(screen.getByText('Service 1')).toBeInTheDocument();
      expect(screen.getByText('Service 2')).toBeInTheDocument();
      expect(screen.getByText('Service 3')).toBeInTheDocument();
      expect(screen.queryByText('Service 4')).not.toBeInTheDocument();

      // Click Show More
      const showMoreButton = screen.getByTestId('show-more');
      await userEvent.click(showMoreButton);

      // Now all should be visible
      expect(screen.getByText('Service 4')).toBeInTheDocument();
      expect(screen.getByText('Service 5')).toBeInTheDocument();
      expect(screen.getByText('Service 6')).toBeInTheDocument();

      // Button should now say "Show less"
      expect(screen.getByTestId('show-less')).toBeInTheDocument();
    });
  });

  describe('edge cases and error handling', () => {
    it('does NOT crash with unexpected extra fields', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Test Service', extraField: 'should be ignored' } as any,
          location: { name: 'Test Location', code: 'TL', unexpectedField: true } as any,
          status: 'pending',
          hasNewActivity: true,
          someRandomField: 'ignored'
        } as any
      ];

      expect(() => {
        render(<ServiceStatusList items={items} />);
      }).not.toThrow();

      expect(screen.getByText('Test Service')).toBeInTheDocument();
      expect(screen.getByText('Test Location')).toBeInTheDocument();
    });

    it('handles null service names gracefully', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: null },
          location: { name: 'Valid Location', code: 'VL' },
          status: 'pending',
          hasNewActivity: true
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should show "Unnamed Service" for null names
      expect(screen.getByText('Unnamed Service')).toBeInTheDocument();

      // Should still show the activity dot
      const dot = screen.getByLabelText('Service has new activity');
      expect(dot).toBeInTheDocument();
    });

    it('handles null location data gracefully', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Valid Service' },
          location: { name: null, code: null },
          status: 'pending'
        }
      ];

      render(<ServiceStatusList items={items} />);

      expect(screen.getByText('Valid Service')).toBeInTheDocument();
      expect(screen.getByText('Unknown Location')).toBeInTheDocument();
    });

    it('truncates long service names at 30 characters', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'This is a very long service name that exceeds thirty characters' },
          location: { name: 'USA', code: 'US' },
          status: 'pending'
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should see truncated name with ellipsis (30 chars + '...')
      expect(screen.getByText('This is a very long service na...')).toBeInTheDocument();
    });

    it('shows country code when preferCountryCode is true and code exists', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Test Service' },
          location: { name: 'United States', code: 'US' },
          status: 'pending'
        }
      ];

      render(<ServiceStatusList items={items} preferCountryCode={true} />);

      // Should show code, not name
      expect(screen.getByText('US')).toBeInTheDocument();
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
    });

    it('falls back to name when preferCountryCode is true but code is null', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Test Service' },
          location: { name: 'Special Location', code: null },
          status: 'pending'
        }
      ];

      render(<ServiceStatusList items={items} preferCountryCode={true} />);

      // Should fall back to name when code is null
      expect(screen.getByText('Special Location')).toBeInTheDocument();
    });

    it('handles mixed hasNewActivity values correctly including undefined', () => {
      const items = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Service A' },
          location: { name: 'Location A', code: 'LA' },
          status: 'pending',
          hasNewActivity: true
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          service: { name: 'Service B' },
          location: { name: 'Location B', code: 'LB' },
          status: 'processing',
          hasNewActivity: false
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440003',
          service: { name: 'Service C' },
          location: { name: 'Location C', code: 'LC' },
          status: 'completed',
          hasNewActivity: undefined
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440004',
          service: { name: 'Service D' },
          location: { name: 'Location D', code: 'LD' },
          status: 'submitted'
          // hasNewActivity not present
        }
      ];

      render(<ServiceStatusList items={items} />);

      // Should only find one dot (for the first item with hasNewActivity: true)
      const dots = screen.getAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(1);

      // All services should still be rendered
      expect(screen.getByText('Service A')).toBeInTheDocument();
      expect(screen.getByText('Service B')).toBeInTheDocument();
      expect(screen.getByText('Service C')).toBeInTheDocument();
      expect(screen.getByText('Service D')).toBeInTheDocument();
    });
  });
});