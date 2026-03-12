// /GlobalRX_v2/src/lib/schemas/__tests__/service-order-data.schemas.test.ts

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { serviceDetailsWithOrderDataSchema } from '../service-order-data.schemas';

describe('serviceDetailsWithOrderDataSchema', () => {
  describe('valid data', () => {
    it('should pass with orderData as empty object', () => {
      // Business Rule 8: If no order data exists, orderData should be empty object
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: {}
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderData).toEqual({});
      }
    });

    it('should pass with orderData containing field values', () => {
      // Business Rule 2: Return data as flat key-value pairs
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: {
          'School Name': 'University of Michigan',
          'Degree Type': 'Bachelor\'s',
          'Graduation Date': '2020-05-15',
          'Major/Field of Study': 'Computer Science',
          'Student ID': '123456789'
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderData['School Name']).toBe('University of Michigan');
        expect(Object.keys(result.data.orderData).length).toBe(5);
      }
    });

    it('should pass with orderData containing various data types as strings', () => {
      // Business Rule 9: Field values returned exactly as stored
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'processing',
        orderData: {
          'Employment Start Date': '2021-01-15',
          'Years of Experience': '5',
          'Is Full Time': 'true',
          'Salary': '75000.00',
          'Department': 'Engineering'
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should pass with orderData containing special characters', () => {
      // Edge Case 7: Special characters in field values
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'completed',
        orderData: {
          'Company Name': 'O\'Reilly & Associates',
          'Address Line 1': '123 Main St #456',
          'Special Instructions': 'Call before 9:00 AM (PST)',
          'Notes': 'Contains "quotes" and special chars: @#$%'
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should pass with very long field values', () => {
      // Edge Case 6: Very long field values (up to 5000 chars)
      const longText = 'A'.repeat(4999); // Just under 5000 char limit
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: {
          'Detailed Description': longText
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should pass with fields using raw fieldNames when workflow is deleted', () => {
      // Edge Case 2: Workflow deleted, using raw fieldName
      const validData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: {
          'school_name': 'MIT', // raw field name with underscores
          'degree_type': 'Masters',
          'graduation_date': '2022-06-01'
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should fail when orderData is null', () => {
      // Business Rule 8: orderData must be object, not null
      const invalidData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: null
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Expected object');
      }
    });

    it('should fail when orderData is undefined', () => {
      // Business Rule 8: orderData must be present
      const invalidData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: undefined
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail when orderData is not an object', () => {
      const invalidData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: 'not an object'
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Expected object');
      }
    });

    it('should fail when field value exceeds 5000 characters', () => {
      // Data Requirement: Max 5000 chars per field value
      const tooLongText = 'A'.repeat(5001);
      const invalidData = {
        id: 'srv_123',
        orderId: 'ord_456',
        orderItemId: 'item_789',
        serviceId: 'svc_001',
        locationId: 'loc_001',
        status: 'submitted',
        orderData: {
          'Too Long Field': tooLongText
        }
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('String must contain at most 5000 character(s)');
      }
    });

    it('should fail when required service fields are missing', () => {
      const invalidData = {
        orderData: {}
      };

      const result = serviceDetailsWithOrderDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.some(e => e.path[0] === 'id')).toBe(true);
        expect(result.error.errors.some(e => e.path[0] === 'orderId')).toBe(true);
      }
    });
  });

  describe('subject field filtering validation', () => {
    it('should define excluded subject fields', () => {
      // Business Rule 3: Subject Information fields that duplicate order.subject must NOT be included
      const excludedFields = [
        'firstName',
        'First Name',
        'lastName',
        'Last Name',
        'middleName',
        'Middle Name',
        'dateOfBirth',
        'Date of Birth',
        'email',
        'Email',
        'phone',
        'Phone',
        'ssn',
        'Social Security Number'
      ];

      // The actual filtering happens in the service layer, not schema validation
      // This test documents the expected behavior
      expect(excludedFields).toContain('firstName');
      expect(excludedFields).toContain('email');
      expect(excludedFields).toContain('ssn');
    });
  });
});