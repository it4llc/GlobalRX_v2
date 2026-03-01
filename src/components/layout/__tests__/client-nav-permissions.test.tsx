// src/components/layout/__tests__/client-nav-permissions.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientNav } from '../client-nav';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>
}));

// Mock all the dependencies
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/users'
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
  signIn: vi.fn()
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/lib/auth-utils', () => ({
  getUserType: vi.fn(),
  isInternalUser: vi.fn(),
  isVendorUser: vi.fn(),
  isCustomerUser: vi.fn(),
  canManageUsers: vi.fn(),
  canManageCustomers: vi.fn(),
  canManageVendors: vi.fn(),
  canAccessFulfillment: vi.fn(),
  canAccessGlobalConfig: vi.fn(),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}));

vi.mock('@/components/layout/language-selector', () => ({
  LanguageSelector: () => React.createElement('div', null, 'Language Selector')
}));

vi.mock('@/components/layout/ViewToggle', () => ({
  ViewToggle: () => React.createElement('div', null, 'View Toggle')
}));

import { useSession } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserType,
  isInternalUser,
  isVendorUser,
  isCustomerUser,
  canManageUsers,
  canManageCustomers,
  canManageVendors,
  canAccessFulfillment,
  canAccessGlobalConfig,
} from '@/lib/auth-utils';

const mockUseSession = vi.mocked(useSession);
const mockUseAuth = vi.mocked(useAuth);
const mockGetUserType = vi.mocked(getUserType);
const mockIsInternalUser = vi.mocked(isInternalUser);
const mockIsVendorUser = vi.mocked(isVendorUser);
const mockIsCustomerUser = vi.mocked(isCustomerUser);
const mockCanManageUsers = vi.mocked(canManageUsers);
const mockCanManageCustomers = vi.mocked(canManageCustomers);
const mockCanManageVendors = vi.mocked(canManageVendors);
const mockCanAccessFulfillment = vi.mocked(canAccessFulfillment);
const mockCanAccessGlobalConfig = vi.mocked(canAccessGlobalConfig);

describe('ClientNav Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Internal User with Full Permissions', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'admin@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: (permission: string) => true // Has all permissions
      } as any);

      // Mock auth utils for internal user with all permissions
      mockGetUserType.mockReturnValue('internal');
      mockIsInternalUser.mockReturnValue(true);
      mockIsVendorUser.mockReturnValue(false);
      mockIsCustomerUser.mockReturnValue(false);
      mockCanManageUsers.mockReturnValue(true);
      mockCanManageCustomers.mockReturnValue(true);
      mockCanManageVendors.mockReturnValue(true);
      mockCanAccessFulfillment.mockReturnValue(true);
      mockCanAccessGlobalConfig.mockReturnValue(true);
    });

    it('should show all admin navigation links for internal user with full permissions', () => {
      render(<ClientNav />);

      expect(screen.getByText('module.userAdmin.title')).toBeInTheDocument();
      expect(screen.getByText('module.globalConfig.title')).toBeInTheDocument();
      expect(screen.getByText('module.customerConfig.title')).toBeInTheDocument();
      expect(screen.getByText('module.vendorManagement.title')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.title')).toBeInTheDocument();
    });
  });

  describe('Vendor User with Only Fulfillment Permission', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'vendor@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: (permission: string) => permission === 'fulfillment' // Only fulfillment
      } as any);

      // Mock auth utils for vendor user with only fulfillment permission
      mockGetUserType.mockReturnValue('vendor');
      mockIsInternalUser.mockReturnValue(false);
      mockIsVendorUser.mockReturnValue(true);
      mockIsCustomerUser.mockReturnValue(false);
      mockCanManageUsers.mockReturnValue(false);
      mockCanManageCustomers.mockReturnValue(false);
      mockCanManageVendors.mockReturnValue(false);
      mockCanAccessFulfillment.mockReturnValue(true);
      mockCanAccessGlobalConfig.mockReturnValue(false);
    });

    it('should only show Orders link for vendor user', () => {
      render(<ClientNav />);

      // Should NOT see admin links
      expect(screen.queryByText('module.userAdmin.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.globalConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.customerConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.vendorManagement.title')).not.toBeInTheDocument();

      // Should see fulfillment and common links
      expect(screen.getByText('module.fulfillment.title')).toBeInTheDocument();
      expect(screen.getByText('common.styleGuide')).toBeInTheDocument();
      expect(screen.getByText('auth.logout')).toBeInTheDocument();
    });
  });

  describe('Customer User with No Admin Permissions', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'customer@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: () => false // No admin permissions
      } as any);

      // Mock auth utils for customer user with no admin permissions
      mockGetUserType.mockReturnValue('customer');
      mockIsInternalUser.mockReturnValue(false);
      mockIsVendorUser.mockReturnValue(false);
      mockIsCustomerUser.mockReturnValue(true);
      mockCanManageUsers.mockReturnValue(false);
      mockCanManageCustomers.mockReturnValue(false);
      mockCanManageVendors.mockReturnValue(false);
      mockCanAccessFulfillment.mockReturnValue(false);
      mockCanAccessGlobalConfig.mockReturnValue(false);
    });

    it('should only show common links for customer user', () => {
      render(<ClientNav />);

      // Should NOT see any admin links
      expect(screen.queryByText('module.userAdmin.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.globalConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.customerConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.vendorManagement.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.title')).not.toBeInTheDocument(); // Customer users don't have fulfillment

      // Should see only common links
      expect(screen.getByText('common.styleGuide')).toBeInTheDocument();
      expect(screen.getByText('auth.logout')).toBeInTheDocument();
    });
  });

  describe('Partial Permission Users', () => {
    it('should show only User Admin for user with user_admin permission', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'partial@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: (permission: string) => permission === 'user_admin'
      } as any);

      // Mock auth utils for user with only user_admin permission
      mockGetUserType.mockReturnValue('internal');
      mockIsInternalUser.mockReturnValue(true);
      mockIsVendorUser.mockReturnValue(false);
      mockIsCustomerUser.mockReturnValue(false);
      mockCanManageUsers.mockReturnValue(true);
      mockCanManageCustomers.mockReturnValue(false);
      mockCanManageVendors.mockReturnValue(false);
      mockCanAccessFulfillment.mockReturnValue(false);
      mockCanAccessGlobalConfig.mockReturnValue(false);

      render(<ClientNav />);

      expect(screen.getByText('module.userAdmin.title')).toBeInTheDocument();
      expect(screen.queryByText('module.globalConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.customerConfig.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.vendorManagement.title')).not.toBeInTheDocument();
    });

    it('should show User Admin and Vendor Management for user with global_config permission', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'global@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: (permission: string) => permission === 'global_config'
      } as any);

      // Mock auth utils for user with global_config permission
      mockGetUserType.mockReturnValue('internal');
      mockIsInternalUser.mockReturnValue(true);
      mockIsVendorUser.mockReturnValue(false);
      mockIsCustomerUser.mockReturnValue(false);
      mockCanManageUsers.mockReturnValue(true); // global_config includes user admin
      mockCanManageCustomers.mockReturnValue(false);
      mockCanManageVendors.mockReturnValue(true); // global_config includes vendor management
      mockCanAccessFulfillment.mockReturnValue(false);
      mockCanAccessGlobalConfig.mockReturnValue(true);

      render(<ClientNav />);

      expect(screen.getByText('module.userAdmin.title')).toBeInTheDocument(); // global_config includes user admin
      expect(screen.getByText('module.globalConfig.title')).toBeInTheDocument();
      expect(screen.getByText('module.vendorManagement.title')).toBeInTheDocument(); // global_config includes vendors
      expect(screen.queryByText('module.customerConfig.title')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated'
      } as any);

      mockUseAuth.mockReturnValue(null);
    });

    it('should only show login button for unauthenticated user', () => {
      render(<ClientNav />);

      // Should NOT see any admin or user links
      expect(screen.queryByText('module.userAdmin.title')).not.toBeInTheDocument();
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
      expect(screen.queryByText('auth.logout')).not.toBeInTheDocument();

      // Should see login and common elements
      expect(screen.getByText('auth.login')).toBeInTheDocument();
      expect(screen.getByText('common.home')).toBeInTheDocument();
    });
  });
});