// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/visit-tracking.test.ts
//
// Phase 7 Stage 1 — Pass 2 API route tests for the new visit tracking +
// reviewPageVisitedAt fields surfaced by GET /api/candidate/application/[token]/saved-data.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 1, 2, 3; DoD 1, 2)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §3.2
//
// Mocking discipline:
//   - The route handler under test is NOT mocked (Rule M1).
//   - Prisma is the global mock from src/test/setup.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// Logger
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Candidate session
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

describe('GET /api/candidate/application/[token]/saved-data — visit tracking surface', () => {
  const mockToken = 'test-token-123';

  const baseInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: { sections: {} },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default values when nothing is saved', () => {
    it('returns sectionVisits as an empty object when not present in formData', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sectionVisits).toEqual({});
    });

    it('returns reviewPageVisitedAt as null when not present in formData', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const data = await response.json();
      expect(data.reviewPageVisitedAt).toBeNull();
    });
  });

  describe('persists across browser close — DoD 1, 2', () => {
    it('returns the saved sectionVisits exactly as stored', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      const savedVisits = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
        address_history: {
          visitedAt: '2026-05-06T11:00:00Z',
          departedAt: null,
        },
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...baseInvitation,
        formData: {
          sections: {},
          sectionVisits: savedVisits,
        },
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const data = await response.json();
      expect(data.sectionVisits).toEqual(savedVisits);
    });

    it('returns the saved reviewPageVisitedAt exactly as stored', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...baseInvitation,
        formData: {
          sections: {},
          reviewPageVisitedAt: '2026-05-06T12:00:00Z',
        },
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const data = await response.json();
      expect(data.reviewPageVisitedAt).toBe('2026-05-06T12:00:00Z');
    });
  });

  describe('co-existence with sections data', () => {
    it('returns sections, sectionVisits, AND reviewPageVisitedAt at top level', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...baseInvitation,
        formData: {
          sections: {
            personal_info: {
              type: 'personal_info',
              fields: [
                { requirementId: 'req-1', value: 'John', savedAt: '2026-05-06T10:00:00Z' },
              ],
            },
          },
          sectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: '2026-05-06T10:30:00Z',
            },
          },
          reviewPageVisitedAt: '2026-05-06T12:00:00Z',
        },
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`,
      );
      const response = await GET(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const data = await response.json();

      // All three top-level keys present.
      expect(data.sections).toBeDefined();
      expect(data.sectionVisits).toBeDefined();
      expect(data.reviewPageVisitedAt).toBeDefined();

      // Section data preserved.
      expect(data.sections.personal_info.fields).toEqual([
        { requirementId: 'req-1', value: 'John' },
      ]);
      // Visit tracking preserved.
      expect(data.sectionVisits.personal_info.departedAt).toBe(
        '2026-05-06T10:30:00Z',
      );
      // Review-page flag preserved.
      expect(data.reviewPageVisitedAt).toBe('2026-05-06T12:00:00Z');
    });
  });
});
