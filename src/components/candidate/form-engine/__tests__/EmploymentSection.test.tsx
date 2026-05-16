// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/EmploymentSection.test.tsx
//
// Task 9.2 — the entry-legend translation key for Employment was realigned
// from the legacy `candidate.portal.employmentEntryLabel` to the
// spec-mandated `candidate.a11y.employmentEntryN`. The new key has no
// `{number}` token, so with the identity-translator mock below the rendered
// legend is the bare key string for every entry.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmploymentSection } from '../EmploymentSection';

// Mock useDebounce to return value immediately for testing
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.portal.sections.employmentHistory') return 'Employment History';
      if (key === 'candidate.portal.addEntry') return 'Add Entry';
      if (key === 'candidate.portal.employmentEntryLabel') return 'Employment {number}';
      if (key === 'candidate.portal.selectCountryForEntry') return 'Select country';
      if (key === 'candidate.portal.noFieldsForCountry') return 'No information is required for this country';
      return key.replace('{number}', '1');
    }
  })
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

// Mock child components
vi.mock('./DynamicFieldRenderer', () => ({
  DynamicFieldRenderer: vi.fn(() => null)
}));

vi.mock('./AutoSaveIndicator', () => ({
  AutoSaveIndicator: vi.fn(() => null)
}));

// Set up global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EmploymentSection', () => {
  const mockToken = 'test-token-123';
  const mockServiceIds = ['service-1'];

  // Task 9.2 — every entry's legend is rendered as the bare identity-translated
  // key (the key has no `{number}` placeholder, so the component's
  // `.replace('{number}', ...)` is a no-op). Aliased here so the assertions
  // read naturally.
  const EMPLOYMENT_ENTRY_LEGEND = 'candidate.a11y.employmentEntryN';

  const mockScopeResponse = {
    functionalityType: 'verification-emp',
    serviceId: 'service-1',
    scopeType: 'time_based',
    scopeValue: 5,
    scopeDescription: 'Please provide all employment for the past 5 years'
  };

  const mockCountriesResponse = [
    { id: 'US', name: 'United States' },
    { id: 'UK', name: 'United Kingdom' }
  ];

  const mockSavedDataResponse = {
    sections: {
      employment: {
        entries: []
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should render employment section with time-based scope', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScopeResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountriesResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSavedDataResponse
      });

    render(<EmploymentSection token={mockToken} serviceIds={mockServiceIds} />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Employment History')).toBeInTheDocument();
    });

    // Should show time-based scope description (different from education's count_specific)
    expect(screen.getByText('Please provide all employment for the past 5 years')).toBeInTheDocument();

    // Should show one empty entry with Employment label. Task 9.2 — the
    // legend renders the identity-translated key.
    expect(screen.getByText(EMPLOYMENT_ENTRY_LEGEND)).toBeInTheDocument();
  });

  it('should save employment entries with correct section type', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScopeResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountriesResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSavedDataResponse
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

    render(<EmploymentSection token={mockToken} serviceIds={mockServiceIds} />);

    await waitFor(() => {
      expect(screen.getByText('Employment History')).toBeInTheDocument();
    });

    // Click Add Entry
    const addButton = await screen.findByRole('button', { name: /Add Entry/i });
    await userEvent.click(addButton);

    // Should trigger save with employment section type
    await waitFor(() => {
      const saveCalls = mockFetch.mock.calls.filter(call =>
        call[0] && call[0].includes('/save')
      );
      expect(saveCalls.length).toBeGreaterThan(0);

      if (saveCalls.length > 0 && saveCalls[0][1]) {
        const body = JSON.parse(saveCalls[0][1].body);
        expect(body.sectionType).toBe('employment');
      }
    });
  });

  it('should NOT render the end date field when currently employed is true', async () => {
    // Saved entry where the candidate has already marked currentlyEmployed = true.
    // EmploymentSection detects "currently employed" by exact fieldKey match
    // (CURRENTLY_EMPLOYED_FIELD_KEYS in EmploymentSection.tsx) and hides end date
    // fields whose fieldKey matches END_DATE_FIELD_KEYS. The detection looks up
    // the value by requirementId, so the saved field's requirementId must match
    // the requirement returned from /fields below.
    const savedEntry = {
      entryId: 'entry-1',
      countryId: 'US',
      entryOrder: 0,
      fields: [
        {
          requirementId: 'req-currently-employed',
          value: true
        }
      ]
    };

    const savedDataWithCurrentlyEmployed = {
      sections: {
        employment: {
          entries: [savedEntry]
        }
      }
    };

    // Fields returned for country US: one currentlyEmployed boolean and one
    // endDate. Both fieldKeys are members of the matching sets defined in
    // EmploymentSection.tsx. Field "name" values double as the labels rendered
    // by DynamicFieldRenderer, which is what we assert against below.
    const fieldsResponse = {
      fields: [
        {
          requirementId: 'req-currently-employed',
          name: 'Currently Employed',
          fieldKey: 'currentlyEmployed',
          type: 'field',
          dataType: 'boolean',
          isRequired: false,
          instructions: null,
          fieldData: { collectionTab: '' },
          documentData: null,
          displayOrder: 1
        },
        {
          requirementId: 'req-end-date',
          name: 'End Date',
          fieldKey: 'endDate',
          type: 'field',
          dataType: 'date',
          isRequired: false,
          instructions: null,
          fieldData: { collectionTab: '' },
          documentData: null,
          displayOrder: 2
        }
      ]
    };

    mockFetch
      // 1. scope
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockScopeResponse
      })
      // 2. countries
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountriesResponse
      })
      // 3. saved-data (with currentlyEmployed=true entry)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => savedDataWithCurrentlyEmployed
      })
      // 4. fields for the saved entry's country (US)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => fieldsResponse
      });

    render(<EmploymentSection token={mockToken} serviceIds={mockServiceIds} />);

    await waitFor(() => {
      expect(screen.getByText('Employment History')).toBeInTheDocument();
    });

    // Wait until the fields endpoint has been called and the currently-employed
    // field has rendered for this entry's country.
    await waitFor(() => {
      expect(screen.getByText('Currently Employed')).toBeInTheDocument();
    });

    // The end date field's label must NOT be present in the DOM, because
    // currentlyEmployed === true should cause EmploymentSection to skip rendering
    // any field whose fieldKey matches END_DATE_FIELD_KEYS.
    expect(screen.queryByText('End Date')).not.toBeInTheDocument();
  });
});
