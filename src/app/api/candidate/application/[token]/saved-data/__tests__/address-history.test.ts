// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/address-history.test.ts
// Pass 2 tests for Phase 6 Stage 3: Saved-data API extensions for address_history

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
  }
}));

// Mock CandidateSessionService
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn()
  }
}));

describe('GET /api/candidate/application/[token]/saved-data - Address History', () => {
  const mockToken = 'token-saved-data';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the address_history section with entries and aggregatedFields', async () => {
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
      token: mockToken,
      invitationId: 'inv-001',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000)
    });

    const invitation = {
      id: 'inv-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          address_history: {
            type: 'address_history',
            entries: [
              {
                entryId: 'entry-1',
                countryId: 'country-us',
                entryOrder: 0,
                fields: [
                  {
                    requirementId: 'req-AB',
                    value: {
                      street1: '123 Main St',
                      city: 'Arlington',
                      state: 'va-uuid',
                      postalCode: '22201',
                      fromDate: '2022-03-01',
                      toDate: null,
                      isCurrent: true
                    },
                    savedAt: '2026-05-01T00:00:00Z'
                  }
                ]
              }
            ],
            aggregatedFields: {
              'req-extra-1': 'AB12345'
            }
          }
        }
      }
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as any);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();

    // The address_history section is present in the formatted response.
    expect(data.sections.address_history).toBeDefined();

    // entries: same per-entry shape as education/employment, address_block
    // value preserved including nested dates.
    expect(data.sections.address_history.entries).toHaveLength(1);
    const entry = data.sections.address_history.entries[0];
    expect(entry.entryId).toBe('entry-1');
    expect(entry.countryId).toBe('country-us');
    expect(entry.entryOrder).toBe(0);
    expect(entry.fields[0].requirementId).toBe('req-AB');
    expect(entry.fields[0].value).toEqual({
      street1: '123 Main St',
      city: 'Arlington',
      state: 'va-uuid',
      postalCode: '22201',
      fromDate: '2022-03-01',
      toDate: null,
      isCurrent: true
    });

    // aggregatedFields object is at the top of the section, keyed by requirementId.
    expect(data.sections.address_history.aggregatedFields).toEqual({
      'req-extra-1': 'AB12345'
    });
  });

  it('strips internal savedAt metadata from each field in returned entries', async () => {
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
      token: mockToken,
      invitationId: 'inv-001',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000)
    });

    const invitation = {
      id: 'inv-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          address_history: {
            type: 'address_history',
            entries: [
              {
                entryId: 'entry-1',
                countryId: 'country-us',
                entryOrder: 0,
                fields: [
                  {
                    requirementId: 'req-AB',
                    value: { street1: '1' },
                    savedAt: '2026-05-01T00:00:00Z'
                  }
                ]
              }
            ],
            aggregatedFields: {}
          }
        }
      }
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as any);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    const field = data.sections.address_history.entries[0].fields[0];
    expect(field.requirementId).toBe('req-AB');
    expect(field.value).toEqual({ street1: '1' });
    // savedAt is internal metadata and must NOT be returned to the client.
    expect(field).not.toHaveProperty('savedAt');
  });

  it('defaults aggregatedFields to {} when missing from saved data', async () => {
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
      token: mockToken,
      invitationId: 'inv-001',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000)
    });

    const invitation = {
      id: 'inv-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: {
        sections: {
          address_history: {
            type: 'address_history',
            entries: []
            // aggregatedFields key absent — defensive case from older saved data
          }
        }
      }
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as any);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sections.address_history.entries).toEqual([]);
    expect(data.sections.address_history.aggregatedFields).toEqual({});
  });

  it('does NOT auto-create the address_history section when no saved data exists', async () => {
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
      token: mockToken,
      invitationId: 'inv-001',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000)
    });

    const invitation = {
      id: 'inv-001',
      token: mockToken,
      status: INVITATION_STATUSES.ACCESSED,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      formData: { sections: {} }
    };

    vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitation as any);

    const request = new NextRequest(
      `http://localhost/api/candidate/application/${mockToken}/saved-data`
    );

    const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    // address_history is conditional on the package containing record-type
    // services — the saved-data endpoint does not auto-create it.
    expect(data.sections.address_history).toBeUndefined();
    // personal_info and idv ARE auto-created (existing behavior preserved).
    expect(data.sections.personal_info).toBeDefined();
    expect(data.sections.idv).toBeDefined();
  });
});
