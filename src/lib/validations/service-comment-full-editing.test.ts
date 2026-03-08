// /GlobalRX_v2/src/lib/validations/service-comment-full-editing.test.ts

import { describe, it, expect, vi } from 'vitest';
import {
  createServiceCommentSchema,
  updateServiceCommentSchema
} from './service-comment';

// Mock the text sanitization utilities
vi.mock('@/lib/utils/text-sanitization', () => ({
  sanitizeText: vi.fn((text) => text), // Return text as-is for testing
  isTextSafe: vi.fn(() => true) // Always return true for these tests
}));

describe('service-comment validation - Full Text Editing Feature', () => {
  describe('createServiceCommentSchema - no bracket validation', () => {
    describe('brackets are treated as regular text', () => {
      it('should pass with single opening bracket', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Text with [ bracket',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Text with [ bracket');
      });

      it('should pass with single closing bracket', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Text with ] bracket',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with placeholder-like brackets', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Please provide [document type] by [date]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Please provide [document type] by [date]');
      });

      it('should pass with multiple bracket pairs', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[Field 1] and [Field 2] and [Field 3]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with nested brackets', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Nested [[brackets [inside] brackets]]',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass when entire text is brackets', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[[[[]]]]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with brackets at boundaries', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[starts with bracket and ends with bracket]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('UUID validation for templateId', () => {
      it('should pass with valid UUID', () => {
        const validData = {
          templateId: '550e8400-e29b-41d4-a716-446655440000',
          finalText: 'Valid text with [brackets]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should fail with invalid UUID format', () => {
        const invalidData = {
          templateId: 'not-a-uuid',
          finalText: 'Valid text',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Invalid template ID format');
      });

      it('should fail with missing templateId', () => {
        const invalidData = {
          finalText: 'Text with [brackets]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['templateId']);
      });
    });

    describe('text validation rules', () => {
      it('should fail when text is empty string', () => {
        const invalidData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('String must contain at least 1 character');
      });

      it('should fail when text is only whitespace', () => {
        const invalidData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '   \t\n   ',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text cannot be empty or only whitespace');
      });

      it('should fail when text exceeds 1000 characters', () => {
        const invalidData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[' + 'a'.repeat(999) + ']', // 1001 chars
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text cannot exceed 1000 characters');
      });

      it('should pass with exactly 1000 characters including brackets', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[' + 'a'.repeat(998) + ']', // exactly 1000
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with single non-whitespace character', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'a',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should default isInternalOnly to true when not provided', () => {
        const validData = {
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: 'Text with [brackets]'
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.isInternalOnly).toBe(true);
      });
    });
  });

  describe('updateServiceCommentSchema - no bracket validation', () => {
    describe('brackets in updates', () => {
      it('should pass when updating to text with brackets', () => {
        const validData = {
          finalText: 'Updated with [brackets] now'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Updated with [brackets] now');
      });

      it('should pass when adding brackets to existing text', () => {
        const validData = {
          finalText: 'Previously clean, now has [placeholder]',
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with only brackets as update', () => {
        const validData = {
          finalText: '[][][]'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass when changing from no brackets to brackets', () => {
        const validData = {
          finalText: 'Now includes [field1] and [field2]'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('partial updates', () => {
      it('should pass when only updating isInternalOnly', () => {
        const validData = {
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ isInternalOnly: false });
      });

      it('should pass with empty object (no updates)', () => {
        const validData = {};

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should pass when updating both fields with brackets', () => {
        const validData = {
          finalText: 'Updated [text]',
          isInternalOnly: true
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('validation rules for updates', () => {
      it('should fail when updating to empty text', () => {
        const invalidData = {
          finalText: ''
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('String must contain at least 1 character');
      });

      it('should fail when updating to whitespace only', () => {
        const invalidData = {
          finalText: '   \n\t   '
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text cannot be empty or only whitespace');
      });

      it('should fail when updated text exceeds 1000 characters', () => {
        const invalidData = {
          finalText: '[start]' + 'x'.repeat(994) + '[end]' // 1007 chars
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text cannot exceed 1000 characters');
      });
    });
  });

  describe('complex bracket scenarios', () => {
    it('should handle regex-like patterns with brackets', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Pattern: [a-zA-Z0-9]+',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle JSON-like structures with brackets', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: '{"array": ["item1", "item2"], "key": "value"}',
        isInternalOnly: false
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle SQL-like syntax with brackets', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'SELECT * FROM users WHERE id IN [1, 2, 3]',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle template completely replaced with new text', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'User deleted all template text and wrote this instead with [brackets]',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
      // Template ID is still tracked even though text is completely different
      expect(result.data?.templateId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should handle special characters mixed with brackets', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Special: @[user] #[tag] $[price] %[percent] &[and]',
        isInternalOnly: false
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle international characters with brackets', () => {
      const validData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Unicode: [你好] [مرحبا] [こんにちは] [🎉]',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});