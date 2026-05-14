// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/record-search.test.ts
// Pass 2 tests for Task 8.4: Save API extensions for record_search.
//
// Source files reviewed:
//   - src/app/api/candidate/application/[token]/save/route.ts
//     (POST handler dispatches sectionType === 'record_search' to
//     handleRecordSearchSave at line 310)
//   - src/app/api/candidate/application/[token]/save/recordSearchSave.ts
//     (the real handler — NOT mocked. The test exercises the full dispatch.)
//
// Per Rule M1, the POST export (subject of the test) is not mocked. The
// recordSearchSave helper is also not mocked — it is the code under test that
// the dispatch invokes. Prisma is mocked globally via src/test/setup.ts and
// per-test vi.mocked().mockResolvedValueOnce() returns are set up below.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// Mock logger (silence info/error noise during tests).
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock CandidateSessionService — session shape is module-level state injected
// per test. (Per Rule M3, this is not a utility function called with
// meaningful args; it's a session loader and is allowed to use
// mockResolvedValueOnce.)
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

describe('POST /api/candidate/application/[token]/save - Record Search (Task 8.4)', () => {
  const mockToken = 'token-record-search';

  const mockInvitation = {
    id: 'inv-rs-001',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: { sections: {} },
    lastAccessedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Authentication and authorization
  // ---------------------------------------------------------------------------
  describe('authentication and authorization', () => {
    it('returns 401 when no candidate session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(401);
    });

    it('returns 403 when the session token does not match the URL token', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'different-token',
        invitationId: 'inv-rs-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000),
      });

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------------------
  // Body validation
  // ---------------------------------------------------------------------------
  describe('body validation', () => {
    const makeSession = async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-rs-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000),
      });
    };

    it('returns 400 when fieldValues is missing', async () => {
      await makeSession();

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        // fieldValues omitted
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('returns 400 when sectionId is an empty string', async () => {
      await makeSession();

      const body = {
        sectionType: 'record_search',
        sectionId: '',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
    });

    it('returns 400 when a fieldValue contains a deeply nested object', async () => {
      // The plan §6.1 union allows only one level of records (primitive
      // values inside the inner record). A 2-level nested object must be
      // rejected.
      await makeSession();

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'req-1': {
            outer: { inner: 'no' },
          },
        },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
    });

    it('returns 400 when fieldValues is not an object', async () => {
      await makeSession();

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: 'not an object',
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Invitation lifecycle
  // ---------------------------------------------------------------------------
  describe('invitation lifecycle', () => {
    const makeSession = async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-rs-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000),
      });
    };

    it('returns 404 when the invitation is not found', async () => {
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(404);
    });

    it('returns 410 when the invitation is expired', async () => {
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      } as never);

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation expired');
    });

    it('returns 410 when the invitation is already completed', async () => {
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        status: INVITATION_STATUSES.COMPLETED,
      } as never);

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {},
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  // ---------------------------------------------------------------------------
  // Persistence behavior
  // ---------------------------------------------------------------------------
  describe('persistence', () => {
    const makeSession = async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-rs-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000),
      });
    };

    it('persists fieldValues to formData.sections.record_search (whole-object replacement)', async () => {
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(
        async (args: { data: { formData: unknown } }) =>
          ({ ...mockInvitation, formData: args.data.formData } as never),
      );

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'req-extra-1': 'AB12345',
          'req-extra-2': null,
          'req-extra-3': true,
          'req-extra-4': ['choice-a', 'choice-b'],
        },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.savedAt).toBe('string');

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      expect(formData.sections.record_search).toEqual({
        type: 'record_search',
        fieldValues: {
          'req-extra-1': 'AB12345',
          'req-extra-2': null,
          'req-extra-3': true,
          'req-extra-4': ['choice-a', 'choice-b'],
        },
      });
    });

    it('does NOT modify formData.sections.address_history when saving record_search (plan §11.1)', async () => {
      // Critical Task 8.4 invariant: the record_search save path must not
      // touch the legacy aggregatedFields bucket on address_history. We
      // pre-seed an invitation with a populated address_history section
      // (entries + a legacy aggregatedFields blob) and verify it round-trips
      // byte-identically after a record_search save.
      await makeSession();

      const legacyAddressHistory = {
        type: 'address_history',
        entries: [
          {
            entryId: 'e-existing-1',
            countryId: 'country-us',
            entryOrder: 0,
            fields: [
              {
                requirementId: 'req-AB',
                value: { street1: '99 Existing St', city: 'Old Town' },
                savedAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        ],
        aggregatedFields: { 'req-legacy-1': 'old-value-do-not-touch' },
      };

      const invitationWithExisting = {
        ...mockInvitation,
        formData: {
          sections: {
            address_history: legacyAddressHistory,
          },
        },
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithExisting as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(
        async (args: { data: { formData: unknown } }) =>
          ({ ...invitationWithExisting, formData: args.data.formData } as never),
      );

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'req-rs-1': 'new-record-search-value',
        },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;

      // address_history bucket is byte-identical (same entries, same legacy
      // aggregatedFields). The record_search save path must not look at or
      // modify any of this.
      expect(formData.sections.address_history).toEqual(legacyAddressHistory);

      // record_search bucket was written with the new fieldValues.
      expect(formData.sections.record_search).toEqual({
        type: 'record_search',
        fieldValues: {
          'req-rs-1': 'new-record-search-value',
        },
      });
    });

    it('whole-object replaces an existing record_search bucket on save', async () => {
      await makeSession();

      const invitationWithExistingRecordSearch = {
        ...mockInvitation,
        formData: {
          sections: {
            record_search: {
              type: 'record_search',
              fieldValues: {
                'old-req-1': 'old-1',
                'old-req-2': 'old-2',
              },
            },
          },
        },
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithExistingRecordSearch as never,
      );
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(
        async (args: { data: { formData: unknown } }) =>
          ({ ...invitationWithExistingRecordSearch, formData: args.data.formData } as never),
      );

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'new-req-1': 'fresh',
        },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;

      // Whole-object replacement: old keys are gone, only new keys remain.
      expect(formData.sections.record_search).toEqual({
        type: 'record_search',
        fieldValues: {
          'new-req-1': 'fresh',
        },
      });
      expect(formData.sections.record_search.fieldValues).not.toHaveProperty('old-req-1');
      expect(formData.sections.record_search.fieldValues).not.toHaveProperty('old-req-2');
    });

    it('accepts document-metadata-shaped object values (one-level record)', async () => {
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(
        async (args: { data: { formData: unknown } }) =>
          ({ ...mockInvitation, formData: args.data.formData } as never),
      );

      const docMetadata = {
        documentId: 'doc-uuid-1',
        originalName: 'transcript.pdf',
        storagePath: 'uploads/draft-documents/o-1/doc-uuid-1.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        uploadedAt: '2026-05-14T10:00:00Z',
      };

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: {
          'req-doc-1': docMetadata,
        },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      expect(formData.sections.record_search.fieldValues['req-doc-1']).toEqual(docMetadata);
    });

    it('promotes invitation status from sent to accessed on first save', async () => {
      // The recordSearchSave helper mirrors the address_history branch's
      // status-promotion convention.
      await makeSession();
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        status: INVITATION_STATUSES.SENT,
      } as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(
        async (args: { data: { formData?: unknown; status?: unknown } }) =>
          ({ ...mockInvitation, ...args.data } as never),
      );

      const body = {
        sectionType: 'record_search',
        sectionId: 'record_search',
        fieldValues: { 'req-1': 'x' },
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Two update calls: one for formData, one for status promotion.
      const calls = vi.mocked(prisma.candidateInvitation.update).mock.calls;
      const statusUpdate = calls.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c) => (c[0] as any).data.status === INVITATION_STATUSES.ACCESSED,
      );
      expect(statusUpdate).toBeDefined();
    });
  });
});
