// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/visit-tracking.test.ts
//
// Phase 7 Stage 1 — Pass 2 API route tests for the new section_visit_tracking
// branch added to POST /api/candidate/application/[token]/save.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 1, 2, 3; DoD 1, 2)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §3.2
//
// Mocking discipline:
//   - The route handler under test is NOT mocked (Rule M1).
//   - Prisma is the global mock from src/test/setup.ts; we stub findUnique
//     and capture .update arguments to assert on the merged formData.
//   - The pure sectionVisitTracking helpers are NOT mocked — the route
//     delegates merge logic to them and the test asserts on the merged
//     output (Rule M2).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
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

describe('POST /api/candidate/application/[token]/save — section_visit_tracking', () => {
  const mockToken = 'test-token-123';

  const baseInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: { sections: {} },
    lastAccessedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication and validation', () => {
    it('returns 401 when no session exists', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({ sectionType: 'section_visit_tracking' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });
      expect(response.status).toBe(401);
    });

    it('returns 403 when token does not match session', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'different-token',
        invitationId: 'inv-123',
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({ sectionType: 'section_visit_tracking' }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });
      expect(response.status).toBe(403);
    });

    it('returns 400 when sectionVisits has invalid datetime', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: 'not-a-datetime',
                departedAt: null,
              },
            ],
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('returns 404 when invitation not found', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        null,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-06T10:00:00Z',
                departedAt: null,
              },
            ],
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(404);
    });

    it('returns 410 when invitation expired', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...baseInvitation,
        expiresAt: new Date(Date.now() - 1000),
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-06T10:00:00Z',
                departedAt: null,
              },
            ],
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(410);
    });
  });

  describe('first visit — Rule 1', () => {
    it('writes a new sectionVisits entry to formData and returns 200', async () => {
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
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-06T10:00:00Z',
                departedAt: null,
              },
            ],
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);

      // Inspect the formData written to the database.
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { sectionVisits?: Record<string, unknown>; reviewPageVisitedAt?: string | null };

      expect(writtenFormData.sectionVisits).toEqual({
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      });
      // reviewPageVisitedAt defaults to null when not in the request and
      // not previously set.
      expect(writtenFormData.reviewPageVisitedAt).toBeNull();
    });
  });

  describe('merge semantics — Rule 2 (departedAt one-way)', () => {
    it('preserves the existing visitedAt when a later update arrives for the same section', async () => {
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
          sectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: null,
            },
          },
        },
      } as never);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-07T10:00:00Z', // Newer — should be ignored
                departedAt: '2026-05-07T10:30:00Z',
              },
            ],
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { sectionVisits: Record<string, { visitedAt: string; departedAt: string | null }> };

      // Original visitedAt preserved.
      expect(writtenFormData.sectionVisits.personal_info.visitedAt).toBe(
        '2026-05-06T10:00:00Z',
      );
      // Departed timestamp accepted.
      expect(writtenFormData.sectionVisits.personal_info.departedAt).toBe(
        '2026-05-07T10:30:00Z',
      );
    });

    it('does NOT clear an existing departedAt back to null (Rule 2 one-way)', async () => {
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
          sectionVisits: {
            personal_info: {
              visitedAt: '2026-05-06T10:00:00Z',
              departedAt: '2026-05-06T10:30:00Z',
            },
          },
        },
      } as never);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-06T10:00:00Z',
                departedAt: null,
              },
            ],
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { sectionVisits: Record<string, { departedAt: string | null }> };

      // Existing departedAt preserved despite the incoming null.
      expect(writtenFormData.sectionVisits.personal_info.departedAt).toBe(
        '2026-05-06T10:30:00Z',
      );
    });
  });

  describe('reviewPageVisitedAt — Rule 3 (one-way flag)', () => {
    it('writes reviewPageVisitedAt when none was previously set', async () => {
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
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            reviewPageVisitedAt: '2026-05-06T12:00:00Z',
          }),
        },
      );

      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { reviewPageVisitedAt: string | null };
      expect(writtenFormData.reviewPageVisitedAt).toBe('2026-05-06T12:00:00Z');
    });

    it('preserves the EXISTING reviewPageVisitedAt when a later one arrives (Rule 3 — never reset)', async () => {
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
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            reviewPageVisitedAt: '2026-05-08T15:00:00Z', // Later — should be ignored
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { reviewPageVisitedAt: string };
      expect(writtenFormData.reviewPageVisitedAt).toBe('2026-05-06T12:00:00Z');
    });

    it('preserves the existing reviewPageVisitedAt when an explicit null is sent (Rule 3 — never clears)', async () => {
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
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            reviewPageVisitedAt: null,
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { reviewPageVisitedAt: string };
      expect(writtenFormData.reviewPageVisitedAt).toBe('2026-05-06T12:00:00Z');
    });
  });

  describe('does not clobber existing form sections', () => {
    it('preserves formData.sections when only writing visit tracking', async () => {
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
              fields: [{ requirementId: 'req-1', value: 'John', savedAt: '2026-05-06T10:00:00Z' }],
            },
          },
        },
      } as never);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(
        baseInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            sectionVisits: [
              {
                sectionId: 'personal_info',
                visitedAt: '2026-05-06T10:00:00Z',
                departedAt: '2026-05-06T10:30:00Z',
              },
            ],
          }),
        },
      );

      await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock
        .calls[0];
      const writtenFormData = (updateCall[0].data as { formData: unknown })
        .formData as { sections: Record<string, { fields: Array<{ value: unknown }> }> };

      // Existing personal_info section data preserved.
      expect(writtenFormData.sections.personal_info.fields[0].value).toBe(
        'John',
      );
    });
  });
});
