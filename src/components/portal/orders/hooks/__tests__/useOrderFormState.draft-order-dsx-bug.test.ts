// REGRESSION TEST: proves bug fix for draft order DSX field values missing on edit
// Bug: When editing a draft order with DSX search fields (like Education Verification),
// the saved field values appear blank even though they exist in the database.
// Root cause: Field values are keyed by field names from the API ("School Name")
// but the form expects them keyed by field UUIDs (field.id).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrderFormState } from '../useOrderFormState';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock client logger
vi.mock('@/lib/client-logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock the service cart hook
vi.mock('../useServiceCart', () => ({
  useServiceCart: vi.fn(() => ({
    serviceItems: [],
    setCart: vi.fn(),
    addService: vi.fn(),
    removeService: vi.fn(),
    clearCart: vi.fn(),
    getCartSummary: vi.fn(() => ({ totalItems: 0, totalServices: 0 })),
  }))
}));

// Mock the requirements hook
vi.mock('../useOrderRequirements', () => ({
  useOrderRequirements: vi.fn(() => ({
    requirements: { subjectFields: [], searchFields: [], documents: [] },
    fetchRequirements: vi.fn(),
    fetchRequirementsForEdit: vi.fn(async (serviceItems: any, orderId: string, callback: any) => {
      // Simulate the API returning search fields with IDs and names
      const mockRequirementsData = {
        subjectFields: [],
        searchFields: [
          {
            id: 'field-uuid-1',
            name: 'School Name',
            dataType: 'text',
            required: true,
            serviceId: 'education-verification-service',
            locationId: 'loc-1'
          },
          {
            id: 'field-uuid-2',
            name: 'Degree',
            dataType: 'text',
            required: true,
            serviceId: 'education-verification-service',
            locationId: 'loc-1'
          },
          {
            id: 'field-uuid-3',
            name: 'Graduation Year',
            dataType: 'text',
            required: false,
            serviceId: 'education-verification-service',
            locationId: 'loc-1'
          }
        ],
        documents: []
      };

      // Call the callback with the requirements data
      if (callback) {
        callback(mockRequirementsData);
      }

      return mockRequirementsData;
    }),
    checkRequirements: vi.fn(),
    getRequiredFields: vi.fn(() => ({ subjectFields: [], searchFields: [], documents: [] })),
  }))
}));

// Mock the validation hook
vi.mock('../useOrderValidation', () => ({
  useOrderValidation: vi.fn(() => ({
    validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
    validateStep2: vi.fn(() => true),
    validateStep3: vi.fn(() => true),
    hasAddressBlockData: vi.fn(),
    convertSearchFieldsToNameBased: vi.fn(),
  }))
}));

describe('useOrderFormState - Draft Order DSX Field Values Bug', () => {
  let mockRouter: any;
  let mockSearchParams: any;
  let fetchMock: vi.Mock;

  beforeEach(() => {
    // Setup router mock
    mockRouter = {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);

    // Setup session mock
    (useSession as any).mockReturnValue({
      data: {
        user: {
          id: 'user-123',
          customerId: 'customer-123',
          email: 'test@example.com'
        }
      },
      status: 'authenticated'
    });

    // Setup fetch mock
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('REGRESSION TEST: DSX field values remapping', () => {
    it('REGRESSION TEST: proves bug fix for draft order DSX field values missing on edit', async () => {
      // This test currently FAILS (proving the bug exists) and will PASS after the fix
      // It expects field values to be keyed by field IDs (correct behavior)

      // Setup: Mock search params with edit order ID
      const editOrderId = 'order-with-dsx-fields';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock the order API response with DSX field values keyed by field names
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [
                    // This is how the API returns the data - keyed by field names
                    { fieldName: 'School Name', fieldValue: 'University of Washington' },
                    { fieldName: 'Degree', fieldValue: 'Bachelor of Science' },
                    { fieldName: 'Graduation Year', fieldValue: '2020' }
                  ]
                }
              ],
              subject: {
                firstName: 'John',
                lastName: 'Doe',
                dateOfBirth: '1990-01-01',
                email: 'john@example.com'
              },
              notes: 'Test education verification order'
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      // Render the hook
      const { result } = renderHook(() => useOrderFormState());

      // Wait for the order to be loaded
      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      // THE CRITICAL ASSERTION: Field values should be keyed by field IDs, not field names
      const searchFieldValues = result.current.searchFieldValues;

      // Find the itemId by looking at the searchFieldValues keys
      // The itemId is a generated UUID, so we need to get it from the actual result
      const itemIds = Object.keys(searchFieldValues);
      expect(itemIds).toHaveLength(1);
      const itemId = itemIds[0];

      // CORRECT BEHAVIOR: Values should be keyed by field IDs
      // This test will FAIL until the bug is fixed
      expect(searchFieldValues[itemId]).toEqual({
        'field-uuid-1': 'University of Washington',  // Mapped from "School Name"
        'field-uuid-2': 'Bachelor of Science',       // Mapped from "Degree"
        'field-uuid-3': '2020'                       // Mapped from "Graduation Year"
      });
    });

    it('should only include fields that exist in requirements (correct behavior)', async () => {
      // Edge case: API returns a field value for a field that doesn't exist in requirements
      // These should be filtered out when mapping to field IDs

      const editOrderId = 'order-with-unknown-field';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [
                    { fieldName: 'School Name', fieldValue: 'MIT' },
                    // This field doesn't exist in the requirements
                    { fieldName: 'Unknown Field', fieldValue: 'Some Value' },
                    { fieldName: 'Degree', fieldValue: 'PhD' }
                  ]
                }
              ],
              subject: {},
              notes: ''
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);
      const itemId = itemIds[0];

      // After the fix, it should only include fields that exist in requirements
      // This test will FAIL until the bug is fixed
      expect(searchFieldValues[itemId]).toEqual({
        'field-uuid-1': 'MIT',    // School Name mapped
        'field-uuid-2': 'PhD',     // Degree mapped
        // Unknown Field is ignored since it doesn't exist in requirements
      });
    });

    it('should handle empty data array in order items', async () => {
      // Edge case: Order item has no data array or empty data array

      const editOrderId = 'order-with-no-data';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [] // Empty data array
                }
              ],
              subject: {},
              notes: ''
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);
      const itemId = itemIds[0];

      // Should have an empty object for the item since no data was provided
      expect(searchFieldValues[itemId]).toEqual({});
    });

    it('should handle multiple order items with different search fields', async () => {
      // Test multiple services each with their own search fields

      const editOrderId = 'order-with-multiple-services';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [
                    { fieldName: 'School Name', fieldValue: 'Stanford' },
                    { fieldName: 'Degree', fieldValue: 'MS Computer Science' }
                  ]
                },
                {
                  id: 'item-2',
                  service: {
                    id: 'employment-verification-service',
                    name: 'Employment Verification'
                  },
                  location: {
                    id: 'loc-2',
                    name: 'Canada'
                  },
                  data: [
                    { fieldName: 'Company Name', fieldValue: 'Tech Corp' },
                    { fieldName: 'Position', fieldValue: 'Senior Engineer' }
                  ]
                }
              ],
              subject: {},
              notes: ''
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      const searchFieldValues = result.current.searchFieldValues;

      // Get the item IDs - they are generated UUIDs
      const itemIds = Object.keys(searchFieldValues);
      expect(itemIds).toHaveLength(2);

      // CORRECT BEHAVIOR: fields should be keyed by UUIDs
      // This test will FAIL until the bug is fixed
      expect(searchFieldValues[itemIds[0]]).toEqual({
        'field-uuid-1': 'Stanford',          // School Name mapped
        'field-uuid-2': 'MS Computer Science' // Degree mapped
      });

      // Note: item-2 would need different field UUIDs based on its requirements
      // Since our mock only provides education fields, employment fields won't map
      expect(searchFieldValues[itemIds[1]]).toEqual({});
    });

    it('should preserve original behavior for orders without search field data', async () => {
      // Ensure the fix doesn't break orders that have no search field data

      const editOrderId = 'order-without-search-fields';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'background-check-service',
                    name: 'Background Check'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  }
                  // No data property at all
                }
              ],
              subject: {
                firstName: 'Jane',
                lastName: 'Smith'
              },
              notes: 'Simple background check'
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      // Should not crash and should handle missing data gracefully
      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);
      expect(itemIds).toHaveLength(1);
      const itemId = itemIds[0];

      // Should have an empty object for the item
      expect(searchFieldValues[itemId]).toEqual({});

      // Order should still load successfully
      expect(result.current.notes).toBe('Simple background check');
      expect(result.current.subjectInfo.firstName).toBe('Jane');
      expect(result.current.subjectInfo.lastName).toBe('Smith');
    });

    it('should handle case-sensitive field name matching', async () => {
      // Test that field name matching is case-sensitive (exact match required)

      const editOrderId = 'order-with-case-mismatch';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [
                    // These have different casing than the field definitions
                    { fieldName: 'school name', fieldValue: 'Yale' },  // lowercase
                    { fieldName: 'DEGREE', fieldValue: 'MBA' }         // uppercase
                  ]
                }
              ],
              subject: {},
              notes: ''
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);
      const itemId = itemIds[0];

      // After the fix with exact match requirement, these won't map to UUID fields
      // since "school name" !== "School Name" and "DEGREE" !== "Degree"
      // This test will FAIL until the bug is fixed
      expect(searchFieldValues[itemId]).toEqual({});
    });
  });

  describe('Happy path behavior (correct state)', () => {
    it('should load order with DSX field values keyed by field IDs (correct behavior)', async () => {
      // This test expects the correct behavior with field values keyed by UUIDs
      // It will FAIL until the bug is fixed

      const editOrderId = 'complete-order';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes(`/api/portal/orders/${editOrderId}`)) {
          return {
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  id: 'item-1',
                  service: {
                    id: 'education-verification-service',
                    name: 'Education Verification'
                  },
                  location: {
                    id: 'loc-1',
                    name: 'United States'
                  },
                  data: [
                    { fieldName: 'School Name', fieldValue: 'Harvard University' },
                    { fieldName: 'Degree', fieldValue: 'JD' },
                    { fieldName: 'Graduation Year', fieldValue: '2018' }
                  ]
                }
              ],
              subject: {
                firstName: 'Alice',
                lastName: 'Johnson',
                dateOfBirth: '1992-05-15',
                email: 'alice@example.com',
                phone: '555-0123'
              },
              notes: 'Please verify education credentials'
            })
          };
        }
        if (url.includes('/api/customers/customer-123/packages')) {
          return {
            ok: true,
            json: async () => []
          };
        }
        return { ok: false, status: 404 };
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      }, { timeout: 3000 });

      // Verify all data is loaded correctly
      expect(result.current.isEditMode).toBe(true);
      expect(result.current.step).toBe(2); // Should start at step 2 for edit mode
      expect(result.current.notes).toBe('Please verify education credentials');

      // Verify subject info (note: the hook doesn't set default values for missing fields)
      expect(result.current.subjectInfo.firstName).toBe('Alice');
      expect(result.current.subjectInfo.lastName).toBe('Johnson');
      expect(result.current.subjectInfo.dateOfBirth).toBe('1992-05-15');
      expect(result.current.subjectInfo.email).toBe('alice@example.com');
      expect(result.current.subjectInfo.phone).toBe('555-0123');

      // Verify search field values should be keyed by field IDs
      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);
      const itemId = itemIds[0];

      // CORRECT BEHAVIOR: expect field values keyed by UUIDs
      // This test will FAIL until the bug is fixed
      expect(searchFieldValues[itemId]).toEqual({
        'field-uuid-1': 'Harvard University',
        'field-uuid-2': 'JD',
        'field-uuid-3': '2018'
      });
    });
  });
});