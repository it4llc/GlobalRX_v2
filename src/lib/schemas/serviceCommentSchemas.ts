import { z } from 'zod';

// Schema for creating a new service comment
export const createServiceCommentSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  finalText: z.string()
    .trim()
    .min(1, 'Comment text is required')
    .max(1000, 'Comment cannot exceed 1000 characters'),
  isInternalOnly: z.boolean().default(true)
});

// Schema for updating an existing service comment
export const updateServiceCommentSchema = z.object({
  finalText: z.string()
    .trim()
    .min(1, 'Comment text is required')
    .max(1000, 'Comment cannot exceed 1000 characters')
    .optional(),
  isInternalOnly: z.boolean().optional()
});

// Schema for a service comment response from the API
export const serviceCommentResponseSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  templateId: z.string(),
  templateName: z.string().optional(),
  finalText: z.string(),
  isInternalOnly: z.boolean(),
  createdBy: z.string(),
  createdByName: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).transform(val =>
    val instanceof Date ? val.toISOString() : val
  ),
  updatedBy: z.string().nullable().optional().default(null),
  updatedByName: z.string().nullable().optional().default(null),
  updatedAt: z.union([z.string(), z.date()]).nullable().optional().default(null).transform(val =>
    val instanceof Date ? val.toISOString() : val
  ),
  template: z.object({
    id: z.string(),
    name: z.string(),
    templateText: z.string(),
    placeholders: z.array(z.string()),
    category: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
  }).optional(),
  createdByUser: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }).optional(),
  updatedByUser: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  }).nullable().optional()
});

// Schema for bulk comments response
export const bulkCommentsResponseSchema = z.array(serviceCommentResponseSchema);

// Schema for bulk order comments response
export const bulkOrderCommentsResponseSchema = z.object({
  commentsByService: z.record(z.string(), z.array(serviceCommentResponseSchema))
});

// Type inference from schemas
export type CreateServiceCommentInput = z.infer<typeof createServiceCommentSchema>;
export type UpdateServiceCommentInput = z.infer<typeof updateServiceCommentSchema>;
export type ServiceCommentResponse = z.infer<typeof serviceCommentResponseSchema>;