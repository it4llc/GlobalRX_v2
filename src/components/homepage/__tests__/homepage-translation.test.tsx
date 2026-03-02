// /GlobalRX_v2/src/components/homepage/__tests__/homepage-translation.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HomepageContent } from '../homepage-content';

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>
}));

// Mock translation hook
const mockTranslations = vi.fn();
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: mockTranslations,
    locale: 'en-US'
  })
}));

// Mock auth utils
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

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, className }: any) => <button className={className}>{children}</button>
}));

import {
  canManageUsers,
  canManageCustomers,
  canManageVendors,
  canAccessFulfillment,
  canAccessGlobalConfig,
  isInternalUser,
  isVendorUser
} from '@/lib/auth-utils';

const mockCanAccessFulfillment = vi.mocked(canAccessFulfillment);
const mockCanManageVendors = vi.mocked(canManageVendors);
const mockIsInternalUser = vi.mocked(isInternalUser);
const mockIsVendorUser = vi.mocked(isVendorUser);
const mockCanManageUsers = vi.mocked(canManageUsers);
const mockCanManageCustomers = vi.mocked(canManageCustomers);
const mockCanAccessGlobalConfig = vi.mocked(canAccessGlobalConfig);

describe('HomepageContent Translation Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug: Fulfillment module shows raw translation keys', () => {
    beforeEach(() => {
      // Setup user with fulfillment permission
      mockIsInternalUser.mockReturnValue(true);
      mockCanAccessFulfillment.mockReturnValue(true);
      mockCanManageVendors.mockReturnValue(true);
      mockCanManageUsers.mockReturnValue(true);
      mockCanManageCustomers.mockReturnValue(true);
      mockCanAccessGlobalConfig.mockReturnValue(true);
    });

    it('should display raw translation keys for fulfillment module (CURRENT BUG)', () => {
      const mockUser = { email: 'admin@example.com', permissions: {} };

      // Simulate current bug: missing translations return the key
      mockTranslations.mockImplementation((key: string) => {
        if (key === 'module.fulfillment.title') return key; // Missing
        if (key === 'module.fulfillment.description') return key; // Missing
        if (key === 'module.fulfillment.button') return key; // Missing
        // Other modules work fine
        if (key === 'module.userAdmin.title') return 'User Administration';
        if (key === 'module.userAdmin.description') return 'Manage users and their permissions';
        return key;
      });

      render(<HomepageContent user={mockUser} />);

      // BUG: These show raw keys instead of translated text
      expect(screen.getByText('module.fulfillment.title')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.description')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.button')).toBeInTheDocument();

      // Other modules work correctly
      expect(screen.getByText('User Administration')).toBeInTheDocument();
    });
  });

  describe('Expected behavior after fix', () => {
    beforeEach(() => {
      mockIsInternalUser.mockReturnValue(true);
      mockCanAccessFulfillment.mockReturnValue(true);
      mockCanManageVendors.mockReturnValue(true);
      mockCanManageUsers.mockReturnValue(true);
      mockCanManageCustomers.mockReturnValue(true);
      mockCanAccessGlobalConfig.mockReturnValue(true);
    });

    it('should display proper translated text for fulfillment module', () => {
      const mockUser = { email: 'admin@example.com', permissions: {} };

      // After fix: all translations work
      mockTranslations.mockImplementation((key: string) => {
        const translations: Record<string, string> = {
          'module.fulfillment.title': 'Order Fulfillment',
          'module.fulfillment.description': 'Process and manage order fulfillment',
          'module.fulfillment.button': 'View Orders',
          'module.userAdmin.title': 'User Administration',
          'module.userAdmin.description': 'Manage users and their permissions',
          'module.userAdmin.button': 'Manage Users',
          'module.vendorManagement.title': 'Vendor Management',
          'module.vendorManagement.description': 'Manage vendor organizations',
          'module.vendorManagement.button': 'Manage Vendors'
        };
        return translations[key] || key;
      });

      render(<HomepageContent user={mockUser} />);

      // After fix: Fulfillment module shows proper translations
      expect(screen.getByText('Order Fulfillment')).toBeInTheDocument();
      expect(screen.getByText('Process and manage order fulfillment')).toBeInTheDocument();
      expect(screen.getByText('View Orders')).toBeInTheDocument();

      // Should NOT show raw keys
      expect(screen.queryByText('module.fulfillment.title')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.description')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.button')).not.toBeInTheDocument();
    });

    it('should request the correct translation keys', () => {
      const mockUser = { email: 'admin@example.com', permissions: {} };
      mockTranslations.mockReturnValue('translated');

      render(<HomepageContent user={mockUser} />);

      // Verify correct keys are being requested
      expect(mockTranslations).toHaveBeenCalledWith('module.fulfillment.title');
      expect(mockTranslations).toHaveBeenCalledWith('module.fulfillment.description');
      expect(mockTranslations).toHaveBeenCalledWith('module.fulfillment.button');
    });
  });

  describe('Vendor-specific fulfillment display', () => {
    it('should show translated fulfillment module for vendor users', () => {
      const mockUser = { email: 'vendor@example.com', permissions: { fulfillment: true } };

      // Setup vendor permissions
      mockIsVendorUser.mockReturnValue(true);
      mockIsInternalUser.mockReturnValue(false);
      mockCanAccessFulfillment.mockReturnValue(true);
      mockCanManageVendors.mockReturnValue(false);
      mockCanManageUsers.mockReturnValue(false);
      mockCanManageCustomers.mockReturnValue(false);
      mockCanAccessGlobalConfig.mockReturnValue(false);

      // Setup translations
      mockTranslations.mockImplementation((key: string) => {
        const translations: Record<string, string> = {
          'module.fulfillment.title': 'Order Fulfillment',
          'module.fulfillment.description': 'Process and manage order fulfillment',
          'module.fulfillment.button': 'View Orders',
          'app.welcome.title': 'Welcome to GlobalRx',
          'app.welcome.description': 'A comprehensive platform for global screening'
        };
        return translations[key] || key;
      });

      render(<HomepageContent user={mockUser} />);

      // Vendor should see properly translated fulfillment module
      expect(screen.getByText('Order Fulfillment')).toBeInTheDocument();
      expect(screen.getByText('Process and manage order fulfillment')).toBeInTheDocument();
      expect(screen.getByText('View Orders')).toBeInTheDocument();

      // Should NOT see admin modules
      expect(screen.queryByText('User Administration')).not.toBeInTheDocument();
      expect(screen.queryByText('Vendor Management')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty translation values gracefully', () => {
      const mockUser = { email: 'admin@example.com', permissions: {} };
      mockCanAccessFulfillment.mockReturnValue(true);

      mockTranslations.mockImplementation((key: string) => {
        if (key === 'module.fulfillment.title') return ''; // Empty
        if (key === 'module.fulfillment.description') return '   '; // Whitespace
        if (key === 'module.fulfillment.button') return null as any; // Null
        return key;
      });

      // Should not crash with empty/invalid translations
      expect(() => render(<HomepageContent user={mockUser} />)).not.toThrow();
    });

    it('should not show fulfillment module for users without permission', () => {
      const mockUser = { email: 'limited@example.com', permissions: {} };

      // User has no fulfillment permission
      mockCanAccessFulfillment.mockReturnValue(false);
      mockIsInternalUser.mockReturnValue(true);

      mockTranslations.mockReturnValue('translated');

      render(<HomepageContent user={mockUser} />);

      // Should not call fulfillment translations if user lacks permission
      expect(mockTranslations).not.toHaveBeenCalledWith('module.fulfillment.title');
      expect(mockTranslations).not.toHaveBeenCalledWith('module.fulfillment.description');
      expect(mockTranslations).not.toHaveBeenCalledWith('module.fulfillment.button');
    });
  });

  describe('Unauthenticated user view', () => {
    it('should not show fulfillment module for unauthenticated users', () => {
      mockTranslations.mockImplementation((key: string) => {
        const translations: Record<string, string> = {
          'app.welcome.title': 'Welcome to GlobalRx',
          'app.welcome.description': 'A comprehensive platform for global screening',
          'app.welcome.signin': 'Please sign in using the button in the header to access the platform.'
        };
        return translations[key] || key;
      });

      // Render without user (unauthenticated)
      render(<HomepageContent user={null} />);

      // Should show welcome message
      expect(screen.getByText('Welcome to GlobalRx')).toBeInTheDocument();
      expect(screen.getByText('Please sign in using the button in the header to access the platform.')).toBeInTheDocument();

      // Should NOT show any modules including fulfillment
      expect(mockTranslations).not.toHaveBeenCalledWith('module.fulfillment.title');
      expect(screen.queryByText('Order Fulfillment')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.title')).not.toBeInTheDocument();
    });
  });
});