// /GlobalRX_v2/src/components/modules/user-admin/user-admin-content.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserAdminContent } from './user-admin-content';

// Mock dependencies
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn()
  },
  errorToLogMeta: vi.fn(error => ({ message: error?.message || 'Unknown error' }))
}));

// Mock useAuth
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 'current-user',
      email: 'current@example.com',
      userType: 'internal',
      permissions: { user_admin: true }
    },
    isLoading: false
  }))
}));

// Mock UserForm to avoid its complex dependencies
vi.mock('@/components/modules/user-admin/user-form', () => ({
  UserForm: vi.fn(({ onSubmit, onCancel, user }) => (
    <div data-testid="user-form-mock">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        defaultValue={user?.email || ''}
        data-testid="email-input"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        data-testid="password-input"
      />

      <label htmlFor="confirm-password">Confirm Password</label>
      <input
        id="confirm-password"
        name="confirmPassword"
        type="password"
        data-testid="confirm-password-input"
      />

      <label htmlFor="firstName">First Name</label>
      <input
        id="firstName"
        name="firstName"
        defaultValue={user?.firstName || ''}
        data-testid="firstName-input"
      />

      <button onClick={() => {
        const formData = {
          id: user?.id || 'new-user',
          email: user?.id ? user.email : 'newuser@example.com',
          firstName: user?.id ? 'Updated' : 'New',
          lastName: user?.id ? 'Admin' : 'User',
          userType: user?.userType || 'internal',
          permissions: user?.permissions || {}
        };
        onSubmit(formData);
      }}>
        {user ? 'Update User' : 'Create User'}
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ))
}));

// Mock fetch
global.fetch = vi.fn();

// Mock window.alert
global.alert = vi.fn();

describe('UserAdminContent', () => {
  const mockUsers = [
    {
      id: 'user-1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      userType: 'internal',
      permissions: {
        user_admin: true,
        candidates: { invite: true }
      }
    },
    {
      id: 'user-2',
      email: 'customer@example.com',
      firstName: 'Customer',
      lastName: 'User',
      userType: 'customer',
      customerId: 'customer-1',
      permissions: {
        candidate_workflow: true,
        candidates: { invite: false }
      }
    },
    {
      id: 'user-3',
      email: 'vendor@example.com',
      firstName: 'Vendor',
      lastName: 'User',
      userType: 'vendor',
      vendorId: 'vendor-1',
      permissions: {
        fulfillment: true
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch of users by default
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/users') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      }
      // Default response for other calls
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  describe('rendering', () => {
    it('should render user table with all columns', async () => {
      render(<UserAdminContent />);

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Check column headers (use role to get table header specifically)
      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('User Type')).toBeInTheDocument();
      expect(screen.getByText('Organization')).toBeInTheDocument();
      expect(screen.getByText('User Admin')).toBeInTheDocument();
      expect(screen.getByText('Global Config')).toBeInTheDocument();
      expect(screen.getByText('Customer Config')).toBeInTheDocument();
      expect(screen.getByText('Vendors')).toBeInTheDocument();
      expect(screen.getByText('Fulfillment')).toBeInTheDocument();
      expect(screen.getByText('Comment Mgmt')).toBeInTheDocument();
      expect(screen.getByText('Candidate Invitations')).toBeInTheDocument();
    });

    it('should display user data correctly', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Check user data
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getByText('Customer User')).toBeInTheDocument();
      expect(screen.getByText('Vendor User')).toBeInTheDocument();

      // Check user types are displayed with correct styling
      const internalBadge = screen.getByText('internal');
      expect(internalBadge).toHaveClass('bg-blue-100', 'text-blue-800');

      const customerBadge = screen.getByText('customer');
      expect(customerBadge).toHaveClass('bg-green-100', 'text-green-800');

      const vendorBadge = screen.getByText('vendor');
      expect(vendorBadge).toHaveClass('bg-purple-100', 'text-purple-800');
    });

    it('should display permission icons correctly', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Find the row for admin user
      const adminRow = screen.getByText('admin@example.com').closest('tr');
      if (!adminRow) throw new Error('Admin row not found');

      // Check that user_admin permission shows a check
      const cells = within(adminRow).getAllByRole('cell');

      // The 6th cell (0-indexed: 5) should be User Admin
      // The 12th cell (0-indexed: 11) should be Candidate Invitations
      // These should have check icons (green color)
      const userAdminCell = cells[5];
      const candidatesInviteCell = cells[11];

      const userAdminIcon = userAdminCell.querySelector('svg');
      expect(userAdminIcon).toHaveStyle({ color: '#10b981' });

      const candidatesInviteIcon = candidatesInviteCell.querySelector('svg');
      expect(candidatesInviteIcon).toHaveClass('text-emerald-500');
    });

    it('should display organization names correctly', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Check organizations are displayed
      expect(screen.getByText('GlobalRx')).toBeInTheDocument(); // Internal user
      expect(screen.getByText('Customer Org')).toBeInTheDocument(); // Customer user
      expect(screen.getByText('Vendor Org')).toBeInTheDocument(); // Vendor user
    });
  });

  describe('loading state', () => {
    it('should show loading message while fetching users', () => {
      // Mock a delayed response
      (global.fetch as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        }), 100))
      );

      render(<UserAdminContent />);

      expect(screen.getByText('Loading users...')).toBeInTheDocument();
    });

    it('should hide loading message after users are loaded', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when fetch fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display error message when API returns error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Forbidden' })
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText(/Forbidden/)).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('should show empty message when no users exist', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('No users found. Click "Add New User" to create one.')).toBeInTheDocument();
      });
    });
  });

  describe('add user dialog', () => {
    it('should open add user dialog when Add New User button is clicked', async () => {
      const user = userEvent.setup();

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add New User');
      await user.click(addButton);

      // Dialog should be visible
      expect(screen.getByText('Create a new user account with specific permissions.')).toBeInTheDocument();

      // UserForm should be rendered (check for mock)
      expect(screen.getByTestId('user-form-mock')).toBeInTheDocument();
    });

    it('should close add user dialog when cancel is clicked', async () => {
      const user = userEvent.setup();

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open dialog
      const addButton = screen.getByText('Add New User');
      await user.click(addButton);

      // Click cancel
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      // Dialog should be closed
      expect(screen.queryByText('Create a new user account with specific permissions.')).not.toBeInTheDocument();
    });

    it('should add new user to the list when created successfully', async () => {
      const user = userEvent.setup();

      // Mock the POST request for creating user
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url === '/api/users' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'new-user',
              email: 'newuser@example.com',
              firstName: 'New',
              lastName: 'User',
              userType: 'internal',
              permissions: {}
            })
          });
        }
        // Return users for initial load
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open dialog
      const addButton = screen.getByText('Add New User');
      await user.click(addButton);

      // Fill in form (minimal required fields)
      await user.type(screen.getByLabelText('Email'), 'newuser@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      // Submit
      const createButton = screen.getByText('Create User');
      await user.click(createButton);

      // New user should appear in the list
      await waitFor(() => {
        expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
      });
    });
  });

  describe('edit user dialog', () => {
    it('should open edit dialog when Edit action is clicked', async () => {
      const user = userEvent.setup();

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Find and click the action dropdown for the first user
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);

      // Click Edit option
      const editOption = await screen.findByText('Edit');
      await user.click(editOption);

      // Edit dialog should be visible
      expect(screen.getByText('Update user information and permissions.')).toBeInTheDocument();

      // Form should be populated with existing data
      expect(screen.getByDisplayValue('admin@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Admin')).toBeInTheDocument();
    });

    it('should update user in list when edited successfully', async () => {
      const user = userEvent.setup();

      // Mock the PUT request for updating user
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url === '/api/users/user-1' && options?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: 'user-1',
              email: 'admin@example.com',
              firstName: 'Updated',
              lastName: 'Admin',
              userType: 'internal',
              permissions: {
                user_admin: true,
                candidates: { invite: true }
              }
            })
          });
        }
        // Return users for initial load
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open edit dialog
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);
      const editOption = await screen.findByText('Edit');
      await user.click(editOption);

      // Update first name
      const firstNameField = screen.getByLabelText('First Name');
      await user.clear(firstNameField);
      await user.type(firstNameField, 'Updated');

      // Submit
      const updateButton = screen.getByText('Update User');
      await user.click(updateButton);

      // Updated name should appear in the list
      await waitFor(() => {
        expect(screen.getByText('Updated Admin')).toBeInTheDocument();
      });
    });
  });

  describe('delete user', () => {
    it('should show confirmation dialog when Delete action is clicked', async () => {
      const user = userEvent.setup();

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Find and click the action dropdown for the first user
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);

      // Click Delete option
      const deleteOption = await screen.findByText('Delete');
      await user.click(deleteOption);

      // Confirmation dialog should be visible
      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete the user admin@example.com/)).toBeInTheDocument();
    });

    it('should remove user from list when deleted successfully', async () => {
      const user = userEvent.setup();

      // Mock the DELETE request
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url === '/api/users/user-1' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({})
          });
        }
        // Return users for initial load
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open delete confirmation
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);
      const deleteOption = await screen.findByText('Delete');
      await user.click(deleteOption);

      // Confirm deletion
      const confirmButton = screen.getByText('Delete User');
      await user.click(confirmButton);

      // User should be removed from the list
      await waitFor(() => {
        expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
      });
    });

    it('should close confirmation dialog when cancel is clicked', async () => {
      const user = userEvent.setup();

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open delete confirmation
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);
      const deleteOption = await screen.findByText('Delete');
      await user.click(deleteOption);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Dialog should be closed but user still in list
      await waitFor(() => {
        expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });
    });

    it('should show alert when delete fails', async () => {
      const user = userEvent.setup();
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Mock the DELETE request to fail
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url === '/api/users/user-1' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'Cannot delete user with active orders' })
          });
        }
        // Return users for initial load
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      });

      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Open delete confirmation
      const actionButtons = screen.getAllByRole('button', { name: /actions/i });
      await user.click(actionButtons[0]);
      const deleteOption = await screen.findByText('Delete');
      await user.click(deleteOption);

      // Confirm deletion
      const confirmButton = screen.getByText('Delete User');
      await user.click(confirmButton);

      // Error alert should be shown
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Error deleting user: Cannot delete user with active orders');
      });

      // User should still be in the list
      expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    });
  });

  describe('candidates.invite permission display', () => {
    it('should show check icon for users with candidates.invite permission', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument();
      });

      // Find the row for admin user (has candidates.invite = true)
      const adminRow = screen.getByText('admin@example.com').closest('tr');
      if (!adminRow) throw new Error('Admin row not found');

      // Find the Candidate Invitations cell (last column)
      const cells = within(adminRow).getAllByRole('cell');
      const candidateInviteCell = cells[cells.length - 1];

      // Should have a check icon with green color
      const checkIcon = candidateInviteCell.querySelector('svg');
      expect(checkIcon).toHaveClass('text-emerald-500');
    });

    it('should show X icon for users without candidates.invite permission', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('customer@example.com')).toBeInTheDocument();
      });

      // Find the row for customer user (has candidates.invite = false)
      const customerRow = screen.getByText('customer@example.com').closest('tr');
      if (!customerRow) throw new Error('Customer row not found');

      // Find the Candidate Invitations cell (last column)
      const cells = within(customerRow).getAllByRole('cell');
      const candidateInviteCell = cells[cells.length - 1];

      // Should have an X icon with red color
      const xIcon = candidateInviteCell.querySelector('svg');
      expect(xIcon).toHaveClass('text-red-500');
    });

    it('should show X icon for vendor users (never have candidates.invite)', async () => {
      render(<UserAdminContent />);

      await waitFor(() => {
        expect(screen.getByText('vendor@example.com')).toBeInTheDocument();
      });

      // Find the row for vendor user
      const vendorRow = screen.getByText('vendor@example.com').closest('tr');
      if (!vendorRow) throw new Error('Vendor row not found');

      // Find the Candidate Invitations cell (last column)
      const cells = within(vendorRow).getAllByRole('cell');
      const candidateInviteCell = cells[cells.length - 1];

      // Should have an X icon with red color (vendors never have this permission)
      const xIcon = candidateInviteCell.querySelector('svg');
      expect(xIcon).toHaveClass('text-red-500');
    });
  });
});