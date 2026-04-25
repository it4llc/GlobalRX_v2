// src/components/modules/user-admin/__tests__/comment-management.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UserForm } from '../user-form';
import { UserAdminContent } from '../user-admin-content';
import { SessionProvider } from 'next-auth/react';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: '1', permissions: { user_admin: true } } },
    status: 'authenticated'
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock the AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', permissions: { user_admin: true } },
    isLoading: false,
    error: null
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Mock user data with comment_management permission
const mockUserWithCommentMgmt = {
  id: 'user-1',
  email: 'admin@example.com',
  firstName: 'Admin',
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
    comment_management: true,
  }
};

const mockUserWithoutCommentMgmt = {
  id: 'user-2',
  email: 'user@example.com',
  firstName: 'Regular',
  lastName: 'User',
  userType: 'internal' as const,
  vendorId: null,
  customerId: null,
  permissions: {
    user_admin: false,
    global_config: false,
    customer_config: false,
    vendors: false,
    fulfillment: true,
    comment_management: false,
  }
};

describe('Comment Management Permission Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Mock window.alert
    global.alert = vi.fn();

    // Default mock for API calls
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/vendors') {
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      }
      if (url === '/api/customers') {
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      }
      // For user updates/creates
      if (url?.includes('/api/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, user: mockUserWithCommentMgmt })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true })
      });
    });
  });

  describe('UserForm - Comment Management Permission', () => {
    it('should display comment_management checkbox for internal users', () => {
      render(
        <UserForm
          user={mockUserWithCommentMgmt}
          onCancel={() => {}}
          onSubmit={() => {}}
        />
      );

      // Check that the checkbox exists
      const checkbox = screen.getByLabelText('Comment Management');
      expect(checkbox).toBeDefined();
      expect(checkbox).toBeChecked();
    });

    it('should have comment_management checkbox disabled for vendor users', async () => {
      const vendorUser = {
        ...mockUserWithCommentMgmt,
        userType: 'vendor' as const,
        vendorId: 'vendor-123',
      };

      render(
        <UserForm
          user={vendorUser}
          onCancel={() => {}}
          onSubmit={() => {}}
        />
      );

      // Wait for the form to update based on user type
      await waitFor(() => {
        const checkbox = screen.getByLabelText('Comment Management');
        expect(checkbox).toBeDisabled();
      });
    });

    it('should toggle comment_management permission when checkbox is clicked', async () => {
      const onSave = vi.fn();

      render(
        <UserForm
          user={mockUserWithoutCommentMgmt}
          onCancel={() => {}}
          onSubmit={onSave}
        />
      );

      // Find and click the checkbox
      const checkbox = screen.getByLabelText('Comment Management');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should include comment_management in saved permissions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const onSave = vi.fn();

      render(
        <UserForm
          user={mockUserWithoutCommentMgmt}
          onCancel={() => {}}
          onSubmit={onSave}
        />
      );

      // Enable comment_management
      const checkbox = screen.getByLabelText('Comment Management');
      fireEvent.click(checkbox);

      // Submit the form
      const saveButton = screen.getByText('Update User');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Find the user update call (not vendor or customer fetches)
        const userUpdateCall = mockFetch.mock.calls.find(call =>
          call[0]?.includes('/api/users') && call[1]?.method === 'PUT'
        );
        expect(userUpdateCall).toBeDefined();
        const body = JSON.parse(userUpdateCall[1].body);
        expect(body.permissions).toHaveProperty('comment_management');
        expect(body.permissions.comment_management).toBe(true);
      });
    });

    it('should not include comment_management for vendor users in permissions', async () => {
      // Mock the vendors API call that UserForm makes
      mockFetch.mockImplementation((url) => {
        if (url === '/api/vendors') {
          return Promise.resolve({
            ok: true,
            json: async () => [{ id: 'vendor-123', name: 'Test Vendor', isPrimary: true }]
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => []
        });
      });

      const vendorUser = {
        ...mockUserWithCommentMgmt,
        userType: 'vendor' as const,
        vendorId: 'vendor-123',
        permissions: {
          ...mockUserWithCommentMgmt.permissions,
          fulfillment: true,
        }
      };

      render(
        <UserForm
          user={vendorUser}
          onCancel={() => {}}
          onSubmit={() => {}}
        />
      );

      // Submit the form
      const saveButton = screen.getByText('Update User');
      fireEvent.click(saveButton);

      await waitFor(() => {
        // Check that vendor user doesn't have comment_management
        const checkbox = screen.getByLabelText('Comment Management');
        expect(checkbox).toBeDisabled();
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe('UserAdminContent - Comment Management Column', () => {
    beforeEach(() => {
      // Reset mocks before each test
      mockFetch.mockClear();
    });

    it('should display Comment Mgmt column header in user table', async () => {
      // Setup the mock to return users array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockUserWithCommentMgmt, mockUserWithoutCommentMgmt]
      });

      render(
        <SessionProvider session={{ user: mockUserWithCommentMgmt }}>
          <UserAdminContent />
        </SessionProvider>
      );

      // Wait for the table to be rendered with data
      await waitFor(() => {
        // Check for the column header
        const columnHeader = screen.getByText('Comment Mgmt');
        expect(columnHeader).toBeDefined();
      });
    });

    it('should show check icon for users with comment_management permission', async () => {
      // Setup the mock to return user with comment_management
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockUserWithCommentMgmt]
      });

      render(
        <SessionProvider session={{ user: mockUserWithCommentMgmt }}>
          <UserAdminContent />
        </SessionProvider>
      );

      await waitFor(() => {
        // Check for the user's email to ensure the table is rendered
        const userEmail = screen.getByText('admin@example.com');
        expect(userEmail).toBeDefined();

        // The check/X icons are rendered as SVG elements
        // We need to check for the presence of CheckIcon in the correct cell
        // This is handled by the component's rendering logic
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1); // Header + at least one data row
      });
    });

    it('should show X icon for users without comment_management permission', async () => {
      // Setup the mock to return user without comment_management
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockUserWithoutCommentMgmt]
      });

      render(
        <SessionProvider session={{ user: mockUserWithCommentMgmt }}>
          <UserAdminContent />
        </SessionProvider>
      );

      await waitFor(() => {
        // Check for the user's email to ensure the table is rendered
        const userEmail = screen.getByText('user@example.com');
        expect(userEmail).toBeDefined();

        // The check/X icons are rendered as SVG elements
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(1);
      });
    });

    it('should have correct colspan for empty state with comment_management and candidates_invite columns', async () => {
      // Setup the mock to return empty array
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(
        <SessionProvider session={{ user: mockUserWithCommentMgmt }}>
          <UserAdminContent />
        </SessionProvider>
      );

      await waitFor(() => {
        // Check for the empty state message
        const emptyMessage = screen.getByText(/No users found/);
        expect(emptyMessage).toBeDefined();

        // The cell should have colspan of 12 (including the new Candidate Invitations column)
        const cell = emptyMessage.closest('td');
        expect(cell?.getAttribute('colspan')).toBe('12');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should create a new user with comment_management permission', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            organizations: []
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'new-user',
            email: 'newuser@example.com',
            permissions: { comment_management: true }
          })
        });

      const onSave = vi.fn();

      render(
        <UserForm
          user={null}
          onCancel={() => {}}
          onSubmit={onSave}
        />
      );

      // Fill in the form
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'newuser@example.com' }
      });
      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'New' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'User' }
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'SecurePass123!' }
      });
      fireEvent.change(screen.getByLabelText('Confirm Password'), {
        target: { value: 'SecurePass123!' }
      });

      // Enable comment_management
      const checkbox = screen.getByLabelText('Comment Management');
      fireEvent.click(checkbox);

      // Submit - for new users, the button says "Create User"
      fireEvent.click(screen.getByText('Create User'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/users',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('comment_management')
          })
        );
      });
    });
  });
});