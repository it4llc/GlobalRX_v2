// /GlobalRX_v2/src/lib/schemas/__tests__/serviceResultsSchemas.test.ts

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define the schemas that will be implemented
const updateServiceResultsSchema = z.object({
  results: z.string().nullable().optional()
});

const serviceAttachmentSchema = z.object({
  id: z.number(),
  serviceFulfillmentId: z.number(),
  fileName: z.string().min(1, 'File name is required').max(255),
  filePath: z.string().min(1, 'File path is required').max(500),
  fileSize: z.number().positive().max(5 * 1024 * 1024, 'File size cannot exceed 5MB'),
  uploadedBy: z.number(),
  uploadedAt: z.date()
});

const uploadAttachmentSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.type === 'application/pdf',
    'File must be a PDF'
  ).refine(
    (file) => file.size <= 5 * 1024 * 1024,
    'File size cannot exceed 5MB'
  )
});

describe('Service Results Schemas', () => {
  describe('updateServiceResultsSchema', () => {
    describe('valid data', () => {
      it('should accept valid results text', () => {
        const data = { results: 'Background check completed. No issues found.' };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.results).toBe('Background check completed. No issues found.');
        }
      });

      it('should accept null results to clear them', () => {
        const data = { results: null };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.results).toBe(null);
        }
      });

      it('should accept empty object (no update to results)', () => {
        const data = {};
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.results).toBeUndefined();
        }
      });

      it('should accept very long results text', () => {
        const longText = 'a'.repeat(10000);
        const data = { results: longText };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.results).toBe(longText);
        }
      });

      it('should accept results with special characters', () => {
        const data = {
          results: 'Results: 100% complete\n\n• Item 1\n• Item 2\n\nNotes: Subject\'s record #123-456'
        };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should reject non-string results', () => {
        const data = { results: 123 };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject results as an object', () => {
        const data = { results: { text: 'some results' } };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject results as an array', () => {
        const data = { results: ['result1', 'result2'] };
        const result = updateServiceResultsSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('serviceAttachmentSchema', () => {
    describe('valid data', () => {
      it('should accept valid attachment data', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'background_check.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440001/service-456/abc123_background_check.pdf',
          fileSize: 1024 * 500, // 500 KB
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should accept maximum file size (5MB)', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'large_report.pdf',
          filePath: 'uploads/service-results/550e8400-e29b-41d4-a716-446655440001/service-456/large_report.pdf',
          fileSize: 5 * 1024 * 1024, // Exactly 5MB
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should reject missing required fields', () => {
        const data = {
          fileName: 'test.pdf'
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject empty file name', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: '',
          filePath: 'uploads/test.pdf',
          fileSize: 1024,
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject file name longer than 255 characters', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'a'.repeat(256),
          filePath: 'uploads/test.pdf',
          fileSize: 1024,
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject file path longer than 500 characters', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'test.pdf',
          filePath: 'a'.repeat(501),
          fileSize: 1024,
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject file size over 5MB', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'huge.pdf',
          filePath: 'uploads/huge.pdf',
          fileSize: 5 * 1024 * 1024 + 1, // 5MB + 1 byte
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject zero or negative file size', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'test.pdf',
          filePath: 'uploads/test.pdf',
          fileSize: 0,
          uploadedBy: 10,
          uploadedAt: new Date()
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject invalid date', () => {
        const data = {
          id: 1,
          serviceFulfillmentId: 100,
          fileName: 'test.pdf',
          filePath: 'uploads/test.pdf',
          fileSize: 1024,
          uploadedBy: 10,
          uploadedAt: 'not-a-date'
        };
        const result = serviceAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('uploadAttachmentSchema', () => {
    describe('valid data', () => {
      it('should accept valid PDF file', () => {
        // Mock File object
        const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
        Object.defineProperty(file, 'size', { value: 1024 * 100 }); // 100KB

        const data = { file };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should accept PDF file at maximum size', () => {
        const file = new File(['content'], 'large.pdf', { type: 'application/pdf' });
        Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // Exactly 5MB

        const data = { file };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should reject non-PDF file', () => {
        const file = new File(['content'], 'test.doc', { type: 'application/msword' });
        Object.defineProperty(file, 'size', { value: 1024 });

        const data = { file };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('File must be a PDF');
        }
      });

      it('should reject image files', () => {
        const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
        Object.defineProperty(file, 'size', { value: 1024 });

        const data = { file };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject PDF file over 5MB', () => {
        const file = new File(['content'], 'huge.pdf', { type: 'application/pdf' });
        Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 }); // 5MB + 1 byte

        const data = { file };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].message).toBe('File size cannot exceed 5MB');
        }
      });

      it('should reject missing file', () => {
        const data = {};
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should reject null file', () => {
        const data = { file: null };
        const result = uploadAttachmentSchema.safeParse(data);
        expect(result.success).toBe(false);
      });
    });
  });
});