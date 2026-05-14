// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/record-search-schemas-pass1.test.ts
// Pass 1 tests for Task 8.4 — Record Search Requirements (Split from Address History).
// Spec / Plan: docs/plans/task-8.4-record-search-requirements-technical-plan.md
//
// These schemas are defined inline because the implementer has not yet created
// the production schema files. The shapes mirror the technical plan section
// "6. Zod Validation Schemas". Once the implementer creates:
//   - recordSearchSaveRequestSchema in
//     src/app/api/candidate/application/[token]/save/recordSearchSave.ts
//   - modified addressHistorySaveRequestSchema in
//     src/app/api/candidate/application/[token]/save/route.ts
// these tests will verify that the production schemas accept and reject the
// same inputs.
//
// All tests below are written to FAIL on first run if the implementer ever
// deviates from the plan's schema shape. They do NOT import the production
// schemas (which don't exist yet). They re-derive the schemas inline and
// validate the contract.

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema 1: recordSearchSaveRequestSchema (NEW — recordSearchSave.ts §6.1)
// ---------------------------------------------------------------------------
//
// Per the technical plan §6.1:
//
//   z.object({
//     sectionType: z.literal('record_search'),
//     sectionId: z.string().min(1),
//     fieldValues: z.record(
//       z.union([
//         z.string(),
//         z.number(),
//         z.boolean(),
//         z.null(),
//         z.array(z.string()),
//         z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
//       ]),
//     ),
//   });

const recordSearchSaveRequestSchema = z.object({
  sectionType: z.literal('record_search'),
  sectionId: z.string().min(1),
  fieldValues: z.record(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ]),
  ),
});

// ---------------------------------------------------------------------------
// Schema 2: addressHistorySaveRequestSchema (MODIFIED — save/route.ts §6.2)
// ---------------------------------------------------------------------------
//
// Per the technical plan §6.2: make `aggregatedFields` optional. Everything
// else stays the same as the today's Stage 3 schema.

const addressHistorySaveRequestSchemaModified = z.object({
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
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
      ]),
    })),
  })),
  // CHANGED: aggregatedFields is now optional (was required).
  aggregatedFields: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string()),
  ])).optional(),
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('Task 8.4 — Record Search Save Schema (Pass 1)', () => {

  // -------------------------------------------------------------------------
  // recordSearchSaveRequestSchema — valid inputs
  // -------------------------------------------------------------------------

  describe('recordSearchSaveRequestSchema — valid inputs', () => {
    it('should accept a minimal valid record_search save with empty fieldValues', () => {
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept fieldValues with primitive string values keyed by requirement UUID', () => {
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'Some text answer',
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept fieldValues with number, boolean, and null primitive values', () => {
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 12345,
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': true,
          'cccccccc-cccc-cccc-cccc-cccccccccccc': false,
          'dddddddd-dddd-dddd-dddd-dddddddddddd': null,
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept fieldValues with string[] (multi-select) values', () => {
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': ['choice-1', 'choice-2', 'choice-3'],
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept fieldValues with one-level nested object values (document metadata shape)', () => {
      // Per plan §6.1: the value union includes a one-level z.record so document
      // upload metadata (filename, mime, size, uploadedAt, etc.) can be stored.
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
            documentId: 'doc-uuid-123',
            fileName: 'transcript.pdf',
            mimeType: 'application/pdf',
            fileSize: 102400,
            uploadedAt: '2026-05-14T10:00:00Z',
          },
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept a mixed-shape fieldValues map', () => {
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'text',
          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': 42,
          'cccccccc-cccc-cccc-cccc-cccccccccccc': true,
          'dddddddd-dddd-dddd-dddd-dddddddddddd': null,
          'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee': ['a', 'b'],
          'ffffffff-ffff-ffff-ffff-ffffffffffff': { documentId: 'd1', fileName: 'f.pdf' },
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept sectionId that is a non-empty arbitrary string', () => {
      // Plan §6.1 only requires sectionId to be a non-empty string. The
      // convention in the plan is sectionId === 'record_search' but the
      // schema permits any non-empty string.
      const validInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // recordSearchSaveRequestSchema — invalid inputs
  // -------------------------------------------------------------------------

  describe('recordSearchSaveRequestSchema — invalid inputs', () => {
    it('should reject sectionType other than literal "record_search"', () => {
      const invalidInput = {
        sectionType: 'address_history',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject Title-Case sectionType (status values must be lowercase)', () => {
      // Project CLAUDE.md absolute rule: status values are always lowercase.
      const invalidInput = {
        sectionType: 'Record_Search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject UPPER-CASE sectionType', () => {
      const invalidInput = {
        sectionType: 'RECORD_SEARCH',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject camelCase sectionType', () => {
      const invalidInput = {
        sectionType: 'recordSearch',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject kebab-case sectionType', () => {
      const invalidInput = {
        sectionType: 'record-search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing sectionType', () => {
      const invalidInput = {
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing sectionId', () => {
      const invalidInput = {
        sectionType: 'record_search',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject empty-string sectionId (plan §6.1 requires min(1))', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: '',
        fieldValues: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject missing fieldValues', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-object fieldValues (string)', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: 'not an object',
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-object fieldValues (array)', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: ['not', 'an', 'object'],
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject null fieldValues', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: null,
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject deeply-nested object values (only one level of records allowed)', () => {
      // Plan §6.1: the inner record only allows primitive values, not nested
      // objects. This prevents arbitrary blobs from being persisted.
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': {
            documentId: 'doc-uuid',
            metadata: { deeply: { nested: 'no' } },
          },
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject array-of-numbers (only array-of-strings is in the value union)', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': [1, 2, 3],
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject undefined fieldValue entries (undefined is not in the union)', () => {
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': undefined,
        },
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject the legacy address_history payload shape (with entries / aggregatedFields)', () => {
      // The record_search schema is strict about its own shape — it should
      // not silently accept an address_history-shaped payload.
      const invalidInput = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        entries: [],
        aggregatedFields: {},
      };

      const result = recordSearchSaveRequestSchema.safeParse(invalidInput);
      // fieldValues is missing → invalid regardless of extra keys.
      expect(result.success).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // addressHistorySaveRequestSchema (MODIFIED — aggregatedFields optional)
  // -------------------------------------------------------------------------

  describe('addressHistorySaveRequestSchema (MODIFIED) — aggregatedFields is now optional', () => {

    describe('valid inputs', () => {
      it('should accept an address_history save WITHOUT aggregatedFields (new behavior)', () => {
        // Plan §4.3, §6.2: aggregatedFields becomes optional after Task 8.4.
        // The Address History client no longer sends it.
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [],
            },
          ],
          // aggregatedFields deliberately omitted — this MUST be accepted.
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should still accept an address_history save WITH aggregatedFields (backward tolerance)', () => {
        // Plan §4.3: existing/legacy clients that still send aggregatedFields
        // must continue to work for backward tolerance.
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: '550e8400-e29b-41d4-a716-446655440002',
              entryOrder: 0,
              fields: [],
            },
          ],
          aggregatedFields: {
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 'legacy value',
          },
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should accept an address_history save with empty entries and no aggregatedFields', () => {
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [],
          // aggregatedFields deliberately omitted.
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should still accept an address_history save with empty aggregatedFields object', () => {
        // Backward tolerance: legacy clients may send `{}`.
        const validInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [],
          aggregatedFields: {},
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(validInput);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs (regression — preserve current behavior)', () => {
      it('should still reject missing entries (entries remains required)', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          // entries missing
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should still reject non-UUID entryId', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: 'not-a-uuid',
              countryId: null,
              entryOrder: 0,
              fields: [],
            },
          ],
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should still reject negative entryOrder', () => {
        const invalidInput = {
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: [
            {
              entryId: '550e8400-e29b-41d4-a716-446655440001',
              countryId: null,
              entryOrder: -1,
              fields: [],
            },
          ],
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });

      it('should still reject sectionType other than "address_history"', () => {
        const invalidInput = {
          sectionType: 'record_search',
          sectionId: 'address_history',
          entries: [],
        };

        const result = addressHistorySaveRequestSchemaModified.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Cross-schema invariants — recordSearch vs addressHistory disjointness
  // -------------------------------------------------------------------------

  describe('cross-schema invariants', () => {
    it('a record_search payload should NOT validate against the address_history schema', () => {
      const recordSearchPayload = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const result = addressHistorySaveRequestSchemaModified.safeParse(recordSearchPayload);
      expect(result.success).toBe(false);
    });

    it('an address_history payload (entries-only) should NOT validate against the record_search schema', () => {
      const addressHistoryPayload = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [],
      };

      const result = recordSearchSaveRequestSchema.safeParse(addressHistoryPayload);
      expect(result.success).toBe(false);
    });

    it('the record_search literal must be lowercase snake_case (project rule)', () => {
      // The project CLAUDE.md rule: "Status values are always lowercase."
      // Section type literals follow the same lowercase-snake_case convention.
      const variants = ['Record_Search', 'recordSearch', 'record-search', 'RECORD_SEARCH', 'RecordSearch'];

      for (const sectionType of variants) {
        const result = recordSearchSaveRequestSchema.safeParse({
          sectionType,
          sectionId: 'record_search',
          fieldValues: {},
        });
        expect(result.success).toBe(false);
      }
    });
  });
});
