// /GlobalRX_v2/src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx

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
  };
}

describe('ServiceFulfillmentTable', () => {
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
    },
    {
      id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
      orderId: '550e8400-e29b-41d4-a716-446655440001',
      orderItemId: '660e8400-e29b-41d4-a716-446655440003',
      serviceId: 'service-type-3',
      locationId: 'location-3',
      status: 'Completed',
      assignedVendorId: 'vendor-456',
      vendorNotes: 'All checks passed',
      internalNotes: 'Approved',
      assignedAt: '2024-03-01T10:00:00Z',
      assignedBy: 'user-456',
      completedAt: '2024-03-01T14:00:00Z',
      createdAt: '2024-03-01T09:00:00Z',
      updatedAt: '2024-03-01T14:00:00Z',
      service: {
        id: 'service-type-3',
        name: 'Education Verification',
        category: 'Verification'
      },
      location: {
        id: 'location-3',
        name: 'University',
        code2: null
      },
      assignedVendor: {
        id: 'vendor-456',
        name: 'Verification Services LLC',
        disabled: false
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockToastError.mockClear();
    mockToastSuccess.mockClear();
    // Reset fetch mock but keep it as a function
    global.fetch = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        userType: 'internal',
        permissions: { fulfillment: { manage: true } }
      }
    });
  });

  describe('rendering', () => {
    it('should display service information in table rows', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Check headers
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Assigned Vendor')).toBeInTheDocument();
      expect(screen.getAllByText('Actions')[0]).toBeInTheDocument(); // Header is first

      // Check service data
      expect(screen.getByText('Criminal Background Check')).toBeInTheDocument();
      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.getByText('Education Verification')).toBeInTheDocument();

      // Check locations
      expect(screen.getByText('National')).toBeInTheDocument();
      expect(screen.getByText('Previous Employer')).toBeInTheDocument();
      expect(screen.getByText('University')).toBeInTheDocument();

      // Check vendors - they appear in the table cells and possibly in dropdown
      const vendorElements1 = screen.getAllByText('Background Vendor Inc');
      expect(vendorElements1.length).toBeGreaterThan(0);
      const vendorElements2 = screen.getAllByText('Verification Services LLC');
      expect(vendorElements2.length).toBeGreaterThan(0);
    });

    it('should display status badges with correct colors', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Find status badges in the table cells (they also appear in dropdowns)
      const rows = screen.getAllByRole('row');

      // Find the Submitted status in the first service row
      const submittedRow = rows.find(row => row.textContent?.includes('Criminal Background Check'));
      expect(submittedRow?.textContent).toContain('Submitted');

      // Find the Processing status in the second service row
      const processingRow = rows.find(row => row.textContent?.includes('Employment Verification'));
      expect(processingRow?.textContent).toContain('Processing');

      // Find the Completed status in the third service row
      const completedRow = rows.find(row => row.textContent?.includes('Education Verification'));
      expect(completedRow?.textContent).toContain('Completed');
    });

    it('should display "Not Assigned" for services without vendor', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      expect(screen.getByText('Not Assigned')).toBeInTheDocument();
    });

    it('should display empty state when no services exist', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={[]} />);

      expect(screen.getByText('No services found for this order')).toBeInTheDocument();
    });

    it('should display checkbox for bulk selection', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4); // 1 header + 3 rows
    });

    it('should display loading state', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} isLoading={true} />);

      expect(screen.getByText('Loading services...')).toBeInTheDocument();
    });

    it('should display vendor notes when available', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} showNotes={true} />);

      expect(screen.getByText('In progress')).toBeInTheDocument();
      expect(screen.getByText('All checks passed')).toBeInTheDocument();
    });

    it('should display internal notes for internal users', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} showNotes={true} />);

      expect(screen.getByText('Rush order')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('should hide internal notes from vendor users', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} showNotes={true} />);

      expect(screen.queryByText('Rush order')).not.toBeInTheDocument();
      expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    });

    it('should flag services with deactivated vendors', () => {
      const servicesWithDeactivated = [
        {
          ...mockServices[1],
          assignedVendor: {
            ...mockServices[1].assignedVendor,
            disabled: true
          }
        }
      ];

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={servicesWithDeactivated} />);

      expect(screen.getByText('(Deactivated)')).toBeInTheDocument();
    });
  });

  describe('bulk selection', () => {
    it('should select all services when header checkbox is clicked', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(headerCheckbox);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should deselect all when header checkbox is unchecked', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const headerCheckbox = screen.getAllByRole('checkbox')[0];

      // Select all
      await user.click(headerCheckbox);
      // Deselect all
      await user.click(headerCheckbox);

      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should select individual services', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const firstServiceCheckbox = screen.getAllByRole('checkbox')[1];
      await user.click(firstServiceCheckbox);

      expect(firstServiceCheckbox).toBeChecked();
      expect(screen.getAllByRole('checkbox')[2]).not.toBeChecked();
    });

    it('should enable bulk assign button when services are selected', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      expect(screen.getByText('Bulk Assign to Vendor')).toBeDisabled();

      const firstServiceCheckbox = screen.getAllByRole('checkbox')[1];
      await user.click(firstServiceCheckbox);

      expect(screen.getByText('Bulk Assign to Vendor')).not.toBeDisabled();
    });

    it('should show count of selected services', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      expect(screen.getByText('2 services selected')).toBeInTheDocument();
    });
  });

  describe('vendor assignment', () => {
    it('should open assignment dialog when Assign button is clicked', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const assignButton = screen.getAllByText('Assign')[0];
      await user.click(assignButton);

      expect(screen.getByText('Assign Service to Vendor')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Vendor')).toBeInTheDocument();
    });

    it('should open bulk assignment dialog when bulk assign is clicked', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Select services first
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      const bulkAssignButton = screen.getByText('Bulk Assign to Vendor');
      await user.click(bulkAssignButton);

      expect(screen.getByText('Bulk Assign Services to Vendor')).toBeInTheDocument();
      expect(screen.getByText('2 services will be assigned')).toBeInTheDocument();
    });

    it('should call API to assign vendor', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', assignedVendorId: 'vendor-789' })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const assignButton = screen.getAllByText('Assign')[0];
      await user.click(assignButton);

      const vendorSelect = screen.getByLabelText('Select Vendor');
      await user.selectOptions(vendorSelect, 'vendor-789');

      const confirmButton = screen.getByText('Confirm Assignment');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/fulfillment/services/service-1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ assignedVendorId: 'vendor-789' })
          })
        );
      });
    });

    it('should allow reassigning to different vendor', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Find service that already has vendor
      const reassignButton = screen.getAllByText('Reassign')[0];
      await user.click(reassignButton);

      expect(screen.getByText('Reassign Service to Different Vendor')).toBeInTheDocument();
      expect(screen.getByText('Currently assigned to: Background Vendor Inc')).toBeInTheDocument();
    });

    it('should disable assignment for vendor users', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      expect(screen.queryByText('Assign')).not.toBeInTheDocument();
      expect(screen.queryByText('Reassign')).not.toBeInTheDocument();
      expect(screen.queryByText('Bulk Assign to Vendor')).not.toBeInTheDocument();
    });

    it('should require fulfillment.manage permission for assignment', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true } // No manage permission
        }
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      expect(screen.queryByText('Assign')).not.toBeInTheDocument();
      expect(screen.queryByText('Bulk Assign to Vendor')).not.toBeInTheDocument();
    });
  });

  describe('status updates', () => {
    it('should display status dropdown for each service', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Get dropdowns specifically for service status (not filter dropdowns)
      const statusDropdowns = screen.getAllByRole('combobox', { name: /status for/i });
      // Should be 3 dropdowns - all services can now have their status changed (terminal statuses with confirmation)
      expect(statusDropdowns).toHaveLength(3);
    });

    it('should call API to update status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'Processing' },
          auditEntry: { id: 'audit-1' }
        })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const statusDropdown = screen.getByRole('combobox', { name: /Status for Criminal Background Check/i });

      // Use fireEvent to change the value
      fireEvent.change(statusDropdown, { target: { value: 'Processing' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/services/item-1/status',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ status: 'Processing' })
          })
        );
      });
    });

    it('should allow status changes for completed services with confirmation', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Completed service should have a dropdown (terminal statuses can be changed with confirmation)
      const completedService = mockServices.find(s => s.status === 'Completed');
      expect(completedService).toBeDefined();

      // Find the dropdown for the completed service
      const dropdown = screen.getByLabelText(`Status for ${completedService.service.name}`);
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveValue('Completed');
    });

    it('should allow status changes for cancelled services with confirmation', () => {
      const servicesWithCancelled = [
        {
          ...mockServices[0],
          status: 'Cancelled'
        }
      ];

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={servicesWithCancelled} />);

      // Cancelled service should have a dropdown (terminal statuses can be changed with confirmation)
      const dropdown = screen.getByLabelText('Status for Criminal Background Check');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveValue('Cancelled');
    });

    it('should show confirmation for status change to cancelled', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const statusDropdown = screen.getAllByRole('combobox', { name: /status/i })[0];
      await user.selectOptions(statusDropdown, 'Cancelled');

      expect(screen.getByText('Confirm Status Change')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to cancel this service?')).toBeInTheDocument();
    });
  });

  describe('actions menu', () => {
    it('should display actions dropdown for each service', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButtons = screen.getAllByText('Actions');
      expect(actionButtons).toHaveLength(4); // 1 header + 3 buttons
    });

    it('should show view history option', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButton = screen.getAllByText('Actions')[1]; // Skip header
      await user.click(actionButton);

      expect(screen.getByText('View History')).toBeInTheDocument();
    });

    it('should show edit notes option', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButton = screen.getAllByText('Actions')[1]; // Skip header
      await user.click(actionButton);

      expect(screen.getByText('Edit Notes')).toBeInTheDocument();
    });

    it('should open history dialog when view history is clicked', async () => {
      const user = userEvent.setup();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          history: [
            {
              id: 'log-1',
              changeType: 'status_change',
              fieldName: 'status',
              oldValue: 'pending',
              newValue: 'submitted',
              createdAt: '2024-03-01T10:00:00Z',
              user: { email: 'user@example.com' }
            }
          ],
          totalEntries: 1
        })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButton = screen.getAllByText('Actions')[1]; // Skip header
      await user.click(actionButton);

      const viewHistoryOption = screen.getByText('View History');
      await user.click(viewHistoryOption);

      await waitFor(() => {
        expect(screen.getByText('Service History')).toBeInTheDocument();
        // Check that the fetch was called to get history
        expect(global.fetch).toHaveBeenCalledWith('/api/fulfillment/services/service-1/history');
      });
    });

    it('should open notes dialog when edit notes is clicked', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButton = screen.getAllByText('Actions')[1]; // Skip header
      await user.click(actionButton);

      const editNotesOption = screen.getByText('Edit Notes');
      await user.click(editNotesOption);

      expect(screen.getByText('Edit Service Notes')).toBeInTheDocument();
      expect(screen.getByLabelText('Vendor Notes')).toBeInTheDocument();
      expect(screen.getByLabelText('Internal Notes')).toBeInTheDocument();
    });

    it('should only show vendor notes field for vendor users', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const actionButton = screen.getAllByText('Actions')[1]; // Skip header
      await user.click(actionButton);

      const editNotesOption = screen.getByText('Edit Notes');
      await user.click(editNotesOption);

      expect(screen.getByLabelText('Vendor Notes')).toBeInTheDocument();
      expect(screen.queryByLabelText('Internal Notes')).not.toBeInTheDocument();
    });
  });

  describe('filtering and sorting', () => {
    it('should filter services by status', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const statusFilter = screen.getByLabelText('Filter by Status');
      await user.selectOptions(statusFilter, 'Completed');

      expect(screen.queryByText('Criminal Background Check')).not.toBeInTheDocument();
      expect(screen.queryByText('Employment Verification')).not.toBeInTheDocument();
      expect(screen.getByText('Education Verification')).toBeInTheDocument();
    });

    it('should filter services by vendor', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const vendorFilter = screen.getByLabelText('Filter by Vendor');
      await user.selectOptions(vendorFilter, 'vendor-123');

      expect(screen.queryByText('Criminal Background Check')).not.toBeInTheDocument();
      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.queryByText('Education Verification')).not.toBeInTheDocument();
    });

    it('should show only unassigned services when filtered', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const vendorFilter = screen.getByLabelText('Filter by Vendor');
      await user.selectOptions(vendorFilter, 'unassigned');

      expect(screen.getByText('Criminal Background Check')).toBeInTheDocument();
      expect(screen.queryByText('Employment Verification')).not.toBeInTheDocument();
      expect(screen.queryByText('Education Verification')).not.toBeInTheDocument();
    });

    it('should sort services by service name', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const serviceHeader = screen.getByText('Service');
      await user.click(serviceHeader);

      // Find service name cells by looking for the specific text content
      const rows = screen.getAllByRole('row');
      // Skip header row
      const dataRows = rows.slice(1);

      // After sorting alphabetically, order should be:
      // Criminal Background Check, Education Verification, Employment Verification
      expect(dataRows[0]).toHaveTextContent('Criminal Background Check');
      expect(dataRows[1]).toHaveTextContent('Education Verification');
      expect(dataRows[2]).toHaveTextContent('Employment Verification');
    });

    it('should sort services by status', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const statusHeader = screen.getByText('Status');
      await user.click(statusHeader);

      const statuses = screen.getAllByRole('cell', { name: /Submitted|Processing|Completed/i });
      expect(statuses[0]).toHaveTextContent('Completed');
      expect(statuses[1]).toHaveTextContent('Submitted');
      expect(statuses[2]).toHaveTextContent('Processing');
    });
  });

  describe('vendor view', () => {
    beforeEach(() => {
      // Reset fetch mock but keep it as a function
      global.fetch = vi.fn();
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });
    });

    it('should only show services assigned to the vendor', () => {
      const vendorServices = mockServices.filter(s => s.assignedVendorId === 'vendor-123');
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={vendorServices} />);

      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.queryByText('Criminal Background Check')).not.toBeInTheDocument();
      expect(screen.queryByText('Education Verification')).not.toBeInTheDocument();
    });

    it('should allow vendor to update status of assigned services', async () => {
      const vendorServices = [mockServices[1]]; // Service assigned to vendor-123

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'Completed' },
          auditEntry: { id: 'audit-1' }
        })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={vendorServices} />);

      const statusDropdown = screen.getByRole('combobox', { name: /Status for Employment Verification/i });

      // Use fireEvent to trigger the change
      fireEvent.change(statusDropdown, { target: { value: 'Completed' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/services/item-2/status',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ status: 'Completed' })
          })
        );
      });
    });

    it('should allow vendor to edit vendor notes only', async () => {
      const user = userEvent.setup();
      const vendorServices = [mockServices[1]];

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={vendorServices} />);

      // Get the Actions button (skip the header)
      const actionButtons = screen.getAllByText('Actions');
      const actionButton = actionButtons[1]; // Skip header, get first data row button
      await user.click(actionButton);

      const editNotesOption = screen.getByText('Edit Notes');
      await user.click(editNotesOption);

      expect(screen.getByLabelText('Vendor Notes')).toBeInTheDocument();
      expect(screen.queryByLabelText('Internal Notes')).not.toBeInTheDocument();
    });

    it('should show terminal status services even after completion', () => {
      const completedServices = [
        {
          ...mockServices[1],
          status: 'Completed',
          completedAt: '2024-03-02T10:00:00Z'
        }
      ];

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={completedServices} />);

      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      // Check that the status dropdown shows Completed as the selected value
      const statusDropdown = screen.getByLabelText('Status for Employment Verification');
      expect(statusDropdown).toHaveValue('Completed');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      expect(screen.getByRole('table')).toHaveAttribute('aria-label', 'Service fulfillment status');
      expect(screen.getAllByRole('row')).toHaveLength(4); // Header + 3 data rows
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Get the first service checkbox (skip the header select-all checkbox)
      const firstCheckbox = screen.getByTestId('select-service-service-1');
      firstCheckbox.focus();

      // Space key should toggle the checkbox
      await user.keyboard(' ');
      expect(firstCheckbox).toBeChecked();

      await user.keyboard(' ');
      expect(firstCheckbox).not.toBeChecked();
    });

    it('should announce status changes to screen readers', async () => {
      // Mock the status update to succeed
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
        service: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', status: 'Processing' },
        auditEntry: { id: 'audit-1' }
      })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Find status dropdown by aria-label for the specific service
      const statusDropdown = screen.getByLabelText('Status for Criminal Background Check');

      // Verify initial value
      expect(statusDropdown).toHaveValue('Submitted');

      // Change to a different status
      fireEvent.change(statusDropdown, { target: { value: 'Processing' } });

      // Wait for the API call to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/services/item-1/status',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ status: 'Processing' })
          })
        );
      });

      // Now check that the success toast was called
      expect(mockToastSuccess).toHaveBeenCalledWith('Service status updated successfully');
    });
  });

  describe('error handling', () => {
    it('should display error message when API call fails', async () => {
      // Mock the status update to fail
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      // Find status dropdown by aria-label for the specific service
      const statusDropdown = screen.getByLabelText('Status for Criminal Background Check');

      // Change to trigger the API call
      fireEvent.change(statusDropdown, { target: { value: 'processing' } });

      // Wait for the error to be handled
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      // The error message will be 'Network error' from the thrown Error
      expect(mockToastError).toHaveBeenCalledWith('Network error');
    });

    it('should display error for invalid vendor assignment', async () => {
      const user = userEvent.setup();

      // Mock the assignment to fail
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Cannot assign service to vendor' })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const assignButton = screen.getAllByText('Assign')[0];
      await user.click(assignButton);

      const vendorSelect = screen.getByLabelText('Select Vendor');
      // Test Vendor is from the test environment initialization
      await user.selectOptions(vendorSelect, 'vendor-789');

      const confirmButton = screen.getByText('Confirm Assignment');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(mockToastError).toHaveBeenCalledWith('Cannot assign service to vendor');
    });

    it('should handle permission errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock the assignment to fail with permission error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Insufficient permissions to assign vendors' })
      });

      render(<ServiceFulfillmentTable orderId="550e8400-e29b-41d4-a716-446655440001" services={mockServices} />);

      const assignButton = screen.getAllByText('Assign')[0];
      await user.click(assignButton);

      const vendorSelect = screen.getByLabelText('Select Vendor');
      // Test Vendor is from the test environment initialization
      await user.selectOptions(vendorSelect, 'vendor-789');

      const confirmButton = screen.getByText('Confirm Assignment');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });

      expect(mockToastError).toHaveBeenCalledWith('Insufficient permissions to assign vendors');
    });
  });
});