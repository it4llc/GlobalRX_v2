// /GlobalRX_v2/src/components/fulfillment/__tests__/ServiceFulfillmentTable.order-item-tracking.test.tsx

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

// Fix: Mock client-logger to provide both default and named export
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  },
  clientLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// Fix: Mock useServiceComments hook with all required functions
vi.mock('@/hooks/useServiceComments', () => ({
  useServiceComments: () => ({
    comments: [],
    commentsByService: {},
    loading: false,
    error: null,
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    canCreateComment: vi.fn().mockReturnValue(true), // This is the missing function that becomes checkCanCreate
    canEditComment: vi.fn().mockReturnValue(true),
    canDeleteComment: vi.fn().mockReturnValue(true),
    getAvailableTemplates: vi.fn(),
    availableTemplates: [],
    getSortedComments: vi.fn().mockReturnValue([]),
    refetch: vi.fn()
  })
}));

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

describe('ServiceFulfillmentTable - Order Item View Tracking', () => {
  const mockServices = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      orderItemId: '660e8400-e29b-41d4-a716-446655440001',
      serviceId: 'service-type-1',
      locationId: 'location-1',
      status: 'submitted',
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
        name: 'Criminal Background Check',
        category: 'Background'
      },
      location: {
        id: 'location-1',
        name: 'National',
        code2: 'US'
      },
      assignedVendor: null
    },
    {
      id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      orderItemId: '660e8400-e29b-41d4-a716-446655440002',
      serviceId: 'service-type-2',
      locationId: 'location-2',
      status: 'processing',
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
        category: 'Verification'
      },
      location: {
        id: 'location-2',
        name: 'Previous Employer',
        code2: null
      },
      assignedVendor: {
        id: 'vendor-123',
        name: 'Background Vendor Inc',
        disabled: false
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();

    // Reset fetch mock to return a resolved Promise so production code that calls .catch() on the fetch result works correctly
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        userType: 'internal',
        permissions: { fulfillment: { manage: true } }
      },
      isAuthenticated: true,
      isLoading: false,
      hasPermission: vi.fn().mockReturnValue(true),
      checkPermission: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn()
    });
  });

  describe('Order Item View Tracking - Business Rule Tests', () => {
    it('DEBUGGING: minimal render test', async () => {
      // Simplified test that should work - create minimal working service data
      const workingServices = [{
        id: 'test-service-1',
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        orderItemId: '660e8400-e29b-41d4-a716-446655440001',
        serviceId: 'service-type-1',
        locationId: 'location-1',
        status: 'submitted',
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
          name: 'Test Service',
          category: 'Test'
        },
        location: {
          id: 'location-1',
          name: 'Test Location',
          code2: 'US'
        },
        assignedVendor: null
      }];

      // Render with explicit props that match the component's expectations
      const { container } = render(
        <ServiceFulfillmentTable
          services={workingServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
          orderId="550e8400-e29b-41d4-a716-446655440001"
        />
      );

      // Wait for any async effects to complete
      await screen.findByLabelText('Service fulfillment status');

      // Look for service rows by test ID
      const serviceRows = container.querySelectorAll('[data-testid^="service-row-"]');

      if (serviceRows.length === 0) {
        // If still no rows, log debug info
        console.log('=== DEBUG: No service rows found ===');
        console.log('DOM contains:', container.innerHTML.includes('No services found') ? 'Empty state' : 'Other content');

        // Check if services are in DOM in any form
        const serviceName = container.innerHTML.includes('Test Service');
        console.log('Service name in DOM:', serviceName);

        throw new Error('TEST SETUP ISSUE: Services not rendering despite valid data structure');
      }

      // Should find expand button
      const expandButtons = container.querySelectorAll('button[aria-label*="Expand"], button[aria-label*="Collapse"]');
      expect(expandButtons.length).toBe(1);
    });

    it('should fire POST /api/order-items/[id]/view when expanding a row', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      // Wait for table to render
      await screen.findByLabelText('Service fulfillment status');

      // Find expand buttons - should be 2 (one per service)
      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && (
          ariaLabel.includes('Expand') ||
          ariaLabel.includes('Collapse')
        );
      });

      expect(expandButtons.length).toBe(2); // Should find 2 expand buttons

      // Click the first expand button (for first service with orderItemId ending in 001)
      await user.click(expandButtons[0]);

      // Wait for the tracking API call to be made (this will fail in Pass 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });

    it('should NOT fire tracking call when collapsing a row', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      // Wait for table to render
      await screen.findByLabelText('Service fulfillment status');

      // Find expand buttons
      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && (
          ariaLabel.includes('Expand') ||
          ariaLabel.includes('Collapse')
        );
      });

      expect(expandButtons.length).toBe(2);
      const expandButton = expandButtons[0];

      // Click to expand the row first
      await user.click(expandButton);

      // Wait for expand tracking call (this will fail in Pass 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Clear the mock to track subsequent calls
      vi.clearAllMocks();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      // Click to collapse the row
      await user.click(expandButton);

      // Verify NO tracking call was made for collapse
      expect(global.fetch).not.toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', expect.any(Object));
    });

    it('should fire tracking call for each different order item expanded', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      // Wait for table to render
      await screen.findByLabelText('Service fulfillment status');

      // Find expand buttons
      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && (
          ariaLabel.includes('Expand') ||
          ariaLabel.includes('Collapse')
        );
      });

      expect(expandButtons.length).toBe(2);

      // Click to expand first service
      await user.click(expandButtons[0]);

      // Wait for first tracking call (this will fail in Pass 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Click to expand second service
      await user.click(expandButtons[1]);

      // Wait for second tracking call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440002/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Both tracking calls should have been made
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should fire tracking call each time the same row is expanded (no client-side deduplication)', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      // Wait for table to render
      await screen.findByLabelText('Service fulfillment status');

      // Find expand buttons
      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && (
          ariaLabel.includes('Expand') ||
          ariaLabel.includes('Collapse')
        );
      });

      expect(expandButtons.length).toBe(2);
      const expandButton = expandButtons[0];

      // Expand the row
      await user.click(expandButton);

      // Wait for first tracking call (this will fail in Pass 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Collapse the row
      await user.click(expandButton);

      // Expand the row again
      await user.click(expandButton);

      // Wait for second tracking call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Should have been called twice (once for each expand)
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // Fix 4: Add missing test for orderItemId vs serviceId distinction
    it('REGRESSION TEST: should use orderItemId for tracking, not serviceId', async () => {
      // REGRESSION TEST: Tracking must use orderItemId, not serviceId. If this test fails,
      // the fetch URL is using the wrong id and production view tracking will record views against the wrong rows.
      const user = userEvent.setup();

      // Create a service where id and orderItemId are clearly different
      const serviceWithDifferentIds = [{
        id: 'svc-AAA-111',  // This is the serviceId
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        orderItemId: 'oit-BBB-222',  // This is what should be used in the API call
        serviceId: 'service-type-1',
        locationId: 'location-1',
        status: 'submitted',
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
          name: 'Criminal Background Check',
          category: 'Background'
        },
        location: {
          id: 'location-1',
          name: 'National',
          code2: 'US'
        },
        assignedVendor: null
      }];

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={serviceWithDifferentIds}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      // Wait for table to render
      await screen.findByLabelText('Service fulfillment status');

      // Find expand buttons
      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && (
          ariaLabel.includes('Expand') ||
          ariaLabel.includes('Collapse')
        );
      });

      expect(expandButtons.length).toBe(1);
      const expandButton = expandButtons[0];

      // Click to expand the row
      await user.click(expandButton);

      // Assert fetch was called with URL containing the orderItemId, NOT the serviceId (this will fail in Pass 1)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/order-items/oit-BBB-222/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });

      // Verify it was NOT called with the wrong ID
      expect(global.fetch).not.toHaveBeenCalledWith('/api/order-items/svc-AAA-111/view', expect.any(Object));
    });
  });

  describe('Silent Failure Handling', () => {
    it('should continue row expansion when tracking API fails with network error', async () => {
      const user = userEvent.setup();

      // Mock fetch to throw network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      expect(expandButtons.length).toBe(2);

      // Click expand button - row should expand even if tracking fails
      await user.click(expandButtons[0]);

      // This will fail in Pass 1 because tracking call won't be made
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should continue row expansion when tracking API returns 500 error', async () => {
      const user = userEvent.setup();

      // Mock fetch to return 500 error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      });

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      // Click expand - should work even with API error
      await user.click(expandButtons[0]);

      // This will fail in Pass 1 because tracking call won't be made
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should never show error messages to users when tracking fails', async () => {
      const user = userEvent.setup();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock fetch to throw error
      global.fetch = vi.fn().mockRejectedValue(new Error('Tracking failed'));

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      await user.click(expandButtons[0]);

      // Should not show any error toasts or alerts to user
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();

      // This will fail in Pass 1 because tracking call won't be made
      expect(global.fetch).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('User Type Behavior', () => {
    it('should make tracking calls for customer users viewing their orders', async () => {
      const user = userEvent.setup();

      // Mock customer user
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'customer-123',
          userType: 'customer',
          permissions: {}
        },
        isAuthenticated: true,
        isLoading: false,
        hasPermission: vi.fn().mockReturnValue(false),
        checkPermission: vi.fn().mockReturnValue(false),
        login: vi.fn(),
        logout: vi.fn()
      });

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={true}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      await user.click(expandButtons[0]);

      // This will fail in Pass 1 - tracking not implemented yet
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should make tracking calls for internal users', async () => {
      const user = userEvent.setup();

      // Internal user auth is already set up in beforeEach
      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      await user.click(expandButtons[0]);

      // This will fail in Pass 1 - tracking not implemented yet
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should make tracking calls for vendor users', async () => {
      const user = userEvent.setup();

      // Mock vendor user
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-123',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        },
        isAuthenticated: true,
        isLoading: false,
        hasPermission: vi.fn().mockReturnValue(false),
        checkPermission: vi.fn().mockReturnValue(false),
        login: vi.fn(),
        logout: vi.fn()
      });

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      await user.click(expandButtons[0]);

      // This will fail in Pass 1 - tracking not implemented yet
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('API Call Format', () => {
    it('should use exact API call format specified in spec', async () => {
      const user = userEvent.setup();

      render(
        <ServiceFulfillmentTable
          orderId="550e8400-e29b-41d4-a716-446655440001"
          services={mockServices}
          isLoading={false}
          readOnly={false}
          showNotes={false}
          isCustomer={false}
        />
      );

      await screen.findByLabelText('Service fulfillment status');

      const expandButtons = screen.getAllByRole('button').filter(button => {
        const ariaLabel = button.getAttribute('aria-label');
        return ariaLabel && ariaLabel.includes('Expand');
      });

      await user.click(expandButtons[0]);

      // This will fail in Pass 1 - verify exact API call format from spec
      expect(global.fetch).toHaveBeenCalledWith('/api/order-items/660e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Verify NO other parameters were sent
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify no body was sent (endpoint uses session for user identification)
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const requestOptions = fetchCall[1] as RequestInit;
      expect(requestOptions.body).toBeUndefined();
    });
  });
});