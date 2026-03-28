// /GlobalRX_v2/src/__tests__/integration/education-verification-infinite-loop.test.tsx

// REGRESSION TEST: Integration test for Education verification infinite loop bug
// This test verifies that the complete interaction between Checkbox, ScopeSelector,
// and PackageDialog components does not cause an infinite render loop
// This test will FAIL before ALL fixes are applied and PASS after ALL fixes

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackageDialog } from '@/components/modules/customer/package-dialog-new';

// Track render counts globally
let globalRenderCount = 0;
let maxRenderExceeded = false;

// Mock the auth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        services: [
          {
            id: 'edu-service',
            name: 'Education Verification',
            category: 'verification',
            functionalityType: 'verification-edu'
          }
        ],
        packages: []
      })
    })
  })
}));

// Mock translation
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en'
  })
}));

// Create a custom error boundary that specifically catches render loop errors
class RenderLoopCatcher extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    if (error.message.includes('Maximum update depth exceeded')) {
      maxRenderExceeded = true;
      return {
        hasError: true,
        errorMessage: 'INFINITE LOOP DETECTED: Maximum update depth exceeded'
      };
    }
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (error.message.includes('Maximum update depth exceeded')) {
      console.error('Infinite loop caught:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary">
          <h2>Error Caught</h2>
          <p>{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wrap React.createElement to count renders
const originalCreateElement = React.createElement;
const monitoredComponents = new Set(['ScopeSelector', 'Checkbox', 'PackageDialog']);

describe('Education Verification Infinite Loop - Full Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalRenderCount = 0;
    maxRenderExceeded = false;

    // Monitor render counts
    (React as any).createElement = function(...args: any[]) {
      const [component] = args;
      if (typeof component === 'function' && component.name) {
        if (monitoredComponents.has(component.name)) {
          globalRenderCount++;

          // Safeguard: If we hit too many renders, throw error
          if (globalRenderCount > 100) {
            throw new Error('Maximum update depth exceeded');
          }
        }
      }
      return originalCreateElement.apply(React, args);
    };
  });

  afterEach(() => {
    // Restore original createElement
    (React as any).createElement = originalCreateElement;
  });

  describe('REGRESSION TEST: Full component interaction', () => {
    it('should NOT cause infinite loop when Education verification checkbox is clicked', async () => {
      // REGRESSION TEST: This is the main test that proves the bug is fixed
      // It tests the full interaction between all three components

      const user = userEvent.setup();

      render(
        <RenderLoopCatcher>
          <PackageDialog
            open={true}
            onClose={vi.fn()}
            customerId="test-customer"
          />
        </RenderLoopCatcher>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Education Verification')).toBeInTheDocument();
      });

      // Record render count before interaction
      const renderCountBefore = globalRenderCount;

      // This is the critical action that triggers the bug
      const educationCheckbox = screen.getByLabelText('Education Verification');
      await user.click(educationCheckbox);

      // Wait for the scope selector to appear
      await waitFor(() => {
        expect(screen.getByText('Highest Degree, post high school')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Verify no infinite loop occurred
      expect(maxRenderExceeded).toBe(false);
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();

      // Render count should be reasonable (not in the hundreds)
      const renderCountAfter = globalRenderCount;
      const rendersDuringInteraction = renderCountAfter - renderCountBefore;

      expect(rendersDuringInteraction).toBeLessThan(50);

      // The components should still be functional
      expect(educationCheckbox).toBeChecked();
      expect(screen.getByText('Highest Degree, post high school')).toBeInTheDocument();
    });

    it('should handle multiple rapid selections without infinite loops', async () => {
      const user = userEvent.setup();

      render(
        <RenderLoopCatcher>
          <PackageDialog
            open={true}
            onClose={vi.fn()}
            customerId="test-customer"
          />
        </RenderLoopCatcher>
      );

      await waitFor(() => {
        expect(screen.getByText('Education Verification')).toBeInTheDocument();
      });

      const educationCheckbox = screen.getByLabelText('Education Verification');

      // Rapidly toggle the checkbox multiple times
      for (let i = 0; i < 3; i++) {
        await user.click(educationCheckbox);
        // Brief pause to let renders complete
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should not have triggered infinite loop
      expect(maxRenderExceeded).toBe(false);
      expect(screen.queryByTestId('error-boundary')).not.toBeInTheDocument();
      expect(globalRenderCount).toBeLessThan(100);
    });

    it('should handle scope changes after selection without loops', async () => {
      const user = userEvent.setup();

      render(
        <RenderLoopCatcher>
          <PackageDialog
            open={true}
            onClose={vi.fn()}
            customerId="test-customer"
          />
        </RenderLoopCatcher>
      );

      await waitFor(() => {
        expect(screen.getByText('Education Verification')).toBeInTheDocument();
      });

      // Select Education verification
      const educationCheckbox = screen.getByLabelText('Education Verification');
      await user.click(educationCheckbox);

      // Wait for scope selector
      await waitFor(() => {
        expect(screen.getByText('Highest Degree, post high school')).toBeInTheDocument();
      });

      const renderCountBeforeScope = globalRenderCount;

      // Change the scope selection
      const allDegreesRadio = screen.getByLabelText('All degrees post high school');
      await user.click(allDegreesRadio);

      await waitFor(() => {
        expect(allDegreesRadio).toBeChecked();
      });

      // Verify no loop during scope change
      const rendersDuringScope = globalRenderCount - renderCountBeforeScope;
      expect(rendersDuringScope).toBeLessThan(20);
      expect(maxRenderExceeded).toBe(false);
    });
  });

  describe('Performance benchmarks', () => {
    it('should complete Education verification selection within performance bounds', async () => {
      const user = userEvent.setup();
      const startTime = performance.now();

      render(
        <RenderLoopCatcher>
          <PackageDialog
            open={true}
            onClose={vi.fn()}
            customerId="test-customer"
          />
        </RenderLoopCatcher>
      );

      await waitFor(() => {
        expect(screen.getByText('Education Verification')).toBeInTheDocument();
      });

      const educationCheckbox = screen.getByLabelText('Education Verification');
      await user.click(educationCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Highest Degree, post high school')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds (generous timeout for CI environments)
      expect(duration).toBeLessThan(5000);

      // Total renders should be minimal
      expect(globalRenderCount).toBeLessThan(100);
    });
  });

  describe('Memory leak prevention', () => {
    it('should cleanup properly when dialog unmounts', async () => {
      const user = userEvent.setup();

      const { unmount } = render(
        <RenderLoopCatcher>
          <PackageDialog
            open={true}
            onClose={vi.fn()}
            customerId="test-customer"
          />
        </RenderLoopCatcher>
      );

      await waitFor(() => {
        expect(screen.getByText('Education Verification')).toBeInTheDocument();
      });

      // Select Education verification to trigger all components
      const educationCheckbox = screen.getByLabelText('Education Verification');
      await user.click(educationCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Highest Degree, post high school')).toBeInTheDocument();
      });

      // Unmount should complete without errors
      expect(() => unmount()).not.toThrow();

      // No renders should occur after unmount
      const renderCountBeforeUnmount = globalRenderCount;
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(globalRenderCount).toBe(renderCountBeforeUnmount);
    });
  });
});