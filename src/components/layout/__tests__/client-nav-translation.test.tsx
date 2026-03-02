// /GlobalRX_v2/src/components/layout/__tests__/client-nav-translation.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientNav } from '../client-nav';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>
}));

// Mock dependencies
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/vendors'
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
  signIn: vi.fn()
}));

// Mock the TranslationContext to test actual translation behavior
const mockTranslations = vi.fn();
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: mockTranslations
  })
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/lib/auth-utils', () => ({
  getUserType: vi.fn(() => 'internal'),
  isInternalUser: vi.fn(() => true),
  isVendorUser: vi.fn(() => false),
  isCustomerUser: vi.fn(() => false),
  canManageUsers: vi.fn(() => true),
  canManageCustomers: vi.fn(() => true),
  canManageVendors: vi.fn(() => true),
  canAccessFulfillment: vi.fn(() => true),
  canAccessGlobalConfig: vi.fn(() => true),
}));

// Mock UI components
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

const mockUseSession = vi.mocked(useSession);
const mockUseAuth = vi.mocked(useAuth);

describe('ClientNav Translation Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup authenticated user with full permissions
    mockUseSession.mockReturnValue({
      data: {
        user: { email: 'admin@example.com' }
      },
      status: 'authenticated'
    } as any);

    mockUseAuth.mockReturnValue({
      hasPermission: () => true // Has all permissions
    } as any);
  });

  describe('Bug: Translation keys not being resolved', () => {
    it('should display raw translation key for vendorManagement when translation is missing (CURRENT BUG)', () => {
      // Simulate current bug: translation returns the key itself when not found
      mockTranslations.mockImplementation((key: string) => {
        // Missing translations return the key
        if (key === 'module.vendorManagement.title') return key;
        if (key === 'module.fulfillment.title') return key;
        // Other keys work fine
        if (key === 'module.userAdmin.title') return 'User Administration';
        return key;
      });

      render(<ClientNav />);

      // BUG: These show raw keys instead of translated text
      expect(screen.getByText('module.vendorManagement.title')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.title')).toBeInTheDocument();

      // These work correctly
      expect(screen.getByText('User Administration')).toBeInTheDocument();
    });
  });

  describe('Expected behavior after fix', () => {
    it('should display proper translated text for all navigation items', () => {
      // After fix: all translations resolve correctly
      mockTranslations.mockImplementation((key: string) => {
        const translations: Record<string, string> = {
          'module.userAdmin.title': 'User Administration',
          'module.globalConfig.title': 'Global Configurations',
          'module.customerConfig.title': 'Customer Configurations',
          'module.vendorManagement.title': 'Vendor Management', // Fixed key
          'module.fulfillment.title': 'Order Fulfillment', // New key added
          'common.styleGuide': 'Style Guide',
          'auth.logout': 'Logout',
          'common.home': 'Home'
        };
        return translations[key] || key;
      });

      render(<ClientNav />);

      // After fix: All navigation items should show proper text
      expect(screen.getByText('User Administration')).toBeInTheDocument();
      expect(screen.getByText('Global Configurations')).toBeInTheDocument();
      expect(screen.getByText('Customer Configurations')).toBeInTheDocument();
      expect(screen.getByText('Vendor Management')).toBeInTheDocument(); // Should work after fix
      expect(screen.getByText('Order Fulfillment')).toBeInTheDocument(); // Should work after fix
      expect(screen.getByText('Style Guide')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();

      // Should NOT show raw keys
      expect(screen.queryByText('module.vendorManagement.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.title')).not.toBeInTheDocument();
    });

    it('should handle translation key mapping correctly', () => {
      // Test that the component uses the correct keys
      mockTranslations.mockReturnValue('translated');

      render(<ClientNav />);

      // Verify the correct keys are being requested
      expect(mockTranslations).toHaveBeenCalledWith('module.vendorManagement.title');
      expect(mockTranslations).toHaveBeenCalledWith('module.fulfillment.title');

      // Should NOT be calling the old vendorAdmin key in navigation
      expect(mockTranslations).not.toHaveBeenCalledWith('module.vendorAdmin.title');
    });
  });

  describe('Translation fallback behavior', () => {
    it('should gracefully handle missing translations by showing the key', () => {
      // This is the current fallback behavior - return key if translation missing
      mockTranslations.mockImplementation((key: string) => key);

      render(<ClientNav />);

      // When translations are missing, keys are shown (current behavior)
      expect(screen.getByText('module.vendorManagement.title')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.title')).toBeInTheDocument();
    });

    it('should handle empty string translations', () => {
      mockTranslations.mockImplementation((key: string) => {
        if (key === 'module.vendorManagement.title') return ''; // Empty string
        if (key === 'module.fulfillment.title') return '   '; // Whitespace
        return key;
      });

      render(<ClientNav />);

      // Component should handle empty/whitespace translations
      // The actual behavior depends on implementation, but it shouldn't crash
      expect(() => render(<ClientNav />)).not.toThrow();
    });
  });

  describe('Vendor user sees correct fulfillment translation', () => {
    beforeEach(() => {
      // Setup vendor user
      mockUseSession.mockReturnValue({
        data: {
          user: { email: 'vendor@example.com' }
        },
        status: 'authenticated'
      } as any);

      mockUseAuth.mockReturnValue({
        hasPermission: (permission: string) => permission === 'fulfillment'
      } as any);

      // Mock auth utils for vendor
      const authUtils = require('@/lib/auth-utils');
      authUtils.getUserType.mockReturnValue('vendor');
      authUtils.isInternalUser.mockReturnValue(false);
      authUtils.isVendorUser.mockReturnValue(true);
      authUtils.canAccessFulfillment.mockReturnValue(true);
      authUtils.canManageVendors.mockReturnValue(false);
      authUtils.canManageUsers.mockReturnValue(false);
      authUtils.canManageCustomers.mockReturnValue(false);
      authUtils.canAccessGlobalConfig.mockReturnValue(false);
    });

    it('should show translated fulfillment title for vendor users', () => {
      mockTranslations.mockImplementation((key: string) => {
        if (key === 'module.fulfillment.title') return 'Order Fulfillment';
        if (key === 'common.styleGuide') return 'Style Guide';
        if (key === 'auth.logout') return 'Logout';
        return key;
      });

      render(<ClientNav />);

      // Vendor should see properly translated fulfillment link
      expect(screen.getByText('Order Fulfillment')).toBeInTheDocument();

      // Should NOT see admin links
      expect(screen.queryByText('module.vendorManagement.title')).not.toBeInTheDocument();
      expect(screen.queryByText('Vendor Management')).not.toBeInTheDocument();
    });
  });
});