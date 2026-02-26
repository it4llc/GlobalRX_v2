/**
 * Tests for useLocationForm hook
 * This hook encapsulates all business logic for location form management
 *
 * BUSINESS LOGIC DOCUMENTATION:
 *
 * 1. LOCATION TYPE HIERARCHY:
 *    - Country: Top-level location, no parent required
 *    - Subregion1: State/Province, requires country parent
 *    - Subregion2: County/District, requires subregion1 parent
 *    - Subregion3: City/Town, requires subregion2 parent
 *
 * 2. FORM BEHAVIOR RULES:
 *    - When location type changes, all child selections must reset
 *    - Cascading dropdowns: child options load based on parent selection
 *    - Auto-fill: When adding subregions, parent location data auto-fills
 *
 * 3. DATA SUBMISSION RULES:
 *    - Countries require: name, twoLetter, threeLetter, numeric codes
 *    - Subregions use placeholder codes ("XX", "XXX") - API generates real codes
 *    - Each subregion must include its parent's ID
 *    - Field mapping differs for subregions (use 'name' field vs 'countryName')
 *
 * 4. ERROR HANDLING:
 *    - Form stays active on API errors (no navigation away)
 *    - Show contextual messages when no subregions exist
 *    - Offer quick navigation to add missing parent levels
 *    - Clear error messages with specific failure reasons
 *
 * 5. CSV IMPORT:
 *    - Separate workflow from manual entry
 *    - Reports success count and skipped duplicates
 *    - Triggers parent component refresh on completion
 *
 * 6. STATE MANAGEMENT:
 *    - Loading states for all async operations (fetching, submitting)
 *    - Success feedback with 2-second auto-reset
 *    - Form reset after successful submission
 *    - Preserve user input on errors
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useLocationForm } from '@/hooks/useLocationForm';

// Mock dependencies
const mockFetchWithAuth = vi.fn();
const mockOnLocationAdded = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useLocationForm', () => {
  const mockCountries = [
    { id: 'ca', name: 'Canada', code2: 'CA', code3: 'CAN', numeric: '124' },
    { id: 'us', name: 'United States', code2: 'US', code3: 'USA', numeric: '840' },
  ];

  const mockSubregions1 = [
    { id: 'on', name: 'Ontario', subregion1: 'Ontario', parentId: 'ca' },
    { id: 'bc', name: 'British Columbia', subregion1: 'British Columbia', parentId: 'ca' },
  ];

  const mockSubregions2 = [
    { id: 'tor', name: 'Toronto', subregion2: 'Toronto', parentId: 'on' },
    { id: 'ott', name: 'Ottawa', subregion2: 'Ottawa', parentId: 'on' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization and Loading', () => {
    it('should load countries on mount', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountries,
      });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/locations?type=countries');
      });

      expect(result.current.countries).toEqual(mockCountries);
      expect(result.current.isLoadingOptions).toBe(false);
    });

    it('should handle error when loading countries fails', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await waitFor(() => {
        expect(result.current.formError).toBe('Failed to load countries. Please try refreshing the page.');
      });
    });
  });

  describe('Location Type Selection', () => {
    it('should default to country type', () => {
      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));
      expect(result.current.locationType).toBe('country');
    });

    it('should reset child selections when changing to country type', () => {
      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Set some selections
      act(() => {
        result.current.setSelectedCountry(mockCountries[0]);
        result.current.setSelectedSubregion1(mockSubregions1[0]);
      });

      // Change to country type
      act(() => {
        result.current.handleLocationTypeChange({ target: { value: 'country' } });
      });

      expect(result.current.selectedCountry).toBeNull();
      expect(result.current.selectedSubregion1).toBeNull();
      expect(result.current.selectedSubregion2).toBeNull();
    });

    it('should only reset appropriate child selections when changing type', () => {
      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Set selections
      act(() => {
        result.current.setSelectedCountry(mockCountries[0]);
        result.current.setSelectedSubregion1(mockSubregions1[0]);
        result.current.setSelectedSubregion2(mockSubregions2[0]);
      });

      // Change to subregion1
      act(() => {
        result.current.handleLocationTypeChange({ target: { value: 'subregion1' } });
      });

      expect(result.current.selectedCountry).toBeTruthy(); // Should remain
      expect(result.current.selectedSubregion1).toBeNull(); // Should reset
      expect(result.current.selectedSubregion2).toBeNull(); // Should reset
    });
  });

  describe('Cascading Dropdown Loading', () => {
    it('should load subregions1 when country is selected and type requires it', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions1 });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for initial countries load
      await waitFor(() => expect(result.current.countries).toEqual(mockCountries));

      // Set location type to subregion1
      act(() => {
        result.current.setLocationType('subregion1');
      });

      // Select a country
      act(() => {
        result.current.setSelectedCountry(mockCountries[0]);
      });

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/locations?type=subregions1&parentId=ca');
      });

      expect(result.current.subregions1).toEqual(mockSubregions1);
    });

    it('should load subregions2 when subregion1 is selected and type requires it', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions2 });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Set location type to subregion2
      act(() => {
        result.current.setLocationType('subregion2');
      });

      // Select a subregion1
      act(() => {
        result.current.setSelectedSubregion1(mockSubregions1[0]);
      });

      await waitFor(() => {
        expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/locations?type=subregions2&parentId=on');
      });

      expect(result.current.subregions2).toEqual(mockSubregions2);
    });

    it('should filter out invalid subregions from API response', async () => {
      const mixedData = [
        ...mockSubregions1,
        { id: 'invalid', name: 'Invalid', parentId: 'wrong-parent' },
      ];

      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => mixedData });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      act(() => {
        result.current.setLocationType('subregion1');
        result.current.setSelectedCountry(mockCountries[0]);
      });

      await waitFor(() => {
        expect(result.current.subregions1).toHaveLength(2); // Only valid ones
      });
    });
  });

  describe('Form Auto-fill Behavior', () => {
    it('should auto-fill country fields when selecting country for subregion', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountries,
      });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      act(() => {
        result.current.setLocationType('subregion1');
      });

      act(() => {
        // First set subregion1 value
        result.current.setFormData(prev => ({ ...prev, subregion1: 'Test' }));
        // Then select country
        result.current.handleCountryChange({ target: { value: 'ca' } });
      });

      expect(result.current.formData.countryName).toBe('Canada');
      expect(result.current.formData.twoLetter).toBe('CA');
      expect(result.current.formData.threeLetter).toBe('CAN');
      expect(result.current.formData.numeric).toBe('124');
      // Subregion1 should be preserved
      expect(result.current.formData.subregion1).toBe('Test');
    });

    it('should auto-fill subregion1 when selected for subregion2/3', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCountries,
      });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      // Manually set subregions1 to simulate loaded data
      act(() => {
        result.current.setLocationType('subregion2');
        // We need to set the subregions1 manually since we're not fetching them
        result.current.setSubregions1(mockSubregions1);
      });

      act(() => {
        result.current.handleSubregion1Change({ target: { value: 'on' } });
      });

      expect(result.current.formData.subregion1).toBe('Ontario');
    });
  });

  describe('Form Submission - Country', () => {
    it('should submit country with all required fields', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-country' }) });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Fill form data
      act(() => {
        result.current.setFormData({
          countryName: 'Mexico',
          twoLetter: 'MX',
          threeLetter: 'MEX',
          numeric: '484',
          subregion1: '',
          subregion2: '',
          subregion3: '',
        });
      });

      // Submit form
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(mockFetchWithAuth).toHaveBeenCalledWith('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName: 'Mexico',
          twoLetter: 'MX',
          threeLetter: 'MEX',
          numeric: '484',
          subregion1: null,
          subregion2: null,
          subregion3: null,
          parentId: null,
          name: 'Mexico',
          disabled: false,
        }),
      });

      expect(mockOnLocationAdded).toHaveBeenCalled();
      expect(result.current.isSuccess).toBe(true);
    });

    it('should reset form after successful submission', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new' }) });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      act(() => {
        result.current.setFormData({
          countryName: 'Test',
          twoLetter: 'TS',
          threeLetter: 'TST',
          numeric: '999',
          subregion1: '',
          subregion2: '',
          subregion3: '',
        });
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.formData.countryName).toBe('');
      expect(result.current.formData.twoLetter).toBe('');
      expect(result.current.selectedCountry).toBeNull();
    });
  });

  describe('Form Submission - Subregions', () => {
    it('should submit subregion1 with placeholder codes and parent ID', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries }) // Initial countries load
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions1 }) // Subregions1 load when country selected
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-sub1' }) }); // Form submission

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      act(() => {
        result.current.setLocationType('subregion1');
      });

      // Select country (this will trigger subregions1 load)
      act(() => {
        result.current.handleCountryChange({ target: { value: 'ca' } });
      });

      // Wait for subregions to load
      await waitFor(() => {
        expect(result.current.subregions1).toEqual(mockSubregions1);
      });

      // Now set the subregion1 field
      act(() => {
        result.current.setFormData(prev => ({
          ...prev,
          subregion1: 'Quebec'
        }));
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      // Check for errors
      expect(result.current.formError).toBeNull();
      expect(result.current.isSubmitting).toBe(false);

      // Check that we have 3 calls (countries load + subregions load + submit)
      expect(mockFetchWithAuth).toHaveBeenCalledTimes(3);

      const submittedData = JSON.parse(mockFetchWithAuth.mock.calls[2][1].body);

      expect(submittedData.name).toBe('Quebec');
      expect(submittedData.twoLetter).toBe('XX'); // Placeholder
      expect(submittedData.threeLetter).toBe('XXX'); // Placeholder
      expect(submittedData.parentId).toBe('ca');
      expect(submittedData.subregion1).toBe('Quebec');
    });

    it('should submit subregion2 with correct parent hierarchy', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries }) // Countries load
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions1 }) // Subregions1 load
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions2 }) // Subregions2 load
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-sub2' }) }); // Submission

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      act(() => {
        result.current.setLocationType('subregion2');
      });

      // Select country (triggers subregions1 load)
      act(() => {
        result.current.handleCountryChange({ target: { value: 'ca' } });
      });

      await waitFor(() => {
        expect(result.current.subregions1).toEqual(mockSubregions1);
      });

      // Select subregion1 (triggers subregions2 load)
      act(() => {
        result.current.handleSubregion1Change({ target: { value: 'on' } });
      });

      await waitFor(() => {
        expect(result.current.subregions2).toEqual(mockSubregions2);
      });

      act(() => {
        result.current.setFormData(prev => ({ ...prev, subregion2: 'York' }));
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      const submittedData = JSON.parse(mockFetchWithAuth.mock.calls[3][1].body);

      expect(submittedData.countryName).toBe('York');
      expect(submittedData.parentId).toBe('on');
      expect(submittedData.subregion1).toBe('Ontario');
      expect(submittedData.subregion2).toBe('York');
    });

    it('should submit subregion3 with full hierarchy', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries }) // Countries load
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions1 }) // Subregions1 load
        .mockResolvedValueOnce({ ok: true, json: async () => mockSubregions2 }) // Subregions2 load
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new-sub3' }) }); // Submission

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      act(() => {
        result.current.setLocationType('subregion3');
      });

      // Select country (triggers subregions1 load)
      act(() => {
        result.current.handleCountryChange({ target: { value: 'ca' } });
      });

      await waitFor(() => {
        expect(result.current.subregions1).toEqual(mockSubregions1);
      });

      // Select subregion1 (triggers subregions2 load)
      act(() => {
        result.current.handleSubregion1Change({ target: { value: 'on' } });
      });

      await waitFor(() => {
        expect(result.current.subregions2).toEqual(mockSubregions2);
      });

      // Select subregion2
      act(() => {
        result.current.handleSubregion2Change({ target: { value: 'tor' } });
      });

      act(() => {
        result.current.setFormData(prev => ({ ...prev, subregion3: 'Downtown' }));
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      const submittedData = JSON.parse(mockFetchWithAuth.mock.calls[3][1].body);

      expect(submittedData.parentId).toBe('tor');
      expect(submittedData.subregion1).toBe('Ontario');
      expect(submittedData.subregion2).toBe('Toronto');
      expect(submittedData.subregion3).toBe('Downtown');
    });
  });

  describe('Error Handling', () => {
    it('should display API error message and stay in form', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Duplicate location name' }),
        });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      // Set form data for a country submission (no additional API calls needed)
      act(() => {
        result.current.setFormData({
          countryName: 'Test Country',
          twoLetter: 'TC',
          threeLetter: 'TST',
          numeric: '999',
          subregion1: '',
          subregion2: '',
          subregion3: '',
        });
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.formError).toBe('Duplicate location name');
      expect(result.current.isSubmitting).toBe(false);
    });

    it('should handle non-JSON error responses', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
          json: async () => { throw new Error('Not JSON'); },
        });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.formError).toBe('Failed to add location: Bad Request');
    });

    it('should not show error for session expired', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockRejectedValueOnce(new Error('Session expired'));

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.formError).toBeNull();
    });
  });

  describe('CSV Import', () => {
    it('should handle CSV file selection', () => {
      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      const file = new File(['test'], 'locations.csv', { type: 'text/csv' });

      act(() => {
        result.current.handleFileChange({
          target: { files: [file] }
        });
      });

      expect(result.current.csvFile).toBe(file);
    });

    it('should show error when no file selected for import', async () => {
      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await act(async () => {
        await result.current.handleImportCsv({ preventDefault: vi.fn() });
      });

      expect(result.current.importStatus.error).toBe(true);
      expect(result.current.importStatus.message).toBe('Please select a CSV file to import');
    });

    it('should successfully import CSV file', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries }) // Initial load
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ imported: 5, skipped: 2 }),
        });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      const file = new File(['test'], 'locations.csv', { type: 'text/csv' });

      act(() => {
        result.current.setCsvFile(file);
      });

      await act(async () => {
        await result.current.handleImportCsv({ preventDefault: vi.fn() });
      });

      // Check the second call (first is countries load)
      expect(mockFetchWithAuth).toHaveBeenNthCalledWith(2, '/api/locations/import', {
        method: 'POST',
        body: expect.any(FormData),
      });

      expect(result.current.importStatus.message).toBe(
        'Successfully imported 5 locations. 2 duplicates skipped.'
      );
      expect(result.current.importStatus.error).toBe(false);
      expect(mockOnLocationAdded).toHaveBeenCalled();
      expect(result.current.csvFile).toBeNull();
    });

    it('should handle CSV import errors', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries }) // Initial load
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Invalid CSV format' }),
        });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      // Wait for countries to load first
      await waitFor(() => {
        expect(result.current.countries).toEqual(mockCountries);
      });

      const file = new File(['test'], 'locations.csv', { type: 'text/csv' });

      act(() => {
        result.current.setCsvFile(file);
      });

      await act(async () => {
        await result.current.handleImportCsv({ preventDefault: vi.fn() });
      });

      expect(result.current.importStatus.error).toBe(true);
      expect(result.current.importStatus.message).toBe('Invalid CSV format');
    });
  });

  describe('Success State Management', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-reset success state after 2 seconds', async () => {
      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'new' }) });

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.isSuccess).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.isSuccess).toBe(false);
    });
  });

  describe('Loading States', () => {
    it('should set loading state during country fetch', async () => {
      let resolvePromise;
      const promise = new Promise(resolve => { resolvePromise = resolve; });

      mockFetchWithAuth.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      expect(result.current.isLoadingOptions).toBe(true);

      await act(async () => {
        resolvePromise({ ok: true, json: async () => mockCountries });
        await promise;
      });

      expect(result.current.isLoadingOptions).toBe(false);
    });

    it('should set submitting state during form submission', async () => {
      let resolvePromise;
      const promise = new Promise(resolve => { resolvePromise = resolve; });

      mockFetchWithAuth
        .mockResolvedValueOnce({ ok: true, json: async () => mockCountries })
        .mockReturnValueOnce(promise);

      const { result } = renderHook(() => useLocationForm(mockOnLocationAdded));

      act(() => {
        result.current.handleSubmit({ preventDefault: vi.fn() });
      });

      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        resolvePromise({ ok: true, json: async () => ({ id: 'new' }) });
        await promise;
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });
});