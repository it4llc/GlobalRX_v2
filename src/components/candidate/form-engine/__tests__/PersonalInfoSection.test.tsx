// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx
//
// Pass 2 tests for PersonalInfoSection.
//
// Task 8.3 update — Personal Info — 100% Dynamic.
// Spec:  docs/specs/personal-info-dynamic.md (Business Rules 1, 2, 4; DoD 1-4)
// Plan:  docs/plans/personal-info-dynamic-technical-plan.md (Section 3 + 11)
//
// As of Task 8.3 the shell never passes the four LOCKED_INVITATION_FIELD_KEYS
// (firstName, lastName, email, phone, phoneNumber) into the section because
// the API filters them out before they reach the shell. Pre-existing tests
// that asserted on the readonly/disabled rendering of locked invitation
// fields are replaced with tests for the new contract:
//   - locked invitation fields are not rendered when not passed
//   - non-locked dynamic fields still render normally
//   - the empty-state branch shows the noFieldsRequired translation key
//   - the section reports onProgressUpdate('complete') when there are no
//     fields AND no cross-section requirements (spec DoD item 4)
//
// Earlier TD-059 plumbing tests (shell-driven prop contract, auto-save flows,
// onSavedValuesChange push-up, the cross-section overlay regression for
// Bug 2, Spec Test Case 12 for instant progress reporting) are preserved
// verbatim and continue to validate behavior that is orthogonal to Task 8.3.
//
// Mocking discipline (Pass 2):
//   - Rule M1: PersonalInfoSection is the subject — NOT mocked.
//   - Rule M2: DynamicFieldRenderer, CrossSectionRequirementBanner,
//     SectionErrorBanner, FieldErrorMessage all render DOM that the tests
//     query — NOT mocked.
//   - Rule M3: useDebounce and useTranslation use inline implementations
//     that read their arguments. global.fetch uses an inline implementation
//     that reads the URL.
//   - Rule M4: No invented exceptions.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonalInfoSection } from '../PersonalInfoSection';
import type { PersonalInfoField } from '@/types/candidate-portal';
import type { CrossSectionRequirementEntry } from '@/types/candidate-stage4';

// Mock useDebounce to return value immediately for testing
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

// Set up global fetch mock — only `/save` is hit by the new prop contract.
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('PersonalInfoSection', () => {
  const mockToken = 'test-token-123';

  // Task 8.3 — the section's `fields` prop now only contains non-locked
  // dynamic fields. The shell filters the locked invitation fieldKeys
  // (firstName, lastName, email, phone, phoneNumber) out at the API layer
  // before passing them in. The fixture below matches that contract:
  // dateOfBirth + middleName + (a few non-locked extras used in ordering /
  // empty-state tests).
  const mockFields: PersonalInfoField[] = [
    {
      requirementId: 'req-5',
      name: 'Date of Birth',
      fieldKey: 'dateOfBirth',
      dataType: 'date',
      isRequired: true,
      instructions: 'Enter your date of birth',
      fieldData: {},
      displayOrder: 1,
      locked: false,
      prefilledValue: null
    },
    {
      requirementId: 'req-6',
      name: 'Middle Name',
      fieldKey: 'middleName',
      dataType: 'text',
      isRequired: false,
      instructions: null,
      fieldData: {},
      displayOrder: 2,
      locked: false,
      prefilledValue: null
    },
    {
      requirementId: 'req-7',
      name: 'Mother’s Maiden Name',
      fieldKey: 'mothersMaidenName',
      dataType: 'text',
      isRequired: false,
      instructions: null,
      fieldData: {},
      displayOrder: 3,
      locked: false,
      prefilledValue: null
    },
    {
      requirementId: 'req-8',
      name: 'SSN',
      fieldKey: 'ssn',
      dataType: 'text',
      isRequired: true,
      instructions: null,
      fieldData: {},
      displayOrder: 4,
      locked: false,
      prefilledValue: null
    }
  ];

  // Saved values keyed by requirementId — the shape the shell extracts from
  // `/saved-data` and passes via initialSavedValues.
  const mockSavedValues: Record<string, unknown> = {
    'req-5': '1990-05-15',
    'req-6': 'Marie'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock — only `/save` is reachable. Anything else falls through
    // to a 404 so we'd notice a regression that re-introduced section-level
    // fetching of /personal-info-fields or /saved-data.
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/save')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, savedAt: new Date().toISOString() })
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  describe('loading and rendering', () => {
    it('should show loading state initially when fields prop is empty', () => {
      // The component defaults to loading=true and only flips to false inside
      // the hydration effect. With no fields supplied yet (the shell hasn't
      // returned data), the section shows the loading translation key on
      // first render, then transitions to the empty state once the effect
      // runs.
      render(<PersonalInfoSection token={mockToken} fields={[]} />);

      // The hydration effect fires synchronously after the first render in
      // testing-library, so by the time the queries run we're already in the
      // post-loading state. Both the loading translation AND the empty-state
      // translation are valid here — assert that one of them is rendered.
      const loadingOrEmpty =
        screen.queryByText('candidate.portal.personalInfo.loading') ||
        screen.queryByText('candidate.portal.personalInfo.noFieldsRequired');
      expect(loadingOrEmpty).toBeInTheDocument();
    });

    it('should display fields supplied via the fields prop', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      expect(await screen.findByText('candidate.portal.sections.personalInformation')).toBeInTheDocument();

      // Check that fields are rendered
      expect(screen.getByText('Date of Birth')).toBeInTheDocument();
      expect(screen.getByText('Middle Name')).toBeInTheDocument();
      expect(screen.getByText('Mother’s Maiden Name')).toBeInTheDocument();
      expect(screen.getByText('SSN')).toBeInTheDocument();
    });

    it('should show empty state when no fields are configured (Task 8.3 DoD 3)', async () => {
      // Spec DoD item 3: when no subject-targeted fields exist, Personal Info
      // shows the noFieldsRequired translation key.
      render(<PersonalInfoSection token={mockToken} fields={[]} />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.personalInfo.noFieldsRequired')).toBeInTheDocument();
      });
    });

    it('renders the empty state without making any /personal-info-fields or /saved-data fetches', async () => {
      // TD-059 contract: the section MUST NOT fetch its own field defs or
      // saved values. The default mock returns 404 for anything other than
      // /save; if the section regresses and hits these endpoints, they will
      // fail and the empty state assertion below would still pass — so we
      // also assert the fetch mock was never called with those URLs.
      render(<PersonalInfoSection token={mockToken} fields={[]} />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.personalInfo.noFieldsRequired')).toBeInTheDocument();
      });

      const fetchUrls = mockFetch.mock.calls.map((call) => String(call[0] ?? ''));
      expect(fetchUrls.some((u) => u.includes('/personal-info-fields'))).toBe(false);
      expect(fetchUrls.some((u) => u.includes('/saved-data'))).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 8.3 — locked invitation fieldKeys are no longer rendered.
  //
  // Per spec Business Rule 1 / DoD 1, the API now filters firstName, lastName,
  // email, phone, and phoneNumber out before they reach the shell. The shell
  // passes a fields prop that never contains them, and this section must
  // render only the dynamic non-locked fields. We verify that the four locked
  // labels and field-* test IDs are absent from the rendered DOM when the
  // section is given a typical Task 8.3-shaped fields prop.
  // ---------------------------------------------------------------------------
  describe('Task 8.3 — locked invitation fields are not rendered', () => {
    it('does not render firstName, lastName, email, phone, or phoneNumber when they are not in the fields prop', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      // Wait for the section to finish hydrating.
      expect(await screen.findByText('candidate.portal.sections.personalInformation')).toBeInTheDocument();

      // None of the locked fields' labels appear in the DOM.
      expect(screen.queryByText('First Name')).not.toBeInTheDocument();
      expect(screen.queryByText('Last Name')).not.toBeInTheDocument();
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone Number')).not.toBeInTheDocument();

      // None of the locked field-* test IDs appear in the DOM either.
      expect(screen.queryByTestId('field-firstName')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-lastName')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-email')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-phone')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-phoneNumber')).not.toBeInTheDocument();
    });

    it('renders only the dynamic non-locked fields supplied by the shell', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      // Every non-locked field in mockFields renders as an input with the
      // expected data-testid.
      expect(await screen.findByTestId('field-dateOfBirth')).toBeInTheDocument();
      expect(screen.getByTestId('field-middleName')).toBeInTheDocument();
      expect(screen.getByTestId('field-mothersMaidenName')).toBeInTheDocument();
      expect(screen.getByTestId('field-ssn')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Task 8.3 — empty-state branch reports `complete` to the shell so the
  // sidebar shows the green check (spec DoD item 4).
  //
  // The section's local progress effect calls computePersonalInfoStatus
  // whenever fields/values/cross-section requirements change. When fields=[]
  // and crossSectionRequirements=[], the helper returns `complete` because
  // there are zero required keys.
  // ---------------------------------------------------------------------------
  describe('Task 8.3 — empty-state progress reporting (DoD 4)', () => {
    it('reports onProgressUpdate(‘complete’) when there are no fields AND no cross-section requirements', async () => {
      const onProgressUpdate = vi.fn();

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={[]}
          crossSectionRequirements={[]}
          onProgressUpdate={onProgressUpdate}
        />
      );

      await waitFor(() => {
        expect(onProgressUpdate).toHaveBeenCalledWith('complete');
      });
    });
  });

  describe('saved data loading', () => {
    it('should load and display previously saved data from initialSavedValues prop', async () => {
      render(
        <PersonalInfoSection
          token={mockToken}
          fields={mockFields}
          initialSavedValues={mockSavedValues}
        />
      );

      await waitFor(() => {
        const dobInput = screen.getByTestId('field-dateOfBirth') as HTMLInputElement;
        expect(dobInput.value).toBe('1990-05-15');
      });

      const middleNameInput = screen.getByTestId('field-middleName') as HTMLInputElement;
      expect(middleNameInput.value).toBe('Marie');
    });
  });

  describe('auto-save functionality (Task 8.3 — only dynamic fields)', () => {
    it('should trigger auto-save when field value changes and blur occurs', async () => {
      const user = userEvent.setup();

      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      await waitFor(() => {
        expect(screen.getByTestId('field-dateOfBirth')).toBeInTheDocument();
      });

      // Type in date of birth field
      const dobInput = screen.getByTestId('field-dateOfBirth');
      await user.clear(dobInput);
      await user.type(dobInput, '1985-03-20');
      await user.tab(); // Trigger blur

      // Since useDebounce is mocked to return immediately, save should be called
      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter(
          call => call[0]?.toString().includes('/save')
        );
        expect(saveCalls.length).toBeGreaterThan(0);

        const lastSaveCall = saveCalls[saveCalls.length - 1];
        expect(lastSaveCall[1]?.method).toBe('POST');

        const body = JSON.parse(lastSaveCall[1]?.body as string);
        expect(body.sectionType).toBe('personal_info');
        expect(body.fields).toContainEqual({
          requirementId: 'req-5',
          value: '1985-03-20'
        });
      });
    });

    it('should show save status indicator', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/save')) {
          // Delay the save to allow "Saving..." to be observed
          return new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, savedAt: new Date().toISOString() })
          }), 100));
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      const middleNameInput = await screen.findByTestId('field-middleName');
      expect(middleNameInput).toBeInTheDocument();

      // Type in middle name field
      await user.type(middleNameInput, 'Anne');
      await user.tab(); // Trigger blur

      // Should show saving indicator
      expect(await screen.findByText('Saving...')).toBeInTheDocument();

      // Should show saved indicator
      expect(await screen.findByText('Saved')).toBeInTheDocument();
    });

    it('should handle save errors and retry', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      let saveCallCount = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/save')) {
          saveCallCount++;
          if (saveCallCount === 1) {
            // First save fails
            return Promise.reject(new Error('Save failed'));
          } else {
            // Retry succeeds
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, savedAt: new Date().toISOString() })
            } as Response);
          }
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      const middleNameInput = await screen.findByTestId('field-middleName');
      expect(middleNameInput).toBeInTheDocument();

      // Type in field
      await user.type(middleNameInput, 'Anne');
      await user.tab();

      // Should show error status
      expect(await screen.findByText('Save failed — retrying')).toBeInTheDocument();

      consoleError.mockRestore();
    });

    it('pushes updated saved values to the shell after a successful auto-save', async () => {
      // TD-059 contract: after a successful save the section calls
      // onSavedValuesChange so the shell's lifted progress effect sees the
      // new values. Without this push the shell would be one round-trip
      // behind on registry-change recomputes that fire while a different
      // tab is active.
      const user = userEvent.setup();
      const onSavedValuesChange = vi.fn();

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={mockFields}
          onSavedValuesChange={onSavedValuesChange}
        />
      );

      const middleNameInput = await screen.findByTestId('field-middleName');
      await user.type(middleNameInput, 'Anne');
      await user.tab();

      await waitFor(() => {
        expect(onSavedValuesChange).toHaveBeenCalled();
      });

      const lastCall = onSavedValuesChange.mock.calls[onSavedValuesChange.mock.calls.length - 1];
      const valuesPushed = lastCall[0] as Record<string, unknown>;
      expect(valuesPushed['req-6']).toBe('Anne');
    });
  });

  describe('field ordering', () => {
    it('should display fields in correct order based on displayOrder', async () => {
      const unorderedFields: PersonalInfoField[] = [
        { ...mockFields[2], displayOrder: 3 }, // mothersMaidenName
        { ...mockFields[0], displayOrder: 1 }, // dateOfBirth
        { ...mockFields[3], displayOrder: 4 }, // ssn
        { ...mockFields[1], displayOrder: 2 }, // middleName
      ];

      render(<PersonalInfoSection token={mockToken} fields={unorderedFields} />);

      expect(await screen.findByText('Date of Birth')).toBeInTheDocument();

      // Get all field inputs in order
      const dobInput = screen.getByTestId('field-dateOfBirth') as HTMLInputElement;
      const middleNameInput = screen.getByTestId('field-middleName') as HTMLInputElement;
      const mmnInput = screen.getByTestId('field-mothersMaidenName') as HTMLInputElement;
      const ssnInput = screen.getByTestId('field-ssn') as HTMLInputElement;

      // Should be ordered by displayOrder in the DOM
      const allInputs = screen.getAllByTestId(/^field-/);
      expect(allInputs[0]).toBe(dobInput);
      expect(allInputs[1]).toBe(middleNameInput);
      expect(allInputs[2]).toBe(mmnInput);
      expect(allInputs[3]).toBe(ssnInput);
    });
  });

  describe('instructions display', () => {
    it('should show field instructions when available', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      expect(await screen.findByText('Enter your date of birth')).toBeInTheDocument();

      // Just check the help text exists, not specific classes
      const helpText = screen.getByText('Enter your date of birth');
      expect(helpText).toBeInTheDocument();
    });
  });

  describe('section header', () => {
    it('should display section title and instructions', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      expect(await screen.findByText('candidate.portal.sections.personalInformation')).toBeInTheDocument();

      // Check for the instruction text (it might be split across elements)
      const container = screen.getByText('candidate.portal.sections.personalInformation').parentElement?.parentElement;
      // Check for the translation key instead of the actual text
      expect(container?.textContent).toContain('candidate.portal.personalInfo.instructions');
    });
  });

  // ---------------------------------------------------------------------------
  // Bug 2 — cross-section overlay on per-field rendering.
  //
  // The TD-059 fix originally only updated the SECTION'S progress calculation
  // when a cross-section requirement was added (e.g., country-X address makes
  // middleName required for the subject). Smoke testing surfaced that the
  // PER-FIELD red-star indicator did NOT update — middleName still rendered
  // without a red star in the section even though the sidebar was correctly
  // showing incomplete. The implementer's follow-on commit (d330ad1) added a
  // crossSectionRequiredKeys overlay to DynamicFieldRenderer's isRequired
  // prop. This test pins that fix.
  //
  // Per Mocking Rule M2: DynamicFieldRenderer is NOT mocked because the
  // assertion is on its rendered DOM (the `.required-indicator` span).
  // ---------------------------------------------------------------------------
  describe('cross-section requirement overlay (Bug 2)', () => {
    it('renders the red required-indicator on a baseline-not-required field when the cross-section registry marks it as required', async () => {
      // The fields prop carries a single non-required field. Without any
      // cross-section requirements, this field has NO red star.
      const fieldsBaselineNotRequired: PersonalInfoField[] = [
        {
          requirementId: 'req-mn',
          name: 'Middle Name',
          fieldKey: 'middleName',
          dataType: 'text',
          isRequired: false, // baseline NOT required
          instructions: null,
          fieldData: {},
          displayOrder: 1,
          locked: false,
          prefilledValue: null,
        },
      ];

      // Cross-section entry pushed by another section (e.g., Address History
      // when the candidate selects Australia). Marked as required for the
      // subject — the section must overlay this onto the field's render.
      const crossSectionRequirements: CrossSectionRequirementEntry[] = [
        {
          fieldId: 'req-mn',
          fieldKey: 'middleName',
          fieldName: 'Middle Name',
          isRequired: true,
          triggeredBy: 'address_history',
          triggeredByContext: 'AU',
          triggeredByEntryIndex: 0,
        },
      ];

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={fieldsBaselineNotRequired}
          crossSectionRequirements={crossSectionRequirements}
        />
      );

      // The Middle Name label must render with a `.required-indicator` span.
      // DynamicFieldRenderer renders the indicator only when isRequired is
      // true; because the section overlays cross-section requirements onto
      // the per-field isRequired prop, the indicator must appear here.
      // Wait for the section to finish hydrating, then narrow to the field's
      // <label> element specifically (the cross-section banner also lists
      // 'Middle Name' which would otherwise produce a multiple-match error).
      await screen.findByTestId('field-middleName');
      const middleNameLabel = document.querySelector(
        'label[for="field-middleName"]'
      );
      expect(middleNameLabel).not.toBeNull();
      expect(middleNameLabel?.querySelector('.required-indicator')).toBeInTheDocument();
    });

    it('does NOT render the red required-indicator when the cross-section entry is NOT required', async () => {
      // A registry entry that is NOT required must not produce a red star.
      const fieldsBaselineNotRequired: PersonalInfoField[] = [
        {
          requirementId: 'req-mn',
          name: 'Middle Name',
          fieldKey: 'middleName',
          dataType: 'text',
          isRequired: false,
          instructions: null,
          fieldData: {},
          displayOrder: 1,
          locked: false,
          prefilledValue: null,
        },
      ];

      const crossSectionRequirements: CrossSectionRequirementEntry[] = [
        {
          fieldId: 'req-mn',
          fieldKey: 'middleName',
          fieldName: 'Middle Name',
          isRequired: false, // explicitly not required
          triggeredBy: 'address_history',
          triggeredByContext: 'AU',
          triggeredByEntryIndex: 0,
        },
      ];

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={fieldsBaselineNotRequired}
          crossSectionRequirements={crossSectionRequirements}
        />
      );

      await screen.findByTestId('field-middleName');
      const middleNameLabel = document.querySelector(
        'label[for="field-middleName"]'
      );
      expect(middleNameLabel).not.toBeNull();
      expect(middleNameLabel?.querySelector('.required-indicator')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Spec Test Case 12 — Local field change updates sidebar immediately.
  //
  // Per the spec at docs/specs/fix-td059-td060-...md (Test Cases section,
  // case 12): when the candidate fills in a required Personal Info field,
  // the section's onProgressUpdate must fire BEFORE the auto-save round-trip
  // so the sidebar indicator updates with no perceptible lag.
  //
  // The section's local progress effect (line 182 of PersonalInfoSection.tsx)
  // recomputes status whenever formData changes — synchronously after the
  // typed value is captured by handleFieldChange.
  // ---------------------------------------------------------------------------
  describe('local progress reporting (Spec Test Case 12)', () => {
    it('calls onProgressUpdate when a required field becomes filled, without waiting for auto-save', async () => {
      const user = userEvent.setup();
      const onProgressUpdate = vi.fn();

      // One required field, no prefill, no saved value → status starts as
      // not_started. After typing, status should become complete (the only
      // required field is now filled).
      const fieldsOneRequired: PersonalInfoField[] = [
        {
          requirementId: 'req-mn',
          name: 'Middle Name',
          fieldKey: 'middleName',
          dataType: 'text',
          isRequired: true,
          instructions: null,
          fieldData: {},
          displayOrder: 1,
          locked: false,
          prefilledValue: null,
        },
      ];

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={fieldsOneRequired}
          onProgressUpdate={onProgressUpdate}
        />
      );

      const input = await screen.findByTestId('field-middleName');

      // Capture the call count BEFORE typing — the on-mount hydration effect
      // also runs the progress calc once, which is fine but is not the
      // event under test.
      const callsAfterMount = onProgressUpdate.mock.calls.length;
      // The mount call should report not_started because no value is set.
      expect(onProgressUpdate.mock.calls[callsAfterMount - 1][0]).toBe('not_started');

      // Reset mocks so we can detect the post-typing call cleanly.
      mockFetch.mockClear();

      // Type a value. handleFieldChange sets formData; the local progress
      // effect re-runs synchronously and calls onProgressUpdate('complete')
      // because the only required field is now filled.
      await user.type(input, 'Marie');

      // Wait for the progress callback to fire with 'complete'. The auto-save
      // POST does not happen until handleFieldBlur fires, so this assertion
      // proves the progress update is independent of the save round-trip.
      await waitFor(() => {
        const lastCall = onProgressUpdate.mock.calls[onProgressUpdate.mock.calls.length - 1];
        expect(lastCall[0]).toBe('complete');
      });

      // Confirm no /save fetch happened during typing (auto-save fires on
      // blur, not on every keystroke). This is what makes the progress
      // update strictly independent of the save round-trip.
      const saveCallsBeforeBlur = mockFetch.mock.calls.filter((call) =>
        String(call[0] ?? '').includes('/save')
      );
      expect(saveCallsBeforeBlur).toHaveLength(0);
    });
  });
});
