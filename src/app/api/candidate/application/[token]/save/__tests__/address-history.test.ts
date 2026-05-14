// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/address-history.test.ts
// Pass 2 tests for Phase 6 Stage 3: Save API extensions for address_history
//
// Task 8.4 update: aggregatedFields is now optional on address_history bodies
// (plan §4.3, §6.2). Tests in this file have been updated to reflect that
// behavior change. The legacy with-aggregatedFields path is preserved for
// backward tolerance.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
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

describe('POST /api/candidate/application/[token]/save - Address History', () => {
  const mockToken = 'token-addr-hist';

  const mockInvitation = {
    id: 'inv-001',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: { sections: {} },
    lastAccessedAt: null
  };

  // Two valid UUIDs we'll reuse across tests
  const entryUuid1 = '550e8400-e29b-41d4-a716-446655441001';
  const countryUuid = '550e8400-e29b-41d4-a716-446655442001';
  const reqAddressBlock = '550e8400-e29b-41d4-a716-446655443001';
  const reqAggField = '550e8400-e29b-41d4-a716-446655443002';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('address_history dispatch — branch validation', () => {
    it('returns 400 with detail message when address_history body lacks entries', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        // entries deliberately omitted
        aggregatedFields: {}
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.details[0].message).toContain('address_history');
      expect(data.details[0].path).toEqual(['entries']);
    });

    // Task 8.4 — aggregatedFields is now OPTIONAL on address_history bodies
    // (plan §4.3, §6.2). The new Address History client posts entries-only
    // after the split. This test asserts the new behavior: a body without
    // aggregatedFields is accepted with 200 and persists entries, and the
    // saved address_history row does NOT have an aggregatedFields key
    // implicitly created.
    it('accepts an address_history body that omits aggregatedFields (Task 8.4)', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: { data: { formData: unknown } }) => ({
        ...mockInvitation,
        formData: args.data.formData
      } as never));

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [
          {
            entryId: entryUuid1,
            countryId: countryUuid,
            entryOrder: 0,
            fields: []
          }
        ]
        // aggregatedFields deliberately omitted — Task 8.4 makes it optional.
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Persisted shape: entries present, NO aggregatedFields key was added
      // implicitly. The save route only writes aggregatedFields when the body
      // supplied it (plan §4.3).
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      expect(formData.sections.address_history).toBeDefined();
      expect(formData.sections.address_history.entries).toHaveLength(1);
      expect(formData.sections.address_history.entries[0].entryId).toBe(entryUuid1);
      // Critical: aggregatedFields must NOT be added when the body did not
      // include it — the post-split Address History client does not write to
      // this key.
      expect(formData.sections.address_history).not.toHaveProperty('aggregatedFields');
    });
  });

  describe('address_history schema — value union widening', () => {
    it('accepts address_block JSON object value (street/city/state/postal + nested dates) for address_history entries', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: { data: { formData: unknown } }) => ({
        ...mockInvitation,
        formData: args.data.formData
      } as never));

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [
          {
            entryId: entryUuid1,
            countryId: countryUuid,
            entryOrder: 0,
            fields: [
              {
                requirementId: reqAddressBlock,
                value: {
                  street1: '123 Main St',
                  city: 'Arlington',
                  state: 'subregion-uuid-1',
                  postalCode: '22201',
                  fromDate: '2022-03-01',
                  toDate: null,
                  isCurrent: true
                }
              }
            ]
          }
        ],
        aggregatedFields: {
          [reqAggField]: 'AB12345'
        }
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify the persisted shape contains the address_history section.
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      expect(formData.sections.address_history).toBeDefined();
      expect(formData.sections.address_history.type).toBe('address_history');
      // Entry was preserved with its address-block JSON value AND nested dates.
      const entry = formData.sections.address_history.entries[0];
      expect(entry.entryId).toBe(entryUuid1);
      expect(entry.countryId).toBe(countryUuid);
      expect(entry.fields[0].requirementId).toBe(reqAddressBlock);
      expect(entry.fields[0].value).toEqual({
        street1: '123 Main St',
        city: 'Arlington',
        state: 'subregion-uuid-1',
        postalCode: '22201',
        fromDate: '2022-03-01',
        toDate: null,
        isCurrent: true
      });
      // aggregatedFields object is persisted at the top of the section
      // (backward tolerance — legacy clients that still send it round-trip).
      expect(formData.sections.address_history.aggregatedFields).toEqual({
        [reqAggField]: 'AB12345'
      });
    });

    it('accepts an empty entries array and an empty aggregatedFields object', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: { data: { formData: unknown } }) => ({
        ...mockInvitation,
        formData: args.data.formData
      } as never));

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [],
        aggregatedFields: {}
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('repeatable schema (education/employment) — value union widening for address_block', () => {
    it('accepts address_block JSON object value in education entry fields', async () => {
      // The widened repeatable schema also covers education/employment so
      // their address_block sub-fields can store street/city/state objects.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: { data: { formData: unknown } }) => ({
        ...mockInvitation,
        formData: args.data.formData
      } as never));

      const body = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: entryUuid1,
            countryId: countryUuid,
            entryOrder: 0,
            fields: [
              {
                requirementId: reqAddressBlock,
                // Education address blocks have NO date keys — just pieces.
                value: {
                  street1: '1 Harvard Yard',
                  city: 'Cambridge',
                  state: 'massachusetts-uuid',
                  postalCode: '02138'
                }
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      const entry = formData.sections.education.entries[0];
      expect(entry.fields[0].value).toEqual({
        street1: '1 Harvard Yard',
        city: 'Cambridge',
        state: 'massachusetts-uuid',
        postalCode: '02138'
      });
    });
  });

  describe('whole-section replacement', () => {
    it('completely replaces the prior address_history entries on save (no merge)', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithAddressHistory = {
        ...mockInvitation,
        formData: {
          sections: {
            address_history: {
              type: 'address_history',
              entries: [
                {
                  entryId: 'old-entry-1',
                  countryId: 'old-country-1',
                  entryOrder: 0,
                  fields: []
                }
              ],
              aggregatedFields: { 'old-req': 'old-value' }
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithAddressHistory as never);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: { data: { formData: unknown } }) => ({
        ...invitationWithAddressHistory,
        formData: args.data.formData
      } as never));

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [
          {
            entryId: entryUuid1,
            countryId: countryUuid,
            entryOrder: 0,
            fields: []
          }
        ],
        // Empty aggregatedFields should clear the previous values.
        aggregatedFields: {}
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formData = (updateCall[0] as any).data.formData;
      const section = formData.sections.address_history;
      // Only the new entry remains.
      expect(section.entries).toHaveLength(1);
      expect(section.entries[0].entryId).toBe(entryUuid1);
      // aggregatedFields was replaced with the empty object — old key is gone.
      expect(section.aggregatedFields).toEqual({});
    });
  });

  describe('authentication and invitation lifecycle', () => {
    it('returns 401 when no candidate session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [],
        aggregatedFields: {}
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(401);
    });

    it('returns 410 when the invitation is expired', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-001',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000)
      } as never);

      const body = {
        sectionType: 'address_history',
        sectionId: 'address_history',
        entries: [],
        aggregatedFields: {}
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        { method: 'POST', body: JSON.stringify(body) }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation expired');
    });
  });
});
