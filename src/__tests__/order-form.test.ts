import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test utilities for order form logic
// These tests capture the existing behavior before we extract it

describe('Order Form Business Logic', () => {
  describe('Order Form Step Validation', () => {
    it('should validate step 1 requires at least one service item', () => {
      const serviceItems: any[] = [];
      const result = validateStep1Logic(serviceItems);

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

      const result = validateStep1Logic(serviceItems);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should validate step 2 and 3 allow navigation without blocking', () => {
      // Steps 2 and 3 should always return true for navigation
      // Real validation happens at submission time
      expect(validateStep2Logic()).toBe(true);
      expect(validateStep3Logic()).toBe(true);
    });
  });

  describe('Missing Requirements Validation', () => {
    const mockRequirements = {
      subjectFields: [
        { id: 'field-1', name: 'First Name', required: true, dataType: 'text' },
        { id: 'field-2', name: 'Street Address', required: true, dataType: 'address_block' },
        { id: 'field-3', name: 'Phone', required: false, dataType: 'text' },
        { id: 'field-4', name: 'City', required: false, dataType: 'text' },
        { id: 'field-5', name: 'State', required: true, dataType: 'text' }
      ],
      searchFields: [
        {
          id: 'search-1',
          name: 'Previous Address',
          required: true,
          dataType: 'address_block',
          serviceId: 'service-1',
          locationId: 'location-1'
        },
        {
          id: 'search-2',
          name: 'Employment History',
          required: false,
          dataType: 'text',
          serviceId: 'service-1',
          locationId: 'location-1'
        }
      ],
      documents: [
        { id: 'doc-1', name: 'ID Document', required: true, scope: 'per_case' },
        { id: 'doc-2', name: 'Optional Document', required: false, scope: 'per_case' }
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

    it('should identify missing required subject fields', () => {
      const subjectFieldValues = {
        'field-3': 'optional field value', // Only optional field filled
        'field-4': 'city value' // Optional city filled
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        subjectFieldValues,
        {},
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.missing.subjectFields).toHaveLength(3); // Missing field-1, field-2, and field-5
      expect(result.missing.subjectFields.map(f => f.fieldName)).toContain('First Name');
      expect(result.missing.subjectFields.map(f => f.fieldName)).toContain('Street Address');
      expect(result.missing.subjectFields.map(f => f.fieldName)).toContain('State');
    });

    it('should handle address block validation for individual fields', () => {
      const subjectFieldValues = {
        'field-1': 'John Doe',
        'field-2': '', // Empty address block field that is required
        'field-5': 'NY'
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        subjectFieldValues,
        {},
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.missing.subjectFields.some(f => f.fieldName === 'Street Address')).toBe(true);
    });

    it('should handle complex address block objects correctly', () => {
      const subjectFieldValues = {
        'field-1': 'John Doe',
        'field-2': { street1: '', city: '', state: '', postalCode: '' }, // Empty address object
        'field-5': 'NY'
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        subjectFieldValues,
        {},
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.missing.subjectFields.some(f => f.fieldName === 'Street Address')).toBe(true);
    });

    it('should validate filled address blocks as complete', () => {
      const subjectFieldValues = {
        'field-1': 'John Doe',
        'field-2': { street1: '123 Main St', city: 'Anytown', state: 'NY', postalCode: '12345' },
        'field-5': 'NY'
      };
      const searchFieldValues = {
        'item-1': {
          'search-1': { street1: '456 Old St', city: 'Previous City', state: 'CA', postalCode: '54321' }
        }
      };
      const uploadedDocuments = {
        'doc-1': new File(['content'], 'id.pdf', { type: 'application/pdf' })
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        subjectFieldValues,
        searchFieldValues,
        uploadedDocuments
      );

      expect(result.isValid).toBe(true);
      expect(result.missing.subjectFields).toHaveLength(0);
      expect(result.missing.searchFields).toHaveLength(0);
      expect(result.missing.documents).toHaveLength(0);
    });

    it('should handle search fields per service item correctly', () => {
      const searchFieldValues = {
        'item-1': {
          'search-2': 'optional employment info' // Only optional field filled
        }
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        { 'field-1': 'John', 'field-2': 'Address', 'field-5': 'NY' },
        searchFieldValues,
        { 'doc-1': new File([''], 'doc.pdf') }
      );

      expect(result.isValid).toBe(false);
      expect(result.missing.searchFields).toHaveLength(1);
      expect(result.missing.searchFields[0].fieldName).toBe('Previous Address');
      expect(result.missing.searchFields[0].serviceLocation).toBe('Background Check - United States');
    });

    it('should handle required and optional documents correctly', () => {
      const uploadedDocuments = {
        'doc-2': new File(['content'], 'optional.pdf') // Only optional document uploaded
      };

      const result = checkMissingRequirementsLogic(
        mockRequirements,
        mockServiceItems,
        { 'field-1': 'John', 'field-2': 'Address', 'field-5': 'NY' },
        { 'item-1': { 'search-1': 'previous address' } },
        uploadedDocuments
      );

      expect(result.isValid).toBe(false);
      expect(result.missing.documents).toHaveLength(1);
      expect(result.missing.documents[0].documentName).toBe('ID Document');
    });
  });

  describe('Service Cart Management', () => {
    it('should add service to cart with unique item ID', () => {
      const existingItems: any[] = [];
      const service = { id: 'service-1', name: 'Background Check', category: 'Criminal' };
      const locationId = 'location-1';
      const locationName = 'United States';

      const result = addServiceToCartLogic(existingItems, service, locationId, locationName);

      expect(result).toHaveLength(1);
      expect(result[0].serviceId).toBe('service-1');
      expect(result[0].serviceName).toBe('Background Check');
      expect(result[0].locationId).toBe('location-1');
      expect(result[0].locationName).toBe('United States');
      expect(result[0].itemId).toMatch(/^service-1-location-1-\d+$/);
    });

    it('should allow duplicate service+location pairs with unique IDs', () => {
      const existingItems = [
        { serviceId: 'service-1', serviceName: 'Employment Verification', locationId: 'location-1', locationName: 'US', itemId: 'service-1-location-1-1000' }
      ];
      const service = { id: 'service-1', name: 'Employment Verification', category: 'Employment' };

      const result = addServiceToCartLogic(existingItems, service, 'location-1', 'US');

      expect(result).toHaveLength(2);
      expect(result[0].itemId).toBe('service-1-location-1-1000'); // Original
      expect(result[1].itemId).not.toBe('service-1-location-1-1000'); // New unique ID
      expect(result[1].serviceId).toBe('service-1');
      expect(result[1].locationId).toBe('location-1');
    });

    it('should remove service from cart by item ID', () => {
      const existingItems = [
        { serviceId: 'service-1', serviceName: 'Check 1', locationId: 'loc-1', locationName: 'US', itemId: 'item-1' },
        { serviceId: 'service-2', serviceName: 'Check 2', locationId: 'loc-2', locationName: 'CA', itemId: 'item-2' },
        { serviceId: 'service-1', serviceName: 'Check 1', locationId: 'loc-1', locationName: 'US', itemId: 'item-3' } // Duplicate service+location
      ];

      const result = removeServiceFromCartLogic(existingItems, 'item-1');

      expect(result).toHaveLength(2);
      expect(result.map(item => item.itemId)).toEqual(['item-2', 'item-3']);
    });
  });

  describe('Step Completion Logic', () => {
    const mockRequirements = {
      subjectFields: [
        { id: 'field-1', name: 'First Name', required: true },
        { id: 'field-2', name: 'Last Name', required: false }
      ],
      searchFields: [
        {
          id: 'search-1',
          name: 'Required Search Field',
          required: true,
          serviceId: 'service-1',
          locationId: 'location-1'
        },
        {
          id: 'search-2',
          name: 'Optional Search Field',
          required: false,
          serviceId: 'service-1',
          locationId: 'location-1'
        }
      ],
      documents: [
        { id: 'doc-1', name: 'Required Doc', required: true },
        { id: 'doc-2', name: 'Optional Doc', required: false }
      ]
    };

    const mockServiceItems = [
      { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Check', locationName: 'US' }
    ];

    it('should check step 1 completion based on service items', () => {
      expect(isStepCompleteLogic(1, mockServiceItems, mockRequirements, {}, {}, {}, 2)).toBe(true);
      expect(isStepCompleteLogic(1, [], mockRequirements, {}, {}, {}, 2)).toBe(false);
    });

    it('should check step 2 completion based on required subject fields only', () => {
      const completeSubjectValues = { 'field-1': 'John' }; // Only required field
      const incompleteSubjectValues = { 'field-2': 'Smith' }; // Only optional field

      expect(isStepCompleteLogic(2, mockServiceItems, mockRequirements, completeSubjectValues, {}, {}, 3)).toBe(true);
      expect(isStepCompleteLogic(2, mockServiceItems, mockRequirements, incompleteSubjectValues, {}, {}, 3)).toBe(false);
    });

    it('should handle step 2 when no subject fields required', () => {
      const emptyRequirements = { ...mockRequirements, subjectFields: [] };

      expect(isStepCompleteLogic(2, mockServiceItems, emptyRequirements, {}, {}, {}, 3)).toBe(true);
    });

    it('should check step 3 completion based on required search fields per service', () => {
      const completeSearchValues = { 'item-1': { 'search-1': 'required value' } };
      const incompleteSearchValues = { 'item-1': { 'search-2': 'optional value' } };

      expect(isStepCompleteLogic(3, mockServiceItems, mockRequirements, {}, completeSearchValues, {}, 4)).toBe(true);
      expect(isStepCompleteLogic(3, mockServiceItems, mockRequirements, {}, incompleteSearchValues, {}, 4)).toBe(false);
    });

    it('should handle step 3 when no search fields required for a service', () => {
      const noSearchFieldsRequirements = { ...mockRequirements, searchFields: [] };

      expect(isStepCompleteLogic(3, mockServiceItems, noSearchFieldsRequirements, {}, {}, {}, 4)).toBe(true);
    });

    it('should check step 4 completion based on required documents only', () => {
      const completeDocuments = { 'doc-1': new File(['content'], 'required.pdf') };
      const incompleteDocuments = { 'doc-2': new File(['content'], 'optional.pdf') };

      expect(isStepCompleteLogic(4, mockServiceItems, mockRequirements, {}, {}, completeDocuments, 5)).toBe(true);
      expect(isStepCompleteLogic(4, mockServiceItems, mockRequirements, {}, {}, incompleteDocuments, 5)).toBe(false);
    });

    it('should handle step 4 when no documents required', () => {
      const noDocumentsRequirements = { ...mockRequirements, documents: [] };

      expect(isStepCompleteLogic(4, mockServiceItems, noDocumentsRequirements, {}, {}, {}, 5)).toBe(true);
    });

    it('should return false for steps not yet reached', () => {
      expect(isStepCompleteLogic(3, mockServiceItems, mockRequirements, {}, {}, {}, 2)).toBe(false);
      expect(isStepCompleteLogic(4, mockServiceItems, mockRequirements, {}, {}, {}, 3)).toBe(false);
    });
  });

  describe('Address Block Individual Field Requirements', () => {
    // Test cases covering individual field requirements per Data RX/DSX configuration
    it('should validate address block with individual field requirements', () => {
      const addressBlockRequirements = {
        subjectFields: [
          { id: 'addr-1', name: 'Home Address', required: true, dataType: 'address_block' },
        ],
        searchFields: [],
        documents: []
      };

      const serviceItems = [
        { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Check', locationName: 'US' }
      ];

      // Test completely missing address block
      const missingAddressValues = {};
      const result1 = checkMissingRequirementsLogic(addressBlockRequirements, serviceItems, missingAddressValues, {}, {});
      expect(result1.isValid).toBe(false);
      expect(result1.missing.subjectFields).toHaveLength(1);
      expect(result1.missing.subjectFields[0].fieldName).toBe('Home Address');

      // Test empty address block object
      const emptyAddressValues = {
        'addr-1': { street1: '', city: '', state: '', postalCode: '' }
      };
      const result2 = checkMissingRequirementsLogic(addressBlockRequirements, serviceItems, emptyAddressValues, {}, {});
      expect(result2.isValid).toBe(false);
      expect(result2.missing.subjectFields).toHaveLength(1);

      // Test partially filled address block (should be considered valid if any field has data)
      const partialAddressValues = {
        'addr-1': { street1: '123 Main St', city: '', state: '', postalCode: '' }
      };
      const result3 = checkMissingRequirementsLogic(addressBlockRequirements, serviceItems, partialAddressValues, {}, {});
      expect(result3.isValid).toBe(true);
      expect(result3.missing.subjectFields).toHaveLength(0);
    });

    it('should handle multiple address blocks with different requirements', () => {
      const multiAddressRequirements = {
        subjectFields: [
          { id: 'home-addr', name: 'Home Address', required: true, dataType: 'address_block' },
          { id: 'work-addr', name: 'Work Address', required: false, dataType: 'address_block' },
          { id: 'prev-addr', name: 'Previous Address', required: true, dataType: 'address_block' }
        ],
        searchFields: [],
        documents: []
      };

      const serviceItems = [
        { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Check', locationName: 'US' }
      ];

      const addressValues = {
        'home-addr': { street1: '123 Home St', city: 'Home City', state: 'CA', postalCode: '90210' },
        'work-addr': { street1: '', city: '', state: '', postalCode: '' }, // Optional, empty is OK
        // 'prev-addr' completely missing - required, should fail
      };

      const result = checkMissingRequirementsLogic(multiAddressRequirements, serviceItems, addressValues, {}, {});
      expect(result.isValid).toBe(false);
      expect(result.missing.subjectFields).toHaveLength(1);
      expect(result.missing.subjectFields[0].fieldName).toBe('Previous Address');
    });

    it('should validate address blocks in search fields correctly', () => {
      const searchAddressRequirements = {
        subjectFields: [],
        searchFields: [
          {
            id: 'search-addr-1',
            name: 'Employment Address',
            required: true,
            dataType: 'address_block',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
          {
            id: 'search-addr-2',
            name: 'Reference Address',
            required: false,
            dataType: 'address_block',
            serviceId: 'service-1',
            locationId: 'location-1'
          }
        ],
        documents: []
      };

      const serviceItems = [
        { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Employment Check', locationName: 'US' }
      ];

      const searchFieldValues = {
        'item-1': {
          'search-addr-1': { street1: '', city: '', state: '', postalCode: '' }, // Required but empty
          'search-addr-2': { street1: '', city: '', state: '', postalCode: '' }  // Optional and empty, OK
        }
      };

      const result = checkMissingRequirementsLogic(searchAddressRequirements, serviceItems, {}, searchFieldValues, {});
      expect(result.isValid).toBe(false);
      expect(result.missing.searchFields).toHaveLength(1);
      expect(result.missing.searchFields[0].fieldName).toBe('Employment Address');
      expect(result.missing.searchFields[0].serviceLocation).toBe('Employment Check - US');
    });

    it('should handle address blocks with mixed data types in same form', () => {
      const mixedRequirements = {
        subjectFields: [
          { id: 'name', name: 'Full Name', required: true, dataType: 'text' },
          { id: 'address', name: 'Address', required: true, dataType: 'address_block' },
          { id: 'email', name: 'Email', required: false, dataType: 'email' }
        ],
        searchFields: [
          {
            id: 'employer',
            name: 'Employer Name',
            required: true,
            dataType: 'text',
            serviceId: 'service-1',
            locationId: 'location-1'
          },
          {
            id: 'emp-address',
            name: 'Employer Address',
            required: false,
            dataType: 'address_block',
            serviceId: 'service-1',
            locationId: 'location-1'
          }
        ],
        documents: []
      };

      const serviceItems = [
        { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Employment Check', locationName: 'US' }
      ];

      const subjectValues = {
        'name': 'John Doe',
        'address': { street1: '123 Main St', city: 'Anytown', state: 'CA', postalCode: '90210' },
        // email is optional and missing
      };

      const searchValues = {
        'item-1': {
          'employer': 'Acme Corp',
          'emp-address': { street1: '', city: '', state: '', postalCode: '' } // Optional, empty is OK
        }
      };

      const result = checkMissingRequirementsLogic(mixedRequirements, serviceItems, subjectValues, searchValues, {});
      expect(result.isValid).toBe(true);
      expect(result.missing.subjectFields).toHaveLength(0);
      expect(result.missing.searchFields).toHaveLength(0);
    });

    it('should handle null and undefined address block values', () => {
      const requirements = {
        subjectFields: [
          { id: 'addr-1', name: 'Address 1', required: true, dataType: 'address_block' },
          { id: 'addr-2', name: 'Address 2', required: true, dataType: 'address_block' },
          { id: 'addr-3', name: 'Address 3', required: true, dataType: 'address_block' }
        ],
        searchFields: [],
        documents: []
      };

      const serviceItems = [
        { serviceId: 'service-1', locationId: 'location-1', itemId: 'item-1', serviceName: 'Check', locationName: 'US' }
      ];

      const addressValues = {
        'addr-1': null,
        'addr-2': undefined,
        'addr-3': { street1: null, city: undefined, state: '', postalCode: '   ' } // Whitespace should be trimmed
      };

      const result = checkMissingRequirementsLogic(requirements, serviceItems, addressValues, {}, {});
      expect(result.isValid).toBe(false);
      expect(result.missing.subjectFields).toHaveLength(3); // All three should be missing
      expect(result.missing.subjectFields.map(f => f.fieldName)).toEqual(['Address 1', 'Address 2', 'Address 3']);
    });
  });

  describe('Field Value Conversion Logic', () => {
    const mockRequirements = {
      subjectFields: [
        { id: 'field-1', name: 'First Name' },
        { id: 'field-2', name: 'Address Block' }
      ],
      searchFields: [
        { id: 'search-1', name: 'Employment History' }
      ]
    };

    it('should convert UUID-based field values to name-based for storage', () => {
      const subjectFieldValues = {
        'field-1': 'John Doe',
        'field-2': { street1: '123 Main St', city: 'Anytown' }
      };

      const result = convertSubjectFieldsToNameBasedLogic(subjectFieldValues, mockRequirements.subjectFields);

      expect(result).toEqual({
        'First Name': 'John Doe',
        'Address Block': { street1: '123 Main St', city: 'Anytown' }
      });
    });

    it('should convert search field values per item to name-based', () => {
      const searchFieldValues = {
        'item-1': { 'search-1': 'Previous job at Company X' },
        'item-2': { 'search-1': 'Current job at Company Y' }
      };

      const result = convertSearchFieldsToNameBasedLogic(searchFieldValues, mockRequirements.searchFields);

      expect(result).toEqual({
        'item-1': { 'Employment History': 'Previous job at Company X' },
        'item-2': { 'Employment History': 'Current job at Company Y' }
      });
    });

    it('should handle empty values correctly in conversion', () => {
      const subjectFieldValues = {
        'field-1': '',
        'field-2': null,
        'field-3': 'valid-value'
      };

      const fields = [
        { id: 'field-1', name: 'Empty Field' },
        { id: 'field-2', name: 'Null Field' },
        { id: 'field-3', name: 'Valid Field' }
      ];

      const result = convertSubjectFieldsToNameBasedLogic(subjectFieldValues, fields);

      // Should only include non-empty values
      expect(result).toEqual({
        'Valid Field': 'valid-value'
      });
    });
  });
});

// Business logic functions that will be extracted into actual implementation
function validateStep1Logic(serviceItems: any[]) {
  const errors: Record<string, string> = {};

  if (serviceItems.length === 0) {
    errors.services = 'Please add at least one service to your order';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

function validateStep2Logic(): boolean {
  // Step 2 allows navigation without blocking - validation happens at submission
  return true;
}

function validateStep3Logic(): boolean {
  // Step 3 allows navigation without blocking - validation happens at submission
  return true;
}

function checkMissingRequirementsLogic(
  requirements: any,
  serviceItems: any[],
  subjectFieldValues: Record<string, any>,
  searchFieldValues: Record<string, Record<string, any>>,
  uploadedDocuments: Record<string, File>
) {
  const missing = {
    subjectFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
    searchFields: [] as Array<{ fieldName: string; serviceLocation: string }>,
    documents: [] as Array<{ documentName: string; serviceLocation: string }>
  };

  // Check subject fields - each field can be individually required
  requirements.subjectFields.forEach((field: any) => {
    if (field.required) {
      const fieldValue = subjectFieldValues[field.id];

      // Handle address blocks specially
      if (field.dataType === 'address_block') {
        // Check if address block is missing or has no meaningful data
        const hasData = fieldValue &&
          typeof fieldValue === 'object' &&
          (
            (fieldValue.street1 && typeof fieldValue.street1 === 'string' && fieldValue.street1.trim()) ||
            (fieldValue.city && typeof fieldValue.city === 'string' && fieldValue.city.trim()) ||
            (fieldValue.state && typeof fieldValue.state === 'string' && fieldValue.state.trim()) ||
            (fieldValue.postalCode && typeof fieldValue.postalCode === 'string' && fieldValue.postalCode.trim())
          );

        if (!hasData) {
          missing.subjectFields.push({
            fieldName: field.name,
            serviceLocation: 'All services'
          });
        }
      } else {
        // Regular field validation
        if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
          missing.subjectFields.push({
            fieldName: field.name,
            serviceLocation: 'All services'
          });
        }
      }
    }
  });

  // Check search fields per service item
  serviceItems.forEach(item => {
    const itemFields = requirements.searchFields.filter(
      (field: any) => field.serviceId === item.serviceId && field.locationId === item.locationId
    );

    itemFields.forEach((field: any) => {
      if (field.required) {
        const fieldValue = searchFieldValues[item.itemId]?.[field.id];

        if (field.dataType === 'address_block') {
          // Check if address block has meaningful data
          const hasData = fieldValue &&
            typeof fieldValue === 'object' &&
            (
              (fieldValue.street1 && typeof fieldValue.street1 === 'string' && fieldValue.street1.trim()) ||
              (fieldValue.city && typeof fieldValue.city === 'string' && fieldValue.city.trim()) ||
              (fieldValue.state && typeof fieldValue.state === 'string' && fieldValue.state.trim()) ||
              (fieldValue.postalCode && typeof fieldValue.postalCode === 'string' && fieldValue.postalCode.trim())
            );

          if (!hasData) {
            missing.searchFields.push({
              fieldName: field.name,
              serviceLocation: `${item.serviceName} - ${item.locationName}`
            });
          }
        } else {
          if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
            missing.searchFields.push({
              fieldName: field.name,
              serviceLocation: `${item.serviceName} - ${item.locationName}`
            });
          }
        }
      }
    });
  });

  // Check documents - each can be individually required
  requirements.documents.forEach((document: any) => {
    if (document.required && !uploadedDocuments[document.id]) {
      missing.documents.push({
        documentName: document.name,
        serviceLocation: document.scope === 'per_case' ? 'All services' : 'Service specific'
      });
    }
  });

  const isValid =
    missing.subjectFields.length === 0 &&
    missing.searchFields.length === 0 &&
    missing.documents.length === 0;

  return { isValid, missing };
}

function addServiceToCartLogic(
  existingItems: any[],
  service: any,
  locationId: string,
  locationName: string
) {
  const itemId = `${service.id}-${locationId}-${Date.now()}`;

  return [
    ...existingItems,
    {
      serviceId: service.id,
      serviceName: service.name,
      locationId: locationId,
      locationName: locationName,
      itemId: itemId,
    }
  ];
}

function removeServiceFromCartLogic(existingItems: any[], itemId: string) {
  return existingItems.filter(item => item.itemId !== itemId);
}

function isStepCompleteLogic(
  stepNumber: number,
  serviceItems: any[],
  requirements: any,
  subjectFieldValues: Record<string, any>,
  searchFieldValues: Record<string, Record<string, any>>,
  uploadedDocuments: Record<string, File>,
  currentStep: number
): boolean {
  switch (stepNumber) {
    case 1:
      return serviceItems.length > 0;

    case 2:
      // If no subject fields required and we've moved past this step
      if (requirements.subjectFields.length === 0 && currentStep > 2) {
        return true;
      }
      // Check that all required subject fields are filled
      return requirements.subjectFields.length > 0 &&
             requirements.subjectFields.every((field: any) =>
               !field.required || subjectFieldValues[field.id]
             );

    case 3:
      // Only consider complete if we've reached step 3
      if (currentStep < 3) return false;

      // Check each service item for required search fields
      return serviceItems.every(item => {
        const itemFields = requirements.searchFields.filter(
          (field: any) => field.serviceId === item.serviceId && field.locationId === item.locationId
        );
        // If no fields for this item, it's complete
        if (itemFields.length === 0) return true;
        // Check that all required fields are filled
        return itemFields.every((field: any) =>
          !field.required || searchFieldValues[item.itemId]?.[field.id]
        );
      });

    case 4:
      // Only consider complete if we've reached step 4
      if (currentStep < 4) return false;
      // If no documents required, it's complete
      if (requirements.documents.length === 0) return true;
      // Check that all required documents are uploaded
      return requirements.documents.every((document: any) =>
        !document.required || uploadedDocuments[document.id]
      );

    default:
      return false;
  }
}

function convertSubjectFieldsToNameBasedLogic(
  fieldValues: Record<string, any>,
  fields: any[]
): Record<string, any> {
  const result: Record<string, any> = {};

  Object.entries(fieldValues).forEach(([fieldId, value]) => {
    const field = fields.find(f => f.id === fieldId);
    if (field && value) {
      result[field.name] = value;
    }
  });

  return result;
}

function convertSearchFieldsToNameBasedLogic(
  fieldValues: Record<string, Record<string, any>>,
  fields: any[]
): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};

  Object.entries(fieldValues).forEach(([itemId, itemFields]) => {
    result[itemId] = {};
    Object.entries(itemFields).forEach(([fieldId, value]) => {
      const field = fields.find(f => f.id === fieldId);
      if (field && value) {
        result[itemId][field.name] = value;
      }
    });
  });

  return result;
}