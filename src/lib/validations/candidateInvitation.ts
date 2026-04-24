// /GlobalRX_v2/src/lib/validations/candidateInvitation.ts

import { z } from 'zod';

/**
 * Zod schemas for candidate invitation API validation
 * Following the existing validation patterns in the project
 */

// Schema for creating a new candidate invitation
export const createInvitationSchema = z.object({
  packageId: z.string().uuid('Package ID must be a valid UUID'),
  firstName: z.string().min(1, 'First name must be at least 1 character').max(100, 'First name must not exceed 100 characters'),
  lastName: z.string().min(1, 'Last name must be at least 1 character').max(100, 'Last name must not exceed 100 characters'),
  email: z.string().email('Invalid email address'),
  phoneCountryCode: z.string().max(5, 'Phone country code must not exceed 5 characters').optional(),
  phoneNumber: z.string().max(20, 'Phone number must not exceed 20 characters').optional(),
  customerId: z.string().uuid('Customer ID must be a valid UUID').optional() // Required for admin users only
}).refine(
  // Business rule: if phoneNumber is provided, phoneCountryCode must also be provided
  (data) => {
    if (data.phoneNumber && !data.phoneCountryCode) {
      return false;
    }
    return true;
  },
  {
    message: 'phone country code is required when phone number is provided',
    path: ['phoneCountryCode']
  }
);

// Schema for extending an invitation
export const extendInvitationSchema = z.object({
  days: z.number()
    .int('Days must be an integer')
    .min(1, 'Days must be at least 1')
    .max(15, 'Days must be at most 15')
    .optional()
});