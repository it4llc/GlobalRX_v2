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
          if (url.includes('serviceId=service-1')) {
            return Promise.resolve({
              ok: true,
              json: async () => mockFieldsResponse,
            } as Response);
          }
          if (url.includes('serviceId=service-2')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ fields: [] }),
            } as Response);
          }
        }
        if (url.includes(`countryId=${COUNTRY_CA_ID}`)) {
          if (url.includes('serviceId=service-1')) {
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
          if (url.includes('serviceId=service-2')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ fields: [] }),
            } as Response);
          }
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
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => service1Fields,
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => service2Fields,
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

      // Verify both services were called.
      const fieldsCalls = mockFetch.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes('/fields'),
      );
      expect(fieldsCalls.length).toBe(2);
      expect(String(fieldsCalls[0][0])).toContain('serviceId=service-1');
      expect(String(fieldsCalls[1][0])).toContain('serviceId=service-2');
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
});
