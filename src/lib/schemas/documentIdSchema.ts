// src/lib/schemas/documentIdSchema.ts
import { z } from 'zod';

export const documentIdSchema = z.object({
  documentId: z.string().uuid('Invalid document ID format')
});

export type DocumentIdInput = z.infer<typeof documentIdSchema>;