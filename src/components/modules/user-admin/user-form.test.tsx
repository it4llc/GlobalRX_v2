// /GlobalRX_v2/src/components/modules/user-admin/user-form.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserForm } from './user-form';

// Mock fetch
global.fetch = vi.fn();

describe('UserForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful vendor and customer fetch responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/vendors')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'vendor-1', name: 'Vendor One', isPrimary: true },
            { id: 'vendor-2', name: 'Vendor Two', isPrimary: false }
          ])
        });
      }
      if (url.includes('/api/customers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 'customer-1', name: 'Customer One' },
            { id: 'customer-2', name: 'Customer Two' }
          ])
        });
      }
      // Default response for user creation/update
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userType: 'internal',
          permissions: {}
        })
      });
    });
  });

  describe('rendering', () => {
    it('should render all required form fields', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('First Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Last Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByLabelText('User Type')).toBeInTheDocument();
    });

    it('should render permission checkboxes', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByLabelText('User Admin')).toBeInTheDocument();
      expect(screen.getByLabelText('Global Config')).toBeInTheDocument();
      expect(screen.getByLabelText('Customer Config')).toBeInTheDocument();
      expect(screen.getByLabelText('Vendors')).toBeInTheDocument();
      expect(screen.getByLabelText('Fulfillment')).toBeInTheDocument();
      expect(screen.getByLabelText('Comment Management')).toBeInTheDocument();
      expect(screen.getByLabelText('Candidate Invitations')).toBeInTheDocument();
    });

    it('should render with existing user data when editing', () => {
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const existingUser = {
        id: 'user-123',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        userType: 'internal' as const,
        permissions: {
          user_admin: true,
          candidates: { invite: true }
        }
      };

      render(
        <UserForm
          user={existingUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      expect(screen.getByDisplayValue('existing@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Smith')).toBeInTheDocument();

      const userAdminCheckbox = screen.getByRole('checkbox', { name: 'User Admin' });
      expect(userAdminCheckbox).toHaveAttribute('aria-checked', 'true');

      const candidatesInviteCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });
      expect(candidatesInviteCheckbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should show vendor organization select when user type is vendor', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Initially vendor select should not be visible
      expect(screen.queryByLabelText('Vendor Organization')).not.toBeInTheDocument();

      // Click on User Type dropdown
      const userTypeSelect = screen.getByLabelText('User Type');
      await user.click(userTypeSelect);

      // Select vendor option (use role to avoid multiple matches)
      const vendorOption = await screen.findByRole('option', { name: 'Vendor' });
      await user.click(vendorOption);

      // Now vendor select should be visible
      await waitFor(() => {
        expect(screen.getByLabelText('Vendor Organization')).toBeInTheDocument();
      });
    });

    it('should show customer organization select when user type is customer', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Initially customer select should not be visible
      expect(screen.queryByLabelText('Customer Organization')).not.toBeInTheDocument();

      // Click on User Type dropdown
      const userTypeSelect = screen.getByLabelText('User Type');
      await user.click(userTypeSelect);

      // Select customer option (use role to avoid multiple matches)
      const customerOption = await screen.findByRole('option', { name: 'Customer' });
      await user.click(customerOption);

      // Now customer select should be visible
      await waitFor(() => {
        expect(screen.getByLabelText('Customer Organization')).toBeInTheDocument();
      });
    });
  });

  describe('validation', () => {
    it('should show alert when passwords do not match', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      // Mock window.alert
      // window.alert is already mocked globally
      const alertMock = window.alert as any;

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in form
      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'differentpassword');

      // Click submit
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      expect(alertMock).toHaveBeenCalledWith('Passwords do not match');
      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('permission handling', () => {
    it('should disable non-fulfillment permissions for vendor users', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Change to vendor user type
      const userTypeSelect = screen.getByLabelText('User Type');
      await user.click(userTypeSelect);
      const vendorOption = await screen.findByRole('option', { name: 'Vendor' });
      await user.click(vendorOption);

      // Check that only fulfillment is enabled
      await waitFor(() => {
        const userAdminCheckbox = screen.getByRole('checkbox', { name: 'User Admin' });
        const globalConfigCheckbox = screen.getByRole('checkbox', { name: 'Global Config' });
        const customerConfigCheckbox = screen.getByRole('checkbox', { name: 'Customer Config' });
        const vendorsCheckbox = screen.getByRole('checkbox', { name: 'Vendors' });
        const fulfillmentCheckbox = screen.getByRole('checkbox', { name: 'Fulfillment' });
        const commentMgmtCheckbox = screen.getByRole('checkbox', { name: 'Comment Management' });
        const candidatesInviteCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });

        expect(userAdminCheckbox).toBeDisabled();
        expect(globalConfigCheckbox).toBeDisabled();
        expect(customerConfigCheckbox).toBeDisabled();
        expect(vendorsCheckbox).toBeDisabled();
        expect(fulfillmentCheckbox).not.toBeDisabled();
        expect(commentMgmtCheckbox).toBeDisabled();
        expect(candidatesInviteCheckbox).toBeDisabled();

        // Fulfillment should be automatically checked for vendor users
        expect(fulfillmentCheckbox).toHaveAttribute('aria-checked', 'true');
      });
    });

    it('should handle candidates.invite permission checkbox', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      const candidatesCheckbox = screen.getByRole('checkbox', { name: 'Candidate Invitations' });
      expect(candidatesCheckbox).toBeInTheDocument();
      expect(candidatesCheckbox).toHaveAttribute('aria-checked', 'false');

      // Check the checkbox
      await user.click(candidatesCheckbox);
      expect(candidatesCheckbox).toHaveAttribute('aria-checked', 'true');

      // Uncheck it
      await user.click(candidatesCheckbox);
      expect(candidatesCheckbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('submission', () => {
    it('should call onSubmit with correct data when creating new user', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in the form
      await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
      await user.type(screen.getByLabelText('First Name'), 'John');
      await user.type(screen.getByLabelText('Last Name'), 'Doe');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      // Check candidates.invite permission
      await user.click(screen.getByLabelText('Candidate Invitations'));

      // Submit the form
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      // Wait for the API call to complete
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });

      // Check that fetch was called with correct data
      expect(global.fetch).toHaveBeenCalledWith('/api/users', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('newuser@example.com')
      }));

      // Check that the body includes candidates.invite permission
      const callArgs = (global.fetch as any).mock.calls.find((call: any[]) =>
        call[0] === '/api/users'
      );
      const body = JSON.parse(callArgs[1].body);
      expect(body.permissions.candidates).toEqual({ invite: true });
    });

    it('should call onSubmit with correct data when updating existing user', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      const existingUser = {
        id: 'user-123',
        email: 'existing@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        userType: 'internal' as const,
        permissions: {}
      };

      render(
        <UserForm
          user={existingUser}
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Update some fields
      await user.clear(screen.getByLabelText('First Name'));
      await user.type(screen.getByLabelText('First Name'), 'Janet');

      // Check candidates.invite permission
      await user.click(screen.getByLabelText('Candidate Invitations'));

      // Submit the form
      const submitButton = screen.getByText('Update User');
      await user.click(submitButton);

      // Wait for the API call to complete
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled();
      });

      // Check that fetch was called with PUT method
      expect(global.fetch).toHaveBeenCalledWith('/api/users/user-123', expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }));

      // Check that the body includes candidates.invite permission
      const callArgs = (global.fetch as any).mock.calls.find((call: any[]) =>
        call[0] === '/api/users/user-123'
      );
      const body = JSON.parse(callArgs[1].body);
      expect(body.permissions.candidates).toEqual({ invite: true });
      expect(body.firstName).toBe('Janet');
    });

    it('should show error alert when API call fails', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();
      // window.alert is already mocked globally
      const alertMock = window.alert as any;
      alertMock.mockClear();

      // Mock fetch to return an error
      (global.fetch as any).mockImplementation(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: 'Email already exists' })
        })
      );

      render(
        <UserForm
          onSubmit={mockSubmit}
          onCancel={mockCancel}
        />
      );

      // Fill in the form
      await user.type(screen.getByLabelText('Email'), 'duplicate@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      // Submit the form
      const submitButton = screen.getByText('Create User');
      await user.click(submitButton);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Error creating user: Email already exists');
      });

      expect(mockSubmit).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockSubmit = vi.fn();
      const mockCancel = vi.fn();

      render(
        <UserForm
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