// /GlobalRX_v2/src/app/api/candidate/application/[token]/validate/__tests__/route.test.ts
//
// Phase 7 Stage 1 — Pass 2 API route tests for POST /api/candidate/application/[token]/validate.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 35; DoD 26, 27)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Mocking discipline:
//   - The route delegates to runValidation. Per Mocking Rule M3 we use an
//     INLINE implementation that reads the invitationId argument and returns
//     a deterministic shape derived from it (not a scripted mockReturnValue).
//   - Prisma is the global mock from src/test/setup.ts.
//   - CandidateSessionService and logger are mocked using the same patterns
//     as existing route tests (saved-data/route.test.ts, structure/route.test.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import type { FullValidationResult } from '@/lib/candidate/validation/types';

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

// validationEngine.runValidation — INLINE implementation (Rule M3 compliant).
// The mock derives its output from the invitationId argument, so a route that
// passes the wrong invitationId would produce an asserted-against payload
// that doesn't match expectations. Mocking the engine is appropriate here
// because the engine has its own dedicated test file
// (src/lib/candidate/validation/__tests__/validationEngine.test.ts).
vi.mock('@/lib/candidate/validation/validationEngine', () => ({
  runValidation: vi.fn(async (invitationId: string): Promise<FullValidationResult> => ({
    sections: [
      {
        sectionId: `section-of-${invitationId}`,
        status: 'complete',
        fieldErrors: [],
        scopeErrors: [],
        gapErrors: [],
        documentErrors: [],
      },
    ],
    summary: {
      sections: [
        {
          sectionId: `section-of-${invitationId}`,
          sectionName: `section-of-${invitationId}`,
          status: 'complete',
          errors: [],
        },
      ],
      allComplete: true,
      totalErrors: 0,
    },
  })),
}));

describe('POST /api/candidate/application/[token]/validate', () => {
  const mockToken = 'test-token-123';

  // Minimal invitation row — only the fields the route reads to perform
  // auth and state checks.
  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('returns 401 when no candidate session exists', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 when the session token does not match the URL token', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'different-token',
        invitationId: 'inv-456',
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('invitation state', () => {
    it('returns 404 when the invitation is not found', async () => {
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
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('returns 410 when the invitation is expired', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation expired');
    });

    it('returns 410 when the invitation is already completed', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        status: INVITATION_STATUSES.COMPLETED,
      } as never);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  describe('success — Rule 35 / DoD 26 (always recompute)', () => {
    it('returns 200 with the FullValidationResult shape', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        mockInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Top-level shape per spec line 220-234.
      expect(data).toHaveProperty('sections');
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('sections');
      expect(data.summary).toHaveProperty('allComplete');
      expect(data.summary).toHaveProperty('totalErrors');
    });

    it('passes the invitation id to runValidation, not the token', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        mockInvitation as never,
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      const data = await response.json();
      // The mock derives its output from invitationId. If the route passed
      // the token instead of inv.id, this would be `section-of-${mockToken}`
      // instead of `section-of-inv-123`, so this assertion proves the route
      // is forwarding the right argument.
      expect(data.sections[0].sectionId).toBe('section-of-inv-123');
    });

    it('calls runValidation on every request (no caching — Rule 35)', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { runValidation } = await import(
        '@/lib/candidate/validation/validationEngine'
      );

      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(
        mockInvitation as never,
      );

      // Three consecutive calls.
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/validate`,
          { method: 'POST' },
        );
        await POST(request, {
          params: Promise.resolve({ token: mockToken }),
        });
      }

      // Three runValidation invocations — no caching.
      expect(runValidation).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('returns 500 when the validation engine throws', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { runValidation } = await import(
        '@/lib/candidate/validation/validationEngine'
      );

      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        mockInvitation as never,
      );
      vi.mocked(runValidation).mockRejectedValueOnce(
        new Error('engine failure'),
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('returns 500 when the database lookup throws', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValueOnce(
        new Error('database failure'),
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/validate`,
        { method: 'POST' },
      );
      const response = await POST(request, {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
