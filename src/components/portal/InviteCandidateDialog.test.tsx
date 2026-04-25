// /GlobalRX_v2/src/components/portal/InviteCandidateDialog.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InviteCandidateDialog from './InviteCandidateDialog';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/contexts/TranslationContext';
import { DialogStep } from '@/types/inviteCandidate';

// Mock dependencies
vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn()
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn()
}));

vi.mock('@/components/ui/modal-dialog', () => ({
  ModalDialog: React.forwardRef(({ children, title, onClose, 'data-testid': testId }: any, ref: any) => (
    <div data-testid={testId}>
      {title && <h2>{title}</h2>}
      {children}
      <button onClick={onClose}>Close Dialog</button>
    </div>
  )),
  DialogRef: {}
}));

// Mock the step components
vi.mock('./PackageSelectionStep', () => ({
  PackageSelectionStep: vi.fn(({ packages, onNext, isLoading }) => (
    <div data-testid="package-selection-step">
      <div>Package Selection Step</div>
      <div>Packages count: {packages.length}</div>
      <button
        onClick={() => onNext('pkg-1')}
        disabled={isLoading}
      >
        Next
      </button>
    </div>
  ))
}));

vi.mock('./CandidateInfoStep', () => ({
  CandidateInfoStep: vi.fn(({ onBack, onSubmit, isSubmitting }) => (
    <div data-testid="candidate-info-step">
      <div>Candidate Info Step</div>
      <button onClick={onBack}>Back</button>
      <button
        onClick={() => onSubmit({
          packageId: 'pkg-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })}
        disabled={isSubmitting}
      >
        Submit
      </button>
    </div>
  ))
}));

vi.mock('./InvitationSuccessStep', () => ({
  InvitationSuccessStep: vi.fn(({ invitation, onClose }) => (
    <div data-testid="invitation-success-step">
      <div>Success!</div>
      <div>Token: {invitation.token}</div>
      <button onClick={onClose}>Done</button>
    </div>
  ))
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('InviteCandidateDialog', () => {
  const mockToastError = vi.fn();
  const mockToastSuccess = vi.fn();
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'portal.inviteCandidate.dialogTitle': 'Invite Candidate',
      'portal.inviteCandidate.errorNoPermission': 'You do not have permission',
      'portal.inviteCandidate.errorNetworkFailure': 'Network error',
      'portal.inviteCandidate.errorNoWorkflow': 'Package has no workflow'
    };
    return translations[key] || key;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({
      toastError: mockToastError,
      toastSuccess: mockToastSuccess,
      toastWarning: vi.fn(),
      toastInfo: vi.fn()
    });
    vi.mocked(useTranslation).mockReturnValue({ t: mockT });
  });

  describe('dialog lifecycle', () => {
    it('should render dialog when open is true', () => {
      render(<InviteCandidateDialog open={true} />);

      expect(screen.getByTestId('invite-candidate-dialog')).toBeInTheDocument();
    });

    it('should render but not fetch packages when open is false', () => {
      render(<InviteCandidateDialog open={false} />);

      // Should not fetch packages when closed
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch packages when dialog opens', async () => {
      const mockPackages = [
        { id: 'pkg-1', name: 'Package 1', hasWorkflow: true }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPackages
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/packages?hasWorkflow=true');
      });
    });

    it('should reset state when dialog closes', async () => {
      const { rerender } = render(<InviteCandidateDialog open={true} />);

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      // Close and reopen dialog
      rerender(<InviteCandidateDialog open={false} />);
      rerender(<InviteCandidateDialog open={true} />);

      // Should fetch packages again
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('step navigation', () => {
    it('should start with package selection step', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });
    });

    it('should navigate to candidate info step when package is selected', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(screen.getByTestId('candidate-info-step')).toBeInTheDocument();
      expect(screen.queryByTestId('package-selection-step')).not.toBeInTheDocument();
    });

    it('should navigate back to package selection from candidate info', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      // Go to candidate info
      fireEvent.click(screen.getByText('Next'));
      expect(screen.getByTestId('candidate-info-step')).toBeInTheDocument();

      // Go back
      fireEvent.click(screen.getByText('Back'));
      expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
    });

    it('should navigate to success step after successful submission', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'inv-1',
            token: 'test-token',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            expiresAt: '2026-05-01'
          })
        } as Response);

      render(<InviteCandidateDialog open={true} />);

      // Wait for packages to load
      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      // Select package
      fireEvent.click(screen.getByText('Next'));

      // Submit candidate info
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-success-step')).toBeInTheDocument();
      });

      expect(screen.getByText('Token: test-token')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should show error toast when package fetch fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should show permission error for 403 response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('You do not have permission');
      });
    });

    it('should show workflow error for 422 response on submission', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({ error: 'No workflow' })
        } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      // Select package and submit
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Package has no workflow');
      });
    });
  });

  describe('dialog closing', () => {
    it('should call onOpenChange when dialog is closed', () => {
      const mockOnOpenChange = vi.fn();
      render(<InviteCandidateDialog open={true} onOpenChange={mockOnOpenChange} />);

      fireEvent.click(screen.getByText('Close Dialog'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should call onClose when provided', () => {
      const mockOnClose = vi.fn();
      render(<InviteCandidateDialog open={true} onClose={mockOnClose} />);

      fireEvent.click(screen.getByText('Close Dialog'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close from success step', async () => {
      const mockOnOpenChange = vi.fn();

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'inv-1',
            token: 'test-token',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            expiresAt: '2026-05-01'
          })
        } as Response);

      render(<InviteCandidateDialog open={true} onOpenChange={mockOnOpenChange} />);

      // Navigate to success
      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-success-step')).toBeInTheDocument();
      });

      // Click Done
      fireEvent.click(screen.getByText('Done'));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('dialog title', () => {
    it('should show title for package selection step', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByText('Invite Candidate')).toBeInTheDocument();
      });
    });

    it('should show title for candidate info step', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
      } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));

      expect(screen.getByText('Invite Candidate')).toBeInTheDocument();
    });

    it('should hide title for success step', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'pkg-1', name: 'Package 1' }]
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'inv-1',
            token: 'test-token',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com'
          })
        } as Response);

      render(<InviteCandidateDialog open={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('package-selection-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Next'));
      fireEvent.click(screen.getByText('Submit'));

      await waitFor(() => {
        expect(screen.getByTestId('invitation-success-step')).toBeInTheDocument();
      });

      // Title should not be displayed for success step
      expect(screen.queryByText('Invite Candidate')).not.toBeInTheDocument();
    });
  });
});