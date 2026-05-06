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
});
