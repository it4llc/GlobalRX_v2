// REGRESSION TEST: proves bug fix for admin users unable to create comments in fulfillment section
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useServiceComments } from '../useServiceComments';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
vi.mock('@/contexts/AuthContext');

// Mock fetch globally
global.fetch = vi.fn();

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useServiceComments - Admin User Comment Creation Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  // REGRESSION TEST: proves bug fix for admin users unable to create comments
  it('should allow admin users to create comments', () => {
    // Arrange: Set up an admin user with proper permissions
    const mockAdminUser = {
      id: 'admin-123',
      email: 'admin@globalrx.com',
      userType: 'admin',
      permissions: {
        fulfillment: { manage: true }
      }
    };

    (useAuth as any).mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true
    });

    // Act: Render the hook with a service ID
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'background-check', 'SUBMITTED')
    );

    // Assert: Admin users SHOULD be able to create comments
    // This test currently FAILS because the bug prevents admin users from creating comments
    expect(result.current.canCreateComment()).toBe(true);
  });

  // Test for internal users (should already work)
  it('should allow internal users to create comments', () => {
    // Arrange: Set up an internal user
    const mockInternalUser = {
      id: 'internal-456',
      email: 'internal@globalrx.com',
      userType: 'internal',
      permissions: {
        fulfillment: { manage: true }
      }
    };

    (useAuth as any).mockReturnValue({
      user: mockInternalUser,
      isAuthenticated: true
    });

    // Act: Render the hook
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'background-check', 'SUBMITTED')
    );

    // Assert: Internal users should be able to create comments
    expect(result.current.canCreateComment()).toBe(true);
  });

  // Test for vendor users (should already work)
  it('should allow vendor users to create comments', () => {
    // Arrange: Set up a vendor user
    const mockVendorUser = {
      id: 'vendor-789',
      email: 'vendor@external.com',
      userType: 'vendor',
      vendorId: 'vendor-company-123',
      permissions: {}
    };

    (useAuth as any).mockReturnValue({
      user: mockVendorUser,
      isAuthenticated: true
    });

    // Act: Render the hook
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'drug-test', 'PROCESSING')
    );

    // Assert: Vendor users should be able to create comments
    expect(result.current.canCreateComment()).toBe(true);
  });

  // Test for customer users (should NOT be able to create comments)
  it('should NOT allow customer users to create comments', () => {
    // Arrange: Set up a customer user
    const mockCustomerUser = {
      id: 'customer-111',
      email: 'customer@client.com',
      userType: 'customer',
      customerId: 'customer-company-456',
      permissions: {}
    };

    (useAuth as any).mockReturnValue({
      user: mockCustomerUser,
      isAuthenticated: true
    });

    // Act: Render the hook
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'education-verification', 'COMPLETED')
    );

    // Assert: Customer users should NOT be able to create comments
    expect(result.current.canCreateComment()).toBe(false);
  });

  // Test for unauthenticated users
  it('should NOT allow unauthenticated users to create comments', () => {
    // Arrange: No authenticated user
    (useAuth as any).mockReturnValue({
      user: null,
      isAuthenticated: false
    });

    // Act: Render the hook
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'background-check', 'DRAFT')
    );

    // Assert: Unauthenticated users should NOT be able to create comments
    expect(result.current.canCreateComment()).toBe(false);
  });

  // Edge case: User with unknown userType
  it('should NOT allow users with unknown userType to create comments', () => {
    // Arrange: User with an unexpected userType
    const mockUnknownUser = {
      id: 'unknown-999',
      email: 'unknown@test.com',
      userType: 'superuser', // Not a recognized type
      permissions: {}
    };

    (useAuth as any).mockReturnValue({
      user: mockUnknownUser,
      isAuthenticated: true
    });

    // Act: Render the hook
    const { result } = renderHook(() =>
      useServiceComments('service-123', undefined, 'background-check', 'SUBMITTED')
    );

    // Assert: Unknown user types should NOT be able to create comments
    expect(result.current.canCreateComment()).toBe(false);
  });

  // Test for permission consistency across all admin operations
  describe('Admin user permissions consistency', () => {
    beforeEach(() => {
      const mockAdminUser = {
        id: 'admin-123',
        email: 'admin@globalrx.com',
        userType: 'admin',
        permissions: {
          fulfillment: { manage: true }
        }
      };

      (useAuth as any).mockReturnValue({
        user: mockAdminUser,
        isAuthenticated: true
      });
    });

    it('admin users should have consistent permissions for all comment operations', () => {
      const { result } = renderHook(() =>
        useServiceComments('service-123', undefined, 'background-check', 'SUBMITTED')
      );

      // Admin users should be able to perform all operations (same as internal users):
      expect(result.current.canCreateComment()).toBe(true); // Fixed - admin can create
      expect(result.current.canEditComment('comment-123')).toBe(true); // Fixed - admin can edit
      expect(result.current.canDeleteComment('comment-123')).toBe(true); // Fixed - admin can delete

      // Admin users now have consistent permissions with internal users across all operations
    });
  });
});