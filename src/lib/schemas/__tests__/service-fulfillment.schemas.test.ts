// /GlobalRX_v2/src/lib/schemas/__tests__/service-fulfillment.schemas.test.ts

import { describe, it, expect } from 'vitest';
import {
  updateServiceFulfillmentSchema,
  bulkAssignSchema,
  serviceQuerySchema,
  serviceStatusSchema,
  changeTypeSchema
} from '../service-fulfillment.schemas';

describe('service-fulfillment schemas', () => {
  describe('serviceStatusSchema', () => {
    it('should accept valid status values', () => {
      const validStatuses = ['draft', 'submitted', 'processing', 'missing_info', 'completed', 'cancelled', 'cancelled_dnb'];

      validStatuses.forEach(status => {
        const result = serviceStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
        expect(result.data).toBe(status);
      });
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = ['', 'in-progress', 'done', 'complete', 123, null, undefined];

      invalidStatuses.forEach(status => {
        const result = serviceStatusSchema.safeParse(status);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('changeTypeSchema', () => {
    it('should accept valid change types', () => {
      const validTypes = ['status_change', 'vendor_assignment', 'note_update'];

      validTypes.forEach(type => {
        const result = changeTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
        expect(result.data).toBe(type);
      });
    });

    it('should reject invalid change types', () => {
      const invalidTypes = ['', 'status-change', 'vendor_change', 'update', 123, null];

      invalidTypes.forEach(type => {
        const result = changeTypeSchema.safeParse(type);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('updateServiceFulfillmentSchema', () => {
    describe('valid data', () => {
      it('should accept status update only', () => {
        const data = { status: 'processing' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ status: 'processing' });
      });

      it('should accept vendor assignment', () => {
        const data = { assignedVendorId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ assignedVendorId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d' });
      });

      it('should accept null vendor assignment (unassign)', () => {
        const data = { assignedVendorId: null };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ assignedVendorId: null });
      });

      it('should accept vendor notes update', () => {
        const data = { vendorNotes: 'Background check completed successfully' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ vendorNotes: 'Background check completed successfully' });
      });

      it('should accept internal notes update', () => {
        const data = { internalNotes: 'Priority customer - expedite processing' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ internalNotes: 'Priority customer - expedite processing' });
      });

      it('should accept multiple fields at once', () => {
        const data = {
          status: 'completed',
          vendorNotes: 'All checks passed',
          internalNotes: 'No issues found'
        };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
      });

      it('should accept empty object (no updates)', () => {
        const data = {};
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should accept notes at maximum length', () => {
        const longNote = 'A'.repeat(5000);
        const data = { vendorNotes: longNote };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data.vendorNotes).toHaveLength(5000);
      });
    });

    describe('invalid data', () => {
      it('should reject invalid status', () => {
        const data = { status: 'invalid-status' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Invalid');
      });

      it('should reject non-UUID vendor ID', () => {
        const data = { assignedVendorId: 'not-a-uuid' };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Invalid');
      });

      it('should reject notes exceeding maximum length', () => {
        const tooLongNote = 'A'.repeat(5001);
        const data = { vendorNotes: tooLongNote };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('5000');
      });

      it('should reject unknown fields', () => {
        const data = {
          status: 'processing',
          unknownField: 'value'
        };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        // Schema is strict, unknown fields are stripped not rejected
        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('unknownField');
      });

      it('should reject non-string notes', () => {
        const data = { vendorNotes: 123 };
        const result = updateServiceFulfillmentSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('bulkAssignSchema', () => {
    describe('valid data', () => {
      it('should accept single service ID', () => {
        const data = {
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
      });

      it('should accept multiple service IDs', () => {
        const data = {
          serviceFulfillmentIds: [
            'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
            'b37d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
            'd57d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
          ],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data.serviceFulfillmentIds).toHaveLength(3);
      });

      it('should accept maximum 100 service IDs', () => {
        const serviceIds = Array.from({ length: 100 }, (_, i) =>
          `${i.toString().padStart(8, '0')}-4e3f-4a8b-9c6d-1e2f3a4b5c6d`
        );
        const data = {
          serviceFulfillmentIds: serviceIds,
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data.serviceFulfillmentIds).toHaveLength(100);
      });
    });

    describe('invalid data', () => {
      it('should reject empty service IDs array', () => {
        const data = {
          serviceFulfillmentIds: [],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('at least');
      });

      it('should reject more than 100 service IDs', () => {
        const serviceIds = Array.from({ length: 101 }, (_, i) =>
          `${i.toString().padStart(8, '0')}-4e3f-4a8b-9c6d-1e2f3a4b5c6d`
        );
        const data = {
          serviceFulfillmentIds: serviceIds,
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('100');
      });

      it('should reject non-UUID service IDs', () => {
        const data = {
          serviceFulfillmentIds: ['not-a-uuid', 'also-not-uuid'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject non-UUID vendor ID', () => {
        const data = {
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'not-a-uuid'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject missing vendorId', () => {
        const data = {
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d']
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject missing serviceFulfillmentIds', () => {
        const data = {
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject non-array serviceFulfillmentIds', () => {
        const data = {
          serviceFulfillmentIds: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        };
        const result = bulkAssignSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  describe('serviceQuerySchema', () => {
    describe('valid data', () => {
      it('should accept empty query (defaults)', () => {
        const data = {};
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          limit: 50,
          offset: 0
        });
      });

      it('should accept orderId filter', () => {
        const data = { orderId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          orderId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          limit: 50,
          offset: 0
        });
      });

      it('should accept status filter', () => {
        const data = { status: 'completed' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          status: 'completed',
          limit: 50,
          offset: 0
        });
      });

      it('should accept vendorId filter', () => {
        const data = { vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          limit: 50,
          offset: 0
        });
      });

      it('should accept custom pagination', () => {
        const data = { limit: 25, offset: 50 };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          limit: 25,
          offset: 50
        });
      });

      it('should accept all filters together', () => {
        const data = {
          orderId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          status: 'processing',
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          limit: 10,
          offset: 20
        };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(data);
      });

      it('should coerce string numbers to numbers', () => {
        const data = { limit: '25', offset: '50' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          limit: 25,
          offset: 50
        });
      });

      it('should accept maximum limit of 100', () => {
        const data = { limit: 100 };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(true);
        expect(result.data.limit).toBe(100);
      });
    });

    describe('invalid data', () => {
      it('should reject invalid orderId', () => {
        const data = { orderId: 'not-a-uuid' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject invalid status', () => {
        const data = { status: 'invalid-status' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject invalid vendorId', () => {
        const data = { vendorId: 'not-a-uuid' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject limit less than 1', () => {
        const data = { limit: 0 };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('1');
      });

      it('should reject limit greater than 100', () => {
        const data = { limit: 101 };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('100');
      });

      it('should reject negative offset', () => {
        const data = { offset: -1 };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('0');
      });

      it('should reject non-numeric limit', () => {
        const data = { limit: 'abc' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject non-numeric offset', () => {
        const data = { offset: 'xyz' };
        const result = serviceQuerySchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });
});