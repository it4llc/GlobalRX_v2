// /GlobalRX_v2/src/components/layout/ViewToggle.test.tsx

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToggle } from './ViewToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useViewContext } from '@/contexts/ViewContext';

// Mock contexts
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/contexts/ViewContext', () => ({
  useViewContext: vi.fn()
}));

describe('ViewToggle Component', () => {
  describe('visibility', () => {
    it('should not render for customer users', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'customer',
          customerId: 'customer-123',
          permissions: { candidate_workflow: true }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'orders',
        setView: vi.fn(),
        canToggle: false
      });

      const { container } = render(<ViewToggle />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render for vendor users', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '2',
          type: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'orders',
        setView: vi.fn(),
        canToggle: false
      });

      const { container } = render(<ViewToggle />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render for internal users without config permissions', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '3',
          type: 'internal',
          permissions: { candidate_workflow: true }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'orders',
        setView: vi.fn(),
        canToggle: false
      });

      const { container } = render(<ViewToggle />);
      expect(container.firstChild).toBeNull();
    });

    it('should render for internal users with config permissions', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '4',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView: vi.fn(),
        canToggle: true
      });

      render(<ViewToggle />);

      expect(screen.getByRole('button', { name: /configuration view/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /order view/i })).toBeInTheDocument();
    });
  });

  describe('toggle functionality', () => {
    it('should show active state for current view', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView: vi.fn(),
        canToggle: true
      });

      render(<ViewToggle />);

      const configButton = screen.getByRole('button', { name: /configuration view/i });
      const orderButton = screen.getByRole('button', { name: /order view/i });

      expect(configButton).toHaveClass('active');
      expect(orderButton).not.toHaveClass('active');
    });

    it('should switch to order view when clicked', async () => {
      const user = userEvent.setup();
      const setView = vi.fn();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView,
        canToggle: true
      });

      render(<ViewToggle />);

      const orderButton = screen.getByRole('button', { name: /order view/i });
      await user.click(orderButton);

      expect(setView).toHaveBeenCalledWith('orders');
    });

    it('should switch to config view when clicked', async () => {
      const user = userEvent.setup();
      const setView = vi.fn();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'orders',
        setView,
        canToggle: true
      });

      render(<ViewToggle />);

      const configButton = screen.getByRole('button', { name: /configuration view/i });
      await user.click(configButton);

      expect(setView).toHaveBeenCalledWith('config');
    });

    it('should not switch when clicking current view', async () => {
      const user = userEvent.setup();
      const setView = vi.fn();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView,
        canToggle: true
      });

      render(<ViewToggle />);

      const configButton = screen.getByRole('button', { name: /configuration view/i });
      await user.click(configButton);

      expect(setView).not.toHaveBeenCalled();
    });
  });

  describe('permission-based UI', () => {
    it('should show appropriate icons for each view', () => {
      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView: vi.fn(),
        canToggle: true
      });

      render(<ViewToggle />);

      expect(screen.getByTestId('config-icon')).toBeInTheDocument();
      expect(screen.getByTestId('orders-icon')).toBeInTheDocument();
    });

    it('should show tooltips on hover', async () => {
      const user = userEvent.setup();

      vi.mocked(useAuth).mockReturnValue({
        user: {
          id: '1',
          type: 'internal',
          permissions: {
            global_config: true,
            candidate_workflow: true
          }
        },
        isAuthenticated: true
      });

      vi.mocked(useViewContext).mockReturnValue({
        view: 'config',
        setView: vi.fn(),
        canToggle: true
      });

      render(<ViewToggle />);

      const configButton = screen.getByRole('button', { name: /configuration view/i });
      await user.hover(configButton);

      expect(screen.getByRole('tooltip', { name: /manage system settings/i })).toBeInTheDocument();
    });
  });
});