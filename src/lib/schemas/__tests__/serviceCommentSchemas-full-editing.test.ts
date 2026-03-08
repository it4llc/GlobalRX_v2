// /GlobalRX_v2/src/lib/schemas/__tests__/serviceCommentSchemas-full-editing.test.ts

import { describe, it, expect } from 'vitest';
import {
  createServiceCommentSchema,
  updateServiceCommentSchema
} from '../serviceCommentSchemas';

describe('serviceCommentSchemas - Full Text Editing Feature', () => {
  describe('createServiceCommentSchema - bracket validation removed', () => {
    describe('valid data with brackets', () => {
      it('should pass when text contains opening bracket only', () => {
        const validData = {
          templateId: 'template-123',
          finalText: 'Please provide [document by tomorrow',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Please provide [document by tomorrow');
      });

      it('should pass when text contains closing bracket only', () => {
        const validData = {
          templateId: 'template-456',
          finalText: 'Document received] and processed',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Document received] and processed');
      });

      it('should pass when text contains matched brackets like placeholder', () => {
        const validData = {
          templateId: 'template-789',
          finalText: 'Please provide [driver license] by [end of day]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Please provide [driver license] by [end of day]');
      });

      it('should pass when text contains multiple unmatched brackets', () => {
        const validData = {
          templateId: 'template-abc',
          finalText: 'Notes: [incomplete] data [missing fields]] [[[extra brackets',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Notes: [incomplete] data [missing fields]] [[[extra brackets');
      });

      it('should pass when text is entirely brackets', () => {
        const validData = {
          templateId: 'template-xyz',
          finalText: '[[[[[]]]]]]',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('[[[[[]]]]]]');
      });

      it('should pass when brackets are mixed with special characters', () => {
        const validData = {
          templateId: 'template-special',
          finalText: 'Data [field1]: value, {field2}: [value2], <field3>: [value3]',
          isInternalOnly: false
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass when user completely removes template text and enters new text with brackets', () => {
        const validData = {
          templateId: 'template-replaced',
          finalText: 'Completely new text with [my own brackets] here',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Completely new text with [my own brackets] here');
      });
    });

    describe('standard validation rules still apply', () => {
      it('should fail when text is empty', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: '',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when text is only whitespace', () => {
        const invalidData = {
          templateId: 'template-123',
          finalText: '   \n\t  ',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when text exceeds 1000 characters even with brackets', () => {
        const longTextWithBrackets = '[start]' + 'a'.repeat(990) + '[end]';
        const invalidData = {
          templateId: 'template-123',
          finalText: longTextWithBrackets,
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment cannot exceed 1000 characters');
      });

      it('should pass when text is exactly 1000 characters with brackets', () => {
        const exactText = '[' + 'a'.repeat(998) + ']';
        const validData = {
          templateId: 'template-123',
          finalText: exactText,
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should still require templateId', () => {
        const invalidData = {
          finalText: 'Text with [brackets] is fine',
          isInternalOnly: true
        };

        const result = createServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].path).toEqual(['templateId']);
      });

      it('should default isInternalOnly to true', () => {
        const validData = {
          templateId: 'template-123',
          finalText: 'Comment with [brackets] without visibility setting'
        };

        const result = createServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.isInternalOnly).toBe(true);
      });
    });
  });

  describe('updateServiceCommentSchema - bracket validation removed', () => {
    describe('valid updates with brackets', () => {
      it('should pass when updating text to include brackets', () => {
        const validData = {
          finalText: 'Updated text with [new brackets] added'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data?.finalText).toBe('Updated text with [new brackets] added');
      });

      it('should pass when updating text with only brackets', () => {
        const validData = {
          finalText: '[[[updated]]]'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass when adding brackets to existing text', () => {
        const validData = {
          finalText: 'Previously clean text now has [placeholder] values',
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with complex bracket patterns', () => {
        const validData = {
          finalText: 'Array notation: items[0], items[1], dictionary["key"]'
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('standard validation rules still apply', () => {
      it('should fail when updating to empty text', () => {
        const invalidData = {
          finalText: ''
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when updating to only whitespace', () => {
        const invalidData = {
          finalText: '   \n\t  '
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment text is required');
      });

      it('should fail when updated text exceeds 1000 characters with brackets', () => {
        const invalidData = {
          finalText: '[' + 'x'.repeat(1000) + ']'
        };

        const result = updateServiceCommentSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('Comment cannot exceed 1000 characters');
      });

      it('should pass with empty object (no updates)', () => {
        const validData = {};

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should pass when only updating isInternalOnly', () => {
        const validData = {
          isInternalOnly: false
        };

        const result = updateServiceCommentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ isInternalOnly: false });
      });
    });
  });

  describe('edge cases with brackets', () => {
    it('should handle nested brackets correctly', () => {
      const validData = {
        templateId: 'template-nested',
        finalText: 'Data [[nested [deep [deeper]]]] structure',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle brackets in different languages', () => {
      const validData = {
        templateId: 'template-intl',
        finalText: '【Japanese brackets】〖Chinese〗「quotes」[English]',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle mathematical notation with brackets', () => {
      const validData = {
        templateId: 'template-math',
        finalText: 'Formula: f(x) = [a + b] * [c - d] / [e]',
        isInternalOnly: false
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle code snippets with brackets', () => {
      const validData = {
        templateId: 'template-code',
        finalText: 'Code: const arr = [1, 2, 3]; obj["key"] = value;',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should handle markdown-style links with brackets', () => {
      const validData = {
        templateId: 'template-markdown',
        finalText: 'See [this link](http://example.com) and [another][ref]',
        isInternalOnly: false
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should track templateId even when text is completely different from template', () => {
      const validData = {
        templateId: 'original-template-id',
        finalText: 'This text has nothing to do with the original template',
        isInternalOnly: true
      };

      const result = createServiceCommentSchema.safeParse(validData);
      expect(result.success).toBe(true);
      expect(result.data?.templateId).toBe('original-template-id');
    });
  });
});