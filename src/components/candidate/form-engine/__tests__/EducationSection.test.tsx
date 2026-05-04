// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/EducationSection.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EducationSection } from '../EducationSection';

// Mock useDebounce to return value immediately for testing
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value
}));

// Mock TranslationContext
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'candidate.portal.sections.educationHistory') return 'Education History';
      if (key === 'candidate.portal.addEntry') return 'Add Entry';
      if (key === 'candidate.portal.educationEntryLabel') return 'Education {number}';
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
  DynamicFieldRenderer: vi.fn(({ name, value, onChange, onBlur }: any) => (
    <div data-testid={`field-${name}`}>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={name}
      />
    </div>
  ))
}));

vi.mock('./AutoSaveIndicator', () => ({
  AutoSaveIndicator: vi.fn(({ status }: any) => (
    <div data-testid="autosave-indicator">{status}</div>
  ))
}));

// Set up global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('EducationSection', () => {
  const mockToken = 'test-token-123';
  const mockServiceIds = ['service-1', 'service-2'];

  const mockScopeResponse = {
    functionalityType: 'verification-edu',
    serviceId: 'service-1',
    scopeType: 'count_specific',
    scopeValue: 2,
    scopeDescription: 'Please provide your most recent 2 education entries'
  };

  const mockCountriesResponse = [
    { id: 'US', name: 'United States' },
    { id: 'UK', name: 'United Kingdom' }
  ];

  const mockSavedDataResponse = {
    sections: {
      education: {
        entries: []
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  it('should render with scope display and empty entry on first visit', async () => {
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

    render(<EducationSection token={mockToken} serviceIds={mockServiceIds} />);

    // Should show loading initially
    expect(screen.getByText('candidate.portal.loading')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Education History')).toBeInTheDocument();
    });

    // Should show scope description
    expect(screen.getByText('Please provide your most recent 2 education entries')).toBeInTheDocument();

    // Should show one empty entry with country selector
    expect(screen.getByText('Education 1')).toBeInTheDocument();

    // Check for country selector label (not the placeholder text)
    const labels = screen.getAllByText('Select country');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('should handle adding a new entry and trigger save', async () => {
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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    render(<EducationSection token={mockToken} serviceIds={mockServiceIds} />);

    // Wait for data to fully load
    await waitFor(() => {
      expect(screen.getByText('Education 1')).toBeInTheDocument();
    });

    // Click Add Entry
    const addButton = screen.getByRole('button', { name: /Add Entry/i });
    await userEvent.click(addButton);

    // Should now have two entries
    expect(screen.getByText('Education 1')).toBeInTheDocument();
    expect(screen.getByText('Education 2')).toBeInTheDocument();

    // Should trigger save
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/candidate/application/${mockToken}/save`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  it('should load saved entries on return visit', async () => {
    const savedDataWithEntries = {
      sections: {
        education: {
          entries: [
            {
              entryId: 'entry-1',
              countryId: 'US',
              entryOrder: 0,
              fields: [
                { requirementId: 'req-1', value: 'Harvard University' }
              ]
            }
          ]
        }
      }
    };

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
        json: async () => savedDataWithEntries
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          fields: []
        })
      });

    render(<EducationSection token={mockToken} serviceIds={mockServiceIds} />);

    // Wait for saved entry to load
    await waitFor(() => {
      expect(screen.getByText('Education 1')).toBeInTheDocument();
    });

    // Should have loaded with US selected
    await waitFor(() => {
      const selectValue = screen.getByText('United States');
      expect(selectValue).toBeInTheDocument();
    });
  });

  it('should handle removing an entry', async () => {
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

    render(<EducationSection token={mockToken} serviceIds={mockServiceIds} />);

    await waitFor(() => {
      expect(screen.getByText('Education History')).toBeInTheDocument();
    });

    // Add a second entry first
    const addButton = screen.getByRole('button', { name: /Add Entry/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Education 2')).toBeInTheDocument();
    });

    // Remove the first entry
    const removeButtons = screen.getAllByRole('button', { name: /candidate.portal.removeEntry/i });
    await userEvent.click(removeButtons[0]);

    // Should trigger save after removing
    await waitFor(() => {
      const saveCalls = mockFetch.mock.calls.filter(call =>
        call[0].includes('/save')
      );
      // Should have called save at least once after the remove
      expect(saveCalls.length).toBeGreaterThan(0);
    });

    // And now only one entry should remain
    await waitFor(() => {
      const allEducationLabels = screen.getAllByText(/Education \d/);
      expect(allEducationLabels.length).toBe(1);
    });
  });
});