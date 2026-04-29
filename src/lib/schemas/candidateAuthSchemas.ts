// Zod validation schemas for Phase 5 Stage 2 - Candidate Login & Session Management

import { z } from 'zod';

// Schema for POST /api/candidate/auth/verify request body
export const candidateVerifySchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(1)
});

// Schema for session data stored in the cookie
export const candidateSessionDataSchema = z.object({
  invitationId: z.string().uuid(),
  token: z.string(),
  firstName: z.string(),
  status: z.string(),
  expiresAt: z.coerce.date()
});

// Schema for GET /api/candidate/auth/session response
export const candidateSessionResponseSchema = z.discriminatedUnion('authenticated', [
  z.object({
    authenticated: z.literal(true),
    invitation: z.object({
      id: z.string().uuid(),
      firstName: z.string(),
      status: z.string(),
      token: z.string()
    })
  }),
  z.object({
    authenticated: z.literal(false)
  })
]);

// Type exports for use in the application
export type CandidateVerifyInput = z.infer<typeof candidateVerifySchema>;
export type CandidateSessionData = z.infer<typeof candidateSessionDataSchema>;
export type CandidateSessionResponse = z.infer<typeof candidateSessionResponseSchema>;