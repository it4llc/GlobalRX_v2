// /GlobalRX_v2/src/types/candidateInvitation.ts

import { z } from 'zod';
import { createInvitationSchema, extendInvitationSchema } from '@/lib/validations/candidateInvitation';

/**
 * TypeScript type definitions for invitation-related data
 * All types derived from Zod schemas to maintain consistency
 */

// Input type for creating an invitation (derived from Zod schema)
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// Input type for extending an invitation (derived from Zod schema)
export type ExtendInvitationInput = z.infer<typeof extendInvitationSchema>;

// Response type for API endpoints (manually defined to exclude sensitive fields)
export interface InvitationResponse {
  id: string;
  orderId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  status: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  createdBy: string;
  completedAt: Date | string | null;
  lastAccessedAt: Date | string | null;
  // Explicitly exclude: token (on lookup responses), passwordHash, previousStatus
}

// Extended response type for invitation lookup that includes customer info
export interface InvitationLookupResponse extends InvitationResponse {
  customerName: string;
  hasPassword: boolean;
}