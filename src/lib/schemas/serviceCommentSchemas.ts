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

// Import schemas for type inference
import {
  createServiceCommentSchema as _createSchema,
  updateServiceCommentSchema as _updateSchema,
  serviceCommentResponseSchema as _responseSchema
} from '@/lib/validations/service-comment';

// Type inference from schemas
export type CreateServiceCommentInput = z.infer<typeof _createSchema>;
export type UpdateServiceCommentInput = z.infer<typeof _updateSchema>;
export type ServiceCommentResponse = z.infer<typeof _responseSchema>;