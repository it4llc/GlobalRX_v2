// /GlobalRX_v2/src/lib/schemas/vendorSchemas.test.ts

import { describe, it, expect } from 'vitest';
import {
  vendorOrganizationSchema,
  createVendorOrganizationSchema,
  updateVendorOrganizationSchema,
  vendorUserSchema,
  assignOrderToVendorSchema
} from '@/lib/schemas/vendorSchemas';

describe('Vendor Schemas', () => {
  describe('vendorOrganizationSchema', () => {
    describe('valid data', () => {
      it('should pass with all required fields', () => {
        const validData = {
          name: 'Acme Background Services',
          code: 'ABS',
          isActive: true,
          isPrimary: false,
          contactEmail: 'contact@acmebackground.com',
          contactPhone: '555-123-4567'
        };

        const result = vendorOrganizationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with optional fields included', () => {
        const validData = {
          id: 'vendor-123',
          name: 'Acme Background Services',
          code: 'ABS',
          isActive: true,
          isPrimary: false,
          contactEmail: 'contact@acmebackground.com',
          contactPhone: '555-123-4567',
          address: '123 Main St',
          notes: 'Preferred vendor for east coast',
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = vendorOrganizationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass when set as primary vendor', () => {
        const validData = {
          name: 'Primary Vendor Inc',
          code: 'PVI',
          isActive: true,
          isPrimary: true,
          contactEmail: 'primary@vendor.com',
          contactPhone: '555-999-8888'
        };

        const result = vendorOrganizationSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when name is empty', () => {
        const invalidData = {
          name: '',
          code: 'ABS',
          isActive: true,
          isPrimary: false,
          contactEmail: 'contact@acmebackground.com',
          contactPhone: '555-123-4567'
        };

        const result = vendorOrganizationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].path).toEqual(['name']);
        }
      });

      // Code field test removed - code field no longer exists in schema
      // The data that was previously invalid due to missing code is now valid

      // Code field validation test removed - code field no longer exists in schema

      it('should fail when email is not valid', () => {
        const invalidData = {
          name: 'Acme Background Services',
          isActive: true,
          isPrimary: false,
          contactEmail: 'not-an-email',
          contactPhone: '555-123-4567'
        };

        const result = vendorOrganizationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.errors[0].path).toEqual(['contactEmail']);
        }
      });

      it('should fail when isActive is not a boolean', () => {
        const invalidData = {
          name: 'Acme Background Services',
          code: 'ABS',
          isActive: 'yes',
          isPrimary: false,
          contactEmail: 'contact@acmebackground.com',
          contactPhone: '555-123-4567'
        };

        const result = vendorOrganizationSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('createVendorOrganizationSchema', () => {
    it('should not allow id field on creation', () => {
      const dataWithId = {
        id: 'should-not-be-here',
        name: 'New Vendor',
        isActive: true,
        isPrimary: false,
        contactEmail: 'new@vendor.com',
        contactPhone: '555-000-0000'
      };

      const result = createVendorOrganizationSchema.safeParse(dataWithId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeUndefined();
      }
    });

    it('should require all mandatory fields for creation', () => {
      const minimalData = {
        name: 'New Vendor'
      };

      const result = createVendorOrganizationSchema.safeParse(minimalData);
      expect(result.success).toBe(false);
    });
  });

  describe('updateVendorOrganizationSchema', () => {
    it('should allow partial updates', () => {
      const partialData = {
        name: 'Updated Name'
      };

      const result = updateVendorOrganizationSchema.safeParse(partialData);
      expect(result.success).toBe(true);
    });

    it('should allow updating primary status', () => {
      const updateData = {
        isPrimary: true
      };

      const result = updateVendorOrganizationSchema.safeParse(updateData);
      expect(result.success).toBe(true);
    });

    it('should validate email format if provided', () => {
      const updateData = {
        contactEmail: 'invalid-email'
      };

      const result = updateVendorOrganizationSchema.safeParse(updateData);
      expect(result.success).toBe(false);
    });
  });

  describe('vendorUserSchema', () => {
    describe('valid data', () => {
      it('should pass with vendor user type and vendorId', () => {
        const validData = {
          email: 'vendor@example.com',
          name: 'Vendor User',
          type: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with internal user type', () => {
        const validData = {
          email: 'internal@globalrx.com',
          name: 'Internal User',
          type: 'internal',
          permissions: {
            user_admin: true,
            global_config: true,
            customer_config: true,
            candidate_workflow: true
          }
        };

        const result = vendorUserSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with customer user type and customerId', () => {
        const validData = {
          email: 'customer@company.com',
          name: 'Customer User',
          type: 'customer',
          customerId: 'customer-123',
          permissions: {
            candidate_workflow: true
          }
        };

        const result = vendorUserSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail when vendor user lacks vendorId', () => {
        const invalidData = {
          email: 'vendor@example.com',
          name: 'Vendor User',
          type: 'vendor',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when customer user lacks customerId', () => {
        const invalidData = {
          email: 'customer@company.com',
          name: 'Customer User',
          type: 'customer',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail with invalid user type', () => {
        const invalidData = {
          email: 'user@example.com',
          name: 'Some User',
          type: 'admin',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when email is invalid', () => {
        const invalidData = {
          email: 'not-an-email',
          name: 'User Name',
          type: 'internal',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail when user has both vendorId and customerId', () => {
        const invalidData = {
          email: 'confused@user.com',
          name: 'Confused User',
          type: 'vendor',
          vendorId: 'vendor-123',
          customerId: 'customer-123',
          permissions: {}
        };

        const result = vendorUserSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('assignOrderToVendorSchema', () => {
    describe('valid data', () => {
      it('should pass with vendor assignment', () => {
        const validData = {
          orderId: 'order-123',
          vendorId: 'vendor-456',
          assignmentNotes: 'Expedited processing requested'
        };

        const result = assignOrderToVendorSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass with null vendorId for internal assignment', () => {
        const validData = {
          orderId: 'order-123',
          vendorId: null,
          assignmentNotes: 'Reassigned to internal team'
        };

        const result = assignOrderToVendorSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should pass without optional notes', () => {
        const validData = {
          orderId: 'order-123',
          vendorId: 'vendor-456'
        };

        const result = assignOrderToVendorSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid data', () => {
      it('should fail without orderId', () => {
        const invalidData = {
          vendorId: 'vendor-456'
        };

        const result = assignOrderToVendorSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });

      it('should fail with empty orderId', () => {
        const invalidData = {
          orderId: '',
          vendorId: 'vendor-456'
        };

        const result = assignOrderToVendorSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });
  });
});