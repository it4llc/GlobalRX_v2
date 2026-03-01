// src/components/modules/user-admin/__tests__/user-form.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserForm } from '../user-form';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock user data for tests
const mockInternalUser = {
  id: 'user-1',
  email: 'internal@example.com',
  firstName: 'Internal',
  lastName: 'User',
  userType: 'internal' as const,
  vendorId: null,
  customerId: null,
  permissions: {
    user_admin: true,
    global_config: true,
    customer_config: false,
    vendors: false,
    fulfillment: false,
  }
};

const mockVendorUser = {
  id: 'user-2',
  email: 'vendor@example.com',
  firstName: 'Vendor',
  lastName: 'User',
  userType: 'vendor' as const,
  vendorId: 'vendor-123',
  customerId: null,
  permissions: {
    user_admin: false,
    global_config: false,
    customer_config: false,
    vendors: false,
    fulfillment: true,
  }
};

const mockCustomerUser = {
  id: 'user-3',
  email: 'customer@example.com',
  firstName: 'Customer',
  lastName: 'User',
  userType: 'customer' as const,
  vendorId: null,
  customerId: 'customer-456',
  permissions: {
    user_admin: false,
    global_config: false,
    customer_config: true,
    vendors: false,
    fulfillment: false,
  }
};

const mockVendors = [
  { id: 'vendor-123', name: 'Test Vendor', isPrimary: false },
  { id: 'vendor-456', name: 'Primary Vendor', isPrimary: true }
];

const mockCustomers = [
  { id: 'customer-123', name: 'Test Customer' },
  { id: 'customer-456', name: 'Another Customer' }
];

describe('UserForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock API calls for vendors and customers
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/vendors')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVendors)
        });
      }
      if (url.includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCustomers)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('User Type Selection', () => {
    it('should display userType dropdown with correct options', async () => {
      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        expect(screen.getByText('User Type')).toBeInTheDocument();
      });

      const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
      fireEvent.click(userTypeButton);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Internal' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Customer' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Vendor' })).toBeInTheDocument();
      });
    });

    it('should show vendor dropdown when vendor type is selected', async () => {
      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
        fireEvent.click(userTypeButton);
      });

      const vendorOption = screen.getByRole('option', { name: 'Vendor' });
      fireEvent.click(vendorOption);

      await waitFor(() => {
        expect(screen.getByText('Vendor Organization')).toBeInTheDocument();
      });
    });

    it('should show customer dropdown when customer type is selected', async () => {
      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      await waitFor(() => {
        const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
        fireEvent.click(userTypeButton);
      });

      const customerOption = screen.getByRole('option', { name: 'Customer' });
      fireEvent.click(customerOption);

      await waitFor(() => {
        expect(screen.getByText('Customer Organization')).toBeInTheDocument();
      });
    });
  });

  describe('Vendor User Permission Restrictions', () => {
    it('should restrict vendor users to only fulfillment permission', async () => {
      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Select vendor user type
      await waitFor(() => {
        const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
        fireEvent.click(userTypeButton);
      });

      const vendorOption = screen.getByRole('option', { name: 'Vendor' });
      fireEvent.click(vendorOption);

      // Wait for permissions to be updated
      await waitFor(() => {
        // Check that fulfillment is checked and enabled
        const fulfillmentCheckbox = screen.getByRole('checkbox', { name: /fulfillment/i });
        expect(fulfillmentCheckbox).toBeChecked();
        expect(fulfillmentCheckbox).not.toBeDisabled();

        // Check that other permissions are unchecked and disabled
        const userAdminCheckbox = screen.getByRole('checkbox', { name: /user admin/i });
        expect(userAdminCheckbox).not.toBeChecked();
        expect(userAdminCheckbox).toBeDisabled();

        const globalConfigCheckbox = screen.getByRole('checkbox', { name: /global config/i });
        expect(globalConfigCheckbox).not.toBeChecked();
        expect(globalConfigCheckbox).toBeDisabled();

        const customerConfigCheckbox = screen.getByRole('checkbox', { name: /customer config/i });
        expect(customerConfigCheckbox).not.toBeChecked();
        expect(customerConfigCheckbox).toBeDisabled();

        const vendorsCheckbox = screen.getByRole('checkbox', { name: /vendors/i });
        expect(vendorsCheckbox).not.toBeChecked();
        expect(vendorsCheckbox).toBeDisabled();
      });
    });

    it('should enable all permissions when switching from vendor to internal', async () => {
      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // First select vendor
      await waitFor(() => {
        const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
        fireEvent.click(userTypeButton);
      });

      fireEvent.click(screen.getByRole('option', { name: 'Vendor' }));

      // Verify vendor restrictions are applied
      await waitFor(() => {
        const userAdminCheckbox = screen.getByRole('checkbox', { name: /user admin/i });
        expect(userAdminCheckbox).toBeDisabled();
      });

      // Switch back to internal
      await waitFor(() => {
        const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
        fireEvent.click(userTypeButton);
      });

      fireEvent.click(screen.getByRole('option', { name: 'Internal' }));

      // Verify all permissions are now enabled
      await waitFor(() => {
        const userAdminCheckbox = screen.getByRole('checkbox', { name: /user admin/i });
        expect(userAdminCheckbox).not.toBeDisabled();

        const globalConfigCheckbox = screen.getByRole('checkbox', { name: /global config/i });
        expect(globalConfigCheckbox).not.toBeDisabled();

        const customerConfigCheckbox = screen.getByRole('checkbox', { name: /customer config/i });
        expect(customerConfigCheckbox).not.toBeDisabled();

        const vendorsCheckbox = screen.getByRole('checkbox', { name: /vendors/i });
        expect(vendorsCheckbox).not.toBeDisabled();

        const fulfillmentCheckbox = screen.getByRole('checkbox', { name: /fulfillment/i });
        expect(fulfillmentCheckbox).not.toBeDisabled();
      });
    });
  });

  describe('Editing Existing Users', () => {
    it('should load existing internal user data correctly', async () => {
      render(
        <UserForm
          user={mockInternalUser}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Check form fields are populated
        expect(screen.getByDisplayValue('internal@example.com')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('Internal');
        expect(screen.getByRole('textbox', { name: /last name/i })).toHaveValue('User');

        // Check permissions are set correctly
        const userAdminCheckbox = screen.getByRole('checkbox', { name: /user admin/i });
        expect(userAdminCheckbox).toBeChecked();

        const globalConfigCheckbox = screen.getByRole('checkbox', { name: /global config/i });
        expect(globalConfigCheckbox).toBeChecked();
      });
    });

    it('should load existing vendor user data correctly', async () => {
      render(
        <UserForm
          user={mockVendorUser}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Check form fields are populated
        expect(screen.getByDisplayValue('vendor@example.com')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('Vendor');
        expect(screen.getByRole('textbox', { name: /last name/i })).toHaveValue('User');

        // Check vendor organization dropdown is shown
        expect(screen.getByText('Vendor Organization')).toBeInTheDocument();

        // Check only fulfillment permission is enabled and checked
        const fulfillmentCheckbox = screen.getByRole('checkbox', { name: /fulfillment/i });
        expect(fulfillmentCheckbox).toBeChecked();

        // Check other permissions are disabled
        const userAdminCheckbox = screen.getByRole('checkbox', { name: /user admin/i });
        expect(userAdminCheckbox).toBeDisabled();
      });
    });

    it('should load existing customer user data correctly', async () => {
      render(
        <UserForm
          user={mockCustomerUser}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        // Check form fields are populated
        expect(screen.getByDisplayValue('customer@example.com')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('Customer');
        expect(screen.getByRole('textbox', { name: /last name/i })).toHaveValue('User');

        // Check customer organization dropdown is shown
        expect(screen.getByText('Customer Organization')).toBeInTheDocument();

        // Check customer_config permission is checked
        const customerConfigCheckbox = screen.getByRole('checkbox', { name: /customer config/i });
        expect(customerConfigCheckbox).toBeChecked();
      });
    });
  });

  describe('Form Submission', () => {
    it('should create vendor user with correct data structure', async () => {
      // Mock the form submission call specifically
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/vendors')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockVendors)
          });
        }
        if (url.includes('/api/customers')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCustomers)
          });
        }
        if (url === '/api/users') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'new-vendor-user' })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      render(
        <UserForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );

      // Fill in form
      await waitFor(() => {
        fireEvent.change(screen.getByRole('textbox', { name: /email/i }), {
          target: { value: 'newvendor@example.com' }
        });
      });

      // Select vendor type
      const userTypeButton = screen.getByRole('combobox', { name: /user type/i });
      fireEvent.click(userTypeButton);
      fireEvent.click(screen.getByRole('option', { name: 'Vendor' }));

      // Fill password
      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create user/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"userType":"vendor"')
        }));
      });
    });
  });
});