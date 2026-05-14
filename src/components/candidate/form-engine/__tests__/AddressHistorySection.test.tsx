// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/AddressHistorySection.test.tsx
// Pass 2 tests for Phase 6 Stage 3: AddressHistorySection component
//
// Task 8.4 updates: the AggregatedRequirements block was split out of
// AddressHistorySection into its own RecordSearchSection. AddressHistory is now
// entries-only. Tests in this file have been updated to assert the new
// behavior: no AggregatedRequirements is rendered here, the save body no
// longer carries aggregatedFields, and the section never fetches
// /personal-info-fields.
//
// Coverage focus (post-Task-8.4):
//   - deriveMaxEntries behavior surfaces through the RepeatableEntryManager's
//     Add button visibility
//   - minimum-one-entry rule (remove control hidden on the only entry)
//   - inline rendering of address_block and per_entry document fields
//   - save body shape includes sectionType: 'address_history', entries with
//     entryOrder, and NO aggregatedFields key (Task 8.4)
//   - AggregatedRequirements is NOT rendered by AddressHistorySection
//     (Task 8.4 split)
//   - personal-info-fields endpoint is NOT fetched by AddressHistorySection
//     (Task 8.4 — dedup source moved to RecordSearchSection)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AddressHistorySection } from '../AddressHistorySection';

// Stage-2 EducationSection.test.tsx pattern: short-circuit useDebounce so save
// triggers fire synchronously inside the test.
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value
}));

// Translation mock with readable strings for the labels we assert on.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.portal.sections.addressHistory') return 'Address History';
      if (key === 'candidate.portal.loading') return 'Loading...';
      if (key === 'candidate.portal.addEntry') return 'Add Entry';
      if (key === 'candidate.portal.removeEntry') return 'Remove';
      if (key === 'candidate.portal.entryRemoved') return 'Entry removed';
      if (key === 'candidate.addressHistory.entryLabel') return 'Address {number}';
      if (key === 'candidate.addressHistory.fromDate') return 'From';
      if (key === 'candidate.addressHistory.toDate') return 'To';
      if (key === 'candidate.addressHistory.currentAddress') return 'Current address';
      if (key === 'candidate.addressBlock.selectState') return 'Select state/province';
      if (key === 'candidate.addressBlock.selectCounty') return 'Select county';
      if (key === 'candidate.aggregatedRequirements.heading')
        return 'Based on your address history, we need the following additional information:';
      if (key === 'candidate.aggregatedRequirements.additionalInformation')
        return 'Additional Information';
      if (key === 'candidate.aggregatedRequirements.requiredDocuments')
        return 'Required Documents';
      if (key === 'candidate.aggregatedRequirements.documentUploadPending')
        return 'Upload will be available soon';
      if (key === 'candidate.portal.selectCountryForEntry') return 'Select country';
      if (key === 'candidate.portal.countriesLoadError') return 'Failed to load countries';
      return key.replace('{number}', '1');
    }
  })
}));

// Client logger — silence error paths.
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }
}));

// AutoSaveIndicator is a tiny visual element — not under test here.
vi.mock('../AutoSaveIndicator', () => ({
  AutoSaveIndicator: ({ status }: { status: string }) => (
    <div data-testid="autosave-indicator">{status}</div>
  )
}));

// Mock crypto.randomUUID to give us deterministic entry IDs across renders.
let uuidCounter = 0;
const stableUuid = () => {
  uuidCounter += 1;
  return `entry-uuid-${uuidCounter}`;
};

// Helper to install a fresh fetch mock for each test. This returns a function
// that lets the test queue ordered responses by URL pattern.
function installFetchMock(responseMap: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    // Find the first key in responseMap that matches a substring of the URL
    // AND, if a save POST, make sure init.method === 'POST'.
    for (const key of Object.keys(responseMap)) {
      if (url.includes(key)) {
        return {
          ok: true,
          status: 200,
          json: async () => responseMap[key]
        } as Response;
      }
    }
    // Default: empty success response.
    return {
      ok: true,
      status: 200,
      json: async () => ({})
    } as Response;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchMock;
  return fetchMock;
}

describe('AddressHistorySection', () => {
  const mockToken = 'token-abc';
  const mockServiceIds = ['srv-record-1'];

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    vi.stubGlobal('crypto', { randomUUID: stableUuid });
  });

  describe('initial render and loading', () => {
    it('shows the loading indicator while data is fetched', async () => {
      // Use a fetch that never resolves on the first call so the loading state stays.
      const neverResolves = new Promise<Response>(() => { /* hang */ });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = vi.fn(() => neverResolves);

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders the section heading and one initial empty entry on first visit', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'Please provide all addresses where you have lived in the past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address History')).toBeInTheDocument();
      });

      // One default entry is created when no saved data exists.
      // The label "Address {number}" gets replaced to "Address 1".
      expect(screen.getByText('Address 1')).toBeInTheDocument();

      // The scope description is rendered (via ScopeDisplay).
      expect(
        screen.getByText('Please provide all addresses where you have lived in the past 7 years')
      ).toBeInTheDocument();
    });
  });

  describe('minimum-one-entry rule (DoD #13, Business Rule #3)', () => {
    it('hides the remove button on the only entry', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'Please provide all addresses where you have lived in the past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // The remove button (label "Remove" from our translation mock) must not exist
      // when there is only one entry.
      expect(screen.queryByRole('button', { name: /^Remove$/i })).not.toBeInTheDocument();
    });
  });

  describe('deriveMaxEntries — Add button visibility (Business Rule via spec)', () => {
    it('shows Add button when scope is time_based (no maximum)', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // Add Entry must be visible because time_based has no cap.
      expect(screen.getByRole('button', { name: /Add Entry/i })).toBeInTheDocument();
    });

    it('hides the Add button when scope is count_exact and the cap is reached (current-address)', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'count_exact',
          scopeValue: 1,
          scopeDescription: 'Please provide your current address'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // The default first entry already counts as 1, and maxEntries=1, so the
      // Add Entry button must be hidden.
      expect(screen.queryByRole('button', { name: /Add Entry/i })).not.toBeInTheDocument();
    });

    it('hides the Add button when scope is count_specific and the cap equals the entry count', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'count_specific',
          scopeValue: 2,
          scopeDescription: 'Please provide your last 2 addresses'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                { entryId: 'e-1', countryId: 'country-us', entryOrder: 0, fields: [] },
                { entryId: 'e-2', countryId: 'country-us', entryOrder: 1, fields: [] }
              ],
              aggregatedFields: {}
            }
          }
        },
        '/fields': { fields: [] }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      // Two entries from saved data.
      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
        expect(screen.getByText('Address 2')).toBeInTheDocument();
      });

      // Cap is 2 and we have 2 entries — Add must be hidden.
      expect(screen.queryByRole('button', { name: /Add Entry/i })).not.toBeInTheDocument();
    });

    it('shows the Add button when scope is count_specific and entries are below the cap', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'count_specific',
          scopeValue: 3,
          scopeDescription: 'Please provide your last 3 addresses'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // 1 entry, cap is 3 — Add stays visible.
      expect(screen.getByRole('button', { name: /Add Entry/i })).toBeInTheDocument();
    });
  });

  // Task 8.4 — AggregatedRequirements moved out of AddressHistorySection.
  // The "aggregated requirements" assertions on this section now verify the
  // OPPOSITE behavior: the aggregated heading/area MUST NOT be rendered here
  // even when /fields returns aggregatable items. The dedup-and-render path
  // lives on RecordSearchSection now and is tested there.
  describe('Task 8.4 — AggregatedRequirements no longer rendered by AddressHistorySection', () => {
    it('does NOT render an aggregated-requirements heading when /fields returns non-address fields', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                { entryId: 'e-1', countryId: 'country-us', entryOrder: 0, fields: [] }
              ],
            }
          }
        },
        '/fields': {
          fields: [
            // Address block — must render inline (still allowed on this section).
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
              displayOrder: 0
            },
            // Local Reference Number — would have appeared in the aggregated area
            // pre-Task-8.4. After the split it must NOT appear on Address History.
            {
              requirementId: 'req-EXTRA-1',
              name: 'Local Reference Number',
              fieldKey: 'localRef',
              type: 'field',
              dataType: 'text',
              isRequired: false,
              instructions: 'Enter your local reference',
              fieldData: {},
              documentData: null,
              displayOrder: 2
            }
          ]
        }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // Wait for the inline address block (real DOM, not a stub) to render so
      // we know the /fields fetch completed and the section has settled.
      await waitFor(() => {
        expect(screen.getByTestId('address-req-AB-1-street1')).toBeInTheDocument();
      });

      // The aggregated heading from AggregatedRequirements must NOT be on the
      // page. Task 8.4 moved that block to RecordSearchSection.
      expect(
        screen.queryByText('Based on your address history, we need the following additional information:')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Additional Information')).not.toBeInTheDocument();
      expect(screen.queryByText('Required Documents')).not.toBeInTheDocument();

      // The aggregated-only field must not appear either.
      expect(screen.queryByText('Local Reference Number')).not.toBeInTheDocument();
    });

    it('does NOT render any aggregated document upload UI when /fields returns a document requirement', async () => {
      installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                { entryId: 'e-1', countryId: 'country-us', entryOrder: 0, fields: [] }
              ],
            }
          }
        },
        '/fields': {
          fields: [
            // Aggregated (per_search) document — would have rendered in the
            // AggregatedRequirements block pre-Task-8.4. After the split it
            // must not appear on Address History.
            {
              requirementId: 'req-DOC-1',
              name: 'AFP Form',
              fieldKey: 'afpForm',
              type: 'document',
              dataType: 'document',
              isRequired: true,
              instructions: 'Download and complete the AFP form',
              fieldData: {},
              documentData: { scope: 'per_search', instructions: 'Download and complete the AFP form' },
              displayOrder: 5
            }
          ]
        }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // Allow enough cycles for any /fields settle. The aggregated document
      // testid would only exist via AggregatedRequirements, which is no
      // longer instantiated here.
      await waitFor(() => {
        // The section finished rendering (heading present).
        expect(screen.getByText('Address History')).toBeInTheDocument();
      });

      // The aggregated upload UI (via CandidateDocumentUpload in the
      // AggregatedRequirements block) must NOT exist on this section.
      expect(screen.queryByText('AFP Form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('aggregated-document-req-DOC-1')).not.toBeInTheDocument();
    });

    it('does NOT fetch /personal-info-fields (dedup source moved to RecordSearchSection)', async () => {
      const fetchMock = installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'past 7 years'
        },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': { sections: {} }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByText('Address 1')).toBeInTheDocument();
      });

      // Task 8.4 §4.4 step 5: AddressHistorySection no longer needs the
      // personal-info-fields dedup source. The new RecordSearchSection owns
      // it. This section MUST NOT call that endpoint on mount.
      const personalInfoCall = fetchMock.mock.calls.find((c) => {
        const url = typeof c[0] === 'string' ? c[0] : (c[0] as URL).toString();
        return url.includes('/personal-info-fields');
      });
      expect(personalInfoCall).toBeUndefined();
    });
  });

  describe('save body shape — sectionType, entries (Task 8.4: NO aggregatedFields)', () => {
    it('POSTs to /save with sectionType="address_history" and entries-only body (no aggregatedFields key)', async () => {
      const fetchMock = installFetchMock({
        '/scope': {
          functionalityType: 'record',
          serviceId: 'srv-record-1',
          scopeType: 'time_based',
          scopeValue: 7,
          scopeDescription: 'past 7 years'
        },
        '/personal-info-fields': { fields: [] },
        '/countries': [{ id: 'country-us', name: 'United States' }],
        '/saved-data': {
          sections: {
            address_history: {
              entries: [
                { entryId: 'e-1', countryId: 'country-us', entryOrder: 0, fields: [] }
              ],
            }
          }
        },
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
              displayOrder: 0
            }
          ]
        }
      });

      render(<AddressHistorySection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        expect(screen.getByTestId('address-req-AB-1-street1')).toBeInTheDocument();
      });

      // Simulate the candidate typing into the street1 piece and blurring.
      const street1 = screen.getByTestId('address-req-AB-1-street1');
      await act(async () => {
        // We trigger blur to fire pendingSave -> debouncedPendingSave -> saveEntries.
        street1.focus();
        street1.blur();
      });

      // Wait for the save fetch.
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
      expect(body.sectionType).toBe('address_history');
      expect(body.sectionId).toBe('address_history');
      expect(Array.isArray(body.entries)).toBe(true);
      // Task 8.4: AddressHistorySection no longer sends aggregatedFields. The
      // key must NOT be present on the save body — record-search values are
      // posted separately via sectionType: 'record_search'.
      expect(body).not.toHaveProperty('aggregatedFields');
      // Entry 0 should still carry entryOrder=0 (index reflects position).
      expect(body.entries[0].entryOrder).toBe(0);
    });
  });
});
