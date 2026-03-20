// /GlobalRX_v2/src/types/__tests__/service-fulfillment-status-casing.test.ts

import { describe, it, expect } from 'vitest';
import { updateServiceStatusSchema, isTerminalStatus } from '../service-fulfillment';
import { SERVICE_STATUSES } from '@/constants/service-status';
import { ORDER_STATUS_VALUES } from '@/constants/order-status';

describe('service-fulfillment status casing validation', () => {

  // REGRESSION TEST: proves bug fix for status casing mismatch
  describe('REGRESSION TEST: lowercase status validation', () => {
    it('should reject lowercase status values from constants - proves the bug exists', () => {
      // These lowercase values come from the constants files and database
      const lowercaseStatuses = [
        SERVICE_STATUSES.DRAFT,           // 'draft'
        SERVICE_STATUSES.SUBMITTED,       // 'submitted'
        SERVICE_STATUSES.PROCESSING,      // 'processing'
        SERVICE_STATUSES.MISSING_INFO,    // 'missing_info'
        SERVICE_STATUSES.COMPLETED,       // 'completed'
        SERVICE_STATUSES.CANCELLED,       // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB    // 'cancelled_dnb'
      ];

      // This test proves the bug exists: lowercase values from constants/database
      // are rejected by the schema which expects Title Case
      lowercaseStatuses.forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });

        // Currently FAILS (success=false) because schema expects Title Case
        // After fix: should PASS (success=true) because schema will accept lowercase
        expect(result.success).toBe(false); // Proves bug exists

        if (!result.success) {
          // Verify the error is specifically about invalid enum value
          expect(result.error.issues[0].message).toContain('Invalid enum value');
          expect(result.error.issues[0].code).toBe('invalid_enum_value');
        }
      });
    });

    it('should reject database order status values', () => {
      // Order statuses from /src/constants/order-status.ts
      const orderStatuses = ORDER_STATUS_VALUES; // All lowercase

      orderStatuses.forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });

        // Currently FAILS because order statuses are lowercase
        // After fix: should PASS because schema will accept lowercase
        expect(result.success).toBe(false); // Proves bug exists
      });
    });
  });

  describe('Title Case status validation - current broken behavior', () => {
    it('currently only accepts Title Case statuses', () => {
      // The schema currently has these hardcoded
      const titleCaseStatuses = [
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ];

      titleCaseStatuses.forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });
        // This currently passes but shouldn't - we want lowercase
        expect(result.success).toBe(true);
      });
    });
  });

  describe('isTerminalStatus function - casing mismatch', () => {
    // REGRESSION TEST: proves bug fix for terminal status detection
    it('should fail to detect lowercase terminal statuses - proves the bug', () => {
      // Terminal statuses from database are lowercase
      const lowercaseTerminalStatuses = [
        SERVICE_STATUSES.COMPLETED,      // 'completed'
        SERVICE_STATUSES.CANCELLED,      // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB   // 'cancelled_dnb'
      ];

      // Current implementation checks Title Case array: ['Completed', 'Cancelled', 'Cancelled-DNB']
      lowercaseTerminalStatuses.forEach(status => {
        const result = isTerminalStatus(status);

        // Currently returns false because lowercase doesn't match Title Case
        // After fix: should return true because function will check lowercase
        expect(result).toBe(false); // Proves bug exists
      });
    });

    it('currently only detects Title Case terminal statuses', () => {
      // The function currently checks for these
      const titleCaseTerminalStatuses = ['Completed', 'Cancelled', 'Cancelled-DNB'];

      titleCaseTerminalStatuses.forEach(status => {
        const result = isTerminalStatus(status);
        // This currently passes but shouldn't - we want lowercase
        expect(result).toBe(true);
      });
    });

    it('should not detect non-terminal statuses regardless of casing', () => {
      const nonTerminalStatuses = [
        'draft', 'Draft',
        'submitted', 'Submitted',
        'processing', 'Processing',
        'missing_info', 'Missing Information'
      ];

      nonTerminalStatuses.forEach(status => {
        const result = isTerminalStatus(status);
        expect(result).toBe(false);
      });
    });
  });

  describe('integration: status constants should match validation', () => {
    it('validation schema rejects all SERVICE_STATUSES constants', () => {
      // This is the bug: constants are lowercase but schema expects Title Case
      Object.values(SERVICE_STATUSES).forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });

        // Currently FAILS (success=false) - proves the mismatch
        // After fix should PASS (success=true)
        expect(result.success).toBe(false); // Proves bug exists
      });
    });

    it('validation schema rejects all ORDER_STATUS_VALUES', () => {
      // Orders and services should use same status values
      ORDER_STATUS_VALUES.forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });

        // Currently FAILS - proves the mismatch
        // After fix should PASS
        expect(result.success).toBe(false); // Proves bug exists
      });
    });
  });

  describe('edge cases', () => {
    it('should reject all case variations except exact Title Case', () => {
      const mixedCaseInputs = [
        { input: 'DRAFT', expected: false },
        { input: 'SUBMITTED', expected: false },
        { input: 'PROCESSING', expected: false },
        { input: 'missing information', expected: false },
        { input: 'COMPLETED', expected: false },
        { input: 'cancelled', expected: false },
        { input: 'Cancelled-Dnb', expected: false },
        // Only exact Title Case passes
        { input: 'Draft', expected: true },
        { input: 'Submitted', expected: true },
        { input: 'Processing', expected: true }
      ];

      mixedCaseInputs.forEach(({ input, expected }) => {
        const result = updateServiceStatusSchema.safeParse({ status: input });
        expect(result.success).toBe(expected);
      });
    });

    it('should handle underscore vs space conversion', () => {
      // Database has 'missing_info', schema expects 'Missing Information'
      const result1 = updateServiceStatusSchema.safeParse({ status: 'missing_info' });
      expect(result1.success).toBe(false); // Currently fails

      const result2 = updateServiceStatusSchema.safeParse({ status: 'Missing Information' });
      expect(result2.success).toBe(true); // Currently passes
    });

    it('should handle hyphen variations in cancelled-dnb', () => {
      // Database has 'cancelled_dnb', schema expects 'Cancelled-DNB'
      const variations = [
        { status: 'cancelled_dnb', expected: false },     // Database format
        { status: 'cancelled-dnb', expected: false },     // Lowercase with hyphen
        { status: 'Cancelled-DNB', expected: true },      // Current schema format - only this passes
        { status: 'CANCELLED_DNB', expected: false },     // Uppercase underscore
        { status: 'CANCELLED-DNB', expected: false }      // Uppercase hyphen
      ];

      variations.forEach(({ status, expected }) => {
        const result = updateServiceStatusSchema.safeParse({ status });
        expect(result.success).toBe(expected);
      });
    });
  });

  describe('comment field validation alongside status', () => {
    it('should validate comment independently of status casing issue', () => {
      const validComment = 'Test comment';
      const tooLongComment = 'x'.repeat(1001);

      // Valid comment with lowercase status (fails on status)
      const result1 = updateServiceStatusSchema.safeParse({
        status: SERVICE_STATUSES.PROCESSING, // 'processing'
        comment: validComment
      });
      expect(result1.success).toBe(false); // Fails on status, not comment

      // Too long comment with Title Case status (fails on comment)
      const result2 = updateServiceStatusSchema.safeParse({
        status: 'Processing',
        comment: tooLongComment
      });
      expect(result2.success).toBe(false); // Should fail on comment length
      if (!result2.success) {
        expect(result2.error.issues.some(issue => issue.message.includes('1000 characters'))).toBe(true);
      }
    });
  });
});