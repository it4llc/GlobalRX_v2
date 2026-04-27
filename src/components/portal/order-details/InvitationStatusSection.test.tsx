// /GlobalRX_v2/src/components/portal/order-details/InvitationStatusSection.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationStatusSection } from './InvitationStatusSection';
import { InvitationStatusDisplay } from '@/types/invitation-management';

// Create mock functions for toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  })
}));

// Mock useToast
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toastSuccess: mockToastSuccess,
    toastError: mockToastError
  })
}));

// Mock InvitationConfirmDialog
vi.mock('./InvitationConfirmDialog', () => ({
  InvitationConfirmDialog: vi.fn(({ isOpen, onClose, onConfirm, action, isLoading }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <div>Action: {action}</div>
        <button onClick={onClose}>Close</button>
        <button onClick={onConfirm} disabled={isLoading}>Confirm</button>
      </div>
    );
  })
}));

describe('InvitationStatusSection', () => {
  const mockInvitation: InvitationStatusDisplay = {
    id: 'inv-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phoneCountryCode: '1',
    phoneNumber: '5551234567',
    status: 'sent',
    expiresAt: new Date('2026-05-15T12:00:00Z'),
    lastAccessedAt: null,
    createdAt: new Date('2026-04-01T10:00:00Z')
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('rendering for all statuses', () => {
    it('should render invitation with sent status', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByTestId('invitation-status-section')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByTestId('invitation-status-badge')).toHaveTextContent('invitation.status.sent');
      expect(screen.getByTestId('invitation-status-badge')).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should render invitation with opened status', () => {
      const openedInvitation = { ...mockInvitation, status: 'opened' as const };
      render(
        <InvitationStatusSection
          invitation={openedInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByTestId('invitation-status-badge')).toHaveTextContent('invitation.status.opened');
      expect(screen.getByTestId('invitation-status-badge')).toHaveClass('bg-orange-100', 'text-orange-800');
    });

    it('should render invitation with in_progress status', () => {
      const inProgressInvitation = { ...mockInvitation, status: 'in_progress' as const };
      render(
        <InvitationStatusSection
          invitation={inProgressInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByTestId('invitation-status-badge')).toHaveTextContent('invitation.status.inprogress');
      expect(screen.getByTestId('invitation-status-badge')).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('should render invitation with completed status', () => {
      const completedInvitation = { ...mockInvitation, status: 'completed' as const };
      render(
        <InvitationStatusSection
          invitation={completedInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByTestId('invitation-status-badge')).toHaveTextContent('invitation.status.completed');
      expect(screen.getByTestId('invitation-status-badge')).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should render invitation with expired status and highlight expiration date', () => {
      const expiredInvitation = { ...mockInvitation, status: 'expired' as const };
      render(
        <InvitationStatusSection
          invitation={expiredInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByTestId('invitation-status-badge')).toHaveTextContent('invitation.status.expired');
      expect(screen.getByTestId('invitation-status-badge')).toHaveClass('bg-red-100', 'text-red-800');

      // Check expiration date is highlighted
      const expiresText = screen.getByText(/May 15, 2026/);
      expect(expiresText).toHaveClass('text-red-600', 'font-medium');
    });
  });

  describe('field display', () => {
    it('should display all required fields', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByText('invitation.status.candidateName:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      expect(screen.getByText('invitation.status.email:')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();

      expect(screen.getByText('invitation.status.status:')).toBeInTheDocument();
      expect(screen.getByTestId('invitation-status-badge')).toBeInTheDocument();

      expect(screen.getByText('invitation.status.expires:')).toBeInTheDocument();
      expect(screen.getByText(/May 15, 2026/)).toBeInTheDocument();
    });

    it('should display "Not yet accessed" placeholder when lastAccessedAt is null', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByText('invitation.status.lastAccessed:')).toBeInTheDocument();
      expect(screen.getByText('invitation.status.notYetAccessed')).toBeInTheDocument();
    });

    it('should display formatted last accessed date when present', () => {
      const invitationWithAccess = {
        ...mockInvitation,
        lastAccessedAt: new Date('2026-04-10T14:30:00Z')
      };

      render(
        <InvitationStatusSection
          invitation={invitationWithAccess}
          canManageInvitations={false}
        />
      );

      expect(screen.getByText(/Apr 10, 2026/)).toBeInTheDocument();
    });

    it('should display phone number with country code when provided', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.getByText('invitation.status.phone:')).toBeInTheDocument();
      expect(screen.getByText('+1 5551234567')).toBeInTheDocument();
    });

    it('should omit phone field when not provided', () => {
      const invitationWithoutPhone = {
        ...mockInvitation,
        phoneCountryCode: null,
        phoneNumber: null
      };

      render(
        <InvitationStatusSection
          invitation={invitationWithoutPhone}
          canManageInvitations={false}
        />
      );

      expect(screen.queryByText('invitation.status.phone:')).not.toBeInTheDocument();
    });
  });

  describe('button visibility based on canManageInvitations', () => {
    it('should not show action buttons when canManageInvitations is false', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={false}
        />
      );

      expect(screen.queryByTestId('extend-invitation-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('resend-invitation-button')).not.toBeInTheDocument();
    });

    it('should show action buttons when canManageInvitations is true', () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('extend-invitation-button')).toBeInTheDocument();
      expect(screen.getByTestId('resend-invitation-button')).toBeInTheDocument();
    });
  });

  describe('extend button visibility based on status', () => {
    it('should show extend button for sent status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'sent' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('extend-invitation-button')).toBeInTheDocument();
    });

    it('should show extend button for opened status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'opened' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('extend-invitation-button')).toBeInTheDocument();
    });

    it('should show extend button for in_progress status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'in_progress' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('extend-invitation-button')).toBeInTheDocument();
    });

    it('should show extend button for expired status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'expired' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('extend-invitation-button')).toBeInTheDocument();
    });

    it('should not show extend button for completed status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'completed' }}
          canManageInvitations={true}
        />
      );

      expect(screen.queryByTestId('extend-invitation-button')).not.toBeInTheDocument();
    });
  });

  describe('resend button visibility based on status', () => {
    it('should show resend button for sent status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'sent' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('resend-invitation-button')).toBeInTheDocument();
    });

    it('should show resend button for opened status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'opened' }}
          canManageInvitations={true}
        />
      );

      expect(screen.getByTestId('resend-invitation-button')).toBeInTheDocument();
    });

    it('should not show resend button for in_progress status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'in_progress' }}
          canManageInvitations={true}
        />
      );

      expect(screen.queryByTestId('resend-invitation-button')).not.toBeInTheDocument();
    });

    it('should not show resend button for completed status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'completed' }}
          canManageInvitations={true}
        />
      );

      expect(screen.queryByTestId('resend-invitation-button')).not.toBeInTheDocument();
    });

    it('should not show resend button for expired status', () => {
      render(
        <InvitationStatusSection
          invitation={{ ...mockInvitation, status: 'expired' }}
          canManageInvitations={true}
        />
      );

      expect(screen.queryByTestId('resend-invitation-button')).not.toBeInTheDocument();
    });
  });

  describe('action handling', () => {
    it('should open confirmation dialog when extend button is clicked', async () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
        />
      );

      const extendButton = screen.getByTestId('extend-invitation-button');
      fireEvent.click(extendButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText('Action: extend')).toBeInTheDocument();
      });
    });

    it('should open confirmation dialog when resend button is clicked', async () => {
      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
        />
      );

      const resendButton = screen.getByTestId('resend-invitation-button');
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText('Action: resend')).toBeInTheDocument();
      });
    });

    it('should call API and show success message when extend is confirmed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      vi.stubGlobal('fetch', mockFetch);

      const onActionSuccess = vi.fn();

      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
          onActionSuccess={onActionSuccess}
        />
      );

      // Click extend button
      fireEvent.click(screen.getByTestId('extend-invitation-button'));

      // Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/candidate/invitations/inv-123/extend',
          { method: 'POST' }
        );
        expect(mockToastSuccess).toHaveBeenCalledWith('invitation.action.extendSuccess');
        expect(onActionSuccess).toHaveBeenCalled();
      });
    });

    it('should call API and show success message when resend is confirmed', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });
      vi.stubGlobal('fetch', mockFetch);

      const onActionSuccess = vi.fn();

      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
          onActionSuccess={onActionSuccess}
        />
      );

      // Click resend button
      fireEvent.click(screen.getByTestId('resend-invitation-button'));

      // Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/candidate/invitations/inv-123/resend',
          { method: 'POST' }
        );
        expect(mockToastSuccess).toHaveBeenCalledWith('invitation.action.resendSuccess');
        expect(onActionSuccess).toHaveBeenCalled();
      });
    });

    it('should show error message when API call fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Network error' })
      });
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
        />
      );

      // Click extend button
      fireEvent.click(screen.getByTestId('extend-invitation-button'));

      // Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('invitation.action.extendError');
      });
    });

    it('should disable buttons while action is processing', async () => {
      // Mock a slow API call
      const mockFetch = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100))
      );
      vi.stubGlobal('fetch', mockFetch);

      render(
        <InvitationStatusSection
          invitation={mockInvitation}
          canManageInvitations={true}
        />
      );

      const extendButton = screen.getByTestId('extend-invitation-button');
      const resendButton = screen.getByTestId('resend-invitation-button');

      // Click extend
      fireEvent.click(extendButton);

      // Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: 'Confirm' });
        fireEvent.click(confirmButton);
      });

      // Buttons should be disabled during processing
      expect(extendButton).toBeDisabled();
      expect(resendButton).toBeDisabled();
    });
  });
});