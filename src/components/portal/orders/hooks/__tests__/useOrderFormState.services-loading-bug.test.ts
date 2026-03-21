// /GlobalRX_v2/src/components/portal/orders/hooks/__tests__/useOrderFormState.services-loading-bug.test.ts

// REGRESSION TEST: proves bug fix for services not loading when editing draft order
// Bug: In useOrderFormState.ts line 336, the fetchAvailableServices() function
// is only called when NOT in edit mode due to the condition !editOrderId.
// When editing a draft order, services never load.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrderFormState } from '../useOrderFormState';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

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

describe('Services Loading Bug - Edit Draft Order', () => {
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

  describe('REGRESSION TEST: Services not loading when editing draft', () => {
    it('should load services when editing a draft order', async () => {
      // REGRESSION TEST: proves bug fix for services not loading when editing draft order

      // Arrange - Mock a draft order being edited
      const editOrderId = 'draft-order-123';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock the draft order response
      const mockDraftOrder = {
        id: editOrderId,
        orderNumber: '20241210-ABC-0001',
        statusCode: 'draft',
        customerId: 'customer-123',
        subject: {
          firstName: 'John',
          lastName: 'Doe'
        },
        customer: {
          id: 'customer-123',
          name: 'Test Customer'
        },
        orderItems: []
      };

      // Mock the available services response
      const mockServices = [
        { id: 'service-1', name: 'Criminal Background', category: 'background' },
        { id: 'service-2', name: 'Employment Verification', category: 'verification' },
        { id: 'service-3', name: 'Drug Test', category: 'medical' }
      ];

      // Setup fetch mock responses
      // CORRECT order: services call happens first (line ~230), then order call (line ~238)
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ services: mockServices })  // consumed by services call (first effect)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: mockDraftOrder })   // consumed by order call (second effect)
        });

      // Act - Render the hook in edit mode
      const { result } = renderHook(() => useOrderFormState());

      // Assert - Verify that services are fetched even in edit mode
      await waitFor(() => {
        // Check that fetch was called for services
        const servicesCalls = fetchMock.mock.calls.filter(call =>
          call[0].includes('/api/portal/orders/services')
        );

        // This should be > 0 after the bug fix, proving services load in edit mode
        expect(servicesCalls.length).toBeGreaterThan(0);
      });

      // Verify the services are available in the state
      await waitFor(() => {
        expect(result.current.availableServices).toBeDefined();
        expect(result.current.availableServices.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to Services & Locations tab correctly when editing draft', async () => {
      // Arrange - Setup draft order in edit mode
      const editOrderId = 'draft-order-456';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const mockDraftOrder = {
        id: editOrderId,
        orderNumber: '20241210-XYZ-0002',
        statusCode: 'draft',
        customerId: 'customer-123',
        subject: {
          firstName: 'Jane',
          lastName: 'Smith'
        },
        customer: {
          id: 'customer-123',
          name: 'Test Customer'
        },
        orderItems: []
      };

      // Setup fetch mock responses - services first, then order
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ services: [] })  // services call happens first
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: mockDraftOrder })  // order call happens second
        });

      // Act
      const { result } = renderHook(() => useOrderFormState());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert - With the fix, orders now start at step 1 for consistency
      // The implementation changed to always start at step 1
      expect(result.current.currentStep).toBe(1);

      // Navigate back to step 1 (Services & Locations)
      result.current.setCurrentStep(1);

      // Services should be available for selection
      await waitFor(() => {
        expect(result.current.currentStep).toBe(1);
        // After fix, services should be loaded and available
        expect(result.current.servicesLoading).toBe(false);
      });
    });
  });

  describe('Happy Path: Services loading for new order', () => {
    it('should load services when creating a new order', async () => {
      // Arrange - No edit parameter, creating new order
      mockSearchParams = new URLSearchParams('');
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const mockServices = [
        { id: 'service-1', name: 'Criminal Background', category: 'background' },
        { id: 'service-2', name: 'Employment Verification', category: 'verification' }
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: mockServices })
      });

      // Act
      const { result } = renderHook(() => useOrderFormState());

      // Assert - Services should load for new orders
      await waitFor(() => {
        const servicesCalls = fetchMock.mock.calls.filter(call =>
          call[0].includes('/api/portal/orders/services')
        );
        expect(servicesCalls.length).toBeGreaterThan(0);
      });

      await waitFor(() => {
        expect(result.current.availableServices).toHaveLength(2);
        expect(result.current.availableServices[0].name).toBe('Criminal Background');
      });
    });

    it('should start at step 1 for new orders', async () => {
      // Arrange
      mockSearchParams = new URLSearchParams('');
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [] })
      });

      // Act
      const { result } = renderHook(() => useOrderFormState());

      // Assert
      await waitFor(() => {
        expect(result.current.currentStep).toBe(1);
        expect(result.current.editOrderId).toBeNull();
      });
    });
  });

  describe('Edge Case: Services loading after session refresh', () => {
    it('should still load services after page refresh while editing', async () => {
      // Arrange - Simulate a page refresh scenario
      const editOrderId = 'draft-order-789';

      // First render - simulate initial page load after refresh
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const mockOrder = {
        id: editOrderId,
        orderNumber: '20241210-REF-0003',
        statusCode: 'draft',
        customerId: 'customer-123',
        subject: { firstName: 'Bob', lastName: 'Johnson' },
        customer: { id: 'customer-123', name: 'Test Customer' },
        orderItems: [
          {
            id: 'item-1',
            serviceId: 'service-1',
            locationId: 'loc-1'
          }
        ]
      };

      const mockServices = [
        { id: 'service-1', name: 'Background Check', category: 'background' },
        { id: 'service-2', name: 'Drug Screen', category: 'medical' }
      ];

      // Mock both services and order responses (services first, order second)
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ services: mockServices })  // services call happens first
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: mockOrder })  // order call happens second
        });

      // Act
      const { result, rerender } = renderHook(() => useOrderFormState());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate a re-render (like after session refresh)
      rerender();

      // Assert - Services should still be available after refresh
      await waitFor(() => {
        expect(result.current.availableServices).toBeDefined();
        expect(result.current.availableServices.length).toBeGreaterThan(0);
        expect(result.current.editOrderId).toBe(editOrderId);
      });
    });

    it('should handle network failure when loading services in edit mode', async () => {
      // Arrange
      const editOrderId = 'draft-order-error';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const mockOrder = {
        id: editOrderId,
        orderNumber: '20241210-ERR-0001',
        statusCode: 'draft',
        customerId: 'customer-123',
        subject: { firstName: 'Error', lastName: 'Test' },
        customer: { id: 'customer-123', name: 'Test Customer' },
        orderItems: []
      };

      // First call fails (load services), second succeeds (load order)
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))  // services call fails first
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: mockOrder })  // order call succeeds second
        });

      // Act
      const { result } = renderHook(() => useOrderFormState());

      // Assert - Should handle error gracefully
      // The order loads successfully but services fail, so we get the order edit error
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        // The error message comes from the order loading, not services
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('Service Loading State Management', () => {
    it('should show loading state while fetching services', async () => {
      // Arrange
      const editOrderId = 'draft-order-loading';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Create a promise we can control
      let resolveServices: any;
      const servicesPromise = new Promise(resolve => {
        resolveServices = resolve;
      });

      fetchMock
        .mockImplementationOnce(() => servicesPromise)  // services call happens first (delayed)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ order: {
            id: editOrderId,
            statusCode: 'draft',
            customerId: 'customer-123',
            orderItems: []
          }})  // order call happens second
        });

      // Act
      const { result } = renderHook(() => useOrderFormState());

      // Assert - Should show loading state initially
      await waitFor(() => {
        expect(result.current.servicesLoading).toBe(true);
      });

      // Resolve the services
      resolveServices({
        ok: true,
        json: async () => ({ services: [
          { id: 's1', name: 'Service 1', category: 'cat1' }
        ]})
      });

      // Should no longer be loading
      await waitFor(() => {
        expect(result.current.servicesLoading).toBe(false);
        expect(result.current.availableServices).toHaveLength(1);
      });
    });
  });
});