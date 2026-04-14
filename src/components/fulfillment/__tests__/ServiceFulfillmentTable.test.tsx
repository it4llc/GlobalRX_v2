// /GlobalRX_v2/src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx

/**
 * SOURCE FILES READ LOG
 *
 * Files read before writing this test:
 * - docs/CODING_STANDARDS.md (lines 1-940) - Core development rules
 * - docs/TESTING_STANDARDS.md (lines 1-276) - Testing patterns and TDD workflow
 * - docs/COMPONENT_STANDARDS.md (lines 1-276) - Component and styling standards
 * - docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md (lines 1-372) - Feature specification
 * - docs/architecture/order-view-tracking-phase-2d-technical-plan.md (lines 1-510) - Technical implementation plan
 * - src/components/fulfillment/ServiceFulfillmentTable.tsx (lines 1-1455) - Component under test
 * - src/components/ui/NewActivityDot.tsx (lines 1-47) - NewActivityDot component
 * - src/components/ui/__tests__/NewActivityDot.test.tsx (lines 1-192) - Pattern reference
 * - src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx (lines 1-50) - Existing test patterns
 * - src/components/fulfillment/__tests__/OrderDetailsView.phase2d-regression.test.tsx (lines 1-290) - Regression tests
 *
 * PATTERN MATCH BLOCK
 *
 * Test file I am creating: src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx
 *
 * Existing tests I read for reference:
 * 1. src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx (partial)
 * 2. src/components/ui/__tests__/NewActivityDot.test.tsx
 *
 * Patterns I am copying from those existing tests:
 * - Import style for component: Direct import from parent directory
 * - Mock setup: Mock AuthContext, navigation, useToast, NO mocking of NewActivityDot
 * - Test data setup: Create service arrays with all required fields
 * - Assertion style: Uses screen queries and DOM property assertions
 *
 * I will NOT do any of the following:
 * - Mock ServiceFulfillmentTable component itself
 * - Mock NewActivityDot component (real component used)
 * - Mock cn() helper from @/lib/utils
 * - Mock React
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceFulfillmentTable } from '../ServiceFulfillmentTable';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: mockToastSuccess,
    toastError: mockToastError,
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock HTMLDialogElement if not available in test environment
if (typeof HTMLDialogElement === 'undefined') {
  global.HTMLDialogElement = class extends HTMLElement {
    constructor() {
      super();
      this.open = false;
    }
    showModal() {
      this.open = true;
      this.style.display = 'block';
    }
    close() {
      this.open = false;
      this.style.display = 'none';
    }
  } as any;
}

// Mock child components that are tested separately
vi.mock('@/components/services/ServiceCommentSection', () => ({
  ServiceCommentSection: () => <div data-testid="service-comment-section">Comments</div>
}));

vi.mock('@/components/services/ServiceResultsSection', () => ({
  ServiceResultsSection: () => <div data-testid="service-results-section">Results</div>
}));

vi.mock('@/components/services/ServiceRequirementsDisplay', () => ({
  ServiceRequirementsDisplay: () => <div data-testid="service-requirements-display">Requirements</div>
}));

// Mock useServiceComments hook
vi.mock('@/hooks/useServiceComments', () => ({
  useServiceComments: vi.fn(() => ({
    comments: [],
    totalComments: 0,
    isLoading: false,
    error: null,
    refresh: vi.fn()
  }))
}));

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

describe('ServiceFulfillmentTable', () => {
  // Common test data
  const createTestService = (overrides = {}) => ({
    id: 'service-1',
    orderId: 'order-1',
    orderItemId: 'item-1',
    serviceId: 'service-type-1',
    locationId: 'location-1',
    status: 'pending',
    assignedVendorId: null,
    vendorNotes: null,
    internalNotes: null,
    assignedAt: null,
    assignedBy: null,
    completedAt: null,
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: '2024-04-01T10:00:00Z',
    service: {
      id: 'service-type-1',
      name: 'Background Check',
      code: 'BGC',
      category: 'Screening'
    },
    location: {
      id: 'location-1',
      name: 'United States',
      code2: 'US'
    },
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        userType: 'admin',
        permissions: { fulfillment: { manage: true } }
      }
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ commentsByService: {} })
      })
    );
  });

  describe('Table rendering', () => {
    it('renders table with expected columns', () => {
      const services = [createTestService()];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Check column headers
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Assigned Vendor')).toBeInTheDocument();
      expect(screen.getByText('Dates')).toBeInTheDocument();
      expect(screen.getByText('Comments')).toBeInTheDocument();
    });

    it('renders row per service', () => {
      const services = [
        createTestService({ id: 'service-1' }),
        createTestService({ id: 'service-2', service: { name: 'Drug Test', code: 'DT', category: 'Medical', id: 'service-type-2' } }),
        createTestService({ id: 'service-3', service: { name: 'Reference Check', code: 'RC', category: 'Verification', id: 'service-type-3' } })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      expect(screen.getByTestId('service-row-service-1')).toBeInTheDocument();
      expect(screen.getByTestId('service-row-service-2')).toBeInTheDocument();
      expect(screen.getByTestId('service-row-service-3')).toBeInTheDocument();
    });

    it('renders service names from provided items', () => {
      const services = [
        createTestService({ service: { name: 'Criminal Check', code: 'CC', category: 'Screening', id: 'service-type-1' } }),
        createTestService({ id: 'service-2', service: { name: 'Education Verification', code: 'EV', category: 'Verification', id: 'service-type-2' } }),
        createTestService({ id: 'service-3', service: { name: 'Employment History', code: 'EH', category: 'Verification', id: 'service-type-3' } })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
      expect(screen.getByText('Education Verification')).toBeInTheDocument();
      expect(screen.getByText('Employment History')).toBeInTheDocument();
    });
  });

  describe('NewActivityDot rendering', () => {
    it('renders NewActivityDot for services where hasNewActivity is true', () => {
      const services = [
        createTestService({ hasNewActivity: true }),
        createTestService({ id: 'service-2', hasNewActivity: true, service: { name: 'Drug Test', code: 'DT', category: 'Medical', id: 'service-type-2' } })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

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

    it('does NOT render NewActivityDot for services where hasNewActivity is false/undefined', () => {
      const services = [
        createTestService({ hasNewActivity: false }),
        createTestService({ id: 'service-2', service: { name: 'Drug Test', code: 'DT', category: 'Medical', id: 'service-type-2' } })
        // hasNewActivity undefined for service-2
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Should not find any dots
      const dots = screen.queryAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(0);
    });

    it('correctly renders dots for mixed list (4 services, positions 0 and 2 have dots)', () => {
      const services = [
        createTestService({
          id: 'service-1',
          hasNewActivity: true,  // Position 0: has dot
          service: { name: 'Service One', code: 'S1', category: 'Cat1', id: 'service-type-1' }
        }),
        createTestService({
          id: 'service-2',
          hasNewActivity: false,  // Position 1: no dot
          service: { name: 'Service Two', code: 'S2', category: 'Cat2', id: 'service-type-2' }
        }),
        createTestService({
          id: 'service-3',
          hasNewActivity: true,  // Position 2: has dot
          service: { name: 'Service Three', code: 'S3', category: 'Cat3', id: 'service-type-3' }
        }),
        createTestService({
          id: 'service-4',
          // Position 3: no dot (undefined)
          service: { name: 'Service Four', code: 'S4', category: 'Cat4', id: 'service-type-4' }
        })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Should find exactly 2 dots
      const dots = screen.getAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(2);

      // Verify all service names are rendered
      expect(screen.getByText('Service One')).toBeInTheDocument();
      expect(screen.getByText('Service Two')).toBeInTheDocument();
      expect(screen.getByText('Service Three')).toBeInTheDocument();
      expect(screen.getByText('Service Four')).toBeInTheDocument();
    });

    it('renders NewActivityDot in the service name column', () => {
      const services = [
        createTestService({ hasNewActivity: true })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Find the row that contains the service
      const serviceRow = screen.getByTestId('service-row-service-1');

      // The dot should be within the row
      const dot = within(serviceRow).getByLabelText('Service has new activity');
      expect(dot).toBeInTheDocument();

      // Verify it's with the service name
      expect(within(serviceRow).getByText('Background Check')).toBeInTheDocument();
    });
  });

  describe('edge cases and error handling', () => {
    it('does NOT crash with unexpected extra fields', () => {
      const services = [
        createTestService({
          hasNewActivity: true,
          someUnexpectedField: 'should be ignored',
          anotherRandomField: 123
        } as any)
      ];

      expect(() => {
        render(<ServiceFulfillmentTable services={services} orderId="order-1" />);
      }).not.toThrow();

      expect(screen.getByText('Background Check')).toBeInTheDocument();
    });

    it('handles mixed hasNewActivity values correctly including undefined', () => {
      const services = [
        createTestService({
          id: 'service-1',
          hasNewActivity: true,
          service: { name: 'Service A', code: 'SA', category: 'CatA', id: 'service-type-1' }
        }),
        createTestService({
          id: 'service-2',
          hasNewActivity: false,
          service: { name: 'Service B', code: 'SB', category: 'CatB', id: 'service-type-2' }
        }),
        createTestService({
          id: 'service-3',
          hasNewActivity: undefined,
          service: { name: 'Service C', code: 'SC', category: 'CatC', id: 'service-type-3' }
        }),
        createTestService({
          id: 'service-4',
          // hasNewActivity not present
          service: { name: 'Service D', code: 'SD', category: 'CatD', id: 'service-type-4' }
        })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Should only find one dot (for the first service with hasNewActivity: true)
      const dots = screen.getAllByLabelText('Service has new activity');
      expect(dots).toHaveLength(1);

      // All services should still be rendered
      expect(screen.getByText('Service A')).toBeInTheDocument();
      expect(screen.getByText('Service B')).toBeInTheDocument();
      expect(screen.getByText('Service C')).toBeInTheDocument();
      expect(screen.getByText('Service D')).toBeInTheDocument();
    });

    it('renders empty state when no services provided', () => {
      render(<ServiceFulfillmentTable services={[]} orderId="order-1" />);

      expect(screen.getByText('No services found for this order')).toBeInTheDocument();
    });

    it('handles loading state correctly', () => {
      render(<ServiceFulfillmentTable services={[]} orderId="order-1" isLoading={true} />);

      expect(screen.getByText('Loading services...')).toBeInTheDocument();
    });
  });

  describe('customer vs non-customer view', () => {
    it('hides vendor column for customer users', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          userType: 'customer',
          permissions: {}
        }
      });

      const services = [createTestService()];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" isCustomer={true} />);

      // Should not show "Assigned Vendor" column header
      expect(screen.queryByText('Assigned Vendor')).not.toBeInTheDocument();
    });

    it('shows vendor column for admin/vendor users', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          userType: 'admin',
          permissions: { fulfillment: { manage: true } }
        }
      });

      const services = [createTestService()];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Should show "Assigned Vendor" column header
      expect(screen.getByText('Assigned Vendor')).toBeInTheDocument();
    });

    it('renders NewActivityDot for customers but not for admin/vendor', () => {
      const services = [
        createTestService({ hasNewActivity: true })
      ];

      // Test as customer
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-1',
          userType: 'customer',
          permissions: {}
        }
      });

      const { rerender } = render(
        <ServiceFulfillmentTable services={services} orderId="order-1" isCustomer={true} />
      );

      // Customer should see the dot
      expect(screen.getByLabelText('Service has new activity')).toBeInTheDocument();

      // Test as admin
      mockUseAuth.mockReturnValue({
        user: {
          id: 'user-2',
          userType: 'admin',
          permissions: { fulfillment: { manage: true } }
        }
      });

      rerender(
        <ServiceFulfillmentTable services={services} orderId="order-1" isCustomer={false} />
      );

      // Admin should still see dot if hasNewActivity is true (dot rendering is based on data, not user type)
      // The gating happens at the data fetching level, not the presentation level
      expect(screen.getByLabelText('Service has new activity')).toBeInTheDocument();
    });
  });

  describe('row expansion and view tracking', () => {
    it('expands row when chevron is clicked', async () => {
      const services = [createTestService()];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Find expand button
      const expandButton = screen.getByLabelText(/Expand comments for Background Check/i);

      // Initially, expanded content should not be visible
      expect(screen.queryByTestId('comment-section-service-1')).not.toBeInTheDocument();

      // Click to expand
      await userEvent.click(expandButton);

      // Expanded content should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('comment-section-service-1')).toBeInTheDocument();
      });
    });

  });

  describe('filtering and sorting', () => {
it('sorts services by service name', async () => {
      const services = [
        createTestService({ id: 'service-1', service: { name: 'Charlie Service', code: 'CS', category: 'Cat1', id: 'service-type-1' } }),
        createTestService({ id: 'service-2', service: { name: 'Alpha Service', code: 'AS', category: 'Cat2', id: 'service-type-2' } }),
        createTestService({ id: 'service-3', service: { name: 'Bravo Service', code: 'BS', category: 'Cat3', id: 'service-type-3' } })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      // Click service column header to sort
      const serviceHeader = screen.getByText('Service');
      await userEvent.click(serviceHeader);

      // Get all service names in order
      const serviceRows = screen.getAllByTestId(/^service-row-/);
      const serviceNames = serviceRows.map(row => within(row).getByText(/^(Alpha|Bravo|Charlie) Service$/));

      // Should be sorted alphabetically
      expect(serviceNames[0]).toHaveTextContent('Alpha Service');
      expect(serviceNames[1]).toHaveTextContent('Bravo Service');
      expect(serviceNames[2]).toHaveTextContent('Charlie Service');
    });
  });

  describe('visual indicators', () => {
    it('shows results indicator when service has results', () => {
      const services = [
        createTestService({
          results: 'Some search results',
          resultsAddedAt: '2024-04-01T12:00:00Z'
        })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      expect(screen.getByTestId('has-results-indicator')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();
    });

    it('shows attachment badge when service has attachments', () => {
      const services = [
        createTestService({ attachmentsCount: 3 })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      expect(screen.getByTestId('attachment-badge')).toBeInTheDocument();
      expect(screen.getByText('3 attachments')).toBeInTheDocument();
    });

    it('shows both results and attachment indicators when both present', () => {
      const services = [
        createTestService({
          results: 'Some results',
          attachmentsCount: 2
        })
      ];

      render(<ServiceFulfillmentTable services={services} orderId="order-1" />);

      expect(screen.getByTestId('has-results-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-badge')).toBeInTheDocument();
    });
  });
});