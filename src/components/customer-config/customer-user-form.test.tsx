// /GlobalRX_v2/src/components/customer-config/customer-user-form.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerUserForm } from './customer-user-form';

// Mock fetch
global.fetch = vi.fn();

describe('CustomerUserForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful user creation response by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {
          orders: { view: true, create: true },
          candidates: { invite: false }
        }
      })
    });
  });

  describe('rendering', () => {
    it('should render all required form fields', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByLabelText('Email *')).toBeInTheDocument();
      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Password *')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password *')).toBeInTheDocument();
    });

    it('should render all permission checkboxes', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByLabelText('View Orders')).toBeInTheDocument();
      expect(screen.getByLabelText('Create Orders')).toBeInTheDocument();
      expect(screen.getByLabelText('Edit/Cancel Orders')).toBeInTheDocument();
      expect(screen.getByLabelText('Manage Customer Users')).toBeInTheDocument();
      expect(screen.getByLabelText('Candidate Invitations')).toBeInTheDocument();
    });

    it('should have default permissions checked', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Default permissions should be view and create orders
      const viewOrdersCheckbox = screen.getByRole('checkbox', { name: 'View Orders' });
      const createOrdersCheckbox = screen.getByRole('checkbox', { name: 'Create Orders' });
      const editOrdersCheckbox = screen.getByRole('checkbox', { name: 'Edit/Cancel Orders' });
      const manageUsersCheckbox = screen.getByRole('checkbox', { name: 'Manage Customer Users' });
      const inviteCandidatesCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });

      expect(viewOrdersCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(createOrdersCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(editOrdersCheckbox).toHaveAttribute('aria-checked', 'false');
      expect(manageUsersCheckbox).toHaveAttribute('aria-checked', 'false');
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should display permission section headers', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByText('Order Permissions')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Candidate Management')).toBeInTheDocument();
      expect(screen.getByText("This user will only have access to this customer's data.")).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('should show alert when email is missing', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Try to submit without email
      await user.type(screen.getByLabelText('Password *'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password *'), 'password123');

      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Email and password are required');
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should show alert when passwords do not match', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      await user.type(screen.getByLabelText('Email *'), 'test@example.com');
      await user.type(screen.getByLabelText('Password *'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password *'), 'different123');

      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Passwords do not match');
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should show alert when password is too short', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      await user.type(screen.getByLabelText('Email *'), 'test@example.com');
      await user.type(screen.getByLabelText('Password *'), 'short');
      await user.type(screen.getByLabelText('Confirm Password *'), 'short');

      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Password must be at least 8 characters long');
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('permission handling', () => {
    it('should toggle permission checkboxes', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      const inviteCandidatesCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });

      // Initially unchecked
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'false');

      // Check it
      await user.click(inviteCandidatesCheckbox);
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'true');

      // Uncheck it
      await user.click(inviteCandidatesCheckbox);
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should handle multiple permission toggles', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      const editOrdersCheckbox = screen.getByRole('checkbox', { name: 'Edit/Cancel Orders' });
      const manageUsersCheckbox = screen.getByRole('checkbox', { name: 'Manage Customer Users' });
      const inviteCandidatesCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });

      // Toggle multiple permissions
      await user.click(editOrdersCheckbox);
      await user.click(manageUsersCheckbox);
      await user.click(inviteCandidatesCheckbox);

      expect(editOrdersCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(manageUsersCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('submission', () => {
    it('should call API with correct data including candidates.invite permission', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in the form
      await user.type(screen.getByLabelText('Email *'), 'newuser@example.com');
      await user.type(screen.getByLabelText('First Name'), 'John');
      await user.type(screen.getByLabelText('Last Name'), 'Doe');
      await user.type(screen.getByLabelText('Password *'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password *'), 'password123');

      // Check candidates.invite permission
      await user.click(screen.getByLabelText('Candidate Invitations'));

      // Submit the form
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      // Wait for the submission to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/customers/customer-1/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        });
      });

      // Check the request body
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.email).toBe('newuser@example.com');
      expect(body.firstName).toBe('John');
      expect(body.lastName).toBe('Doe');
      expect(body.password).toBe('password123');
      expect(body.permissions.orders.view).toBe(true);
      expect(body.permissions.orders.create).toBe(true);
      expect(body.permissions.orders.edit).toBe(false);
      expect(body.permissions.users.manage).toBe(false);
      expect(body.permissions.candidates.invite).toBe(true);

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('should handle API error gracefully', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Mock API error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'User already exists' })
      });

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in the form
      await user.type(screen.getByLabelText('Email *'), 'duplicate@example.com');
      await user.type(screen.getByLabelText('Password *'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password *'), 'password123');

      // Submit the form
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Error creating user: User already exists');
      });

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      // Delay the API response
      (global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 'user-1',
            email: 'test@example.com'
          })
        }), 100))
      );

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in the form
      await user.type(screen.getByLabelText('Email *'), 'test@example.com');
      await user.type(screen.getByLabelText('Password *'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password *'), 'password123');

      // Submit the form
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating...')).toBeInTheDocument();

      // Wait for completion
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('cancel', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserForm
          customerId="customer-1"
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockCancel).toHaveBeenCalled();
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });
});