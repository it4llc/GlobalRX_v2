// /GlobalRX_v2/src/lib/validations/candidate-password.ts

import { z } from 'zod';

/**
 * Schema for candidate password creation
 * Used when a candidate creates their initial password from an invitation link
 */
export const passwordCreationSchema = z.object({
  token: z.string()
    .trim()
    .min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

export type PasswordCreationInput = z.infer<typeof passwordCreationSchema>;