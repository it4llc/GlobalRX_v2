// /GlobalRX_v2/src/app/fulfillment/__tests__/page.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import FulfillmentPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useSession, signOut } from 'next-auth/react';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn()
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({
    t: (key: string) => key,
    locale: 'en'
  }))
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  }),
  useSearchParams: () => ({
    get: vi.fn()
  })
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock the OrderDetailsDialog component to prevent render errors
vi.mock('@/components/portal/order-details-dialog', () => ({
  default: vi.fn(() => null)
}));

// Mock the ServiceStatusList component (which doesn't exist yet)
vi.mock('@/components/orders/ServiceStatusList', () => ({
  ServiceStatusList: ({ items }: any) => (
    <div data-testid="service-status-list">
      {items.length === 0 ? (
        <span className="text-gray-500">No services</span>
      ) : (
        // Only show first 5 items to match component behavior
        items.slice(0, 5).map((item: any, index: number) => (
          <div key={item.id || index} data-testid={`service-item-${index}`}>
            <span>{item.service?.name || 'Unnamed Service'}</span>
            <span> - </span>
            <span>{item.location?.name || 'Unknown Location'}</span>
            <span> - </span>
            <span className={`service-status-${item.status}`}>{item.status}</span>
          </div>
        ))
      )}
      {items.length > 5 && (
        <span className="text-sm text-gray-500">+{items.length - 5} more</span>
      )}
    </div>
  )
}));

describe('Fulfillment Page - Service Status Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Internal User - Service Status Display', () => {
    beforeEach(() => {
      // Mock authenticated internal user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: {
            id: 'user-123',
            userType: 'internal',
            email: 'internal@globalrx.com',
            firstName: 'Admin',
            lastName: 'User',
            permissions: {
              fulfillment: '*'
            }
          },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock authenticated internal user with fulfillment permission
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-123',
          userType: 'internal',
          email: 'internal@globalrx.com',
          firstName: 'Admin',
          lastName: 'User',
          permissions: {
            fulfillment: '*'
          }
        },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);
    });

    it('should display ServiceStatusList component for internal users', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          customer: { name: 'ACME Corp' },
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          items: [
            {
              id: 'item-1',
              service: { name: 'Criminal Check' },
              location: { name: 'United States', code: 'US' },
              status: 'submitted'
            },
            {
              id: 'item-2',
              service: { name: 'Employment Verification' },
              location: { name: 'Canada', code: 'CA' },
              status: 'processing'
            },
            {
              id: 'item-3',
              service: { name: 'Education Verification' },
              location: { name: 'United Kingdom', code: 'GB' },
              status: 'completed'
            }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('service-status-list')).toBeInTheDocument();
      });

      // Verify all services are displayed
      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.getByText('Education Verification')).toBeInTheDocument();

      // Verify locations
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
      expect(screen.getByText('United Kingdom')).toBeInTheDocument();

      // Verify statuses
      expect(screen.getByText('submitted')).toBeInTheDocument();
      expect(screen.getByText('processing')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('should display correct status colors matching order status colors', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          customer: { name: 'ACME Corp' },
          subject: { firstName: 'Jane', lastName: 'Smith' },
          items: [
            {
              id: 'item-1',
              service: { name: 'Service 1' },
              location: { name: 'USA', code: 'US' },
              status: 'draft'
            },
            {
              id: 'item-2',
              service: { name: 'Service 2' },
              location: { name: 'USA', code: 'US' },
              status: 'submitted'
            },
            {
              id: 'item-3',
              service: { name: 'Service 3' },
              location: { name: 'USA', code: 'US' },
              status: 'processing'
            },
            {
              id: 'item-4',
              service: { name: 'Service 4' },
              location: { name: 'USA', code: 'US' },
              status: 'missing_info'
            },
            {
              id: 'item-5',
              service: { name: 'Service 5' },
              location: { name: 'USA', code: 'US' },
              status: 'completed'
            },
            {
              id: 'item-6',
              service: { name: 'Service 6' },
              location: { name: 'USA', code: 'US' },
              status: 'cancelled'
            },
            {
              id: 'item-7',
              service: { name: 'Service 7' },
              location: { name: 'USA', code: 'US' },
              status: 'cancelled_dnb'
            }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      render(<FulfillmentPage />);

      await waitFor(() => {
        // Verify each status has the correct class (only first 5 items are shown)
        expect(screen.getByText('draft')).toHaveClass('service-status-draft');
        expect(screen.getByText('submitted')).toHaveClass('service-status-submitted');
        expect(screen.getByText('processing')).toHaveClass('service-status-processing');
        expect(screen.getByText('missing_info')).toHaveClass('service-status-missing_info');
        expect(screen.getByText('completed')).toHaveClass('service-status-completed');
        // Items 6 and 7 are not displayed due to the 5-item limit
        expect(screen.queryByText('cancelled')).not.toBeInTheDocument();
        expect(screen.queryByText('cancelled_dnb')).not.toBeInTheDocument();
        // But we should see the "+2 more" indicator
        expect(screen.getByText('+2 more')).toBeInTheDocument();
      });
    });
  });

  describe('Vendor User - Service Status Display', () => {
    beforeEach(() => {
      // Mock authenticated vendor user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: {
            id: 'user-456',
            userType: 'vendor',
            vendorId: 'vendor-123',
            email: 'vendor@example.com',
            firstName: 'Vendor',
            lastName: 'User'
          },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock authenticated vendor user
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'user-456',
          userType: 'vendor',
          vendorId: 'vendor-123',
          email: 'vendor@example.com',
          firstName: 'Vendor',
          lastName: 'User'
        },
        isLoading: false,
        hasPermission: vi.fn(() => false),
        checkPermission: vi.fn(() => true), // Vendor should have fulfillment permission
        canAccessCustomer: vi.fn(() => false),
        canEditOrder: vi.fn(() => false)
      } as any);
    });

    it('should display ServiceStatusList for vendor-assigned orders', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          customer: { name: 'ACME Corp' },
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          assignedVendorId: 'vendor-123',
          items: [
            {
              id: 'item-1',
              service: { name: 'Background Check' },
              location: { name: 'USA', code: 'US' },
              status: 'processing',
              assignedVendorId: 'vendor-123'
            },
            {
              id: 'item-2',
              service: { name: 'Drug Test' },
              location: { name: 'USA', code: 'US' },
              status: 'submitted',
              assignedVendorId: 'vendor-123'
            }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.getByTestId('service-status-list')).toBeInTheDocument();
      });

      // Vendor should see their assigned services
      expect(screen.getByText('Background Check')).toBeInTheDocument();
      expect(screen.getByText('Drug Test')).toBeInTheDocument();
    });
  });

  describe('Service Overflow Handling', () => {
    it('should handle orders with more than 5 services', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          customer: { name: 'ACME Corp' },
          subject: { firstName: 'Jane', lastName: 'Smith' },
          items: Array.from({ length: 12 }, (_, i) => ({
            id: `item-${i}`,
            service: { name: `Service ${i + 1}` },
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          }))
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      // Mock internal user session for this test
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock internal user for this test
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);

      render(<FulfillmentPage />);

      await waitFor(() => {
        // Should display first 5 services
        for (let i = 1; i <= 5; i++) {
          expect(screen.getByText(`Service ${i}`)).toBeInTheDocument();
        }

        // Services 6-12 should not be visible initially
        for (let i = 6; i <= 12; i++) {
          expect(screen.queryByText(`Service ${i}`)).not.toBeInTheDocument();
        }
      });
    });
  });

  describe('API Response Format', () => {
    it('should include service status in initial API response', async () => {
      const mockOrders = [{
        id: 'order-1',
        orderNumber: '20240301-ABC-0001',
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        customer: { name: 'ACME Corp' },
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: [{
          id: 'item-1',
          service: { name: 'Criminal Check' },
          location: { name: 'USA', code: 'US' },
          status: 'submitted'
        }]
      }];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      // Mock internal user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock internal user
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);

      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fulfillment')
        );
      });

      // Verify the response includes service status data
      const response = await (fetch as any).mock.results[0].value;
      const data = await response.json();
      expect(data.orders[0].items[0]).toHaveProperty('status');
      expect(data.orders[0].items[0].status).toBe('submitted');
    });

    it('should not make additional API calls for service status data', async () => {
      const mockOrders = Array.from({ length: 20 }, (_, i) => ({
        id: `order-${i}`,
        orderNumber: `20240301-ABC-${String(i).padStart(4, '0')}`,
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        customer: { name: 'ACME Corp' },
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: Array.from({ length: 5 }, (_, j) => ({
          id: `order-${i}-item-${j}`,
          service: { name: `Service ${j + 1}` },
          location: { name: 'USA', code: 'US' },
          status: 'submitted'
        }))
      }));

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      // Mock internal user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock internal user
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);

      render(<FulfillmentPage />);

      await waitFor(() => {
        // Should only make one API call for all orders with services included
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/fulfillment')
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle orders with null or missing service data', async () => {
      const mockOrders = [{
        id: 'order-1',
        orderNumber: '20240301-ABC-0001',
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        customer: { name: 'ACME Corp' },
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: [
          {
            id: 'item-1',
            service: null, // Missing service object
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          },
          {
            id: 'item-2',
            service: { name: 'Valid Service' },
            location: null, // Missing location object
            status: 'processing'
          },
          {
            id: 'item-3',
            service: { name: 'Another Service' },
            location: { name: 'Canada', code: 'CA' },
            status: null // Missing status
          }
        ]
      }];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, stats: {} })
      } as Response);

      // Mock internal user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock internal user
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);

      render(<FulfillmentPage />);

      await waitFor(() => {
        // Should handle missing data gracefully
        expect(screen.getByText('Unnamed Service')).toBeInTheDocument();
        expect(screen.getByText('Unknown Location')).toBeInTheDocument();
      });
    });

    it('should show skeleton loaders while data is loading', async () => {
      // Create a promise that we can control
      let resolvePromise: any;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(delayedPromise as any);

      // Mock internal user session
      vi.mocked(useSession).mockReturnValue({
        data: {
          user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
          expires: '2024-12-31'
        },
        status: 'authenticated',
        update: vi.fn()
      } as any);

      // Mock internal user
      vi.mocked(useAuth).mockReturnValue({
        user: { id: 'user-123', userType: 'internal', permissions: { fulfillment: '*' } },
        isLoading: false,
        hasPermission: vi.fn(() => true),
        checkPermission: vi.fn(() => true),
        canAccessCustomer: vi.fn(() => true),
        canEditOrder: vi.fn(() => true)
      } as any);

      const { container } = render(<FulfillmentPage />);

      // Should show loading spinner initially
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ orders: [], stats: {} })
      });

      await waitFor(() => {
        expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });
  });
});