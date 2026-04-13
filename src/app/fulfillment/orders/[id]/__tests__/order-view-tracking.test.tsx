// /GlobalRX_v2/src/app/fulfillment/orders/[id]/__tests__/order-view-tracking.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import OrderDetailsPage from '../page';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

// Fix 2: Create stable mock functions to prevent infinite useEffect loop
const mockTranslationFunction = vi.fn((key: string) => key);
const mockCheckPermissionFunction = vi.fn().mockReturnValue(true);

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: mockTranslationFunction
  })
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toastError: vi.fn(),
    toastSuccess: vi.fn()
  })
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// Mock child components
vi.mock('@/components/fulfillment/OrderDetailsView', () => ({
  OrderDetailsView: () => <div data-testid="order-details-view">OrderDetailsView</div>
}));

vi.mock('@/components/fulfillment/OrderDetailsSidebar', () => ({
  OrderDetailsSidebar: () => <div data-testid="order-details-sidebar">OrderDetailsSidebar</div>
}));

describe('Order Details Page - Order View Tracking', () => {
  const mockOrder = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    orderNumber: '20240301-ABC-0001',
    customerId: 'customer-123',
    statusCode: 'processing',
    subject: {
      firstName: 'John',
      lastName: 'Doe'
    },
    createdAt: '2024-03-01T09:00:00Z',
    updatedAt: '2024-03-01T09:00:00Z',
    customer: {
      id: 'customer-123',
      name: 'ACME Corp'
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useParams to return order ID
    vi.mocked(useParams).mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440001' });

    // Fix 2: Mock useAuth with stable function references to prevent infinite useEffect loop
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-123',
        userType: 'internal',
        permissions: { fulfillment: true }
      },
      checkPermission: mockCheckPermissionFunction,
      isLoading: false,
      isAuthenticated: true,
      hasPermission: vi.fn().mockReturnValue(true),
      login: vi.fn(),
      logout: vi.fn()
    });

    // Fix 1: Mock global.fetch to return successful response for both APIs
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOrder)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });
  });

  describe('Order View Tracking - Business Rule Tests', () => {
    it('should fire POST /api/orders/[id]/view exactly once per orderId per page mount', async () => {
      render(<OrderDetailsPage />);

      // Fix 1: Wait for skeleton loader to disappear, then verify content is visible
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
      });

      // Fix 1: Look for actual rendered content instead of non-existent test-id
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify the order details API was called
      expect(global.fetch).toHaveBeenCalledWith('/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');

      // Verify the view tracking API was called exactly once
      expect(global.fetch).toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Should be called exactly 2 times total: once for order fetch, once for tracking
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use useRef to prevent duplicate tracking calls when order object reference changes', async () => {
      const { rerender } = render(<OrderDetailsPage />);

      // Wait for initial load and tracking call
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Clear the mock to track subsequent calls
      vi.clearAllMocks();

      // Simulate order data refresh with new object reference but same ID
      const updatedOrder = {
        ...mockOrder,
        updatedAt: '2024-03-01T10:00:00Z', // Different timestamp
        subject: { ...mockOrder.subject } // New object reference
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedOrder)
      });

      // Re-render component (simulating state update)
      rerender(<OrderDetailsPage />);

      // Wait for any potential effects to run
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify NO additional tracking call was made (ref should prevent it)
      expect(global.fetch).not.toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should make a fresh tracking call when navigating to a different orderId', async () => {
      const { rerender } = render(<OrderDetailsPage />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByTestId('skeleton-loader')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify first tracking call
      expect(global.fetch).toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Navigate to different order
      const differentOrderId = '660e8400-e29b-41d4-a716-446655440002';
      const differentOrder = {
        ...mockOrder,
        id: differentOrderId,
        orderNumber: '20240301-XYZ-0002'
      };

      vi.mocked(useParams).mockReturnValue({ id: differentOrderId });

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(differentOrder)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        });

      // Re-render with new orderId
      rerender(<OrderDetailsPage />);

      // Wait for new order to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`/api/fulfillment/orders/${differentOrderId}`);
      });

      // Verify tracking call was made for new order ID
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(`/api/orders/${differentOrderId}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });
  });

  describe('Silent Failure Handling', () => {
    it('should continue page rendering when view tracking API fails', async () => {
      // Mock order API to succeed but tracking API to fail
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrder)
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<OrderDetailsPage />);

      // Page should still render successfully
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Error should be logged to console but not shown to user
      expect(consoleSpy).toHaveBeenCalledWith('Order view tracking failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should continue page rendering when view tracking API returns 500', async () => {
      // Mock order API to succeed but tracking API to return server error
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOrder)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal server error' })
        });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<OrderDetailsPage />);

      // Page should still render successfully
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Error should be logged but not shown to user
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not make tracking call when order data is missing', async () => {
      // Mock order API to return empty response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null)
      });

      render(<OrderDetailsPage />);

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Order not found')).toBeInTheDocument();
      });

      // Verify only the order fetch was called, not the tracking
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');

      // Verify tracking was NOT called
      expect(global.fetch).not.toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', expect.any(Object));
    });
  });

  describe('User Type Behavior', () => {
    it('should make tracking calls for customer users', async () => {
      // Mock customer user
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'customer-user-1',
          userType: 'customer',
          customerId: 'customer-123'
        },
        checkPermission: vi.fn().mockReturnValue(false), // Customers don't have fulfillment permission
        isLoading: false,
        isAuthenticated: true,
        hasPermission: vi.fn().mockReturnValue(false),
        login: vi.fn(),
        logout: vi.fn()
      });

      render(<OrderDetailsPage />);

      // Wait for order to load
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify tracking call was made for customer user
      expect(global.fetch).toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should make tracking calls for internal users with fulfillment permission', async () => {
      // Already set up in beforeEach with internal user
      render(<OrderDetailsPage />);

      // Wait for order to load
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify tracking call was made
      expect(global.fetch).toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });

    it('should make tracking calls for admin users', async () => {
      // Mock admin user
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'admin-user-1',
          userType: 'internal',
          permissions: { admin: true }
        },
        checkPermission: mockCheckPermissionFunction,
        isLoading: false,
        isAuthenticated: true,
        hasPermission: vi.fn().mockReturnValue(true),
        login: vi.fn(),
        logout: vi.fn()
      });

      render(<OrderDetailsPage />);

      // Wait for order to load
      await waitFor(() => {
        expect(screen.getByText('20240301-ABC-0001')).toBeInTheDocument();
      });

      // Verify tracking call was made for admin user
      expect(global.fetch).toHaveBeenCalledWith('/api/orders/550e8400-e29b-41d4-a716-446655440001/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  describe('Permission Handling', () => {
    it('should not make tracking call when user lacks permissions to view order', async () => {
      // Mock user without permissions
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: 'no-perms-user',
          userType: 'internal',
          permissions: {}
        },
        checkPermission: vi.fn().mockReturnValue(false),
        isLoading: false,
        isAuthenticated: true,
        hasPermission: vi.fn().mockReturnValue(false),
        login: vi.fn(),
        logout: vi.fn()
      });

      render(<OrderDetailsPage />);

      // Wait for permission error to show
      await waitFor(() => {
        expect(screen.getByText('module.fulfillment.permissionDenied')).toBeInTheDocument();
      });

      // Verify no API calls were made (no order fetch, no tracking)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});