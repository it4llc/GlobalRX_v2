// /GlobalRX_v2/src/contexts/ViewContext.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewProvider, useViewContext } from './ViewContext';
import { useAuth } from './AuthContext';

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: vi.fn()
}));

// Test component to access context
function TestComponent() {
  const { view, setView, canToggle } = useViewContext();

  return (
    <div>
      <div data-testid="current-view">{view}</div>
      <div data-testid="can-toggle">{canToggle ? 'yes' : 'no'}</div>
      <button onClick={() => setView('config')}>Set Config</button>
      <button onClick={() => setView('orders')}>Set Orders</button>
    </div>
  );
}

describe('ViewContext', () => {
  describe('for internal users with config permissions', () => {
    it('should default to config view and allow toggling', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('config');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('yes');
    });

    it('should allow switching between views', async () => {
      const user = userEvent.setup();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            user_admin: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      // Should start in config view
      expect(screen.getByTestId('current-view')).toHaveTextContent('config');

      // Switch to orders view
      await user.click(screen.getByText('Set Orders'));
      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');

      // Switch back to config view
      await user.click(screen.getByText('Set Config'));
      expect(screen.getByTestId('current-view')).toHaveTextContent('config');
    });
  });

  describe('for internal users without config permissions', () => {
    it('should default to orders view and not allow toggling', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '2',
          userType: 'internal',
          permissions: {
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });

    it('should stay in orders view when trying to switch to config', async () => {
      const user = userEvent.setup();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '2',
          userType: 'internal',
          permissions: {
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');

      // Try to switch to config view - should be ignored
      await user.click(screen.getByText('Set Config'));
      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
    });
  });

  describe('for vendor users', () => {
    it('should default to orders view and not allow toggling', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '3',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });

    it('should stay in orders view regardless of permissions', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '3',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {
            global_config: true,
            user_admin: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });
  });

  describe('for customer users', () => {
    it('should default to orders view and not allow toggling', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '4',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });
  });

  describe('for unauthenticated users', () => {
    it('should default to orders view and not allow toggling', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('current-view')).toHaveTextContent('orders');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });
  });

  describe('context error handling', () => {
    it('should throw error when used outside provider', () => {
      // Capture console.error to prevent test noise
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => render(<TestComponent />)).toThrow('useViewContext must be used within ViewProvider');

      console.error = originalError;
    });
  });

  describe('permission checks', () => {
    it('should check for global_config permission', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            global_config: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('can-toggle')).toHaveTextContent('yes');
    });

    it('should check for customer_config permission', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            customer_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('can-toggle')).toHaveTextContent('yes');
    });

    it('should check for user_admin permission', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            user_admin: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      expect(screen.getByTestId('can-toggle')).toHaveTextContent('yes');
    });

    it('should require candidate_workflow for orders view', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          userType: 'internal',
          permissions: {
            user_admin: true
            // Missing candidate_workflow
          }
        },
        isAuthenticated: true
      });

      render(
        <ViewProvider>
          <TestComponent />
        </ViewProvider>
      );

      // Should still allow config view but not toggle to orders
      expect(screen.getByTestId('current-view')).toHaveTextContent('config');
      expect(screen.getByTestId('can-toggle')).toHaveTextContent('no');
    });
  });
});