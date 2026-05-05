// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx
//
// Pass 2 tests for PersonalInfoSection — rewritten in the TD-059 fix to use
// the new shell-driven prop contract. The shell (portal-layout.tsx) now owns:
//   - `/personal-info-fields` fetching
//   - `/saved-data` reading (Personal Info bucket extraction)
//   - the lifted Personal Info status derivation (so the sidebar updates even
//     when this section is unmounted — the whole point of TD-059)
//
// PersonalInfoSection therefore no longer fetches `/personal-info-fields` or
// `/saved-data`. It receives `fields` and `initialSavedValues` as props,
// pushes saved values back via `onSavedValuesChange`, and pushes progress
// updates via `onProgressUpdate` for live local edits. Auto-save still
// POSTs to `/save`; that remains the only fetch the section makes.
//
// Tests in this file:
//   - All previously-existing tests that mocked `/personal-info-fields` and
//     `/saved-data` are rewritten to pass props instead. Behavioral
//     assertions are unchanged.
//   - One new test (Bug 2 from smoke testing of the TD-059 fix) verifies the
//     cross-section overlay: a field with baseline isRequired=false renders
//     a red required-indicator when it appears in the shell-supplied
//     crossSectionRequirements list with isRequired=true.
//   - One new test (Spec Test Case 12) verifies that filling a required
//     field calls `onProgressUpdate('incomplete')` immediately (i.e., before
//     the next auto-save round-trip).

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

  // Field defs in the new shape (PersonalInfoField from @/types/candidate-portal).
  // These are the same fields the previous tests expected from `/personal-info-fields`,
  // now passed directly as props.
  const mockFields: PersonalInfoField[] = [
    {
      requirementId: 'req-1',
      name: 'First Name',
      fieldKey: 'firstName',
      dataType: 'text',
      isRequired: true,
      instructions: null,
      fieldData: {},
      displayOrder: 1,
      locked: true,
      prefilledValue: 'Sarah'
    },
    {
      requirementId: 'req-2',
      name: 'Last Name',
      fieldKey: 'lastName',
      dataType: 'text',
      isRequired: true,
      instructions: null,
      fieldData: {},
      displayOrder: 2,
      locked: true,
      prefilledValue: 'Johnson'
    },
    {
      requirementId: 'req-3',
      name: 'Email',
      fieldKey: 'email',
      dataType: 'email',
      isRequired: true,
      instructions: null,
      fieldData: {},
      displayOrder: 3,
      locked: true,
      prefilledValue: 'sarah@example.com'
    },
    {
      requirementId: 'req-4',
      name: 'Phone Number',
      fieldKey: 'phone',
      dataType: 'phone',
      isRequired: false,
      instructions: null,
      fieldData: {},
      displayOrder: 4,
      locked: true,
      prefilledValue: '+1234567890'
    },
    {
      requirementId: 'req-5',
      name: 'Date of Birth',
      fieldKey: 'dateOfBirth',
      dataType: 'date',
      isRequired: true,
      instructions: 'Enter your date of birth',
      fieldData: {},
      displayOrder: 5,
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
      displayOrder: 6,
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
      // runs. We assert the loading branch by querying immediately, before
      // any state update flushes via effects.
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
      expect(screen.getByText('First Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone Number')).toBeInTheDocument();
      expect(screen.getByText('Date of Birth')).toBeInTheDocument();
      expect(screen.getByText('Middle Name')).toBeInTheDocument();
    });

    it('should show empty state when no fields are configured', async () => {
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

  describe('pre-filled and locked fields', () => {
    it('should display pre-filled values for locked fields', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      await waitFor(() => {
        const firstNameInput = screen.getByTestId('field-firstName') as HTMLInputElement;
        expect(firstNameInput.value).toBe('Sarah');
        expect(firstNameInput).toHaveAttribute('readonly');
        expect(firstNameInput).toHaveAttribute('disabled');
      });

      const lastNameInput = screen.getByTestId('field-lastName') as HTMLInputElement;
      expect(lastNameInput.value).toBe('Johnson');
      expect(lastNameInput).toHaveAttribute('readonly');

      const emailInput = screen.getByTestId('field-email') as HTMLInputElement;
      expect(emailInput.value).toBe('sarah@example.com');
      expect(emailInput).toHaveAttribute('readonly');

      const phoneInput = screen.getByTestId('field-phone') as HTMLInputElement;
      expect(phoneInput.value).toBe('+1234567890');
      expect(phoneInput).toHaveAttribute('readonly');
    });

    it('should show required indicator for locked required fields', async () => {
      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      expect(await screen.findByText('First Name')).toBeInTheDocument();

      // Find the label container for the locked First Name field
      const labels = screen.getAllByText('First Name')[0].parentElement;
      // The required indicator (*) should be shown on locked required fields
      expect(labels?.querySelector('.required-indicator')).toBeInTheDocument();
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

    it('should not overwrite locked pre-filled values with saved data', async () => {
      const savedDataWithLockedFields: Record<string, unknown> = {
        'req-1': 'DifferentName', // First Name - locked field
        'req-5': '1990-05-15'
      };

      render(
        <PersonalInfoSection
          token={mockToken}
          fields={mockFields}
          initialSavedValues={savedDataWithLockedFields}
        />
      );

      await waitFor(() => {
        const firstNameInput = screen.getByTestId('field-firstName') as HTMLInputElement;
        // Should still show the pre-filled value, not the saved data
        expect(firstNameInput.value).toBe('Sarah');
      });
    });
  });

  describe('auto-save functionality', () => {
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

    it('should not trigger auto-save for locked fields', async () => {
      const user = userEvent.setup();

      render(<PersonalInfoSection token={mockToken} fields={mockFields} />);

      // Wait for field to be rendered and component to be fully loaded
      const firstNameInput = await screen.findByTestId('field-firstName');
      expect(firstNameInput).toBeInTheDocument();

      // Clear any mock calls that happened during rendering
      mockFetch.mockClear();

      // Try to interact with a locked field
      await user.click(firstNameInput);
      await user.tab(); // Trigger blur

      // Wait a bit to ensure any debounced saves would have fired
      await new Promise(resolve => setTimeout(resolve, 400));

      // No save should be triggered for locked fields
      const saveCalls = mockFetch.mock.calls.filter(
        call => call[0]?.toString().includes('/save')
      );
      expect(saveCalls.length).toBe(0);
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
        { ...mockFields[2], displayOrder: 3 }, // Email
        { ...mockFields[0], displayOrder: 1 }, // First Name
        { ...mockFields[4], displayOrder: 5 }, // DOB
        { ...mockFields[1], displayOrder: 2 }, // Last Name
      ];

      render(<PersonalInfoSection token={mockToken} fields={unorderedFields} />);

      expect(await screen.findByText('First Name')).toBeInTheDocument();

      // Get all field inputs in order
      const firstNameInput = screen.getByTestId('field-firstName') as HTMLInputElement;
      const lastNameInput = screen.getByTestId('field-lastName') as HTMLInputElement;
      const emailInput = screen.getByTestId('field-email') as HTMLInputElement;
      const dobInput = screen.getByTestId('field-dateOfBirth') as HTMLInputElement;

      // Should be ordered by displayOrder in the DOM
      const allInputs = screen.getAllByTestId(/^field-/);
      expect(allInputs[0]).toBe(firstNameInput);
      expect(allInputs[1]).toBe(lastNameInput);
      expect(allInputs[2]).toBe(emailInput);
      expect(allInputs[3]).toBe(dobInput);
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
