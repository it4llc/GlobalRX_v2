// /GlobalRX_v2/src/types/service-results.ts

import { z } from 'zod';

// Simple XSS sanitization function
function sanitizeHtml(input: string): string {
  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove on* event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: URL for scripts
  sanitized = sanitized.replace(/data:text\/html[^,]*,/gi, '');

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Remove object and embed tags
  sanitized = sanitized.replace(/<(object|embed)\b[^<]*(?:(?!<\/(object|embed)>)<[^<]*)*<\/(object|embed)>/gi, '');

  return sanitized;
}

// Schema for updating service results with XSS sanitization
export const updateResultsSchema = z.object({
  results: z.string().nullable().transform((val) => {
    if (val === null || val === '') return val;
    return sanitizeHtml(val);
  })
});

// Derive TypeScript type from schema
export type UpdateResultsInput = z.infer<typeof updateResultsSchema>;

// Type for service user (vendor or internal)
export interface ServiceUser {
  id: string;
  userId?: number;
  userType: string;
  vendorId?: string;
  permissions?: Record<string, unknown>;
}

// Type for attachment data
export interface ServiceAttachment {
  id: number;
  serviceFulfillmentId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedBy: number;
  uploadedAt: Date;
}

// Terminal statuses that prevent editing
export const TERMINAL_STATUSES = ['completed', 'cancelled'];

// Check if a status is terminal
export function isTerminalStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.includes(status.toLowerCase());
}