// src/components/portal/orders/hooks/__tests__/useOrderValidation.fieldKey.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrderValidation } from '../useOrderValidation';

describe('useOrderValidation - fieldKey usage', () => {
  let validation: ReturnType<typeof useOrderValidation>;

  beforeEach(() => {
    const { result } = renderHook(() => useOrderValidation());
    validation = result.current;
  });

  describe('convertSubjectFieldsToNameBased', () => {
    it('should use fieldKey property when converting subject fields', () => {
      const fields = [
        {
          id: 'uuid-123',
          name: 'First Name or Given Name',  // Display label
          fieldKey: 'firstName',              // Stable key
          dataType: 'text'
        },
        {
          id: 'uuid-456',
          name: 'Date of Birth (DOB)',       // Display label with parentheses
          fieldKey: 'dateOfBirth',            // Stable key
          dataType: 'date'
        }
      ];

      const fieldValues = {
        'uuid-123': 'John',
        'uuid-456': '1990-01-01'
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      // Should use fieldKey, not name
      expect(result).toEqual({
        'firstName': 'John',
        'dateOfBirth': '1990-01-01'
      });

      // Should NOT have the display labels as keys
      expect(result['First Name or Given Name']).toBeUndefined();
      expect(result['Date of Birth (DOB)']).toBeUndefined();
    });

    it('should handle fields with complex display names', () => {
      const fields = [
        {
          id: 'uuid-789',
          name: "Mother's Maiden Name / Nom de jeune fille",
          fieldKey: 'mothersMaidenName',
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'uuid-789': 'Smith'
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      expect(result).toEqual({
        'mothersMaidenName': 'Smith'
      });
    });

    it('should skip fields with no value', () => {
      const fields = [
        {
          id: 'uuid-111',
          name: 'Field One',
          fieldKey: 'fieldOne',
          dataType: 'text'
        },
        {
          id: 'uuid-222',
          name: 'Field Two',
          fieldKey: 'fieldTwo',
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'uuid-111': 'Has Value',
        'uuid-222': ''  // Empty value
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      // Should only include field with value
      expect(result).toEqual({
        'fieldOne': 'Has Value'
      });
      expect(result.fieldTwo).toBeUndefined();
    });

    // REGRESSION TEST: This proves that if fieldKey is undefined or missing,
    // the function would use the wrong key (or fail)
    it('REGRESSION TEST: must use fieldKey to prevent validation failures after label changes', () => {
      // Simulate a field that had its label changed
      const fields = [
        {
          id: 'uuid-field',
          name: 'First Name/Given Name',  // Changed from "First Name"
          fieldKey: 'firstName',           // Stable key remains the same
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'uuid-field': 'Jane'
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      // With the fix: uses stable fieldKey
      expect(result['firstName']).toBe('Jane');

      // Without the fix: would have used name, causing validation to fail
      // because backend expects 'firstName' not 'firstNameGivenName'
      expect(result['First Name/Given Name']).toBeUndefined();
      expect(result['firstNameGivenName']).toBeUndefined();
    });
  });

  describe('convertSearchFieldsToNameBased', () => {
    it('should use fieldKey property when converting search fields', () => {
      const fields = [
        {
          id: 'search-uuid-1',
          name: 'Previous Address/Former Residence',
          fieldKey: 'previousAddress',
          dataType: 'address_block',
          serviceId: 'service-1',
          locationId: 'loc-1'
        },
        {
          id: 'search-uuid-2',
          name: 'School Name (Institution)',
          fieldKey: 'schoolName',
          dataType: 'text',
          serviceId: 'service-1',
          locationId: 'loc-1'
        }
      ];

      const fieldValues = {
        'item-uuid-1': {
          'search-uuid-1': { street1: '123 Old St', city: 'Old City', state: 'CA', postalCode: '90210' },
          'search-uuid-2': 'University of Example'
        }
      };

      const result = validation.convertSearchFieldsToNameBased(fieldValues, fields);

      expect(result).toEqual({
        'item-uuid-1': {
          'previousAddress': { street1: '123 Old St', city: 'Old City', state: 'CA', postalCode: '90210' },
          'schoolName': 'University of Example'
        }
      });

      // Should NOT have the display labels as keys
      expect(result['item-uuid-1']['Previous Address/Former Residence']).toBeUndefined();
      expect(result['item-uuid-1']['School Name (Institution)']).toBeUndefined();
    });

    it('should handle multiple service items correctly', () => {
      const fields = [
        {
          id: 'field-1',
          name: 'Employer Name',
          fieldKey: 'employerName',
          dataType: 'text'
        },
        {
          id: 'field-2',
          name: 'Job Title/Position',
          fieldKey: 'jobTitle',
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'item-1': {
          'field-1': 'Company A',
          'field-2': 'Engineer'
        },
        'item-2': {
          'field-1': 'Company B',
          'field-2': 'Manager'
        }
      };

      const result = validation.convertSearchFieldsToNameBased(fieldValues, fields);

      expect(result).toEqual({
        'item-1': {
          'employerName': 'Company A',
          'jobTitle': 'Engineer'
        },
        'item-2': {
          'employerName': 'Company B',
          'jobTitle': 'Manager'
        }
      });
    });

    it('should skip empty values in search fields', () => {
      const fields = [
        {
          id: 'field-1',
          name: 'Field Name',
          fieldKey: 'fieldKey1',
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'item-1': {
          'field-1': ''  // Empty value
        },
        'item-2': {
          'field-1': 'Has Value'
        }
      };

      const result = validation.convertSearchFieldsToNameBased(fieldValues, fields);

      expect(result).toEqual({
        'item-1': {},  // Empty object since value was empty
        'item-2': {
          'fieldKey1': 'Has Value'
        }
      });
    });

    // REGRESSION TEST
    it('REGRESSION TEST: search fields must use fieldKey for consistent validation', () => {
      // This test proves that using the display name instead of fieldKey
      // would cause validation to fail when the label changes

      const fields = [
        {
          id: 'edu-field',
          name: 'School Name / Educational Institution / École',  // Complex multilingual label
          fieldKey: 'schoolName',  // Simple, stable key
          dataType: 'text',
          serviceId: 'education-service',
          locationId: 'us'
        }
      ];

      const fieldValues = {
        'item-123': {
          'edu-field': 'Harvard University'
        }
      };

      const result = validation.convertSearchFieldsToNameBased(fieldValues, fields);

      // With fix: uses stable fieldKey
      expect(result['item-123']['schoolName']).toBe('Harvard University');

      // Without fix: would use complex label as key, causing validation failure
      expect(result['item-123']['School Name / Educational Institution / École']).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle fields with undefined fieldKey gracefully', () => {
      const fields = [
        {
          id: 'field-1',
          name: 'Test Field',
          fieldKey: undefined as any,  // Simulating missing fieldKey
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'field-1': 'Test Value'
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      // Should use undefined as key (which will fail validation, as intended)
      expect(result['undefined']).toBe('Test Value');
      expect(result['Test Field']).toBeUndefined();
    });

    it('should handle fields not found in the fields array', () => {
      const fields = [
        {
          id: 'field-1',
          name: 'Known Field',
          fieldKey: 'knownField',
          dataType: 'text'
        }
      ];

      const fieldValues = {
        'field-1': 'Known Value',
        'field-unknown': 'Unknown Value'  // This field ID doesn't exist in fields array
      };

      const result = validation.convertSubjectFieldsToNameBased(fieldValues, fields);

      // Should only include known fields
      expect(result).toEqual({
        'knownField': 'Known Value'
      });
    });
  });
});