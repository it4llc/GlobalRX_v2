// /GlobalRX_v2/src/schemas/__tests__/repeatable-entries.test.ts
// Pass 1 tests for Phase 6 Stage 2: Zod schema validation tests

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Define the schemas that should be implemented
const scopeQuerySchema = z.object({
  functionalityType: z.enum(['verification-edu', 'verification-emp'])
});

const repeatableSaveRequestSchema = z.object({
  sectionType: z.enum(['education', 'employment']),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string())
      ])
    }))
  }))
});

describe('Repeatable Entries Zod Schemas', () => {
  describe('scopeQuerySchema', () => {
    it('should accept valid education functionality type', () => {
      const validInput = {
        functionalityType: 'verification-edu'
      };

      const result = scopeQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.functionalityType).toBe('verification-edu');
      }
    });

    it('should accept valid employment functionality type', () => {
      const validInput = {
        functionalityType: 'verification-emp'
      };

      const result = scopeQuerySchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.functionalityType).toBe('verification-emp');
      }
    });

    it('should reject invalid functionality type', () => {
      const invalidInput = {
        functionalityType: 'verification-other'
      };

      const result = scopeQuerySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should reject missing functionality type', () => {
      const invalidInput = {};

      const result = scopeQuerySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Required');
      }
    });

    it('should reject extra fields', () => {
      const inputWithExtra = {
        functionalityType: 'verification-edu',
        extraField: 'should not be here'
      };

      // Parse with strict mode to catch extra fields
      const strictSchema = scopeQuerySchema.strict();
      const result = strictSchema.safeParse(inputWithExtra);
      expect(result.success).toBe(false);
    });

    it('should reject null functionality type', () => {
      const invalidInput = {
        functionalityType: null
      };

      const result = scopeQuerySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty string functionality type', () => {
      const invalidInput = {
        functionalityType: ''
      };

      const result = scopeQuerySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('repeatableSaveRequestSchema', () => {
    describe('valid inputs', () => {
      it('should accept valid education save with entries', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: 'Harvard University'
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440004',
                  value: '2018-09-01'
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept valid employment save with entries', () => {
        const validInput = {
          sectionType: 'employment',
          sectionId: 'employment',
          entries: [
            {
              entryId: '650e8400-e29b-41d4-a716-446655440001',
              countryId: '650e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '650e8400-e29b-41d4-a716-446655440003',
                  value: 'Google Inc.'
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept empty entries array', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: []
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept null countryId', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept multiple entries', () => {
        const validInput = {
          sectionType: 'employment',
          sectionId: 'employment',
          entries: [
            {
              entryId: '650e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'Company 1' }
              ]
            },
            {
              entryId: '650e8400-e29b-41d4-a716-446655440002',
              countryId: null,
              entryOrder: 1,
              fields: [
                { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'Company 2' }
              ]
            },
            {
              entryId: '650e8400-e29b-41d4-a716-446655440003',
              countryId: null,
              entryOrder: 2,
              fields: [
                { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'Company 3' }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.entries).toHaveLength(3);
        }
      });

      it('should accept all allowed field value types', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: 'string value'
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440004',
                  value: 12345
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440005',
                  value: true
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440006',
                  value: false
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440007',
                  value: null
                },
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440008',
                  value: ['array', 'of', 'strings']
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept zero as valid entryOrder', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept large entryOrder numbers', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 999,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject invalid section type', () => {
        const invalidInput = {
          sectionType: 'personal_info', // Not education or employment
          sectionId: 'personal_info',
          entries: []
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing entries array', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education'
          // Missing entries
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-array entries', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: 'not an array'
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject invalid UUID for entryId', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: 'not-a-uuid',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject invalid UUID for countryId', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: 'not-a-uuid',
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject negative entryOrder', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: -1,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer entryOrder', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 1.5,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing entryOrder', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              // Missing entryOrder
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing entryId', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              // Missing entryId
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject invalid requirementId UUID', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: 'not-a-uuid',
                  value: 'test'
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject array with non-string values', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: [1, 2, 3] // Array of numbers, not strings
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject object field values', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: { nested: 'object' } // Objects not allowed
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing sectionType', () => {
        const invalidInput = {
          // Missing sectionType
          sectionId: 'education',
          entries: []
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing sectionId', () => {
        const invalidInput = {
          sectionType: 'education',
          // Missing sectionId
          entries: []
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject fields array with missing value', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003'
                  // Missing value
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject fields that are not an array', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: 'not an array'
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle entries with very long UUID strings', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
              countryId: '00000000-0000-0000-0000-000000000000',
              entryOrder: 0,
              fields: []
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should handle very long string values in fields', () => {
        const longString = 'a'.repeat(10000);
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: longString
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should handle empty string values in fields', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: ''
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should handle zero as field value', () => {
        const validInput = {
          sectionType: 'employment',
          sectionId: 'employment',
          entries: [
            {
              entryId: '650e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '650e8400-e29b-41d4-a716-446655440003',
                  value: 0
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should handle empty arrays as field values', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: []
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });
  });
});