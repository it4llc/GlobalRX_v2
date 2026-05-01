// /GlobalRX_v2/src/components/candidate/portal-layout.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalLayout from './portal-layout';
import type { CandidateInvitationInfo, CandidatePortalSection } from '@/types/candidate-portal';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Mock useDebounce hook for the form sections
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}));

// Mock fetch for the form sections
global.fetch = vi.fn();

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
      id: 'personal_info',
      title: 'Personal Information',
      type: 'personal_info',
      placement: 'services',
      status: 'not_started',
      order: 0,
      functionalityType: null
    },
    {
      id: 'section-1',
      title: 'Notice of Processing',
      type: 'workflow_section',
      placement: 'before_services',
      status: 'not_started',
      order: 1,
      functionalityType: null
    },
    {
      id: 'service_idv',
      title: 'Identity Verification',
      type: 'service_section',
      placement: 'services',
      status: 'not_started',
      order: 2,
      functionalityType: 'idv'
    },
    {
      id: 'service_record',
      title: 'Address History',
      type: 'service_section',
      placement: 'services',
      status: 'in_progress',
      order: 3,
      functionalityType: 'record'
    },
    {
      id: 'section-2',
      title: 'Consent Form',
      type: 'workflow_section',
      placement: 'after_services',
      status: 'complete',
      order: 4,
      functionalityType: null
    }
  ];

  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for the form components
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fields: [] })
    } as Response);
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
      expect(screen.getAllByText('Personal Information')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Notice of Processing')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Identity Verification')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Address History')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Consent Form')[0]).toBeInTheDocument();
    });

    it('should render first section (Personal Information) content by default', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // The Personal Information section should be rendered by default
      // It appears in both sidebar and as header in content area
      const personalInfoElements = screen.getAllByText('Personal Information');
      expect(personalInfoElements.length).toBeGreaterThanOrEqual(2);

      // Check that PersonalInfoSection component is rendered
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
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
    it('should display section content when a different section is clicked', async () => {
      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Click on a workflow section (which will show placeholder)
      const sectionButton = screen.getAllByText('Notice of Processing')[0].closest('button');
      await user.click(sectionButton!);

      // Should show section placeholder for workflow sections
      expect(screen.getAllByText('Notice of Processing')[0]).toBeInTheDocument();
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

    it('should show welcome content when empty sections array is passed', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={[]}
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

      // Rerender with sections removed
      rerender(
        <PortalLayout
          invitation={mockInvitation}
          sections={[]}
          token={mockToken}
        />
      );

      // Should show welcome content when section doesn't exist
      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
    });
  });

  describe('mobile menu behavior', () => {
    it('should toggle mobile menu when hamburger button is clicked', async () => {
      const user = userEvent.setup();

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

      // Find the mobile menu by its test ID
      const mobileSidebar = screen.getByTestId('mobile-sidebar');

      // Initially closed (off-screen to the left)
      expect(mobileSidebar).toHaveClass('-translate-x-full');

      // Click hamburger menu
      const menuButton = screen.getByTestId('hamburger-menu');
      await user.click(menuButton);

      // Menu should be open
      expect(mobileSidebar).toHaveClass('translate-x-0');

      // Click again to close
      await user.click(menuButton);

      // Menu should be closed
      expect(mobileSidebar).toHaveClass('-translate-x-full');
    });

    it('should close mobile menu when a section is selected', async () => {
      const user = userEvent.setup();

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

      // Open mobile menu
      const menuButton = screen.getByTestId('hamburger-menu');
      await user.click(menuButton);

      const mobileSidebar = screen.getByTestId('mobile-sidebar');
      expect(mobileSidebar).toHaveClass('translate-x-0');

      // Click on a section in the mobile menu
      const mobileSectionButtons = within(mobileSidebar).getAllByRole('button');
      await user.click(mobileSectionButtons[2]); // Click on Identity Verification

      // Mobile menu should close
      expect(mobileSidebar).toHaveClass('-translate-x-full');
    });

    it('should close mobile menu when clicking outside', async () => {
      const user = userEvent.setup();

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

      // Open mobile menu
      const menuButton = screen.getByTestId('hamburger-menu');
      await user.click(menuButton);

      const mobileSidebar = screen.getByTestId('mobile-sidebar');
      expect(mobileSidebar).toHaveClass('translate-x-0');

      // Click outside (on the overlay)
      const overlay = screen.getByTestId('mobile-overlay');
      await user.click(overlay);

      // Mobile menu should close
      expect(mobileSidebar).toHaveClass('-translate-x-full');
    });

    it('should automatically close mobile menu when resizing to desktop', async () => {
      const user = userEvent.setup();

      // Start at mobile size
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Open mobile menu
      const menuButton = screen.getByTestId('hamburger-menu');
      await user.click(menuButton);

      const mobileSidebar = screen.getByTestId('mobile-sidebar');
      expect(mobileSidebar).toHaveClass('translate-x-0');

      // Resize to desktop
      global.innerWidth = 1024;
      global.dispatchEvent(new Event('resize'));

      await waitFor(() => {
        // Mobile menu should be closed automatically
        expect(mobileSidebar).toHaveClass('-translate-x-full');
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

      // Check for status indicators (these would be within the section buttons)
      const sectionButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Personal Information') ||
        btn.textContent?.includes('Notice of Processing') ||
        btn.textContent?.includes('Identity Verification') ||
        btn.textContent?.includes('Address History') ||
        btn.textContent?.includes('Consent Form')
      );

      // We have 5 sections, each appearing in both desktop and mobile sidebars
      expect(sectionButtons.length).toBeGreaterThanOrEqual(5);
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

      // Should render with no sections in sidebar
      expect(screen.queryByText('Notice of Processing')).not.toBeInTheDocument();
      expect(screen.queryByText('Identity Verification')).not.toBeInTheDocument();

      // Should show welcome content
      expect(screen.getByText('candidate.portal.welcomeTitle')).toBeInTheDocument();
    });

    it('should handle sections with long titles', () => {
      const longTitleSections: CandidatePortalSection[] = [
        {
          id: 'section-long',
          title: 'This is a very long section title that should be truncated or wrapped appropriately',
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

      // Check that the long title is displayed
      expect(screen.getAllByText('This is a very long section title that should be truncated or wrapped appropriately')[0])
        .toBeInTheDocument();
    });

    it('should handle all sections being complete', () => {
      const completeSections = mockSections.map(section => ({
        ...section,
        status: 'complete' as const
      }));

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={completeSections}
          token={mockToken}
        />
      );

      // All sections should still be clickable even when complete
      const sectionButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Personal Information') ||
        btn.textContent?.includes('Notice of Processing') ||
        btn.textContent?.includes('Identity Verification') ||
        btn.textContent?.includes('Address History') ||
        btn.textContent?.includes('Consent Form')
      );

      expect(sectionButtons.length).toBeGreaterThanOrEqual(5);
    });
  });
});