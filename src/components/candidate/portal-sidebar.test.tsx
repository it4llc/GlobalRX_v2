// /GlobalRX_v2/src/components/candidate/portal-sidebar.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalSidebar from './portal-sidebar';
import type { CandidatePortalSection } from '@/types/candidate-portal';

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

describe('PortalSidebar', () => {
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
      id: 'service_verification-idv',
      title: 'Identity Verification',
      type: 'service_section',
      placement: 'services',
      status: 'incomplete',
      order: 1,
      functionalityType: 'verification-idv'
    },
    {
      id: 'section-2',
      title: 'Consent Form',
      type: 'workflow_section',
      placement: 'after_services',
      status: 'complete',
      order: 2,
      functionalityType: null
    }
  ];

  const mockOnSectionClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('desktop sidebar rendering', () => {
    it('should render all sections in desktop mode', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      expect(screen.getByText('Notice of Processing')).toBeInTheDocument();
      expect(screen.getByText('Identity Verification')).toBeInTheDocument();
      expect(screen.getByText('Consent Form')).toBeInTheDocument();
    });

    it('should show correct status icons for each status type', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      // Not started - gray circle
      const grayCircles = document.querySelectorAll('.bg-gray-300');
      expect(grayCircles).toHaveLength(1);

      // Phase 6 Stage 4: the in_progress status was renamed to incomplete
      // (BR 22) and SectionProgressIndicator now renders a red circle with a
      // warning icon for the incomplete state instead of a blue circle with a
      // white dot. Assert the new red-circle markup.
      const redCircles = document.querySelectorAll('.bg-red-500');
      expect(redCircles).toHaveLength(1);
      const incompleteIcon = document.querySelector('.bg-red-500 svg');
      expect(incompleteIcon).toBeInTheDocument();

      // Complete - green circle with checkmark
      const greenCircles = document.querySelectorAll('.bg-green-500');
      expect(greenCircles).toHaveLength(1);
      const checkmark = document.querySelector('.bg-green-500 svg');
      expect(checkmark).toBeInTheDocument();
    });

    it('should highlight active section', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection="service_verification-idv"
          onSectionClick={mockOnSectionClick}
        />
      );

      const activeButton = screen.getByText('Identity Verification').closest('button');
      expect(activeButton).toHaveClass('bg-blue-50', 'text-blue-700');

      const inactiveButton = screen.getByText('Notice of Processing').closest('button');
      expect(inactiveButton).toHaveClass('text-gray-700');
      expect(inactiveButton).not.toHaveClass('bg-blue-50');
    });

    it('should call onSectionClick when a section is clicked', async () => {
      const user = userEvent.setup();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      await user.click(screen.getByText('Identity Verification'));

      expect(mockOnSectionClick).toHaveBeenCalledTimes(1);
      expect(mockOnSectionClick).toHaveBeenCalledWith('service_verification-idv');
    });

    it('should have correct desktop-specific classes', () => {
      const { container } = render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      const aside = container.querySelector('aside');
      expect(aside).toHaveClass('hidden', 'md:block', 'w-80');
    });
  });

  describe('mobile sidebar rendering', () => {
    it('should render mobile sidebar with overlay when open', () => {
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={true}
          onClose={onClose}
        />
      );

      // Check for overlay
      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('md:hidden'); // Only visible on mobile

      // Check for slide-out panel
      const panel = document.querySelector('.transform.transition-transform');
      expect(panel).toHaveClass('translate-x-0'); // Panel is visible
      expect(panel).toHaveClass('md:hidden'); // Only visible on mobile

      // Check for menu header
      expect(screen.getByText('candidate.portal.menu')).toBeInTheDocument();
    });

    it('should hide mobile sidebar when closed', () => {
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={false}
          onClose={onClose}
        />
      );

      // No overlay when closed
      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      expect(overlay).not.toBeInTheDocument();

      // Panel should be translated off-screen
      const panel = document.querySelector('.transform.transition-transform');
      expect(panel).toHaveClass('-translate-x-full');
    });

    it('should call onClose when overlay is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={true}
          onClose={onClose}
        />
      );

      const overlay = document.querySelector('.bg-black.bg-opacity-50');
      await user.click(overlay!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={true}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByLabelText('Close menu');
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call both onSectionClick and onClose when section is clicked in mobile', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={true}
          onClose={onClose}
        />
      );

      // Click on a section in the mobile menu
      const sections = screen.getAllByText('Identity Verification');
      // Get the one in the mobile panel (last one)
      const mobileSection = sections[sections.length - 1];

      await user.click(mobileSection);

      expect(mockOnSectionClick).toHaveBeenCalledWith('service_verification-idv');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have screen reader text for status indicators', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      // Check for sr-only status labels
      // Phase 6 Stage 4: SectionProgressIndicator now combines the section
      // label with the status translation, e.g. "Notice of Processing —
      // candidate.sectionProgress.notStarted". Translation keys also moved
      // from `candidate.portal.sections.{notStarted,inProgress,complete}` to
      // `candidate.sectionProgress.{notStarted,incomplete,complete}` (BR 22
      // renamed `in_progress` → `incomplete`). Assert each key is present
      // somewhere in the combined screen-reader strings.
      const srOnlyElements = document.querySelectorAll('.sr-only');
      const statusTexts = Array.from(srOnlyElements).map(el => el.textContent);

      expect(statusTexts.some(t => t?.includes('candidate.sectionProgress.notStarted'))).toBe(true);
      expect(statusTexts.some(t => t?.includes('candidate.sectionProgress.incomplete'))).toBe(true);
      expect(statusTexts.some(t => t?.includes('candidate.sectionProgress.complete'))).toBe(true);
    });

    it('should have aria-label on close button', () => {
      const onClose = vi.fn();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
          isOpen={true}
          onClose={onClose}
        />
      );

      const closeButton = screen.getByLabelText('Close menu');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have navigation landmark', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      const nav = screen.getAllByRole('navigation');
      expect(nav.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty sections list', () => {
      render(
        <PortalSidebar
          sections={[]}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      const nav = screen.getAllByRole('navigation')[0];
      const buttons = nav.querySelectorAll('button');
      expect(buttons).toHaveLength(0);
    });

    it('should handle sections with very long titles', () => {
      const longTitleSections: CandidatePortalSection[] = [
        {
          id: 'long-1',
          title: 'This is a very long section title that might cause overflow issues in the sidebar layout',
          type: 'workflow_section',
          placement: 'before_services',
          status: 'not_started',
          order: 0,
          functionalityType: null
        }
      ];

      render(
        <PortalSidebar
          sections={longTitleSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      expect(screen.getByText(longTitleSections[0].title)).toBeInTheDocument();
    });

    it('should handle clicking on already active section', async () => {
      const user = userEvent.setup();

      render(
        <PortalSidebar
          sections={mockSections}
          activeSection="service_verification-idv"
          onSectionClick={mockOnSectionClick}
        />
      );

      await user.click(screen.getByText('Identity Verification'));

      // Should still call the handler even if already active
      expect(mockOnSectionClick).toHaveBeenCalledWith('service_verification-idv');
    });

    it('should handle null activeSection', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection={null}
          onSectionClick={mockOnSectionClick}
        />
      );

      // No section should be highlighted
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveClass('bg-blue-50');
      });
    });

    it('should handle activeSection that does not exist in sections', () => {
      render(
        <PortalSidebar
          sections={mockSections}
          activeSection="non-existent-section"
          onSectionClick={mockOnSectionClick}
        />
      );

      // No section should be highlighted
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).not.toHaveClass('bg-blue-50');
      });
    });
  });
});