// /GlobalRX_v2/src/types/candidate-auth.ts

import { z } from 'zod';
import { passwordCreationSchema } from '@/lib/validations/candidate-password';

/**
 * TypeScript types for candidate authentication
 */

// Input type for password creation (derived from Zod schema)
export type CreatePasswordInput = z.infer<typeof passwordCreationSchema>;

// Response type for successful password creation
export interface CreatePasswordResponse {
  success: true;
  status: string;
}