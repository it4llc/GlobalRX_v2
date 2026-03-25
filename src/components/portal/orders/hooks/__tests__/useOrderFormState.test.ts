// /GlobalRX_v2/src/components/portal/orders/hooks/__tests__/useOrderFormState.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrderFormState } from '../useOrderFormState';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock the service cart hook
vi.mock('../useServiceCart', () => ({
  useServiceCart: vi.fn(() => ({
    serviceItems: [],
    setCart: vi.fn(),
    addService: vi.fn(),
    removeService: vi.fn(),
    clearCart: vi.fn(),
    getCartSummary: vi.fn(() => ({ totalItems: 0, totalServices: 0 })),
  }))
}));

// Mock the requirements hook
vi.mock('../useOrderRequirements', () => ({
  useOrderRequirements: vi.fn(() => ({
    fetchRequirements: vi.fn(),
    checkRequirements: vi.fn(),
    getRequiredFields: vi.fn(() => ({ subjectFields: [], searchFields: [], documents: [] })),
  }))
}));

// Mock the validation hook
vi.mock('../useOrderValidation', () => ({
  useOrderValidation: vi.fn(() => ({
    validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
    validateStep2: vi.fn(() => true),
    validateStep3: vi.fn(() => true),
    hasAddressBlockData: vi.fn(),
  }))
}));

describe('useOrderFormState - Infinite Loop Bug', () => {
  let mockRouter: any;
  let mockSearchParams: any;
  let fetchMock: vi.Mock;

  beforeEach(() => {
    // Setup router mock
    mockRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);

    // Setup session mock
    (useSession as any).mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          customerId: 'customer-123',
          email: 'test@example.com'
        }
      },
      status: 'authenticated'
    });

    // Setup fetch mock
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug Proof: loadOrderForEdit Infinite Loop', () => {
    it('should call loadOrderForEdit exactly once in edit mode (bug regression test)', async () => {
      // Setup: Mock search params with edit order ID
      const editOrderId = '550e8400-e29b-41d4-a716-446655440001';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock successful order fetch response
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: editOrderId,
          statusCode: 'draft',
          items: [
            {
              service: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'Background Check' },
              location: { id: 'loc-1', name: 'United States' }
            }
          ],
          subject: {
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            email: 'john@example.com'
          },
          notes: 'Test notes'
        })
      });

      // Track the number of times loadOrderForEdit is called
      let loadOrderCallCount = 0;
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async (...args) => {
        const url = args[0] as string;
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          loadOrderCallCount++;
        }
        return fetchMock(...args);
      });

      // Render the hook
      const { result, rerender } = renderHook(() => useOrderFormState());

      // Initial load should trigger loadOrderForEdit
      await waitFor(() => {
        expect(loadOrderCallCount).toBe(1);
      });

      // Simulate component re-renders (which happen in real usage due to state updates)
      rerender();

      // After re-render, it should NOT call loadOrderForEdit again
      expect(loadOrderCallCount).toBe(1);

      // Rerender again to confirm stability
      rerender();

      // FIXED: loadOrderForEdit should only be called once
      // This is a regression test for the infinite loop bug
      expect(loadOrderCallCount).toBe(1);

      // Clean up
      global.fetch = originalFetch;
    });

    it('should have stable loadOrderForEdit reference across renders (bug regression test)', async () => {
      // Setup: Mock search params with edit order ID
      const editOrderId = '550e8400-e29b-41d4-a716-446655440002';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Track loadOrderForEdit reference changes
      const loadOrderForEditReferences: any[] = [];

      // Render the hook
      const { result, rerender } = renderHook(() => useOrderFormState());

      // Capture the initial loadOrderForEdit reference
      loadOrderForEditReferences.push(result.current.loadOrderForEdit);

      // Rerender and capture new reference
      rerender();
      loadOrderForEditReferences.push(result.current.loadOrderForEdit);

      // Rerender again
      rerender();
      loadOrderForEditReferences.push(result.current.loadOrderForEdit);

      // FIXED: loadOrderForEdit reference should be stable across renders
      // This is a regression test for the unstable dependency bug
      expect(loadOrderForEditReferences[0]).toBe(loadOrderForEditReferences[1]);
      expect(loadOrderForEditReferences[1]).toBe(loadOrderForEditReferences[2]);
    });
  });

  describe('Expected Behavior (After Fix)', () => {
    it('should call loadOrderForEdit exactly once when editing an order', async () => {
      // Setup: Mock search params with edit order ID
      const editOrderId = '550e8400-e29b-41d4-a716-446655440003';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock successful order fetch
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: editOrderId,
          statusCode: 'draft',
          items: [],
          subject: null,
          notes: ''
        })
      });

      // Track API calls
      let apiCallCount = 0;
      global.fetch = vi.fn(async (...args) => {
        const url = args[0] as string;
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          apiCallCount++;
        }
        return fetchMock(...args);
      });

      // Render the hook
      const { rerender } = renderHook(() => useOrderFormState());

      // Wait for initial load
      await waitFor(() => {
        expect(apiCallCount).toBe(1);
      });

      // Multiple rerenders should not trigger additional API calls
      rerender();
      rerender();
      rerender();

      // Give time for any erroneous calls
      await new Promise(resolve => setTimeout(resolve, 100));

      // EXPECTED: loadOrderForEdit should only be called once
      expect(apiCallCount).toBe(1);
    });

    it('should NOT call loadOrderForEdit when creating a new order (no editOrderId)', async () => {
      // Setup: No edit parameter in search params
      mockSearchParams = new URLSearchParams('');
      mockSearchParams.get = vi.fn(() => null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Track any order fetch attempts
      let orderFetchAttempts = 0;
      global.fetch = vi.fn(async (url: string) => {
        if (url.includes('/api/portal/orders/')) {
          orderFetchAttempts++;
        }
        return {
          ok: true,
          json: async () => ({ services: [] })
        };
      });

      // Render the hook
      const { result } = renderHook(() => useOrderFormState());

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      // EXPECTED: No order fetch should happen when creating new order
      expect(orderFetchAttempts).toBe(0);
      expect(result.current.isEditMode).toBe(false);
    });

    it('should trigger loadOrderForEdit when editOrderId changes', async () => {
      // Start with no edit ID
      let currentEditId: string | null = null;
      mockSearchParams = {
        get: vi.fn((key: string) => key === 'edit' ? currentEditId : null)
      };
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Track API calls by order ID
      const apiCallsByOrderId: Record<string, number> = {};
      global.fetch = vi.fn(async (url: string) => {
        const match = url.match(/\/api\/portal\/orders\/([^/]+)/);
        if (match) {
          const orderId = match[1];
          apiCallsByOrderId[orderId] = (apiCallsByOrderId[orderId] || 0) + 1;
        }
        return {
          ok: true,
          json: async () => ({
            id: match?.[1],
            statusCode: 'draft',
            items: [],
            subject: null,
            notes: ''
          })
        };
      });

      // Initial render - no edit
      const { rerender } = renderHook(() => useOrderFormState());

      // Change to edit order-1
      currentEditId = 'order-1';
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? currentEditId : null);
      rerender();

      await waitFor(() => {
        expect(apiCallsByOrderId['order-1']).toBe(1);
      });

      // Change to edit order-2
      currentEditId = 'order-2';
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? currentEditId : null);
      rerender();

      await waitFor(() => {
        expect(apiCallsByOrderId['order-2']).toBe(1);
      });

      // EXPECTED: Each order ID should be fetched exactly once
      expect(apiCallsByOrderId['order-1']).toBe(1);
      expect(apiCallsByOrderId['order-2']).toBe(1);
    });

    it('should have stable loadOrderForEdit reference after fix', async () => {
      // Setup: Mock search params
      mockSearchParams = new URLSearchParams('');
      mockSearchParams.get = vi.fn(() => null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Track loadOrderForEdit references
      const references: any[] = [];

      // Render the hook
      const { result, rerender } = renderHook(() => useOrderFormState());

      // Capture references across multiple renders
      references.push(result.current.loadOrderForEdit);
      rerender();
      references.push(result.current.loadOrderForEdit);
      rerender();
      references.push(result.current.loadOrderForEdit);

      // EXPECTED AFTER FIX: loadOrderForEdit reference should be stable
      // This test will PASS after the bug is fixed
      // Currently it should FAIL, proving the bug exists
      expect(references[0]).toBe(references[1]);
      expect(references[1]).toBe(references[2]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-draft order by redirecting and not entering edit mode', async () => {
      // Setup: Mock search params with edit order ID
      const editOrderId = 'order-submitted';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock order that is not a draft
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: editOrderId,
          statusCode: 'submitted', // Not a draft!
          items: [],
          subject: null,
          notes: ''
        })
      });

      // Render the hook
      const { result } = renderHook(() => useOrderFormState());

      // Wait for order load attempt
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      // EXPECTED: Should redirect and show error
      expect(mockRouter.push).toHaveBeenCalledWith('/portal/orders');
      expect(result.current.errors.submit).toBe('error.onlyDraftOrdersCanBeEdited');
      expect(result.current.isEditMode).toBe(false);
    });

    it('should handle API error when loading order for edit', async () => {
      // Setup: Mock search params with edit order ID
      const editOrderId = 'order-error';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock API error
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Order not found' })
      });

      // Render the hook
      const { result } = renderHook(() => useOrderFormState());

      // Wait for order load attempt
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
      });

      // EXPECTED: Should handle error gracefully
      expect(result.current.isEditMode).toBe(false);
      expect(result.current.isLoadingOrder).toBe(false);
    });

    it('should not attempt to load order if no customerId in session', async () => {
      // Setup: Session without customerId
      (useSession as any).mockReturnValue({
        data: {
          user: {
            id: 'user-123',
            customerId: null, // No customer ID
            email: 'test@example.com'
          }
        },
        status: 'authenticated'
      });

      // Setup: Mock search params with edit order ID
      const editOrderId = 'order-no-customer';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Track fetch calls
      let fetchCallCount = 0;
      global.fetch = vi.fn(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        });
      });

      // Render the hook
      renderHook(() => useOrderFormState());

      // Wait to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      // EXPECTED: No fetch should occur without customerId
      expect(fetchCallCount).toBe(0);
    });
  });
});