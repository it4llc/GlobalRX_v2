// src/lib/schemas/__tests__/documentIdSchema.test.ts
import { describe, it, expect } from 'vitest';
import { documentIdSchema } from '@/lib/schemas/documentIdSchema';

describe('documentIdSchema', () => {
  describe('valid data', () => {
    it('should pass with valid UUID document ID', () => {
      const validData = { documentId: '123e4567-e89b-12d3-a456-426614174000' };
      const result = documentIdSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it('should pass with uppercase UUID', () => {
      const data = { documentId: '123E4567-E89B-12D3-A456-426614174000' };
      const result = documentIdSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid data', () => {
    it('should fail when documentId is missing', () => {
      const result = documentIdSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail when documentId is not a UUID', () => {
      const invalidIds = [
        { documentId: 'not-a-uuid' },
        { documentId: '12345' },
        { documentId: 'test-id-123' }
      ];

      invalidIds.forEach(data => {
        const result = documentIdSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });

    it('should fail when documentId is wrong type', () => {
      const result = documentIdSchema.safeParse({ documentId: 123 });
      expect(result.success).toBe(false);
    });

    it('should fail when documentId contains spaces', () => {
      const result = documentIdSchema.safeParse({
        documentId: '123e4567-e89b-12d3-a456-426614174000 '
      });
      expect(result.success).toBe(false);
    });
  });
});