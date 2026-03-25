// /GlobalRx_v2/src/components/portal/orders/hooks/__tests__/useOrderFormState.address-block-bug.test.ts

// REGRESSION TEST: proves bug fix for address block field restoration
// Bug: When loading draft orders with address_block fields, the values are stored as JSON strings
// but not parsed back into objects, causing AddressBlockInput components to fail.
// Location: useOrderFormState.ts line 385 in loadOrderForEdit callback
// Root cause: fieldValue is assigned directly without checking if it's a JSON string that needs parsing

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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

// Mock the requirements hook with callback support
const mockFetchRequirementsForEdit = vi.fn();
vi.mock('../useOrderRequirements', () => ({
  useOrderRequirements: vi.fn(() => ({
    requirements: {
      subjectFields: [],
      searchFields: [],
      documents: []
    },
    fetchRequirements: vi.fn(),
    fetchRequirementsForEdit: mockFetchRequirementsForEdit,
    checkRequirements: vi.fn(),
    getRequiredFields: vi.fn(() => ({ subjectFields: [], searchFields: [], documents: [] })),
  }))
}));

// Mock the validation hook
vi.mock('../useOrderValidation', () => ({
  useOrderValidation: vi.fn(() => ({
    isStepComplete: vi.fn(() => true),
    validateStep1: vi.fn(() => ({ isValid: true, errors: {} })),
    validateStep2: vi.fn(() => true),
    validateStep3: vi.fn(() => true),
    hasAddressBlockData: vi.fn(),
  }))
}));

describe('useOrderFormState - Address Block Field Restoration Bug', () => {
  let mockRouter: any;
  let mockSearchParams: any;
  let fetchMock: vi.Mock;

  beforeEach(() => {
    // Clear sessionStorage
    sessionStorage.clear();

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

    // Reset mock implementation
    mockFetchRequirementsForEdit.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('REGRESSION TEST: Address block values must be parsed from JSON strings', () => {
    it('should parse address_block field values from JSON strings to objects when loading draft order', async () => {
      // This test FAILS before the fix (expects objects but gets strings)
      // This test PASSES after the fix (gets properly parsed objects)

      const editOrderId = 'order-with-address-blocks';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // Mock API response with address_block data stored as JSON strings
      // This is how the data actually comes from the API for draft orders
      const addressData1 = {
        street1: '123 Main St',
        street2: 'Apt 4B',
        city: 'Boston',
        state: 'MA',
        postalCode: '02134',
        country: 'USA'
      };

      const addressData2 = {
        street1: '456 Elm Ave',
        city: 'Cambridge',
        state: 'MA',
        postalCode: '02139'
      };

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Background Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    {
                      fieldName: 'Current Address',
                      // BUG: This is stored as a JSON string in the database
                      fieldValue: JSON.stringify(addressData1)
                    },
                    {
                      fieldName: 'Previous Address',
                      // BUG: This is also stored as a JSON string
                      fieldValue: JSON.stringify(addressData2)
                    },
                    {
                      fieldName: 'SSN',
                      // Regular text fields are stored as plain strings (correct)
                      fieldValue: '123-45-6789'
                    }
                  ]
                }
              ],
              subject: {
                firstName: 'John',
                lastName: 'Doe'
              },
              notes: 'Test order with address blocks'
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              services: []
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      // Mock requirements with address_block fields
      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        // Simulate calling the callback with requirements data
        setTimeout(() => {
          callback({
            searchFields: [
              {
                id: 'field-uuid-1',
                name: 'Current Address',
                dataType: 'address_block',  // This is an address_block field
                required: true
              },
              {
                id: 'field-uuid-2',
                name: 'Previous Address',
                dataType: 'address_block',  // This is also an address_block field
                required: false
              },
              {
                id: 'field-uuid-3',
                name: 'SSN',
                dataType: 'text',  // Regular text field
                required: true
              }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      // Wait for the order to load and requirements to be fetched
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      // Wait for requirements callback to be called and state to update
      await waitFor(() => {
        expect(mockFetchRequirementsForEdit).toHaveBeenCalled();
      });

      // Give time for the callback to execute and state to update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // CRITICAL ASSERTION: After the fix, address_block values should be objects, not strings
      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // This assertion FAILS before the fix (gets a string instead of object)
      // This assertion PASSES after the fix (gets properly parsed object)
      expect(searchFieldValues[itemId]['field-uuid-1']).toEqual(addressData1);
      expect(typeof searchFieldValues[itemId]['field-uuid-1']).toBe('object');
      expect(searchFieldValues[itemId]['field-uuid-1'].street1).toBe('123 Main St');
      expect(searchFieldValues[itemId]['field-uuid-1'].city).toBe('Boston');
      expect(searchFieldValues[itemId]['field-uuid-1'].postalCode).toBe('02134');

      // Second address block should also be an object
      expect(searchFieldValues[itemId]['field-uuid-2']).toEqual(addressData2);
      expect(typeof searchFieldValues[itemId]['field-uuid-2']).toBe('object');
      expect(searchFieldValues[itemId]['field-uuid-2'].street1).toBe('456 Elm Ave');
      expect(searchFieldValues[itemId]['field-uuid-2'].city).toBe('Cambridge');

      // Regular text field should remain a string (no parsing needed)
      expect(searchFieldValues[itemId]['field-uuid-3']).toBe('123-45-6789');
      expect(typeof searchFieldValues[itemId]['field-uuid-3']).toBe('string');
    });
  });

  describe('Happy path tests', () => {
    it('should correctly handle multiple address blocks in a single order', async () => {
      const editOrderId = 'order-multiple-address-blocks';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const homeAddress = {
        street1: '789 Oak St',
        city: 'Somerville',
        state: 'MA',
        postalCode: '02144'
      };

      const workAddress = {
        street1: '100 Business Park',
        street2: 'Suite 200',
        city: 'Waltham',
        state: 'MA',
        postalCode: '02451'
      };

      const schoolAddress = {
        street1: '1 University Ave',
        city: 'Cambridge',
        state: 'MA',
        postalCode: '02138'
      };

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Comprehensive Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    { fieldName: 'Home Address', fieldValue: JSON.stringify(homeAddress) },
                    { fieldName: 'Work Address', fieldValue: JSON.stringify(workAddress) },
                    { fieldName: 'School Address', fieldValue: JSON.stringify(schoolAddress) },
                    { fieldName: 'Employer Name', fieldValue: 'Tech Corp' }
                  ]
                }
              ],
              subject: { firstName: 'Jane', lastName: 'Smith' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'home-addr-id', name: 'Home Address', dataType: 'address_block' },
              { id: 'work-addr-id', name: 'Work Address', dataType: 'address_block' },
              { id: 'school-addr-id', name: 'School Address', dataType: 'address_block' },
              { id: 'employer-id', name: 'Employer Name', dataType: 'text' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // All three address blocks should be properly parsed objects
      expect(searchFieldValues[itemId]['home-addr-id']).toEqual(homeAddress);
      expect(searchFieldValues[itemId]['work-addr-id']).toEqual(workAddress);
      expect(searchFieldValues[itemId]['school-addr-id']).toEqual(schoolAddress);

      // Text field remains a string
      expect(searchFieldValues[itemId]['employer-id']).toBe('Tech Corp');
    });

    it('should handle address blocks across multiple service items', async () => {
      const editOrderId = 'order-multiple-services';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const service1Address = {
        street1: '111 First St',
        city: 'Boston',
        postalCode: '02101'
      };

      const service2Address = {
        street1: '222 Second Ave',
        city: 'Quincy',
        postalCode: '02169'
      };

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Criminal Check' },
                  location: { id: 'loc-1', name: 'Massachusetts' },
                  data: [
                    { fieldName: 'Address', fieldValue: JSON.stringify(service1Address) }
                  ]
                },
                {
                  service: { id: 'service-2', name: 'Employment Verification' },
                  location: { id: 'loc-2', name: 'Massachusetts' },
                  data: [
                    { fieldName: 'Company Address', fieldValue: JSON.stringify(service2Address) }
                  ]
                }
              ],
              subject: { firstName: 'Bob', lastName: 'Johnson' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'addr-field-1', name: 'Address', dataType: 'address_block', serviceId: 'service-1' },
              { id: 'comp-addr-field', name: 'Company Address', dataType: 'address_block', serviceId: 'service-2' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemIds = Object.keys(searchFieldValues);

      // Each service item should have its own address block properly parsed
      expect(searchFieldValues[itemIds[0]]['addr-field-1']).toEqual(service1Address);
      expect(searchFieldValues[itemIds[1]]['comp-addr-field']).toEqual(service2Address);
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON in address_block fields gracefully', async () => {
      const editOrderId = 'order-malformed-json';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Background Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    {
                      fieldName: 'Bad JSON Address',
                      fieldValue: '{invalid json}' // Malformed JSON
                    },
                    {
                      fieldName: 'Good Address',
                      fieldValue: JSON.stringify({ street1: '123 Valid St', city: 'Boston' })
                    }
                  ]
                }
              ],
              subject: { firstName: 'Test', lastName: 'User' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'bad-json-field', name: 'Bad JSON Address', dataType: 'address_block' },
              { id: 'good-addr-field', name: 'Good Address', dataType: 'address_block' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // Malformed JSON should be kept as string (fallback behavior)
      expect(searchFieldValues[itemId]['bad-json-field']).toBe('{invalid json}');

      // Valid JSON should be parsed correctly
      expect(searchFieldValues[itemId]['good-addr-field']).toEqual({
        street1: '123 Valid St',
        city: 'Boston'
      });
    });

    it('should handle empty strings and null values in address_block fields', async () => {
      const editOrderId = 'order-empty-values';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Background Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    { fieldName: 'Empty Address', fieldValue: '' },
                    { fieldName: 'Null Address', fieldValue: null },
                    { fieldName: 'Empty Object', fieldValue: '{}' },
                    { fieldName: 'Valid Address', fieldValue: JSON.stringify({ street1: '456 Test St' }) }
                  ]
                }
              ],
              subject: { firstName: 'Test', lastName: 'User' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'empty-field', name: 'Empty Address', dataType: 'address_block' },
              { id: 'null-field', name: 'Null Address', dataType: 'address_block' },
              { id: 'empty-obj-field', name: 'Empty Object', dataType: 'address_block' },
              { id: 'valid-field', name: 'Valid Address', dataType: 'address_block' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // Empty string should remain empty
      expect(searchFieldValues[itemId]['empty-field']).toBe('');

      // Null should be handled (either null or undefined)
      expect(searchFieldValues[itemId]['null-field']).toBeUndefined();

      // Empty object should be parsed as empty object
      expect(searchFieldValues[itemId]['empty-obj-field']).toEqual({});

      // Valid address should be parsed
      expect(searchFieldValues[itemId]['valid-field']).toEqual({ street1: '456 Test St' });
    });

    it('should handle mix of address_block and regular text fields correctly', async () => {
      const editOrderId = 'order-mixed-fields';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const addressData = {
        street1: '999 Mixed St',
        city: 'Medford',
        postalCode: '02155'
      };

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Mixed Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    { fieldName: 'Name', fieldValue: 'John Doe' },
                    { fieldName: 'Current Address', fieldValue: JSON.stringify(addressData) },
                    { fieldName: 'Email', fieldValue: 'john@example.com' },
                    { fieldName: 'Previous Address', fieldValue: JSON.stringify({ street1: '888 Old St' }) },
                    { fieldName: 'Phone', fieldValue: '555-0123' },
                    { fieldName: 'Date', fieldValue: '2024-01-15' },
                    { fieldName: 'School Address', fieldValue: JSON.stringify({ street1: '777 Campus Dr' }) }
                  ]
                }
              ],
              subject: { firstName: 'John', lastName: 'Doe' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'name-field', name: 'Name', dataType: 'text' },
              { id: 'curr-addr-field', name: 'Current Address', dataType: 'address_block' },
              { id: 'email-field', name: 'Email', dataType: 'email' },
              { id: 'prev-addr-field', name: 'Previous Address', dataType: 'address_block' },
              { id: 'phone-field', name: 'Phone', dataType: 'phone' },
              { id: 'date-field', name: 'Date', dataType: 'date' },
              { id: 'school-addr-field', name: 'School Address', dataType: 'address_block' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // Text fields should remain as strings
      expect(searchFieldValues[itemId]['name-field']).toBe('John Doe');
      expect(typeof searchFieldValues[itemId]['name-field']).toBe('string');

      expect(searchFieldValues[itemId]['email-field']).toBe('john@example.com');
      expect(typeof searchFieldValues[itemId]['email-field']).toBe('string');

      expect(searchFieldValues[itemId]['phone-field']).toBe('555-0123');
      expect(typeof searchFieldValues[itemId]['phone-field']).toBe('string');

      expect(searchFieldValues[itemId]['date-field']).toBe('2024-01-15');
      expect(typeof searchFieldValues[itemId]['date-field']).toBe('string');

      // Address blocks should be parsed to objects
      expect(searchFieldValues[itemId]['curr-addr-field']).toEqual(addressData);
      expect(typeof searchFieldValues[itemId]['curr-addr-field']).toBe('object');

      expect(searchFieldValues[itemId]['prev-addr-field']).toEqual({ street1: '888 Old St' });
      expect(typeof searchFieldValues[itemId]['prev-addr-field']).toBe('object');

      expect(searchFieldValues[itemId]['school-addr-field']).toEqual({ street1: '777 Campus Dr' });
      expect(typeof searchFieldValues[itemId]['school-addr-field']).toBe('object');
    });

    it('should handle address_block fields when field type is not specified in requirements', async () => {
      const editOrderId = 'order-no-datatype';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      const addressData = { street1: '321 Unknown Type St', city: 'Mystery' };

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    { fieldName: 'Unknown Type Field', fieldValue: JSON.stringify(addressData) },
                    { fieldName: 'Regular Field', fieldValue: 'Just text' }
                  ]
                }
              ],
              subject: { firstName: 'Test', lastName: 'User' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'unknown-field', name: 'Unknown Type Field' }, // No dataType specified
              { id: 'regular-field', name: 'Regular Field', dataType: 'text' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // When dataType is not specified, the fix should detect JSON strings and parse them
      // This ensures backward compatibility and handles edge cases
      expect(searchFieldValues[itemId]['unknown-field']).toEqual(addressData);
      expect(typeof searchFieldValues[itemId]['unknown-field']).toBe('object');

      // Regular field remains a string
      expect(searchFieldValues[itemId]['regular-field']).toBe('Just text');
    });
  });

  describe('Verify fix does not break existing functionality', () => {
    it('should still correctly handle regular text fields', async () => {
      const editOrderId = 'order-text-only';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Text Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    { fieldName: 'Full Name', fieldValue: 'John Michael Doe' },
                    { fieldName: 'SSN', fieldValue: '123-45-6789' },
                    { fieldName: 'License Number', fieldValue: 'D123456789' },
                    { fieldName: 'Notes', fieldValue: 'This is a longer text field with spaces and punctuation!' }
                  ]
                }
              ],
              subject: { firstName: 'John', lastName: 'Doe' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'name-field', name: 'Full Name', dataType: 'text' },
              { id: 'ssn-field', name: 'SSN', dataType: 'text' },
              { id: 'license-field', name: 'License Number', dataType: 'text' },
              { id: 'notes-field', name: 'Notes', dataType: 'textarea' }
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // All text fields should remain as strings exactly as they were
      expect(searchFieldValues[itemId]['name-field']).toBe('John Michael Doe');
      expect(searchFieldValues[itemId]['ssn-field']).toBe('123-45-6789');
      expect(searchFieldValues[itemId]['license-field']).toBe('D123456789');
      expect(searchFieldValues[itemId]['notes-field']).toBe('This is a longer text field with spaces and punctuation!');

      // Verify they are all strings
      Object.values(searchFieldValues[itemId]).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });

    it('should handle fields that look like JSON but are actually text', async () => {
      const editOrderId = 'order-json-like-text';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      fetchMock.mockImplementation((url) => {
        if (url === `/api/portal/orders/${editOrderId}`) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: editOrderId,
              statusCode: 'draft',
              items: [
                {
                  service: { id: 'service-1', name: 'Special Check' },
                  location: { id: 'loc-1', name: 'United States' },
                  data: [
                    // These look like JSON but are meant to be stored as text
                    { fieldName: 'Config String', fieldValue: '{"debug": true}' },
                    { fieldName: 'Array String', fieldValue: '["item1", "item2"]' },
                    // This is an actual address block
                    { fieldName: 'Address', fieldValue: JSON.stringify({ street1: '100 Real St' }) }
                  ]
                }
              ],
              subject: { firstName: 'Test', lastName: 'User' },
              notes: ''
            })
          });
        } else if (url === '/api/portal/services') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ services: [] })
          });
        }
        return Promise.resolve({ ok: false });
      });

      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        setTimeout(() => {
          callback({
            searchFields: [
              { id: 'config-field', name: 'Config String', dataType: 'text' }, // Explicitly text
              { id: 'array-field', name: 'Array String', dataType: 'text' },   // Explicitly text
              { id: 'addr-field', name: 'Address', dataType: 'address_block' } // Address block
            ],
            subjectFields: [],
            documents: []
          });
        }, 0);
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(`/api/portal/orders/${editOrderId}`);
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const searchFieldValues = result.current.searchFieldValues;
      const itemId = Object.keys(searchFieldValues)[0];

      // JSON-like strings in text fields should remain as strings
      expect(searchFieldValues[itemId]['config-field']).toBe('{"debug": true}');
      expect(typeof searchFieldValues[itemId]['config-field']).toBe('string');

      expect(searchFieldValues[itemId]['array-field']).toBe('["item1", "item2"]');
      expect(typeof searchFieldValues[itemId]['array-field']).toBe('string');

      // Only address_block fields should be parsed
      expect(searchFieldValues[itemId]['addr-field']).toEqual({ street1: '100 Real St' });
      expect(typeof searchFieldValues[itemId]['addr-field']).toBe('object');
    });
  });
});