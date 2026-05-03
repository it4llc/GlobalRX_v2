// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/EmploymentSection.test.tsx

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

    // Should show one empty entry with Employment label
    expect(screen.getByText('Employment 1')).toBeInTheDocument();
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
    const addButton = screen.getByRole('button', { name: /Add Entry/i });
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
});