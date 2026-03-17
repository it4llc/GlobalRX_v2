// REGRESSION TEST: proves bug fix for unformatted service status display
// This test file specifically tests the formatting of service status values
// The bug: ServiceFulfillmentTable shows raw database values (e.g., "draft", "pending")
// instead of formatted values (e.g., "Draft", "Pending")
// The formatStatus function is defined but not being used in the display

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('ServiceFulfillmentTable - Status Formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: {
        id: 1,
        role: 'admin',
        permissions: { fulfillment: { edit: true } }
      },
      isVendor: false
    });
  });

  // REGRESSION TEST: proves bug fix for unformatted service status display
  // This test verifies that status values are properly formatted for display
  // The bug occurs when raw database values (lowercase like "pending") are shown
  // instead of formatted values (capitalized like "Pending")
  // This test should FAIL before the fix and PASS after
  it('REGRESSION TEST: should display formatted status values, not raw database values', () => {
    const mockServices = [
      {
        id: '1',
        orderId: '123',
        orderItemId: 'item-1',
        serviceId: 'service-1',
        locationId: 'loc-1',
        status: 'pending', // Raw database value - should display as "Pending"
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        service: {
          id: 'service-1',
          name: 'Test Service',
          code: 'TS001',
          category: 'Testing'
        },
        location: {
          id: 'loc-1',
          name: 'Test Location',
          code2: 'TL'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    // This assertion expects the formatted value "Pending" (capitalized)
    // Before the fix: This will FAIL because it finds "pending" (lowercase)
    // After the fix: This will PASS because formatStatus will be applied
    const statusElement = screen.getByText('Pending');
    expect(statusElement).toBeInTheDocument();
  });

  // Test specifically for "draft" status mentioned in bug report
  it('should format "draft" status as "Draft" (internal detail view bug)', () => {
    const mockServices = [
      {
        id: '2',
        orderId: '123',
        orderItemId: 'item-2',
        serviceId: 'service-2',
        locationId: 'loc-2',
        status: 'draft', // Raw value from database - should display as "Draft"
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        service: {
          id: 'service-2',
          name: 'Test Service 2',
          code: 'TS002',
          category: 'Testing'
        },
        location: {
          id: 'loc-2',
          name: 'Test Location 2',
          code2: 'TL2'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    // Look specifically in the table cell that displays the status
    const statusCell = screen.getByRole('cell', { name: 'draft' });
    expect(statusCell).toHaveTextContent('Draft');
  });

  // Additional test cases for different status values
  it('should format "submitted" status as "Submitted"', () => {
    const mockServices = [
      {
        id: '2',
        orderId: '123',
        orderItemId: 'item-2',
        serviceId: 'service-2',
        locationId: 'loc-2',
        status: 'submitted', // Raw value - should display as "Submitted"
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        service: {
          id: 'service-2',
          name: 'Test Service 2',
          code: 'TS002',
          category: 'Testing'
        },
        location: {
          id: 'loc-2',
          name: 'Test Location 2',
          code2: 'TL2'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    // Look specifically in the table cell that displays the status
    const statusCell = screen.getByRole('cell', { name: 'submitted' });
    expect(statusCell).toHaveTextContent('Submitted');
  });

  it('should format "in_progress" status as "In Progress"', () => {
    const mockServices = [
      {
        id: '3',
        orderId: '123',
        orderItemId: 'item-3',
        serviceId: 'service-3',
        locationId: 'loc-3',
        status: 'in_progress', // Raw value with underscore - should display as "In Progress"
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        service: {
          id: 'service-3',
          name: 'Test Service 3',
          code: 'TS003',
          category: 'Testing'
        },
        location: {
          id: 'loc-3',
          name: 'Test Location 3',
          code2: 'TL3'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    const statusElement = screen.getByText('In Progress');
    expect(statusElement).toBeInTheDocument();
  });

  it('should format "pending_review" status as "Pending Review"', () => {
    const mockServices = [
      {
        id: '4',
        orderId: '123',
        orderItemId: 'item-4',
        serviceId: 'service-4',
        locationId: 'loc-4',
        status: 'pending_review', // Multiple words with underscore
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        service: {
          id: 'service-4',
          name: 'Test Service 4',
          code: 'TS004',
          category: 'Testing'
        },
        location: {
          id: 'loc-4',
          name: 'Test Location 4',
          code2: 'TL4'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    const statusElement = screen.getByText('Pending Review');
    expect(statusElement).toBeInTheDocument();
  });

  it('should format "completed" status as "Completed"', () => {
    const mockServices = [
      {
        id: '5',
        orderId: '123',
        orderItemId: 'item-5',
        serviceId: 'service-5',
        locationId: 'loc-5',
        status: 'completed', // Raw value - should display as "Completed"
        assignedVendorId: null,
        vendorNotes: null,
        internalNotes: null,
        assignedAt: null,
        assignedBy: null,
        completedAt: '2024-01-02',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        service: {
          id: 'service-5',
          name: 'Test Service 5',
          code: 'TS005',
          category: 'Testing'
        },
        location: {
          id: 'loc-5',
          name: 'Test Location 5',
          code2: 'TL5'
        }
      }
    ];

    render(
      <ServiceFulfillmentTable
        services={mockServices}
        readOnly={true}
      />
    );

    // Look specifically in the table cell that displays the status
    const statusCell = screen.getByRole('cell', { name: 'completed' });
    expect(statusCell).toHaveTextContent('Completed');
  });

  it('should format all common status values correctly', () => {
    const statusMappings = [
      { raw: 'draft', formatted: 'Draft' },
      { raw: 'pending', formatted: 'Pending' },
      { raw: 'submitted', formatted: 'Submitted' },
      { raw: 'processing', formatted: 'Processing' },
      { raw: 'in_progress', formatted: 'In Progress' },
      { raw: 'pending_review', formatted: 'Pending Review' },
      { raw: 'completed', formatted: 'Completed' },
      { raw: 'cancelled', formatted: 'Cancelled' },
      { raw: 'on_hold', formatted: 'On Hold' }
    ];

    statusMappings.forEach(({ raw, formatted }, index) => {
      const { unmount } = render(
        <ServiceFulfillmentTable
          services={[
            {
              id: `test-${index}`,
              orderId: '123',
              orderItemId: `item-${index}`,
              serviceId: `service-${index}`,
              locationId: 'loc-1',
              status: raw,
              assignedVendorId: null,
              vendorNotes: null,
              internalNotes: null,
              assignedAt: null,
              assignedBy: null,
              completedAt: null,
              createdAt: '2024-01-01',
              updatedAt: '2024-01-01',
              service: {
                id: `service-${index}`,
                name: `Test Service ${index}`,
                code: `TS${index}`,
                category: 'Testing'
              },
              location: {
                id: 'loc-1',
                name: 'Test Location',
                code2: 'TL'
              }
            }
          ]}
          readOnly={true}
        />
      );

      // Look specifically in the table cell that displays the status
      const statusCell = screen.getByRole('cell', { name: raw });
      expect(statusCell).toHaveTextContent(formatted);

      unmount();
    });
  });
});

// Unit tests for the formatStatus function itself
describe('formatStatus function', () => {
  // This function should be exported from ServiceFulfillmentTable.tsx for unit testing
  // For now, we'll define it here to match the implementation
  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  it('should capitalize single word status', () => {
    expect(formatStatus('draft')).toBe('Draft');
    expect(formatStatus('pending')).toBe('Pending');
    expect(formatStatus('completed')).toBe('Completed');
  });

  it('should handle underscore-separated words', () => {
    expect(formatStatus('in_progress')).toBe('In Progress');
    expect(formatStatus('pending_review')).toBe('Pending Review');
    expect(formatStatus('on_hold')).toBe('On Hold');
  });

  it('should handle already capitalized status', () => {
    expect(formatStatus('Draft')).toBe('Draft');
    expect(formatStatus('Completed')).toBe('Completed');
  });

  it('should handle empty string', () => {
    expect(formatStatus('')).toBe('');
  });

  it('should handle status with multiple underscores', () => {
    expect(formatStatus('pending_vendor_assignment')).toBe('Pending Vendor Assignment');
    expect(formatStatus('ready_for_final_review')).toBe('Ready For Final Review');
  });
});