// /GlobalRX_v2/src/__tests__/integration/status-casing-bug.test.ts

import { describe, it, expect } from 'vitest';
import { SERVICE_STATUSES, SERVICE_STATUS_VALUES } from '@/constants/service-status';
import { ORDER_STATUS_VALUES } from '@/constants/order-status';
import { updateServiceStatusSchema } from '@/types/service-fulfillment';
import { serviceStatusSchema } from '@/lib/schemas/service-fulfillment.schemas';

describe('Status Casing Bug - Integration Tests', () => {

  // REGRESSION TEST: proves bug fix for status casing mismatch across the system
  describe('REGRESSION TEST: End-to-end status flow with lowercase values', () => {
    it('complete flow FAILS with lowercase statuses from database - proves bug exists', () => {
      // Simulating a real flow:
      // 1. Database stores status as lowercase
      const dbServiceStatus = SERVICE_STATUSES.SUBMITTED; // 'submitted'

      // 2. API tries to validate this status from database
      const validationResult = serviceStatusSchema.safeParse(dbServiceStatus);
      expect(validationResult.success).toBe(false); // FAILS - bug!

      // 3. If validation passed (it doesn't), we'd update the status
      const updatePayload = {
        status: SERVICE_STATUSES.PROCESSING, // 'processing'
        comment: 'Starting background check'
      };

      const updateValidation = updateServiceStatusSchema.safeParse(updatePayload);
      expect(updateValidation.success).toBe(false); // FAILS - bug!

      // 4. Terminal status check would fail
      const { isTerminalStatus } = require('@/types/service-fulfillment');
      const isTerminal = isTerminalStatus(SERVICE_STATUSES.COMPLETED);
      expect(isTerminal).toBe(false); // FAILS to detect terminal - bug!

      // This shows the bug affects the entire flow
    });

    it('shows that Title Case works but violates the spec', () => {
      // The spec says to use lowercase but code expects Title Case

      // This works in current code:
      const titleCaseFlow = {
        status: 'Submitted',
        nextStatus: 'Processing',
        terminalStatus: 'Completed'
      };

      const validation1 = serviceStatusSchema.safeParse(titleCaseFlow.status);
      expect(validation1.success).toBe(true); // Works with Title Case

      const updateValidation = updateServiceStatusSchema.safeParse({
        status: titleCaseFlow.nextStatus
      });
      expect(updateValidation.success).toBe(true); // Works with Title Case

      const { isTerminalStatus } = require('@/types/service-fulfillment');
      expect(isTerminalStatus(titleCaseFlow.terminalStatus)).toBe(true); // Works

      // But this violates the spec which requires lowercase!
    });
  });

  describe('Database vs Application Layer Mismatch', () => {
    it('database constants do not match validation schemas', () => {
      // What the database/constants define
      const databaseStatuses = SERVICE_STATUS_VALUES; // All lowercase

      // What the validation expects (hardcoded in schemas)
      const schemaExpectedValues = [
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ];

      // They don't match!
      expect(databaseStatuses).not.toEqual(schemaExpectedValues);

      // Specifically test each database value against schema
      databaseStatuses.forEach(dbStatus => {
        const result = serviceStatusSchema.safeParse(dbStatus);
        expect(result.success).toBe(false); // All fail!
      });

      // This means data from database cannot pass validation
    });

    it('order statuses and service statuses have inconsistent validation', () => {
      // Order statuses are lowercase
      const orderStatuses = ORDER_STATUS_VALUES;

      // But service schema expects Title Case
      orderStatuses.forEach(orderStatus => {
        const result = serviceStatusSchema.safeParse(orderStatus);
        expect(result.success).toBe(false); // Order statuses fail service validation
      });

      // This breaks interoperability between orders and services
    });
  });

  describe('Comment Template Filtering Integration', () => {
    it('comment templates cannot be found when using database status values', () => {
      // Simulate the full flow of finding comment templates

      // 1. Service has status from database
      const serviceStatus = SERVICE_STATUSES.SUBMITTED; // 'submitted'

      // 2. API normalizes to Title Case for query
      const normalizedStatus = 'Submitted'; // From route.ts lines 102-109

      // 3. But if database availabilities use lowercase (correct), no match
      const dbAvailability = {
        templateId: 'template-1',
        serviceCode: 'BGC',
        status: 'submitted' // Lowercase in database
      };

      // Query looks for 'Submitted', database has 'submitted'
      expect(normalizedStatus).not.toBe(dbAvailability.status); // No match!

      // Result: User sees no comment templates even though they exist
    });

    it('hardcoded status list does not match constants', () => {
      // Route returns hardcoded statuses (lines 177-185)
      const hardcodedStatuses = [
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ];

      // Should be using constants
      const constantStatuses = SERVICE_STATUS_VALUES;

      // They don't match
      expect(hardcodedStatuses).not.toEqual(constantStatuses);

      // This causes UI to display wrong values
    });
  });

  describe('Special Status Format Issues', () => {
    it('missing_info vs Missing Information causes validation failures', () => {
      const dbFormat = SERVICE_STATUSES.MISSING_INFO; // 'missing_info'
      const schemaFormat = 'Missing Information';

      // Database value fails validation
      const result1 = serviceStatusSchema.safeParse(dbFormat);
      expect(result1.success).toBe(false);

      // Schema format passes
      const result2 = serviceStatusSchema.safeParse(schemaFormat);
      expect(result2.success).toBe(true);

      // They represent the same status but are incompatible
    });

    it('cancelled_dnb format inconsistencies', () => {
      const variations = {
        database: SERVICE_STATUSES.CANCELLED_DNB, // 'cancelled_dnb'
        schemaExpects: 'Cancelled-DNB',
        normalized: 'Cancelled_dnb', // What normalization produces
      };

      // Database format fails
      expect(serviceStatusSchema.safeParse(variations.database).success).toBe(false);

      // Schema format passes
      expect(serviceStatusSchema.safeParse(variations.schemaExpects).success).toBe(true);

      // Normalized format fails
      expect(serviceStatusSchema.safeParse(variations.normalized).success).toBe(false);

      // All three represent the same status but only one works
    });
  });

  describe('Impact on Business Logic', () => {
    it('terminal status detection affects service modification permissions', () => {
      // A completed service from database
      const completedService = {
        id: 'service-1',
        status: SERVICE_STATUSES.COMPLETED // 'completed'
      };

      // Check if it's terminal to determine if modifications allowed
      const { isTerminalStatus } = require('@/types/service-fulfillment');
      const canModify = !isTerminalStatus(completedService.status);

      // Bug: Returns true (can modify) when it should return false
      expect(canModify).toBe(true); // BUG: Allows modifying completed service!

      // This could allow users to incorrectly modify completed services
    });

    it('validation failures prevent legitimate status updates', () => {
      // User tries to update service status
      const updateRequest = {
        status: SERVICE_STATUSES.PROCESSING, // 'processing' from constants
        comment: 'Starting verification'
      };

      // Validation fails even though status is valid
      const result = updateServiceStatusSchema.safeParse(updateRequest);
      expect(result.success).toBe(false); // Legitimate update blocked!

      // User gets error even though they used a valid status
    });

    it('status progression automation would fail', () => {
      // System tries to auto-progress status
      const currentStatus = SERVICE_STATUSES.SUBMITTED; // 'submitted'
      const nextStatus = SERVICE_STATUSES.PROCESSING; // 'processing'

      // Validation for the progression
      const currentValid = serviceStatusSchema.safeParse(currentStatus);
      const nextValid = serviceStatusSchema.safeParse(nextStatus);

      expect(currentValid.success).toBe(false); // Can't validate current
      expect(nextValid.success).toBe(false); // Can't validate next

      // Automation fails due to validation errors
    });
  });

  describe('Migration Concerns', () => {
    it('existing Title Case data in database would fail after fix', () => {
      // If database currently has Title Case (due to bug)
      const existingDbData = {
        status: 'Submitted' // Title Case in database
      };

      // After fix, schema expects lowercase
      // This test simulates what would happen after fix
      const futureSchemaExpectsLowercase = (status: string) => {
        return SERVICE_STATUS_VALUES.includes(status as any);
      };

      // Existing data would fail
      expect(futureSchemaExpectsLowercase(existingDbData.status)).toBe(false);

      // Would need migration to convert Title Case to lowercase
      const migratedStatus = existingDbData.status.toLowerCase();
      expect(futureSchemaExpectsLowercase(migratedStatus)).toBe(true);
    });

    it('demonstrates need for data migration', () => {
      // Current database might have mix of casings
      const currentDbStatuses = [
        'Submitted',           // Title Case from buggy code
        'submitted',           // Lowercase from correct code
        'Missing Information', // Title Case with space
        'missing_info',        // Lowercase with underscore
        'Cancelled-DNB',       // Title Case with hyphen
        'cancelled_dnb'        // Lowercase with underscore
      ];

      // Count how many would need migration
      const needsMigration = currentDbStatuses.filter(status => {
        // Check if it's not lowercase format
        return !SERVICE_STATUS_VALUES.includes(status as any);
      });

      // At least half would need migration
      expect(needsMigration.length).toBeGreaterThan(0);
    });
  });
});