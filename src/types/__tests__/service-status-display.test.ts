// /GlobalRX_v2/src/types/__tests__/service-status-display.test.ts

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schema definitions that will be used in the actual implementation
export const serviceStatusEnum = z.enum([
  'draft',
  'submitted',
  'processing',
  'missing_info',
  'completed',
  'cancelled',
  'cancelled_dnb'
]);

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

export const serviceStatusListPropsSchema = z.object({
  items: z.array(serviceDisplayItemSchema),
  preferCountryCode: z.boolean().optional().default(false),
  isMobile: z.boolean().optional().default(false),
  maxInitialDisplay: z.number().min(1).max(10).optional().default(5)
});

describe('Service Status Display Type Definitions', () => {
  describe('serviceStatusEnum', () => {
    it('should accept all valid status values', () => {
      const validStatuses = [
        'draft',
        'submitted',
        'processing',
        'missing_info',
        'completed',
        'cancelled',
        'cancelled_dnb'
      ];

      validStatuses.forEach(status => {
        expect(() => serviceStatusEnum.parse(status)).not.toThrow();
      });
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = [
        'pending',
        'in_progress',
        'rejected',
        'approved',
        ''
      ];

      invalidStatuses.forEach(status => {
        expect(() => serviceStatusEnum.parse(status)).toThrow();
      });
    });
  });

  describe('serviceDisplayItemSchema', () => {
    it('should accept valid service display item', () => {
      const validItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Criminal Background Check' },
        location: { name: 'United States', code: 'US' },
        status: 'submitted'
      };

      const result = serviceDisplayItemSchema.parse(validItem);
      expect(result).toEqual(validItem);
    });

    it('should accept item with null service name', () => {
      const itemWithNullName = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: null },
        location: { name: 'USA', code: 'US' },
        status: 'draft'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithNullName)).not.toThrow();
    });

    it('should accept item with null location name', () => {
      const itemWithNullLocation = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Test Service' },
        location: { name: null, code: null },
        status: 'completed'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithNullLocation)).not.toThrow();
    });

    it('should accept item with unknown status for fallback display', () => {
      const itemWithUnknownStatus = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Test Service' },
        location: { name: 'USA', code: 'US' },
        status: 'some_unknown_status'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithUnknownStatus)).not.toThrow();
    });

    it('should reject item with invalid UUID', () => {
      const itemWithInvalidId = {
        id: 'not-a-uuid',
        service: { name: 'Test Service' },
        location: { name: 'USA', code: 'US' },
        status: 'submitted'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithInvalidId)).toThrow();
    });

    it('should reject item with invalid country code length', () => {
      const itemWithInvalidCode = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Test Service' },
        location: { name: 'USA', code: 'USA' }, // Should be 2 chars
        status: 'submitted'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithInvalidCode)).toThrow();
    });

    it('should accept item without country code', () => {
      const itemWithoutCode = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Test Service' },
        location: { name: 'USA' }, // code is optional
        status: 'submitted'
      };

      expect(() => serviceDisplayItemSchema.parse(itemWithoutCode)).not.toThrow();
    });

    it('should reject item missing required fields', () => {
      const incompleteItems = [
        { // Missing id
          service: { name: 'Test' },
          location: { name: 'USA' },
          status: 'draft'
        },
        { // Missing service
          id: '550e8400-e29b-41d4-a716-446655440000',
          location: { name: 'USA' },
          status: 'draft'
        },
        { // Missing location
          id: '550e8400-e29b-41d4-a716-446655440000',
          service: { name: 'Test' },
          status: 'draft'
        },
        { // Missing status
          id: '550e8400-e29b-41d4-a716-446655440000',
          service: { name: 'Test' },
          location: { name: 'USA' }
        }
      ];

      incompleteItems.forEach(item => {
        expect(() => serviceDisplayItemSchema.parse(item)).toThrow();
      });
    });
  });

  describe('serviceStatusListPropsSchema', () => {
    it('should accept minimal valid props', () => {
      const minimalProps = {
        items: []
      };

      const result = serviceStatusListPropsSchema.parse(minimalProps);
      expect(result.items).toEqual([]);
      expect(result.preferCountryCode).toBe(false);
      expect(result.isMobile).toBe(false);
      expect(result.maxInitialDisplay).toBe(5);
    });

    it('should accept complete valid props', () => {
      const completeProps = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            service: { name: 'Test Service' },
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          }
        ],
        preferCountryCode: true,
        isMobile: true,
        maxInitialDisplay: 3
      };

      const result = serviceStatusListPropsSchema.parse(completeProps);
      expect(result).toEqual(completeProps);
    });

    it('should apply default values for optional props', () => {
      const propsWithoutOptionals = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            service: { name: 'Test' },
            location: { name: 'USA' },
            status: 'draft'
          }
        ]
      };

      const result = serviceStatusListPropsSchema.parse(propsWithoutOptionals);
      expect(result.preferCountryCode).toBe(false);
      expect(result.isMobile).toBe(false);
      expect(result.maxInitialDisplay).toBe(5);
    });

    it('should reject invalid maxInitialDisplay values', () => {
      const invalidMaxValues = [0, -1, 11, 100];

      invalidMaxValues.forEach(value => {
        const props = {
          items: [],
          maxInitialDisplay: value
        };
        expect(() => serviceStatusListPropsSchema.parse(props)).toThrow();
      });
    });

    it('should accept valid maxInitialDisplay values', () => {
      const validMaxValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      validMaxValues.forEach(value => {
        const props = {
          items: [],
          maxInitialDisplay: value
        };
        expect(() => serviceStatusListPropsSchema.parse(props)).not.toThrow();
      });
    });

    it('should reject non-boolean values for boolean props', () => {
      const invalidBooleanProps = [
        { items: [], preferCountryCode: 'true' },
        { items: [], isMobile: 1 },
        { items: [], preferCountryCode: null }
      ];

      invalidBooleanProps.forEach(props => {
        expect(() => serviceStatusListPropsSchema.parse(props)).toThrow();
      });
    });

    it('should validate array items properly', () => {
      const propsWithInvalidItem = {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            service: { name: 'Valid Service' },
            location: { name: 'USA', code: 'US' },
            status: 'submitted'
          },
          {
            id: 'invalid-uuid', // Invalid UUID
            service: { name: 'Invalid Service' },
            location: { name: 'USA', code: 'US' },
            status: 'draft'
          }
        ]
      };

      expect(() => serviceStatusListPropsSchema.parse(propsWithInvalidItem)).toThrow();
    });
  });

  describe('Type exports', () => {
    it('should be able to infer types from schemas', () => {
      type ServiceStatusEnum = z.infer<typeof serviceStatusEnum>;
      type ServiceDisplayItem = z.infer<typeof serviceDisplayItemSchema>;
      type ServiceStatusListProps = z.infer<typeof serviceStatusListPropsSchema>;

      // Type checking - these are compile-time checks
      const statusCheck: ServiceStatusEnum = 'submitted';
      const itemCheck: ServiceDisplayItem = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: { name: 'Test' },
        location: { name: 'USA', code: 'US' },
        status: 'draft'
      };
      const propsCheck: ServiceStatusListProps = {
        items: [itemCheck],
        preferCountryCode: false,
        isMobile: false,
        maxInitialDisplay: 5
      };

      // Runtime validation to ensure types work
      expect(statusCheck).toBe('submitted');
      expect(itemCheck.id).toBeDefined();
      expect(propsCheck.items).toHaveLength(1);
    });
  });
});