// /GlobalRX_v2/src/lib/validations/service-comment.ts

import { z } from 'zod';
import { sanitizeText, isTextSafe } from '@/lib/utils/text-sanitization';

// UUID validation using built-in zod uuid validator
// Create comment validation schema
export const createServiceCommentSchema = z.object({
  templateId: z.string().uuid('Invalid template ID format'),
  finalText: z.string()
    .min(1, 'String must contain at least 1 character(s)')
    .max(1000, 'Comment text cannot exceed 1000 characters')
    .refine(text => text.trim().length > 0, 'Comment text cannot be empty or only whitespace'),
  isInternalOnly: z.boolean().optional().default(true)
});

// Update comment validation schema - allows partial updates
export const updateServiceCommentSchema = z.object({
  finalText: z.string()
    .min(1, 'String must contain at least 1 character(s)')
    .max(1000, 'Comment text cannot exceed 1000 characters')
    .refine(text => text.trim().length > 0, 'Comment text cannot be empty or only whitespace')
    .optional(),
  isInternalOnly: z.boolean().optional()
});

// Response schema for service comments
export const serviceCommentResponseSchema = z.object({
  id: z.string(),
  serviceId: z.string(),
  templateId: z.string(),
  finalText: z.string(),
  isInternalOnly: z.boolean(),
  createdBy: z.string(),
  createdAt: z.string().refine((val) => {
    // Validate ISO 8601 date format
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format'),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable().refine((val) => {
    // If updatedAt is provided, it should be a valid date
    if (val === null) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, 'Invalid date format'),
  template: z.object({
    shortName: z.string(),
    longName: z.string()
  }),
  createdByUser: z.object({
    name: z.string(),
    email: z.string()
  }),
  updatedByUser: z.object({
    name: z.string(),
    email: z.string()
  }).nullable().optional()
});

// Schema for get service comments response
export const getServiceCommentsResponseSchema = z.object({
  comments: z.array(serviceCommentResponseSchema),
  total: z.number().int().min(0)
});

// Schema for order service comments response
export const orderServiceCommentsResponseSchema = z.object({
  serviceComments: z.record(
    z.string(),
    z.object({
      serviceName: z.string(),
      serviceStatus: z.string(),
      comments: z.array(serviceCommentResponseSchema),
      total: z.number().int().min(0)
    })
  )
});