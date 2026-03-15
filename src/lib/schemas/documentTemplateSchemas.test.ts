// /GlobalRX_v2/src/lib/schemas/documentTemplateSchemas.test.ts
// Unit tests for PDF template download validation schemas

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define the schema that will be tested
const documentTemplateParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
});

const documentTemplateMetadataSchema = z.object({
  hasTemplate: z.boolean(),
  pdfPath: z.string().nullable(),
  filename: z.string().nullable(),
  fileSize: z.number().min(0).nullable()
});

describe('documentTemplateSchemas', () => {
  describe('documentTemplateParamsSchema', () => {
    describe('valid data', () => {
      it('should pass with valid UUID document ID', () => {
        const validData = {
          documentId: '123e4567-e89b-12d3-a456-426614174000'
        };

        const result = documentTemplateParamsSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.documentId).toBe(validData.documentId);
        }
      });

      it('should pass with different valid UUID formats', () => {
        const uuids = [
          '550e8400-e29b-41d4-a716-446655440000',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        ];

        uuids.forEach(uuid => {
          const result = documentTemplateParamsSchema.safeParse({ documentId: uuid });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('invalid data', () => {
      it('should fail when documentId is missing', () => {
        const result = documentTemplateParamsSchema.safeParse({});
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Required');
        }
      });

      it('should fail when documentId is not a UUID', () => {
        const invalidIds = [
          { documentId: '123' },
          { documentId: 'not-a-uuid' },
          { documentId: '12345678-1234-1234-1234-12345678901g' }, // Invalid character
          { documentId: '12345678-1234-1234-1234-123456789' }, // Too short
          { documentId: '' }
        ];

        invalidIds.forEach(data => {
          const result = documentTemplateParamsSchema.safeParse(data);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues[0].message).toContain('Invalid document ID format');
          }
        });
      });

      it('should fail when documentId is null', () => {
        const result = documentTemplateParamsSchema.safeParse({ documentId: null });
        expect(result.success).toBe(false);
      });

      it('should fail when documentId is undefined', () => {
        const result = documentTemplateParamsSchema.safeParse({ documentId: undefined });
        expect(result.success).toBe(false);
      });

      it('should fail when documentId is wrong type', () => {
        const wrongTypes = [
          { documentId: 123 },
          { documentId: true },
          { documentId: [] },
          { documentId: {} }
        ];

        wrongTypes.forEach(data => {
          const result = documentTemplateParamsSchema.safeParse(data);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe('documentTemplateMetadataSchema', () => {
    describe('valid data', () => {
      it('should pass with all fields populated', () => {
        const validData = {
          hasTemplate: true,
          pdfPath: '/uploads/templates/form-123.pdf',
          filename: 'employment-verification.pdf',
          fileSize: 2500000
        };

        const result = documentTemplateMetadataSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('should pass with null optional fields', () => {
        const validData = {
          hasTemplate: false,
          pdfPath: null,
          filename: null,
          fileSize: null
        };

        const result = documentTemplateMetadataSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with template available', () => {
        const validData = {
          hasTemplate: true,
          pdfPath: '/path/to/template.pdf',
          filename: 'template.pdf',
          fileSize: 1024000
        };

        const result = documentTemplateMetadataSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with zero file size', () => {
        const validData = {
          hasTemplate: true,
          pdfPath: '/empty.pdf',
          filename: 'empty.pdf',
          fileSize: 0
        };

        const result = documentTemplateMetadataSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when hasTemplate is missing', () => {
        const data = {
          pdfPath: '/path.pdf',
          filename: 'file.pdf',
          fileSize: 1000
        };

        const result = documentTemplateMetadataSchema.safeParse(data);
        expect(result.success).toBe(false);
      });

      it('should fail when hasTemplate is not boolean', () => {
        const invalidData = [
          { hasTemplate: 'true', pdfPath: null, filename: null, fileSize: null },
          { hasTemplate: 1, pdfPath: null, filename: null, fileSize: null },
          { hasTemplate: null, pdfPath: null, filename: null, fileSize: null }
        ];

        invalidData.forEach(data => {
          const result = documentTemplateMetadataSchema.safeParse(data);
          expect(result.success).toBe(false);
        });
      });

      it('should fail when fileSize is negative', () => {
        const data = {
          hasTemplate: true,
          pdfPath: '/path.pdf',
          filename: 'file.pdf',
          fileSize: -100
        };

        const result = documentTemplateMetadataSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('greater than or equal');
        }
      });

      it('should fail when pdfPath is not string or null', () => {
        const invalidData = [
          { hasTemplate: true, pdfPath: 123, filename: null, fileSize: null },
          { hasTemplate: true, pdfPath: true, filename: null, fileSize: null },
          { hasTemplate: true, pdfPath: [], filename: null, fileSize: null }
        ];

        invalidData.forEach(data => {
          const result = documentTemplateMetadataSchema.safeParse(data);
          expect(result.success).toBe(false);
        });
      });

      it('should fail when filename is not string or null', () => {
        const invalidData = [
          { hasTemplate: true, pdfPath: null, filename: 123, fileSize: null },
          { hasTemplate: true, pdfPath: null, filename: true, fileSize: null },
          { hasTemplate: true, pdfPath: null, filename: {}, fileSize: null }
        ];

        invalidData.forEach(data => {
          const result = documentTemplateMetadataSchema.safeParse(data);
          expect(result.success).toBe(false);
        });
      });

      it('should fail when fileSize is not number or null', () => {
        const invalidData = [
          { hasTemplate: true, pdfPath: null, filename: null, fileSize: '1000' },
          { hasTemplate: true, pdfPath: null, filename: null, fileSize: true },
          { hasTemplate: true, pdfPath: null, filename: null, fileSize: [] }
        ];

        invalidData.forEach(data => {
          const result = documentTemplateMetadataSchema.safeParse(data);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty string pdfPath as valid', () => {
        const data = {
          hasTemplate: false,
          pdfPath: '',
          filename: '',
          fileSize: 0
        };

        const result = documentTemplateMetadataSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should handle very large file sizes', () => {
        const data = {
          hasTemplate: true,
          pdfPath: '/large.pdf',
          filename: 'large.pdf',
          fileSize: 10737418240 // 10 GB
        };

        const result = documentTemplateMetadataSchema.safeParse(data);
        expect(result.success).toBe(true);
      });

      it('should handle special characters in paths and filenames', () => {
        const data = {
          hasTemplate: true,
          pdfPath: '/uploads/2024/03/form-@special#chars$.pdf',
          filename: 'form with spaces & symbols!.pdf',
          fileSize: 1000000
        };

        const result = documentTemplateMetadataSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });
});