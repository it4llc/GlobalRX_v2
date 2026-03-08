import { z } from 'zod';
// Re-export the validation schemas to maintain backward compatibility
// while avoiding duplication. The validation file has better validation
// (UUID checks, proper trim validation) so we use that as source of truth
export {
  createServiceCommentSchema,
  updateServiceCommentSchema,
  serviceCommentResponseSchema,
  getServiceCommentsResponseSchema,
  orderServiceCommentsResponseSchema
} from '@/lib/validations/service-comment';

// Deprecated: bulkCommentsResponseSchema - use getServiceCommentsResponseSchema instead
export const bulkCommentsResponseSchema = z.array(serviceCommentResponseSchema);

// Deprecated: bulkOrderCommentsResponseSchema - use orderServiceCommentsResponseSchema instead
export const bulkOrderCommentsResponseSchema = z.object({
  commentsByService: z.record(z.string(), z.array(serviceCommentResponseSchema))
});

// Type inference from schemas
export type CreateServiceCommentInput = z.infer<typeof createServiceCommentSchema>;
export type UpdateServiceCommentInput = z.infer<typeof updateServiceCommentSchema>;
export type ServiceCommentResponse = z.infer<typeof serviceCommentResponseSchema>;