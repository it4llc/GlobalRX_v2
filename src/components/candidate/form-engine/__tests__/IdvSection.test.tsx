// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/IdvSection.test.tsx
//
// Phase 7 Stage 2 update — IdvSection now loads its country list from
// /api/candidate/application/[token]/countries (returning UUID-based country
// rows), instead of using a hardcoded ISO code list. The saved
// `idv_country` value is the Country.id UUID, NOT 'US'/'CA'/etc.
//
// All tests below provide the /countries endpoint response and use UUIDs in
// place of the legacy two-letter codes.
//
// Mocking discipline:
//   - Rule M1: We do NOT mock IdvSection (the subject of this file).
//   - Rule M2: We do NOT mock DynamicFieldRenderer or AutoSaveIndicator —
//     the assertions read 'field-idNumber' / 'Saving...' / 'Saved' which
//     come from those children's real DOM.
//   - Rule M3: useDebounce, useTranslation, and the global fetch are
//     mocked with INLINE implementations that read their arguments
//     (URL routing inside fetch). No mockReturnValueOnce scripted-sequence
//     patterns for utilities the parent calls with meaningful arguments.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdvSection } from '../IdvSection';

// Mock useDebounce to return value immediately for testing.
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: unknown) => value,
}));

// Mock TranslationContext.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Set up global fetch mock.
const mockFetch = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.fetch = mockFetch as any;

// ---------------------------------------------------------------------------
// Country UUIDs — pinned values used across the suite. These mirror the new
// /api/candidate/application/[token]/countries response shape, where each
// row is { id: <UUID>, name, code2 }.
// ---------------------------------------------------------------------------

const COUNTRY_US_ID = 'country-uuid-us-0001';
const COUNTRY_CA_ID = 'country-uuid-ca-0002';
const COUNTRY_GB_ID = 'country-uuid-gb-0003';
const COUNTRY_AU_ID = 'country-uuid-au-0004';

const mockCountriesResponse = [
  { id: COUNTRY_US_ID, name: 'United States', code2: 'US' },
  { id: COUNTRY_CA_ID, name: 'Canada', code2: 'CA' },
  { id: COUNTRY_GB_ID, name: 'United Kingdom', code2: 'GB' },
  { id: COUNTRY_AU_ID, name: 'Australia', code2: 'AU' },
];

describe('IdvSection', () => {
  const mockToken = 'test-token-123';
  const mockServiceIds = ['service-1', 'service-2'];

  const mockFieldsResponse = {
    fields: [
      {
        requirementId: 'req-1',
        name: 'First Name',
        fieldKey: 'firstName',
        type: 'field',
        dataType: 'text',
        isRequired: true,
        instructions: null,
        fieldData: {
          collectionTab: 'personal_info', // Should be filtered out
        },
        displayOrder: 1,
      },
      {
        requirementId: 'req-2',
        name: 'ID Number',
        fieldKey: 'idNumber',
        type: 'field',
        dataType: 'text',
        isRequired: true,
        instructions: 'Enter your government ID number',
        fieldData: {
          collectionTab: 'idv',
        },
        displayOrder: 2,
      },
      {
        requirementId: 'req-3',
        name: 'ID Type',
        fieldKey: 'idType',
        type: 'field',
        dataType: 'select',
        isRequired: true,
        instructions: null,
        fieldData: {
          collectionTab: 'idv',
          options: [
            { value: 'passport', label: 'Passport' },
            { value: 'license', label: "Driver's License" },
            { value: 'national_id', label: 'National ID' },
          ],
        },
        displayOrder: 3,
      },
      {
        requirementId: 'req-4',
        name: 'Document Upload',
        fieldKey: 'docUpload',
        type: 'document', // Should be filtered out (not type: 'field')
        dataType: 'file',
        isRequired: false,
        fieldData: {},
        displayOrder: 4,
      },
    ],
  };

  // The saved-data response stores idv.country selection as a synthetic
  // 'idv_country' field row; the value is the Country.id UUID per the
  // implementer's lifecycle (see IdvSection.loadSavedData).
  const mockSavedDataResponse = {
    sections: {
      idv: {
        fields: [
          { requirementId: 'idv_country', value: COUNTRY_US_ID },
          { requirementId: 'req-2', value: '123-45-6789' },
          { requirementId: 'req-3', value: 'license' },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default URL-based routing for fetch — every test reuses this and
    // overrides via mockFetch.mockImplementationOnce as needed.
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/countries')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCountriesResponse,
        } as Response);
      }
      if (url.includes('/saved-data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sections: {} }),
        } as Response);
      }
      if (url.includes('/fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ fields: [] }),
        } as Response);
      }
      if (url.includes('/save')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            savedAt: new Date().toISOString(),
          }),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
  });

  describe('country selector', () => {
    it('should render country dropdown as the first element', () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(
        screen.getByText('candidate.portal.idv.selectCountry'),
      ).toBeInTheDocument();
      expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      expect(
        screen.getByText('candidate.portal.idv.chooseCountry'),
      ).toBeInTheDocument();
    });

    it('should show available countries in dropdown (loaded from /countries API)', async () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Wait for /countries to load before opening the dropdown.
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/countries'),
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.getByText('Canada')).toBeInTheDocument();
        expect(screen.getByText('United Kingdom')).toBeInTheDocument();
        expect(screen.getByText('Australia')).toBeInTheDocument();
      });
    });

    it('should not show fields until country is selected', () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(
        screen.queryByTestId('idv-fields-container'),
      ).not.toBeInTheDocument();
    });
  });

  describe('field loading and display', () => {
    it('should load fields when country is selected', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Wait for /countries to populate the dropdown.
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);

      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United United States'.replace('United ', '')));

      await waitFor(() => {
        expect(screen.getByTestId('idv-fields-container')).toBeInTheDocument();
      });

      // Should display IDV fields (not personal info fields).
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
      expect(screen.getByText('ID Type')).toBeInTheDocument();
      // Should NOT display personal info fields (collectionTab=personal_info).
      expect(screen.queryByText('First Name')).not.toBeInTheDocument();
      // Should NOT display document type fields.
      expect(screen.queryByText('Document Upload')).not.toBeInTheDocument();
    });

    it('should pass the country UUID (not a code) on the /fields URL', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1']} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // The fields URL must use the UUID, not 'US'.
      await waitFor(() => {
        const fieldsCalls = mockFetch.mock.calls
          .map((c: unknown[]) => String(c[0]))
          .filter((u: string) => u.includes('/fields'));
        expect(fieldsCalls.length).toBeGreaterThan(0);
        expect(fieldsCalls.some((u: string) => u.includes(`countryId=${COUNTRY_US_ID}`))).toBe(
          true,
        );
        // Defensive — the legacy 'US' code must not be in the URL.
        expect(fieldsCalls.some((u: string) => u.includes('countryId=US'))).toBe(
          false,
        );
      });
    });

    it('should filter out personal info fields based on collectionTab', async () => {
      const fieldsWithMixedTabs = {
        fields: [
          {
            requirementId: 'req-1',
            name: 'Date of Birth',
            fieldKey: 'dateOfBirth',
            type: 'field',
            dataType: 'date',
            fieldData: { collectionTab: 'personal' },
            displayOrder: 1,
          },
          {
            requirementId: 'req-2',
            name: 'SSN',
            fieldKey: 'ssn',
            type: 'field',
            dataType: 'text',
            fieldData: { collectionTab: 'subject' },
            displayOrder: 2,
          },
          {
            requirementId: 'req-3',
            name: 'ID Verification Field',
            fieldKey: 'idvField',
            type: 'field',
            dataType: 'text',
            fieldData: { collectionTab: 'idv' },
            displayOrder: 3,
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => fieldsWithMixedTabs,
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1']} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      await waitFor(() => {
        expect(screen.getByText('ID Verification Field')).toBeInTheDocument();
      });

      // Personal info fields should be filtered out.
      expect(screen.queryByText('Date of Birth')).not.toBeInTheDocument();
      expect(screen.queryByText('SSN')).not.toBeInTheDocument();
    });

    it('should filter out fields based on fieldKey for common personal info fields', async () => {
      const fieldsWithoutCollectionTab = {
        fields: [
          {
            requirementId: 'req-1',
            name: 'Email',
            fieldKey: 'email',
            type: 'field',
            dataType: 'email',
            fieldData: {}, // No collectionTab
            displayOrder: 1,
          },
          {
            requirementId: 'req-2',
            name: 'Phone',
            fieldKey: 'phone',
            type: 'field',
            dataType: 'phone',
            fieldData: {}, // No collectionTab
            displayOrder: 2,
          },
          {
            requirementId: 'req-3',
            name: 'Custom IDV Field',
            fieldKey: 'customIdv',
            type: 'field',
            dataType: 'text',
            fieldData: {},
            displayOrder: 3,
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => fieldsWithoutCollectionTab,
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1']} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      await waitFor(() => {
        expect(screen.getByText('Custom IDV Field')).toBeInTheDocument();
      });

      // Common personal info fields should be filtered out even without
      // collectionTab.
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('should show message when no fields are required for selected country', async () => {
      // /fields returns an empty list for any service — selecting a country
      // shows the noFieldsRequired translation key.
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('Australia')).toBeInTheDocument();
      });
      // Pick any country — the /fields response is empty for all of them.
      fireEvent.click(screen.getByText('Australia'));

      expect(
        await screen.findByText('candidate.portal.idv.noFieldsRequired'),
      ).toBeInTheDocument();
    });
  });

  describe('saved data loading', () => {
    it('should load previously selected country and field values', async () => {
      // The component reads the saved country UUID from
      // sections.idv.fields[where requirementId='idv_country'].value, NOT
      // from a top-level country code.
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSavedDataResponse,
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // The saved country triggers /fields with the saved UUID — the field
      // input is populated from the saved field value.
      const idNumberInput = (await screen.findByTestId(
        'field-idNumber',
      )) as HTMLInputElement;
      expect(idNumberInput.value).toBe('123-45-6789');

      // The /fields call must use the saved country UUID, not a code.
      await waitFor(() => {
        const fieldsCalls = mockFetch.mock.calls
          .map((c: unknown[]) => String(c[0]))
          .filter((u: string) => u.includes('/fields'));
        expect(
          fieldsCalls.some((u: string) => u.includes(`countryId=${COUNTRY_US_ID}`)),
        ).toBe(true);
      });
    });

    it('should preserve data when changing countries', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes(`countryId=${COUNTRY_US_ID}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes(`countryId=${COUNTRY_CA_ID}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-ca-1',
                  name: 'SIN Number',
                  fieldKey: 'sinNumber',
                  type: 'field',
                  dataType: 'text',
                  fieldData: {},
                  displayOrder: 1,
                },
              ],
            }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select first country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Enter data.
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123456789');

      // Change country.
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('Canada'));

      expect(await screen.findByText('SIN Number')).toBeInTheDocument();

      // Change back to US.
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      // Previous data should be preserved (in the component state, though
      // not visible here due to mocking).
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
    });
  });

  describe('auto-save functionality', () => {
    it('should auto-save country selection (saving the country UUID, not a code)', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse,
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              savedAt: new Date().toISOString(),
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select a country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // Should trigger save for country selection — value is the UUID.
      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter((call: unknown[]) =>
          String(call[0]).includes('/save'),
        );
        expect(saveCalls.length).toBeGreaterThan(0);

        const lastSaveCall = saveCalls[saveCalls.length - 1];
        const body = JSON.parse((lastSaveCall[1] as RequestInit | undefined)?.body as string);
        expect(body.sectionType).toBe('idv');
        expect(body.fields).toContainEqual({
          requirementId: 'idv_country',
          value: COUNTRY_US_ID,
        });
      });
    });

    it('should auto-save field values on blur', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country first.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in ID number field.
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '987-65-4321');
      await user.tab(); // Trigger blur.

      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter(
          (call: unknown[]) =>
            String(call[0]).includes('/save') && (call[1] as RequestInit | undefined)?.body,
        );
        const fieldSaveCall = saveCalls.find((call: unknown[]) => {
          const body = (call[1] as RequestInit | undefined)?.body;
          if (!body) return false;
          const parsed = JSON.parse(body as string) as { fields?: Array<{ requirementId: string }> };
          return parsed.fields?.some((f) => f.requirementId === 'req-2');
        });

        expect(fieldSaveCall).toBeDefined();
        const body = JSON.parse((fieldSaveCall![1] as RequestInit | undefined)?.body as string);
        expect(body.fields).toContainEqual({
          requirementId: 'req-2',
          value: '987-65-4321',
        });
      });
    });

    it('should show save status indicators', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes('/save')) {
          // Delay the save to allow "Saving..." to be observed.
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true }),
                }),
              100,
            ),
          );
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in field.
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123');
      await user.tab();

      // Should show saving and then saved.
      expect(await screen.findByText('Saving...')).toBeInTheDocument();
      expect(await screen.findByText('Saved')).toBeInTheDocument();
    });

    it('should handle save errors and retry', async () => {
      const user = userEvent.setup();
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      let saveCallCount = 0;

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse,
          } as Response);
        }
        if (url.includes('/save')) {
          saveCallCount++;
          if (saveCallCount === 1) {
            // First save (country) succeeds.
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true }),
            } as Response);
          } else {
            // Second save (field) fails with delay to allow observation
            // of the error state.
            return new Promise((_resolve, reject) =>
              setTimeout(() => reject(new Error('Save failed')), 50),
            );
          }
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in field.
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123');
      await user.tab();

      // Should show error and retry message.
      expect(
        await screen.findByText('Save failed — retrying'),
      ).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('multiple services', () => {
    it('should load fields from all provided service IDs', async () => {
      const service1Fields = {
        fields: [
          {
            requirementId: 'req-s1-1',
            name: 'Field from Service 1',
            fieldKey: 'service1Field',
            type: 'field',
            dataType: 'text',
            fieldData: {},
            displayOrder: 1,
          },
        ],
      };

      const service2Fields = {
        fields: [
          {
            requirementId: 'req-s2-1',
            name: 'Field from Service 2',
            fieldKey: 'service2Field',
            type: 'field',
            dataType: 'text',
            fieldData: {},
            displayOrder: 2,
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields?')) {
          // TD-084: the package-aware route returns a single merged response
          // for all requested serviceIds. Model that here by combining both
          // service fixtures into one payload.
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [...service1Fields.fields, ...service2Fields.fields],
            }),
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <IdvSection
          token={mockToken}
          serviceIds={['service-1', 'service-2']}
        />,
      );

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(
        await screen.findByText('Field from Service 1'),
      ).toBeInTheDocument();
      expect(screen.getByText('Field from Service 2')).toBeInTheDocument();

      // TD-084: verify a single batched /fields call was issued and that
      // every provided service id appears in the request URL (repeated
      // serviceIds= query params).
      const fieldsCalls = mockFetch.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('/fields'),
      );
      expect(fieldsCalls.length).toBe(1);
      expect(String(fieldsCalls[0][0])).toMatch(/serviceIds=service-1/);
      expect(String(fieldsCalls[0][0])).toMatch(/serviceIds=service-2/);
    });

    it('should deduplicate fields from multiple services', async () => {
      const duplicateFields = {
        fields: [
          {
            requirementId: 'req-dup-1',
            name: 'Duplicate Field',
            fieldKey: 'duplicateField',
            type: 'field',
            dataType: 'text',
            fieldData: {},
            displayOrder: 1,
          },
        ],
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => duplicateFields,
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(
        <IdvSection
          token={mockToken}
          serviceIds={['service-1', 'service-2']}
        />,
      );

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // Should only show the field once.
      const duplicateFieldElement = await screen.findByText('Duplicate Field');
      expect(duplicateFieldElement).toBeInTheDocument();
      const allDuplicateFields = screen.getAllByText('Duplicate Field');
      expect(allDuplicateFields).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle no service IDs gracefully', async () => {
      render(<IdvSection token={mockToken} serviceIds={[]} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(
        await screen.findByText('candidate.portal.idv.noFieldsRequired'),
      ).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Default beforeEach mock handles /countries — override /fields to reject.
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes('/fields')) {
          return Promise.reject(new Error('API Error'));
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(calls.some((u: unknown) => String(u).includes('/countries'))).toBe(
          true,
        );
      });

      // Select country.
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      expect(
        await screen.findByText('candidate.portal.idv.noFieldsRequired'),
      ).toBeInTheDocument();

      consoleError.mockRestore();
    });

    it('should surface the countries-load error when the /countries API fails', async () => {
      // Phase 7 Stage 2 — IdvSection no longer falls back to a hardcoded
      // country list. When /countries fails the candidate sees the
      // documented error alert.
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal' }),
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(
        await screen.findByText('candidate.portal.countriesLoadError'),
      ).toBeInTheDocument();
    });
  });

  describe('section header', () => {
    it('should display section title and save indicator', () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(
        screen.getByText('candidate.portal.sections.identityVerification'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('candidate.portal.sections.identityVerification'),
      ).toHaveClass('text-2xl', 'font-semibold');
    });
  });

  // ===========================================================================
  // Phase 7 Stage 3b — TD-072 IDV country-switch cleanup
  //
  // Spec:           docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md
  //                 (Rules 12–17; DoD 11–14)
  // Technical plan: docs/plans/phase7-stage3b-technical-plan.md §1.3, §2.3.4
  //
  // After Stage 3b, when the candidate switches the IDV country from X to Y:
  //   - DoD 11: every X-scoped formData[<requirementId>] entry must be removed
  //     before the new country's fields begin populating.
  //   - DoD 12: the next save's pendingSaves payload must contain only the new
  //     country's requirementIds plus the synthetic `idv_country` row — no
  //     orphaned X-scoped requirementIds.
  //   - DoD 13: `idv_country` is updated to Y in the same save cycle (existing
  //     behavior preserved — regression check).
  //   - DoD 14: manual smoke test path documented in the implementer's
  //     checkpoint (NOT a test file — captured in the hand-off summary).
  //
  // Mocking discipline (consistent with the suite above):
  //   - We do NOT mock IdvSection (Rule M1 — subject of test).
  //   - We do NOT mock DynamicFieldRenderer / AutoSaveIndicator (Rule M2).
  //   - mockFetch URL-routes per the existing pattern; the per-country
  //     /fields response is derived from the URL's countryId param so the
  //     test can drive different field sets per country switch.
  // ===========================================================================
  describe('TD-072 — country-switch cleanup of stale per-country form data', () => {
    /**
     * Helper — extract the LAST /save call body (parsed JSON) from the
     * fetch mock's call log. Returns null if no /save call was made.
     */
    function lastSaveBody():
      | { sectionType: string; sectionId: string; fields: Array<{ requirementId: string; value: unknown }> }
      | null {
      const saveCalls = mockFetch.mock.calls.filter(
        (call: unknown[]) =>
          String(call[0]).includes('/save') &&
          (call[1] as RequestInit | undefined)?.body,
      );
      if (saveCalls.length === 0) return null;
      const last = saveCalls[saveCalls.length - 1];
      const body = (last[1] as RequestInit | undefined)?.body;
      if (!body) return null;
      return JSON.parse(body as string);
    }

    /**
     * Drive the IDV component through:
     *   1. Select country US.
     *   2. Type into the US-only IDV field 'ID Number' (req-2, US-scoped).
     *   3. Switch to country CA.
     *   4. Type into the CA-only IDV field 'SIN Number' (req-ca-1, CA-scoped).
     *
     * The fetch mock returns `mockFieldsResponse` for US (which includes
     * req-2 'ID Number') and a CA-specific fields list (req-ca-1 only)
     * when countryId=CA. Each test below asserts on the resulting
     * sequence of /save calls.
     */
    function setupCountrySwitchFetchMock(): void {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/countries')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockCountriesResponse,
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} }),
          } as Response);
        }
        if (url.includes(`countryId=${COUNTRY_US_ID}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [...mockFieldsResponse.fields] }),
          } as Response);
        }
        if (url.includes(`countryId=${COUNTRY_CA_ID}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              fields: [
                {
                  requirementId: 'req-ca-1',
                  name: 'SIN Number',
                  fieldKey: 'sinNumber',
                  type: 'field',
                  dataType: 'text',
                  isRequired: true,
                  fieldData: { collectionTab: 'idv' },
                  displayOrder: 1,
                },
              ],
            }),
          } as Response);
        }
        if (url.includes('/save')) {
          // Echo: just acknowledge the save so the component clears
          // pendingSaves; the test reads init.body via lastSaveBody().
          void init;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              savedAt: new Date().toISOString(),
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });
    }

    // DoD 11+12 (end-to-end) — verifies that an end-to-end country-switch flow
    // followed by typing into a new-country field produces a save body with only
    // new-country requirementIds. This passes on Pass 1 without the TD-072
    // implementation because pendingSaves drains on every successful save; see
    // the comment on the strengthened test below for the full explanation.
    // Retained as a forward regression guard.
    it('DoD 11 + DoD 12: switching country from US to CA clears the US-scoped requirementId from formData; the next save after typing into the CA-scoped field does NOT include the US-scoped requirementId', async () => {
      const user = userEvent.setup();
      setupCountrySwitchFetchMock();

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Step 1 — select US.
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(
          calls.some((u: unknown) => String(u).includes('/countries')),
        ).toBe(true);
      });
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // Step 2 — type into US-scoped field req-2 'ID Number' and blur.
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123-45-6789');
      await user.tab();

      // Wait for the US save to land. Body must contain the US-scoped
      // requirementId (req-2) — sanity check the fixture before we
      // switch countries.
      await waitFor(() => {
        const body = lastSaveBody();
        expect(body).not.toBeNull();
        expect(
          body!.fields.some((f) => f.requirementId === 'req-2'),
        ).toBe(true);
      });

      // Step 3 — switch country to CA.
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('Canada')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Canada'));

      // CA's fields load.
      expect(await screen.findByText('SIN Number')).toBeInTheDocument();

      // Step 4 — type into CA-scoped field req-ca-1 'SIN Number' and blur.
      const sinInput = screen.getByTestId('field-sinNumber');
      await user.type(sinInput, '111-222-333');
      await user.tab();

      // Step 5 — assert on the LAST /save call's body. After the cleanup,
      // the pendingSaves payload must include only req-ca-1 (the CA-scoped
      // field) and NOT req-2 (the US-scoped field that the candidate filled
      // before switching).
      await waitFor(() => {
        const body = lastSaveBody();
        expect(body).not.toBeNull();
        // Spec DoD 11/12 — the new save MUST contain the CA-scoped
        // requirementId.
        expect(
          body!.fields.some((f) => f.requirementId === 'req-ca-1'),
        ).toBe(true);
        // Spec DoD 12 — and it MUST NOT contain the US-scoped requirementId.
        expect(
          body!.fields.some((f) => f.requirementId === 'req-2'),
        ).toBe(false);
      });
    });

    // DoD 11+12 (strengthened) — verifies that the FIRST save fired by the
    // country-switch handler does not include any previous-country
    // requirementId in its body. This is a forward regression guard: it
    // documents the contract on the save-body shape after cleanup, and will
    // catch a regression where the country-switch save body re-acquires a
    // previous-country requirementId.
    //
    // It does NOT, by itself, fail on Pass 1 in the absence of the TD-072
    // implementation. The bug TD-072 fixes is a race: the previous-country
    // requirementId stays alive in formData[] but only enters a save body if it
    // is also still in pendingSaves, which is only true if the user-typed save
    // has not yet drained pendingSaves at the moment of the country switch.
    // Driving that race in a test requires a deferred fetch-mock and held
    // promises; it is verified by hand via DoD 14's manual smoke instead.
    //
    // The cleanup behavior in formData itself is verified by spec review and
    // by the manual smoke documented in DoD 14, NOT by this test.
    it('DoD 11 + 12 (strengthened): the FIRST save fired by the country switch itself must not include any requirementId scoped to the previous country', async () => {
      const user = userEvent.setup();
      setupCountrySwitchFetchMock();

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Step 1 — wait for /countries to load, then select US.
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(
          calls.some((u: unknown) => String(u).includes('/countries')),
        ).toBe(true);
      });
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // Step 2 — wait for the US-scoped 'ID Number' field to render, then
      // type into req-2 (US-scoped) and tab to blur. This is the
      // previous-country requirementId that the cleanup must remove.
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123-45-6789');
      await user.tab();

      // Step 3 — sanity check: wait for the US-typed save to land, and
      // confirm req-2 is in that save's body. This proves the fixture
      // wiring is correct before we exercise the country-switch path.
      await waitFor(() => {
        const body = lastSaveBody();
        expect(body).not.toBeNull();
        expect(
          body!.fields.some((f) => f.requirementId === 'req-2'),
        ).toBe(true);
      });

      // Step 4 — WITHOUT typing anything else, switch country to CA.
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('Canada')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Canada'));

      // Step 5 — wait for the country-switch save to fire. We identify it
      // as the /save call whose body contains
      // { requirementId: 'idv_country', value: COUNTRY_CA_ID }. We search
      // the full mockFetch call log (not just the most recent save) so
      // that an earlier user-typed save does not mask this assertion.
      await waitFor(() => {
        const switchSave = mockFetch.mock.calls.find((call: unknown[]) => {
          if (!String(call[0]).includes('/save')) return false;
          const init = call[1] as RequestInit | undefined;
          if (!init?.body) return false;
          let parsed: { fields?: Array<{ requirementId: string; value: unknown }> };
          try {
            parsed = JSON.parse(init.body as string);
          } catch {
            return false;
          }
          return (parsed.fields ?? []).some(
            (f) => f.requirementId === 'idv_country' && f.value === COUNTRY_CA_ID,
          );
        });
        expect(switchSave).toBeDefined();
      });

      // Re-locate the same country-switch save to make assertions on its
      // exact body shape.
      const switchSave = mockFetch.mock.calls.find((call: unknown[]) => {
        if (!String(call[0]).includes('/save')) return false;
        const init = call[1] as RequestInit | undefined;
        if (!init?.body) return false;
        let parsed: { fields?: Array<{ requirementId: string; value: unknown }> };
        try {
          parsed = JSON.parse(init.body as string);
        } catch {
          return false;
        }
        return (parsed.fields ?? []).some(
          (f) => f.requirementId === 'idv_country' && f.value === COUNTRY_CA_ID,
        );
      });
      expect(switchSave).toBeDefined();
      const switchBody = JSON.parse(
        (switchSave![1] as RequestInit).body as string,
      ) as { fields: Array<{ requirementId: string; value: unknown }> };

      // Sanity / regression — the country-switch save must update
      // idv_country to CA (preserved DoD 13 behavior).
      expect(switchBody.fields).toContainEqual({
        requirementId: 'idv_country',
        value: COUNTRY_CA_ID,
      });

      // Strengthened DoD 11 + 12 assertion — at the moment the
      // country-switch save fires, the previous-country (US) requirementId
      // req-2 must already have been cleaned out of formData and must NOT
      // appear in the save's fields payload.
      expect(
        switchBody.fields.some((f) => f.requirementId === 'req-2'),
      ).toBe(false);
    });

    it('DoD 13: idv_country is updated to the new country (CA) in the same save cycle as the country switch (existing behavior preserved)', async () => {
      setupCountrySwitchFetchMock();

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select US first so there's something to switch FROM.
      await waitFor(() => {
        const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
        expect(
          calls.some((u: unknown) => String(u).includes('/countries')),
        ).toBe(true);
      });
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('United States')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('United States'));

      // Wait for the US country save to fire.
      await waitFor(() => {
        const body = lastSaveBody();
        expect(body).not.toBeNull();
        expect(body!.fields).toContainEqual({
          requirementId: 'idv_country',
          value: COUNTRY_US_ID,
        });
      });

      // Switch to CA.
      fireEvent.click(countrySelector);
      await waitFor(() => {
        expect(screen.getByText('Canada')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Canada'));

      // The next save cycle must update the synthetic idv_country row to
      // the new country (CA). This is preserved behavior — Stage 3b's
      // cleanup must not break it.
      await waitFor(() => {
        const body = lastSaveBody();
        expect(body).not.toBeNull();
        expect(body!.fields).toContainEqual({
          requirementId: 'idv_country',
          value: COUNTRY_CA_ID,
        });
      });
    });
  });
});
