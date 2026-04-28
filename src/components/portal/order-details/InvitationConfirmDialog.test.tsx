// /GlobalRX_v2/src/components/portal/order-details/InvitationConfirmDialog.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvitationConfirmDialog } from './InvitationConfirmDialog';
import { InvitationAction } from '@/types/invitation-management';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.cancel': 'Cancel',
        'invitation.action.extend': 'Extend',
        'invitation.action.resend': 'Resend',
        'invitation.action.extendConfirm': 'Are you sure you want to extend the expiration date?',
        'invitation.action.resendConfirm': 'Are you sure you want to resend the invitation email?',
        'invitation.action.extending': 'Extending...',
        'invitation.action.resending': 'Resending...'
      };
      return translations[key] || key;
    },
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  })
}));

describe('InvitationConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    action: InvitationAction.EXTEND,
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <InvitationConfirmDialog
          {...defaultProps}
          isOpen={false}
        />
      );

      const dialog = container.querySelector('dialog');
      expect(dialog).not.toHaveAttribute('open');
    });

    it('should render when isOpen is true', () => {
      const { container } = render(<InvitationConfirmDialog {...defaultProps} />);

      const dialog = container.querySelector('dialog');
      expect(dialog).toHaveAttribute('open');
    });

    it('should display extend action content', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
        />
      );

      const title = document.getElementById('dialog-title');
      expect(title).toHaveTextContent('Extend');
      expect(screen.getByText('Are you sure you want to extend the expiration date?')).toBeInTheDocument();
    });

    it('should display resend action content', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.RESEND}
        />
      );

      const title = document.getElementById('dialog-title');
      expect(title).toHaveTextContent('Resend');
      expect(screen.getByText('Are you sure you want to resend the invitation email?')).toBeInTheDocument();
    });

    it('should always show cancel button', () => {
      render(<InvitationConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('callbacks', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();

      render(
        <InvitationConfirmDialog
          {...defaultProps}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should render confirm button', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
        />
      );

      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('should call onClose when dialog is dismissed via X button', () => {
      const onClose = vi.fn();

      render(
        <InvitationConfirmDialog
          {...defaultProps}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByLabelText('Close dialog');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('should remain open when isLoading is true for extend action', () => {
      const { container } = render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
          isLoading={true}
        />
      );

      const dialog = container.querySelector('dialog');
      expect(dialog).toHaveAttribute('open');
    });

    it('should remain open when isLoading is true for resend action', () => {
      const { container } = render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.RESEND}
          isLoading={true}
        />
      );

      const dialog = container.querySelector('dialog');
      expect(dialog).toHaveAttribute('open');
    });

    it('should show cancel button during loading', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          isLoading={true}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should show confirm button during loading', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          isLoading={true}
        />
      );

      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('should show buttons when isLoading is false', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          isLoading={false}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper dialog title', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
        />
      );

      const title = document.getElementById('dialog-title');
      expect(title).toHaveTextContent('Extend');
    });

    it('should have proper dialog description', () => {
      render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
        />
      );

      expect(screen.getByText('Are you sure you want to extend the expiration date?')).toBeInTheDocument();
    });

    it('should have Cancel button', () => {
      render(<InvitationConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should have Confirm button', () => {
      render(<InvitationConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });
  });

  describe('action switching', () => {
    it('should update content when action prop changes', () => {
      const { rerender } = render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
        />
      );

      const title = document.getElementById('dialog-title');
      expect(title).toHaveTextContent('Extend');
      expect(screen.getByText('Are you sure you want to extend the expiration date?')).toBeInTheDocument();

      rerender(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.RESEND}
        />
      );

      expect(title).toHaveTextContent('Resend');
      expect(screen.getByText('Are you sure you want to resend the invitation email?')).toBeInTheDocument();
    });

    it('should maintain buttons when action changes', () => {
      const { rerender } = render(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.EXTEND}
          isLoading={false}
        />
      );

      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();

      rerender(
        <InvitationConfirmDialog
          {...defaultProps}
          action={InvitationAction.RESEND}
          isLoading={false}
        />
      );

      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});