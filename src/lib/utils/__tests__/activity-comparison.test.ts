/**
 * SOURCE FILES READ LOG
 *
 * Test file: /Users/andyhellman/Projects/GlobalRx_v2/src/lib/utils/__tests__/activity-comparison.test.ts
 * Schema sections read:
 * - prisma/schema.prisma model Order (lines 318-348) - confirmed lastActivityAt field
 * - prisma/schema.prisma model OrderItem (lines 373-396) - confirmed lastActivityAt field
 * - prisma/schema.prisma model OrderView (lines 640-655) - confirmed lastViewedAt field
 * - prisma/schema.prisma model OrderItemView (lines 657-672) - confirmed lastViewedAt field
 *
 * PATTERN MATCH BLOCK
 * Following patterns from: /Users/andyhellman/Projects/GlobalRx_v2/src/lib/utils/__tests__/service-results-utils.test.ts
 * - Import style: vitest describe, it, expect
 * - No mocks needed for pure utility functions
 * - Clear test descriptions
 * - Using fixtures for test data
 */

import { describe, it, expect } from 'vitest';
import { hasNewActivity } from '../activity-comparison';

describe('hasNewActivity utility function', () => {
  describe('when activity is more recent than last view', () => {
    it('returns true when lastActivityAt is more recent than lastViewedAt (both as ISO strings)', () => {
      const lastActivityAt = '2024-01-15T10:00:00.000Z';
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('returns true when lastActivityAt is more recent than lastViewedAt (both as Date objects)', () => {
      const lastActivityAt = new Date('2024-01-15T10:00:00.000Z');
      const lastViewedAt = new Date('2024-01-14T10:00:00.000Z');

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('returns true when lastActivityAt is a string and lastViewedAt is a Date (mixed types)', () => {
      const lastActivityAt = '2024-01-15T10:00:00.000Z';
      const lastViewedAt = new Date('2024-01-14T10:00:00.000Z');

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('returns true when lastActivityAt is a Date and lastViewedAt is a string (mixed types, opposite)', () => {
      const lastActivityAt = new Date('2024-01-15T10:00:00.000Z');
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });
  });

  describe('when activity is older or equal to last view', () => {
    it('returns false when lastActivityAt is older than lastViewedAt', () => {
      const lastActivityAt = '2024-01-13T10:00:00.000Z';
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(false);
    });

    it('returns false when lastActivityAt equals lastViewedAt (strict > comparison, not >=)', () => {
      const lastActivityAt = '2024-01-14T10:00:00.000Z';
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(false);
    });

    it('returns false when timestamps are equal to the millisecond', () => {
      const timestamp = '2024-01-14T10:00:00.123Z';

      const result = hasNewActivity(timestamp, timestamp);

      expect(result).toBe(false);
    });
  });

  describe('when view record does not exist', () => {
    it('returns true when lastActivityAt is present and lastViewedAt is null (never viewed)', () => {
      const lastActivityAt = '2024-01-15T10:00:00.000Z';
      const lastViewedAt = null;

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('returns true when lastActivityAt is present and lastViewedAt is undefined (no view record)', () => {
      const lastActivityAt = '2024-01-15T10:00:00.000Z';
      const lastViewedAt = undefined;

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('returns true for any non-null activity when never viewed (Date object)', () => {
      const lastActivityAt = new Date('2024-01-01T00:00:00.000Z');
      const lastViewedAt = null;

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });
  });

  describe('when there is no activity', () => {
    it('returns false when lastActivityAt is null regardless of lastViewedAt (no activity = no indicator)', () => {
      const lastActivityAt = null;
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(false);
    });

    it('returns false when both lastActivityAt and lastViewedAt are null', () => {
      const lastActivityAt = null;
      const lastViewedAt = null;

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(false);
    });

    it('returns false when lastActivityAt is null and lastViewedAt is undefined', () => {
      const lastActivityAt = null;
      const lastViewedAt = undefined;

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(false);
    });
  });

  describe('edge cases with date parsing', () => {
    it('handles dates with timezone offsets correctly', () => {
      const lastActivityAt = '2024-01-15T10:00:00+05:00';
      const lastViewedAt = '2024-01-15T04:00:00+00:00'; // Earlier in UTC

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });

    it('handles millisecond precision correctly', () => {
      const lastActivityAt = '2024-01-14T10:00:00.001Z';
      const lastViewedAt = '2024-01-14T10:00:00.000Z';

      const result = hasNewActivity(lastActivityAt, lastViewedAt);

      expect(result).toBe(true);
    });
  });

  describe('realistic scenarios from the spec', () => {
    it('shows indicator for order with new activity since last view', () => {
      // Order activity happened today at 2pm
      const orderLastActivityAt = '2024-01-15T14:00:00.000Z';
      // User viewed order yesterday
      const orderViewLastViewedAt = '2024-01-14T09:00:00.000Z';

      const result = hasNewActivity(orderLastActivityAt, orderViewLastViewedAt);

      expect(result).toBe(true);
    });

    it('does not show indicator for order viewed after last activity', () => {
      // Order activity happened yesterday
      const orderLastActivityAt = '2024-01-14T14:00:00.000Z';
      // User viewed order today
      const orderViewLastViewedAt = '2024-01-15T09:00:00.000Z';

      const result = hasNewActivity(orderLastActivityAt, orderViewLastViewedAt);

      expect(result).toBe(false);
    });

    it('shows indicator for order item never viewed by customer', () => {
      // Item has activity
      const itemLastActivityAt = new Date('2024-01-10T10:00:00.000Z');
      // No OrderItemView record exists
      const itemViewLastViewedAt = undefined;

      const result = hasNewActivity(itemLastActivityAt, itemViewLastViewedAt);

      expect(result).toBe(true);
    });

    it('handles order with no activity correctly', () => {
      // New order with no activity yet
      const orderLastActivityAt = null;
      // User has never viewed it
      const orderViewLastViewedAt = undefined;

      const result = hasNewActivity(orderLastActivityAt, orderViewLastViewedAt);

      expect(result).toBe(false);
    });
  });
});