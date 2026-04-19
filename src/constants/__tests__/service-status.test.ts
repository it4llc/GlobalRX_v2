// /GlobalRX_v2/src/constants/__tests__/service-status.test.ts

// REGRESSION TEST: proves bug fix for removing pending status from services
// This test will FAIL before the fix (because 'pending' is still in SERVICE_STATUSES)
// This test will PASS after the fix (when 'pending' is removed from SERVICE_STATUSES)
// DO NOT DELETE THIS TEST - it prevents the bug from being reintroduced

import { describe, it, expect } from 'vitest';
import {
  SERVICE_STATUSES,
  SERVICE_STATUS_VALUES,
  SERVICE_STATUS_DISPLAY_ORDER,
  isValidServiceStatus,
  type ServiceStatus
} from '../service-status';

describe('Service Status Constants', () => {

  describe('REGRESSION TEST - Service statuses should match order statuses', () => {
    it('should NOT include "pending" status - services should match order statuses exactly', () => {
      // REGRESSION TEST: This test proves the bug exists and prevents it from returning
      // Bug: Service statuses included 'pending' while order statuses don't
      // Fix: Remove 'pending' from service statuses to match order statuses

      // Assert that 'pending' should NOT be in SERVICE_STATUSES
      expect(SERVICE_STATUSES.PENDING).toBeUndefined();

      // Assert that 'pending' should NOT be in the values array
      expect(SERVICE_STATUS_VALUES).not.toContain('pending');

      // Assert the exact list of statuses that SHOULD exist (matching order statuses)
      const expectedStatuses = [
        'draft',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ];

      expect(SERVICE_STATUS_VALUES).toHaveLength(7); // Not 8!
      expect(SERVICE_STATUS_VALUES).toEqual(expect.arrayContaining(expectedStatuses));
      expect(SERVICE_STATUS_VALUES).toHaveLength(expectedStatuses.length);
    });

    it('should not have PENDING constant defined', () => {
      // REGRESSION TEST: Ensure the PENDING constant is completely removed
      const statusKeys = Object.keys(SERVICE_STATUSES);
      expect(statusKeys).not.toContain('PENDING');
    });

    it('should not include pending in display order', () => {
      // REGRESSION TEST: Ensure pending is not in the display order
      expect(SERVICE_STATUS_DISPLAY_ORDER).not.toContain('pending');
      expect(SERVICE_STATUS_DISPLAY_ORDER).toHaveLength(7); // Not 8!
    });

    // Status colors test removed - colors moved to src/lib/status-colors.ts
  });

  describe('SERVICE_STATUSES object', () => {
    it('should contain exactly 7 status constants', () => {
      const statusKeys = Object.keys(SERVICE_STATUSES);
      expect(statusKeys).toHaveLength(7);
    });

    it('should have the correct status values', () => {
      expect(SERVICE_STATUSES.DRAFT).toBe('draft');
      expect(SERVICE_STATUSES.SUBMITTED).toBe('submitted');
      expect(SERVICE_STATUSES.PROCESSING).toBe('processing');
      expect(SERVICE_STATUSES.MISSING_INFO).toBe('missing_info');
      expect(SERVICE_STATUSES.COMPLETED).toBe('completed');
      expect(SERVICE_STATUSES.CANCELLED).toBe('cancelled');
      expect(SERVICE_STATUSES.CANCELLED_DNB).toBe('cancelled_dnb');
    });

    it('should use lowercase values for database consistency', () => {
      Object.values(SERVICE_STATUSES).forEach(status => {
        expect(status).toBe(status.toLowerCase());
      });
    });
  });

  describe('SERVICE_STATUS_VALUES array', () => {
    it('should contain all status values', () => {
      expect(SERVICE_STATUS_VALUES).toEqual([
        'draft',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ]);
    });

    it('should match the values from SERVICE_STATUSES', () => {
      const objectValues = Object.values(SERVICE_STATUSES);
      expect(SERVICE_STATUS_VALUES).toEqual(expect.arrayContaining(objectValues));
      expect(SERVICE_STATUS_VALUES).toHaveLength(objectValues.length);
    });
  });

  describe('SERVICE_STATUS_DISPLAY_ORDER', () => {
    it('should define the correct workflow progression', () => {
      expect(SERVICE_STATUS_DISPLAY_ORDER).toEqual([
        'draft',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ]);
    });

    it('should include all valid statuses', () => {
      SERVICE_STATUS_VALUES.forEach(status => {
        expect(SERVICE_STATUS_DISPLAY_ORDER).toContain(status);
      });
    });

    it('should not include any invalid statuses', () => {
      SERVICE_STATUS_DISPLAY_ORDER.forEach(status => {
        expect(SERVICE_STATUS_VALUES).toContain(status);
      });
    });
  });

  // SERVICE_STATUS_COLORS tests removed - functionality moved to src/lib/status-colors.ts

  describe('isValidServiceStatus helper', () => {
    it('should return true for valid statuses', () => {
      expect(isValidServiceStatus('draft')).toBe(true);
      expect(isValidServiceStatus('submitted')).toBe(true);
      expect(isValidServiceStatus('processing')).toBe(true);
      expect(isValidServiceStatus('missing_info')).toBe(true);
      expect(isValidServiceStatus('completed')).toBe(true);
      expect(isValidServiceStatus('cancelled')).toBe(true);
      expect(isValidServiceStatus('cancelled_dnb')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      // REGRESSION TEST: 'pending' should be invalid
      expect(isValidServiceStatus('pending')).toBe(false);

      expect(isValidServiceStatus('invalid')).toBe(false);
      expect(isValidServiceStatus('DRAFT')).toBe(false); // Case sensitive
      expect(isValidServiceStatus('')).toBe(false);
      expect(isValidServiceStatus('undefined')).toBe(false);
    });

    it('should provide type narrowing', () => {
      const testStatus: string = 'draft';
      if (isValidServiceStatus(testStatus)) {
        // TypeScript should now know testStatus is ServiceStatus
        const validStatus: ServiceStatus = testStatus;
        expect(validStatus).toBe('draft');
      }
    });
  });

  // getStatusColor tests removed - functionality moved to src/lib/status-colors.ts

  describe('TypeScript types', () => {
    it('should only allow valid status values in ServiceStatus type', () => {
      // This is a compile-time test, but we can test runtime behavior
      const validStatuses: ServiceStatus[] = [
        'draft',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ];

      expect(validStatuses).toHaveLength(7);
      validStatuses.forEach(status => {
        expect(SERVICE_STATUS_VALUES).toContain(status);
      });
    });
  });

  describe('Edge case: Dashboard virtual pending filter compatibility', () => {
    it('should still support combining submitted and processing for virtual pending', () => {
      // The dashboard uses a virtual 'pending' filter that combines submitted + processing
      // This should continue to work even after removing 'pending' as a real status

      const virtualPendingStatuses = [
        SERVICE_STATUSES.SUBMITTED,
        SERVICE_STATUSES.PROCESSING
      ];

      expect(virtualPendingStatuses).toEqual(['submitted', 'processing']);
      expect(virtualPendingStatuses).toHaveLength(2);

      // Both statuses should be valid
      virtualPendingStatuses.forEach(status => {
        expect(isValidServiceStatus(status)).toBe(true);
      });
    });
  });
});