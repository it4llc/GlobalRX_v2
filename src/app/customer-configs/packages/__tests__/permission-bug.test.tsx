// REGRESSION TEST: proves bug fix for customer config permission consistency
// Bug: Packages page checks for "customers" permission but User Admin saves "customer_config"
// This test should FAIL before the fix and PASS after the fix

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CustomerPackagesPage from '../page';

// Mock the translation context
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock the auth context
const mockCheckPermission = vi.fn();
const mockFetchWithAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    checkPermission: mockCheckPermission,
    fetchWithAuth: mockFetchWithAuth
  })
}));

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>
}));

// Mock UI components
vi.mock('@/components/ui/loading-indicator', () => ({
  LoadingIndicator: () => <div>Loading...</div>
}));

vi.mock('@/components/ui/alert-box', () => ({
  AlertBox: ({ title, message, type, action }: any) => (
    <div data-type={type}>
      <h3>{title}</h3>
      <p>{message}</p>
      {action && <div>{action}</div>}
    </div>
  )
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  )
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>
}));

vi.mock('lucide-react', () => ({
  PlusCircle: () => <span>PlusCircle</span>,
  Package: () => <span>Package</span>
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  errorToLogMeta: vi.fn()
}));

describe('Customer Packages Page Permission Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockReturnValue(false);
  });

  describe('Permission checking regression tests', () => {
    // REGRESSION TEST: This is the key test that proves the bug
    it('REGRESSION: should show packages when user has customer_config permission (currently fails)', async () => {
      // Setup: User has customer_config permission with view (what User Admin saves)
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        if (resource === 'customer_config' && (!action || action === 'view')) {
          return true;
        }
        return false;
      });

      // Mock successful API response
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Alpha Company',
            disabled: false
          },
          {
            id: 'customer2',
            name: 'Beta Corp',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // CRITICAL ASSERTION: User with customer_config permission should see customers
      // This currently fails because component checks for "customers" permission
      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('Alpha Company')).toBeInTheDocument();
      expect(screen.getByText('Beta Corp')).toBeInTheDocument();
      expect(screen.getByText('Customer Packages')).toBeInTheDocument();
    });

    // This test shows current wrong behavior
    it('works with user having "customer_config" permission (correct key)', async () => {
      // User has the CORRECT permission key
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        if (resource === 'customer_config' && action === 'view') {
          return true; // User has the correct permission
        }
        return false;
      });

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Test Customer',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Works correctly with the right permission key
      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });

    it('should show no permission message when user lacks permissions', async () => {
      // User has unrelated permission
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        return resource === 'fulfillment';
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show permission denied message
      expect(screen.getByText('common.noPermission')).toBeInTheDocument();
      expect(screen.getByText('common.contactAdmin')).toBeInTheDocument();
    });
  });

  describe('Customer data rendering', () => {
    beforeEach(() => {
      // Set up permission check to pass
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        return resource === 'customer_config' && (!action || action === 'view');
      });
    });

    it('should filter out disabled customers', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Active Customer',
            disabled: false
          },
          {
            id: 'customer2',
            name: 'Disabled Customer',
            disabled: true
          },
          {
            id: 'customer3',
            name: 'Another Active',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show active customers
      expect(screen.getByText('Active Customer')).toBeInTheDocument();
      expect(screen.getByText('Another Active')).toBeInTheDocument();

      // Should NOT show disabled customer
      expect(screen.queryByText('Disabled Customer')).not.toBeInTheDocument();
    });

    it('should group customers alphabetically', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Bravo Company',
            disabled: false
          },
          {
            id: 'customer2',
            name: 'Alpha Corp',
            disabled: false
          },
          {
            id: 'customer3',
            name: 'Charlie Inc',
            disabled: false
          },
          {
            id: 'customer4',
            name: 'Beta Systems',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Should show alphabetical grouping headers
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();

      // Customers should be under correct groups
      expect(screen.getByText('Alpha Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Systems')).toBeInTheDocument();
      expect(screen.getByText('Bravo Company')).toBeInTheDocument();
      expect(screen.getByText('Charlie Inc')).toBeInTheDocument();
    });

    it('should handle paginated API response format', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'customer1',
              name: 'Test Customer',
              disabled: false
            }
          ],
          meta: {
            total: 1,
            page: 1
          }
        })
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });

    it('should handle alternative paginated response format', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customers: [
            {
              id: 'customer1',
              name: 'Another Customer',
              disabled: false
            }
          ],
          totalCount: 1
        })
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Another Customer')).toBeInTheDocument();
    });

    it('should show empty state when no customers exist', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('No Customers Available')).toBeInTheDocument();
      expect(screen.getByText(/There are no active customers available/)).toBeInTheDocument();
    });
  });

  describe('API error handling', () => {
    beforeEach(() => {
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        return resource === 'customer_config';
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' })
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Error Loading Customers')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch customers')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should handle network errors', async () => {
      mockFetchWithAuth.mockRejectedValueOnce(new Error('Network error'));

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Error Loading Customers')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  describe('Permission format variations', () => {
    it('REGRESSION: should work with customer_config wildcard permission', async () => {
      mockCheckPermission.mockImplementation((resource: string) => {
        return resource === 'customer_config'; // Wildcard means all actions
      });

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Test Customer',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });

    it('REGRESSION: should work with customer_config object permission', async () => {
      mockCheckPermission.mockImplementation((resource: string, action?: string) => {
        if (resource === 'customer_config' && (!action || action === 'view')) {
          return true;
        }
        return false;
      });

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer1',
            name: 'Test Customer',
            disabled: false
          }
        ]
      });

      render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.queryByText('common.noPermission')).not.toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
    });
  });

  describe('Customer links', () => {
    beforeEach(() => {
      mockCheckPermission.mockImplementation((resource: string) => {
        return resource === 'customer_config';
      });
    });

    it('should create correct links to customer package pages', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'customer-abc',
            name: 'ABC Company',
            disabled: false
          },
          {
            id: 'customer-xyz',
            name: 'XYZ Corp',
            disabled: false
          }
        ]
      });

      const { container } = render(<CustomerPackagesPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Check that links are created with correct hrefs
      const links = container.querySelectorAll('a');
      const hrefs = Array.from(links).map(link => link.getAttribute('href'));

      expect(hrefs).toContain('/customer-configs/customer-abc/packages');
      expect(hrefs).toContain('/customer-configs/customer-xyz/packages');
    });
  });
});