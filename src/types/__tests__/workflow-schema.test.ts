// /GlobalRX_v2/src/types/__tests__/workflow-schema.test.ts

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  workflowCreateSchema,
  workflowUpdateSchema
} from '../workflow';

// Package schemas from API routes - these will move to a central location after implementation
const packageUpdateSchema = z.object({
  name: z.string().min(1, "Package name is required").optional(),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any()
  })).optional(),
  workflowId: z.string().uuid().optional().nullable() // Phase 1 addition
});

const packageCreateSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any()
  })),
  workflowId: z.string().uuid().optional().nullable() // Phase 1 addition
});

describe('Workflow Schema Validation - Phase 1 Changes', () => {
  describe('workflowCreateSchema - packageIds removal', () => {
    it('should NOT accept packageIds field anymore', () => {
      const workflowWithPackageIds = {
        name: 'Test Workflow',
        description: 'Test description',
        status: 'draft' as const,
        customerId: '550e8400-e29b-41d4-a716-446655440000',
        packageIds: ['550e8400-e29b-41d4-a716-446655440000'] // This field should be removed
      };

      const result = workflowCreateSchema.parse(workflowWithPackageIds);

      // After implementation, packageIds should NOT be in the result
      expect('packageIds' in result).toBe(false);
    });

    it('should accept workflow without packageIds', () => {
      const workflowWithoutPackageIds = {
        name: 'Test Workflow',
        description: 'Test description',
        status: 'draft' as const,
        customerId: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = workflowCreateSchema.parse(workflowWithoutPackageIds);
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Workflow');
      expect('packageIds' in result).toBe(false);
    });

    it('should show that packageIds field is removed from schema shape', () => {
      // After Phase 1, packageIds should NOT be in the schema shape
      const hasPackageIds = 'packageIds' in workflowCreateSchema.shape;
      expect(hasPackageIds).toBe(false);
    });
  });

  describe('workflowUpdateSchema - packageIds removal', () => {
    it('should NOT accept packageIds field anymore', () => {
      const updateData = {
        name: 'Updated Workflow',
        packageIds: ['550e8400-e29b-41d4-a716-446655440000'] // This field should be removed
      };

      const result = workflowUpdateSchema.parse(updateData);

      // After implementation, packageIds should NOT be in the result
      expect('packageIds' in result).toBe(false);
    });

    it('should accept partial updates without packageIds', () => {
      const updateData = {
        name: 'Updated Workflow Name',
        description: 'New description'
      };

      const result = workflowUpdateSchema.parse(updateData);
      expect(result.name).toBe('Updated Workflow Name');
      expect('packageIds' in result).toBe(false);
    });

    it('should show that packageIds field is removed from schema shape', () => {
      // After Phase 1, packageIds should NOT be in the schema shape
      const hasPackageIds = 'packageIds' in workflowUpdateSchema.shape;
      expect(hasPackageIds).toBe(false);
    });
  });

  describe('packageUpdateSchema - workflowId addition', () => {
    it('should accept workflowId as optional UUID', () => {
      const updateData = {
        name: 'Updated Package',
        workflowId: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = packageUpdateSchema.parse(updateData);
      expect(result.workflowId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should accept null workflowId to remove workflow assignment', () => {
      const updateData = {
        name: 'Updated Package',
        workflowId: null
      };

      const result = packageUpdateSchema.parse(updateData);
      expect(result.workflowId).toBe(null);
    });

    it('should accept update without workflowId field', () => {
      const updateData = {
        name: 'Updated Package',
        description: 'New description'
      };

      const result = packageUpdateSchema.parse(updateData);
      expect(result.name).toBe('Updated Package');
      expect(result.workflowId).toBeUndefined();
    });

    it('should reject invalid workflowId that is not a UUID', () => {
      const updateData = {
        name: 'Updated Package',
        workflowId: 'not-a-uuid'
      };

      expect(() => packageUpdateSchema.parse(updateData)).toThrow();
    });

    it('should reject workflowId with invalid UUID format variations', () => {
      const invalidUUIDs = [
        '550e8400-e29b-41d4-a716',  // Too short
        '550e8400-e29b-41d4-a716-446655440000-extra',  // Too long
        '550e8400-xxxx-41d4-a716-446655440000',  // Invalid characters
        '550e8400e29b41d4a716446655440000',  // Missing hyphens
        'workflow-123',  // Not a UUID at all
        '12345'  // Just numbers
      ];

      invalidUUIDs.forEach(invalidId => {
        const updateData = {
          name: 'Updated Package',
          workflowId: invalidId
        };

        expect(() => packageUpdateSchema.parse(updateData)).toThrow();
      });
    });
  });

  describe('packageCreateSchema - workflowId addition', () => {
    it('should accept workflowId as optional UUID', () => {
      const packageData = {
        name: 'New Package',
        description: 'Package description',
        services: [
          {
            serviceId: '650e8400-e29b-41d4-a716-446655440001',
            scope: {}
          }
        ],
        workflowId: '550e8400-e29b-41d4-a716-446655440000'
      };

      const result = packageCreateSchema.parse(packageData);
      expect(result.workflowId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should accept null workflowId for package without workflow', () => {
      const packageData = {
        name: 'New Package',
        services: [
          {
            serviceId: '650e8400-e29b-41d4-a716-446655440001',
            scope: {}
          }
        ],
        workflowId: null
      };

      const result = packageCreateSchema.parse(packageData);
      expect(result.workflowId).toBe(null);
    });

    it('should accept package creation without workflowId field', () => {
      const packageData = {
        name: 'New Package',
        description: 'Package without workflow',
        services: [
          {
            serviceId: '650e8400-e29b-41d4-a716-446655440001',
            scope: {}
          }
        ]
      };

      const result = packageCreateSchema.parse(packageData);
      expect(result.name).toBe('New Package');
      expect(result.workflowId).toBeUndefined();
    });

    it('should reject invalid workflowId that is not a UUID', () => {
      const packageData = {
        name: 'New Package',
        services: [
          {
            serviceId: '650e8400-e29b-41d4-a716-446655440001',
            scope: {}
          }
        ],
        workflowId: 'invalid-workflow-id'
      };

      expect(() => packageCreateSchema.parse(packageData)).toThrow();
    });

    it('should reject workflowId with various invalid formats', () => {
      const invalidUUIDs = [
        'abc123',  // Too short
        '550e8400-e29b-41d4-xxxx-446655440000',  // Invalid hex chars
        '{}',  // Object notation
        '[]',  // Array notation
        ''  // Empty string (not null)
      ];

      invalidUUIDs.forEach(invalidId => {
        const packageData = {
          name: 'New Package',
          services: [
            {
              serviceId: '650e8400-e29b-41d4-a716-446655440001',
              scope: {}
            }
          ],
          workflowId: invalidId
        };

        expect(() => packageCreateSchema.parse(packageData)).toThrow();
      });
    });
  });
});