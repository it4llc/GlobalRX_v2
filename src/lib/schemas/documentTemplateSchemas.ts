// /GlobalRX_v2/src/lib/schemas/documentTemplateSchemas.ts
// Validation schemas for PDF template download feature

import { z } from 'zod';

/**
 * Schema for validating document ID parameter in API requests
 */
export const documentTemplateParamsSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
});

/**
 * Schema for template metadata structure
 */
export const documentTemplateMetadataSchema = z.object({
  hasTemplate: z.boolean(),
  pdfPath: z.string().nullable(),
  filename: z.string().nullable(),
  fileSize: z.number().min(0).nullable()
});

// Type exports derived from schemas
export type DocumentTemplateParams = z.infer<typeof documentTemplateParamsSchema>;
export type DocumentTemplateMetadata = z.infer<typeof documentTemplateMetadataSchema>;