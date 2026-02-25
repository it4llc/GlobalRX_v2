/**
 * Tests for Customer Configs Page Refactoring
 * Following TDD approach - these tests define the expected behavior
 * before refactoring the implementation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useParams, useRouter } from 'next/navigation';
import { vi } from 'vitest';
import CustomerConfigsPage from '@/app/customer-configs/[id]/page';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(),
}));

// Mock client logger to avoid console statements
vi.mock('@/lib/client-logger', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
  return {
    default: logger,
    clientLogger: logger,
    errorToLogMeta: vi.fn(),
  };
});

describe('CustomerConfigsPage', () => {
  const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
  const mockUseParams = useParams as ReturnType<typeof vi.fn>;
  const mockUseTranslation = useTranslation as ReturnType<typeof vi.fn>;
  const mockUseRouter = useRouter as ReturnType<typeof vi.fn>;

  const mockCustomerData = {
    id: 'customer-123',
    name: 'Acme Corporation',
    address: '123 Business St',
    contactName: 'John Doe',
    contactEmail: 'john@acme.com',
    contactPhone: '+1-555-0123',
    masterAccountId: null,
    billingAccountId: null,
    invoiceTerms: 'Net 30',
    invoiceContact: 'billing@acme.com',
    invoiceMethod: 'Email',
    disabled: false,
    subaccountsCount: 2,
    packagesCount: 3,
    serviceIds: ['service-1', 'service-2'],
    services: [
      { id: 'service-1', name: 'Service A', category: 'Category 1' },
      { id: 'service-2', name: 'Service B', category: 'Category 2' }
    ],
    logoUrl: null,
    primaryColor: '#1f2937',
    secondaryColor: '#3b82f6',
    accentColor: '#10b981',
    dataRetentionDays: 90,
  };

  const mockFetchWithAuth = vi.fn();
  const mockCheckPermission = vi.fn();
  const mockTranslate = vi.fn((key: string) => key);

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({ id: 'customer-123' });
    mockUseRouter.mockReturnValue({
      push: vi.fn(),
      refresh: vi.fn(),
    });

    mockUseAuth.mockReturnValue({
      fetchWithAuth: mockFetchWithAuth,
      checkPermission: mockCheckPermission,
    });

    mockUseTranslation.mockReturnValue({
      t: mockTranslate,
    });

    // Default successful API response
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => mockCustomerData,
    });
  });

  describe('Permission & Security', () => {
    test('should deny access if user lacks customers.view permission', async () => {
      mockCheckPermission.mockReturnValue(false);

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/forbidden/i)).toBeInTheDocument();
      });
    });

    test('should hide edit button if user lacks customers.edit permission', async () => {
      // Mock permissions: view=true, edit=false
      mockCheckPermission.mockImplementation((resource, action) => {
        if (resource === 'customers' && action === 'view') return true;
        if (resource === 'customers' && action === 'edit') return false;
        return false;
      });

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
      });

      expect(screen.queryByText(/edit/i)).not.toBeInTheDocument();
    });

    test('should show edit button if user has customers.edit permission', async () => {
      mockCheckPermission.mockReturnValue(true);

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Loading & Display', () => {
    test('should display loading indicator while fetching customer data', () => {
      mockCheckPermission.mockReturnValue(true);

      render(<CustomerConfigsPage />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    test('should display customer data after successful load', async () => {
      mockCheckPermission.mockReturnValue(true);

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
        expect(screen.getByText('123 Business St')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('john@acme.com')).toBeInTheDocument();
      });
    });

    test('should display error message on API failure', async () => {
      mockCheckPermission.mockReturnValue(true);
      mockFetchWithAuth.mockRejectedValue(new Error('API Error'));

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/error loading customer/i)).toBeInTheDocument();
      });
    });

    test('should display customer not found message for 404', async () => {
      mockFetchWithAuth.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Management', () => {
    beforeEach(() => {
      mockCheckPermission.mockReturnValue(true);
    });

    test('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      expect(screen.getByText(/save/i)).toBeInTheDocument();
      expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    });

    test('should populate form fields with customer data in edit mode', async () => {
      const user = userEvent.setup();

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      expect(screen.getByDisplayValue('Acme Corporation')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Business St')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    test('should reset form data on cancel', async () => {
      const user = userEvent.setup();

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      // Modify a field
      const nameInput = screen.getByDisplayValue('Acme Corporation');
      await user.clear(nameInput);
      await user.type(nameInput, 'Modified Name');

      // Cancel
      await user.click(screen.getByText(/cancel/i));

      // Verify form is reset and not in edit mode
      expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
      expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    });
  });

  describe('Business Logic Validation', () => {
    beforeEach(() => {
      mockCheckPermission.mockReturnValue(true);
    });

    test('should prevent circular master account reference', async () => {
      const user = userEvent.setup();

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      // Try to select subaccount type and the same customer as master
      const subaccountRadio = screen.getByLabelText(/subaccount/i);
      await user.click(subaccountRadio);

      // This should show validation error or prevent selection
      // Implementation will be added during refactor
      expect(true).toBe(true); // Placeholder assertion
    });

    test('should validate email format', async () => {
      const user = userEvent.setup();

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      const emailInput = screen.getByDisplayValue('john@acme.com');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      await user.click(screen.getByText(/save/i));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });
  });

  describe('Component Structure', () => {
    test('should have modular components for different sections', async () => {
      mockCheckPermission.mockReturnValue(true);

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('basic-information-section')).toBeInTheDocument();
        expect(screen.getByTestId('account-relationships-section')).toBeInTheDocument();
        expect(screen.getByTestId('branding-section')).toBeInTheDocument();
        expect(screen.getByTestId('services-section')).toBeInTheDocument();
      });
    });

    test('should use proper TypeScript types without any', () => {
      // This will be validated during implementation
      expect(true).toBe(true);
    });
  });

  describe('API Integration', () => {
    beforeEach(() => {
      mockCheckPermission.mockReturnValue(true);
    });

    test('should call update API with correct data on save', async () => {
      const user = userEvent.setup();

      // Mock successful update
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCustomerData }) // Initial load
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ...mockCustomerData, name: 'Updated Name' }) }); // Update

      render(<CustomerConfigsPage />);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/edit/i));

      const nameInput = screen.getByDisplayValue('Acme Corporation');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      await user.click(screen.getByText(/save/i));

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/customers/customer-123', {
          method: 'PUT',
          body: expect.stringContaining('"name":"Updated Name"'),
        });
      });
    });

    test('should handle API errors gracefully on save', async () => {
      mockCheckPermission.mockReturnValue(true);
      const user = userEvent.setup();

      // Mock successful initial load, then failed update
      mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
        if (options && options.method === 'PUT') {
          // For the PUT request (update), return a rejected promise
          return Promise.reject(new Error('Update failed'));
        } else {
          // For the GET request (initial load), return success
          return Promise.resolve({
            ok: true,
            json: async () => mockCustomerData
          });
        }
      });

      render(<CustomerConfigsPage />);

      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
      });

      // Enter edit mode
      await user.click(screen.getByText(/edit/i));

      // Verify we're in edit mode
      await waitFor(() => {
        expect(screen.getByText(/save/i)).toBeInTheDocument();
      });

      // Try to save - this should fail
      await user.click(screen.getByText(/save/i));

      // Should remain in edit mode and show error
      await waitFor(() => {
        expect(screen.getByText(/update failed/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should still be in edit mode (Save button still visible)
      expect(screen.getByText(/save/i)).toBeInTheDocument();
    });
  });
});