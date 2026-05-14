// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/record-search.test.ts
// Pass 2 tests for Task 8.4: saved-data API extensions for record_search.
//
// Source file reviewed:
//   - src/app/api/candidate/application/[token]/saved-data/route.ts
//     (record_search branch at lines 271-286; default fallback at lines 384-389)
//
// Per Rule M1, the GET export (subject of the tests) is not mocked. Prisma is
// mocked globally via src/test/setup.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock CandidateSessionService
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn(),
  },
}));

describe('GET /api/candidate/application/[token]/saved-data - Record Search (Task 8.4)', () => {
  const mockToken = 'token-rs-saved';

  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('returns the record_search section with fieldValues when persisted', async () => {
    await makeSession();

    const invitation = {
      id: 'inv-rs-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          record_search: {
            type: 'record_search',
            fieldValues: {
              'req-rs-1': 'AB12345',
              'req-rs-2': null,
              'req-rs-3': ['choice-a'],
            },
          },
        },
      },
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as never);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.sections.record_search).toEqual({
      type: 'record_search',
      fieldValues: {
        'req-rs-1': 'AB12345',
        'req-rs-2': null,
        'req-rs-3': ['choice-a'],
      },
    });
  });

  it('defaults record_search to an empty fieldValues object when no save has happened yet', async () => {
    // Plan §4.5 Change C — the saved-data endpoint always returns a
    // record_search section, defaulting to `{ type: 'record_search',
    // fieldValues: {} }` when the bucket does not exist in formData.sections.
    await makeSession();

    const invitation = {
      id: 'inv-rs-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          // No record_search section here
        },
      },
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as never);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.sections.record_search).toEqual({
      type: 'record_search',
      fieldValues: {},
    });
  });

  it('returns the record_search section even when the entire formData is empty', async () => {
    await makeSession();

    const invitation = {
      id: 'inv-rs-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: null,
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as never);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.sections.record_search).toEqual({
      type: 'record_search',
      fieldValues: {},
    });
  });

  it('does NOT propagate address_history.aggregatedFields into record_search.fieldValues (plan §11.1)', async () => {
    // This is the critical "no backward-compatibility read" assertion. The
    // legacy aggregatedFields bucket on address_history is intentionally
    // ignored — record_search.fieldValues must remain empty when only
    // address_history.aggregatedFields has data.
    await makeSession();

    const invitation = {
      id: 'inv-rs-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          address_history: {
            type: 'address_history',
            entries: [
              {
                entryId: 'e-1',
                countryId: 'country-us',
                entryOrder: 0,
                fields: [],
              },
            ],
            aggregatedFields: {
              'legacy-req-1': 'leak-this?-no',
              'legacy-req-2': 'still-no',
            },
          },
          // No record_search bucket.
        },
      },
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as never);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    // record_search.fieldValues must be empty — no leakage from
    // address_history.aggregatedFields.
    expect(data.sections.record_search).toEqual({
      type: 'record_search',
      fieldValues: {},
    });
    expect(data.sections.record_search.fieldValues).not.toHaveProperty('legacy-req-1');
    expect(data.sections.record_search.fieldValues).not.toHaveProperty('legacy-req-2');

    // The address_history bucket is unchanged — legacy aggregatedFields is
    // still returned (additive contract). The candidate-side Address History
    // section now ignores it.
    expect(data.sections.address_history.aggregatedFields).toEqual({
      'legacy-req-1': 'leak-this?-no',
      'legacy-req-2': 'still-no',
    });
  });

  it('defends against a malformed record_search bucket (non-object fieldValues)', async () => {
    // If the stored shape is corrupted (e.g., an array where fieldValues
    // should be an object), the route falls back to an empty object rather
    // than passing the broken shape through.
    await makeSession();

    const invitation = {
      id: 'inv-rs-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          record_search: {
            type: 'record_search',
            fieldValues: ['not', 'an', 'object'], // malformed
          },
        },
      },
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as never);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Defensive fallback to empty object.
    expect(data.sections.record_search.fieldValues).toEqual({});
  });

  it('returns 401 when no session exists', async () => {
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

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

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`,
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(403);
  });
});
