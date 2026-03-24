// REGRESSION TEST: proves bug fix for subject-level address block field restoration
// Subject address blocks (like Residence Address) must be saved to order_data and restored as objects

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useOrderFormState } from '../useOrderFormState';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
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

describe('useOrderFormState - Subject-Level Address Block Restoration', () => {
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

  describe('REGRESSION TEST: Subject address block values must be parsed from JSON strings', () => {
    it('should parse subject address_block field values from JSON strings to objects when loading draft order', async () => {
      const editOrderId = 'order-with-subject-address';
      mockSearchParams = new URLSearchParams(`?edit=${editOrderId}`);
      mockSearchParams.get = vi.fn((key: string) => key === 'edit' ? editOrderId : null);
      (useSearchParams as any).mockReturnValue(mockSearchParams);

      // The address data as it would be stored
      const residenceAddress = {
        street1: '3164 17TH ST N',
        street2: 'Unit 5B',
        city: 'Arlington',
        state: 'VA',
        postalCode: '22201',
        country: 'USA'
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
                    // Subject field stored with fieldType: 'subject'
                    {
                      fieldName: 'residence-addr-uuid', // Field UUID
                      fieldValue: JSON.stringify(residenceAddress), // Stored as JSON string
                      fieldType: 'subject'
                    }
                  ]
                }
              ],
              subject: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com',
                // Note: address field might be flattened string from normalizeSubjectData
                address: '3164 17TH ST N, Arlington, 22201'
              },
              notes: 'Test order'
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

      // Mock requirements with subject address_block field
      mockFetchRequirementsForEdit.mockImplementation((serviceItems, orderId, callback) => {
        // Simulate calling the callback with requirements data
        setTimeout(() => {
          callback({
            subjectFields: [
              {
                id: 'residence-addr-uuid',
                name: 'Residence Address',
                dataType: 'address_block',
                isRequired: false,
                collectionTab: 'subject'
              }
            ],
            searchFields: [],
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

      // CRITICAL ASSERTION: After the fix, subject address_block values should be objects, not strings
      const subjectFieldValues = result.current.subjectFieldValues;

      // The key assertion: subject address block should be parsed from JSON string to object
      // Field is keyed by UUID (residence-addr-uuid)
      expect(subjectFieldValues['residence-addr-uuid']).toEqual(residenceAddress);
      expect(typeof subjectFieldValues['residence-addr-uuid']).toBe('object');
      expect(subjectFieldValues['residence-addr-uuid'].street1).toBe('3164 17TH ST N');
      expect(subjectFieldValues['residence-addr-uuid'].city).toBe('Arlington');
      expect(subjectFieldValues['residence-addr-uuid'].postalCode).toBe('22201');
    });
  });

  // Additional test cases can be added here following the same pattern
  describe.skip('Subject field saving and restoration', () => {
    it('should handle multiple subject fields including address blocks', async () => {
      const orderId = 'order-456';
      const itemId = 'service-789-location-012-1234567890';

      // Mock useSearchParams to return the orderId
      const { useSearchParams } = await import('next/navigation');
      vi.mocked(useSearchParams).mockReturnValue({
        get: vi.fn((key: string) => key === 'edit' ? orderId : null),
      } as any);

      const workAddress = {
        street1: '100 Business Blvd',
        city: 'Boston',
        state: 'MA',
        postalCode: '02134'
      };

      const mockOrderResponse = {
        id: orderId,
        orderNumber: 'ORD-2024-002',
        statusCode: 'draft',
        customerId: 'cust-123',
        subject: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '555-1234'
        },
        items: [{
          id: 'item-456',
          serviceId: 'service-789',
          locationId: 'location-012',
          data: [
            // Multiple subject fields
            {
              fieldName: 'custom-phone-uuid',
              fieldValue: '555-9876', // Regular text field
              fieldType: 'subject'
            },
            {
              fieldName: 'work-addr-uuid',
              fieldValue: JSON.stringify(workAddress), // Address block
              fieldType: 'subject'
            },
            {
              fieldName: 'custom-notes-uuid',
              fieldValue: 'Additional notes',
              fieldType: 'subject'
            }
          ]
        }],
        notes: ''
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes(`/api/portal/orders/${orderId}`)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      const mockRequirementsHook = {
        requirements: null,
        fetchRequirementsForEdit: vi.fn((serviceItems, orderId, callback) => {
          callback({
            subjectFields: [
              {
                id: 'custom-phone-uuid',
                name: 'Alternate Phone',
                dataType: 'text',
                isRequired: false,
                collectionTab: 'subject'
              },
              {
                id: 'work-addr-uuid',
                name: 'Work Address',
                dataType: 'address_block',
                isRequired: false,
                collectionTab: 'subject'
              },
              {
                id: 'custom-notes-uuid',
                name: 'Additional Notes',
                dataType: 'text',
                isRequired: false,
                collectionTab: 'subject'
              }
            ],
            searchFields: []
          });
        }),
      };

      const { useOrderRequirements } = await import('../useOrderRequirements');
      vi.mocked(useOrderRequirements).mockReturnValue(mockRequirementsHook as any);

      const mockServiceCart = {
        serviceItems: [{
          serviceId: 'service-789',
          serviceName: 'Background Check',
          locationId: 'location-012',
          locationName: 'Canada',
          itemId,
        }],
        setCart: vi.fn(),
      };

      const { useServiceCart } = await import('../useServiceCart');
      vi.mocked(useServiceCart).mockReturnValue(mockServiceCart as any);

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      });

      await waitFor(() => {
        const { subjectFieldValues } = result.current;

        // Regular text field should be preserved as-is
        expect(subjectFieldValues['custom-phone-uuid']).toBe('555-9876');

        // Address block should be parsed to object
        expect(subjectFieldValues['work-addr-uuid']).toEqual(workAddress);
        expect(typeof subjectFieldValues['work-addr-uuid']).toBe('object');

        // Another text field
        expect(subjectFieldValues['custom-notes-uuid']).toBe('Additional notes');
      });
    });

    it('should handle empty/null subject address blocks gracefully', async () => {
      const orderId = 'order-789';
      const itemId = 'service-111-location-222-1234567890';

      // Mock useSearchParams to return the orderId
      const { useSearchParams: useSearchParams2 } = await import('next/navigation');
      vi.mocked(useSearchParams2).mockReturnValue({
        get: vi.fn((key: string) => key === 'edit' ? orderId : null),
      } as any);

      const mockOrderResponse = {
        id: orderId,
        orderNumber: 'ORD-2024-003',
        statusCode: 'draft',
        customerId: 'cust-123',
        subject: {
          firstName: 'Bob',
          lastName: 'Johnson'
        },
        items: [{
          id: 'item-789',
          serviceId: 'service-111',
          locationId: 'location-222',
          data: [
            {
              fieldName: 'home-addr-uuid',
              fieldValue: '', // Empty string
              fieldType: 'subject'
            },
            {
              fieldName: 'mail-addr-uuid',
              fieldValue: null, // Null value
              fieldType: 'subject'
            }
          ]
        }],
        notes: ''
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes(`/api/portal/orders/${orderId}`)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOrderResponse),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      });

      const mockRequirementsHook = {
        requirements: null,
        fetchRequirementsForEdit: vi.fn((serviceItems, orderId, callback) => {
          callback({
            subjectFields: [
              {
                id: 'home-addr-uuid',
                name: 'Home Address',
                dataType: 'address_block',
                isRequired: false,
                collectionTab: 'subject'
              },
              {
                id: 'mail-addr-uuid',
                name: 'Mailing Address',
                dataType: 'address_block',
                isRequired: false,
                collectionTab: 'subject'
              }
            ],
            searchFields: []
          });
        }),
      };

      const { useOrderRequirements: useOrderRequirements3 } = await import('../useOrderRequirements');
      vi.mocked(useOrderRequirements3).mockReturnValue(mockRequirementsHook as any);

      const mockServiceCart = {
        serviceItems: [{
          serviceId: 'service-111',
          serviceName: 'Reference Check',
          locationId: 'location-222',
          locationName: 'USA',
          itemId,
        }],
        setCart: vi.fn(),
      };

      const { useServiceCart: useServiceCart3 } = await import('../useServiceCart');
      vi.mocked(useServiceCart3).mockReturnValue(mockServiceCart as any);

      const { result } = renderHook(() => useOrderFormState());

      await waitFor(() => {
        expect(result.current.isLoadingOrder).toBe(false);
      });

      await waitFor(() => {
        const { subjectFieldValues } = result.current;

        // Empty string should remain empty
        expect(subjectFieldValues['home-addr-uuid']).toBe('');

        // Null should be converted to undefined for consistency
        expect(subjectFieldValues['mail-addr-uuid']).toBeUndefined();
      });
    });
  });
});