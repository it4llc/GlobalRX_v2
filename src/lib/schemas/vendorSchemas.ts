/**
 * Vendor Management Schema Definitions
 *
 * Defines validation schemas for vendor organizations and user assignments.
 * Implements business rules through validation logic to ensure data integrity.
 *
 * Key Business Rules Enforced:
 * - Vendor users must have vendorId (can't be orphaned)
 * - Customer users must have customerId (organizational assignment required)
 * - Users cannot belong to both vendor and customer organizations
 * - Contact information is required for all vendor organizations
 */

import { z } from 'zod';

// Base vendor organization schema
export const vendorOrganizationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean(),
  isPrimary: z.boolean(),
  contactEmail: z.string().email('Invalid email format'),
  contactPhone: z.string().min(1, 'Phone is required'),
  address: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

// Schema for creating vendor organization (excludes id and timestamps)
export const createVendorOrganizationSchema = vendorOrganizationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Schema for updating vendor organization (all fields optional)
export const updateVendorOrganizationSchema = vendorOrganizationSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Vendor user schema with business rule validation
// Enforces organizational assignment rules to maintain data integrity
export const vendorUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['internal', 'customer', 'vendor']),
  vendorId: z.string().optional(),
  customerId: z.string().optional(),
  permissions: z.record(z.union([z.boolean(), z.string(), z.array(z.string())]))
}).refine(
  (data) => {
    // Business rule: Vendor users must be assigned to a vendor organization
    // This prevents orphaned vendor users who wouldn't have access to any orders
    if (data.type === 'vendor' && !data.vendorId) {
      return false;
    }

    // Business rule: Customer users must be assigned to a customer organization
    // This ensures proper data isolation and access control
    if (data.type === 'customer' && !data.customerId) {
      return false;
    }

    // Business rule: Users cannot belong to both vendor and customer organizations
    // This prevents conflicting access permissions and maintains clear user roles
    if (data.vendorId && data.customerId) {
      return false;
    }

    return true;
  },
  {
    message: 'Invalid user configuration for the specified type',
  }
);


// Infer TypeScript types from schemas
export type VendorOrganization = z.infer<typeof vendorOrganizationSchema>;
export type CreateVendorOrganization = z.infer<typeof createVendorOrganizationSchema>;
export type UpdateVendorOrganization = z.infer<typeof updateVendorOrganizationSchema>;
export type VendorUser = z.infer<typeof vendorUserSchema>;