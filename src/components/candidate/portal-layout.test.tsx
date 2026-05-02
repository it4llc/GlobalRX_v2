// /GlobalRX_v2/src/components/candidate/portal-layout.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalLayout from './portal-layout';
import type { CandidateInvitationInfo, CandidatePortalSection } from '@/types/candidate-portal';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Note: We do NOT mock the child components per Rule M2 - they render meaningful DOM that we need to test

describe('PortalLayout', () => {
  const mockInvitation: CandidateInvitationInfo = {
    firstName: 'Sarah',
    lastName: 'Johnson',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    companyName: 'Acme Corp'
  };

  const mockSections: CandidatePortalSection[] = [
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
      id: 'service_idv',
      title: 'Identity Verification',
      type: 'service_section',
      placement: 'services',
      status: 'not_started',
      order: 1,
      functionalityType: 'idv'
    },
    {
      id: 'service_record',
      title: 'Address History',
      type: 'service_section',
      placement: 'services',
      status: 'in_progress',
      order: 2,
      functionalityType: 'record'
    },
    {
      id: 'section-2',
      title: 'Consent Form',
      type: 'workflow_section',
      placement: 'after_services',
      status: 'complete',
      order: 3,
      functionalityType: null
    }
  ];

  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render header with welcome message', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      expect(screen.getByText('candidate.portal.welcome')).toBeInTheDocument();
    });

    it('should render sidebar with all sections on desktop', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Check that all sections are displayed (use getAllByText since sections appear in sidebar)
      expect(screen.getAllByText('Notice of Processing')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Identity Verification')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Address History')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Consent Form')[0]).toBeInTheDocument();
    });

    it('should render welcome content by default', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.companyContext')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.sectionCount')).toBeInTheDocument();
    });

    it('should show hamburger menu button on mobile', () => {
      // Set viewport to mobile size
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Hamburger button should be visible
      const menuButton = screen.getByLabelText('candidate.portal.menu');
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('section navigation', () => {
    it('should display section placeholder when a section is clicked', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Click on a section (get the button element)
      const sectionButton = screen.getAllByText('Identity Verification')[0].closest('button');
      await user.click(sectionButton!);

      // Should show section placeholder
      expect(screen.getAllByText('Identity Verification')[0]).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.sectionPlaceholder')).toBeInTheDocument();
    });

    it('should highlight active section in sidebar', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Click on a section
      const sectionButton = screen.getAllByText('Address History')[0].closest('button');
      await user.click(sectionButton!);

      // Check that the section is highlighted (has active classes)
      expect(sectionButton).toHaveClass('bg-blue-50', 'text-blue-700');
    });

    it('should show welcome content when no section is selected', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
      expect(screen.queryByText('candidate.portal.sectionPlaceholder')).not.toBeInTheDocument();
    });

    it('should handle clicking on non-existent section gracefully', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Click on a section first
      const sectionButton = screen.getAllByText('Notice of Processing')[0].closest('button');
      await user.click(sectionButton!);
      expect(screen.getByText('candidate.portal.sectionPlaceholder')).toBeInTheDocument();

      // Simulate activeSection being set to invalid ID somehow
      // Since we can't directly manipulate state, we'll test the fallback behavior
      // by removing the clicked section from the list
      const sectionsWithoutFirst = mockSections.slice(1);
      rerender(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsWithoutFirst}
          token={mockToken}
        />
      );

      // Should fall back to welcome content
      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
    });
  });

  describe('mobile menu behavior', () => {
    beforeEach(() => {
      // Set viewport to mobile size
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
    });

    it('should toggle mobile menu when hamburger button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      const menuButton = screen.getByLabelText('candidate.portal.menu');

      // Initially menu should be closed (transformed off-screen)
      const mobileMenu = document.querySelector('.md\\:hidden.transform');
      expect(mobileMenu).toHaveClass('-translate-x-full');

      // Click to open
      await user.click(menuButton);

      // Menu should be open (transformed on-screen)
      expect(mobileMenu).toHaveClass('translate-x-0');

      // Click close button
      const closeButton = screen.getByLabelText('Close menu');
      await user.click(closeButton);

      // Menu should be closed again
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('-translate-x-full');
      });
    });

    it('should close mobile menu when a section is selected', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Open menu
      const menuButton = screen.getByLabelText('candidate.portal.menu');
      await user.click(menuButton);

      // Menu should be open
      const mobileMenu = document.querySelector('.md\\:hidden.transform');
      expect(mobileMenu).toHaveClass('translate-x-0');

      // Click on a section in the mobile menu
      const sectionButtons = screen.getAllByText('Identity Verification');
      // Find the one in the mobile menu
      const mobileSectionButton = sectionButtons.find(el =>
        el.closest('.md\\:hidden.transform')
      );

      await user.click(mobileSectionButton!);

      // Menu should close and section should be displayed
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('-translate-x-full');
      });
      expect(screen.getByText('candidate.portal.sectionPlaceholder')).toBeInTheDocument();
    });

    it('should close mobile menu when clicking outside', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Open menu
      const menuButton = screen.getByLabelText('candidate.portal.menu');
      await user.click(menuButton);

      // Menu should be open
      const mobileMenu = document.querySelector('.md\\:hidden.transform');
      expect(mobileMenu).toHaveClass('translate-x-0');

      // Click on overlay (outside menu)
      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).toBeInTheDocument();

      await user.click(overlay!);

      // Menu should close
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('-translate-x-full');
      });
    });

    it('should automatically close mobile menu when resizing to desktop', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Open menu
      const menuButton = screen.getByLabelText('candidate.portal.menu');
      await user.click(menuButton);

      // Menu should be open
      const mobileMenu = document.querySelector('.md\\:hidden.transform');
      expect(mobileMenu).toHaveClass('translate-x-0');

      // Resize to desktop
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));

      // Menu should automatically close
      await waitFor(() => {
        expect(mobileMenu).toHaveClass('-translate-x-full');
      });
    });
  });

  describe('section status indicators', () => {
    it('should display correct status icons for each section', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Check for status indicators (they are rendered as colored divs with specific classes)
      const sidebarNav = screen.getAllByRole('navigation')[0];

      // Not started - gray circle
      const notStartedSections = sidebarNav.querySelectorAll('.bg-gray-300');
      expect(notStartedSections).toHaveLength(2); // Notice of Processing and Identity Verification

      // In progress - blue circle
      const inProgressSections = sidebarNav.querySelectorAll('.bg-blue-500');
      expect(inProgressSections).toHaveLength(1); // Address History

      // Complete - green circle with checkmark
      const completeSections = sidebarNav.querySelectorAll('.bg-green-500');
      expect(completeSections).toHaveLength(1); // Consent Form
    });
  });

  describe('edge cases', () => {
    it('should handle empty sections list', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={[]}
          token={mockToken}
        />
      );

      // Should show welcome with 0 sections
      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.sectionCount')).toBeInTheDocument();

      // No sections in sidebar
      const sidebarNav = screen.getAllByRole('navigation')[0];
      const sectionButtons = sidebarNav.querySelectorAll('button');
      expect(sectionButtons).toHaveLength(0);
    });

    it('should handle sections with long titles', () => {
      const longTitleSections: CandidatePortalSection[] = [
        {
          id: 'long-1',
          title: 'This is a very long section title that might overflow the sidebar width on smaller screens',
          type: 'workflow_section',
          placement: 'before_services',
          status: 'not_started',
          order: 0,
          functionalityType: null
        }
      ];

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={longTitleSections}
          token={mockToken}
        />
      );

      expect(screen.getAllByText(longTitleSections[0].title)[0]).toBeInTheDocument();
    });

    it('should handle all sections being complete', () => {
      const completeSections = mockSections.map(s => ({
        ...s,
        status: 'complete' as const
      }));

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={completeSections}
          token={mockToken}
        />
      );

      // All sections should show green complete indicators
      const sidebarNav = screen.getAllByRole('navigation')[0];
      const completeIndicators = sidebarNav.querySelectorAll('.bg-green-500');
      expect(completeIndicators).toHaveLength(4);
    });
  });
});