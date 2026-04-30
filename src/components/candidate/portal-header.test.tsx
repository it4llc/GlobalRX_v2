// /GlobalRX_v2/src/components/candidate/portal-header.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalHeader from './portal-header';
import type { CandidateInvitationInfo } from '@/types/candidate-portal';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} - ${JSON.stringify(params)}`;
      }
      return key;
    }
  })
}));

// Mock global fetch
global.fetch = vi.fn();

describe('PortalHeader', () => {
  const mockInvitation: CandidateInvitationInfo = {
    firstName: 'Sarah',
    lastName: 'Johnson',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    companyName: 'Acme Corp'
  };

  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();
  });

  describe('rendering', () => {
    it('should render welcome message with first name', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      expect(screen.getByText(/candidate\.portal\.welcome.*"firstName":"Sarah"/)).toBeInTheDocument();
    });

    it('should render sign out button', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      expect(screen.getByText('candidate.portal.signOut')).toBeInTheDocument();
    });

    it('should render hamburger menu button when showMenuButton is true', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={true}
          onMenuToggle={vi.fn()}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('should not render hamburger menu button when showMenuButton is false', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={false}
        />
      );

      const menuButton = screen.queryByLabelText('candidate.portal.menu');
      expect(menuButton).not.toBeInTheDocument();
    });

    it('should not render hamburger menu button by default', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const menuButton = screen.queryByLabelText('candidate.portal.menu');
      expect(menuButton).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    it('should call onMenuToggle when hamburger menu is clicked', async () => {
      const user = userEvent.setup();
      const onMenuToggle = vi.fn();

      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={true}
          onMenuToggle={onMenuToggle}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');
      await user.click(menuButton);

      expect(onMenuToggle).toHaveBeenCalledTimes(1);
    });

    it('should handle sign out when sign out button is clicked', async () => {
      const user = userEvent.setup();

      // Mock successful logout response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const signOutButton = screen.getByText('candidate.portal.signOut');
      await user.click(signOutButton);

      // Should call logout endpoint
      expect(fetch).toHaveBeenCalledWith('/api/candidate/auth/logout', {
        method: 'POST'
      });

      // Should redirect to landing page
      expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
    });

    it('should redirect even if logout API fails', async () => {
      const user = userEvent.setup();

      // Mock failed logout response (500 error) instead of network rejection
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const signOutButton = screen.getByText('candidate.portal.signOut');
      await user.click(signOutButton);

      // Wait for the async handleSignOut to complete
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
      });
    });

    it('should handle multiple rapid clicks on sign out', async () => {
      const user = userEvent.setup();

      // Mock successful logout responses
      vi.mocked(fetch).mockResolvedValue({
        ok: true
      } as Response);

      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const signOutButton = screen.getByText('candidate.portal.signOut');

      // Click multiple times rapidly
      await user.click(signOutButton);
      await user.click(signOutButton);
      await user.click(signOutButton);

      // Should only redirect once per click (not debounced)
      expect(mockPush).toHaveBeenCalledTimes(3);
      expect(mockPush).toHaveBeenCalledWith(`/candidate/${mockToken}`);
    });
  });

  describe('styling and responsiveness', () => {
    it('should have correct header styles', () => {
      const { container } = render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const header = container.querySelector('header');
      expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200');
    });

    it('should have correct height for header content', () => {
      const { container } = render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
        />
      );

      const headerContent = container.querySelector('.h-16');
      expect(headerContent).toBeInTheDocument();
    });

    it('should apply hover styles to hamburger menu button', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={true}
          onMenuToggle={vi.fn()}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');
      expect(menuButton).toHaveClass('hover:text-gray-900', 'hover:bg-gray-100');
    });

    it('should show md:hidden class on hamburger button for responsive behavior', () => {
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={true}
          onMenuToggle={vi.fn()}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');
      expect(menuButton).toHaveClass('md:hidden');
    });
  });

  describe('edge cases', () => {
    it('should handle invitation with very long first name', () => {
      const longNameInvitation: CandidateInvitationInfo = {
        ...mockInvitation,
        firstName: 'Verylongfirstnamethatmightcauseoverflowissues'
      };

      render(
        <PortalHeader
          invitation={longNameInvitation}
          token={mockToken}
        />
      );

      expect(screen.getByText(/candidate\.portal\.welcome.*Verylongfirstnamethatmightcauseoverflowissues/))
        .toBeInTheDocument();
    });

    it('should handle empty token gracefully', async () => {
      const user = userEvent.setup();

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true
      } as Response);

      render(
        <PortalHeader
          invitation={mockInvitation}
          token=""
        />
      );

      const signOutButton = screen.getByText('candidate.portal.signOut');
      await user.click(signOutButton);

      // Should still redirect, even with empty token
      expect(mockPush).toHaveBeenCalledWith('/candidate/');
    });

    it('should handle undefined onMenuToggle when showMenuButton is true', async () => {
      const user = userEvent.setup();

      // This shouldn't crash even if onMenuToggle is undefined
      render(
        <PortalHeader
          invitation={mockInvitation}
          token={mockToken}
          showMenuButton={true}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');

      // Should not throw error when clicking
      await expect(user.click(menuButton)).resolves.not.toThrow();
    });
  });
});