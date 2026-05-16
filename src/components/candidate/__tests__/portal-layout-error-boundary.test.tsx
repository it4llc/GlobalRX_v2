// /GlobalRX_v2/src/components/candidate/__tests__/portal-layout-error-boundary.test.tsx
//
// Task 9.1 — Error Boundaries & Loading States (Pass 2 component tests).
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md
//       §"Existing Files to Modify" #1 (portal-layout.tsx ErrorBoundary
//       integration)
//
// This file is dedicated to the portal-layout's new ErrorBoundary wiring
// added by Task 9.1. We keep it SEPARATE from the existing
// portal-layout.test.tsx so the integration assertions live in one
// readable place and the existing TD-059 test fixtures are untouched.
//
// Subject of the test (NEVER mocked):
//   - PortalLayout                            (the shell under test)
//   - ErrorBoundary                            (the wiring under test)
//   - CandidateSectionErrorFallback           (the fallback DOM the tests assert against)
//   - Button (inside the fallback)            (its click handlers are the assertions)
//
// Mocked (and why):
//   - The heavy form-engine sections (PersonalInfoSection, AddressHistorySection,
//     EducationSection, EmploymentSection, IdvSection, RecordSearchSection,
//     WorkflowSectionRenderer, ReviewSubmitPage). Each is replaced with a
//     stub that EITHER renders a harmless `data-testid` placeholder OR
//     throws on render when a per-test flag tells it to. The crash flag
//     drives the assertion target — the ErrorBoundary catching that crash
//     and showing the fallback (Rule M2: these heavy children's normal
//     rendering is irrelevant to whether the boundary catches a throw;
//     the only behavior under assertion is "section throws -> fallback
//     appears", which the stub exposes directly).
//   - global fetch — URL-routed mock copied from portal-layout.test.tsx so
//     /personal-info-fields and /saved-data hydration settle successfully.
//   - @/lib/client-logger — replaced with a spy so the test can verify
//     handleSectionRenderError calls logger.error with the section id
//     when a section throws.
//   - @/hooks/useDebounce — pass-through identity (matches portal-layout.test.tsx).
//   - @/contexts/TranslationContext — overridden locally with a small
//     dictionary-backed translator that mirrors production behavior:
//       * resolves known translation KEYS to readable strings (matching the
//         en-US.json values), and
//       * substitutes `{{placeholder}}` tokens in those resolved strings.
//     Production section titles arriving from the structure endpoint are
//     translation keys (e.g. `candidate.portal.sections.personalInformation`),
//     and the portal-layout MUST run them through `t()` before passing the
//     localized string into the ErrorBoundary fallback. A previous version
//     of this test used plain English strings as fixture titles, which
//     hid that bug: an identity translator returns unmatched keys verbatim,
//     so a regression that dropped the `t()` wrap would still pass. With a
//     resolving dictionary in place, the assertion below would FAIL if the
//     `t()` wrap were removed because the raw key (not the readable name)
//     would be the only thing in the DOM.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PortalLayout from '../portal-layout';
import type {
  CandidateInvitationInfo,
  CandidatePortalSection,
} from '@/types/candidate-portal';

// ---------------------------------------------------------------------------
// vi.hoisted — variables that need to exist BEFORE the vi.mock factories run.
// vi.mock is hoisted to the top of the module by Vitest's transformer, which
// means any plain top-level const referenced inside a mock factory throws
// "Cannot access X before initialization". `vi.hoisted` solves this by
// running the supplied factory at the same hoisted stage as vi.mock.
// ---------------------------------------------------------------------------
const { loggerErrorSpy, crashConfig } = vi.hoisted(() => {
  return {
    loggerErrorSpy: vi.fn(),
    crashConfig: { sectionsToCrash: new Set<string>() },
  };
});

// ---------------------------------------------------------------------------
// Translation mock — dictionary-backed translator that:
//   1. Resolves known translation KEYS to readable strings (mirroring the
//      en-US.json values for the keys we use in this test).
//   2. Falls through to identity for unknown keys.
//   3. Applies {{placeholder}} substitution AFTER the dictionary lookup,
//      matching production behavior.
//
// The dictionary is intentionally small — we only include the keys this
// suite actually renders. If a test triggers a key that isn't in the
// dictionary, the identity fallback preserves the existing behavior used
// by other assertions (e.g. `getByText('candidate.error.tryAgain')`).
// ---------------------------------------------------------------------------
const translationDictionary: Record<string, string> = {
  // Section titles emitted by the structure endpoint and stored on
  // section.title. portal-layout MUST run these through t() before passing
  // them into the ErrorBoundary fallback as `sectionTitle`. The assertions
  // below depend on these resolved values appearing in the DOM.
  'candidate.portal.sections.personalInformation': 'Personal Information',
  'candidate.portal.sections.addressHistory': 'Address History',
  // The named-failure message uses {{sectionName}} placeholder substitution
  // so the rendered fallback reads e.g. "The Personal Information section
  // couldn't be loaded. Your progress has been saved." This is the string
  // the candidate actually sees, and the string the assertions target.
  'candidate.error.sectionFailedWithName':
    "The {{sectionName}} section couldn't be loaded. Your progress has been saved.",
};

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const resolved = translationDictionary[key] ?? key;
      if (!params) return resolved;
      let text = resolved;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replaceAll(`{{${paramKey}}}`, String(paramValue));
      }
      return text;
    },
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  }),
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ---------------------------------------------------------------------------
// useDebounce pass-through — mirrors portal-layout.test.tsx.
// ---------------------------------------------------------------------------
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T): T => value,
}));

// ---------------------------------------------------------------------------
// client-logger mock — captured so the test can assert that
// handleSectionRenderError forwards the error to logger.error with the
// section id metadata (spec risk #4: Winston is server-only, so the
// portal-layout uses clientLogger instead).
// ---------------------------------------------------------------------------
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: loggerErrorSpy,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Section stubs — toggleable "throw on render" flag. Tests flip the flag
// on a specific section id before rendering; the matching stub then throws
// when React mounts it, triggering the real ErrorBoundary the shell wraps
// it in.
// ---------------------------------------------------------------------------
vi.mock('../form-engine/PersonalInfoSection', () => ({
  PersonalInfoSection: () => {
    if (crashConfig.sectionsToCrash.has('personal_info')) {
      throw new Error('stub crash for personal_info');
    }
    return <div data-testid="personal-info-stub">personal info stub</div>;
  },
}));

vi.mock('../form-engine/IdvSection', () => ({
  IdvSection: () => {
    if (crashConfig.sectionsToCrash.has('idv')) {
      throw new Error('stub crash for idv');
    }
    return <div data-testid="idv-stub">idv stub</div>;
  },
}));

vi.mock('../form-engine/AddressHistorySection', () => ({
  AddressHistorySection: () => {
    if (crashConfig.sectionsToCrash.has('address_history')) {
      throw new Error('stub crash for address_history');
    }
    return <div data-testid="address-history-stub">address history stub</div>;
  },
}));

vi.mock('../form-engine/EducationSection', () => ({
  EducationSection: () => {
    if (crashConfig.sectionsToCrash.has('education')) {
      throw new Error('stub crash for education');
    }
    return <div data-testid="education-stub">education stub</div>;
  },
}));

vi.mock('../form-engine/EmploymentSection', () => ({
  EmploymentSection: () => {
    if (crashConfig.sectionsToCrash.has('employment')) {
      throw new Error('stub crash for employment');
    }
    return <div data-testid="employment-stub">employment stub</div>;
  },
}));

vi.mock('../form-engine/RecordSearchSection', () => ({
  RecordSearchSection: () => {
    if (crashConfig.sectionsToCrash.has('record_search')) {
      throw new Error('stub crash for record_search');
    }
    return <div data-testid="record-search-stub">record search stub</div>;
  },
}));

vi.mock('../form-engine/WorkflowSectionRenderer', () => ({
  default: () => {
    if (crashConfig.sectionsToCrash.has('workflow_section')) {
      throw new Error('stub crash for workflow_section');
    }
    return <div data-testid="workflow-stub">workflow stub</div>;
  },
}));

vi.mock('../review-submit/ReviewSubmitPage', () => ({
  ReviewSubmitPage: () => {
    if (crashConfig.sectionsToCrash.has('review_submit')) {
      throw new Error('stub crash for review_submit');
    }
    return <div data-testid="review-stub">review stub</div>;
  },
}));

// ---------------------------------------------------------------------------
// global fetch — URL-routed so the shell's saved-data + personal-info-fields
// hydration completes without errors that would muddy the test. Pattern
// copied verbatim from portal-layout.test.tsx defaultFetchImpl.
// ---------------------------------------------------------------------------
global.fetch = vi.fn();

function defaultFetchImpl() {
  return (url: string | URL | Request) => {
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
    if (u.includes("/validate")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sections: [],
          summary: { sections: [], allComplete: false, totalErrors: 0 },
        }),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404 } as Response);
  };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const mockInvitation: CandidateInvitationInfo = {
  firstName: 'Test',
  lastName: 'Candidate',
  email: 'test@example.com',
  phone: null,
  status: 'accessed',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  companyName: 'Acme Corp',
};

// IMPORTANT: section.title is a TRANSLATION KEY in production, not a
// resolved string. The structure endpoint emits keys like
// `candidate.portal.sections.personalInformation` (see
// /api/candidate/application/[token]/structure). The portal-sidebar
// already routes those keys through t() at render time; the portal-layout
// must do the same when it forwards the title to the ErrorBoundary
// fallback. Using realistic keys in the fixture — together with the
// dictionary-backed translator mock above — means a regression that
// removes the t() wrap in portal-layout.tsx will surface here as a
// failing assertion: the raw key would appear in the DOM instead of the
// readable section name.
const sectionsFixture: CandidatePortalSection[] = [
  {
    id: 'personal_info',
    title: 'candidate.portal.sections.personalInformation',
    type: 'personal_info',
    placement: 'services',
    status: 'not_started',
    order: 0,
    functionalityType: null,
  },
  {
    id: 'service_record',
    title: 'candidate.portal.sections.addressHistory',
    type: 'address_history',
    placement: 'services',
    status: 'not_started',
    order: 1,
    functionalityType: null,
  },
];

const mockToken = 'test-token-9.1';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PortalLayout — ErrorBoundary integration (Task 9.1)', () => {
  // Suppress React's "The above error occurred…" log noise from the test
  // runner. The boundary catching the error is correct behavior, but
  // React still logs the underlying throw to console.error in development.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    crashConfig.sectionsToCrash = new Set<string>();
    loggerErrorSpy.mockClear();
    vi.mocked(global.fetch).mockImplementation(defaultFetchImpl());
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('healthy section rendering (boundary stays out of the way)', () => {
    it('renders the active section content normally when no section throws', () => {
      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // PersonalInfoSection is the default active section; the stub
      // renders its placeholder div instead of the real section.
      expect(screen.getByTestId('personal-info-stub')).toBeInTheDocument();

      // No fallback DOM — the boundary is wrapped around the section but
      // has nothing to catch.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByText('candidate.error.sectionFailedTitle'),
      ).not.toBeInTheDocument();
    });
  });

  describe('crashing section triggers the candidate-friendly fallback', () => {
    it('shows the CandidateSectionErrorFallback with the resolved section name when the active section throws on render', () => {
      crashConfig.sectionsToCrash.add('personal_info');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // The boundary caught the throw, so the section content is gone.
      expect(
        screen.queryByTestId('personal-info-stub'),
      ).not.toBeInTheDocument();

      // The fallback's alert container is mounted with the translation-key
      // title text from CandidateSectionErrorFallback. The title key is
      // not in the dictionary, so the identity fallback preserves it
      // verbatim — that branch is intentionally unchanged.
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(
        screen.getByText('candidate.error.sectionFailedTitle'),
      ).toBeInTheDocument();

      // The named-message variant must include the RESOLVED section name,
      // not the raw translation key. This is the critical assertion: the
      // portal-layout receives `section.title` as a translation key, and
      // MUST pass it through t() before handing it to the fallback. If
      // the t() wrap were removed, the placeholder substitution would
      // produce "The candidate.portal.sections.personalInformation
      // section couldn't be loaded..." instead, and this assertion would
      // fail.
      expect(
        screen.getByText(
          "The Personal Information section couldn't be loaded. Your progress has been saved.",
        ),
      ).toBeInTheDocument();

      // Belt-and-suspenders: the raw translation key for the section
      // title must NOT appear anywhere in the rendered DOM. If a future
      // regression bypasses t() the raw key would leak through into the
      // fallback message and this check would fail.
      expect(
        screen.queryByText(/candidate\.portal\.sections\.personalInformation/),
      ).not.toBeInTheDocument();
    });

    it('invokes the clientLogger.error spy with the section id when a section throws', async () => {
      crashConfig.sectionsToCrash.add('personal_info');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // handleSectionRenderError fires in componentDidCatch; the boundary
      // invokes it synchronously after the fallback renders. By the time
      // the fallback is in the DOM, the logger spy has been called.
      await waitFor(() => {
        expect(loggerErrorSpy).toHaveBeenCalled();
      });

      // We assert on the call shape: the first positional argument is the
      // message string `'Candidate portal section render error'`; the
      // second positional argument is a metadata object containing the
      // active sectionId. We don't pin the exact error.message string
      // because the stub provides it and a future stub change shouldn't
      // ripple into this assertion.
      const firstCall = loggerErrorSpy.mock.calls[0];
      expect(firstCall[0]).toBe('Candidate portal section render error');
      const meta = firstCall[1] as Record<string, unknown>;
      expect(meta.event).toBe('candidate_section_render_error');
      expect(meta.sectionId).toBe('personal_info');
      expect(typeof meta.error).toBe('string');
    });
  });

  describe('boundary remounts when activeSection changes (key prop)', () => {
    it('isolates a crash in one section so it does not block a different section', async () => {
      // Personal Info (the default) crashes; Address History is healthy.
      // The candidate navigates to Address History from the sidebar; the
      // boundary's `key={activeSection}` prop forces a fresh boundary
      // instance so the previous error state is discarded.
      crashConfig.sectionsToCrash.add('personal_info');

      const user = userEvent.setup();

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // Boundary caught Personal Info's throw — the fallback is visible.
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Click the Address History entry in the sidebar. The shell
      // dispatches AddressHistorySection on that section type; its stub
      // is NOT in the crash set, so it should render normally. The
      // sidebar resolves `section.title` through t() so the visible text
      // is the readable name "Address History" (matching the dictionary
      // entry above).
      const sidebarLink = screen.getAllByText('Address History')[0].closest('button');
      await user.click(sidebarLink!);

      // The healthy section's stub is now in the DOM, and the fallback
      // is gone. This proves the boundary did not carry the Personal
      // Info error state forward when the active section changed.
      await waitFor(() => {
        expect(screen.getByTestId('address-history-stub')).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByText('candidate.error.sectionFailedTitle'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Try Again button (resetErrorBoundary wiring)', () => {
    it('clears the fallback and re-renders the section after the underlying problem is gone', async () => {
      // Crash on first render, then remove the section from the crash set
      // and click Try Again. The boundary reset() runs, the section is
      // re-rendered, the stub no longer throws, and the healthy stub
      // appears in the DOM.
      crashConfig.sectionsToCrash.add('personal_info');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Simulate "the bug is now fixed" by removing the section from the
      // crash flag set before reset, then clicking Try Again.
      crashConfig.sectionsToCrash.delete('personal_info');

      fireEvent.click(
        screen.getByRole('button', { name: 'candidate.error.tryAgain' }),
      );

      // After reset, the healthy stub is in the DOM and the fallback is
      // gone.
      await waitFor(() => {
        expect(screen.getByTestId('personal-info-stub')).toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Skip to Next Step button (onSkipToNext wiring)', () => {
    it('renders Skip to Next Step when there IS a next section to navigate to', () => {
      crashConfig.sectionsToCrash.add('personal_info');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // Personal Info is index 0 of two visible sections; there IS a
      // next section (Address History), so the fallback's onSkipToNext
      // handler is wired and the button must be rendered.
      expect(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      ).toBeInTheDocument();
    });

    it('navigates to the next section when Skip to Next Step is clicked', async () => {
      crashConfig.sectionsToCrash.add('personal_info');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      );

      // The shell wires handleNextClick as the skip handler. Clicking it
      // advances the candidate to Address History, which renders normally
      // (the stub is not in the crash set).
      await waitFor(() => {
        expect(screen.getByTestId('address-history-stub')).toBeInTheDocument();
      });
      // And the fallback is gone (the boundary remounts on section change).
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hides Skip to Next Step when the crashing section is the LAST navigable section', async () => {
      // Address History is the only section after Personal Info; if the
      // last section crashes, there's nothing to skip to, so the shell
      // passes `undefined` for onSkipToNext and the button is hidden.
      crashConfig.sectionsToCrash.add('address_history');

      render(
        <PortalLayout
          invitation={mockInvitation}
          sections={sectionsFixture}
          token={mockToken}
        />,
      );

      // Need to be on Address History — navigate via the sidebar first.
      // The sidebar resolves the title key to "Address History" through
      // t(), so the visible label matches the dictionary value above.
      const sidebarLink = screen.getAllByText('Address History')[0].closest('button');
      fireEvent.click(sidebarLink!);

      // The boundary has caught the crash from AddressHistorySection.
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Try Again is always present.
      expect(
        screen.getByRole('button', { name: 'candidate.error.tryAgain' }),
      ).toBeInTheDocument();

      // Skip to Next Step is hidden because there is no next section.
      expect(
        screen.queryByRole('button', { name: 'candidate.error.skipToNext' }),
      ).not.toBeInTheDocument();
    });
  });
});
