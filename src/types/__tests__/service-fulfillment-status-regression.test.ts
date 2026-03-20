// /GlobalRX_v2/src/types/__tests__/service-fulfillment-status-regression.test.ts

import { describe, it, expect } from 'vitest';
import { updateServiceStatusSchema, isTerminalStatus } from '../service-fulfillment';
import { SERVICE_STATUSES } from '@/constants/service-status';

/**
 * REGRESSION TEST SUITE FOR STATUS CASING BUG
 *
 * These tests MUST FAIL before the fix is applied.
 * They test the EXPECTED behavior (lowercase status values should be valid).
 *
 * The bug:
 * - The Zod schema expects Title Case ('Submitted', 'Processing')
 * - But the constants and database use lowercase ('submitted', 'processing')
 *
 * After fixing the schema to use lowercase, these tests should PASS.
 */
describe('REGRESSION TESTS: Status casing bug - These tests MUST FAIL before fix', () => {

  describe('Bug #1: Constants should be valid but are not', () => {
    it('SERVICE_STATUSES.SUBMITTED should be a valid status value', () => {
      // This is 'submitted' (lowercase) from constants
      const result = updateServiceStatusSchema.safeParse({
        status: SERVICE_STATUSES.SUBMITTED
      });

      // We EXPECT this to be valid, but it's NOT (that's the bug!)
      // This test FAILS with: Expected: true, Received: false
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('submitted');
      }
    });

    it('SERVICE_STATUSES.PROCESSING should be a valid status value', () => {
      // This is 'processing' (lowercase) from constants
      const result = updateServiceStatusSchema.safeParse({
        status: SERVICE_STATUSES.PROCESSING
      });

      // We EXPECT this to be valid, but it's NOT (that's the bug!)
      // This test FAILS with: Expected: true, Received: false
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('processing');
      }
    });

    it('SERVICE_STATUSES.COMPLETED should be a valid status value', () => {
      // This is 'completed' (lowercase) from constants
      const result = updateServiceStatusSchema.safeParse({
        status: SERVICE_STATUSES.COMPLETED
      });

      // We EXPECT this to be valid, but it's NOT (that's the bug!)
      // This test FAILS with: Expected: true, Received: false
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
      }
    });

    it('All SERVICE_STATUSES constants should be valid status values', () => {
      // Every constant should be valid but none are due to the casing mismatch
      const allStatuses = Object.values(SERVICE_STATUSES);

      allStatuses.forEach(status => {
        const result = updateServiceStatusSchema.safeParse({ status });

        // We EXPECT all constants to be valid, but NONE are (that's the bug!)
        // This test FAILS for every status value
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Bug #2: Database values should be valid but are not', () => {
    it('should accept lowercase "draft" from database', () => {
      const databaseValue = 'draft'; // What's actually stored in DB
      const result = updateServiceStatusSchema.safeParse({
        status: databaseValue
      });

      // Database stores lowercase, so this SHOULD be valid
      // But it FAILS because schema expects 'Draft'
      expect(result.success).toBe(true);
    });

    it('should accept lowercase "missing_info" from database', () => {
      const databaseValue = 'missing_info'; // What's actually stored in DB
      const result = updateServiceStatusSchema.safeParse({
        status: databaseValue
      });

      // Database stores lowercase with underscore, so this SHOULD be valid
      // But it FAILS because schema expects 'Missing Information'
      expect(result.success).toBe(true);
    });

    it('should accept lowercase "cancelled_dnb" from database', () => {
      const databaseValue = 'cancelled_dnb'; // What's actually stored in DB
      const result = updateServiceStatusSchema.safeParse({
        status: databaseValue
      });

      // Database stores lowercase with underscore, so this SHOULD be valid
      // But it FAILS because schema expects 'Cancelled-DNB'
      expect(result.success).toBe(true);
    });
  });

  describe('Bug #3: isTerminalStatus fails with database values', () => {
    it('should recognize "completed" as a terminal status', () => {
      // Database stores 'completed' (lowercase)
      const result = isTerminalStatus('completed');

      // This SHOULD return true because completed is terminal
      // But it returns FALSE because function checks for 'Completed'
      expect(result).toBe(true);
    });

    it('should recognize "cancelled" as a terminal status', () => {
      // Database stores 'cancelled' (lowercase)
      const result = isTerminalStatus('cancelled');

      // This SHOULD return true because cancelled is terminal
      // But it returns FALSE because function checks for 'Cancelled'
      expect(result).toBe(true);
    });

    it('should recognize "cancelled_dnb" as a terminal status', () => {
      // Database stores 'cancelled_dnb' (lowercase with underscore)
      const result = isTerminalStatus('cancelled_dnb');

      // This SHOULD return true because cancelled_dnb is terminal
      // But it returns FALSE because function checks for 'Cancelled-DNB'
      expect(result).toBe(true);
    });

    it('should recognize all terminal statuses from constants', () => {
      const terminalStatuses = [
        SERVICE_STATUSES.COMPLETED,      // 'completed'
        SERVICE_STATUSES.CANCELLED,      // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB   // 'cancelled_dnb'
      ];

      terminalStatuses.forEach(status => {
        const result = isTerminalStatus(status);

        // All of these SHOULD be true, but all return FALSE
        expect(result).toBe(true);
      });
    });
  });

  describe('Bug #4: Real-world usage scenarios fail', () => {
    it('should validate a service update with database status and comment', () => {
      // Simulating a real API call with database values
      const updateData = {
        status: SERVICE_STATUSES.PROCESSING, // 'processing' from constants
        comment: 'Starting to process the order'
      };

      const result = updateServiceStatusSchema.safeParse(updateData);

      // This SHOULD be valid for a real update
      // But FAILS because status is lowercase
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('processing');
        expect(result.data.comment).toBe('Starting to process the order');
      }
    });

    it('should validate reopening a terminal status with confirmation', () => {
      // Simulating reopening a completed service
      const updateData = {
        status: SERVICE_STATUSES.SUBMITTED, // 'submitted' from constants
        comment: 'Reopening for additional work',
        confirmReopenTerminal: true
      };

      const result = updateServiceStatusSchema.safeParse(updateData);

      // This SHOULD be valid when reopening
      // But FAILS because status is lowercase
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confirmReopenTerminal).toBe(true);
      }
    });

    it('should work with all valid transitions from constants', () => {
      // Testing common status transitions
      const transitions = [
        { from: SERVICE_STATUSES.DRAFT, to: SERVICE_STATUSES.SUBMITTED },
        { from: SERVICE_STATUSES.SUBMITTED, to: SERVICE_STATUSES.PROCESSING },
        { from: SERVICE_STATUSES.PROCESSING, to: SERVICE_STATUSES.COMPLETED },
        { from: SERVICE_STATUSES.PROCESSING, to: SERVICE_STATUSES.MISSING_INFO },
        { from: SERVICE_STATUSES.MISSING_INFO, to: SERVICE_STATUSES.PROCESSING }
      ];

      transitions.forEach(({ from, to }) => {
        const result = updateServiceStatusSchema.safeParse({ status: to });

        // All transitions SHOULD be valid
        // But ALL FAIL because statuses are lowercase
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Bug #5: Title Case values should NOT be valid (but currently are)', () => {
    it('should reject Title Case "Submitted" (we want lowercase)', () => {
      const result = updateServiceStatusSchema.safeParse({
        status: 'Submitted' // Title Case - NOT what we want
      });

      // We want lowercase only, so Title Case SHOULD fail
      // But it PASSES (that's part of the bug - wrong values accepted)
      expect(result.success).toBe(false);
    });

    it('should reject Title Case "Processing" (we want lowercase)', () => {
      const result = updateServiceStatusSchema.safeParse({
        status: 'Processing' // Title Case - NOT what we want
      });

      // We want lowercase only, so Title Case SHOULD fail
      // But it PASSES (that's part of the bug - wrong values accepted)
      expect(result.success).toBe(false);
    });

    it('should reject "Missing Information" (we want "missing_info")', () => {
      const result = updateServiceStatusSchema.safeParse({
        status: 'Missing Information' // Title Case with space - NOT what we want
      });

      // We want 'missing_info', so this SHOULD fail
      // But it PASSES (that's part of the bug - wrong values accepted)
      expect(result.success).toBe(false);
    });

    it('should reject "Cancelled-DNB" (we want "cancelled_dnb")', () => {
      const result = updateServiceStatusSchema.safeParse({
        status: 'Cancelled-DNB' // Title Case with hyphen - NOT what we want
      });

      // We want 'cancelled_dnb', so this SHOULD fail
      // But it PASSES (that's part of the bug - wrong values accepted)
      expect(result.success).toBe(false);
    });
  });
});

/**
 * Summary of what these regression tests prove:
 *
 * 1. The constants from SERVICE_STATUSES are all lowercase but get rejected
 * 2. Database values (lowercase) get rejected by the schema
 * 3. The isTerminalStatus function doesn't work with database values
 * 4. Real-world API calls would fail validation
 * 5. Title Case values (wrong format) are accepted when they shouldn't be
 *
 * Running these tests NOW will show many failures, proving the bug exists.
 * After fixing the schema to use lowercase, all these tests should pass.
 */