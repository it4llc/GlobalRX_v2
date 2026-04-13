// /GlobalRX_v2/src/components/fulfillment/__tests__/ServiceFulfillmentTable.requirements.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    toastInfo: vi.fn()
  }))
}));

// Import the actual component - no mocking needed for integration test
import '@/components/services/ServiceRequirementsDisplay';

// Mock ServiceResultsSection component
vi.mock('@/components/services/ServiceResultsSection', () => ({
  ServiceResultsSection: () => (
    <div data-testid="service-results-section">Service Results</div>
  )
}));

// Mock ServiceCommentSection component
vi.mock('@/components/services/ServiceCommentSection', () => ({
  ServiceCommentSection: () => (
    <div data-testid="service-comment-section">Comments</div>
  )
}));

// Mock fetch for API calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({})
});

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
  };
}

describe('ServiceFulfillmentTable - Requirements Display Integration', () => {
  const mockServices = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      orderItemId: '660e8400-e29b-41d4-a716-446655440001',
      serviceId: 'service-type-1',
      locationId: 'location-1',
      status: 'Submitted',
      assignedVendorId: null,
      vendorNotes: null,
      internalNotes: null,
      assignedAt: null,
      assignedBy: null,
      completedAt: null,
      createdAt: '2024-03-01T09:00:00Z',
      updatedAt: '2024-03-01T09:00:00Z',
      service: {
        id: 'service-type-1',
        name: 'Education Verification',
        category: 'Background'
      },
      location: {
        id: 'location-1',
        name: 'National',
        code2: 'US'
      },
      assignedVendor: null,
      // Order data included in service
      orderData: {
        'School Name': 'University of Michigan',
        'Degree Type': 'Bachelor of Science',
        'Graduation Year': '2020',
        'Major': 'Computer Science'
      }
    },
    {
      id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      orderItemId: '660e8400-e29b-41d4-a716-446655440002',
      serviceId: 'service-type-2',
      locationId: 'location-2',
      status: 'Processing',
      assignedVendorId: 'vendor-123',
      vendorNotes: 'In progress',
      internalNotes: 'Rush order',
      assignedAt: '2024-03-01T10:00:00Z',
      assignedBy: 'user-456',
      completedAt: null,
      createdAt: '2024-03-01T09:00:00Z',
      updatedAt: '2024-03-01T11:00:00Z',
      service: {
        id: 'service-type-2',
        name: 'Employment Verification',
        category: 'Background'
      },
      location: {
        id: 'location-2',
        name: 'State',
        code2: 'CA'
      },
      assignedVendor: {
        id: 'vendor-123',
        name: 'Verification Services Inc',
        isActive: true
      },
      // Empty order data
      orderData: {}
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        email: 'test@example.com',
        userType: 'internal',
        permissions: { fulfillment: true, admin: true }
      },
      checkPermission: vi.fn(() => true),
      loading: false,
      isAuthenticated: true
    } as any);
  });

  describe('Expandable Row with Requirements', () => {
    it('should show requirements section as first item when row is expanded', async () => {
      // Business Rule 1: Requirements must be shown above the results and comments sections
      render(<ServiceFulfillmentTable services={mockServices} />);

      // Find and click expand button for first service
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      // Wait for expanded content
      await waitFor(() => {
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
      });

      // Get all sections in the expanded area
      const expandedRow = expandButton.closest('tr')?.nextElementSibling;
      const sections = expandedRow?.querySelectorAll('[data-testid]');

      // Business Rule 1: Requirements section must appear first
      // Get only the top-level sections (not nested elements)
      const topLevelSections = expandedRow?.querySelectorAll(':scope > td > div > [data-testid]');

      expect(topLevelSections?.[0]).toHaveAttribute('data-testid', 'service-requirements-section');
      // After the requirements section, we have the hr divider, then results and comments
      expect(topLevelSections?.[1]).toHaveAttribute('data-testid', 'service-results-section');
      expect(topLevelSections?.[2]).toHaveAttribute('data-testid', 'service-comment-section');
    });

    it('should display "Submitted Information" title in expanded row', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Business Rule 6: Section titled "Submitted Information"
        expect(screen.getByText('Submitted Information')).toBeInTheDocument();
      });
    });

    it('should display order data fields when service has orderData', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Business Rule 3: All orderData fields are displayed with readable labels
        expect(screen.getByText('School Name')).toBeInTheDocument();
        expect(screen.getByText('University of Michigan')).toBeInTheDocument();
        expect(screen.getByText('Degree Type')).toBeInTheDocument();
        expect(screen.getByText('Bachelor of Science')).toBeInTheDocument();
        expect(screen.getByText('Graduation Year')).toBeInTheDocument();
        expect(screen.getByText('2020')).toBeInTheDocument();
        expect(screen.getByText('Major')).toBeInTheDocument();
        expect(screen.getByText('Computer Science')).toBeInTheDocument();
      });
    });

    it('should display empty state when service has no orderData', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      // Expand second service which has empty orderData
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[1];
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Business Rule 5: Empty requirements show "No additional requirements" message
        expect(screen.getByText('No additional requirements')).toBeInTheDocument();
      });
    });

    it('should only show requirements when row is expanded', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      // Requirements should not be visible initially
      expect(screen.queryByTestId('service-requirements-section')).not.toBeInTheDocument();

      // Expand first service
      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Business Rule 11: The requirements section must only be visible when expanded
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
      });

      // Collapse the row
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Requirements should be hidden again
        expect(screen.queryByTestId('service-requirements-section')).not.toBeInTheDocument();
      });
    });

    it('should maintain requirements display when switching between expanded rows', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      // Test expanding first service
      const expandButtons = screen.getAllByRole('button', { name: /expand/i });

      // Expand first service
      await userEvent.click(expandButtons[0]);

      // Wait for first service requirements to appear
      await waitFor(() => {
        expect(screen.getByText('School Name')).toBeInTheDocument();
        expect(screen.getByText('University of Michigan')).toBeInTheDocument();
      });

      // Verify the requirements section is displayed
      expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();

      // Collapse first service
      await userEvent.click(expandButtons[0]);

      // Wait for it to collapse
      await waitFor(() => {
        expect(screen.queryByText('School Name')).not.toBeInTheDocument();
      });

      // Now expand second service
      await userEvent.click(expandButtons[1]);

      // Wait for second service to expand and show its section
      await waitFor(() => {
        // The second service has empty orderData, but should still show the section
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
        // And should show the Submitted Information title
        expect(screen.getByText('Submitted Information')).toBeInTheDocument();
      });

      // The test verifies that requirements display is maintained when switching between rows
      // even if one has data and the other doesn't
    });
  });

  describe('User Type Access', () => {
    it('should show requirements for internal users', async () => {
      // Business Rule 9: Works for all user types (internal)
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'internal-user',
          email: 'internal@example.com',
          userType: 'internal',
          permissions: { fulfillment: true }
        },
        checkPermission: vi.fn(() => true),
        loading: false,
        isAuthenticated: true
      } as any);

      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('School Name')).toBeInTheDocument();
      });
    });

    it('should show requirements for vendor users', async () => {
      // Business Rule 9: Works for all user types (vendor)
      const vendorServices = [{
        ...mockServices[1],
        assignedVendorId: 'vendor-123'
      }];

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-user',
          email: 'vendor@example.com',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        },
        checkPermission: vi.fn(() => false),
        loading: false,
        isAuthenticated: true
      } as any);

      render(<ServiceFulfillmentTable services={vendorServices} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Business Rule 2: All users who can view a service can see all its requirement fields
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
        expect(screen.getByText('No additional requirements')).toBeInTheDocument();
      });
    });

    it('should show requirements for customer users', async () => {
      // Business Rule 9: Works for all user types (customer)
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'customer-user',
          email: 'customer@example.com',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        },
        checkPermission: vi.fn(() => false),
        loading: false,
        isAuthenticated: true
      } as any);

      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('School Name')).toBeInTheDocument();
      });
    });
  });

  describe('Styling and Layout Integration', () => {
    it('should maintain consistent styling with other sections', async () => {
      // Business Rule 12: Use the same visual styling as other sections
      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        const requirementsSection = screen.getByTestId('service-requirements-section');
        const resultsSection = screen.getByTestId('service-results-section');
        const commentsSection = screen.getByTestId('service-comment-section');

        // All sections should be present and properly styled
        expect(requirementsSection).toBeInTheDocument();
        expect(resultsSection).toBeInTheDocument();
        expect(commentsSection).toBeInTheDocument();
      });
    });

    it('should not affect existing expand/collapse functionality', async () => {
      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];

      // Expand
      await userEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
      });

      // Collapse
      await userEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.queryByTestId('service-requirements-section')).not.toBeInTheDocument();
      });

      // Re-expand
      await userEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should not make additional API calls for orderData', async () => {
      // Business Rule 10: No performance degradation (data already in API response)
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(<ServiceFulfillmentTable services={mockServices} />);

      const expandButton = screen.getAllByRole('button', { name: /expand/i })[0];
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('School Name')).toBeInTheDocument();
      });

      // Should not have made any additional fetch calls for order data
      // Phase 2C: expanding a row intentionally fires a view tracking POST to /api/order-items/[id]/view.
      // This assertion was originally expect(fetchSpy).not.toHaveBeenCalled() but now needs to allow
      // the tracking call while still catching any other fetch calls (which would be a regression).
      const nonTrackingCalls = fetchSpy.mock.calls.filter(
        (call) => !String(call[0]).match(/\/api\/order-items\/.+\/view$/)
      );
      expect(nonTrackingCalls).toHaveLength(0);
    });

    it('should handle services with large orderData objects efficiently', async () => {
      // Create a service with many orderData fields
      const largeOrderData: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        largeOrderData[`Field ${i}`] = `Value ${i}`;
      }

      const serviceWithLargeData = {
        ...mockServices[0],
        orderData: largeOrderData
      };

      render(<ServiceFulfillmentTable services={[serviceWithLargeData]} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByTestId('service-requirements-section')).toBeInTheDocument();
        // Check that at least some fields are rendered
        expect(screen.getByText('Field 0')).toBeInTheDocument();
        expect(screen.getByText('Value 0')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle service with null orderData', async () => {
      const serviceWithNullData = {
        ...mockServices[0],
        orderData: null
      };

      render(<ServiceFulfillmentTable services={[serviceWithNullData]} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Edge Case 3: API returns null for orderData
        expect(screen.getByText('No additional requirements')).toBeInTheDocument();
      });
    });

    it('should handle service with undefined orderData', async () => {
      const serviceWithUndefinedData = {
        ...mockServices[0],
        orderData: undefined
      };

      render(<ServiceFulfillmentTable services={[serviceWithUndefinedData]} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await userEvent.click(expandButton);

      await waitFor(() => {
        // Edge Case 1: No order data exists
        expect(screen.getByText('No additional requirements')).toBeInTheDocument();
      });
    });

    it('should handle orderData with special characters in field names', async () => {
      const serviceWithSpecialChars = {
        ...mockServices[0],
        orderData: {
          'Field & Name': 'Value 1',
          'Field<Name>': 'Value 2',
          'Field "Name"': 'Value 3'
        }
      };

      render(<ServiceFulfillmentTable services={[serviceWithSpecialChars]} />);

      const expandButton = screen.getByRole('button', { name: /expand/i });
      await userEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Field & Name')).toBeInTheDocument();
        expect(screen.getByText('Field<Name>')).toBeInTheDocument();
        expect(screen.getByText('Field "Name"')).toBeInTheDocument();
      });
    });
  });
});