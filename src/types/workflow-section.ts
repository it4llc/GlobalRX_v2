// /GlobalRX_v2/src/types/workflow-section.ts

import { z } from 'zod';

// Placement enum for Phase 2
export const PlacementEnum = z.enum(['before_services', 'after_services']);

// Section type enum for Phase 2 (only text and document)
export const SectionTypeEnum = z.enum(['text', 'document']);

// Section count limits per business rules
export const MAX_SECTIONS_PER_PLACEMENT = 10;

// File upload validation constants
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.doc'];
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Workflow section schemas for Phase 2
export const workflowSectionSchema = z.object({
  name: z.string().min(1).max(100), // No uniqueness requirement
  placement: PlacementEnum,
  type: SectionTypeEnum,
  content: z.string().max(50000).optional(), // 50K char limit
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  displayOrder: z.number().int().nonnegative(),
  isRequired: z.boolean().default(true),
});

// Create schema requires all fields except optional ones
export const workflowSectionCreateSchema = workflowSectionSchema;

// Update schema allows partial updates
export const workflowSectionUpdateSchema = workflowSectionSchema.partial();

// TypeScript types inferred from schemas
export type WorkflowSection = z.infer<typeof workflowSectionSchema>;
export type WorkflowSectionCreateInput = z.infer<typeof workflowSectionCreateSchema>;
export type WorkflowSectionUpdateInput = z.infer<typeof workflowSectionUpdateSchema>;
export type Placement = z.infer<typeof PlacementEnum>;
export type SectionType = z.infer<typeof SectionTypeEnum>;