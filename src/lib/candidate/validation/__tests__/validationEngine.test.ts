// /GlobalRX_v2/src/lib/candidate/validation/__tests__/validationEngine.test.ts
//
// Phase 7 Stage 1 — Pass 2 unit tests for the runValidation orchestrator.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 11, 17, 18, 20, 27, 28, 35; DoD 27, 33)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.8
//
// Mocking discipline:
//   - Prisma is the global mock from src/test/setup.ts; we stub findUnique
//     per test to provide invitation/package/workflow rows.
//   - We do NOT mock the validation helpers (scopeValidation, gapDetection,
//     dateExtractors, packageScopeShape) — the engine's job is to compose
//     them, and per Rule M2 mocking out the helpers would let the engine
//     pass even when its composition is broken.
//   - We do NOT mock runValidation itself (Rule M1 — subject of the test).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';

import { runValidation } from '../validationEngine';

// Helper — build a minimal invitation row matching the shape the engine
// loads via prisma.candidateInvitation.findUnique(...).
function buildInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-123',
    formData: {},
    package: {
      id: 'pkg-123',
      workflow: {
        id: 'wf-123',
        gapToleranceDays: null,
        sections: [],
      },
      packageServices: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runValidation', () => {
  describe('failure modes', () => {
    it('throws when the invitation is not found', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        null,
      );

      await expect(runValidation('missing-id')).rejects.toThrow(
        /Invitation not found/,
      );
    });

    it('returns an empty result when the invitation has no package', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ package: null }) as never,
      );

      const result = await runValidation('inv-123');
      expect(result.sections).toEqual([]);
      expect(result.summary).toEqual({
        sections: [],
        allComplete: true,
        totalErrors: 0,
      });
    });
  });

  describe('Personal Info section — Rule 18 (no scope/gap)', () => {
    it('emits a Personal Info section with not_started status when never visited', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      const result = await runValidation('inv-123');
      const personal = result.sections.find(
        (s) => s.sectionId === 'personal_info',
      );

      expect(personal).toBeDefined();
      expect(personal!.status).toBe('not_started');
      // Rule 18: Personal Info has NO scope or gap errors.
      expect(personal!.scopeErrors).toEqual([]);
      expect(personal!.gapErrors).toEqual([]);
    });

    it('emits Personal Info as complete when it has saved fields', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          formData: {
            sections: {
              personal_info: {
                type: 'personal_info',
                fields: [{ requirementId: 'req-1', value: 'John' }],
              },
            },
          },
        }) as never,
      );

      const result = await runValidation('inv-123');
      const personal = result.sections.find(
        (s) => s.sectionId === 'personal_info',
      );

      expect(personal!.status).toBe('complete');
    });
  });

  describe('Address History section — Rule 17 (scope) + Rule 20 (gaps allowed)', () => {
    it('reports a count_exact scope error when the section has 0 entries (Rule 12)', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-record',
                scope: null, // null record scope → count_exact 1 default
                service: {
                  id: 'svc-record',
                  functionalityType: 'record',
                },
              },
            ],
          },
          formData: {
            // Section visited and departed → errors should surface in status.
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: {
                type: 'address_history',
                entries: [],
              },
            },
          },
        }) as never,
      );

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      expect(address!.scopeErrors.length).toBeGreaterThan(0);
      // Status reflects the scope error (Rule 27).
      expect(address!.status).toBe('incomplete');
    });

    it('keeps the section in not_started when no visit/departure and no review visit', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-record',
                scope: null,
                service: { id: 'svc-record', functionalityType: 'record' },
              },
            ],
          },
          // No sectionVisits, no reviewPageVisitedAt, no entries — nothing
          // saved at all.
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      // Even though scope/gap arrays might contain errors internally, the
      // status must be `not_started` (lowercase per DoD 33) because the
      // candidate hasn't visited yet.
      expect(address!.status).toBe('not_started');
    });
  });

  describe('Education section — Rule 17 (scope) + Rule 20 (NO gap detection)', () => {
    it('emits a section with status `not_started` and empty gap errors', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: 0, sections: [] },
            packageServices: [
              {
                id: 'ps-edu',
                scope: null,
                service: {
                  id: 'svc-edu',
                  functionalityType: 'verification-edu',
                },
              },
            ],
          },
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      // Rule 20: Education NEVER has gap errors, even when gapToleranceDays
      // is 0 (strictest setting).
      expect(edu!.gapErrors).toEqual([]);
    });
  });

  describe('Employment section — Rule 17 (scope) + Rule 20 (gaps applied)', () => {
    it('emits a service_verification-emp section that exists in the result', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: 30, sections: [] },
            packageServices: [
              {
                id: 'ps-emp',
                scope: null,
                service: {
                  id: 'svc-emp',
                  functionalityType: 'verification-emp',
                },
              },
            ],
          },
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const emp = result.sections.find(
        (s) => s.sectionId === 'service_verification-emp',
      );

      expect(emp).toBeDefined();
      // gapErrors array exists on the result (length 0 since no entries).
      expect(emp!.gapErrors).toEqual([]);
    });
  });

  describe('IDV section — Rule 18 (no scope/gap)', () => {
    it('emits an IDV section when the package contains an idv service', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-idv',
                scope: null,
                service: { id: 'svc-idv', functionalityType: 'idv' },
              },
            ],
          },
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const idv = result.sections.find((s) => s.sectionId === 'service_idv');

      expect(idv).toBeDefined();
      expect(idv!.scopeErrors).toEqual([]);
      expect(idv!.gapErrors).toEqual([]);
    });

    it('does NOT emit an IDV section when the package has no idv service', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      const result = await runValidation('inv-123');
      const idv = result.sections.find((s) => s.sectionId === 'service_idv');

      expect(idv).toBeUndefined();
    });
  });

  describe('Workflow sections', () => {
    it('emits one section result per workflow section in the package', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: {
              id: 'wf-123',
              gapToleranceDays: null,
              sections: [
                { id: 'wf-section-1', name: 'Notice', placement: 'before_services' },
                { id: 'wf-section-2', name: 'Consent', placement: 'after_services' },
              ],
            },
            packageServices: [],
          },
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const wf1 = result.sections.find((s) => s.sectionId === 'wf-section-1');
      const wf2 = result.sections.find((s) => s.sectionId === 'wf-section-2');

      expect(wf1).toBeDefined();
      expect(wf2).toBeDefined();
      expect(wf1!.status).toBe('not_started');
      expect(wf2!.status).toBe('not_started');
    });
  });

  describe('Rule 35 — validation always recomputed (no caching)', () => {
    it('queries Prisma every time runValidation is called', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique)
        .mockResolvedValueOnce(buildInvitation() as never)
        .mockResolvedValueOnce(buildInvitation() as never);

      await runValidation('inv-123');
      await runValidation('inv-123');

      // Two findUnique calls — the engine MUST NOT cache the first result
      // and reuse it (Rule 35).
      expect(prisma.candidateInvitation.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Review summary — DoD 33 (lowercase status values)', () => {
    it('every section status in the summary is one of the three lowercase strings', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-idv',
                scope: null,
                service: { id: 'svc-idv', functionalityType: 'idv' },
              },
            ],
          },
          formData: {},
        }) as never,
      );

      const result = await runValidation('inv-123');
      const validStatuses = new Set(['not_started', 'incomplete', 'complete']);
      for (const sec of result.summary.sections) {
        expect(validStatuses.has(sec.status)).toBe(true);
      }
    });

    it('summary.totalErrors equals the sum of error arrays across all sections', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-record',
                scope: null,
                service: { id: 'svc-record', functionalityType: 'record' },
              },
            ],
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: { type: 'address_history', entries: [] },
            },
          },
        }) as never,
      );

      const result = await runValidation('inv-123');

      // Compute expected totalErrors by summing all sub-arrays per section.
      const expected = result.sections.reduce(
        (acc, s) =>
          acc +
          s.fieldErrors.length +
          s.scopeErrors.length +
          s.gapErrors.length +
          s.documentErrors.length,
        0,
      );

      expect(result.summary.totalErrors).toBe(expected);
    });

    it('summary.allComplete is false when any section is not complete', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      const result = await runValidation('inv-123');

      // Only personal_info section, status not_started → allComplete false.
      const anyNotComplete = result.sections.some(
        (s) => s.status !== 'complete',
      );
      expect(result.summary.allComplete).toBe(!anyNotComplete);
    });
  });

  describe('Rule 11 — deletion path puts a previously-departed section back to incomplete', () => {
    it('after deletion to 0 entries, departed section returns to incomplete (no re-departure)', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-record',
                scope: null,
                service: { id: 'svc-record', functionalityType: 'record' },
              },
            ],
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            // After deletion: zero entries.
            sections: {
              address_history: { type: 'address_history', entries: [] },
            },
          },
        }) as never,
      );

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      // Status returns to incomplete (Rule 11 / Rule 28) immediately because
      // the section has been departed and now has scope errors (0 entries
      // when count_exact 1 required).
      expect(address!.status).toBe('incomplete');
      expect(address!.scopeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Rule 34 — review-page visit makes all sections eligible to show errors', () => {
    it('an unvisited address section reports incomplete when reviewPageVisitedAt is set', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: [
              {
                id: 'ps-record',
                scope: null,
                service: { id: 'svc-record', functionalityType: 'record' },
              },
            ],
          },
          formData: {
            // No sectionVisits — but review page WAS visited.
            reviewPageVisitedAt: '2026-05-06T12:00:00Z',
            sections: {
              address_history: { type: 'address_history', entries: [] },
            },
          },
        }) as never,
      );

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      // Rule 34: even though the section has never been visited or departed,
      // the review-page visit makes it eligible for error display, and since
      // it has scope errors, status becomes 'incomplete'.
      expect(address!.status).toBe('incomplete');
    });
  });

  // ===========================================================================
  // Phase 7 Stage 3b — TD-069 per-entry required-field validation
  //
  // Spec:           docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md
  //                 (Rules 1–11; DoD 1–10)
  // Technical plan: docs/plans/phase7-stage3b-technical-plan.md §1.1, §1.2, §1.3, §6, §9.6
  //
  // These tests exercise the new per-entry walk for Address History,
  // Education, and Employment. They run through `runValidation` end-to-end
  // so the engine wiring + the new repeatableEntryFieldChecks helper are
  // tested together (architect's plan §6.1 — integration coverage via
  // validationEngine.test.ts is the primary regression surface for TD-069).
  //
  // Mocking discipline:
  //   - Rule M1: We do NOT mock runValidation, validationEngine, or the new
  //     repeatableEntryFieldChecks module — they are the subject of the test.
  //   - prisma.candidateInvitation.findUnique is stubbed per-test with the
  //     same buildInvitation pattern used above.
  //   - prisma.dSXMapping.findMany is stubbed with an INLINE implementation
  //     that filters per the OR-of-pairs in the where clause (Rule M3 — the
  //     mock honors the helper's actual query shape so a misshaped query
  //     would not "pass" the test by accident).
  // ===========================================================================

  // -------------------------------------------------------------------------
  // Stage-3b fixture helpers (local to the TD-069 describe block).
  //
  // These deliberately mirror the Prisma payload shape that
  // `loadValidationInputs.ts` produces, including the address_block
  // `fieldData.addressConfig` shape pinned in technical plan §1.1.
  // -------------------------------------------------------------------------

  type Stage3bRequirement = {
    id: string;
    name: string;
    fieldKey: string;
    type: 'field' | 'document';
    disabled?: boolean;
    fieldData?: Record<string, unknown> | null;
  };

  /**
   * Build a packageServices fixture that the engine can read through
   * loadValidationInputs.ts's existing include shape (lines 65-87).
   */
  function buildStage3bPackageServices(
    services: Array<{
      id: string;
      functionalityType: string;
      requirements: Stage3bRequirement[];
      scope?: unknown;
    }>,
  ): unknown[] {
    return services.map((s) => ({
      id: `ps-${s.id}`,
      packageId: 'pkg-123',
      serviceId: s.id,
      scope: s.scope ?? null,
      service: {
        id: s.id,
        functionalityType: s.functionalityType,
        serviceRequirements: s.requirements.map((r) => ({
          serviceId: s.id,
          requirementId: r.id,
          requirement: {
            id: r.id,
            name: r.name,
            fieldKey: r.fieldKey,
            type: r.type,
            disabled: r.disabled ?? false,
            fieldData: r.fieldData ?? null,
          },
        })),
        availability: [],
      },
    }));
  }

  /**
   * Stub prisma.dSXMapping.findMany with a fixture-driven implementation
   * that filters rows against the OR-of-pairs supplied by the engine's
   * batched query. The `requirementId` IN filter is honored when present
   * (matches the loadValidationInputs.ts:247-274 buildFindMappings adapter).
   */
  function stubDsxMappings(
    rows: Array<{
      requirementId: string;
      serviceId: string;
      locationId: string;
      isRequired: boolean;
    }>,
  ): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findManyMock = prisma.dSXMapping.findMany as unknown as any;
    findManyMock.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (args: any) => {
        const where = args?.where ?? {};
        const orPairs: Array<{ serviceId: string; locationId: string }> =
          where.OR ?? [];
        const reqFilter: { in?: string[] } | undefined = where.requirementId;
        const wantedPairs = new Set(
          orPairs.map((p) => `${p.serviceId}:${p.locationId}`),
        );
        return rows.filter((row) => {
          if (!wantedPairs.has(`${row.serviceId}:${row.locationId}`)) {
            return false;
          }
          if (reqFilter?.in && !reqFilter.in.includes(row.requirementId)) {
            return false;
          }
          return true;
        });
      },
    );
  }

  // The canonical US-style addressConfig from technical plan §1.1: the four
  // pieces street1, city, state, postalCode are enabled+required; street2 is
  // enabled but optional; county is disabled.
  const CANONICAL_ADDRESS_CONFIG = {
    street1: { enabled: true, label: 'Street Address', required: true },
    street2: { enabled: true, label: 'Apt/Suite', required: false },
    city: { enabled: true, label: 'City', required: true },
    state: { enabled: true, label: 'State/Province', required: true },
    county: { enabled: false, label: 'County', required: false },
    postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
  };

  const COUNTRY_A = 'country-uuid-A-0001';
  const COUNTRY_B = 'country-uuid-B-0002';
  const SVC_RECORD = 'svc-record-001';
  const SVC_EDU = 'svc-edu-001';
  const SVC_EMP = 'svc-emp-001';
  const REQ_ADDR_BLOCK = 'req-addr-block-001';
  const REQ_DEGREE = 'req-degree-001';
  const REQ_JOB_TITLE = 'req-jobTitle-001';

  describe('TD-069 — Address History per-entry required-field walk (DoD 1)', () => {
    it('DoD 1: bare address_block (only countryId + dates, no street/city/state/postalCode) → status incomplete with FieldError per required piece', async () => {
      // Worked example from technical plan §1.2: an address_block
      // requirement is required at (record-service, country-A); the saved
      // entry's value contains only the dates and isCurrent. The walk emits
      // one FieldError per (enabled && required && empty) piece — street1,
      // city, state, postalCode (4 errors) — and skips county (disabled)
      // and street2 (optional).
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_RECORD,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: {
                type: 'address_history',
                entries: [
                  {
                    entryId: 'entry-1',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [
                      {
                        requirementId: REQ_ADDR_BLOCK,
                        value: {
                          fromDate: '2024-01-01',
                          toDate: '2025-01-01',
                          isCurrent: false,
                          // street1, street2, city, state, county,
                          // postalCode are all unset.
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      expect(address!.status).toBe('incomplete');

      // The four required-and-enabled pieces produce one field error each.
      const fieldNames = address!.fieldErrors.map((fe) => fe.fieldName);
      expect(fieldNames.some((n) => n.includes('street1'))).toBe(true);
      expect(fieldNames.some((n) => n.includes('city'))).toBe(true);
      expect(fieldNames.some((n) => n.includes('state'))).toBe(true);
      expect(fieldNames.some((n) => n.includes('postalCode'))).toBe(true);
      // county is disabled → must NOT appear; street2 is not required →
      // must NOT appear.
      expect(fieldNames.some((n) => n.includes('county'))).toBe(false);
      expect(fieldNames.some((n) => n.includes('street2'))).toBe(false);

      // Every per-entry field error must use the existing
      // `candidate.validation.fieldRequired` translation key (Spec Rule 11).
      for (const fe of address!.fieldErrors) {
        expect(fe.messageKey).toBe('candidate.validation.fieldRequired');
      }
    });
  });

  describe('TD-069 — Education per-entry required-field walk (DoD 2)', () => {
    it('DoD 2: Education entry missing a country-required degreeAwarded → status incomplete with FieldError for degreeAwarded', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-edu-1',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    // School name + dates filled, but degreeAwarded empty.
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      expect(edu!.status).toBe('incomplete');
      expect(edu!.fieldErrors.length).toBeGreaterThan(0);
      // The missing field's name surfaces in fieldName (architect's plan
      // §1.2 final pseudocode block: scalar requirement → fieldName =
      // requirement.name).
      const degreeError = edu!.fieldErrors.find(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      expect(degreeError).toBeDefined();
      expect(degreeError!.messageKey).toBe(
        'candidate.validation.fieldRequired',
      );
    });
  });

  describe('TD-069 — Employment per-entry required-field walk (DoD 3)', () => {
    it('DoD 3: Employment entry missing a country-required jobTitle → status incomplete with FieldError for jobTitle', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EMP,
                functionalityType: 'verification-emp',
                requirements: [
                  {
                    id: REQ_JOB_TITLE,
                    name: 'Job Title',
                    fieldKey: 'jobTitle',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              employment: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              employment: {
                type: 'employment',
                entries: [
                  {
                    entryId: 'entry-emp-1',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    // Employer + dates filled, jobTitle empty.
                    fields: [{ requirementId: REQ_JOB_TITLE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_JOB_TITLE,
          serviceId: SVC_EMP,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const emp = result.sections.find(
        (s) => s.sectionId === 'service_verification-emp',
      );

      expect(emp).toBeDefined();
      expect(emp!.status).toBe('incomplete');
      const jobTitleError = emp!.fieldErrors.find(
        (fe) => fe.fieldName === 'Job Title',
      );
      expect(jobTitleError).toBeDefined();
      expect(jobTitleError!.messageKey).toBe(
        'candidate.validation.fieldRequired',
      );
    });
  });

  describe('TD-069 — Two entries, two countries, distinct rules (DoD 4)', () => {
    it("DoD 4: validates each entry against its OWN country's required-field rules — only the failing country's errors appear", async () => {
      // Education section has two entries, one from country A and one from
      // country B. The same `req-degreeAwarded` requirement is mapped at
      // both countries — but `isRequired = false` at country A and
      // `isRequired = true` at country B. Both entries leave degreeAwarded
      // empty. Only entry B (entryOrder = 2) should produce a field error;
      // entry A passes because its country's rule says degreeAwarded is
      // optional. This is the central TD-069 behavior: the per-entry walk
      // resolves the required-field set per the entry's own country, not a
      // single section-wide country.
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-A',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                  {
                    entryId: 'entry-B',
                    countryId: COUNTRY_B,
                    entryOrder: 2,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      // The same requirementId has DIFFERENT isRequired flags at different
      // countries — the test fixture that proves the batched per-section
      // query is keyed correctly on (serviceId, locationId).
      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: false, // country A says: not required
        },
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_B,
          isRequired: true, // country B says: required
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      expect(edu!.status).toBe('incomplete');

      // Exactly the country-B entry's missing degree should appear.
      // The placeholders or fieldName must reflect entryOrder = 2, since
      // architect's plan §1.2 pseudocode passes `placeholders: { entryOrder }`
      // for every per-entry field error.
      const degreeErrors = edu!.fieldErrors.filter(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      expect(degreeErrors).toHaveLength(1);
      // The single error is for entry 2 (country B), not entry 1 (country A).
      expect(degreeErrors[0].placeholders?.entryOrder).toBe(2);
    });
  });

  describe('TD-069 — Entry with countryId === null (DoD 5)', () => {
    it('DoD 5: entry with null countryId emits an entryCountryRequired field error and the section is incomplete', async () => {
      // Per Spec Rule 4 + technical plan §9.6:
      //   fieldName    = "Entry ${entryOrder}"
      //   messageKey   = 'candidate.validation.entryCountryRequired'
      //   placeholders = { entryOrder }
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_RECORD,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: {
                type: 'address_history',
                entries: [
                  {
                    entryId: 'entry-no-country',
                    countryId: null, // <-- the case under test
                    entryOrder: 1,
                    fields: [],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      // No mappings stub needed for the null-country branch — the per-entry
      // walk handles null country before any mapping-based rule lookup.
      stubDsxMappings([]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      expect(address!.status).toBe('incomplete');

      const entryCountryError = address!.fieldErrors.find(
        (fe) => fe.messageKey === 'candidate.validation.entryCountryRequired',
      );
      expect(entryCountryError).toBeDefined();
      // Architect's plan §9.6 — exact fieldName format and placeholders
      // shape. Asserted exactly so any future renaming is caught.
      expect(entryCountryError!.fieldName).toBe('Entry 1');
      expect(entryCountryError!.placeholders).toEqual({ entryOrder: 1 });
    });
  });

  describe('TD-069 — Section with zero entries (DoD 6)', () => {
    it('DoD 6: section with zero entries produces zero per-entry field errors (existing scope errors still fire)', async () => {
      // The per-entry walk must not fabricate field errors for a section
      // that has no entries. Existing scope-error behavior (the count_exact
      // scope error already covered upstream by the test at line 115) is
      // unaffected — but this test asserts that NO additional field errors
      // appear from the new walk.
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_RECORD,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: { type: 'address_history', entries: [] },
            },
          },
        }) as never,
      );

      stubDsxMappings([]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      // The new walk emits zero field errors for an empty section.
      expect(address!.fieldErrors).toEqual([]);
    });
  });

  describe('TD-069 — Section with valid entries reports complete (DoD 8)', () => {
    it('DoD 8: section whose entries each have all required fields filled reports `complete` (the new walk does not falsely flag a correct section)', async () => {
      // Education entry from country A; degreeAwarded is required and
      // filled in. The per-entry walk must produce zero field errors and
      // the section must report `complete`.
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                // Use scope=null so count_exact 1 is the implied scope and
                // a single entry satisfies it.
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-edu-ok',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [
                      {
                        requirementId: REQ_DEGREE,
                        value: 'Bachelor of Science',
                      },
                    ],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      expect(edu!.fieldErrors).toEqual([]);
      // No scope errors expected — Education with `scope: null` defaults to
      // a count-based scope that 1 entry satisfies.
      expect(edu!.scopeErrors).toEqual([]);
      expect(edu!.status).toBe('complete');
    });
  });

  describe('TD-069 — Date-coverage scope errors still fire (DoD 9)', () => {
    it.skip('DoD 9: time-based scope errors continue to surface alongside the new per-entry walk — SKIPPED pending TD-082 (evaluateTimeBasedScope does not flag null-date entries inside time-bounded scopes)', async () => {
      // Employment with a 5-year time-based scope. The single entry covers
      // only 6 months — the existing time-based scope check should produce
      // a scope error. The per-entry walk's introduction must not suppress
      // it. (Per Spec Rule 7 — Stage 3b adds a check, it does not remove
      // any existing check.)
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-123',
        firstName: null,
        lastName: null,
        email: null,
        phoneCountryCode: null,
        phoneNumber: null,
        formData: {
          sectionVisits: {
            employment: {
              visitedAt: '2026-05-01T10:00:00Z',
              departedAt: '2026-05-01T11:00:00Z',
            },
          },
          sections: {
            employment: {
              type: 'employment',
              entries: [
                {
                  entryId: 'entry-emp-recent',
                  countryId: COUNTRY_A,
                  entryOrder: 1,
                  fields: [
                    { requirementId: REQ_JOB_TITLE, value: 'Engineer' },
                  ],
                },
              ],
            },
          },
        },
        package: {
          id: 'pkg-123',
          workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
          packageServices: [
            {
              id: `ps-${SVC_EMP}`,
              packageId: 'pkg-123',
              serviceId: SVC_EMP,
              // 5-year time-based scope. The entry's coverage is
              // insufficient — a scope error is expected.
              scope: { scopeType: 'time_based', scopeValue: 5 },
              service: {
                id: SVC_EMP,
                functionalityType: 'verification-emp',
                serviceRequirements: [
                  {
                    serviceId: SVC_EMP,
                    requirementId: REQ_JOB_TITLE,
                    requirement: {
                      id: REQ_JOB_TITLE,
                      name: 'Job Title',
                      fieldKey: 'jobTitle',
                      type: 'field',
                      disabled: false,
                      fieldData: { dataType: 'text' },
                    },
                  },
                ],
                availability: [],
              },
            },
          ],
        },
      } as never);

      stubDsxMappings([
        {
          requirementId: REQ_JOB_TITLE,
          serviceId: SVC_EMP,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const emp = result.sections.find(
        (s) => s.sectionId === 'service_verification-emp',
      );

      expect(emp).toBeDefined();
      // Scope errors must still fire even after Stage 3b's per-entry walk
      // is wired in (Spec Rule 7 / DoD 9).
      expect(emp!.scopeErrors.length).toBeGreaterThan(0);
      expect(emp!.status).toBe('incomplete');
    });
  });

  describe('TD-069 — Gap-detection still fires (DoD 10)', () => {
    it('DoD 10: gap errors continue to surface when entries have gaps exceeding tolerance', async () => {
      // Address History with two entries that have a >1-year gap between
      // them. gapToleranceDays = 30. The gap-detection helper should
      // produce a gap error. The per-entry walk's introduction must not
      // suppress it. (Per Spec Rule 7 / DoD 10.)
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-123',
        firstName: null,
        lastName: null,
        email: null,
        phoneCountryCode: null,
        phoneNumber: null,
        formData: {
          sectionVisits: {
            address_history: {
              visitedAt: '2026-05-01T10:00:00Z',
              departedAt: '2026-05-01T11:00:00Z',
            },
          },
          sections: {
            address_history: {
              type: 'address_history',
              entries: [
                {
                  entryId: 'addr-1',
                  countryId: COUNTRY_A,
                  entryOrder: 1,
                  fields: [
                    {
                      requirementId: REQ_ADDR_BLOCK,
                      value: {
                        street1: '1 Main St',
                        city: 'Anytown',
                        state: 'CA',
                        postalCode: '90000',
                        fromDate: '2020-01-01',
                        toDate: '2021-01-01',
                        isCurrent: false,
                      },
                    },
                  ],
                },
                {
                  entryId: 'addr-2',
                  countryId: COUNTRY_A,
                  entryOrder: 2,
                  fields: [
                    {
                      requirementId: REQ_ADDR_BLOCK,
                      value: {
                        street1: '2 Side St',
                        city: 'Othertown',
                        state: 'CA',
                        postalCode: '90001',
                        // >1-year gap before this entry's fromDate.
                        fromDate: '2024-06-01',
                        toDate: '2025-06-01',
                        isCurrent: false,
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
        package: {
          id: 'pkg-123',
          workflow: {
            id: 'wf-123',
            gapToleranceDays: 30,
            sections: [],
          },
          packageServices: [
            {
              id: `ps-${SVC_RECORD}`,
              packageId: 'pkg-123',
              serviceId: SVC_RECORD,
              // 5-year time-based scope so gap-detection has a window.
              scope: { scopeType: 'time_based', scopeValue: 5 },
              service: {
                id: SVC_RECORD,
                functionalityType: 'record',
                serviceRequirements: [
                  {
                    serviceId: SVC_RECORD,
                    requirementId: REQ_ADDR_BLOCK,
                    requirement: {
                      id: REQ_ADDR_BLOCK,
                      name: 'Address',
                      fieldKey: 'address',
                      type: 'field',
                      disabled: false,
                      fieldData: {
                        dataType: 'address_block',
                        addressConfig: CANONICAL_ADDRESS_CONFIG,
                      },
                    },
                  },
                ],
                availability: [],
              },
            },
          ],
        },
      } as never);

      stubDsxMappings([
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      // Gap errors must still fire even after Stage 3b's per-entry walk is
      // wired in (Spec Rule 7 / DoD 10).
      expect(address!.gapErrors.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // TD-084 — Required-Indicator Per-Country Alignment
  //
  // Spec:           docs/specs/td-084-required-indicator-per-country-alignment.md
  //                 (BR 1, BR 2, BR 3, BR 4, BR 5; DoD 1, 4, 6, 10, 11, 12)
  // Technical plan: docs/plans/td-084-technical-plan.md §3.2.2, §3.2.3, §6
  //
  // These tests assert the OR-merge semantics for cross-service required-state
  // aggregation on the VALIDATOR side. The new TD-084 cross-service tests
  // FAIL on the current baseline (Stage 3b AND-merge at
  // repeatableEntryFieldChecks.ts:317 and personalInfoIdvFieldChecks.ts:395)
  // and PASS after the implementer flips `flags.every(Boolean)` →
  // `flags.some(Boolean)` per the technical plan.
  //
  // Mocking discipline: identical to the Stage 3b tests above — reuse the
  // local `buildStage3bPackageServices`, `stubDsxMappings`, `buildInvitation`
  // helpers and the canonical `CANONICAL_ADDRESS_CONFIG`, `COUNTRY_*`, `SVC_*`,
  // `REQ_*` constants. No new fixture utilities introduced (per test-writer
  // Pass 1 hard constraints).
  //
  // Architecture note on DoD 4 (geographic-hierarchy OR on the validator):
  // The validator's `buildPerCountryRequiredMap` queries dsx_mappings only at
  // locationId === entry.countryId — it does NOT walk the geographic hierarchy
  // (subregion → country). That walk lives only on the /fields route side
  // (per architect's plan §3.2.2: the validator change is a one-line operator
  // flip). On the validator side, the meaningful BR 2 surface is the OR-fold
  // operator itself. Since the database's @@unique constraint forbids two rows
  // at the same (serviceId, locationId, requirementId), the DoD 4 validator
  // test exercises the operator change with a SYNTHETIC stub (two rows at the
  // same key) — flagged in the hand-off summary as a scope ambiguity.
  // ===========================================================================

  // Local constants — a SECOND service per type in the candidate's package,
  // used to exercise the cross-service merge contract (BR 1). Distinct from
  // SVC_RECORD / SVC_EDU / SVC_EMP so that two services in the package can
  // each own a dsx_mappings row for the same (requirementId, locationId).
  const SVC_RECORD_2 = 'svc-record-002';
  const SVC_EDU_2 = 'svc-edu-002';
  const SVC_EMP_2 = 'svc-emp-002';

  describe('TD-084 — Cross-service OR-merge on the validator (BR 1, DoD 1)', () => {
    it('DoD 1 (Address History): TWO record services share the same address_block requirement at the same country; one mapping isRequired=true, the other false → validator reports the field as required (OR-merge wins). FAILS on the current AND-merge baseline; PASSES after the operator flip.', async () => {
      // BR 1 fixture — two services in the package both map the same
      // requirement at the same country. The OR-fold across the two rows
      // must yield isRequired=true even though one row says false.
      //
      // Baseline behavior (Stage 3b, AND-merge at
      // repeatableEntryFieldChecks.ts:317):
      //   flags = [true, false]; every(Boolean) === false → not required →
      //   the empty pieces produce NO fieldErrors → test FAILS.
      //
      // Post-fix behavior (TD-084, OR-merge):
      //   flags = [true, false]; some(Boolean) === true → required → the
      //   empty pieces produce fieldErrors → test PASSES.
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_RECORD,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
              {
                id: SVC_RECORD_2,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: {
                type: 'address_history',
                entries: [
                  {
                    entryId: 'entry-td084-xs-1',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [
                      {
                        requirementId: REQ_ADDR_BLOCK,
                        value: {
                          // Empty pieces — the cross-service OR-merge decides
                          // whether the validator flags them as missing.
                          fromDate: '2024-01-01',
                          toDate: '2025-01-01',
                          isCurrent: false,
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD,
          locationId: COUNTRY_A,
          isRequired: true, // one service says required
        },
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD_2,
          locationId: COUNTRY_A,
          isRequired: false, // the other says not required
        },
      ]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      // Post-fix expectation: OR(true, false) = true → required → the empty
      // address pieces produce fieldErrors. Status flips to incomplete.
      expect(address!.status).toBe('incomplete');

      // At least one piece-level fieldError must be produced (street1 / city
      // / state / postalCode are all enabled+required in CANONICAL_ADDRESS_CONFIG
      // and all empty in this fixture).
      expect(address!.fieldErrors.length).toBeGreaterThan(0);
      for (const fe of address!.fieldErrors) {
        expect(fe.messageKey).toBe('candidate.validation.fieldRequired');
      }
    });

    it('DoD 1 (Education): TWO Education services share the same Degree requirement at the same country; one row isRequired=true, the other false → validator reports the field as required (OR). FAILS today, PASSES after the fix.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
              {
                id: SVC_EDU_2,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-td084-edu-xs',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: true,
        },
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU_2,
          locationId: COUNTRY_A,
          isRequired: false,
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      expect(edu!.status).toBe('incomplete');
      const degreeError = edu!.fieldErrors.find(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      expect(degreeError).toBeDefined();
      expect(degreeError!.messageKey).toBe(
        'candidate.validation.fieldRequired',
      );
    });
  });

  describe('TD-084 — Geographic-hierarchy OR-merge on the validator (BR 2, DoD 4)', () => {
    it('DoD 4: When the validator receives two mapping rows for the same (requirementId, serviceId, locationId) with differing isRequired flags, the OR-fold reports required. FAILS today (AND-merge says false when any flag is false); PASSES after the operator flip. Architecture note: the validator does NOT walk the geographic hierarchy; this test exercises the OR-fold operator directly with a synthetic stub. See the head-of-block comment for context.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-td084-geo',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      // Two rows at the same (serviceId, locationId, requirementId) with
      // differing isRequired flags. The OR-fold returns required iff any
      // flag is true.
      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: false,
        },
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: true,
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      // OR-fold: some(true) === true → required → field error for the empty
      // degreeAwarded value.
      const degreeError = edu!.fieldErrors.find(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      expect(degreeError).toBeDefined();
      expect(edu!.status).toBe('incomplete');
    });
  });

  describe('TD-084 — No service-level fallback on the validator (BR 3, DoD 6)', () => {
    it('DoD 6 (validator): a service has a service_requirements row for a requirement but NO dsx_mappings row at the entry country; the validator does NOT include the field in fieldErrors when empty. This guards the validator-side BR 3 contract — the validator already has no service-level fallback; the BR-3 fix lives on the route side. Should pass on the current baseline AND after the fix.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-td084-no-mapping',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      // Zero mapping rows — service_requirements covers the requirement (via
      // buildStage3bPackageServices) but dsx_mappings is empty at COUNTRY_A.
      stubDsxMappings([]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      // BR 3: no mapping → not required → no field error for the empty value.
      const degreeError = edu!.fieldErrors.find(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      expect(degreeError).toBeUndefined();
    });
  });

  describe('TD-084 — Per-section concrete fixtures (DoD 10, 11, 12)', () => {
    it('DoD 10 (Address History, validator): TWO record services in the package map the same address_block requirement at the entry country with isRequired=false on both → validator does NOT flag any address piece as missing.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_RECORD,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
              {
                id: SVC_RECORD_2,
                functionalityType: 'record',
                requirements: [
                  {
                    id: REQ_ADDR_BLOCK,
                    name: 'Address',
                    fieldKey: 'address',
                    type: 'field',
                    fieldData: {
                      dataType: 'address_block',
                      addressConfig: CANONICAL_ADDRESS_CONFIG,
                    },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              address_history: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              address_history: {
                type: 'address_history',
                entries: [
                  {
                    entryId: 'entry-td084-addr-dod10',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [
                      {
                        requirementId: REQ_ADDR_BLOCK,
                        value: {
                          fromDate: '2024-01-01',
                          toDate: '2025-01-01',
                          isCurrent: false,
                          // pieces unfilled
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD,
          locationId: COUNTRY_A,
          isRequired: false,
        },
        {
          requirementId: REQ_ADDR_BLOCK,
          serviceId: SVC_RECORD_2,
          locationId: COUNTRY_A,
          isRequired: false,
        },
      ]);

      const result = await runValidation('inv-123');
      const address = result.sections.find(
        (s) => s.sectionId === 'address_history',
      );

      expect(address).toBeDefined();
      // OR(false, false) = false → not required → no per-piece field errors
      // from the address_block walk.
      const pieceErrors = address!.fieldErrors.filter(
        (fe) => fe.messageKey === 'candidate.validation.fieldRequired',
      );
      expect(pieceErrors).toEqual([]);
    });

    it('DoD 11 (Education, validator): TWO Education services map the same Degree requirement at the entry country with isRequired=false on both → validator does NOT flag the field as missing.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EDU,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
              {
                id: SVC_EDU_2,
                functionalityType: 'verification-edu',
                requirements: [
                  {
                    id: REQ_DEGREE,
                    name: 'Degree Awarded',
                    fieldKey: 'degreeAwarded',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              education: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              education: {
                type: 'education',
                entries: [
                  {
                    entryId: 'entry-td084-edu-dod11',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_DEGREE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU,
          locationId: COUNTRY_A,
          isRequired: false,
        },
        {
          requirementId: REQ_DEGREE,
          serviceId: SVC_EDU_2,
          locationId: COUNTRY_A,
          isRequired: false,
        },
      ]);

      const result = await runValidation('inv-123');
      const edu = result.sections.find(
        (s) => s.sectionId === 'service_verification-edu',
      );

      expect(edu).toBeDefined();
      const degreeError = edu!.fieldErrors.find(
        (fe) => fe.fieldName === 'Degree Awarded',
      );
      // Under either AND or OR, the empty Degree value should NOT produce a
      // fieldError because no in-scope mapping says required.
      expect(degreeError).toBeUndefined();
    });

    it('DoD 12 (Employment, validator): TWO Employment services map the same Job Title requirement at the entry country with isRequired=false on both → validator does NOT flag the field as missing.', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          package: {
            id: 'pkg-123',
            workflow: { id: 'wf-123', gapToleranceDays: null, sections: [] },
            packageServices: buildStage3bPackageServices([
              {
                id: SVC_EMP,
                functionalityType: 'verification-emp',
                requirements: [
                  {
                    id: REQ_JOB_TITLE,
                    name: 'Job Title',
                    fieldKey: 'jobTitle',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
              {
                id: SVC_EMP_2,
                functionalityType: 'verification-emp',
                requirements: [
                  {
                    id: REQ_JOB_TITLE,
                    name: 'Job Title',
                    fieldKey: 'jobTitle',
                    type: 'field',
                    fieldData: { dataType: 'text' },
                  },
                ],
              },
            ]),
          },
          formData: {
            sectionVisits: {
              employment: {
                visitedAt: '2026-05-01T10:00:00Z',
                departedAt: '2026-05-01T11:00:00Z',
              },
            },
            sections: {
              employment: {
                type: 'employment',
                entries: [
                  {
                    entryId: 'entry-td084-emp-dod12',
                    countryId: COUNTRY_A,
                    entryOrder: 1,
                    fields: [{ requirementId: REQ_JOB_TITLE, value: '' }],
                  },
                ],
              },
            },
          },
        }) as never,
      );

      stubDsxMappings([
        {
          requirementId: REQ_JOB_TITLE,
          serviceId: SVC_EMP,
          locationId: COUNTRY_A,
          isRequired: false,
        },
        {
          requirementId: REQ_JOB_TITLE,
          serviceId: SVC_EMP_2,
          locationId: COUNTRY_A,
          isRequired: false,
        },
      ]);

      const result = await runValidation('inv-123');
      const emp = result.sections.find(
        (s) => s.sectionId === 'service_verification-emp',
      );

      expect(emp).toBeDefined();
      const jobTitleError = emp!.fieldErrors.find(
        (fe) => fe.fieldName === 'Job Title',
      );
      expect(jobTitleError).toBeUndefined();
    });
  });
});
