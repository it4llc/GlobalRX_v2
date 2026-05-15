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
  useDebounce: <T,>(value: T): T => value
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
  // Added for W5 test — exposes the shell's `onSaveSuccess` wiring so the
  // test can simulate the candidate finishing a save round-trip without
  // mounting the real AddressHistorySection.
  onSaveSuccess?: () => void;
}

// Subset of the real section props the mocked stubs care about. The real
// section components (AddressHistorySection / EducationSection /
// EmploymentSection) accept more props than this, but the stubs only forward
// the two cross-section callbacks. Using a Pick keeps this in lockstep with
// RepeatableSectionStubProps so a callback signature change here would
// surface as a type error in the stub component below.
type MockedSectionCallbackProps = Pick<
  RepeatableSectionStubProps,
  | 'onCrossSectionRequirementsChanged'
  | 'onCrossSectionRequirementsRemovedForSource'
  | 'onSaveSuccess'
>;

function RepeatableSectionStub({
  triggeredBy,
  testId,
  onCrossSectionRequirementsChanged,
  onCrossSectionRequirementsRemovedForSource,
  onSaveSuccess,
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
      {onSaveSuccess && (
        <button
          type="button"
          data-testid={`${testId}-trigger-save-success`}
          onClick={() => onSaveSuccess()}
        >
          Trigger Save Success
        </button>
      )}
    </div>
  );
}

vi.mock('./form-engine/AddressHistorySection', () => ({
  AddressHistorySection: (props: MockedSectionCallbackProps) => (
    <RepeatableSectionStub
      triggeredBy="address_history"
      testId="address-history-stub"
      onCrossSectionRequirementsChanged={props.onCrossSectionRequirementsChanged}
      onCrossSectionRequirementsRemovedForSource={
        props.onCrossSectionRequirementsRemovedForSource
      }
      onSaveSuccess={props.onSaveSuccess}
    />
  ),
}));

// W3 test — Record Search section is mocked so the test can visit and
// depart from it without RecordSearchSection's deep state (countries,
// per-entry field loaders, repeatable rows) mattering. The W3 assertion
// targets the sidebar progress indicator, not the section's content DOM.
vi.mock('./form-engine/RecordSearchSection', () => ({
  RecordSearchSection: () => (
    <div data-testid="record-search-stub">record search stub</div>
  ),
}));

vi.mock('./form-engine/EducationSection', () => ({
  EducationSection: (props: MockedSectionCallbackProps) => (
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
  EmploymentSection: (props: MockedSectionCallbackProps) => (
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

  // ===========================================================================
  // Task 8.2 (Linear Step Navigation) — Pass 2 tests for the Next/Back
  // navigation buttons rendered at the bottom of every non-`review_submit`
  // section. The buttons are produced by the new StepNavigationButtons
  // component but the SHELL (this file's subject) owns the navigation
  // logic — which section is "next", which is "prev", scroll-to-top
  // wiring, and the suppression of the shared component on the
  // Review & Submit branch (which renders its own Back button next to
  // Submit per spec rule 5).
  //
  // Per Mocking Rule M1, PortalLayout is NOT mocked — it is the subject.
  // Per Mocking Rule M2, StepNavigationButtons / PortalSidebar /
  // ReviewSubmitPage are NOT mocked because the assertions in this block
  // depend on their real rendered DOM (step-navigation container, real
  // sidebar buttons, real review-back-button).
  // ===========================================================================
  describe('step navigation buttons (Task 8.2)', () => {
    // Linear-flow fixture (matches the spec's new 9-step order). Personal
    // Info moved to step 6 (after Employment) per Business Rule 1; the
    // synthetic Review & Submit entry is always last.
    const linearSections: CandidatePortalSection[] = [
      {
        id: 'welcome',
        title: 'Welcome',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null,
        workflowSection: {
          id: 'welcome',
          name: 'Welcome',
          type: 'text',
          content: 'Welcome to the application.',
          placement: 'before_services',
          displayOrder: 1,
          isRequired: false,
        },
      },
      {
        id: 'service_verification-idv',
        title: 'Identity Verification',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 1,
        functionalityType: 'verification-idv',
      },
      {
        id: 'address_history',
        title: 'Address History',
        type: 'address_history',
        placement: 'services',
        status: 'not_started',
        order: 2,
        functionalityType: null,
      },
      {
        id: 'service_verification-edu',
        title: 'Education',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 3,
        functionalityType: 'verification-edu',
      },
      {
        id: 'service_verification-emp',
        title: 'Employment',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 4,
        functionalityType: 'verification-emp',
      },
      {
        id: 'personal_info',
        title: 'Personal Information',
        type: 'personal_info',
        placement: 'services',
        status: 'not_started',
        order: 5,
        functionalityType: null,
      },
      {
        id: 'after-1',
        title: 'Consent Form',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 6,
        functionalityType: null,
        workflowSection: {
          id: 'after-1',
          name: 'Consent Form',
          type: 'text',
          content: 'I acknowledge.',
          placement: 'after_services',
          displayOrder: 1,
          isRequired: false,
        },
      },
      {
        id: 'review_submit',
        title: 'Review & Submit',
        type: 'review_submit',
        placement: 'after_services',
        status: 'not_started',
        order: 7,
        functionalityType: null,
      },
    ];

    // -------------------------------------------------------------------------
    // Business Rule 4 / DoD 4 — First step has no Back button, only Next.
    //
    // The default active section is sections[0] (the Welcome workflow
    // section). The shared StepNavigationButtons must render the Next
    // button but suppress the Back button.
    // -------------------------------------------------------------------------
    it('Business Rule 4: first step renders Next but NOT Back', async () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
      });

      // Next is rendered.
      expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
      // Back is NOT rendered on the first step.
      expect(screen.queryByTestId('step-nav-back')).not.toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Business Rule 2 / DoD 2 — Middle steps render both Back and Next.
    //
    // Click into the Address History section (index 2). The shared
    // StepNavigationButtons must render both buttons because the section
    // is neither the first nor the Review & Submit branch.
    // -------------------------------------------------------------------------
    it('Business Rule 2: a middle step renders both Back and Next', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Navigate to Address History via the sidebar.
      const addressButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressButton!);

      await waitFor(() => {
        expect(screen.getByTestId('step-nav-back')).toBeInTheDocument();
      });
      expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Business Rule 4 / 5 / DoD 5 — Review & Submit branch suppresses the
    // shared StepNavigationButtons row entirely, and ReviewSubmitPage
    // renders its OWN Back button (data-testid="review-back-button")
    // alongside Submit. There must NOT be two Back buttons on this page.
    // -------------------------------------------------------------------------
    it('Business Rule 5: Review & Submit branch does NOT render the shared step-navigation row', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Navigate to Review & Submit via the sidebar.
      const reviewButton = screen
        .getAllByText('Review & Submit')[0]
        .closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        // The Review page's own Back button is rendered.
        expect(screen.getByTestId('review-back-button')).toBeInTheDocument();
      });

      // The shared component is suppressed entirely on this branch — no
      // step-navigation container, and neither of its inner buttons.
      expect(screen.queryByTestId('step-navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-back')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-next')).not.toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Business Rule 5 — Review & Submit page's own Back button navigates to
    // the previous section. The portal-layout passes handleBackClick as
    // ReviewSubmitPage.onBack; clicking it must change the active section
    // to the section immediately before Review & Submit (Consent Form in
    // the fixture).
    // -------------------------------------------------------------------------
    it('Business Rule 5: clicking the Review page Back button navigates to the previous section', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Go to Review & Submit first.
      const reviewSidebarButton = screen
        .getAllByText('Review & Submit')[0]
        .closest('button');
      await user.click(reviewSidebarButton!);

      await waitFor(() => {
        expect(screen.getByTestId('review-back-button')).toBeInTheDocument();
      });

      // Click the Review page's own Back button.
      await user.click(screen.getByTestId('review-back-button'));

      // Active section must change to the Consent Form (index 6 in the
      // linear fixture — the section immediately before Review & Submit).
      // The active-section highlight uses the bg-blue-50 + text-blue-700
      // classes (see "should highlight active section in sidebar" above).
      await waitFor(() => {
        const consentButton = screen
          .getAllByText('Consent Form')[0]
          .closest('button');
        expect(consentButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // Business Rule 6 / DoD 6 — Next button advances to the next section.
    //
    // Starting from the first section, clicking Next must change the
    // active section to index 1 (Identity Verification in this fixture).
    // The active-section highlight in the sidebar is the only DOM signal
    // available without mocking child components, so we assert on that.
    // -------------------------------------------------------------------------
    it('Business Rule 6: clicking Next advances the active section by one', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Wait for initial render to settle (the first section is active).
      await waitFor(() => {
        expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
      });

      // Click Next — should move from Welcome (index 0) to Identity
      // Verification (index 1).
      await user.click(screen.getByTestId('step-nav-next'));

      // The new active section is highlighted in the sidebar.
      await waitFor(() => {
        const idvButton = screen
          .getAllByText('Identity Verification')[0]
          .closest('button');
        expect(idvButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // Business Rule 6 / DoD 6 — Back button retreats to the previous
    // section. Navigate forward to Address History via the sidebar, then
    // press Back. The active section must move to Identity Verification.
    // -------------------------------------------------------------------------
    it('Business Rule 6: clicking Back retreats the active section by one', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Jump to Address History via the sidebar so a Back button is
      // present (the first step has no Back).
      const addressButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressButton!);

      await waitFor(() => {
        expect(screen.getByTestId('step-nav-back')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('step-nav-back'));

      // Active section moves to Identity Verification (the previous one).
      await waitFor(() => {
        const idvButton = screen
          .getAllByText('Identity Verification')[0]
          .closest('button');
        expect(idvButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // Business Rule 6 (skip) / DoD 6 — When a section type is NOT included
    // in the package (e.g., no IDV service), the structure endpoint omits
    // it from `sections`. The shell's navigableSections list is simply
    // `sectionsWithStatus`, so Next/Back already skips by virtue of the
    // missing entry. Starting from Welcome with no IDV present, clicking
    // Next must land on Address History (the second remaining entry).
    // -------------------------------------------------------------------------
    it('Business Rule 6: Next skips sections that are not present in the package (no IDV → Address History is next)', async () => {
      const user = userEvent.setup();
      const noIdvSections: CandidatePortalSection[] = linearSections.filter(
        (s) => s.id !== 'service_verification-idv',
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={noIdvSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
      });

      // Click Next from Welcome — IDV is absent, so the next section in
      // the navigable list is Address History.
      await user.click(screen.getByTestId('step-nav-next'));

      await waitFor(() => {
        const addressButton = screen
          .getAllByText('Address History')[0]
          .closest('button');
        expect(addressButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // Business Rule 8 / 9 / Edge Case 5 / DoD 9 — Sidebar and Next/Back
    // navigate together. After using the sidebar to jump to Address
    // History, pressing Next must move to the NEXT section relative to
    // Address History (Education), not relative to where the user was
    // before.
    // -------------------------------------------------------------------------
    it('Edge case 5: after sidebar-jumping, Next/Back is relative to the new position', async () => {
      const user = userEvent.setup();
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={linearSections}
          token={mockToken}
        />,
      );

      // Sidebar-jump to Address History.
      const addressButton = screen
        .getAllByText('Address History')[0]
        .closest('button');
      await user.click(addressButton!);

      await waitFor(() => {
        expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
      });

      // Now press Next — relative to Address History, the next is
      // Education.
      await user.click(screen.getByTestId('step-nav-next'));

      await waitFor(() => {
        const educationButton = screen
          .getAllByText('Education')[0]
          .closest('button');
        expect(educationButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // Business Rule 11 / DoD 7 — Pressing Next scrolls the page to the top
    // of the new section. The shell calls window.scrollTo({ top: 0,
    // behavior: 'smooth' }) inside scrollNewSectionIntoView. We mock
    // window.scrollTo on the global window object so we can observe the
    // call without mocking the component (Rule M1).
    // -------------------------------------------------------------------------
    it('Business Rule 11: clicking Next calls window.scrollTo to scroll the page back to the top', async () => {
      const user = userEvent.setup();
      // vi.spyOn returns a properly typed spy that wraps window.scrollTo
      // without the need to widen the global type with `any`. The spy is
      // restored in the finally block so it does not leak between tests.
      const scrollToSpy = vi
        .spyOn(window, 'scrollTo')
        .mockImplementation(() => {});

      try {
        render(
          <PortalLayout
            invitation={mockInvitation}
            sections={linearSections}
            token={mockToken}
          />,
        );

        await waitFor(() => {
          expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
        });

        await user.click(screen.getByTestId('step-nav-next'));

        // window.scrollTo must have been called with the spec-required
        // arguments. The shell calls it inside a try/catch but jsdom
        // tolerates the options-object form, so the spy should record it.
        await waitFor(() => {
          expect(scrollToSpy).toHaveBeenCalledWith(
            expect.objectContaining({ top: 0, behavior: 'smooth' }),
          );
        });
      } finally {
        scrollToSpy.mockRestore();
      }
    });

    // -------------------------------------------------------------------------
    // Edge case 4 — Only one step exists. Neither Back nor Next is shown.
    //
    // With a single-section package (just a Welcome workflow section),
    // the shared StepNavigationButtons must render nothing at all
    // (returns null when both onBack and onNext are null).
    // -------------------------------------------------------------------------
    it('Edge case 4: when only one section exists, neither Back nor Next is rendered', async () => {
      const singleSection: CandidatePortalSection[] = [
        {
          id: 'welcome',
          title: 'Welcome',
          type: 'workflow_section',
          placement: 'before_services',
          status: 'not_started',
          order: 0,
          functionalityType: null,
          workflowSection: {
            id: 'welcome',
            name: 'Welcome',
            type: 'text',
            content: 'Welcome to the application.',
            placement: 'before_services',
            displayOrder: 1,
            isRequired: false,
          },
        },
      ];

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={singleSection}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('main-content')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('step-navigation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-back')).not.toBeInTheDocument();
      expect(screen.queryByTestId('step-nav-next')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Task 8.5 (Silent Recalculation and Step Skipping) — Pass 2 tests for the
  // dynamic step skipping behavior implemented in `portal-layout.tsx`.
  //
  // Subject (Rule M1, NOT mocked): PortalLayout, plus the new shell-level
  // memos `visibleSectionsWithStatus`, `effectiveValidationResult`,
  // `disableSubmitForDynamicGaps`, the fall-back-to-visible effect, and the
  // `refreshAddressHistoryEntries` callback.
  //
  // Assertion-critical children (Rule M2, NOT mocked):
  //   - PortalSidebar / SectionProgressIndicator — drive the visible/hidden
  //     sidebar entries assertions.
  //   - StepNavigationButtons — drives the Next/Back skip-over-hidden
  //     assertions.
  //   - PersonalInfoSection / RecordSearchSection — assertion target for
  //     visibility transitions (Rule 7 / live transitions).
  //   - ReviewSubmitPage — assertion target for `disableSubmit` / Rule 9c /
  //     Rule 9d / Rule 9a/b.
  //
  // Mocked (already at module scope above): AddressHistorySection /
  // EducationSection / EmploymentSection / IdvSection are replaced with the
  // RepeatableSectionStub used by TD-059 so we can drive cross-section
  // registry state from the test, plus TranslationContext and useDebounce.
  // No new mocks introduced by this block.
  //
  // Spec: docs/specs/silent-recalculation-step-skipping.md
  // Plan: docs/plans/silent-recalculation-step-skipping-technical-plan.md §11.2
  // ===========================================================================
  describe('dynamic step skipping (Task 8.5)', () => {
    // -------------------------------------------------------------------------
    // Fixture — full 9-step linear flow including BOTH dynamic steps. The
    // shell decides whether to skip Personal Info (Step 7) and Record Search
    // (Step 8) at runtime; the fixture itself always carries them.
    // -------------------------------------------------------------------------
    const dynamicSections: CandidatePortalSection[] = [
      {
        id: 'welcome',
        title: 'Welcome',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null,
        workflowSection: {
          id: 'welcome',
          name: 'Welcome',
          type: 'text',
          content: 'Welcome to the application.',
          placement: 'before_services',
          displayOrder: 1,
          isRequired: false,
        },
      },
      {
        id: 'address_history',
        title: 'Address History',
        type: 'address_history',
        placement: 'services',
        status: 'not_started',
        order: 1,
        functionalityType: null,
        serviceIds: ['svc-record-1'],
      },
      {
        id: 'service_verification-edu',
        title: 'Education',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 2,
        functionalityType: 'verification-edu',
      },
      {
        id: 'service_verification-emp',
        title: 'Employment',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 3,
        functionalityType: 'verification-emp',
      },
      {
        id: 'personal_info',
        title: 'Personal Information',
        type: 'personal_info',
        placement: 'services',
        status: 'not_started',
        order: 4,
        functionalityType: null,
      },
      {
        id: 'record_search',
        title: 'Record Search Requirements',
        type: 'record_search',
        placement: 'services',
        status: 'not_started',
        order: 5,
        functionalityType: null,
        serviceIds: ['svc-record-1'],
      },
      {
        id: 'after-1',
        title: 'Consent Form',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 6,
        functionalityType: null,
        workflowSection: {
          id: 'after-1',
          name: 'Consent Form',
          type: 'text',
          content: 'I acknowledge.',
          placement: 'after_services',
          displayOrder: 1,
          isRequired: false,
        },
      },
      {
        id: 'review_submit',
        title: 'Review & Submit',
        type: 'review_submit',
        placement: 'after_services',
        status: 'not_started',
        order: 7,
        functionalityType: null,
      },
    ];

    // -------------------------------------------------------------------------
    // Fetch builders.
    //
    // The shell makes these requests:
    //   1. /personal-info-fields — returns the local DSX field list. If
    //      length > 0, Personal Info is visible.
    //   2. /saved-data — hydrates workflow acknowledgments, Personal Info
    //      saved values, and Address History entries. We control the
    //      `address_history.entries` array to drive Record Search visibility.
    //   3. /fields?serviceIds=...&countryId=... — per-entry DSX field fetch.
    //   4. /validate — returns the validation result. We control this for
    //      the BR 9c / 9d tests.
    //   5. /save — always succeed.
    //
    // Per Mocking Rule M3, the fetch implementation reads each call's URL
    // argument and returns a response based on what the parent actually
    // requested — NOT a scripted sequence of mockResolvedValueOnce.
    // -------------------------------------------------------------------------

    interface DynamicFetchConfig {
      personalInfoFields?: Array<{
        requirementId: string;
        name: string;
        fieldKey: string;
        dataType: string;
        isRequired: boolean;
        instructions?: string | null;
        fieldData?: Record<string, unknown>;
        displayOrder: number;
        locked: boolean;
        prefilledValue?: string | null;
      }>;
      addressHistoryEntries?: Array<{
        entryId: string;
        countryId: string | null;
        entryOrder: number;
        fields: Array<{ requirementId: string; value: unknown }>;
      }>;
      entryFields?: Record<
        string,
        Array<{
          requirementId: string;
          name: string;
          fieldKey: string;
          type: string;
          dataType: string;
          isRequired: boolean;
          displayOrder: number;
          fieldData?: Record<string, unknown> | null;
        }>
      >;
      validateResponse?: {
        sections: Array<{
          sectionId: string;
          status: 'complete' | 'incomplete' | 'not_started';
          fieldErrors: Array<unknown>;
          scopeErrors: Array<unknown>;
          gapErrors: Array<unknown>;
          documentErrors: Array<unknown>;
        }>;
        summary: {
          sections: Array<{
            sectionId: string;
            sectionName: string;
            status: 'complete' | 'incomplete' | 'not_started';
            errors: Array<unknown>;
          }>;
          allComplete: boolean;
          totalErrors: number;
        };
      };
    }

    function buildFetchImpl(config: DynamicFetchConfig = {}) {
      return (url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: config.personalInfoFields ?? [] }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: {
                address_history: {
                  entries: config.addressHistoryEntries ?? [],
                },
              },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          if (config.validateResponse) {
            return Promise.resolve({
              ok: true,
              json: async () => config.validateResponse,
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: {
                sections: [],
                allComplete: false,
                totalErrors: 0,
              },
            }),
          } as Response);
        }
        if (u.includes('/fields')) {
          const match = u.match(/countryId=([^&]+)/);
          const countryId = match ? decodeURIComponent(match[1]) : null;
          const matchingEntryId = countryId
            ? (config.addressHistoryEntries ?? []).find(
                (e) => e.countryId === countryId,
              )?.entryId
            : null;
          const fields =
            (matchingEntryId &&
              config.entryFields &&
              config.entryFields[matchingEntryId]) ||
            [];
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      };
    }

    // ---- Sidebar helper ----------------------------------------------------

    function hasSidebarSection(title: string): boolean {
      const matches = screen.queryAllByText(title);
      return matches.some((el) => el.closest('button') !== null);
    }

    // -------------------------------------------------------------------------
    // BR 5 — Personal Info is hidden when there are no local DSX fields
    // AND no cross-section subject requirements.
    // -------------------------------------------------------------------------
    it('BR 5: Personal Info is hidden from the sidebar when there are no local fields and no cross-section requirements', async () => {
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      expect(hasSidebarSection('Record Search Requirements')).toBe(false);
      expect(hasSidebarSection('Welcome')).toBe(true);
      expect(hasSidebarSection('Address History')).toBe(true);
      expect(hasSidebarSection('Consent Form')).toBe(true);
    });

    // -------------------------------------------------------------------------
    // BR 5 — Personal Info IS visible when there is at least one local DSX
    // field (OR-merged with cross-section).
    // -------------------------------------------------------------------------
    it('BR 5: Personal Info IS visible when there is at least one local DSX field', async () => {
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [
            {
              requirementId: 'pi-1',
              name: 'First Name',
              fieldKey: 'firstName',
              dataType: 'text',
              isRequired: true,
              fieldData: {},
              displayOrder: 1,
              locked: false,
              prefilledValue: null,
            },
          ],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      // Wait until both fetches settle so the loading guard clears.
      await waitFor(() => {
        const fetchUrls = vi
          .mocked(global.fetch)
          .mock.calls.map((c) => String(c[0] ?? ''));
        expect(
          fetchUrls.some((u) => u.includes('/personal-info-fields')),
        ).toBe(true);
        expect(fetchUrls.some((u) => u.includes('/saved-data'))).toBe(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(hasSidebarSection('Personal Information')).toBe(true);
    });

    // -------------------------------------------------------------------------
    // BR 6 — Record Search Requirements is hidden when there are no
    // aggregated items.
    // -------------------------------------------------------------------------
    it('BR 6: Record Search Requirements is hidden when there are no aggregated items', async () => {
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [
            {
              requirementId: 'pi-1',
              name: 'First Name',
              fieldKey: 'firstName',
              dataType: 'text',
              isRequired: true,
              fieldData: {},
              displayOrder: 1,
              locked: false,
              prefilledValue: null,
            },
          ],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });
      expect(hasSidebarSection('Record Search Requirements')).toBe(false);
    });

    // -------------------------------------------------------------------------
    // BR 6 — Record Search IS visible when aggregated items exist.
    // -------------------------------------------------------------------------
    it('BR 6: Record Search Requirements IS visible when aggregated items exist', async () => {
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [
            {
              entryId: 'addr-1',
              countryId: 'US',
              entryOrder: 0,
              fields: [],
            },
          ],
          entryFields: {
            'addr-1': [
              {
                requirementId: 'rs-1',
                name: 'Search Fee Acknowledgment',
                fieldKey: 'searchFeeAck',
                type: 'field',
                dataType: 'checkbox',
                isRequired: true,
                displayOrder: 1,
                fieldData: { collectionTab: 'search' },
              },
            ],
          },
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Record Search Requirements')).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // BR 7 — Dynamic transition (skipped → visible) without page reload.
    // -------------------------------------------------------------------------
    it('BR 7 (live transition): Personal Info appears in the sidebar after a cross-section subject requirement is added', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );

      const triggerBtn = await screen.findByTestId(
        'address-history-stub-trigger-add-middlename-au',
      );
      await user.click(triggerBtn);

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });
    });

    // -------------------------------------------------------------------------
    // BR 7 (reverse) — Dynamic transition (visible → skipped).
    // -------------------------------------------------------------------------
    it('BR 7 (live transition, reverse): Personal Info disappears from the sidebar when the cross-section source is cleared', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });

      await user.click(
        screen.getByTestId('address-history-stub-clear-source'),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // BR 5/6 — Next/Back skips over hidden dynamic steps.
    // -------------------------------------------------------------------------
    it('BR 5/6: Next from Employment skips over hidden Personal Info AND hidden Record Search to land on Consent Form', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      await user.click(
        screen.getAllByText('Employment')[0].closest('button')!,
      );

      await waitFor(() => {
        expect(screen.getByTestId('step-nav-next')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('step-nav-next'));

      await waitFor(() => {
        const consentButton = screen
          .getAllByText('Consent Form')[0]
          .closest('button');
        expect(consentButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });
    });

    // -------------------------------------------------------------------------
    // BR 8 — No warnings or alerts during silent recalculation.
    // -------------------------------------------------------------------------
    it('BR 8: no role="alert" banner appears when visibility changes from skipped to visible', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });

      // No alert appeared as a result of the recalculation — BR 8.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // BR 3 / DoD 3 — Saved values survive a visibility flip.
    // -------------------------------------------------------------------------
    it('BR 3 / DoD 3: saved Personal Info values survive a hide-then-show visibility cycle', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'pi-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
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
                  fields: [{ requirementId: 'pi-firstName', value: 'Sarah' }],
                },
                address_history: { entries: [] },
              },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: { sections: [], allComplete: false, totalErrors: 0 },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      const getPiStatus = (): string | null => {
        const button = screen
          .getAllByText('Personal Information')[0]
          .closest('button');
        if (!button) return null;
        const indicator = within(button).getByTestId(
          'section-progress-indicator',
        );
        return indicator.getAttribute('data-status');
      };

      // Initial: PI visible, firstName='Sarah' saved → complete.
      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
        expect(getPiStatus()).toBe('complete');
      });

      // Add a new cross-section requirement (no saved value) → incomplete.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(getPiStatus()).toBe('incomplete');
      });

      // Clear the registry. The saved firstName must STILL be present —
      // if BR 3 were violated and saved data were deleted on hide, status
      // would not return to 'complete' here.
      await user.click(
        screen.getByTestId('address-history-stub-clear-source'),
      );

      await waitFor(() => {
        expect(getPiStatus()).toBe('complete');
      });
    });

    // -------------------------------------------------------------------------
    // BR 4 / DoD 4 — A new required field appears empty.
    // -------------------------------------------------------------------------
    it('BR 4 / DoD 4: a new required field added by recalculation appears empty (status flips to incomplete)', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'pi-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
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
                  fields: [{ requirementId: 'pi-firstName', value: 'Sarah' }],
                },
                address_history: { entries: [] },
              },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: { sections: [], allComplete: false, totalErrors: 0 },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      const getPiStatus = (): string | null => {
        const button = screen
          .getAllByText('Personal Information')[0]
          .closest('button');
        if (!button) return null;
        const indicator = within(button).getByTestId(
          'section-progress-indicator',
        );
        return indicator.getAttribute('data-status');
      };

      await waitFor(() => {
        expect(getPiStatus()).toBe('complete');
      });

      // Add a new cross-section requirement (middleName). If BR 4 were
      // violated and new fields were pre-populated, status would remain
      // 'complete'. The flip to 'incomplete' proves the new field is empty.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(getPiStatus()).toBe('incomplete');
      });
    });

    // -------------------------------------------------------------------------
    // BR 9c — A skipped dynamic step does NOT block Submit even when the
    // server's /validate response reports it as incomplete.
    // -------------------------------------------------------------------------
    it('BR 9c: skipped Personal Info does NOT block Submit even though /validate reports it as incomplete', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
          validateResponse: {
            sections: [],
            summary: {
              sections: [
                {
                  sectionId: 'personal_info',
                  sectionName: 'Personal Information',
                  status: 'incomplete',
                  errors: [],
                },
                {
                  sectionId: 'address_history',
                  sectionName: 'Address History',
                  status: 'complete',
                  errors: [],
                },
                {
                  sectionId: 'welcome',
                  sectionName: 'Welcome',
                  status: 'complete',
                  errors: [],
                },
                {
                  sectionId: 'after-1',
                  sectionName: 'Consent Form',
                  status: 'complete',
                  errors: [],
                },
                {
                  sectionId: 'service_verification-edu',
                  sectionName: 'Education',
                  status: 'complete',
                  errors: [],
                },
                {
                  sectionId: 'service_verification-emp',
                  sectionName: 'Employment',
                  status: 'complete',
                  errors: [],
                },
              ],
              allComplete: false,
              totalErrors: 0,
            },
          },
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      await user.click(
        screen.getAllByText('Review & Submit')[0].closest('button')!,
      );

      await waitFor(() => {
        expect(screen.getByTestId('review-submit-page')).toBeInTheDocument();
      });

      // The patched validation result hides personal_info's incomplete
      // verdict; with every OTHER section complete, allComplete flips to
      // true and the Submit button is ENABLED.
      const submitButton = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
      expect(submitButton.getAttribute('aria-disabled')).toBe('false');
    });

    // -------------------------------------------------------------------------
    // BR 9a / 9b — Skipped sections absent from Review summary.
    // -------------------------------------------------------------------------
    it('BR 9a / 9b: skipped Personal Info and Record Search are absent from the Review summary', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      await user.click(
        screen.getAllByText('Review & Submit')[0].closest('button')!,
      );

      await waitFor(() => {
        expect(screen.getByTestId('review-submit-page')).toBeInTheDocument();
      });

      const reviewPage = screen.getByTestId('review-submit-page');

      expect(
        within(reviewPage).queryByRole('heading', {
          name: /^Personal Information$/,
        }),
      ).not.toBeInTheDocument();
      expect(
        within(reviewPage).queryByRole('heading', {
          name: /^Record Search Requirements$/,
        }),
      ).not.toBeInTheDocument();

      // Non-skipped sections still appear.
      expect(
        within(reviewPage).getByRole('heading', { name: /^Welcome$/ }),
      ).toBeInTheDocument();
      expect(
        within(reviewPage).getByRole('heading', { name: /^Address History$/ }),
      ).toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // BR 9d — disableSubmitForDynamicGaps. A newly-visible, locally-
    // incomplete dynamic step forces Submit disabled even if /validate
    // reports allComplete=true.
    // -------------------------------------------------------------------------
    it('BR 9d: a newly-visible-but-incomplete Personal Info BLOCKS Submit (most-restrictive override)', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
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
            json: async () => ({
              sections: { address_history: { entries: [] } },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: {
                sections: [
                  {
                    sectionId: 'welcome',
                    sectionName: 'Welcome',
                    status: 'complete',
                    errors: [],
                  },
                  {
                    sectionId: 'address_history',
                    sectionName: 'Address History',
                    status: 'complete',
                    errors: [],
                  },
                  {
                    sectionId: 'service_verification-edu',
                    sectionName: 'Education',
                    status: 'complete',
                    errors: [],
                  },
                  {
                    sectionId: 'service_verification-emp',
                    sectionName: 'Employment',
                    status: 'complete',
                    errors: [],
                  },
                  {
                    sectionId: 'after-1',
                    sectionName: 'Consent Form',
                    status: 'complete',
                    errors: [],
                  },
                ],
                allComplete: true,
                totalErrors: 0,
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
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      // Add a cross-section subject requirement → PI becomes visible AND
      // incomplete (new middleName has no saved value).
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });

      // Navigate to Review & Submit.
      await user.click(
        screen.getAllByText('Review & Submit')[0].closest('button')!,
      );

      await waitFor(() => {
        expect(screen.getByTestId('review-submit-page')).toBeInTheDocument();
      });

      // Submit MUST be disabled — disableSubmitForDynamicGaps overrides
      // even when the server's allComplete is true.
      const submitButton = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitButton).toBeDisabled();
      expect(submitButton.getAttribute('aria-disabled')).toBe('true');
    });

    // -------------------------------------------------------------------------
    // Edge case 2 — Safety-net effect: when the active section becomes
    // invisible mid-session, the shell moves the candidate to a visible
    // step automatically. We exercise the fall-back-to-visible effect by
    // making PI visible, navigating to PI, then clearing the cross-section
    // source so PI becomes invisible. The post-clear active section MUST
    // be a visible one — never a hidden one.
    // -------------------------------------------------------------------------
    it('Edge case 2: when the active section becomes invisible, the shell silently navigates to a visible step', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [],
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      // Make PI visible.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });

      // Navigate TO Personal Info.
      await user.click(
        screen.getAllByText('Personal Information')[0].closest('button')!,
      );

      await waitFor(() => {
        const piButton = screen
          .getAllByText('Personal Information')[0]
          .closest('button');
        expect(piButton).toHaveClass('bg-blue-50', 'text-blue-700');
      });

      // Go back to AH so we can access the clear button. (PortalLayout's
      // safety net fires whenever visibleSectionsWithStatus changes such
      // that the active section is no longer in it; the next step makes
      // PI invisible while we're not on it, but the effect will still
      // hold the next active section to a visible one.)
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        screen.getByTestId('address-history-stub-clear-source'),
      );

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });

      // The currently-highlighted (active) sidebar entry must be a
      // visible section — never Personal Information.
      const visibleTitles = [
        'Welcome',
        'Address History',
        'Education',
        'Employment',
        'Consent Form',
        'Review & Submit',
      ];
      const highlightedButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.classList.contains('bg-blue-50'));
      expect(highlightedButtons.length).toBeGreaterThanOrEqual(1);
      for (const btn of highlightedButtons) {
        const hasVisibleTitle = visibleTitles.some((title) =>
          (btn.textContent ?? '').includes(title),
        );
        expect(hasVisibleTitle).toBe(true);
        expect(btn.textContent ?? '').not.toMatch(/Personal Information/);
      }
    });

    // -------------------------------------------------------------------------
    // Resolved Q3 — A skipped-then-returned step retains its previous
    // completion status (no reset to 'not_started').
    // -------------------------------------------------------------------------
    it('Resolved Q3: a skipped-then-returned step retains its previous completion status (no reset)', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'pi-firstName',
                  name: 'First Name',
                  fieldKey: 'firstName',
                  dataType: 'text',
                  isRequired: true,
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
                  fields: [{ requirementId: 'pi-firstName', value: 'Sarah' }],
                },
                address_history: { entries: [] },
              },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: { sections: [], allComplete: false, totalErrors: 0 },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      const getPiStatus = (): string | null => {
        const button = screen
          .getAllByText('Personal Information')[0]
          .closest('button');
        if (!button) return null;
        const indicator = within(button).getByTestId(
          'section-progress-indicator',
        );
        return indicator.getAttribute('data-status');
      };

      await waitFor(() => {
        expect(getPiStatus()).toBe('complete');
      });

      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );
      await user.click(
        await screen.findByTestId(
          'address-history-stub-trigger-add-middlename-au',
        ),
      );

      await waitFor(() => {
        expect(getPiStatus()).toBe('incomplete');
      });

      await user.click(
        screen.getByTestId('address-history-stub-clear-source'),
      );

      await waitFor(() => {
        expect(getPiStatus()).toBe('complete');
      });
    });

    // -------------------------------------------------------------------------
    // Code Review W3 — Record Search has no server-side validator, so the
    // shell applies a post-merge override that flips status to 'incomplete'
    // once the candidate has visited and departed the section without
    // filling anything in (Spec mergeSectionStatus Rule 2 analogue). This
    // test exercises that override end-to-end.
    // -------------------------------------------------------------------------
    it('W3 / record_search override: status flips to incomplete after visit+depart with no values', async () => {
      const user = userEvent.setup();
      vi.mocked(global.fetch).mockImplementation(
        buildFetchImpl({
          personalInfoFields: [],
          addressHistoryEntries: [
            { entryId: 'addr-1', countryId: 'US', entryOrder: 0, fields: [] },
          ],
          entryFields: {
            'addr-1': [
              {
                requirementId: 'rs-1',
                name: 'Search Fee Acknowledgment',
                fieldKey: 'searchFeeAck',
                type: 'field',
                dataType: 'checkbox',
                isRequired: true,
                displayOrder: 1,
                fieldData: { collectionTab: 'search' },
              },
            ],
          },
        }) as unknown as typeof global.fetch,
      );

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      // Wait until Record Search becomes visible (per-entry /fields has
      // settled and the aggregated-items list is non-empty).
      await waitFor(() => {
        expect(hasSidebarSection('Record Search Requirements')).toBe(true);
      });

      const getRecordSearchStatus = (): string | null => {
        const button = screen
          .getAllByText('Record Search Requirements')[0]
          .closest('button');
        if (!button) return null;
        const indicator = within(button).getByTestId(
          'section-progress-indicator',
        );
        return indicator.getAttribute('data-status');
      };

      // Before visiting: status is 'not_started' (no visit record yet).
      expect(getRecordSearchStatus()).toBe('not_started');

      // Visit Record Search. The shell mounts the stub and marks visited.
      await user.click(
        screen.getAllByText('Record Search Requirements')[0].closest('button')!,
      );

      // Depart by clicking another section. The shell marks departed; the
      // post-merge override then flips status from 'not_started' to
      // 'incomplete' because the visit/departure pair fires while the
      // candidate has no saved values for the required item.
      await user.click(
        screen.getAllByText('Welcome')[0].closest('button')!,
      );

      await waitFor(() => {
        expect(getRecordSearchStatus()).toBe('incomplete');
      });
    });

    // -------------------------------------------------------------------------
    // Code Review W4 — Loading gate verification. While the
    // /personal-info-fields fetch is still in flight, the shell cannot
    // distinguish "no local fields" from "haven't loaded yet". The
    // visibility memo defaults BOTH dynamic steps to visible during that
    // window so the sidebar does not flicker through a 'skipped' state.
    // Once the fetch resolves with zero fields (and no cross-section
    // contributions), Personal Info correctly becomes hidden.
    // -------------------------------------------------------------------------
    it('W4 / loading gate: Personal Info stays visible while /personal-info-fields is in flight, hides after empty response settles', async () => {
      let resolvePersonalInfoFields: (() => void) | null = null;
      const personalInfoFieldsHeld = new Promise<void>((resolve) => {
        resolvePersonalInfoFields = resolve;
      });

      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          // Hold the fetch open until the test resolves it explicitly.
          return personalInfoFieldsHeld.then(
            () =>
              ({
                ok: true,
                json: async () => ({ fields: [] }),
              }) as Response,
          );
        }
        if (u.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: { address_history: { entries: [] } },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: { sections: [], allComplete: false, totalErrors: 0 },
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      // While /personal-info-fields is still pending, the loading gate
      // keeps Personal Info visible — even though there are no local
      // fields and no cross-section subject requirements yet (which is
      // the same state that would normally hide it).
      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(true);
      });

      // Resolve the held fetch with zero fields. The loading gate clears
      // and the real pure-function rule applies: PI becomes hidden.
      resolvePersonalInfoFields!();

      await waitFor(() => {
        expect(hasSidebarSection('Personal Information')).toBe(false);
      });
    });

    // -------------------------------------------------------------------------
    // Code Review W5 — Mid-session refresh path. When AddressHistorySection
    // fires its `onSaveSuccess`, the shell must re-fetch /saved-data so the
    // shell-level `addressHistoryEntries` reflects the candidate's latest
    // entries. Without this, a newly-saved entry whose country produces
    // record-search requirements would never make Record Search appear in
    // the sidebar (the initial-mount hydration only fires once).
    // -------------------------------------------------------------------------
    it('W5 / refreshAddressHistoryEntries: onSaveSuccess refetches saved-data and updates Record Search visibility', async () => {
      const user = userEvent.setup();
      let savedDataCallCount = 0;
      vi.mocked(global.fetch).mockImplementation((url: string | URL | Request) => {
        const u = String(url ?? '');
        if (u.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] }),
          } as Response);
        }
        if (u.includes('/saved-data')) {
          savedDataCallCount++;
          // Initial hydration: no entries → Record Search hidden.
          // After onSaveSuccess fires: one US entry → Record Search visible.
          const entries =
            savedDataCallCount === 1
              ? []
              : [
                  {
                    entryId: 'addr-new',
                    countryId: 'US',
                    entryOrder: 0,
                    fields: [],
                  },
                ];
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: { address_history: { entries } },
              sectionVisits: {},
              reviewPageVisitedAt: null,
            }),
          } as Response);
        }
        if (u.includes('/fields')) {
          const match = u.match(/countryId=([^&]+)/);
          const countryId = match ? decodeURIComponent(match[1]) : null;
          const fields =
            countryId === 'US'
              ? [
                  {
                    requirementId: 'rs-1',
                    name: 'Search Fee Acknowledgment',
                    fieldKey: 'searchFeeAck',
                    type: 'field',
                    dataType: 'checkbox',
                    isRequired: true,
                    displayOrder: 1,
                    fieldData: { collectionTab: 'search' },
                  },
                ]
              : [];
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields }),
          } as Response);
        }
        if (u.includes('/validate')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sections: [],
              summary: { sections: [], allComplete: false, totalErrors: 0 },
            }),
          } as Response);
        }
        if (u.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={dynamicSections}
          token={mockToken}
        />,
      );

      // Initial state: no entries → Record Search hidden in the sidebar.
      await waitFor(() => {
        expect(hasSidebarSection('Record Search Requirements')).toBe(false);
      });

      // Navigate to Address History so the stub (and its
      // trigger-save-success button) is mounted.
      await user.click(
        screen.getAllByText('Address History')[0].closest('button')!,
      );

      // Fire the stub's onSaveSuccess button — this calls the shell's
      // `handleAddressHistorySaveSuccess`, which in turn triggers
      // `refreshAddressHistoryEntries` (the W5 code path under test).
      const saveBtn = await screen.findByTestId(
        'address-history-stub-trigger-save-success',
      );
      await user.click(saveBtn);

      // After the refresh: /saved-data returns one US entry, the
      // per-entry /fields fetch returns one required item, and Record
      // Search appears in the sidebar.
      await waitFor(() => {
        expect(hasSidebarSection('Record Search Requirements')).toBe(true);
      });

      // Sanity check — the saved-data endpoint was called at least twice
      // (once on initial hydration, once on the refresh path).
      expect(savedDataCallCount).toBeGreaterThanOrEqual(2);
    });
  });
});
