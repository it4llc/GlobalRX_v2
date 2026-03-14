// /GlobalRX_v2/src/types/service-status-display.ts

import { z } from 'zod';

// Enum for valid service statuses
export const serviceStatusEnum = z.enum([
  'draft',
  'submitted',
  'processing',
  'missing_info',
  'completed',
  'cancelled',
  'cancelled_dnb'
]);

// Schema for individual service display items
export const serviceDisplayItemSchema = z.object({
  id: z.string().uuid(),
  service: z.object({
    name: z.string().nullable()
  }),
  location: z.object({
    name: z.string().nullable(),
    code: z.string().length(2).optional().nullable()
  }),
  status: z.string() // Accepts any string for fallback display
});

// Schema for ServiceStatusList component props
export const serviceStatusListPropsSchema = z.object({
  items: z.array(serviceDisplayItemSchema),
  preferCountryCode: z.boolean().optional().default(false),
  isMobile: z.boolean().optional().default(false),
  maxInitialDisplay: z.number().min(1).max(10).optional().default(5)
});

// TypeScript type exports
export type ServiceStatus = z.infer<typeof serviceStatusEnum>;
export type ServiceDisplayItem = z.infer<typeof serviceDisplayItemSchema>;
export type ServiceStatusListProps = z.infer<typeof serviceStatusListPropsSchema>;