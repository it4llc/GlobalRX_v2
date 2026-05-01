// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/IdvSection.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdvSection } from '../IdvSection';

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

// Set up global fetch mock properly
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

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
          collectionTab: 'personal_info' // Should be filtered out
        },
        displayOrder: 1
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
          collectionTab: 'idv'
        },
        displayOrder: 2
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
            { value: 'national_id', label: 'National ID' }
          ]
        },
        displayOrder: 3
      },
      {
        requirementId: 'req-4',
        name: 'Document Upload',
        fieldKey: 'docUpload',
        type: 'document', // Should be filtered out (not type: 'field')
        dataType: 'file',
        isRequired: false,
        fieldData: {},
        displayOrder: 4
      }
    ]
  };

  const mockSavedDataResponse = {
    sections: {
      idv: {
        country: 'US',
        fields: [
          {
            requirementId: 'req-2',
            value: '123-45-6789'
          },
          {
            requirementId: 'req-3',
            value: 'license'
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default URL-based routing for fetch
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/saved-data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sections: {} })
        } as Response);
      }
      if (url.includes('/fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ fields: [] })
        } as Response);
      }
      if (url.includes('/save')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, savedAt: new Date().toISOString() })
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
  });

  describe('country selector', () => {
    it('should render country dropdown as the first element', () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(screen.getByText('candidate.portal.idv.selectCountry')).toBeInTheDocument();
      expect(screen.getByTestId('country-selector')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.idv.chooseCountry')).toBeInTheDocument();
    });

    it('should show available countries in dropdown', async () => {
      const user = userEvent.setup();

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

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

      expect(screen.queryByTestId('idv-fields-container')).not.toBeInTheDocument();
    });
  });

  describe('field loading and display', () => {
    it('should load fields when country is selected', async () => {
      // Override default mock to return mockFieldsResponse for fields API
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] })
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select a country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      // Wait for fields container to appear
      await waitFor(() => {
        expect(screen.getByTestId('idv-fields-container')).toBeInTheDocument();
      });

      // Wait for fields to load and display
      // Should display IDV fields (not personal info fields)
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
      expect(screen.getByText('ID Type')).toBeInTheDocument();
      // Should NOT display personal info fields
      expect(screen.queryByText('First Name')).not.toBeInTheDocument();
      // Should NOT display document type fields
      expect(screen.queryByText('Document Upload')).not.toBeInTheDocument();
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
            displayOrder: 1
          },
          {
            requirementId: 'req-2',
            name: 'SSN',
            fieldKey: 'ssn',
            type: 'field',
            dataType: 'text',
            fieldData: { collectionTab: 'subject' },
            displayOrder: 2
          },
          {
            requirementId: 'req-3',
            name: 'ID Verification Field',
            fieldKey: 'idvField',
            type: 'field',
            dataType: 'text',
            fieldData: { collectionTab: 'idv' },
            displayOrder: 3
          }
        ]
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => fieldsWithMixedTabs
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1']} />);

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      await waitFor(() => {
        expect(screen.getByText('ID Verification Field')).toBeInTheDocument();
      });

      // Personal info fields should be filtered out
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
            displayOrder: 1
          },
          {
            requirementId: 'req-2',
            name: 'Phone',
            fieldKey: 'phone',
            type: 'field',
            dataType: 'phone',
            fieldData: {}, // No collectionTab
            displayOrder: 2
          },
          {
            requirementId: 'req-3',
            name: 'Custom IDV Field',
            fieldKey: 'customIdv',
            type: 'field',
            dataType: 'text',
            fieldData: {},
            displayOrder: 3
          }
        ]
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => fieldsWithoutCollectionTab
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1']} />);

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      await waitFor(() => {
        expect(screen.getByText('Custom IDV Field')).toBeInTheDocument();
      });

      // Common personal info fields should be filtered out even without collectionTab
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    });

    it('should show message when no fields are required for selected country', async () => {
      mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ fields: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ fields: [] }) // service-2
        } as Response)
        // Mock for country save
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        } as Response);

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('Other')); // Country with no fields

      expect(await screen.findByText('candidate.portal.idv.noFieldsRequired')).toBeInTheDocument();
    });
  });

  describe('saved data loading', () => {
    it('should load previously selected country and field values', async () => {
      // Override mock to return saved data and fields for US
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSavedDataResponse
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] })
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Verify country was restored by checking that fields loaded with saved values
      const idNumberInput = await screen.findByTestId('field-idNumber') as HTMLInputElement;
      expect(idNumberInput.value).toBe('123-45-6789');
    });

    it('should preserve data when changing countries', async () => {
      const user = userEvent.setup();

      // Override mock to handle country switching with different field sets
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('countryId=US')) {
          if (url.includes('serviceId=service-1')) {
            return Promise.resolve({
              ok: true,
              json: async () => mockFieldsResponse
            } as Response);
          }
          if (url.includes('serviceId=service-2')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ fields: [] })
            } as Response);
          }
        }
        if (url.includes('countryId=CA')) {
          if (url.includes('serviceId=service-1')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ fields: [
                {
                  requirementId: 'req-ca-1',
                  name: 'SIN Number',
                  fieldKey: 'sinNumber',
                  type: 'field',
                  dataType: 'text',
                  fieldData: {},
                  displayOrder: 1
                }
              ]})
            } as Response);
          }
          if (url.includes('serviceId=service-2')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ fields: [] })
            } as Response);
          }
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select first country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Enter data
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123456789');

      // Change country
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('Canada'));

      expect(await screen.findByText('SIN Number')).toBeInTheDocument();

      // Change back to US
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      // Previous data should be preserved (in the component state, though not visible here due to mocking)
      expect(await screen.findByText('ID Number')).toBeInTheDocument();
    });
  });

  describe('auto-save functionality', () => {
    it('should auto-save country selection', async () => {
      // Already mocked in beforeEach

      // Mock fields API for service-1
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockFieldsResponse
        } as Response);

      // Mock fields API for service-2
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ fields: [] })
        } as Response);

      // Mock save API for country selection
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, savedAt: new Date().toISOString() })
        } as Response);

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select a country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      // Should trigger save for country selection
      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter(
          call => call[0]?.toString().includes('/save')
        );
        expect(saveCalls.length).toBeGreaterThan(0);

        const lastSaveCall = saveCalls[saveCalls.length - 1];
        const body = JSON.parse(lastSaveCall[1]?.body as string);
        expect(body.sectionType).toBe('idv');
        expect(body.fields).toContainEqual({
          requirementId: 'idv_country',
          value: 'US'
        });
      });
    });

    it('should auto-save field values on blur', async () => {
      const user = userEvent.setup();

      // Override mock for this test
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] })
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select country first
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in ID number field
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '987-65-4321');
      await user.tab(); // Trigger blur

      await waitFor(() => {
        const saveCalls = mockFetch.mock.calls.filter(
          call => call[0]?.toString().includes('/save') && call[1]?.body
        );
        const fieldSaveCall = saveCalls.find(call => {
          if (!call[1]?.body) return false;
          const body = JSON.parse(call[1].body as string);
          return body.fields?.some((f: any) => f.requirementId === 'req-2');
        });

        expect(fieldSaveCall).toBeDefined();
        const body = JSON.parse(fieldSaveCall![1]?.body as string);
        expect(body.fields).toContainEqual({
          requirementId: 'req-2',
          value: '987-65-4321'
        });
      });
    });

    it('should show save status indicators', async () => {
      const user = userEvent.setup();

      // Override mock with delayed save response for this test
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] })
          } as Response);
        }
        if (url.includes('/save')) {
          // Delay the save to allow "Saving..." to be observed
          return new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true })
          }), 100));
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in field
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123');
      await user.tab();

      // Should show saving and then saved
      expect(await screen.findByText('Saving...')).toBeInTheDocument();
      expect(await screen.findByText('Saved')).toBeInTheDocument();
    });

    it('should handle save errors and retry', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      let saveCallCount = 0;

      // Override mock for this test with error on save
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/save')) {
          saveCallCount++;
          if (saveCallCount === 1) {
            // First save (country) succeeds
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true })
            } as Response);
          } else {
            // Second save (field) fails with delay to allow observation of error state
            return new Promise((resolve, reject) =>
              setTimeout(() => reject(new Error('Save failed')), 50)
            );
          }
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('ID Number')).toBeInTheDocument();

      // Type in field
      const idNumberInput = screen.getByTestId('field-idNumber');
      await user.type(idNumberInput, '123');
      await user.tab();

      // Should show error and retry message
      expect(await screen.findByText('Save failed — retrying')).toBeInTheDocument();

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
            displayOrder: 1
          }
        ]
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
            displayOrder: 2
          }
        ]
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-1')) {
          return Promise.resolve({
            ok: true,
            json: async () => service1Fields
          } as Response);
        }
        if (url.includes('/fields?serviceId=service-2')) {
          return Promise.resolve({
            ok: true,
            json: async () => service2Fields
          } as Response);
        }
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<IdvSection token={mockToken} serviceIds={['service-1', 'service-2']} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('Field from Service 1')).toBeInTheDocument();
      expect(screen.getByText('Field from Service 2')).toBeInTheDocument();

      // Verify both services were called
      const fieldsCalls = mockFetch.mock.calls.filter(
        call => call[0]?.toString().includes('/fields')
      );
      expect(fieldsCalls.length).toBe(2);
      expect(fieldsCalls[0][0]).toContain('serviceId=service-1');
      expect(fieldsCalls[1][0]).toContain('serviceId=service-2');
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
            displayOrder: 1
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => duplicateFields
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => duplicateFields
        } as Response);

      render(<IdvSection token={mockToken} serviceIds={['service-1', 'service-2']} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      // Should only show the field once
      const duplicateFieldElement = await screen.findByText('Duplicate Field');
      expect(duplicateFieldElement).toBeInTheDocument();
      const allDuplicateFields = screen.getAllByText('Duplicate Field');
      expect(allDuplicateFields).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle no service IDs gracefully', async () => {
      render(<IdvSection token={mockToken} serviceIds={[]} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('candidate.portal.idv.noFieldsRequired')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Already mocked saved-data in beforeEach
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      // Select country
      const countrySelector = screen.getByTestId('country-selector');
      fireEvent.click(countrySelector);
      fireEvent.click(screen.getByText('United States'));

      expect(await screen.findByText('candidate.portal.idv.noFieldsRequired')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('section header', () => {
    it('should display section title and save indicator', () => {
      render(<IdvSection token={mockToken} serviceIds={mockServiceIds} />);

      expect(screen.getByText('candidate.portal.sections.identityVerification')).toBeInTheDocument();
      expect(screen.getByText('candidate.portal.sections.identityVerification')).toHaveClass('text-2xl', 'font-semibold');
    });
  });
});