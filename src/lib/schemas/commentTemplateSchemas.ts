// /GlobalRX_v2/src/lib/schemas/commentTemplateSchemas.ts

import { z } from 'zod';

// Base schema for comment template matching the specification
export const commentTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  shortName: z.string()
    .min(1, 'Short name is required')
    .max(50, 'Short name must not exceed 50 characters'),
  longName: z.string()
    .min(1, 'Long name is required')
    .max(100, 'Long name must not exceed 100 characters'),
  templateText: z.string()
    .min(1, 'Template text is required')
    .max(1000, 'Template text must not exceed 1000 characters'),
  isActive: z.boolean().default(true),
  hasBeenUsed: z.boolean().default(false),
  createdAt: z.date().or(z.string().datetime()).optional(),
  updatedAt: z.date().or(z.string().datetime()).optional(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional()
});

// Schema for creating a new comment template
export const createCommentTemplateSchema = z.object({
  shortName: z.string()
    .min(1, 'Short name is required')
    .max(50, 'Short name must not exceed 50 characters'),
  longName: z.string()
    .min(1, 'Long name is required')
    .max(100, 'Long name must not exceed 100 characters'),
  templateText: z.string()
    .min(1, 'Template text is required')
    .max(1000, 'Template text must not exceed 1000 characters')
});

// Schema for updating an existing comment template
export const updateCommentTemplateSchema = z.object({
  shortName: z.string()
    .min(1, 'Short name is required')
    .max(50, 'Short name must not exceed 50 characters')
    .optional(),
  longName: z.string()
    .min(1, 'Long name is required')
    .max(100, 'Long name must not exceed 100 characters')
    .optional(),
  templateText: z.string()
    .min(1, 'Template text is required')
    .max(1000, 'Template text must not exceed 1000 characters')
    .optional(),
  isActive: z.boolean().optional()
});

// Schema for template availability (service/status assignment)
export const commentTemplateAvailabilitySchema = z.object({
  id: z.string().uuid().optional(),
  templateId: z.string().uuid(),
  serviceCode: z.string().min(1, 'Service code is required'),
  status: z.string().min(1, 'Status is required'),
  createdAt: z.date().or(z.string().datetime()).optional()
});

// Schema for batch updating availability
export const updateAvailabilitySchema = z.object({
  availabilities: z.array(z.object({
    serviceCode: z.string(),
    status: z.string()
  }))
});

// Schema for the list/grid display response
export const commentTemplateListSchema = z.object({
  templates: z.array(commentTemplateSchema),
  services: z.array(z.object({
    code: z.string(),
    name: z.string(),
    category: z.string().optional() // For grouping in grid
  })),
  statuses: z.array(z.string()) // Dynamic from order statuses
});

// Type exports derived from schemas
export type CommentTemplate = z.infer<typeof commentTemplateSchema>;
export type CreateCommentTemplateInput = z.infer<typeof createCommentTemplateSchema>;
export type UpdateCommentTemplateInput = z.infer<typeof updateCommentTemplateSchema>;
export type CommentTemplateAvailability = z.infer<typeof commentTemplateAvailabilitySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type CommentTemplateListData = z.infer<typeof commentTemplateListSchema>;