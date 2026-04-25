// /GlobalRX_v2/src/components/portal/InvitationSuccessStep.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitationSuccessStep } from './InvitationSuccessStep';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/hooks/useToast';
import { InvitationResponse } from '@/types/inviteCandidate';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn()
}));

// Mock useToast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn()
}));

describe('InvitationSuccessStep', () => {
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'portal.inviteCandidate.successTitle': 'Invitation Created Successfully',
      'portal.inviteCandidate.successMessage': 'Invitation sent to {firstName} {lastName} at {email}',
      'portal.inviteCandidate.expirationMessage': 'This invitation expires on {date}',
      'portal.inviteCandidate.invitationLinkLabel': 'Invitation Link',
      'portal.inviteCandidate.copyLinkButton': 'Copy Link',
      'portal.inviteCandidate.doneButton': 'Done',
      'portal.inviteCandidate.linkCopied': 'Link copied to clipboard'
    };
    return translations[key] || key;
  });

  const mockToastSuccess = vi.fn();
  const mockToastError = vi.fn();
  const mockOnClose = vi.fn();

  const mockInvitation: InvitationResponse = {
    id: 'inv-1',
    token: 'test-token-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    expiresAt: '2026-05-01T00:00:00Z',
    orderId: 'order-1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTranslation).mockReturnValue({ t: mockT });
    vi.mocked(useToast).mockReturnValue({
      toastSuccess: mockToastSuccess,
      toastError: mockToastError,
      toastWarning: vi.fn(),
      toastInfo: vi.fn()
    });

    // Set up window.location for testing
    delete (window as any).location;
    (window as any).location = {
      origin: 'https://app.example.com'
    };

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn()
      },
      writable: true
    });
  });

  describe('rendering', () => {
    it('should render success icon and title', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      // Check for success icon (CheckCircle has svg element)
      const svg = document.querySelector('.lucide-check-circle');
      expect(svg).toBeInTheDocument();

      // Check for success title
      expect(screen.getByText('Invitation Created Successfully')).toBeInTheDocument();
    });

    it('should display candidate information', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      expect(screen.getByText(/Invitation sent to John Doe at john.doe@example.com/)).toBeInTheDocument();
    });

    it('should display expiration date', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      // The date should be formatted (may vary by timezone)
      expect(screen.getByText(/This invitation expires on/)).toBeInTheDocument();
    });

    it('should display invitation link', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const linkInput = screen.getByTestId('invitation-link');
      expect(linkInput).toHaveValue('https://app.example.com/invite/test-token-123');
    });

    it('should render Copy Link button', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const copyButton = screen.getByTestId('copy-link-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveTextContent('Copy Link');
    });

    it('should render Done button', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const doneButton = screen.getByRole('button', { name: /done/i });
      expect(doneButton).toBeInTheDocument();
    });

    it('should make invitation link read-only', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const linkInput = screen.getByTestId('invitation-link');
      expect(linkInput).toHaveAttribute('readonly');
    });
  });

  describe('copy link functionality', () => {
    it('should copy link to clipboard when Copy Link is clicked', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      (navigator.clipboard as any).writeText = writeTextMock;

      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const copyButton = screen.getByTestId('copy-link-button');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith('https://app.example.com/invite/test-token-123');
        expect(mockToastSuccess).toHaveBeenCalledWith('Link copied to clipboard');
      });
    });

    it('should show error toast when clipboard copy fails', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard access denied'));
      (navigator.clipboard as any).writeText = writeTextMock;

      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const copyButton = screen.getByTestId('copy-link-button');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to copy link to clipboard');
      });
    });
  });

  describe('navigation', () => {
    it('should call onClose when Done button is clicked', () => {
      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const doneButton = screen.getByRole('button', { name: /done/i });
      fireEvent.click(doneButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('date formatting', () => {
    it('should format expiration date correctly for different dates', () => {
      const testInvitation = {
        ...mockInvitation,
        expiresAt: '2026-12-25T00:00:00Z'
      };

      render(<InvitationSuccessStep invitation={testInvitation} onClose={mockOnClose} />);

      // Check that date is displayed (exact format may vary by timezone)
      expect(screen.getByText(/This invitation expires on/)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  describe('link generation', () => {
    it('should handle different base URLs correctly', () => {
      delete (window as any).location;
      (window as any).location = {
        origin: 'http://localhost:3000'
      };

      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const linkInput = screen.getByTestId('invitation-link');
      expect(linkInput).toHaveValue('http://localhost:3000/invite/test-token-123');
    });

    it('should handle empty base URL gracefully', () => {
      // Set location origin to empty string
      delete (window as any).location;
      (window as any).location = {
        origin: ''
      };

      render(<InvitationSuccessStep invitation={mockInvitation} onClose={mockOnClose} />);

      const linkInput = screen.getByTestId('invitation-link');
      expect(linkInput).toHaveValue('/invite/test-token-123');
    });
  });

  describe('special characters in data', () => {
    it('should handle special characters in names and email', () => {
      const specialInvitation: InvitationResponse = {
        ...mockInvitation,
        firstName: "Jean-François",
        lastName: "O'Brien",
        email: 'jean.francois+test@example.com'
      };

      render(<InvitationSuccessStep invitation={specialInvitation} onClose={mockOnClose} />);

      // Check that the text is rendered (regex matching can be tricky with special chars)
      expect(screen.getByText((content, element) => {
        return content.includes("Jean-François O'Brien") && content.includes("jean.francois+test@example.com");
      })).toBeInTheDocument();
    });
  });
});