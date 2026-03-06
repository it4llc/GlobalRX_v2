// /GlobalRX_v2/src/lib/validations/service-comment.test.ts

import { describe, it, expect } from 'vitest';
import {
  createServiceCommentSchema,
  updateServiceCommentSchema,
  serviceCommentResponseSchema
} from './service-comment';

describe('Service Comment Validation Schemas', () => {
  describe('createServiceCommentSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'This is a valid comment text',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('should pass with isInternalOnly as false', () => {
        const validData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'This is an external comment',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should default isInternalOnly to true when not provided', () => {
        const validData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'This comment should default to internal'
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.isInternalOnly).toBe(true);
        }
      });

      it('should pass with 1000 character text', () => {
        const longText = 'a'.repeat(1000);
        const validData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: longText
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when templateId is missing', () => {
        const invalidData = {
          finalText: 'This is a comment without template'
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('templateId');
        }
      });

      it('should fail when templateId is not a valid UUID', () => {
        const invalidData = {
          templateId: 'not-a-uuid',
          finalText: 'This is a comment'
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('templateId');
        }
      });

      it('should fail when finalText is missing', () => {
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000'
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('finalText');
        }
      });

      it('should fail when finalText is empty', () => {
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: ''
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('at least 1 character');
        }
      });

      it('should fail when finalText is only whitespace', () => {
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: '   \t\n   '
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('cannot be empty');
        }
      });

      it('should fail when finalText exceeds 1000 characters', () => {
        const longText = 'a'.repeat(1001);
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: longText
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('1000 characters');
        }
      });

      it('should fail when isInternalOnly is not a boolean', () => {
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'This is a comment',
          isInternalOnly: 'yes' as any
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('isInternalOnly');
        }
      });
    });
  });

  describe('updateServiceCommentSchema', () => {
    describe('valid data', () => {
      it('should pass with only finalText', () => {
        const validData = {
          finalText: 'Updated comment text'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with only isInternalOnly', () => {
        const validData = {
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with both fields', () => {
        const validData = {
          finalText: 'Updated comment text',
          isInternalOnly: true
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with empty object (no updates)', () => {
        const validData = {};

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when finalText is empty', () => {
        const invalidData = {
          finalText: ''
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when finalText exceeds 1000 characters', () => {
        const longText = 'a'.repeat(1001);
        const invalidData = {
          finalText: longText
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should not allow updating templateId', () => {
        const invalidData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'Updated text'
        } as any;

        const result = updateServiceCommentSchema.safeParse(invalidData);
        // Should strip out templateId or fail
        if (result.success) {
          expect(result.data).not.toHaveProperty('templateId');
        }
      });

      it('should not allow updating serviceId', () => {
        const invalidData = {
          serviceId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'Updated text'
        } as any;

        const result = updateServiceCommentSchema.safeParse(invalidData);
        // Should strip out serviceId or fail
        if (result.success) {
          expect(result.data).not.toHaveProperty('serviceId');
        }
      });
    });
  });

  describe('serviceCommentResponseSchema', () => {
    describe('valid response data', () => {
      it('should pass with complete comment data', () => {
        const validResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          serviceId: '550e8400-e29b-41d4-a716-446655440001',
          templateId: '550e8400-e29b-41d4-a716-446655440002',
          finalText: 'This is a comment',
          isInternalOnly: true,
          createdBy: '550e8400-e29b-41d4-a716-446655440003',
          createdAt: '2024-03-05T10:00:00Z',
          updatedBy: null,
          updatedAt: null,
          template: {
            shortName: 'DOC_REQ',
            longName: 'Document Required'
          },
          createdByUser: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        const result = serviceCommentResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
      });

      it('should pass with updated comment data', () => {
        const validResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          serviceId: '550e8400-e29b-41d4-a716-446655440001',
          templateId: '550e8400-e29b-41d4-a716-446655440002',
          finalText: 'This is an updated comment',
          isInternalOnly: false,
          createdBy: '550e8400-e29b-41d4-a716-446655440003',
          createdAt: '2024-03-05T10:00:00Z',
          updatedBy: '550e8400-e29b-41d4-a716-446655440004',
          updatedAt: '2024-03-05T11:00:00Z',
          template: {
            shortName: 'STATUS_UPDATE',
            longName: 'Status Update'
          },
          createdByUser: {
            name: 'John Doe',
            email: 'john@example.com'
          },
          updatedByUser: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          }
        };

        const result = serviceCommentResponseSchema.safeParse(validResponse);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid response data', () => {
      it('should fail when required fields are missing', () => {
        const invalidResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          // Missing other required fields
        };

        const result = serviceCommentResponseSchema.safeParse(invalidResponse);
        expect(result.success).toBe(false);
      });

      it('should fail with invalid date format', () => {
        const invalidResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          serviceId: '550e8400-e29b-41d4-a716-446655440001',
          templateId: '550e8400-e29b-41d4-a716-446655440002',
          finalText: 'This is a comment',
          isInternalOnly: true,
          createdBy: '550e8400-e29b-41d4-a716-446655440003',
          createdAt: 'not-a-date',
          updatedBy: null,
          updatedAt: null,
          template: {
            shortName: 'DOC_REQ',
            longName: 'Document Required'
          },
          createdByUser: {
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        const result = serviceCommentResponseSchema.safeParse(invalidResponse);
        expect(result.success).toBe(false);
      });
    });
  });
});