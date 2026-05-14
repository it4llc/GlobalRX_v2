// /GlobalRX_v2/src/components/candidate/portal-layout.test.tsx
//
// Pass 2 tests for portal-layout (the candidate-portal shell). The TD-059
// fix moved Personal Info's progress derivation from the section component
// up into this shell so the sidebar indicator stays accurate even when the
// section is unmounted (the candidate is on a different tab). These tests
// verify:
//   - The shell fetches /personal-info-fields once on load (Spec Test Case 10)
//   - PersonalInfoSection does NOT fetch /personal-info-fields itself (Test Case 11)
//   - A registry change updates the sidebar without mounting the section (Test Case 8)
//   - A registry clear returns the sidebar to its prior state (Test Case 9)
//   - Bug 1 (smoke-tested) — the shell uses prefilledValue when no saved
//     value exists, so a candidate with prefilled-but-not-saved values
//     doesn't see the sidebar drop to not_started when registry entries
//     are added.
//   - TD-059 navigation persistence — the cross-section registry retains
//     contributions across tab navigation (Effect 3 was removed from the
//     repeatable wiring hook; entries from a navigated-away section must
//     still drive Personal Info's status).

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalLayout from './portal-layout';
import type { CandidateInvitationInfo, CandidatePortalSection } from '@/types/candidate-portal';
import type {
  CrossSectionRequirementEntry,
  CrossSectionTarget,
} from '@/types/candidate-stage4';

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

// ---------------------------------------------------------------------------
// Heavy-section stubs for TD-059 tests.
//
// AddressHistorySection / EducationSection / EmploymentSection / IdvSection
// have their own deep state (countries, entries, field-loaders, repeatable
// row managers). For the TD-059 tests in this file the assertion target is
// the SIDEBAR — specifically, the SectionProgressIndicator next to Personal
// Information. The heavy sections' rendering is incidental.
//
// Per Mocking Rule M2: "you may mock a child component only when the
// child's behavior is irrelevant to the assertion being made." The TD-059
// tests assert on the sidebar indicator, NOT on the address-history /
// education / employment / idv DOM. We therefore mock the heavy sections
// with stub components that expose just enough surface to drive the shell:
//   - A `<button>` that, when clicked, calls the prop
//     `onCrossSectionRequirementsChanged(target, triggeredBy, entries)` with
//     a fixture from the test. This stands in for "the candidate just
//     selected a country that triggered a subject requirement."
//   - A `<button>` that calls `onCrossSectionRequirementsRemovedForSource`
//     to simulate "the candidate cleared their country selection."
//
// PortalSidebar and SectionProgressIndicator (the assertion targets) are
// NOT mocked — they render as their real selves so the test observes real
// DOM updates.
//
// PersonalInfoSection is also NOT mocked — its mount/unmount behavior and
// its prop contract are part of the shell's behavior under test (Bug 1 and
// "no double fetch" depend on real PersonalInfoSection rendering).
// ---------------------------------------------------------------------------

// Storage for the latest callback handles attached to the stub. Tests
// retrieve these via the dedicated buttons rendered by the stub.
const stubCallbackFixture: {
  middleNameAU: CrossSectionRequirementEntry;
} = {
  middleNameAU: {
    fieldId: 'req-mn',
    fieldKey: 'middleName',
    fieldName: 'Middle Name',
    isRequired: true,
    triggeredBy: 'address_history',
    triggeredByContext: 'AU',
    triggeredByEntryIndex: 0,
  },
};

interface RepeatableSectionStubProps {
  triggeredBy: string;
  testId: string;
  onCrossSectionRequirementsChanged?: (
    target: CrossSectionTarget,
    triggeredBy: string,
    entries: CrossSectionRequirementEntry[],
  ) => void;
  onCrossSectionRequirementsRemovedForSource?: (triggeredBy: string) => void;
}

function RepeatableSectionStub({
  triggeredBy,
  testId,
  onCrossSectionRequirementsChanged,
  onCrossSectionRequirementsRemovedForSource,
}: RepeatableSectionStubProps) {
  return (
    <div data-testid={testId}>
      <button
        type="button"
        data-testid={`${testId}-trigger-add-middlename-au`}
        onClick={() =>
          onCrossSectionRequirementsChanged?.('subject', triggeredBy, [
            stubCallbackFixture.middleNameAU,
          ])
        }
      >
        Add MiddleName AU
      </button>
      <button
        type="button"
        data-testid={`${testId}-clear-source`}
        onClick={() => onCrossSectionRequirementsRemovedForSource?.(triggeredBy)}
      >
        Clear Source
      </button>
    </div>
  );
}

vi.mock('./form-engine/AddressHistorySection', () => ({
  AddressHistorySection: (props: any) => (
    <RepeatableSectionStub
      triggeredBy="address_history"
      testId="address-history-stub"
      onCrossSectionRequirementsChanged={props.onCrossSectionRequirementsChanged}
      onCrossSectionRequirementsRemovedForSource={
        props.onCrossSectionRequirementsRemovedForSource
      }
    />
  ),
}));

vi.mock('./form-engine/EducationSection', () => ({
  EducationSection: (props: any) => (
    <RepeatableSectionStub
      triggeredBy="education_history"
      testId="education-stub"
      onCrossSectionRequirementsChanged={props.onCrossSectionRequirementsChanged}
      onCrossSectionRequirementsRemovedForSource={
        props.onCrossSectionRequirementsRemovedForSource
      }
    />
  ),
}));

vi.mock('./form-engine/EmploymentSection', () => ({
  EmploymentSection: (props: any) => (
    <RepeatableSectionStub
      triggeredBy="employment_history"
      testId="employment-stub"
      onCrossSectionRequirementsChanged={props.onCrossSectionRequirementsChanged}
      onCrossSectionRequirementsRemovedForSource={
        props.onCrossSectionRequirementsRemovedForSource
      }
    />
  ),
}));

vi.mock('./form-engine/IdvSection', () => ({
  IdvSection: () => <div data-testid="idv-stub">idv stub</div>,
}));

describe('PortalLayout', () => {
  const mockInvitation: CandidateInvitationInfo = {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@example.com',
    phone: null,
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
      id: 'service_verification-idv',
      title: 'Identity Verification',
      type: 'service_section',
      placement: 'services',
      status: 'not_started',
      order: 2,
      functionalityType: 'verification-idv'
    },
    {
      // Note: in production, the structure endpoint emits Address History
      // with type: 'address_history' (Phase 6 Stage 3+) so the shell
      // dispatches the AddressHistorySection component for it. The earlier
      // test fixture used type: 'service_section' / functionalityType:
      // 'record' which would fall through to SectionPlaceholder; the TD-059
      // tests require the shell to actually mount the AddressHistorySection
      // (or in this file, our stub) so the cross-section callbacks become
      // reachable.
      id: 'service_record',
      title: 'Address History',
      type: 'address_history',
      placement: 'services',
      status: 'incomplete',
      order: 3,
      functionalityType: null
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

  // Default URL-routed fetch mock. Tests that need different responses
  // override before the relevant render call. The shell now fetches both
  // /personal-info-fields and /saved-data on mount; without URL routing,
  // a single mockResolvedValue would feed both with the same shape and
  // the saved-data hydration would fail (saved-data shape is different).
  function defaultFetchImpl() {
    return (url: string) => {
      const u = String(url ?? '');
      if (u.includes('/personal-info-fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ fields: [] }),
        } as Response);
      }
      if (u.includes('/saved-data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sections: {} }),
        } as Response);
      }
      if (u.includes('/save')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 });
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(global.fetch).mockImplementation(defaultFetchImpl());
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

  // ===========================================================================
  // TD-059 — Personal Info sidebar reactivity tests.
  //
  // These tests cover Spec Test Cases 8-11 from
  // docs/specs/fix-td059-td060-personal-info-required-fields-and-sidebar-reactivity.md
  // plus the two follow-on bugs surfaced during smoke testing of the fix
  // (commits d330ad1 and 1ddc6bd).
  //
  // Helper — find the SectionProgressIndicator span associated with a given
  // section title in the desktop sidebar. The DOM structure is:
  //   <button data-testid="section-item">
  //     <span>{label}</span>
  //     <span data-testid="section-progress-indicator" data-status="...">
  //       ...
  //     </span>
  //   </button>
  // We look up the desktop sidebar's section button by its label, then dive
  // into its SectionProgressIndicator. Each test uses the desktop sidebar
  // (the 0th match) — there is also a mobile sidebar with identical content.
  // ===========================================================================
  describe('TD-059 — lifted Personal Info status derivation', () => {
    function getPersonalInfoSidebarStatus(): string | null {
      // The desktop and mobile sidebars each render a button for Personal
      // Information. We pick the desktop one (0th match) to stay consistent
      // with the existing tests in this file (they use [0] for the same
      // reason).
      const allButtons = screen.getAllByText('Personal Information');
      const personalInfoButton = allButtons[0].closest('button');
      if (!personalInfoButton) return null;
      const indicator = within(personalInfoButton).getByTestId(
        'section-progress-indicator'
      );
      return indicator.getAttribute('data-status');
    }

    // -------------------------------------------------------------------------
    // Spec Test Case 10 — Shell fetches Personal Info fields on load.
    // -------------------------------------------------------------------------
    it('Spec Test Case 10: shell fetches /personal-info-fields on initial mount', async () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      await waitFor(() => {
        const fetchUrls = vi
          .mocked(global.fetch)
          .mock.calls.map((call) => String(call[0] ?? ''));
        expect(fetchUrls.some((u) => u.includes('/personal-info-fields'))).toBe(
          true
        );
      });
    });

    // -------------------------------------------------------------------------
    // Spec Test Case 11 — PersonalInfoSection does not double-fetch fields.
    //
    // The section receives `fields` as a prop from the shell. When mounted
    // (the candidate is on the Personal Info tab, which is the default),
    // the section MUST NOT make its own fetch to /personal-info-fields —
    // the shell's single call is canonical.
    // -------------------------------------------------------------------------
    it('Spec Test Case 11: /personal-info-fields is fetched exactly once even after the section mounts', async () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Wait for the shell's initial fetch to complete and the default
      // Personal Info section to render.
      await waitFor(() => {
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
      });

      // Allow any potential follow-on fetch from the section to complete.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const fetchCalls = vi.mocked(global.fetch).mock.calls.filter((call) =>
        String(call[0] ?? '').includes('/personal-info-fields')
      );
      expect(fetchCalls).toHaveLength(1);
    });

    // -------------------------------------------------------------------------
    // Spec Test Case 8 — Registry change updates sidebar without navigating
    // to Personal Info.
    //
    // Render the shell with a required Personal Info field already prefilled
    // (so the baseline status is `complete`). Navigate to Address History.
    // Trigger a registry-change callback (the AddressHistorySection stub
    // exposes a button that does this). The lifted progress effect in the
    // shell must recompute status as `incomplete` because the cross-section
    // entry adds a new required field that has no value yet — and the
    // sidebar indicator's data-status must update to reflect that, even
    // though PersonalInfoSection is not currently mounted.
    // -------------------------------------------------------------------------
    it('Spec Test Case 8: registry change flips sidebar from complete → incomplete while Personal Info is unmounted', async () => {
      const user = userEvent.setup();

      // Configure the shell's fetches: one required PI field, with a saved
      // value so baseline status is `complete`.
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
                  instructions: null,
                  fieldData: {},
                  displayOrder: 1,
                  locked: false,
                  prefilledValue: null,
                },
              ],
            }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: {
                personal_info: {
                  fields: [{ requirementId: 'req-firstName', value: 'Sarah' }],
                },
              },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // Wait for the shell's fetches to settle and the lifted effect to run.
      // Initial status: every required field has a value → complete.
      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('complete');
      });

      // Navigate to Address History to UNMOUNT PersonalInfoSection.
      const addressHistoryButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressHistoryButton!);

      // Confirm Personal Info is unmounted by checking the section header
      // is no longer in the DOM (the section header text is the translation
      // key 'candidate.portal.sections.personalInformation' which would
      // appear ONLY when the section is mounted — the sidebar uses 'Personal
      // Information' literal text).
      expect(
        screen.queryByText('candidate.portal.sections.personalInformation')
      ).not.toBeInTheDocument();

      // Trigger the cross-section registry change via the stub. The stub
      // calls the shell's onCrossSectionRequirementsChanged with an entry
      // that adds `middleName` as a required subject field — there is no
      // saved value for middleName, so status must flip to `incomplete`.
      const triggerButton = await screen.findByTestId(
        'address-history-stub-trigger-add-middlename-au'
      );
      await user.click(triggerButton);

      // The lifted progress effect must re-run and the sidebar's
      // SectionProgressIndicator for Personal Info must show `incomplete`.
      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('incomplete');
      });

      // Sanity check: PersonalInfoSection STILL is not mounted.
      expect(
        screen.queryByText('candidate.portal.sections.personalInformation')
      ).not.toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Spec Test Case 9 — Registry clear updates sidebar back to its prior
    // state.
    //
    // Continuation of Test Case 8: after the registry has the entry, clear
    // it. The sidebar must return to `complete` because the only required
    // field with a value (firstName=Sarah) is the only required field again.
    // -------------------------------------------------------------------------
    it('Spec Test Case 9: clearing the registry returns sidebar to complete', async () => {
      const user = userEvent.setup();

      vi.mocked(global.fetch).mockImplementation((url: string) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
                  instructions: null,
                  fieldData: {},
                  displayOrder: 1,
                  locked: false,
                  prefilledValue: null,
                },
              ],
            }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: {
                personal_info: {
                  fields: [{ requirementId: 'req-firstName', value: 'Sarah' }],
                },
              },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('complete');
      });

      const addressHistoryButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressHistoryButton!);

      // Add the registry entry first.
      const addButton = await screen.findByTestId(
        'address-history-stub-trigger-add-middlename-au'
      );
      await user.click(addButton);

      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('incomplete');
      });

      // Now clear the registry source.
      const clearButton = screen.getByTestId('address-history-stub-clear-source');
      await user.click(clearButton);

      // The sidebar must return to `complete`.
      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('complete');
      });
    });

    // -------------------------------------------------------------------------
    // Bug 1 — REGRESSION TEST for personal-info-shell-prefill-progress.
    //
    // Smoke testing surfaced this case: a candidate whose Personal Info has
    // PREFILLED values (from the invitation, e.g. firstName='Sarah') but no
    // saved values yet. Before the fix, the shell only looked at
    // personalInfoSavedValues — so when the cross-section registry changed
    // (e.g., user picked Australia on Address History), the lifted progress
    // effect saw "no value" for firstName and reported `not_started` even
    // though the field is actually visible-and-prefilled in the section.
    // Commit d330ad1 added the prefilledValue fallback in the shell's effect
    // (`savedValue !== undefined ? savedValue : field.prefilledValue ?? undefined`).
    //
    // This regression test asserts the CORRECT (post-fix) behavior: with a
    // prefilled value present and no saved value, the sidebar reflects
    // `complete` (the prefill counts), and a registry-add for an empty
    // middleName flips it to `incomplete` — never `not_started`.
    // -------------------------------------------------------------------------
    it('Bug 1 regression: shell uses prefilledValue fallback when no saved value exists', async () => {
      const user = userEvent.setup();

      vi.mocked(global.fetch).mockImplementation((url: string) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
                  instructions: null,
                  fieldData: {},
                  displayOrder: 1,
                  locked: true,
                  prefilledValue: 'Sarah', // prefilled, no saved value
                },
              ],
            }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          // No saved values for personal_info — the prefill must carry the
          // status to `complete`.
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      // With prefill 'Sarah' and no cross-section requirements, every
      // required field has a value → complete. Without the fallback, this
      // would be `not_started` (the bug being regressed).
      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('complete');
      });

      // Navigate away and add a registry entry for middleName (empty).
      const addressHistoryButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressHistoryButton!);

      const addButton = await screen.findByTestId(
        'address-history-stub-trigger-add-middlename-au'
      );
      await user.click(addButton);

      // The cross-section addition makes middleName required. middleName has
      // no value → incomplete (not not_started, because firstName is still
      // counted as filled via the prefill fallback).
      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('incomplete');
      });
    });

    // -------------------------------------------------------------------------
    // Effect 3 removal — TD-059 navigation persistence.
    //
    // Commit 1ddc6bd removed the unmount cleanup from
    // useRepeatableSectionStage4Wiring.ts — without that change, navigating
    // away from Address History would call onCrossSectionRequirementsRemovedForSource
    // on unmount, clearing the registry and dropping the Personal Info
    // sidebar back to `complete` even when the user clearly intended the
    // requirement to persist. This test pins the persistence behavior at
    // the shell level.
    //
    // Setup: prefill Personal Info to `complete`. Add a registry entry from
    // the AddressHistorySection stub. Navigate to Personal Info, then BACK
    // to Address History. The sidebar indicator for Personal Info must
    // remain `incomplete` throughout — the registry contribution does not
    // get cleared by the back-and-forth navigation alone.
    // -------------------------------------------------------------------------
    it('Effect 3 removal: registry contribution persists across tab navigation', async () => {
      const user = userEvent.setup();

      vi.mocked(global.fetch).mockImplementation((url: string) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
                  instructions: null,
                  fieldData: {},
                  displayOrder: 1,
                  locked: true,
                  prefilledValue: 'Sarah',
                },
              ],
            }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={mockSections}
          token={mockToken}
        />
      );

      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('complete');
      });

      // Navigate to Address History and add the cross-section requirement.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au'
        )
      );

      await waitFor(() => {
        expect(getPersonalInfoSidebarStatus()).toBe('incomplete');
      });

      // Navigate to Personal Info — AddressHistorySection unmounts. The
      // registry contribution must persist; sidebar stays `incomplete`.
      await user.click(
        screen.getAllByText('Personal Information')[0].closest('button')!
      );

      // Wait for any post-navigation effects to settle.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getPersonalInfoSidebarStatus()).toBe('incomplete');

      // Navigate back to Address History — the stub re-mounts. The shell's
      // handleCrossSectionRequirementsChanged uses replace-semantics on each
      // mount-time effect call, but the stub itself only fires the callback
      // when its button is clicked, NOT on mount. So the registry retains
      // the entries the previous mount added, and the sidebar still reads
      // `incomplete`.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(getPersonalInfoSidebarStatus()).toBe('incomplete');
    });
  });
});
