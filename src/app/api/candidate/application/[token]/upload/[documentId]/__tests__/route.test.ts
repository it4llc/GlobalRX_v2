// /GlobalRX_v2/src/app/api/candidate/application/[token]/upload/[documentId]/__tests__/route.test.ts
//
// Phase 6 Stage 4 — Pass 2 API route tests for the candidate document delete
// endpoint DELETE /api/candidate/application/[token]/upload/[documentId].
//
// Coverage:
//   - BR 12: token validation; ownership check before deletion.
//   - BR 13: candidate can remove an uploaded document; returns
//            { deleted: true } on success.
//   - DoD 7: token + ownership + disk removal + 404-on-cross-order semantics.
//
// Mocks (per the Pass 2 mock reference table):
//   - @/lib/services/candidateSession.service (CandidateSessionService.getSession)
//   - @/lib/prisma  (global mock; per-test mockResolvedValueOnce for the
//                    invitation row + formData)
//   - fs            (existsSync + unlinkSync)
//   - path          (posix.join, join — inline implementations)
//   - @/lib/services/document-download.service (validateFilePath — inline impl
//                    that mirrors the real helper's contract)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import { DELETE } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

vi.mock('fs', () => {
  const existsSyncFn = vi.fn();
  const unlinkSyncFn = vi.fn();
  return {
    default: { existsSync: existsSyncFn, unlinkSync: unlinkSyncFn },
    existsSync: existsSyncFn,
    unlinkSync: unlinkSyncFn,
  };
});

vi.mock('path', () => {
  const join = vi.fn((...args: string[]) => args.filter(Boolean).join('/'));
  return {
    default: {
      join,
      posix: { join },
    },
    join,
    posix: { join },
  };
});

// validateFilePath: the real helper rejects paths with `..` or absolute paths.
// The mock is an inline implementation that READS the path argument and
// applies the same rules. Per Mocking Rule M3 this is NOT a scripted return
// value — the route's behavior depends on what the helper sees.
vi.mock('@/lib/services/document-download.service', () => ({
  validateFilePath: vi.fn((filePath: string) => {
    if (!filePath) return false;
    if (filePath.includes('..')) return false;
    if (filePath.startsWith('/')) return false;
    return true;
  }),
}));

const TOKEN = 'tok-stage4-delete-abc';
const ORDER_ID = 'order-7777';
const DOC_ID = '22222222-2222-4222-8222-222222222222';
const FUTURE_EXPIRY = new Date(Date.now() + 24 * 60 * 60 * 1000);

// Build a CandidateInvitation row whose formData carries one document at the
// given storagePath inside the section's aggregatedFields bucket. The route's
// findMetadataByDocumentId helper crawls every per-entry and aggregated bucket
// looking for documentId matches; we exercise both shapes across tests.
function invitationWithAggregatedDoc(
  documentId: string,
  storagePath: string,
): unknown {
  return {
    id: 'inv-1',
    orderId: ORDER_ID,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: FUTURE_EXPIRY,
    formData: {
      sections: {
        education_history: {
          aggregatedFields: {
            'req-1::svc-1::jur-1': {
              documentId,
              originalName: 'a.pdf',
              storagePath,
              mimeType: 'application/pdf',
              size: 100,
              uploadedAt: '2026-05-04T12:00:00.000Z',
            },
          },
        },
      },
    },
  };
}

function invitationWithPerEntryDoc(
  documentId: string,
  storagePath: string,
): unknown {
  return {
    id: 'inv-1',
    orderId: ORDER_ID,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: FUTURE_EXPIRY,
    formData: {
      sections: {
        education_history: {
          entries: [
            {
              entryId: 'e1',
              entryOrder: 0,
              countryId: 'US',
              fields: [
                {
                  requirementId: 'req-doc-1',
                  value: {
                    documentId,
                    originalName: 'cert.pdf',
                    storagePath,
                    mimeType: 'application/pdf',
                    size: 100,
                    uploadedAt: '2026-05-04T12:00:00.000Z',
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest(
    `http://localhost/api/candidate/application/${TOKEN}/upload/${DOC_ID}`,
    { method: 'DELETE' },
  );
}

async function callDelete(token: string, documentId: string) {
  return DELETE(makeRequest(), {
    params: Promise.resolve({ token, documentId }),
  });
}

describe('DELETE /api/candidate/application/[token]/upload/[documentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
  });

  describe('authentication (BR 12)', () => {
    it('returns 401 when no session exists', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('returns 403 when the session token does not match the URL token', async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'a-different-token',
        invitationId: 'inv-1',
      });

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Forbidden' });
    });
  });

  describe('input validation', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('returns 400 when documentId is not a UUID', async () => {
      const response = await callDelete(TOKEN, 'not-a-uuid');
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid documentId' });
    });
  });

  describe('invitation lookup', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('returns 404 when no invitation matches the token', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Invitation not found' });
    });

    it('returns 410 when the invitation is expired', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-1',
        orderId: ORDER_ID,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() - 1000),
        formData: { sections: {} },
      } as never);

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ error: 'Invitation expired' });
    });

    it('returns 410 when the invitation is already completed', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-1',
        orderId: ORDER_ID,
        status: INVITATION_STATUSES.COMPLETED,
        expiresAt: FUTURE_EXPIRY,
        formData: { sections: {} },
      } as never);

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({
        error: 'Invitation already completed',
      });
    });

    it('returns 404 when no formData record matches the documentId', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        id: 'inv-1',
        orderId: ORDER_ID,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: FUTURE_EXPIRY,
        formData: { sections: {} },
      } as never);

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Document not found' });
    });
  });

  describe('ownership check (BR 12)', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('returns 404 (not 403) when the storagePath belongs to a different order — info-leak protection', async () => {
      const otherOrderId = 'order-not-mine';
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithAggregatedDoc(
          DOC_ID,
          `uploads/draft-documents/${otherOrderId}/123-foreign.pdf`,
        ) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);

      // BR 12 information-leak protection: the route returns 404 rather than
      // 403 so a candidate cannot probe for documentIds belonging to other
      // orders.
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Document not found' });
      // The file must NOT have been removed.
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('returns 404 when the storagePath fails validateFilePath (e.g., contains ..)', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithAggregatedDoc(
          DOC_ID,
          `uploads/draft-documents/${ORDER_ID}/../escape.pdf`,
        ) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(404);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('successful delete (BR 13)', () => {
    beforeEach(async () => {
      const { CandidateSessionService } = await import(
        '@/lib/services/candidateSession.service'
      );
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: TOKEN,
        invitationId: 'inv-1',
      });
    });

    it('removes the file and returns { deleted: true } when the metadata is in the aggregated bucket', async () => {
      const goodPath = `uploads/draft-documents/${ORDER_ID}/123-cert.pdf`;
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithAggregatedDoc(DOC_ID, goodPath) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
      // The route resolves the path off process.cwd() — assert the joined
      // absolute path includes the expected relative storagePath.
      const unlinkArg = String(vi.mocked(fs.unlinkSync).mock.calls[0][0]);
      expect(unlinkArg).toContain(goodPath);
    });

    it('removes the file and returns { deleted: true } when the metadata is in a per-entry field', async () => {
      const goodPath = `uploads/draft-documents/${ORDER_ID}/456-degree.pdf`;
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithPerEntryDoc(DOC_ID, goodPath) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
      expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('treats a missing on-disk file as success (no unlink, but { deleted: true })', async () => {
      // Real-world retry case — the file was already removed by a previous
      // attempt. The route checks fs.existsSync before unlink and returns
      // success in either case so the candidate's UI stays in sync.
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const goodPath = `uploads/draft-documents/${ORDER_ID}/x.pdf`;
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithAggregatedDoc(DOC_ID, goodPath) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ deleted: true });
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('returns 500 when fs.unlinkSync throws', async () => {
      vi.mocked(fs.unlinkSync).mockImplementationOnce(() => {
        throw new Error('permission denied');
      });

      const goodPath = `uploads/draft-documents/${ORDER_ID}/x.pdf`;
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithAggregatedDoc(DOC_ID, goodPath) as never,
      );

      const response = await callDelete(TOKEN, DOC_ID);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: 'Failed to delete document',
      });
    });
  });
});
