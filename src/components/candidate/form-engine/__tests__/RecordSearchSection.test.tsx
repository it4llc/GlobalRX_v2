// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/RecordSearchSection.test.tsx
// Pass 2 tests for Task 8.4 — RecordSearchSection.
//
// Coverage focus:
//   - Renders the heading (translation key candidate.recordSearch.heading)
//   - Empty-state when no aggregated items exist (no entries OR no /fields data)
//   - Reports `complete` status to onProgressUpdate when in the empty state
//   - Posts auto-saves with sectionType: 'record_search' on field blur
//   - Loads address_history.entries from saved-data and uses them to drive
//     /fields fetches per entry country
//   - Does NOT read from address_history.aggregatedFields (plan §11.1)
//   - Reports progress that reflects the computeRecordSearchStatus rules
//
// Per Pass 2 Mocking Rules:
//   - RecordSearchSection (subject) is NOT mocked — Rule M1
//   - AggregatedRequirements is NOT mocked because the tests assert on its
//     rendered DOM (the heading text, the field renderer, the upload UI) —
//     Rule M2
//   - DynamicFieldRenderer is NOT mocked because the tests check that a field
//     is rendered with its label name and that user input triggers the save
//     path — Rule M2
//   - CandidateDocumentUpload renders the real file-input UI; the tests do
//     not deeply assert on its internals but do verify it appears for
//     document requirements — Rule M2
//   - useEntryFieldsLoader is NOT mocked because it owns fieldsByEntry state
//     that drives computeAddressHistoryAggregatedItems — mocking it would
//     break the rendering chain that produces the aggregated DOM
//   - addressHistoryStage4Wiring helpers are NOT mocked — Rule M3 (utility
//     functions called with meaningful args; the real implementations are
//     what we want exercised)
//   - computeRecordSearchStatus is NOT mocked — Rule M3 (and it has its own
//     dedicated unit tests in src/lib/candidate/__tests__/)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { RecordSearchSection } from '../RecordSearchSection';

// Short-circuit useDebounce so save triggers fire synchronously inside tests.
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

// Translation mock — readable strings for the keys the section actually
// renders, so the tests can assert on visible text.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.recordSearch.heading')
        return 'Additional information needed for your records search';
      if (key === 'candidate.recordSearch.intro')
        return 'Based on the countries in your address history, please provide the information below.';
      if (key === 'candidate.recordSearch.noFieldsRequired')
        return 'No additional information is required for the records search.';
      if (key === 'candidate.portal.loading') return 'Loading...';
      if (key === 'candidate.aggregatedRequirements.heading')
        return 'Based on your address history, we need the following additional information:';
      if (key === 'candidate.aggregatedRequirements.additionalInformation')
        return 'Additional Information';
      if (key === 'candidate.aggregatedRequirements.requiredDocuments')
        return 'Required Documents';
      if (key === 'candidate.aggregatedRequirements.documentUploadPending')
        return 'Upload will be available soon';
      return key;
    },
  }),
}));

// Silence the client-side logger.
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// AutoSaveIndicator is a tiny visual element — not the subject of any
// assertion in this file.
vi.mock('../AutoSaveIndicator', () => ({
  AutoSaveIndicator: ({ status }: { status: string }) => (
    <div data-testid="autosave-indicator">{status}</div>
  ),
}));

// Mock the document-upload widget to avoid hitting real upload endpoints in
// the test environment while still rendering a real file-input element so
// document-rendering assertions can check for it. Per Rule M2 this is
// acceptable: the upload's internal behavior is not under test in this file.
vi.mock('../../CandidateDocumentUpload', () => ({
  default: ({
    requirement,
  }: {
    requirement: { id: string; name: string; isRequired: boolean };
  }) => (
    <div data-testid={`candidate-document-upload-${requirement.id}`}>
      <div>{requirement.name}</div>
      <input type="file" data-testid={`file-input-${requirement.id}`} />
    </div>
  ),
}));

// Helper to install a fresh fetch mock that returns canned responses by URL
// substring. Same pattern as AddressHistorySection.test.tsx.
function installFetchMock(responseMap: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const key of Object.keys(responseMap)) {
      if (url.includes(key)) {
        return {
          ok: true,
          status: 200,
          json: async () => responseMap[key],
        } as Response;
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

describe('RecordSearchSection (Task 8.4)', () => {
  const mockToken = 'token-rs-comp';
  const mockServiceIds = ['srv-record-1'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render and loading', () => {
    it('shows loading state initially', () => {
      // Fetch hangs so the component stays in loading state.
      const neverResolves = new Promise<Response>(() => { /* hang */ });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = vi.fn(() => neverResolves);

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders the section heading after data loads', async () => {
      installFetchMock({
        '/saved-data': { sections: {} },
        '/personal-info-fields': { fields: [] },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Additional information needed for your records search',
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('renders the empty-state message when no address-history entries exist', async () => {
      // No entries → no countries → no /fields fetches → aggregatedItems is
      // empty → empty-state branch.
      installFetchMock({
        '/saved-data': { sections: {} },
        '/personal-info-fields': { fields: [] },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('record-search-empty-state'),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'No additional information is required for the records search.',
        ),
      ).toBeInTheDocument();
    });

    it('renders the empty-state message when /fields returns no aggregatable items', async () => {
      // One entry with a country, but /fields returns only an address_block
      // (inline-only, dropped by computeAddressHistoryAggregatedItems) — so
      // aggregatedItems is empty and the empty-state branch fires.
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-AB-1',
              name: 'Residence Address',
              fieldKey: 'residenceAddress',
              type: 'field',
              dataType: 'address_block',
              isRequired: true,
              instructions: null,
              fieldData: { addressConfig: null },
              documentData: null,
              displayOrder: 0,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('record-search-empty-state'),
        ).toBeInTheDocument();
      });
    });

    it('reports `complete` progress when in the empty state', async () => {
      const onProgressUpdate = vi.fn();

      installFetchMock({
        '/saved-data': { sections: {} },
        '/personal-info-fields': { fields: [] },
      });

      render(
        <RecordSearchSection
          token={mockToken}
          serviceIds={mockServiceIds}
          onProgressUpdate={onProgressUpdate}
        />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('record-search-empty-state'),
        ).toBeInTheDocument();
      });

      // The progress callback fires whenever aggregatedItems changes after
      // loading. The empty-state case should report 'complete' (per
      // computeRecordSearchStatus: no required items → complete).
      await waitFor(() => {
        expect(onProgressUpdate).toHaveBeenCalledWith('complete');
      });
    });
  });

  describe('rendering with aggregated items', () => {
    it('renders AggregatedRequirements (heading + field) when /fields returns non-address aggregatable items', async () => {
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            // A text field that will surface in the aggregated area.
            {
              requirementId: 'req-extra-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: 'Enter your local reference',
              fieldData: {},
              documentData: null,
              displayOrder: 2,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        // The AggregatedRequirements heading is real DOM (M2 — not mocked).
        expect(
          screen.getByText(
            'Based on your address history, we need the following additional information:',
          ),
        ).toBeInTheDocument();
      });

      // The field label rendered by the real DynamicFieldRenderer.
      expect(screen.getByText('Local Reference Number')).toBeInTheDocument();
      // The real input also rendered (field-${fieldKey}).
      expect(screen.getByTestId('field-req-extra-1')).toBeInTheDocument();

      // The empty-state message must NOT be visible when items exist.
      expect(
        screen.queryByTestId('record-search-empty-state'),
      ).not.toBeInTheDocument();
    });

    it('renders a document requirement via the upload UI when /fields returns a per_search document', async () => {
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-DOC-1',
              name: 'AFP Form',
              fieldKey: 'afpForm',
              type: 'document',
              dataType: 'document',
              isRequired: true,
              instructions: 'Download and complete the AFP form',
              fieldData: {},
              documentData: {
                scope: 'per_search',
                instructions: 'Download and complete the AFP form',
              },
              displayOrder: 5,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('aggregated-document-req-DOC-1'),
        ).toBeInTheDocument();
      });

      // The document name renders inside the upload widget stub.
      expect(screen.getByText('AFP Form')).toBeInTheDocument();
      // The (mocked) upload widget provides a file input.
      expect(screen.getByTestId('file-input-req-DOC-1')).toBeInTheDocument();
    });

    it('excludes fields whose requirementId is in personal-info-fields (dedup against Personal Info)', async () => {
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
          },
        },
        '/personal-info-fields': {
          fields: [{ requirementId: 'req-PI-1' }],
        },
        '/fields': {
          fields: [
            // This one should be excluded — same requirementId as the PI field.
            {
              requirementId: 'req-PI-1',
              name: 'First Name (excluded)',
              fieldKey: 'firstName',
              type: 'field',
              dataType: 'text',
              isRequired: true,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 1,
            },
            // This one should appear.
            {
              requirementId: 'req-extra-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 2,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByText('Local Reference Number'),
        ).toBeInTheDocument();
      });

      // The PI-matching field MUST NOT appear in the aggregated area.
      expect(
        screen.queryByText('First Name (excluded)'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('field-req-PI-1'),
      ).not.toBeInTheDocument();
    });
  });

  describe('no-backward-compat-read invariant (plan §11.1)', () => {
    it('does NOT use address_history.aggregatedFields as a source for record_search values', async () => {
      // Seed saved-data with a populated aggregatedFields blob on the
      // address_history section AND an empty record_search.fieldValues. The
      // section should NOT read aggregatedFields back as its own state —
      // the user-typed value below must come from record_search only.
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
              aggregatedFields: {
                'req-extra-1': 'legacy-leak-do-not-show',
              },
            },
            record_search: {
              type: 'record_search',
              fieldValues: {},
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-extra-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 2,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByText('Local Reference Number'),
        ).toBeInTheDocument();
      });

      // The rendered input must be empty — record_search.fieldValues was
      // empty and address_history.aggregatedFields must NOT have been used
      // as a fallback.
      const input = screen.getByTestId('field-req-extra-1') as HTMLInputElement;
      expect(input.value).toBe('');
      // Specifically, the leaked legacy value must not appear anywhere.
      expect(
        screen.queryByDisplayValue('legacy-leak-do-not-show'),
      ).not.toBeInTheDocument();
    });

    it('hydrates the input from record_search.fieldValues (its own bucket)', async () => {
      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
            record_search: {
              type: 'record_search',
              fieldValues: {
                'req-extra-1': 'OWN-BUCKET-VALUE',
              },
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-extra-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 2,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        const input = screen.getByTestId('field-req-extra-1') as HTMLInputElement;
        expect(input.value).toBe('OWN-BUCKET-VALUE');
      });
    });
  });

  describe('save behavior', () => {
    it('POSTs to /save with sectionType="record_search" and the current fieldValues on blur', async () => {
      const fetchMock = installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
            record_search: {
              type: 'record_search',
              fieldValues: { 'req-extra-1': 'starting-value' },
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-extra-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 2,
            },
          ],
        },
      });

      render(
        <RecordSearchSection token={mockToken} serviceIds={mockServiceIds} />,
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('field-req-extra-1'),
        ).toBeInTheDocument();
      });

      // Trigger blur — pendingSave -> debouncedPendingSave (identity) ->
      // saveSection.
      const input = screen.getByTestId('field-req-extra-1');
      await act(async () => {
        input.focus();
        input.blur();
      });

      await waitFor(() => {
        const saveCall = fetchMock.mock.calls.find((c) => {
          const url = typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString();
          const method = c[1] && (c[1] as RequestInit).method;
          return url.includes('/save') && method === 'POST';
        });
        expect(saveCall).toBeDefined();
      });

      // Inspect the body of the save call.
      const saveCall = fetchMock.mock.calls.find((c) => {
        const url = typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString();
        const method = c[1] && (c[1] as RequestInit).method;
        return url.includes('/save') && method === 'POST';
      });
      expect(saveCall).toBeDefined();
      const body = JSON.parse((saveCall![1] as RequestInit).body as string);
      expect(body.sectionType).toBe('record_search');
      expect(body.sectionId).toBe('record_search');
      // Saved value is the value we hydrated from record_search.fieldValues.
      expect(body.fieldValues).toEqual({ 'req-extra-1': 'starting-value' });
      // No `entries`, no `aggregatedFields` — the new save shape is
      // fieldValues-only.
      expect(body).not.toHaveProperty('entries');
      expect(body).not.toHaveProperty('aggregatedFields');
    });
  });

  describe('progress reporting with required items', () => {
    it('reports `not_started` when there is a required field and no values', async () => {
      const onProgressUpdate = vi.fn();

      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
            record_search: {
              type: 'record_search',
              fieldValues: {},
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-required-1',
              name: 'Local ID Number',
              fieldKey: 'localId',
              type: 'field',
              dataType: 'text',
              isRequired: true,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 1,
            },
          ],
        },
      });

      render(
        <RecordSearchSection
          token={mockToken}
          serviceIds={mockServiceIds}
          onProgressUpdate={onProgressUpdate}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText('Local ID Number')).toBeInTheDocument();
      });

      // The computed status here goes through the real
      // computeRecordSearchStatus: one required field, no values, nothing
      // typed → `not_started`.
      await waitFor(() => {
        expect(onProgressUpdate).toHaveBeenCalledWith('not_started');
      });
    });

    it('reports `complete` when all required items are satisfied by hydrated fieldValues', async () => {
      const onProgressUpdate = vi.fn();

      installFetchMock({
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                {
                  entryId: 'e-1',
                  countryId: 'country-us',
                  entryOrder: 0,
                  fields: [],
                },
              ],
            },
            record_search: {
              type: 'record_search',
              fieldValues: { 'req-required-1': 'AB12345' },
            },
          },
        },
        '/personal-info-fields': { fields: [] },
        '/fields': {
          fields: [
            {
              requirementId: 'req-required-1',
              name: 'Local ID Number',
              fieldKey: 'localId',
              type: 'field',
              dataType: 'text',
              isRequired: true,
              instructions: null,
              fieldData: {},
              documentData: null,
              displayOrder: 1,
            },
          ],
        },
      });

      render(
        <RecordSearchSection
          token={mockToken}
          serviceIds={mockServiceIds}
          onProgressUpdate={onProgressUpdate}
        />,
      );

      await waitFor(() => {
        const input = screen.getByTestId('field-req-required-1') as HTMLInputElement;
        expect(input.value).toBe('AB12345');
      });

      await waitFor(() => {
        expect(onProgressUpdate).toHaveBeenCalledWith('complete');
      });
    });
  });
});
