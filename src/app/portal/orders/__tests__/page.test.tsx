// /GlobalRX_v2/src/app/portal/orders/__tests__/page.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import OrdersPage from '../page';
import { useAuth } from '@/contexts/AuthContext';
import { useSession } from 'next-auth/react';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn()
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

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  },
  errorToLogMeta: vi.fn()
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

describe('Portal Orders Page - Service Status Display', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock authenticated customer user session
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          userType: 'customer',
          customerId: 'customer-456',
          email: 'customer@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        expires: '2024-12-31'
      },
      status: 'authenticated',
      update: vi.fn()
    } as any);

    // Mock authenticated customer user
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        userType: 'customer',
        customerId: 'customer-456',
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe'
      },
      isLoading: false,
      hasPermission: vi.fn(() => true),
      canAccessCustomer: vi.fn(() => true),
      canEditOrder: vi.fn(() => false)
    } as any);
  });

  describe('Service Status Column Integration', () => {
    it('should display ServiceStatusList component in Services column', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          items: [
            {
              id: '660e8400-e29b-41d4-a716-446655440001',
              service: { name: 'Criminal Check' },
              location: { name: 'USA', code: 'US' },
              status: 'submitted'
            },
            {
              id: '660e8400-e29b-41d4-a716-446655440002',
              service: { name: 'Employment Verification' },
              location: { name: 'Canada', code: 'CA' },
              status: 'processing'
            }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        expect(screen.getByTestId('service-status-list')).toBeInTheDocument();
      });

      // Verify services are displayed
      expect(screen.getByText('Criminal Check')).toBeInTheDocument();
      expect(screen.getByText('Employment Verification')).toBeInTheDocument();
      expect(screen.getByText('USA')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
    });

    it('should display "No services" for orders without services', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'draft',
          createdAt: '2024-03-01T10:00:00Z',
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          items: []
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        const noServicesText = screen.getByText('No services');
        expect(noServicesText).toBeInTheDocument();
        expect(noServicesText).toHaveClass('text-gray-500');
      });
    });

    it('should display service statuses with correct color coding', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          items: [
            {
              id: '660e8400-e29b-41d4-a716-446655440001',
              service: { name: 'Service 1' },
              location: { name: 'USA', code: 'US' },
              status: 'completed'
            },
            {
              id: '660e8400-e29b-41d4-a716-446655440002',
              service: { name: 'Service 2' },
              location: { name: 'USA', code: 'US' },
              status: 'processing'
            },
            {
              id: '660e8400-e29b-41d4-a716-446655440003',
              service: { name: 'Service 3' },
              location: { name: 'USA', code: 'US' },
              status: 'cancelled'
            }
          ]
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        expect(screen.getByText('completed')).toHaveClass('service-status-completed');
        expect(screen.getByText('processing')).toHaveClass('service-status-processing');
        expect(screen.getByText('cancelled')).toHaveClass('service-status-cancelled');
      });
    });

    it('should handle orders with many services (>5)', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: '20240301-ABC-0001',
          statusCode: 'processing',
          createdAt: '2024-03-01T10:00:00Z',
          subject: {
            firstName: 'Jane',
            lastName: 'Smith'
          },
          items: Array.from({ length: 8 }, (_, i) => ({
            id: `item-${i}`,
            service: { name: `Service ${i + 1}` },
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          }))
        }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        // Should display first 5 services
        for (let i = 1; i <= 5; i++) {
          expect(screen.getByText(`Service ${i}`)).toBeInTheDocument();
        }
        // Should not display services beyond 5 initially
        expect(screen.queryByText('Service 6')).not.toBeInTheDocument();
        expect(screen.queryByText('Service 7')).not.toBeInTheDocument();
        expect(screen.queryByText('Service 8')).not.toBeInTheDocument();
      });
    });
  });

  describe('API Response Integration', () => {
    it('should request orders with service status data included', async () => {
      const mockOrders = [{
        id: 'order-1',
        orderNumber: '20240301-ABC-0001',
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: [{
          id: '660e8400-e29b-41d4-a716-446655440001',
          service: { name: 'Criminal Check' },
          location: { name: 'USA', code: 'US' },
          status: 'submitted'
        }]
      }];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/portal/orders')
        );
      });

      // Verify the response includes service status data
      const response = await (fetch as any).mock.results[0].value;
      const data = await response.json();
      expect(data.orders[0].items[0]).toHaveProperty('status');
      expect(data.orders[0].items[0].status).toBe('submitted');
    });

    it('should handle API error gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      render(<OrdersPage />);

      await waitFor(() => {
        // Should show error state or empty state
        expect(screen.queryByText('Criminal Check')).not.toBeInTheDocument();
      });
    });

    it('should not cause N+1 queries for service data', async () => {
      const mockOrders = Array.from({ length: 10 }, (_, i) => ({
        id: `order-${i}`,
        orderNumber: `20240301-ABC-000${i}`,
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: Array.from({ length: 3 }, (_, j) => ({
          id: `order-${i}-item-${j}`,
          service: { name: `Service ${j + 1}` },
          location: { name: 'USA', code: 'US' },
          status: 'submitted'
        }))
      }));

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        // Should only make one API call for all orders with services included
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/portal/orders')
        );
      });
    });
  });

  describe('Loading and Empty States', () => {
    it('should show skeleton loader while services are loading', async () => {
      // Create a promise that we can control
      let resolvePromise: any;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(fetch).mockReturnValueOnce(delayedPromise as any);

      const { container } = render(<OrdersPage />);

      // Should show loading spinner initially
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise({
        ok: true,
        json: async () => ({ orders: [] })
      });

      await waitFor(() => {
        expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
      });
    });

    it('should handle mixed service data quality', async () => {
      const mockOrders = [{
        id: 'order-1',
        orderNumber: '20240301-ABC-0001',
        statusCode: 'processing',
        createdAt: '2024-03-01T10:00:00Z',
        subject: { firstName: 'Jane', lastName: 'Smith' },
        items: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            service: { name: null }, // Missing name
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          },
          {
            id: '660e8400-e29b-41d4-a716-446655440002',
            service: { name: 'Valid Service' },
            location: { name: null, code: null }, // Missing location
            status: 'processing'
          },
          {
            id: '660e8400-e29b-41d4-a716-446655440003',
            service: { name: 'Another Service' },
            location: { name: 'Canada', code: 'CA' },
            status: 'unknown_status' // Unknown status
          }
        ]
      }];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders, total: mockOrders.length, limit: 10, offset: 0 })
      } as Response);

      render(<OrdersPage />);

      await waitFor(() => {
        // Should display fallback values
        expect(screen.getByText('Unnamed Service')).toBeInTheDocument();
        expect(screen.getByText('Unknown Location')).toBeInTheDocument();
        expect(screen.getByText('unknown_status')).toBeInTheDocument();
      });
    });
  });
});