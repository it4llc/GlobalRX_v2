// /GlobalRX_v2/src/schemas/__tests__/address-history-stage3.test.ts
// Pass 1 tests for Phase 6 Stage 3: Zod schema validation tests
//
// These schemas are defined inline because the implementer has not yet created
// the production schema files. The shapes mirror the technical plan
// (docs/specs/phase6-stage3-address-history-address-block-rendering-technical-plan.md)
// section "Zod Validation Schemas". Once the implementer creates the real schemas
// in src/app/api/candidate/application/[token]/save/route.ts,
// src/app/api/candidate/application/[token]/subdivisions/route.ts, and
// src/app/api/candidate/application/[token]/scope/route.ts, these tests will
// verify that the production schemas accept and reject the same inputs.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema 1: addressHistorySaveRequestSchema (NEW — save/route.ts)
// ---------------------------------------------------------------------------
//
// Per technical plan: the save body for the address_history section type.
// Includes entries (each with fields whose value can be a JSON object for
// address_block fields) and a top-level aggregatedFields map.

const addressHistorySaveRequestSchema = z.object({
  sectionType: z.literal('address_history'),
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
        z.array(z.string()),
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ])
    }))
  })),
  aggregatedFields: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string())
  ]))
});

// ---------------------------------------------------------------------------
// Schema 2: subdivisionsQuerySchema (NEW — subdivisions/route.ts)
// ---------------------------------------------------------------------------

const subdivisionsQuerySchema = z.object({
  parentId: z.string().uuid()
});

// ---------------------------------------------------------------------------
// Schema 3: scopeQuerySchema (MODIFIED — scope/route.ts)
// ---------------------------------------------------------------------------
//
// Per technical plan: extend the existing enum to include 'record'.

const scopeQuerySchema = z.object({
  functionalityType: z.enum(['verification-edu', 'verification-emp', 'record'])
});

// ---------------------------------------------------------------------------
// Schema 4: repeatableSaveRequestSchema (MODIFIED — save/route.ts)
// ---------------------------------------------------------------------------
//
// Per technical plan: widen the per-field value union to also accept the
// address-block JSON object form (so Education / Employment can carry
// address_block field values once the new component renders for them).

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
        z.array(z.string()),
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ])
    }))
  }))
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('Phase 6 Stage 3 — Zod Schemas', () => {

  // -------------------------------------------------------------------------
  // addressHistorySaveRequestSchema
  // -------------------------------------------------------------------------

  describe('addressHistorySaveRequestSchema', () => {

    describe('valid inputs', () => {
      it('should accept a minimal valid address_history save with one entry', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an entry with an address_block JSON object value (no dates)', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: {
                    street1: '123 Main St',
                    street2: 'Apt 4B',
                    city: 'Arlington',
                    state: 'f53e7f72-8bbe-4017-994a-499b681bfc70',
                    postalCode: '22201'
                  }
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an entry with an address_block JSON object value including dates nested inside', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: {
                    street1: '123 Main Street',
                    street2: 'Apt 4B',
                    city: 'Arlington',
                    state: 'f53e7f72-8bbe-4017-994a-499b681bfc70',
                    postalCode: '22201',
                    fromDate: '2022-03-01',
                    toDate: '2024-06-15',
                    isCurrent: false
                  }
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept current-address shape (toDate null, isCurrent true)', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: {
                    street1: '123 Main St',
                    city: 'Arlington',
                    state: 'f53e7f72-8bbe-4017-994a-499b681bfc70',
                    postalCode: '22201',
                    fromDate: '2022-03-01',
                    toDate: null,
                    isCurrent: true
                  }
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept multiple entries with different countries', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: []
            },
            {
              entryId: '550e8400-e29b-41d4-a716-446655440003',
              countryId: '550e8400-e29b-41d4-a716-446655440004',
              entryOrder: 1,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.entries).toHaveLength(2);
        }
      });

      it('should accept aggregatedFields with primitive values keyed by requirement UUID', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'some text value',
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': 12345,
            'cccccccc-cccc-cccc-cccc-cccccccccccc': true,
            'dddddddd-dddd-dddd-dddd-dddddddddddd': null,
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee': ['multi', 'select']
          }
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept null countryId on an entry', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept empty aggregatedFields object', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an entry with a free-text state value (string, not UUID)', () => {
        // Per spec: state is stored as plain string when no subdivisions exist
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: {
                    street1: '123 Main St',
                    city: 'Pyongyang',
                    state: 'Pyongyang Province',
                    postalCode: '00000',
                    fromDate: '2020-01-01',
                    toDate: '2021-01-01',
                    isCurrent: false
                  }
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject sectionType other than literal "address_history"', () => {
        const invalidInput = {
          sectionType: 'education',
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject Title-Case sectionType (status values must be lowercase)', () => {
        const invalidInput = {
          sectionType: 'Address_History',
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject UPPER-CASE sectionType (status values must be lowercase)', () => {
        const invalidInput = {
          sectionType: 'ADDRESS_HISTORY',
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing sectionType', () => {
        const invalidInput = {
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing sectionId', () => {
        const invalidInput = {
          sectionType: 'address_history',
          entries: [],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing entries array', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing aggregatedFields', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: []
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-array entries', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: 'not an array',
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-UUID entryId', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: 'not-a-uuid',
              countryId: null,
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-UUID countryId', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: 'not-a-uuid',
              entryOrder: 0,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject negative entryOrder', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: -1,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-integer entryOrder', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 1.5,
              fields: []
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-UUID requirementId in fields', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
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
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject missing value on a field', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003'
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject deeply-nested object value (the JSON record only allows primitive values, not nested objects)', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                {
                  requirementId: '550e8400-e29b-41d4-a716-446655440003',
                  value: {
                    street1: '123 Main',
                    nested: { deeply: 'nested' }
                  }
                }
              ]
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-array fields', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: 'not an array'
            }
          ],
          aggregatedFields: {}
        };

        const result = addressHistorySaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // subdivisionsQuerySchema
  // -------------------------------------------------------------------------

  describe('subdivisionsQuerySchema', () => {

    describe('valid inputs', () => {
      it('should accept a valid UUID parentId', () => {
        const validInput = {
          parentId: '550e8400-e29b-41d4-a716-446655440002'
        };

        const result = subdivisionsQuerySchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.parentId).toBe('550e8400-e29b-41d4-a716-446655440002');
        }
      });

      it('should accept the all-zeros UUID', () => {
        const validInput = {
          parentId: '00000000-0000-0000-0000-000000000000'
        };

        const result = subdivisionsQuerySchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept the all-Fs UUID', () => {
        const validInput = {
          parentId: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
        };

        const result = subdivisionsQuerySchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject missing parentId', () => {
        const invalidInput = {};

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject empty-string parentId', () => {
        const invalidInput = {
          parentId: ''
        };

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject non-UUID parentId string', () => {
        const invalidInput = {
          parentId: 'not-a-uuid'
        };

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject numeric parentId', () => {
        const invalidInput = {
          parentId: 12345
        };

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject null parentId', () => {
        const invalidInput = {
          parentId: null
        };

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should reject parentId with extra characters', () => {
        const invalidInput = {
          parentId: '550e8400-e29b-41d4-a716-446655440002-extra'
        };

        const result = subdivisionsQuerySchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // scopeQuerySchema (extended for record functionality type)
  // -------------------------------------------------------------------------

  describe('scopeQuerySchema (Stage 3 — extended for record)', () => {

    describe('valid inputs', () => {
      it('should accept verification-edu (preserved from Stage 2)', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'verification-edu' });
        expect(result.success).toBe(true);
      });

      it('should accept verification-emp (preserved from Stage 2)', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'verification-emp' });
        expect(result.success).toBe(true);
      });

      it('should accept record (NEW for Stage 3 — required for Address History section)', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'record' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.functionalityType).toBe('record');
        }
      });
    });

    describe('invalid inputs', () => {
      it('should reject Title-Case Record', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'Record' });
        expect(result.success).toBe(false);
      });

      it('should reject UPPER-CASE RECORD', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'RECORD' });
        expect(result.success).toBe(false);
      });

      it('should reject other functionality type values not in the enum', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'address_history' });
        expect(result.success).toBe(false);
      });

      it('should reject idv (not a scope-supporting functionality type per Stage 2 contract)', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: 'idv' });
        expect(result.success).toBe(false);
      });

      it('should reject empty string functionality type', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: '' });
        expect(result.success).toBe(false);
      });

      it('should reject missing functionality type', () => {
        const result = scopeQuerySchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('should reject null functionality type', () => {
        const result = scopeQuerySchema.safeParse({ functionalityType: null });
        expect(result.success).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // repeatableSaveRequestSchema (widened value union)
  // -------------------------------------------------------------------------

  describe('repeatableSaveRequestSchema (Stage 3 — widened value union for address_block)', () => {

    describe('valid inputs', () => {
      it('should preserve Stage 2 behavior — string field value still valid', () => {
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
                  value: 'Harvard University'
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an address_block JSON object value on an education entry', () => {
        // Stage 3: Education's School Address now produces a JSON object, not a placeholder
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
                  value: {
                    street1: '1350 Massachusetts Ave',
                    city: 'Cambridge',
                    state: 'f53e7f72-8bbe-4017-994a-499b681bfc70',
                    postalCode: '02138'
                  }
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an address_block JSON object value on an employment entry', () => {
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
                },
                {
                  requirementId: '650e8400-e29b-41d4-a716-446655440004',
                  value: {
                    street1: '1600 Amphitheatre Parkway',
                    city: 'Mountain View',
                    state: 'f53e7f72-8bbe-4017-994a-499b681bfc70',
                    postalCode: '94043'
                  }
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept primitive value types from Stage 2 alongside the new object case', () => {
        const validInput = {
          sectionType: 'education',
          sectionId: 'education',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: 0,
              fields: [
                { requirementId: '550e8400-e29b-41d4-a716-446655440003', value: 'string' },
                { requirementId: '550e8400-e29b-41d4-a716-446655440004', value: 42 },
                { requirementId: '550e8400-e29b-41d4-a716-446655440005', value: true },
                { requirementId: '550e8400-e29b-41d4-a716-446655440006', value: false },
                { requirementId: '550e8400-e29b-41d4-a716-446655440007', value: null },
                { requirementId: '550e8400-e29b-41d4-a716-446655440008', value: ['a', 'b'] },
                { requirementId: '550e8400-e29b-41d4-a716-446655440009', value: { street1: '1', city: '2' } }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject address_history sectionType (use addressHistorySaveRequestSchema instead)', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: []
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should still reject deeply-nested objects in field value (only one level of records)', () => {
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
                  value: {
                    street1: '123 Main',
                    nested: { deeply: 'nested' }
                  }
                }
              ]
            }
          ]
        };

        const result = repeatableSaveRequestSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cross-schema invariants documented in the spec
  // -------------------------------------------------------------------------

  describe('spec invariants', () => {
    it('should require sectionType lowercase literal "address_history" (Business Rule: lowercase status values)', () => {
      // Spec Data Requirements: "Always lowercase string 'address_history'"
      const invalidVariants = ['Address_history', 'address-history', 'addressHistory', 'ADDRESSHISTORY'];

      for (const sectionType of invalidVariants) {
        const result = addressHistorySaveRequestSchema.safeParse({
          sectionType,
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {}
        });
        expect(result.success).toBe(false);
      }
    });

    it('should require fields/aggregatedFields to be keyed by something string-compatible (DSX requirement UUID)', () => {
      // Per spec: keys in entries[].fields and aggregatedFields are dsx_requirements.id UUIDs.
      // The schema validates that aggregatedFields is a record (object), but does not restrict
      // key shape to UUID (because Zod records don't constrain key formats, and string keys
      // are inherent in JS). This test documents that the schema accepts any string-keyed
      // record and leaves UUID-key validation to the application layer.
      const validInput = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: 0,
            fields: []
          }
        ],
        aggregatedFields: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'value'
        }
      };

      const result = addressHistorySaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });
});
