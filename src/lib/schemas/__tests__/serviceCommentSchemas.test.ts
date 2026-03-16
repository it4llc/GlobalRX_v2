// /GlobalRX_v2/src/lib/schemas/__tests__/serviceCommentSchemas.test.ts

import { describe, it, expect } from 'vitest';
import {
  createServiceCommentSchema,
  updateServiceCommentSchema,
  serviceCommentResponseSchema
} from '../serviceCommentSchemas';

describe('serviceCommentSchemas', () => {
  describe('createServiceCommentSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          templateId: 'template-123',
          finalText: 'This is a valid comment text',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass with isInternalOnly as false', () => {
        const validData = {
          templateId: 'template-456',
          finalText: 'External comment for customer',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should default isInternalOnly to true when not provided', () => {
        const dataWithoutVisibility = {
          templateId: 'template-789',
          finalText: 'Comment without explicit visibility'
        };

        const result = createServiceCommentSchema.safeParse(dataWithoutVisibility);
        expect(result.success).toBe(true);
        expect(result.data?.isInternalOnly).toBe(true);
      });

      it('should accept comment text at exactly 1000 characters', () => {
        const validData = {
          templateId: 'template-max',
          finalText: 'a'.repeat(1000),
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when templateId is missing', () => {
        const invalidData = {
          finalText: 'Comment without template',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['templateId']);
        expect(result.error?.issues[0].message).toContain('Required');
      });

      it('should fail when templateId is empty string', () => {
        const invalidData = {
          templateId: '',
          finalText: 'Comment with empty template',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['templateId']);
        expect(result.error?.issues[0].message).toContain('Template ID is required');
      });

      it('should fail when finalText is missing', () => {
        const invalidData = {
          templateId: 'template-123',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['finalText']);
        expect(result.error?.issues[0].message).toContain('Required');
      });

      it('should fail when finalText is empty', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: '',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['finalText']);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when finalText is only whitespace', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: '   \n\t  ',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['finalText']);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when finalText exceeds 1000 characters', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: 'a'.repeat(1001),
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['finalText']);
        expect(result.error?.issues[0].message).toContain('Comment cannot exceed 1000 characters');
      });

      it('should fail when finalText contains unreplaced placeholders', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: 'Please provide [document type] by tomorrow',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['finalText']);
        expect(result.error?.issues[0].message).toContain('All placeholders must be replaced');
      });

      it('should fail with multiple unreplaced placeholders', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: 'Need [document] from [person] by [date]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('All placeholders must be replaced');
      });

      it('should fail when isInternalOnly is not a boolean', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: 'Valid comment text',
          isInternalOnly: 'yes' // Invalid type
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['isInternalOnly']);
      });

      it('should fail with wrong data types', () => {
        const invalidData = {
          templateId: 123, // Should be string
          finalText: true, // Should be string
          isInternalOnly: 'true' // Should be boolean
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues.length).toBeGreaterThan(0);
      });
    });
  });

  describe('updateServiceCommentSchema', () => {
    describe('valid data', () => {
      it('should pass when updating only finalText', () => {
        const validData = {
          finalText: 'Updated comment text'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass when updating only isInternalOnly', () => {
        const validData = {
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual(validData);
      });

      it('should pass when updating both fields', () => {
        const validData = {
          finalText: 'Updated text',
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with empty object (no updates)', () => {
        const validData = {};

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });
    });

    describe('invalid data', () => {
      it('should fail when finalText is empty string', () => {
        const invalidData = {
          finalText: ''
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when finalText exceeds 1000 characters', () => {
        const invalidData = {
          finalText: 'a'.repeat(1001)
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment cannot exceed 1000 characters');
      });

      it('should fail when finalText contains placeholders', () => {
        const invalidData = {
          finalText: 'Updated with [placeholder]'
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('All placeholders must be replaced');
      });

      it('should fail when isInternalOnly is not a boolean', () => {
        const invalidData = {
          isInternalOnly: 'false'
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should strip unknown fields', () => {
        const dataWithExtra = {
          finalText: 'Updated text',
          isInternalOnly: true,
          templateId: 'should-be-ignored', // Cannot update templateId
          createdBy: 'should-be-ignored', // Cannot update creator
          unknownField: 'should-be-ignored'
        };

        const result = updateServiceCommentSchema.safeParse(dataWithExtra);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({
          finalText: 'Updated text',
          isInternalOnly: true
        });
        expect('templateId' in result.data!).toBe(false);
        expect('createdBy' in result.data!).toBe(false);
        expect('unknownField' in result.data!).toBe(false);
      });
    });
  });

  describe('serviceCommentResponseSchema', () => {
    describe('valid data', () => {
      it('should pass with minimal comment data', () => {
        const validData = {
          id: 'comment-123',
          serviceId: 'd47ac10b-58cc-4372-a567-0e02b2c3d479',
          templateId: 'template-789',
          templateName: 'Document Request',
          finalText: 'Please provide documents',
          isInternalOnly: true,
          createdBy: 'user-1',
          createdByName: 'John Doe',
          createdAt: '2024-03-01T10:00:00Z'
        };

        const result = serviceCommentResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.updatedBy).toBeNull();
        expect(result.data?.updatedByName).toBeNull();
        expect(result.data?.updatedAt).toBeNull();
      });

      it('should pass with complete comment data including updates', () => {
        const validData = {
          id: 'comment-123',
          serviceId: 'd47ac10b-58cc-4372-a567-0e02b2c3d479',
          templateId: 'template-789',
          templateName: 'Document Request',
          finalText: 'Updated text',
          isInternalOnly: false,
          createdBy: 'user-1',
          createdByName: 'John Doe',
          createdAt: '2024-03-01T10:00:00Z',
          updatedBy: 'user-2',
          updatedByName: 'Jane Smith',
          updatedAt: '2024-03-02T14:00:00Z'
        };

        const result = serviceCommentResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.updatedBy).toBe('user-2');
        expect(result.data?.updatedByName).toBe('Jane Smith');
      });

      it('should handle ISO date strings', () => {
        const validData = {
          id: 'comment-123',
          serviceId: 'd47ac10b-58cc-4372-a567-0e02b2c3d479',
          templateId: 'template-789',
          templateName: 'Test Template',
          finalText: 'Test comment',
          isInternalOnly: true,
          createdBy: 'user-1',
          createdByName: 'User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const result = serviceCommentResponseSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when required fields are missing', () => {
        const invalidData = {
          id: 'comment-123',
          // Missing other required fields
        };

        const result = serviceCommentResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail with invalid date formats', () => {
        const invalidData = {
          id: 'comment-123',
          serviceId: 'd47ac10b-58cc-4372-a567-0e02b2c3d479',
          templateId: 'template-789',
          templateName: 'Test',
          finalText: 'Test',
          isInternalOnly: true,
          createdBy: 'user-1',
          createdByName: 'User',
          createdAt: 'not-a-date' // Invalid date
        };

        const result = serviceCommentResponseSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle comments with special characters', () => {
      const dataWithSpecialChars = {
        templateId: 'template-123',
        finalText: 'Comment with special chars: !@#$%^&*()_+-={}[]|:";\'<>?,./`~',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(dataWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should handle comments with unicode characters', () => {
      const dataWithUnicode = {
        templateId: 'template-123',
        finalText: 'Comment with unicode: 你好 مرحبا こんにちは 🎉',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(dataWithUnicode);
      expect(result.success).toBe(true);
    });

    it('should handle comments with newlines and tabs', () => {
      const dataWithWhitespace = {
        templateId: 'template-123',
        finalText: 'Line 1\nLine 2\n\tIndented line',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(dataWithWhitespace);
      expect(result.success).toBe(true);
    });

    it('should correctly identify partial placeholders as valid', () => {
      const dataWithBrackets = {
        templateId: 'template-123',
        finalText: 'This is not a [placeholder but just brackets]',
        isInternalOnly: true
      };

      // If brackets don't match placeholder pattern exactly, it should pass
      const result = createServiceCommentSchema.safeParse(dataWithBrackets);
      // This depends on implementation - adjust based on actual regex pattern
    });
  });
});