// /GlobalRX_v2/src/components/portal/InviteCandidateButton.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InviteCandidateButton from './InviteCandidateButton';
import { useAuth } from '@/contexts/AuthContext';
import { canInviteCandidates } from '@/lib/auth-utils';

// Mock AuthContext - matches the import from the component
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock auth-utils
vi.mock('@/lib/auth-utils', () => ({
  canInviteCandidates: vi.fn()
}));

// Mock InviteCandidateDialog since we're testing the button, not the dialog
vi.mock('@/components/portal/InviteCandidateDialog', () => ({
  default: vi.fn(({ open, onOpenChange }) => (
    open ? <div data-testid="invite-candidate-dialog">Dialog Mock</div> : null
  ))
}));

describe('InviteCandidateButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('permission checks', () => {
    it('should not render when user is null', () => {
      vi.mocked(useAuth).mockReturnValue({ user: null });
      vi.mocked(canInviteCandidates).mockReturnValue(false);

      const { container } = render(<InviteCandidateButton />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button', { name: /invite candidate/i })).not.toBeInTheDocument();
    });

    it('should not render when user lacks candidates.invite permission', () => {
      const mockUser = {
        id: 'user-1',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {}
      };

      vi.mocked(useAuth).mockReturnValue({ user: mockUser });
      vi.mocked(canInviteCandidates).mockReturnValue(false);

      const { container } = render(<InviteCandidateButton />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByRole('button', { name: /invite candidate/i })).not.toBeInTheDocument();
    });

    it('should render button when user has candidates.invite permission', () => {
      const mockUser = {
        id: 'user-1',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {
          candidates: {
            invite: true
          }
        }
      };

      vi.mocked(useAuth).mockReturnValue({ user: mockUser });
      vi.mocked(canInviteCandidates).mockReturnValue(true);

      render(<InviteCandidateButton />);

      const button = screen.getByRole('button', { name: /invite candidate/i });
      expect(button).toBeInTheDocument();
    });

    it('should render button for internal user with candidates.invite permission', () => {
      const mockUser = {
        id: 'user-1',
        userType: 'internal',
        permissions: {
          candidates: {
            invite: true
          }
        }
      };

      vi.mocked(useAuth).mockReturnValue({ user: mockUser });
      vi.mocked(canInviteCandidates).mockReturnValue(true);

      render(<InviteCandidateButton />);

      const button = screen.getByRole('button', { name: /invite candidate/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('button rendering', () => {
    beforeEach(() => {
      const mockUser = {
        id: 'user-1',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {
          candidates: {
            invite: true
          }
        }
      };

      vi.mocked(useAuth).mockReturnValue({ user: mockUser });
      vi.mocked(canInviteCandidates).mockReturnValue(true);
    });

    it('should render button with correct text and icon', () => {
      render(<InviteCandidateButton />);

      const button = screen.getByRole('button', { name: /invite candidate/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Invite Candidate');

      // Check for icon presence (UserPlus icon has svg element)
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have default variant styling', () => {
      render(<InviteCandidateButton />);

      const button = screen.getByRole('button', { name: /invite candidate/i });
      expect(button).toHaveClass('gap-2');
    });
  });

  describe('dialog interaction', () => {
    beforeEach(() => {
      const mockUser = {
        id: 'user-1',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {
          candidates: {
            invite: true
          }
        }
      };

      vi.mocked(useAuth).mockReturnValue({ user: mockUser });
      vi.mocked(canInviteCandidates).mockReturnValue(true);
    });

    it('should not show dialog initially', () => {
      render(<InviteCandidateButton />);

      expect(screen.queryByTestId('invite-candidate-dialog')).not.toBeInTheDocument();
    });

    it('should open dialog when button is clicked', async () => {
      const user = userEvent.setup();
      render(<InviteCandidateButton />);

      const button = screen.getByRole('button', { name: /invite candidate/i });
      await user.click(button);

      expect(screen.getByTestId('invite-candidate-dialog')).toBeInTheDocument();
    });

    it('should pass correct props to InviteCandidateDialog', async () => {
      const user = userEvent.setup();
      const { default: InviteCandidateDialogMock } = await import('@/components/portal/InviteCandidateDialog');

      render(<InviteCandidateButton />);

      // Initially closed
      expect(InviteCandidateDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          open: false,
          onOpenChange: expect.any(Function)
        }),
        expect.any(Object)
      );

      // Click to open
      const button = screen.getByRole('button', { name: /invite candidate/i });
      await user.click(button);

      // Should now be called with open: true
      expect(InviteCandidateDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          open: true,
          onOpenChange: expect.any(Function)
        }),
        expect.any(Object)
      );
    });

    it('should handle dialog close callback', async () => {
      const user = userEvent.setup();
      const { default: InviteCandidateDialogMock } = await import('@/components/portal/InviteCandidateDialog');

      // Modify mock to simulate closing dialog via callback
      InviteCandidateDialogMock.mockImplementation(({ open, onOpenChange }) => {
        if (open) {
          return (
            <div data-testid="invite-candidate-dialog">
              <button onClick={() => onOpenChange(false)}>Close</button>
            </div>
          );
        }
        return null;
      });

      render(<InviteCandidateButton />);

      // Open dialog
      const button = screen.getByRole('button', { name: /invite candidate/i });
      await user.click(button);
      expect(screen.getByTestId('invite-candidate-dialog')).toBeInTheDocument();

      // Close dialog
      const closeButton = screen.getByText('Close');
      await user.click(closeButton);
      expect(screen.queryByTestId('invite-candidate-dialog')).not.toBeInTheDocument();
    });
  });
});