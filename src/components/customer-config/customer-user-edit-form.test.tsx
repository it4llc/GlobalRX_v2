// /GlobalRX_v2/src/components/customer-config/customer-user-edit-form.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerUserEditForm } from './customer-user-edit-form';

// Mock fetch
global.fetch = vi.fn();

describe('CustomerUserEditForm', () => {
  const mockUser = {
    id: 'user-123',
    email: 'existing@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    permissions: {
      orders: { view: true, create: true, edit: false },
      users: { manage: false },
      candidates: { invite: false }
    },
    userType: 'customer' as const
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful user update response by default
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ...mockUser,
        firstName: 'Updated',
        permissions: {
          orders: { view: true, create: true, edit: true },
          users: { manage: false },
          candidates: { invite: true }
        }
      })
    });
  });

  describe('rendering', () => {
    it('should render all form fields with existing user data', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByDisplayValue('existing@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();

      // Password fields should be empty for editing
      const passwordField = screen.getByLabelText('New Password (leave blank to keep current)') as HTMLInputElement;
      expect(passwordField.value).toBe('');
    });

    it('should render permission checkboxes with existing permissions', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

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

    it('should handle user with candidates.invite permission already enabled', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const userWithInvitePermission = {
        ...mockUser,
        permissions: {
          ...mockUser.permissions,
          candidates: { invite: true }
        }
      };

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={userWithInvitePermission}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      const inviteCandidatesCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });
      expect(inviteCandidatesCheckbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('validation', () => {
    it('should show alert when email is removed', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      // window.alert is already mocked globally
      const alertMock = window.alert as any;

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Clear email field
      const emailField = screen.getByLabelText('Email *');
      await user.clear(emailField);

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Email is required');
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should allow submission without changing password', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Update only the first name
      const firstNameField = screen.getByLabelText('First Name');
      await user.clear(firstNameField);
      await user.type(firstNameField, 'Updated');

      // Submit without touching password fields
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Check that no password was sent
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.password).toBeUndefined();

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('should validate password match when changing password', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      // window.alert is already mocked globally
      const alertMock = window.alert as any;

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      await user.type(screen.getByLabelText('New Password (leave blank to keep current)'), 'newpassword123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'differentpassword');

      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Passwords do not match');
      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it('should validate password length when changing password', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      // window.alert is already mocked globally
      const alertMock = window.alert as any;

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      await user.type(screen.getByLabelText('New Password (leave blank to keep current)'), 'short');
      await user.type(screen.getByLabelText('Confirm New Password'), 'short');

      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Password must be at least 8 characters long');
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('permission updates', () => {
    it('should handle toggling candidates.invite permission on', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Toggle candidates.invite permission on
      const inviteCandidatesCheckbox = screen.getByLabelText('Candidate Invitations');
      await user.click(inviteCandidatesCheckbox);

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/customers/customer-1/users/user-123', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        });
      });

      // Check the request body
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.permissions.candidates.invite).toBe(true);

      expect(mockSubmit).toHaveBeenCalled();
    });

    it('should handle toggling candidates.invite permission off', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const userWithInvite = {
        ...mockUser,
        permissions: {
          ...mockUser.permissions,
          candidates: { invite: true }
        }
      };

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={userWithInvite}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Toggle candidates.invite permission off
      const inviteCandidatesCheckbox = screen.getByLabelText('Candidate Invitations');
      await user.click(inviteCandidatesCheckbox);

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Check the request body
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.permissions.candidates.invite).toBe(false);
    });

    it('should update multiple permissions at once', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Toggle multiple permissions
      await user.click(screen.getByLabelText('Edit/Cancel Orders'));
      await user.click(screen.getByLabelText('Manage Customer Users'));
      await user.click(screen.getByLabelText('Candidate Invitations'));

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Check the request body
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.permissions.orders.edit).toBe(true);
      expect(body.permissions.users.manage).toBe(true);
      expect(body.permissions.candidates.invite).toBe(true);
    });
  });

  describe('submission', () => {
    it('should update user with new password when provided', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Change password
      await user.type(screen.getByLabelText('New Password (leave blank to keep current)'), 'newpassword123');
      await user.type(screen.getByLabelText('Confirm New Password'), 'newpassword123');

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Check that password was included
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.password).toBe('newpassword123');
    });

    it('should handle API error gracefully', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      // window.alert is already mocked globally
      const alertMock = window.alert as any;

      // Mock API error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Email already in use' })
      });

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Update email
      const emailField = screen.getByLabelText('Email *');
      await user.clear(emailField);
      await user.type(emailField, 'duplicate@example.com');

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Error updating user: Email already in use');
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
          json: () => Promise.resolve(mockUser)
        }), 100))
      );

      render(
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Update a field
      const firstNameField = screen.getByLabelText('First Name');
      await user.clear(firstNameField);
      await user.type(firstNameField, 'Updated');

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Updating...')).toBeInTheDocument();

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
        <CustomerUserEditForm
          customerId="customer-1"
          user={mockUser}
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