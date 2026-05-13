// /GlobalRX_v2/src/app/candidate/[token]/portal/__tests__/page.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CandidatePortalPage from '../page';

// Mock next/navigation
const mockPush = vi.fn();
const mockToken = 'test-token-123';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useParams: () => ({
    token: mockToken
  })
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock child components to verify they receive correct props
vi.mock('@/components/candidate/portal-layout', () => ({
  default: ({ invitation, sections, token }: any) => (
    <div data-testid="portal-layout">
      <div data-testid="invitation-name">{invitation.firstName} {invitation.lastName}</div>
      <div data-testid="section-count">{sections.length}</div>
      <div data-testid="token">{token}</div>
    </div>
  )
}));

vi.mock('@/components/candidate/portal-expired', () => ({
  default: ({ companyName }: any) => (
    <div data-testid="portal-expired">
      Expired - Contact {companyName}
    </div>
  )
}));

vi.mock('@/components/candidate/portal-completed', () => ({
  default: ({ firstName, companyName }: any) => (
    <div data-testid="portal-completed">
      Thank you {firstName} - {companyName}
    </div>
  )
}));

describe('CandidatePortalPage', () => {
  const mockSessionResponse = {
    authenticated: true,
    invitation: {
      id: 'inv-123',
      firstName: 'Sarah',
      status: 'accessed',
      token: mockToken
    }
  };

  const mockStructureResponse = {
    invitation: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      companyName: 'Acme Corp'
    },
    sections: [
      {
        id: 'section-1',
        title: 'Notice of Processing',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null
      },
      {
        id: 'service_verification-idv',
        title: 'Identity Verification',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 1,
        functionalityType: 'verification-idv'
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('rendering', () => {
    it('should render loading state initially', () => {
      vi.mocked(fetch).mockImplementation(() =>
        new Promise(() => {}) // Never resolves to keep loading
      );

      render(<CandidatePortalPage />);

      expect(screen.getByText('candidate.portal.loading')).toBeInTheDocument();
    });

    it('should render portal layout when session is valid and invitation is not expired', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStructureResponse
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-layout')).toBeInTheDocument();
      });

      expect(screen.getByTestId('invitation-name')).toHaveTextContent('Sarah Johnson');
      expect(screen.getByTestId('section-count')).toHaveTextContent('2');
      expect(screen.getByTestId('token')).toHaveTextContent(mockToken);
    });

    it('should render expired view when invitation has expired', async () => {
      const expiredStructure = {
        ...mockStructureResponse,
        invitation: {
          ...mockStructureResponse.invitation,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Expired yesterday
        }
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => expiredStructure
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-expired')).toBeInTheDocument();
      });

      expect(screen.getByText('Expired - Contact Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.signOut')).toBeInTheDocument();
    });

    it('should render completed view when application status is completed', async () => {
      const completedStructure = {
        ...mockStructureResponse,
        invitation: {
          ...mockStructureResponse.invitation,
          status: 'completed'
        }
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => completedStructure
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-completed')).toBeInTheDocument();
      });

      expect(screen.getByText('Thank you Sarah - Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.signOut')).toBeInTheDocument();
    });

    it('should render error state when structure API fails', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.errorLoading')).toBeInTheDocument();
      });

      expect(screen.getByText('Failed to load application structure')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.tryAgain')).toBeInTheDocument();
    });
  });

  describe('authentication', () => {
    it('should redirect to login page when session is not authenticated', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false })
      } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
      });
    });

    it('should redirect to login when structure API returns 401', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
      });
    });
  });

  describe('interaction', () => {
    it('should retry loading when Try Again button is clicked after error', async () => {
      const user = userEvent.setup();

      // First load fails
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.errorLoading')).toBeInTheDocument();
      });

      // Setup successful retry
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStructureResponse
        } as Response);

      // Click retry
      await user.click(screen.getByText('candidate.portal.tryAgain'));

      await waitFor(() => {
        expect(screen.getByTestId('portal-layout')).toBeInTheDocument();
      });
    });

    it('should handle sign out from error state', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.errorLoading')).toBeInTheDocument();
      });

      // Mock signout endpoint
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      // Click sign out
      await user.click(screen.getByText('candidate.portal.signOut'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/candidate/auth/signout', {
          method: 'POST'
        });
      });

      expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
    });

    it('should handle sign out from expired state', async () => {
      const user = userEvent.setup();

      const expiredStructure = {
        ...mockStructureResponse,
        invitation: {
          ...mockStructureResponse.invitation,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => expiredStructure
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-expired')).toBeInTheDocument();
      });

      // Mock signout endpoint
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      // Click sign out
      await user.click(screen.getByText('candidate.portal.signOut'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/candidate/auth/signout', {
          method: 'POST'
        });
      });

      expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
    });

    it('should handle sign out from completed state', async () => {
      const user = userEvent.setup();

      const completedStructure = {
        ...mockStructureResponse,
        invitation: {
          ...mockStructureResponse.invitation,
          status: 'completed'
        }
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => completedStructure
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-completed')).toBeInTheDocument();
      });

      // Mock signout endpoint
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      // Click sign out
      await user.click(screen.getByText('candidate.portal.signOut'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/candidate/auth/signout', {
          method: 'POST'
        });
      });

      expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
    });
  });

  describe('edge cases', () => {
    it('should handle empty sections list', async () => {
      const emptyStructure = {
        ...mockStructureResponse,
        sections: []
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => emptyStructure
        } as Response);

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByTestId('portal-layout')).toBeInTheDocument();
      });

      expect(screen.getByTestId('section-count')).toHaveTextContent('0');
    });

    it('should handle network error during structure fetch', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionResponse
        } as Response)
        .mockRejectedValueOnce(new Error('Structure fetch failed'));

      render(<CandidatePortalPage />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.errorLoading')).toBeInTheDocument();
      });

      expect(screen.getByText('Structure fetch failed')).toBeInTheDocument();
    });
  });
});