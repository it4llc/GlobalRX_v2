// /GlobalRX_v2/src/lib/schemas/serviceStatusSchemas.test.ts

import { describe, it, expect } from 'vitest';
import {
  serviceStatusUpdateSchema,
  orderLockSchema,
  statusChangeCommentSchema,
  SERVICE_STATUS_VALUES
} from './serviceStatusSchemas';

describe('serviceStatusUpdateSchema', () => {
  describe('valid data', () => {
    it('should pass with valid status only', () => {
      const result = serviceStatusUpdateSchema.safeParse({
        status: 'processing'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('processing');
        expect(result.data.comment).toBeUndefined();
      }
    });

    it('should pass with status and comment', () => {
      const result = serviceStatusUpdateSchema.safeParse({
        status: 'completed',
        comment: 'All checks passed'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
        expect(result.data.comment).toBe('All checks passed');
      }
    });

    it('should accept all valid status values', () => {
      const statuses = [
        'draft',
        'pending',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ];

      statuses.forEach(status => {
        const result = serviceStatusUpdateSchema.safeParse({ status });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(status);
        }
      });
    });
  });

  describe('invalid data', () => {
    it('should fail when status is missing', () => {
      const result = serviceStatusUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('status');
      }
    });

    it('should fail with invalid status value', () => {
      const result = serviceStatusUpdateSchema.safeParse({
        status: 'InvalidStatus'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should fail when comment exceeds 1000 characters', () => {
      const longComment = 'a'.repeat(1001);
      const result = serviceStatusUpdateSchema.safeParse({
        status: 'processing',
        comment: longComment
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('comment');
        expect(result.error.issues[0].message).toContain('1000 characters');
      }
    });

    it('should fail with empty status string', () => {
      const result = serviceStatusUpdateSchema.safeParse({
        status: ''
      });
      expect(result.success).toBe(false);
    });

    it('should fail with wrong data type for status', () => {
      const result = serviceStatusUpdateSchema.safeParse({
        status: 123
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('orderLockSchema', () => {
  describe('valid data', () => {
    it('should pass with all required fields', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 15 * 60 * 1000);

      const result = orderLockSchema.safeParse({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        lockedBy: '987fcdeb-51a2-43d1-9876-543210fedcba',
        lockedAt: now.toISOString(),
        lockExpires: expires.toISOString()
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.lockedBy).toBe('987fcdeb-51a2-43d1-9876-543210fedcba');
      }
    });
  });

  describe('invalid data', () => {
    it('should fail when orderId is missing', () => {
      const result = orderLockSchema.safeParse({
        lockedBy: '987fcdeb-51a2-43d1-9876-543210fedcba',
        lockedAt: new Date().toISOString(),
        lockExpires: new Date(Date.now() + 900000).toISOString()
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('orderId');
      }
    });

    it('should fail when lockedBy is missing', () => {
      const result = orderLockSchema.safeParse({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        lockedAt: new Date().toISOString(),
        lockExpires: new Date(Date.now() + 900000).toISOString()
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('lockedBy');
      }
    });

    it('should fail with invalid UUID format', () => {
      const result = orderLockSchema.safeParse({
        orderId: 'not-a-uuid',
        lockedBy: '987fcdeb-51a2-43d1-9876-543210fedcba',
        lockedAt: new Date().toISOString(),
        lockExpires: new Date(Date.now() + 900000).toISOString()
      });
      expect(result.success).toBe(false);
    });

    it('should fail with invalid date format', () => {
      const result = orderLockSchema.safeParse({
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        lockedBy: '987fcdeb-51a2-43d1-9876-543210fedcba',
        lockedAt: 'invalid-date',
        lockExpires: new Date(Date.now() + 900000).toISOString()
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('statusChangeCommentSchema', () => {
  describe('valid data', () => {
    it('should pass with all status change fields', () => {
      const result = statusChangeCommentSchema.safeParse({
        orderItemId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedFrom: 'draft',
        statusChangedTo: 'processing',
        comment: 'Starting background check process',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isStatusChange).toBe(true);
        expect(result.data.statusChangedFrom).toBe('draft');
        expect(result.data.statusChangedTo).toBe('processing');
      }
    });

    it('should pass with status change and no additional comment', () => {
      const result = statusChangeCommentSchema.safeParse({
        orderItemId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedFrom: 'processing',
        statusChangedTo: 'completed',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.comment).toBeUndefined();
      }
    });
  });

  describe('invalid data', () => {
    it('should fail when isStatusChange is true but statusChangedTo is missing', () => {
      const result = statusChangeCommentSchema.safeParse({
        orderItemId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedFrom: 'draft',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('statusChangedTo');
      }
    });

    it('should fail when isStatusChange is true but statusChangedFrom is missing', () => {
      const result = statusChangeCommentSchema.safeParse({
        orderItemId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedTo: 'processing',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('statusChangedFrom');
      }
    });

    it('should fail with invalid status values in statusChangedTo', () => {
      const result = statusChangeCommentSchema.safeParse({
        orderItemId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedFrom: 'draft',
        statusChangedTo: 'invalid_status',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(false);
    });

    it('should fail when orderItemId is missing', () => {
      const result = statusChangeCommentSchema.safeParse({
        userId: '987fcdeb-51a2-43d1-9876-543210fedcba',
        isStatusChange: true,
        statusChangedFrom: 'draft',
        statusChangedTo: 'processing',
        createdAt: new Date().toISOString()
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path[0]).toBe('orderItemId');
      }
    });
  });
});

describe('SERVICE_STATUS_VALUES', () => {
  it('should contain all eight status values', () => {
    expect(SERVICE_STATUS_VALUES).toHaveLength(8);
    expect(SERVICE_STATUS_VALUES).toContain('draft');
    expect(SERVICE_STATUS_VALUES).toContain('pending');
    expect(SERVICE_STATUS_VALUES).toContain('submitted');
    expect(SERVICE_STATUS_VALUES).toContain('processing');
    expect(SERVICE_STATUS_VALUES).toContain('missing_info');
    expect(SERVICE_STATUS_VALUES).toContain('completed');
    expect(SERVICE_STATUS_VALUES).toContain('cancelled');
    expect(SERVICE_STATUS_VALUES).toContain('cancelled_dnb');
  });

  it('should identify terminal statuses correctly', () => {
    const terminalStatuses = ['completed', 'cancelled', 'cancelled_dnb'];
    const nonTerminalStatuses = ['draft', 'pending', 'submitted', 'processing', 'missing_info'];

    // This assumes there will be a helper function to check terminal status
    // The implementer will need to create this
    terminalStatuses.forEach(status => {
      expect(SERVICE_STATUS_VALUES).toContain(status);
    });

    nonTerminalStatuses.forEach(status => {
      expect(SERVICE_STATUS_VALUES).toContain(status);
    });
  });
});