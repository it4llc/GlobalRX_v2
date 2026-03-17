// /GlobalRX_v2/src/app/portal/orders/new/__tests__/NewOrderPage.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewOrderPage from '../NewOrderPage';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null)
  })),
}));

// Mock the order form state hook
vi.mock('@/components/portal/orders/hooks/useOrderFormState', () => ({
  useOrderFormState: vi.fn(() => ({
    step: 1,
    isEditMode: false,
    isLoadingOrder: false,
    isSubmitting: false,
    errors: {},
    subjectInfo: {
      firstName: '',
      lastName: '',
      middleName: '',
      dateOfBirth: '',
      email: '',
      phone: '',
      address: '',
    },
    notes: '',
    subjectFieldValues: {},
    searchFieldValues: {},
    uploadedDocuments: {},
    selectedServiceForLocation: null,
    serviceCart: {
      serviceItems: []
    },
    validation: {
      validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
      validateStep2: vi.fn(() => true),
      validateStep3: vi.fn(() => true),
    },
    setStep: vi.fn(),
    setFormErrors: vi.fn(),
    updateSubjectInfo: vi.fn(),
    setNotes: vi.fn(),
    submitOrder: vi.fn(),
    cancelOrder: vi.fn(),
  }))
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

// Mock components to avoid complex dependencies
vi.mock('@/components/portal/orders/components/OrderProgressBar', () => ({
  default: () => <div data-testid="progress-bar">Progress Bar</div>
}));

vi.mock('@/components/portal/orders/steps/ServiceSelectionStep', () => ({
  default: () => <div data-testid="service-selection">Service Selection</div>
}));

vi.mock('@/components/portal/orders/steps/SubjectInfoStep', () => ({
  default: () => <div data-testid="subject-info">Subject Info</div>
}));

vi.mock('@/components/portal/orders/steps/ReviewStep', () => ({
  default: () => <div data-testid="review-step">Review</div>
}));

describe('NewOrderPage - Console.log Standards Violations', () => {
  let mockRouter: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

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

    // Spy on console methods to detect violations
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Console Statement Violations', () => {
    it('MUST FAIL: proves console.log statements exist in handleNext function', async () => {
      // Import the actual component to get real implementation
      const { default: ActualNewOrderPage } = await import('../NewOrderPage');

      // Mock the hook with a function that will trigger handleNext
      const mockOrderForm = {
        step: 1,
        isEditMode: false,
        isLoadingOrder: false,
        isSubmitting: false,
        errors: {},
        subjectInfo: {
          firstName: '',
          lastName: '',
          middleName: '',
          dateOfBirth: '',
          email: '',
          phone: '',
          address: '',
        },
        notes: '',
        subjectFieldValues: {},
        searchFieldValues: {},
        uploadedDocuments: {},
        selectedServiceForLocation: null,
        serviceCart: {
          serviceItems: [
            {
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              serviceName: 'Test Service',
              locationId: 'loc-1',
              locationName: 'Test Location',
              itemId: '660e8400-e29b-41d4-a716-446655440001'
            }
          ]
        },
        validation: {
          validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
          validateStep2: vi.fn(() => true),
          validateStep3: vi.fn(() => true),
        },
        setStep: vi.fn(),
        setFormErrors: vi.fn(),
        updateSubjectInfo: vi.fn(),
        setNotes: vi.fn(),
        submitOrder: vi.fn(),
        cancelOrder: vi.fn(),
      };

      // Override the mock for this test
      const useOrderFormStateMock = await import('@/components/portal/orders/hooks/useOrderFormState');
      (useOrderFormStateMock.useOrderFormState as any).mockReturnValue(mockOrderForm);

      // Render the actual component
      const { getByText } = render(<ActualNewOrderPage />);

      // Find and click the Next button to trigger handleNext
      const nextButton = getByText('Next');
      fireEvent.click(nextButton);

      // Wait for any async operations
      await waitFor(() => {
        // BUG PROOF: console.log statements are being called
        expect(consoleLogSpy).toHaveBeenCalled();
      });

      // Verify specific console.log calls that violate standards
      const consoleCalls = consoleLogSpy.mock.calls;
      const violatingCalls = consoleCalls.filter((call: any[]) => {
        const message = call[0];
        return message.includes('handleNext') ||
               message.includes('clientLogger');
      });

      // BUG CONFIRMED: Console.log statements exist in production code
      expect(violatingCalls.length).toBeGreaterThan(0);
      console.warn(`BUG CONFIRMED: Found ${violatingCalls.length} console.log violations in NewOrderPage!`);
      console.warn('Violations:', violatingCalls.map((c: any[]) => c[0]));
    });

    it('MUST FAIL: proves console.error statements exist for clientLogger debugging', async () => {
      // Import the actual component
      const { default: ActualNewOrderPage } = await import('../NewOrderPage');

      // Mock clientLogger to throw an error
      const clientLogger = await import('@/lib/client-logger');
      (clientLogger.default.debug as any).mockImplementation(() => {
        throw new Error('Simulated clientLogger error');
      });

      // Mock the order form state
      const mockOrderForm = {
        step: 1,
        isEditMode: false,
        isLoadingOrder: false,
        isSubmitting: false,
        errors: {},
        subjectInfo: {
          firstName: '',
          lastName: '',
          middleName: '',
          dateOfBirth: '',
          email: '',
          phone: '',
          address: '',
        },
        notes: '',
        subjectFieldValues: {},
        searchFieldValues: {},
        uploadedDocuments: {},
        selectedServiceForLocation: null,
        serviceCart: {
          serviceItems: [{ serviceId: 'test', serviceName: 'Test', locationId: 'loc', locationName: 'Loc', itemId: 'item' }]
        },
        validation: {
          validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
          validateStep2: vi.fn(() => true),
          validateStep3: vi.fn(() => true),
        },
        setStep: vi.fn(),
        setFormErrors: vi.fn(),
        updateSubjectInfo: vi.fn(),
        setNotes: vi.fn(),
        submitOrder: vi.fn(),
        cancelOrder: vi.fn(),
      };

      const useOrderFormStateMock = await import('@/components/portal/orders/hooks/useOrderFormState');
      (useOrderFormStateMock.useOrderFormState as any).mockReturnValue(mockOrderForm);

      // Render the component
      const { getByText } = render(<ActualNewOrderPage />);

      // Trigger handleNext
      const nextButton = getByText('Next');
      fireEvent.click(nextButton);

      // Wait for error handling
      await waitFor(() => {
        // BUG PROOF: console.error is being used
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Check for specific error message
      const errorCalls = consoleErrorSpy.mock.calls;
      const violatingCalls = errorCalls.filter((call: any[]) => {
        const message = call[0];
        return message.includes('clientLogger.debug failed');
      });

      // BUG CONFIRMED: console.error statements exist
      expect(violatingCalls.length).toBeGreaterThan(0);
      console.warn(`BUG CONFIRMED: Found ${violatingCalls.length} console.error violations!`);
    });
  });

  describe('Expected Behavior (After Fix)', () => {
    it('should use Winston logger instead of console statements', async () => {
      const clientLogger = await import('@/lib/client-logger');

      // Reset mocks
      (clientLogger.default.debug as any).mockClear();
      (clientLogger.default.warn as any).mockClear();
      (clientLogger.default.error as any).mockClear();

      // Render component
      render(<NewOrderPage />);

      // Find and click Next button
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // EXPECTED AFTER FIX: No console.log or console.error calls
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // EXPECTED: Winston logger should be used instead
      expect(clientLogger.default.debug).toHaveBeenCalled();
    });

    it('should handle clientLogger errors without console statements', async () => {
      const clientLogger = await import('@/lib/client-logger');

      // Make clientLogger throw an error
      (clientLogger.default.debug as any).mockImplementation(() => {
        throw new Error('Logger error');
      });

      // Render component
      render(<NewOrderPage />);

      // Trigger action
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      // EXPECTED AFTER FIX: Error handled without console statements
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // EXPECTED: Error should be handled gracefully
      expect(clientLogger.default.error).toHaveBeenCalled();
    });
  });

  describe('Coding Standards Compliance', () => {
    it('should not contain any console.* statements in production code', () => {
      // This test checks that no console statements are called during normal operation
      render(<NewOrderPage />);

      // EXPECTED: No console statements during render
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should follow structured logging pattern for all log events', async () => {
      const clientLogger = await import('@/lib/client-logger');

      // Mock validation to fail
      const mockOrderForm = {
        step: 1,
        isEditMode: false,
        isLoadingOrder: false,
        isSubmitting: false,
        errors: {},
        subjectInfo: {
          firstName: '',
          lastName: '',
          middleName: '',
          dateOfBirth: '',
          email: '',
          phone: '',
          address: '',
        },
        notes: '',
        subjectFieldValues: {},
        searchFieldValues: {},
        uploadedDocuments: {},
        selectedServiceForLocation: null,
        serviceCart: {
          serviceItems: [] // Empty cart to trigger validation error
        },
        validation: {
          validateStep1: vi.fn(() => ({
            isValid: false,
            errors: { services: 'Please add at least one service' }
          })),
          validateStep2: vi.fn(() => true),
          validateStep3: vi.fn(() => true),
        },
        setStep: vi.fn(),
        setFormErrors: vi.fn(),
        updateSubjectInfo: vi.fn(),
        setNotes: vi.fn(),
        submitOrder: vi.fn(),
        cancelOrder: vi.fn(),
      };

      const useOrderFormStateMock = await import('@/components/portal/orders/hooks/useOrderFormState');
      (useOrderFormStateMock.useOrderFormState as any).mockReturnValue(mockOrderForm);

      // Render component
      const { getByText } = render(<NewOrderPage />);

      // Trigger validation failure
      const nextButton = getByText('Next');
      fireEvent.click(nextButton);

      // EXPECTED: Structured logging with appropriate level
      await waitFor(() => {
        expect(clientLogger.default.warn).toHaveBeenCalledWith('Step 1 validation failed');
      });

      // EXPECTED: No console statements
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});