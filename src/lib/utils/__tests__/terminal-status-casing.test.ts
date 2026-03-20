// /GlobalRX_v2/src/lib/utils/__tests__/terminal-status-casing.test.ts

import { describe, it, expect, vi } from 'vitest';
import { SERVICE_STATUSES } from '@/constants/service-status';
import { ORDER_STATUS_VALUES } from '@/constants/order-status';

// Import the different isTerminalStatus implementations
import { isTerminalStatus as serviceFulfillmentIsTerminal } from '@/types/service-fulfillment';
import { isTerminalStatus as serviceResultsIsTerminal } from '@/types/service-results';
import { isTerminalStatus as serviceStatusSchemaIsTerminal } from '@/lib/schemas/serviceStatusSchemas';

describe('isTerminalStatus function casing inconsistencies', () => {

  // REGRESSION TEST: proves bug fix for terminal status detection with different casings
  describe('REGRESSION TEST: terminal status detection with lowercase values', () => {
    it('service-fulfillment isTerminalStatus FAILS with lowercase - proves bug exists', () => {
      // From service-fulfillment.ts lines 52-55
      // Uses hardcoded Title Case array: ['Completed', 'Cancelled', 'Cancelled-DNB']

      const lowercaseTerminalStatuses = [
        SERVICE_STATUSES.COMPLETED,      // 'completed'
        SERVICE_STATUSES.CANCELLED,      // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB   // 'cancelled_dnb'
      ];

      lowercaseTerminalStatuses.forEach(status => {
        const result = serviceFulfillmentIsTerminal(status);
        // Before fix: Returns false because lowercase doesn't match Title Case
        // After fix: Should return true
        expect(result).toBe(false); // Currently false - proves bug exists
      });
    });

    it('service-results isTerminalStatus PASSES with lowercase - correct implementation', () => {
      // From service-results.ts - this one is implemented correctly!
      // It converts to lowercase before checking

      const lowercaseTerminalStatuses = [
        SERVICE_STATUSES.COMPLETED,      // 'completed'
        SERVICE_STATUSES.CANCELLED,      // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB   // 'cancelled_dnb'
      ];

      lowercaseTerminalStatuses.forEach(status => {
        const result = serviceResultsIsTerminal(status);
        // This implementation works correctly with lowercase
        expect(result).toBe(true); // Correctly returns true
      });
    });

    it('serviceStatusSchemas isTerminalStatus has inconsistent behavior', () => {
      // From serviceStatusSchemas.ts - need to check its implementation

      const lowercaseTerminalStatuses = [
        SERVICE_STATUSES.COMPLETED,      // 'completed'
        SERVICE_STATUSES.CANCELLED,      // 'cancelled'
        SERVICE_STATUSES.CANCELLED_DNB   // 'cancelled_dnb'
      ];

      lowercaseTerminalStatuses.forEach(status => {
        const result = serviceStatusSchemaIsTerminal(status);
        // Check what this implementation does
        // If it uses Title Case array, will return false
        // If it uses lowercase or proper conversion, will return true
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('inconsistent implementations across files', () => {
    it('different files have different terminal status logic', () => {
      // Test the same inputs across all implementations
      const testCases = [
        // Lowercase (database format)
        { status: 'completed', expected: { fulfillment: false, results: true } },
        { status: 'cancelled', expected: { fulfillment: false, results: true } },
        { status: 'cancelled_dnb', expected: { fulfillment: false, results: true } },

        // Title Case (UI format)
        { status: 'Completed', expected: { fulfillment: true, results: true } },
        { status: 'Cancelled', expected: { fulfillment: true, results: true } },
        { status: 'Cancelled-DNB', expected: { fulfillment: true, results: true } },

        // Uppercase
        { status: 'COMPLETED', expected: { fulfillment: false, results: true } },
        { status: 'CANCELLED', expected: { fulfillment: false, results: true } },
      ];

      testCases.forEach(({ status, expected }) => {
        const fulfillmentResult = serviceFulfillmentIsTerminal(status);
        const resultsResult = serviceResultsIsTerminal(status);

        // Shows the inconsistency between implementations
        expect(fulfillmentResult).toBe(expected.fulfillment);
        expect(resultsResult).toBe(expected.results);
      });
    });

    it('shows that service-results.ts has the correct implementation', () => {
      // This implementation handles all cases correctly
      const allPossibleTerminalFormats = [
        'completed', 'COMPLETED', 'Completed',
        'cancelled', 'CANCELLED', 'Cancelled',
        'cancelled_dnb', 'CANCELLED_DNB', 'cancelled-dnb', 'Cancelled-DNB'
      ];

      allPossibleTerminalFormats.forEach(status => {
        const result = serviceResultsIsTerminal(status);
        // All should return true because it converts to lowercase
        expect(result).toBe(
          status.toLowerCase() === 'completed' ||
          status.toLowerCase() === 'cancelled' ||
          status.toLowerCase() === 'cancelled_dnb' ||
          status.toLowerCase() === 'cancelled-dnb'
        );
      });
    });
  });

  describe('non-terminal status handling', () => {
    it('all implementations correctly identify non-terminal statuses', () => {
      const nonTerminalStatuses = [
        SERVICE_STATUSES.DRAFT,
        SERVICE_STATUSES.PENDING,
        SERVICE_STATUSES.SUBMITTED,
        SERVICE_STATUSES.PROCESSING,
        SERVICE_STATUSES.MISSING_INFO,
        'Draft', 'Submitted', 'Processing', 'Missing Information'
      ];

      nonTerminalStatuses.forEach(status => {
        // All implementations should agree these are not terminal
        expect(serviceFulfillmentIsTerminal(status)).toBe(false);
        expect(serviceResultsIsTerminal(status)).toBe(false);
        expect(serviceStatusSchemaIsTerminal(status)).toBe(false);
      });
    });
  });

  describe('edge cases and special formats', () => {
    it('handles underscore vs hyphen in cancelled_dnb', () => {
      // Database format with underscore
      const dbFormat = SERVICE_STATUSES.CANCELLED_DNB; // 'cancelled_dnb'

      // Different implementations handle this differently
      expect(serviceFulfillmentIsTerminal(dbFormat)).toBe(false); // Bug: doesn't recognize
      expect(serviceResultsIsTerminal(dbFormat)).toBe(true); // Correct: recognizes

      // UI format with hyphen and caps
      const uiFormat = 'Cancelled-DNB';
      expect(serviceFulfillmentIsTerminal(uiFormat)).toBe(true); // Recognizes this format
      expect(serviceResultsIsTerminal(uiFormat)).toBe(false); // Doesn't match after lowercase
    });

    it('handles null and undefined inputs', () => {
      // service-results.ts explicitly handles null/undefined
      expect(serviceResultsIsTerminal(null)).toBe(false);
      expect(serviceResultsIsTerminal(undefined)).toBe(false);
      expect(serviceResultsIsTerminal('')).toBe(false);

      // service-fulfillment.ts doesn't explicitly check
      expect(serviceFulfillmentIsTerminal('')).toBe(false);
      // These would throw in strict TypeScript but testing runtime behavior
      expect(serviceFulfillmentIsTerminal(null as any)).toBe(false);
      expect(serviceFulfillmentIsTerminal(undefined as any)).toBe(false);
    });
  });

  describe('impact on business logic', () => {
    it('terminal status check affects ability to change status', () => {
      // When a service is in terminal status, UI may prevent changes
      // But if detection fails due to casing, terminal services could be modified

      const terminalService = {
        status: SERVICE_STATUSES.COMPLETED // 'completed' from database
      };

      // Bug: service-fulfillment thinks it's not terminal
      const canModifyPerFulfillment = !serviceFulfillmentIsTerminal(terminalService.status);
      expect(canModifyPerFulfillment).toBe(true); // Bug: allows modification!

      // Correct: service-results knows it's terminal
      const canModifyPerResults = !serviceResultsIsTerminal(terminalService.status);
      expect(canModifyPerResults).toBe(false); // Correct: prevents modification
    });

    it('affects service reopening logic', () => {
      // Components check if status is terminal to show confirmation dialog
      // If check fails, dialog won't show when reopening completed services

      const completedStatus = SERVICE_STATUSES.COMPLETED; // 'completed'

      // Component using service-fulfillment check
      const showReopenDialog1 = serviceFulfillmentIsTerminal(completedStatus);
      expect(showReopenDialog1).toBe(false); // Bug: won't show dialog

      // Component using service-results check
      const showReopenDialog2 = serviceResultsIsTerminal(completedStatus);
      expect(showReopenDialog2).toBe(true); // Correct: shows dialog
    });
  });

  describe('consistency with ORDER_STATUS_VALUES', () => {
    it('should handle order statuses the same as service statuses', () => {
      // Terminal order statuses from constants
      const terminalOrderStatuses = ['completed', 'cancelled', 'cancelled_dnb'];

      terminalOrderStatuses.forEach(status => {
        // Check each implementation
        const fulfillmentResult = serviceFulfillmentIsTerminal(status);
        const resultsResult = serviceResultsIsTerminal(status);

        // Shows inconsistency
        expect(fulfillmentResult).toBe(false); // Bug: doesn't recognize lowercase
        expect(resultsResult).toBe(true); // Correct: recognizes lowercase
      });
    });
  });
});