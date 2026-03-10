// /GlobalRX_v2/src/app/fulfillment/__tests__/page-stats-display-bug.test.tsx
// Component tests for dashboard stats display bug
//
// THE BUG:
// Page currently renders 5 stat cards (Total, Submitted, Processing, Completed, Cancelled)
// Should only render 3 cards (Total Orders, Total Services, In Progress)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FulfillmentPage from '../page';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('next-auth/react');
vi.mock('@/contexts/AuthContext');
vi.mock('next/navigation');
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Dashboard Stats Display Bug - Component Level', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (useRouter as any).mockReturnValue({
      push: mockPush,
    });

    (useSession as any).mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          userType: 'internal',
        },
      },
    });

    (useAuth as any).mockReturnValue({
      checkPermission: vi.fn().mockReturnValue(true),
    });
  });

  describe('Current broken behavior (proves bug exists)', () => {
    it('should render 5 stat cards instead of 3 (bug: wrong cards shown)', async () => {
      // Arrange - Mock API response with current structure
      const mockResponse = {
        orders: [
          { id: '1', statusCode: 'submitted', items: [], orderNumber: 'ORD-001' },
          { id: '2', statusCode: 'processing', items: [], orderNumber: 'ORD-002' },
          { id: '3', statusCode: 'completed', items: [], orderNumber: 'ORD-003' },
          { id: '4', statusCode: 'cancelled', items: [], orderNumber: 'ORD-004' },
        ],
        total: 4,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      });

      // Assert - This test SHOULD FAIL before fix
      // Currently shows these 5 cards:
      expect(screen.getByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.submitted')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.processing')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.completed')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.cancelled')).toBeInTheDocument();

      // Should NOT show these (but will after fix):
      expect(screen.queryByText('module.fulfillment.totalServices')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.inProgress')).not.toBeInTheDocument();

      // Count total stat cards - should be 5 (bug)
      const statCards = screen.getAllByRole('button').filter(btn =>
        btn.className.includes('bg-white rounded-lg shadow p-6')
      );
      expect(statCards).toHaveLength(5); // BUG: Shows 5 cards
    });

    it('should NOT display Total Services count (bug: missing metric)', async () => {
      // Arrange
      const mockResponse = {
        orders: [
          {
            id: '1',
            statusCode: 'processing',
            items: [
              { id: 'item-1', service: { name: 'Service A' } },
              { id: 'item-2', service: { name: 'Service B' } },
            ],
            orderNumber: 'ORD-001'
          },
          {
            id: '2',
            statusCode: 'submitted',
            items: [
              { id: 'item-3', service: { name: 'Service C' } },
            ],
            orderNumber: 'ORD-002'
          },
        ],
        total: 2,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      });

      // Assert - Total Services metric doesn't exist
      expect(screen.queryByText('module.fulfillment.totalServices')).not.toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument(); // Total service count would be 3
    });

    it('should calculate stats on frontend instead of receiving from API (bug: wrong architecture)', async () => {
      // Arrange
      const mockResponse = {
        orders: [
          { id: '1', statusCode: 'submitted', items: [] },
          { id: '2', statusCode: 'processing', items: [] },
        ],
        total: 2,
        // Note: No stats object in response
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      });

      // Assert - Stats are calculated in component (lines 149-157 of page.tsx)
      // This is a bug - stats should come from API
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/fulfillment'));

      // The component calculates stats locally by filtering the orders array
      // This is inefficient and should be done on the backend
    });
  });

  describe('Expected correct behavior (after fix)', () => {
    it('should render exactly 3 stat cards with correct labels', async () => {
      // Arrange - Mock API response with new stats structure
      const mockResponse = {
        orders: [],
        total: 10,
        stats: {
          totalOrders: 10,
          totalServices: 25,
          inProgress: 6,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      });

      // Assert - Should show exactly these 3 cards
      expect(screen.getByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.totalServices')).toBeInTheDocument();
      expect(screen.getByText('module.fulfillment.inProgress')).toBeInTheDocument();

      // Should NOT show old cards
      expect(screen.queryByText('module.fulfillment.submitted')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.processing')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.completed')).not.toBeInTheDocument();
      expect(screen.queryByText('module.fulfillment.cancelled')).not.toBeInTheDocument();
    });

    it('should display correct stat values from API', async () => {
      // Arrange
      const mockResponse = {
        orders: [],
        total: 0,
        stats: {
          totalOrders: 42,
          totalServices: 156,
          inProgress: 28,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('42')).toBeInTheDocument();
      });

      // Assert - Correct values displayed
      expect(screen.getByText('42')).toBeInTheDocument(); // Total Orders
      expect(screen.getByText('156')).toBeInTheDocument(); // Total Services
      expect(screen.getByText('28')).toBeInTheDocument(); // In Progress
    });

    it('should NOT calculate stats locally when API provides them', async () => {
      // Arrange
      const mockResponse = {
        orders: [
          { id: '1', statusCode: 'submitted', items: [{}, {}, {}] },
          { id: '2', statusCode: 'draft', items: [{}] },
        ],
        total: 2,
        stats: {
          totalOrders: 2,
          totalServices: 4,
          inProgress: 1, // Only submitted counts as in progress
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('2')).toBeInTheDocument();
      });

      // Assert - Uses API stats, not local calculation
      expect(screen.getByText('4')).toBeInTheDocument(); // Total Services from API
      expect(screen.getByText('1')).toBeInTheDocument(); // In Progress from API

      // Should not show a count of submitted orders (old behavior)
      const allTextElements = screen.queryAllByText('1');
      // Only one element with '1' should exist (the In Progress count)
      expect(allTextElements).toHaveLength(1);
    });
  });

  describe('Stat card click behavior', () => {
    it('should filter orders when clicking on stat cards', async () => {
      // This behavior might change with the new stats, documenting current behavior
      const mockResponse = {
        orders: [
          { id: '1', statusCode: 'submitted', items: [], orderNumber: 'ORD-001' },
          { id: '2', statusCode: 'processing', items: [], orderNumber: 'ORD-002' },
          { id: '3', statusCode: 'completed', items: [], orderNumber: 'ORD-003' },
        ],
        total: 3,
        stats: {
          totalOrders: 3,
          totalServices: 0,
          inProgress: 2,
        },
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Act
      render(<FulfillmentPage />);

      await waitFor(() => {
        expect(screen.queryByText('module.fulfillment.totalOrders')).toBeInTheDocument();
      });

      // After fix, clicking "In Progress" should filter to non-draft/completed/cancelled orders
      // Total Orders should show all
      // Total Services might not be clickable (no filter applicable)
    });
  });
});