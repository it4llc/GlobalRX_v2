// /GlobalRX_v2/src/lib/schemas/__tests__/service-fulfillment-status-casing.test.ts

import { describe, it, expect } from 'vitest';
import {
  serviceStatusSchema,
  updateServiceFulfillmentSchema,
  serviceQuerySchema
} from '../service-fulfillment.schemas';
import { SERVICE_STATUSES, SERVICE_STATUS_VALUES } from '@/constants/service-status';
import { ORDER_STATUS_VALUES } from '@/constants/order-status';

describe('service-fulfillment.schemas status casing validation', () => {

  // REGRESSION TEST: proves bug fix for status casing mismatch
  describe('REGRESSION TEST: serviceStatusSchema lowercase validation', () => {
    it('should FAIL with lowercase constants - proves the bug exists', () => {
      // The schema is defined with Title Case values but constants are lowercase
      const lowercaseStatuses = SERVICE_STATUS_VALUES; // All lowercase from constants

      lowercaseStatuses.forEach(status => {
        const result = serviceStatusSchema.safeParse(status);

        // Before fix: FAILS because schema expects Title Case
        // After fix: PASSES because schema uses lowercase constants
        expect(result.success).toBe(false); // Currently fails - proves bug exists

        if (!result.success) {
          // The error should be about invalid enum value
          expect(result.error.issues[0].code).toBe('invalid_enum_value');
          expect(result.error.issues[0].options).toEqual([
            'Draft',
            'Submitted',
            'Processing',
            'Missing Information',
            'Completed',
            'Cancelled',
            'Cancelled-DNB'
          ]);
        }
      });
    });

    it('should FAIL when order status constants are used', () => {
      // Order and service statuses should be interchangeable
      ORDER_STATUS_VALUES.forEach(status => {
        const result = serviceStatusSchema.safeParse(status);

        // Before fix: FAILS due to casing mismatch
        // After fix: PASSES with lowercase
        expect(result.success).toBe(false); // Currently fails - proves bug exists
      });
    });
  });

  describe('updateServiceFulfillmentSchema status field', () => {
    it('should FAIL with lowercase status in update schema', () => {
      const updateData = {
        status: SERVICE_STATUSES.PROCESSING, // 'processing'
        vendorNotes: 'Starting background check'
      };

      const result = updateServiceFulfillmentSchema.safeParse(updateData);

      // Before fix: FAILS because status is lowercase
      // After fix: PASSES
      expect(result.success).toBe(false); // Currently fails - proves bug exists

      if (!result.success) {
        const statusError = result.error.issues.find(issue => issue.path[0] === 'status');
        expect(statusError).toBeDefined();
      }
    });

    it('currently accepts Title Case status in update', () => {
      const updateData = {
        status: 'Processing', // Title Case
        vendorNotes: 'Starting background check'
      };

      const result = updateServiceFulfillmentSchema.safeParse(updateData);
      expect(result.success).toBe(true); // Currently passes with Title Case
    });
  });

  describe('serviceQuerySchema status filtering', () => {
    it('should FAIL when filtering by lowercase status', () => {
      const queryParams = {
        status: SERVICE_STATUSES.SUBMITTED, // 'submitted'
        limit: 10,
        offset: 0
      };

      const result = serviceQuerySchema.safeParse(queryParams);

      // Before fix: FAILS because status is lowercase
      // After fix: PASSES
      expect(result.success).toBe(false); // Currently fails - proves bug exists
    });

    it('currently accepts Title Case status in query', () => {
      const queryParams = {
        status: 'Submitted', // Title Case
        limit: 10,
        offset: 0
      };

      const result = serviceQuerySchema.safeParse(queryParams);
      expect(result.success).toBe(true); // Currently passes with Title Case
    });
  });

  describe('cross-schema consistency', () => {
    it('all schemas should accept the same status values from constants', () => {
      SERVICE_STATUS_VALUES.forEach(status => {
        // Test all schemas that include status
        const statusResult = serviceStatusSchema.safeParse(status);
        const updateResult = updateServiceFulfillmentSchema.safeParse({ status });
        const queryResult = serviceQuerySchema.safeParse({ status });

        // All should consistently fail with lowercase (bug) or pass (after fix)
        expect(statusResult.success).toBe(false); // Currently false
        expect(updateResult.success).toBe(false); // Currently false
        expect(queryResult.success).toBe(false); // Currently false
      });
    });
  });

  describe('hardcoded values vs imported constants', () => {
    it('schema uses hardcoded Title Case instead of imported constants', () => {
      // The schema line 7-15 has hardcoded array instead of using SERVICE_STATUS_VALUES
      // This is the root cause of the bug

      // What the schema currently expects (hardcoded)
      const hardcodedValues = [
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ];

      // What it should use (from constants)
      const constantValues = SERVICE_STATUS_VALUES;

      // They don't match - proving the bug
      expect(hardcodedValues).not.toEqual(constantValues);

      // Specifically, the casing is different
      expect(hardcodedValues[0]).toBe('Draft');
      expect(constantValues[0]).toBe('draft');
    });
  });

  describe('special cases for status values', () => {
    it('should handle missing_info vs Missing Information mismatch', () => {
      // Database and constants use underscore
      const dbValue = SERVICE_STATUSES.MISSING_INFO; // 'missing_info'
      const schemaExpects = 'Missing Information'; // Title Case with space

      const result1 = serviceStatusSchema.safeParse(dbValue);
      expect(result1.success).toBe(false); // Currently fails

      const result2 = serviceStatusSchema.safeParse(schemaExpects);
      expect(result2.success).toBe(true); // Currently passes
    });

    it('should handle cancelled_dnb vs Cancelled-DNB mismatch', () => {
      // Database uses underscore, schema uses hyphen and different casing
      const dbValue = SERVICE_STATUSES.CANCELLED_DNB; // 'cancelled_dnb'
      const schemaExpects = 'Cancelled-DNB'; // Title Case with hyphen

      const result1 = serviceStatusSchema.safeParse(dbValue);
      expect(result1.success).toBe(false); // Currently fails

      const result2 = serviceStatusSchema.safeParse(schemaExpects);
      expect(result2.success).toBe(true); // Currently passes
    });
  });

  describe('TypeScript type inference', () => {
    it('ServiceStatus type should match runtime values', () => {
      // The derived type from the schema
      type SchemaServiceStatus = typeof serviceStatusSchema._output;

      // This test validates at compile time that types match
      // At runtime, we check the actual values
      const testValue: string = SERVICE_STATUSES.PROCESSING;

      // Try to use it as the schema type (will fail at runtime due to casing)
      const result = serviceStatusSchema.safeParse(testValue);
      expect(result.success).toBe(false); // Mismatch between type and runtime
    });
  });

  describe('validation error messages', () => {
    it('should show Title Case options in error when lowercase is provided', () => {
      const result = serviceStatusSchema.safeParse('submitted');

      expect(result.success).toBe(false);
      if (!result.success) {
        const error = result.error.issues[0];
        expect(error.code).toBe('invalid_enum_value');
        // Error shows what it expects: Title Case values
        expect(error.options).toContain('Submitted');
        expect(error.options).not.toContain('submitted');
      }
    });
  });
});