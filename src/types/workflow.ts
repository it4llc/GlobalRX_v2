import { z } from 'zod';

// Base workflow schemas
export const workflowBaseSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  defaultLanguage: z.string().default('en-US'),
  expirationDays: z.number().int().positive().optional().default(15),
  autoCloseEnabled: z.boolean().default(true),
  extensionAllowed: z.boolean().default(false),
  extensionDays: z.union([z.number().int().positive(), z.null()]).optional(),
  // Reminder settings
  reminderEnabled: z.boolean().default(false),
  reminderFrequency: z.number().int().positive().min(1).max(30).optional().default(7),
  maxReminders: z.number().int().nonnegative().min(1).max(10).optional().default(3),
  disabled: z.boolean().default(false),
});

export const workflowCreateSchema = workflowBaseSchema.extend({
  packageIds: z.array(z.string().uuid()).optional(),
});

export const workflowUpdateSchema = workflowBaseSchema.extend({
  packageIds: z.array(z.string().uuid()).optional(),
}).partial();

export const workflowPackageSchema = z.object({
  packageId: z.string().uuid(),
});

// Section schemas
export const workflowSectionBaseSchema = z.object({
  name: z.string().min(2, 'Section name must be at least 2 characters'),
  displayOrder: z.number().int().nonnegative(),
  isRequired: z.boolean().default(true),
  dependsOnSection: z.string().uuid().optional(),
  dependencyLogic: z.string().optional(),
});

export const workflowSectionCreateSchema = workflowSectionBaseSchema;

export const workflowSectionUpdateSchema = workflowSectionBaseSchema.partial();

// Compliance document schemas
export const complianceDocumentBaseSchema = z.object({
  name: z.string().min(3, 'Document name must be at least 3 characters'),
  description: z.string().optional(),
  fileType: z.string(),
  documentType: z.string(),
  requiredForServices: z.array(z.string().uuid()).optional(),
  locations: z.array(z.string().uuid()).optional(),
  presentationOrder: z.number().int().nonnegative().optional(),
  disabled: z.boolean().default(false),
});

export const complianceDocumentCreateSchema = complianceDocumentBaseSchema;

export const complianceDocumentUpdateSchema = complianceDocumentBaseSchema.partial();

// Communication template schemas
export const communicationTemplateBaseSchema = z.object({
  workflowId: z.string().uuid(),
  name: z.string().min(3, 'Template name must be at least 3 characters'),
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  bodyContent: z.string().min(10, 'Body content must be at least 10 characters'),
  type: z.enum(['reminder', 'notification', 'confirmation']),
  language: z.string().default('en-US'),
  reminderSchedule: z.array(z.number().int().positive()).optional(),
  channels: z.array(z.enum(['email', 'sms'])).optional(),
  maxReminders: z.number().int().nonnegative().optional(),
});

export const communicationTemplateCreateSchema = communicationTemplateBaseSchema;

export const communicationTemplateUpdateSchema = communicationTemplateBaseSchema.partial();

// Translation schemas
export const workflowTranslationBaseSchema = z.object({
  workflowId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  key: z.string(),
  language: z.string(),
  value: z.string(),
});

export const workflowTranslationCreateSchema = workflowTranslationBaseSchema;

export const workflowTranslationUpdateSchema = workflowTranslationBaseSchema.partial();

// Types derived from schemas
export type WorkflowCreateInput = z.infer<typeof workflowCreateSchema>;
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;
export type WorkflowSectionCreateInput = z.infer<typeof workflowSectionCreateSchema>;
export type WorkflowSectionUpdateInput = z.infer<typeof workflowSectionUpdateSchema>;
export type ComplianceDocumentCreateInput = z.infer<typeof complianceDocumentCreateSchema>;
export type ComplianceDocumentUpdateInput = z.infer<typeof complianceDocumentUpdateSchema>;
export type CommunicationTemplateCreateInput = z.infer<typeof communicationTemplateCreateSchema>;
export type CommunicationTemplateUpdateInput = z.infer<typeof communicationTemplateUpdateSchema>;
export type WorkflowTranslationCreateInput = z.infer<typeof workflowTranslationCreateSchema>;
export type WorkflowTranslationUpdateInput = z.infer<typeof workflowTranslationUpdateSchema>;