// /GlobalRX_v2/src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonalInfoSection } from '../PersonalInfoSection';

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
global.fetch = mockFetch;

describe('PersonalInfoSection', () => {
  const mockToken = 'test-token-123';

  const mockFieldsResponse = {
    fields: [
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
    ]
  };

  const mockSavedDataResponse = {
    sections: {
      personal_info: {
        fields: [
          {
            requirementId: 'req-5',
            value: '1990-05-15'
          },
          {
            requirementId: 'req-6',
            value: 'Marie'
          }
        ]
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default URL-based routing for fetch
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/personal-info-fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ fields: [] })
        } as Response);
      }
      if (url.includes('/saved-data')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sections: {} })
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

  describe('loading and rendering', () => {
    it('should show loading state initially', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<PersonalInfoSection token={mockToken} />);

      expect(screen.getByText('candidate.portal.personalInfo.loading')).toBeInTheDocument();
    });

    it('should load and display fields from API', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

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
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ fields: [] })
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

      await waitFor(() => {
        expect(screen.getByText('candidate.portal.personalInfo.noFieldsRequired')).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch
        .mockRejectedValueOnce(new Error('API Error'));

      render(<PersonalInfoSection token={mockToken} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading personal information fields...')).not.toBeInTheDocument();
      });

      // Component should still render empty state
      expect(screen.getByText('candidate.portal.personalInfo.noFieldsRequired')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('pre-filled and locked fields', () => {
    it('should display pre-filled values for locked fields', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

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

    it('should not show required indicator for locked fields', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

      expect(await screen.findByText('First Name')).toBeInTheDocument();

      // Find the label containers for locked fields
      const labels = screen.getAllByText('First Name')[0].parentElement;
      // There should be no required indicator (*) for locked fields even though they are required
      expect(labels?.querySelector('.required-indicator')).not.toBeInTheDocument();
    });
  });

  describe('saved data loading', () => {
    it('should load and display previously saved data', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockSavedDataResponse
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

      render(<PersonalInfoSection token={mockToken} />);

      await waitFor(() => {
        const dobInput = screen.getByTestId('field-dateOfBirth') as HTMLInputElement;
        expect(dobInput.value).toBe('1990-05-15');
      });

      const middleNameInput = screen.getByTestId('field-middleName') as HTMLInputElement;
      expect(middleNameInput.value).toBe('Marie');
    });

    it('should not overwrite locked pre-filled values with saved data', async () => {
      const savedDataWithLockedFields = {
        sections: {
          personal_info: {
            fields: [
              {
                requirementId: 'req-1', // First Name - locked field
                value: 'DifferentName'
              },
              {
                requirementId: 'req-5',
                value: '1990-05-15'
              }
            ]
          }
        }
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => savedDataWithLockedFields
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

      render(<PersonalInfoSection token={mockToken} />);

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

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

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

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

      // Wait for field to be rendered and component to be fully loaded
      const firstNameInput = await screen.findByTestId('field-firstName');
      expect(firstNameInput).toBeInTheDocument();

      // Clear any mock calls that happened during loading
      vi.clearAllMocks();

      // Re-setup the mock after clearing
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/save')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true })
          } as Response);
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

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
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
        if (url.includes('/save')) {
          // Delay the save to allow "Saving..." to be observed
          return new Promise(resolve => setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, savedAt: new Date().toISOString() })
          }), 100));
        }
        return Promise.resolve({ ok: false, status: 404 });
      });

      render(<PersonalInfoSection token={mockToken} />);

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
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
          } as Response);
        }
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

      render(<PersonalInfoSection token={mockToken} />);

      const middleNameInput = await screen.findByTestId('field-middleName');
      expect(middleNameInput).toBeInTheDocument();

      // Type in field
      await user.type(middleNameInput, 'Anne');
      await user.tab();

      // Should show error status
      expect(await screen.findByText('Save failed — retrying')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('field ordering', () => {
    it('should display fields in correct order based on displayOrder', async () => {
      const unorderedFields = {
        fields: [
          { ...mockFieldsResponse.fields[2], displayOrder: 3 }, // Email
          { ...mockFieldsResponse.fields[0], displayOrder: 1 }, // First Name
          { ...mockFieldsResponse.fields[4], displayOrder: 5 }, // DOB
          { ...mockFieldsResponse.fields[1], displayOrder: 2 }, // Last Name
        ]
      };

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => unorderedFields
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

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
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

      expect(await screen.findByText('Enter your date of birth')).toBeInTheDocument();

      // Just check the help text exists, not specific classes
      const helpText = screen.getByText('Enter your date of birth');
      expect(helpText).toBeInTheDocument();
    });
  });

  describe('section header', () => {
    it('should display section title and instructions', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/personal-info-fields')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockFieldsResponse
          } as Response);
        }
        if (url.includes('/saved-data')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sections: {} })
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

      render(<PersonalInfoSection token={mockToken} />);

      expect(await screen.findByText('candidate.portal.sections.personalInformation')).toBeInTheDocument();

      // Check for the instruction text (it might be split across elements)
      const container = screen.getByText('candidate.portal.sections.personalInformation').parentElement?.parentElement;
      // Check for the translation key instead of the actual text
      expect(container?.textContent).toContain('candidate.portal.personalInfo.instructions');
    });
  });
});