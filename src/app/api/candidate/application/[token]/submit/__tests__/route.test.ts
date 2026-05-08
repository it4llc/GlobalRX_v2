// /GlobalRX_v2/src/app/api/candidate/application/[token]/submit/__tests__/route.test.ts
//
// Phase 7 Stage 2 — Pass 2 API route tests for
// POST /api/candidate/application/[token]/submit.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §11
//
// Coverage (mapped from the prompt):
//   - Auth: 401 unauthenticated, 403 forbidden token mismatch
//   - Expired invitation (403, expired-response shape)
//   - Already-submitted idempotency (200, success-response shape)
//   - Draft-only guard (200, idempotent)
//   - Validation failure rejection (400, validation-failure shape)
//   - Successful submission (200)
//   - Transaction rollback / error (500)
//   - AlreadySubmittedError thrown from inside the transaction → 200 idempotent
//
// Mocking discipline:
//   - Rule M1: We do NOT mock the route handler under test (POST).
//   - Rule M2: N/A (no rendered children).
//   - Rule M3:
//       - CandidateSessionService.getSession is mocked as module-level state.
//       - runValidation is mocked with an INLINE implementation that reads
//         the invitationId argument (matches the validate/route.test.ts pattern).
//       - submitApplication is mocked with an INLINE implementation that
//         records the (invitationId, today) arguments. AlreadySubmittedError
//         is re-exported as the REAL class so `instanceof` works in the
//         route's catch block.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import type { FullValidationResult } from '@/lib/candidate/validation/types';

// ---------------------------------------------------------------------------
// Mock the candidate session service. Module-level state — not a function the
// route calls with meaningful caller-supplied arguments (Rule M3 footnote).
// ---------------------------------------------------------------------------

vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock the validation engine. INLINE implementation that reads the
// invitationId argument (Rule M3 compliant). Per-test overrides allowed via
// vi.mocked(...).mockResolvedValueOnce for tests that need a different
// validationResult.
// ---------------------------------------------------------------------------

vi.mock('@/lib/candidate/validation/validationEngine', () => ({
  runValidation: vi.fn(
    async (invitationId: string): Promise<FullValidationResult> => ({
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
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Mock the submission orchestrator. INLINE implementation captures the args
// and resolves to a deterministic shape so the test can assert the route
// delegated correctly. AlreadySubmittedError is the REAL class — we import
// the actual module first and re-export the constructor so `instanceof`
// inside the route's catch block continues to work.
// ---------------------------------------------------------------------------

vi.mock('@/lib/candidate/submission/submitApplication', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/candidate/submission/submitApplication')
  >('@/lib/candidate/submission/submitApplication');
  return {
    ...actual,
    submitApplication: vi.fn(
      async (_tx: unknown, invitationId: string, today: Date) => ({
        orderId: `order-of-${invitationId}`,
        orderItemIds: [`oi-of-${invitationId}-1`],
        orderDataRowCount: 1,
        // The today value isn't part of the result type — referenced for
        // capture only via the recorded call args.
        _today: today,
      }),
    ),
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockToken = 'tok-123';

interface InvitationFixtureOpts {
  status?: string;
  expiresInMs?: number;
  orderStatus?: string;
}

function buildInvitation(opts: InvitationFixtureOpts = {}) {
  return {
    id: 'inv-123',
    token: mockToken,
    status: opts.status ?? INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + (opts.expiresInMs ?? 24 * 60 * 60 * 1000)),
    order: {
      id: 'order-123',
      statusCode: opts.orderStatus ?? 'draft',
    },
  };
}

function buildPostRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/candidate/application/${mockToken}/submit`,
    { method: 'POST' },
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('POST /api/candidate/application/[token]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe('authentication', () => {
    it('returns 401 when no candidate session exists', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const response = await POST(buildPostRequest(), {
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

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  // -------------------------------------------------------------------------
  // Invitation lookup / not found
  // -------------------------------------------------------------------------

  describe('invitation lookup', () => {
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

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });
  });

  // -------------------------------------------------------------------------
  // Expired guard — Spec Rule 19 / DoD 22
  // -------------------------------------------------------------------------

  describe('expired invitation', () => {
    it('returns 403 with the expired-response shape when expiresAt is in the past', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ expiresInMs: -1000 }) as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'This invitation has expired',
      });
    });
  });

  // -------------------------------------------------------------------------
  // Already-submitted idempotency — Spec Rule 18 / DoD 21
  // -------------------------------------------------------------------------

  describe('already-submitted idempotency', () => {
    it('returns 200 with the already-submitted body when the invitation is already completed', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ status: INVITATION_STATUSES.COMPLETED }) as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Application has already been submitted',
        redirectTo: `/candidate/${mockToken}/portal/submitted`,
      });
    });

    it('does NOT call submitApplication when the invitation is already completed', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { submitApplication } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ status: INVITATION_STATUSES.COMPLETED }) as never,
      );

      await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(submitApplication).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Draft-only guard — Spec Rule 20 / DoD 23
  // -------------------------------------------------------------------------

  describe('draft-only guard', () => {
    it('returns 200 idempotent when the order is already in submitted status', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { submitApplication } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({
          status: INVITATION_STATUSES.ACCESSED,
          orderStatus: 'submitted',
        }) as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Application has already been submitted',
        redirectTo: `/candidate/${mockToken}/portal/submitted`,
      });
      expect(submitApplication).not.toHaveBeenCalled();
    });

    it('returns 200 idempotent when the order is in any non-draft status', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation({ orderStatus: 'processing' }) as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Validation failure — Spec Rule 2 / DoD 4
  // -------------------------------------------------------------------------

  describe('validation failure', () => {
    it('returns 400 with the validation-failure response shape when runValidation reports allComplete=false', async () => {
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
        buildInvitation() as never,
      );

      // Override the inline mock for this single test to report incomplete.
      const failureResult: FullValidationResult = {
        sections: [
          {
            sectionId: 'address_history',
            status: 'incomplete',
            fieldErrors: [],
            scopeErrors: [
              {
                messageKey: 'candidate.validation.scope.countSpecific',
                placeholders: { required: 2, actual: 1 },
              },
            ],
            gapErrors: [],
            documentErrors: [],
          },
        ],
        summary: {
          sections: [
            {
              sectionId: 'address_history',
              sectionName: 'Address History',
              status: 'incomplete',
              errors: [],
            },
          ],
          allComplete: false,
          totalErrors: 1,
        },
      };
      vi.mocked(runValidation).mockResolvedValueOnce(failureResult);

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Validation failed');
      expect(data.validationResult).toEqual(failureResult);
    });

    it('does NOT call submitApplication when validation fails', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { runValidation } = await import(
        '@/lib/candidate/validation/validationEngine'
      );
      const { submitApplication } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );
      vi.mocked(runValidation).mockResolvedValueOnce({
        sections: [],
        summary: { sections: [], allComplete: false, totalErrors: 0 },
      });

      await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(submitApplication).not.toHaveBeenCalled();
    });

    it('passes the invitation.id (not the token) to runValidation', async () => {
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
        buildInvitation() as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });
      // Successful response — we just want to confirm runValidation got
      // called with the right argument.
      expect(response.status).toBe(200);
      expect(runValidation).toHaveBeenCalledWith('inv-123');
    });
  });

  // -------------------------------------------------------------------------
  // Successful submission — Spec Rule 17 / DoD 19
  // -------------------------------------------------------------------------

  describe('successful submission', () => {
    it('returns 200 with the success-response shape when validation passes and submitApplication resolves', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Application submitted successfully',
        redirectTo: `/candidate/${mockToken}/portal/submitted`,
      });
    });

    it('invokes submitApplication with the invitation id and a Date for today', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { submitApplication } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );

      await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(submitApplication).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(submitApplication).mock.calls[0];
      // The route opens a transaction and passes (tx, invitationId, today).
      // The global $transaction mock forwards prisma as `tx`.
      expect(callArgs[1]).toBe('inv-123');
      expect(callArgs[2]).toBeInstanceOf(Date);
    });

    it('builds redirectTo with the URL-encoded token', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const oddToken = 'token with spaces & symbols/';
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: oddToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-123',
        token: oddToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 60_000),
        order: { id: 'order-123', statusCode: 'draft' },
      } as never);

      const response = await POST(
        new NextRequest(
          `http://localhost/api/candidate/application/${encodeURIComponent(oddToken)}/submit`,
          { method: 'POST' },
        ),
        { params: Promise.resolve({ token: oddToken }) },
      );

      const data = await response.json();
      expect(data.redirectTo).toBe(
        `/candidate/${encodeURIComponent(oddToken)}/portal/submitted`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Transaction errors / rollback path
  // -------------------------------------------------------------------------

  describe('transaction errors', () => {
    it('returns 200 idempotent when submitApplication throws AlreadySubmittedError mid-transaction', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { submitApplication, AlreadySubmittedError } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );
      vi.mocked(submitApplication).mockRejectedValueOnce(
        new AlreadySubmittedError(),
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Application has already been submitted',
        redirectTo: `/candidate/${mockToken}/portal/submitted`,
      });
    });

    it('returns 500 when submitApplication throws a non-AlreadySubmittedError', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      const { submitApplication } = await import(
        '@/lib/candidate/submission/submitApplication'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        buildInvitation() as never,
      );
      vi.mocked(submitApplication).mockRejectedValueOnce(
        new Error('database failure'),
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });

    it('returns 500 when the initial findUnique throws', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
      });
      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValueOnce(
        new Error('database connection failed'),
      );

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('returns 500 when runValidation throws', async () => {
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
        buildInvitation() as never,
      );
      vi.mocked(runValidation).mockRejectedValueOnce(new Error('engine failure'));

      const response = await POST(buildPostRequest(), {
        params: Promise.resolve({ token: mockToken }),
      });

      expect(response.status).toBe(500);
    });
  });
});
