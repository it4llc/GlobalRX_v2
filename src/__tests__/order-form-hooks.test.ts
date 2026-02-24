import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrderValidation } from '../components/portal/orders/hooks/useOrderValidation';
import { useServiceCart } from '../components/portal/orders/hooks/useServiceCart';

describe('Order Form Hooks', () => {
  describe('useOrderValidation', () => {
    let validation: ReturnType<typeof useOrderValidation>;

    beforeEach(() => {
      const { result } = renderHook(() => useOrderValidation());
      validation = result.current;
    });

    describe('Step Validation', () => {
      it('should validate step 1 requires at least one service item', () => {
        const result = validation.validateStep1([]);
        expect(result.isValid).toBe(false);
        expect(result.errors.services).toBe('Please add at least one service to your order');
      });

      it('should validate step 1 passes with service items', () => {
        const serviceItems = [
          {
            serviceId: 'service-1',
            serviceName: 'Background Check',
            locationId: 'location-1',
            locationName: 'United States',
            itemId: 'service-1-location-1-123'
          }
        ];

        const result = validation.validateStep1(serviceItems);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
      });

      it('should allow navigation on steps 2 and 3', () => {
        expect(validation.validateStep2()).toBe(true);
        expect(validation.validateStep3()).toBe(true);
      });
    });

    describe('Address Block Validation', () => {
      it('should validate empty address blocks as invalid', () => {
        expect(validation.hasAddressBlockData(null)).toBe(false);
        expect(validation.hasAddressBlockData(undefined)).toBe(false);
        expect(validation.hasAddressBlockData({})).toBe(false);
        expect(validation.hasAddressBlockData({ street1: '', city: '', state: '', postalCode: '' })).toBe(false);
      });

      it('should validate address blocks with any data as valid', () => {
        expect(validation.hasAddressBlockData({ street1: '123 Main St', city: '', state: '', postalCode: '' })).toBe(true);
        expect(validation.hasAddressBlockData({ street1: '', city: 'Anytown', state: '', postalCode: '' })).toBe(true);
        expect(validation.hasAddressBlockData({ street1: '', city: '', state: 'CA', postalCode: '' })).toBe(true);
        expect(validation.hasAddressBlockData({ street1: '', city: '', state: '', postalCode: '90210' })).toBe(true);
      });

      it('should handle null/undefined values in address blocks', () => {
        expect(validation.hasAddressBlockData({ street1: null, city: undefined, state: '', postalCode: '   ' })).toBe(false);
        expect(validation.hasAddressBlockData({ street1: 'Valid Street', city: null, state: undefined, postalCode: '' })).toBe(true);
      });
    });

    describe('Missing Requirements Check', () => {
      const mockRequirements = {
        subjectFields: [
          { id: 'field-1', name: 'First Name', required: true, dataType: 'text' },
          { id: 'field-2', name: 'Address', required: true, dataType: 'address_block' },
          { id: 'field-3', name: 'Phone', required: false, dataType: 'text' }
        ],
        searchFields: [
          {
            id: 'search-1',
            name: 'Previous Address',
            required: true,
            dataType: 'address_block',
            serviceId: 'service-1',
            locationId: 'location-1'
          }
        ],
        documents: [
          { id: 'doc-1', name: 'ID Document', required: true, scope: 'per_case' }
        ]
      };

      const mockServiceItems = [
        {
          serviceId: 'service-1',
          serviceName: 'Background Check',
          locationId: 'location-1',
          locationName: 'United States',
          itemId: 'item-1'
        }
      ];

      it('should identify missing required fields correctly', () => {
        const result = validation.checkMissingRequirements(
          mockRequirements,
          mockServiceItems,
          { 'field-3': 'optional value' }, // Only optional field
          {},
          {}
        );

        expect(result.isValid).toBe(false);
        expect(result.missing.subjectFields).toHaveLength(2); // Missing field-1 and field-2
        expect(result.missing.searchFields).toHaveLength(1); // Missing search-1
        expect(result.missing.documents).toHaveLength(1); // Missing doc-1
      });

      it('should validate complete form correctly', () => {
        const result = validation.checkMissingRequirements(
          mockRequirements,
          mockServiceItems,
          {
            'field-1': 'John Doe',
            'field-2': { street1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210' }
          },
          {
            'item-1': {
              'search-1': { street1: '456 Old St', city: 'Previous City', state: 'CA', postalCode: '54321' }
            }
          },
          {
            'doc-1': new File(['content'], 'id.pdf', { type: 'application/pdf' })
          }
        );

        expect(result.isValid).toBe(true);
        expect(result.missing.subjectFields).toHaveLength(0);
        expect(result.missing.searchFields).toHaveLength(0);
        expect(result.missing.documents).toHaveLength(0);
      });
    });

    describe('Field Value Conversion', () => {
      const mockFields = [
        { id: 'field-1', name: 'First Name' },
        { id: 'field-2', name: 'Address Block' }
      ];

      it('should convert subject fields to name-based storage', () => {
        const fieldValues = {
          'field-1': 'John Doe',
          'field-2': { street1: '123 Main St', city: 'Anytown' },
          'field-3': '' // Empty value should be filtered out
        };

        const result = validation.convertSubjectFieldsToNameBased(fieldValues, mockFields);

        expect(result).toEqual({
          'First Name': 'John Doe',
          'Address Block': { street1: '123 Main St', city: 'Anytown' }
        });
      });

      it('should convert search fields to name-based storage', () => {
        const fieldValues = {
          'item-1': { 'field-1': 'Value 1' },
          'item-2': { 'field-2': 'Value 2' }
        };

        const result = validation.convertSearchFieldsToNameBased(fieldValues, mockFields);

        expect(result).toEqual({
          'item-1': { 'First Name': 'Value 1' },
          'item-2': { 'Address Block': 'Value 2' }
        });
      });
    });
  });

  describe('useServiceCart', () => {
    it('should initialize with empty cart', () => {
      const { result } = renderHook(() => useServiceCart());

      expect(result.current.serviceItems).toEqual([]);
      expect(result.current.itemCount).toBe(0);
    });

    it('should initialize with provided items', () => {
      const initialItems = [
        { serviceId: 'service-1', serviceName: 'Check', locationId: 'loc-1', locationName: 'US', itemId: 'item-1' }
      ];

      const { result } = renderHook(() => useServiceCart(initialItems));

      expect(result.current.serviceItems).toEqual(initialItems);
      expect(result.current.itemCount).toBe(1);
    });

    it('should add service to cart', () => {
      const { result } = renderHook(() => useServiceCart());
      const service = { id: 'service-1', name: 'Background Check', category: 'Criminal' };

      act(() => {
        const newItem = result.current.addServiceToCart(service, 'location-1', 'United States');
        expect(newItem.serviceId).toBe('service-1');
        expect(newItem.serviceName).toBe('Background Check');
        expect(newItem.locationId).toBe('location-1');
        expect(newItem.locationName).toBe('United States');
        expect(newItem.itemId).toMatch(/^service-1-location-1-\d+-\d+$/);
      });

      expect(result.current.serviceItems).toHaveLength(1);
      expect(result.current.itemCount).toBe(1);
    });

    it('should allow duplicate service+location pairs', () => {
      const { result } = renderHook(() => useServiceCart());
      const service = { id: 'service-1', name: 'Employment Check', category: 'Employment' };

      act(() => {
        result.current.addServiceToCart(service, 'location-1', 'US');
      });

      act(() => {
        result.current.addServiceToCart(service, 'location-1', 'US');
      });

      expect(result.current.serviceItems).toHaveLength(2);
      expect(result.current.serviceItems[0].itemId).not.toBe(result.current.serviceItems[1].itemId);
    });

    it('should remove service from cart by item ID', () => {
      const initialItems = [
        { serviceId: 'service-1', serviceName: 'Check 1', locationId: 'loc-1', locationName: 'US', itemId: 'item-1' },
        { serviceId: 'service-2', serviceName: 'Check 2', locationId: 'loc-2', locationName: 'CA', itemId: 'item-2' }
      ];

      const { result } = renderHook(() => useServiceCart(initialItems));

      act(() => {
        result.current.removeServiceFromCart('item-1');
      });

      expect(result.current.serviceItems).toHaveLength(1);
      expect(result.current.serviceItems[0].itemId).toBe('item-2');
    });

    it('should clear entire cart', () => {
      const initialItems = [
        { serviceId: 'service-1', serviceName: 'Check 1', locationId: 'loc-1', locationName: 'US', itemId: 'item-1' },
        { serviceId: 'service-2', serviceName: 'Check 2', locationId: 'loc-2', locationName: 'CA', itemId: 'item-2' }
      ];

      const { result } = renderHook(() => useServiceCart(initialItems));

      act(() => {
        result.current.clearCart();
      });

      expect(result.current.serviceItems).toEqual([]);
      expect(result.current.itemCount).toBe(0);
    });

    it('should check for service+location existence', () => {
      const initialItems = [
        { serviceId: 'service-1', serviceName: 'Check', locationId: 'location-1', locationName: 'US', itemId: 'item-1' }
      ];

      const { result } = renderHook(() => useServiceCart(initialItems));

      expect(result.current.hasServiceLocation('service-1', 'location-1')).toBe(true);
      expect(result.current.hasServiceLocation('service-1', 'location-2')).toBe(false);
      expect(result.current.hasServiceLocation('service-2', 'location-1')).toBe(false);
    });

    it('should count service+location instances', () => {
      const initialItems = [
        { serviceId: 'service-1', serviceName: 'Check', locationId: 'location-1', locationName: 'US', itemId: 'item-1' },
        { serviceId: 'service-1', serviceName: 'Check', locationId: 'location-1', locationName: 'US', itemId: 'item-2' },
        { serviceId: 'service-1', serviceName: 'Check', locationId: 'location-2', locationName: 'CA', itemId: 'item-3' }
      ];

      const { result } = renderHook(() => useServiceCart(initialItems));

      expect(result.current.getServiceLocationCount('service-1', 'location-1')).toBe(2);
      expect(result.current.getServiceLocationCount('service-1', 'location-2')).toBe(1);
      expect(result.current.getServiceLocationCount('service-2', 'location-1')).toBe(0);
    });
  });
});