// /GlobalRX_v2/src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts
//
// Task 8.3 update — Personal Info — 100% Dynamic.
// Spec: docs/specs/personal-info-dynamic.md
// Plan: docs/plans/personal-info-dynamic-technical-plan.md
//
// The route now excludes the four LOCKED_INVITATION_FIELD_KEYS
// (firstName, lastName, email, phone, phoneNumber) from the response so the
// section component never renders them (spec Business Rule 1). Every returned
// field has locked=false and prefilledValue=null. The existing tests below
// were rewritten in-place to assert the new contract; the existing test
// scaffolding (auth/invitation/error-handling cases, TD-060 AND-aggregation
// cases) is preserved with the locked fieldKeys swapped for non-locked
// personal-info fieldKeys (middleName, dateOfBirth) where field returns are
// expected.
//
// Mocking discipline (Pass 2):
//   - Rule M1: The GET handler is NOT mocked (subject of test).
//   - Rule M2: N/A — API route, no rendering.
//   - Rule M3: Prisma methods are mocked via the global mock from
//     src/test/setup.ts. These are module-level state (per the rules' explicit
//     carve-out for module-level values), and the project's entire test suite
//     uses the vi.mocked(prisma.X.method).mockResolvedValueOnce pattern.
//   - Rule M4: No invented exceptions — the changes here are confined to
//     re-asserting the new contract.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock CandidateSessionService
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn()
  }
}));

describe('GET /api/candidate/application/[token]/personal-info-fields', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@example.com',
    phoneNumber: '5551234567',
    phoneCountryCode: '+1',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: {},
    package: {
      id: 'package-123',
      packageServices: [
        {
          id: 'ps-1',
          service: {
            id: 'service-1',
            name: 'Identity Verification'
          }
        },
        {
          id: 'ps-2',
          service: {
            id: 'service-2',
            name: 'Criminal Background'
          }
        }
      ]
    }
  };

  // Task 8.3 — the requirements fixture now mixes locked fieldKeys (firstName,
  // lastName) that MUST be filtered out and non-locked personal-info fieldKeys
  // (middleName, dateOfBirth) that MUST still be returned. The non-personal
  // idNumber requirement is unchanged and continues to be excluded by the
  // collectionTab heuristic.
  const mockServiceRequirements = [
    {
      id: 'sr-1',
      serviceId: 'service-1',
      displayOrder: 1,
      requirement: {
        id: 'req-1',
        name: 'First Name',
        fieldKey: 'firstName', // LOCKED — must be filtered out (Task 8.3)
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          collectionTab: 'personal_info'
        },
        documentData: null
      }
    },
    {
      id: 'sr-2',
      serviceId: 'service-1',
      displayOrder: 2,
      requirement: {
        id: 'req-2',
        name: 'Last Name',
        fieldKey: 'lastName', // LOCKED — must be filtered out (Task 8.3)
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          collectionTab: 'personal'
        },
        documentData: null
      }
    },
    {
      id: 'sr-3',
      serviceId: 'service-1',
      displayOrder: 3,
      requirement: {
        id: 'req-3',
        name: 'Date of Birth',
        fieldKey: 'dateOfBirth', // NOT locked — must be returned
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'date',
          collectionTab: 'subject'
        },
        documentData: null
      }
    },
    {
      id: 'sr-4',
      serviceId: 'service-1',
      displayOrder: 4,
      requirement: {
        id: 'req-4',
        name: 'ID Number',
        fieldKey: 'idNumber',
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          collectionTab: 'idv' // Not personal info — must be excluded
        },
        documentData: null
      }
    },
    {
      id: 'sr-5',
      serviceId: 'service-2',
      displayOrder: 1,
      requirement: {
        id: 'req-1', // Duplicate - same requirement in different service
        name: 'First Name',
        fieldKey: 'firstName',
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          collectionTab: 'personal_info'
        },
        documentData: null
      }
    },
    {
      id: 'sr-6',
      serviceId: 'service-1',
      displayOrder: 5,
      requirement: {
        id: 'req-6',
        name: 'Middle Name',
        fieldKey: 'middleName', // NOT locked — must be returned
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          collectionTab: 'personal_info'
        },
        documentData: null
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // mockResolvedValueOnce queues persist across tests because
    // vi.clearAllMocks() only clears .calls/.results, not implementations.
    // The neighboring src/app/api/candidate/application/[token]/fields/__tests__/route.test.ts
    // file documents this and applies explicit mockReset() per Prisma method.
    // We follow the same pattern here so test-ordering pollution can't leak
    // empty-array mocks into TD-060 Case 1's AND-aggregation assertion.
    vi.mocked(prisma.candidateInvitation.findUnique).mockReset();
    vi.mocked(prisma.serviceRequirement.findMany).mockReset();
    vi.mocked(prisma.dSXAvailability.findMany).mockReset();
    vi.mocked(prisma.dSXMapping.findMany).mockReset();
  });

  describe('authentication', () => {
    it('should return 401 when no session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when session token does not match URL token', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'different-token',
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('invitation validation', () => {
    it('should return 404 when invitation not found', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should return 410 when invitation is expired', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000) // Expired
      } as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation expired');
    });

    it('should return 410 when invitation is already completed', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        status: 'completed'
      } as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  describe('field retrieval', () => {
    it('should return non-locked personal info fields from all services and exclude locked invitation fieldKeys', async () => {
      // Task 8.3 spec Business Rule 1 / DoD 1 — firstName and lastName are
      // locked invitation fieldKeys and must NOT appear in the response.
      // dateOfBirth and middleName are non-locked personal-info fields and
      // must appear. idNumber has collectionTab='idv' and continues to be
      // excluded by the non-personal heuristic.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(mockServiceRequirements as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      // Non-locked personal-info fields are returned.
      expect(fieldKeys).toContain('dateOfBirth');
      expect(fieldKeys).toContain('middleName');
      // Locked invitation fieldKeys are NOT returned (Task 8.3 Business Rule 1).
      expect(fieldKeys).not.toContain('firstName');
      expect(fieldKeys).not.toContain('lastName');
      // Non-personal-info fields are still excluded by the collectionTab heuristic.
      expect(fieldKeys).not.toContain('idNumber');

      // The response should have exactly the two non-locked personal-info fields.
      expect(data.fields).toHaveLength(2);
    });

    it('should exclude the locked invitation fieldKey "firstName" even when it has collectionTab=personal_info and a service mapping', async () => {
      // Spec Business Rule 1 / DoD 1.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        mockServiceRequirements[0] // firstName, collectionTab: 'personal_info'
      ] as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(0);
      expect(data.fields.find((f: any) => f.fieldKey === 'firstName')).toBeUndefined();
    });

    it('should exclude each of the locked invitation fieldKeys (lastName, email, phone, phoneNumber)', async () => {
      // Spec Business Rule 1 / DoD 1 — all four remaining locked fieldKeys.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const lockedKeyRequirements = ['lastName', 'email', 'phone', 'phoneNumber'].map((key, idx) => ({
        id: `sr-locked-${idx}`,
        serviceId: 'service-1',
        displayOrder: idx + 1,
        requirement: {
          id: `req-locked-${idx}`,
          name: key,
          fieldKey: key,
          type: 'field',
          disabled: false,
          fieldData: {
            dataType: 'text',
            collectionTab: 'personal_info'
          },
          documentData: null
        }
      }));

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(lockedKeyRequirements as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(0);

      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      expect(fieldKeys).not.toContain('lastName');
      expect(fieldKeys).not.toContain('email');
      expect(fieldKeys).not.toContain('phone');
      expect(fieldKeys).not.toContain('phoneNumber');
    });

    it('should still return non-locked personal-info fields (middleName, dateOfBirth) — not over-filtering', async () => {
      // Spec Business Rule 2 / DoD 2 — non-locked personal-info fields are
      // unaffected by the new filter and still appear in the response.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        mockServiceRequirements[2], // dateOfBirth
        mockServiceRequirements[5]  // middleName
      ] as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(2);

      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      expect(fieldKeys).toContain('dateOfBirth');
      expect(fieldKeys).toContain('middleName');
    });

    it('should set locked=false and prefilledValue=null on every returned field (Task 8.3)', async () => {
      // Spec Business Rule 1 / DoD 1 — after Task 8.3 no returned field is
      // locked and no returned field carries a prefilledValue. The response
      // shape retains the two fields for backward compatibility with the
      // section's existing hydration path (see route.ts JSDoc lines 40-48).
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        mockServiceRequirements[2], // dateOfBirth
        mockServiceRequirements[5]  // middleName
      ] as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      for (const field of data.fields) {
        expect(field.locked).toBe(false);
        expect(field.prefilledValue).toBe(null);
      }
    });

    it('should deduplicate fields across services', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Two services map the same non-locked dateOfBirth requirement.
      const duplicatedDateOfBirth = [
        { ...mockServiceRequirements[2] }, // service-1 / req-3 dateOfBirth
        {
          id: 'sr-dob-2',
          serviceId: 'service-2',
          displayOrder: 2,
          requirement: { ...mockServiceRequirements[2].requirement } // same req id
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(duplicatedDateOfBirth as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // dateOfBirth appears in both services but should only be returned once.
      const dobFields = data.fields.filter((f: any) => f.fieldKey === 'dateOfBirth');
      expect(dobFields).toHaveLength(1);
    });

    it('should filter out disabled requirements', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Since the query filters out disabled requirements (at the DB level
      // via `where: { requirement: { disabled: false } }`), we only return
      // enabled ones in the mock. Use a non-locked personal-info field so
      // the Task 8.3 filter does not also strip it.
      const onlyEnabledRequirements = [mockServiceRequirements[2]]; // dateOfBirth

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(onlyEnabledRequirements as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have the non-disabled requirement.
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('dateOfBirth');
    });

    it('should filter out document type requirements', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      // Since the query filters out document type requirements (at the DB
      // level via `where: { requirement: { type: 'field' } }`), we only return
      // field types in the mock. Use a non-locked personal-info field.
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        mockServiceRequirements[2] // dateOfBirth (field type, non-locked)
      ] as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have the field type requirement.
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('dateOfBirth');
      expect(data.fields.find((f: any) => f.fieldKey === 'idDoc')).toBeUndefined();
    });

    it('should identify fields by collectionTab variations (excluding locked invitation fieldKeys)', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mix collectionTab variations on NON-locked fieldKeys — the four
      // collectionTab forms (`personal_info`, `personal`, `subject`,
      // `Personal Info`) must all be recognized. The locked-invitation
      // fieldKeys are tested separately above so this case stays focused on
      // the collectionTab heuristic.
      const requirementsWithVariedTabs = [
        {
          id: 'sr-dob',
          serviceId: 'service-1',
          displayOrder: 1,
          requirement: {
            id: 'req-dob',
            name: 'Date of Birth',
            fieldKey: 'dateOfBirth',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'date', collectionTab: 'personal_info' },
            documentData: null
          }
        },
        {
          id: 'sr-mn',
          serviceId: 'service-1',
          displayOrder: 2,
          requirement: {
            id: 'req-mn',
            name: 'Middle Name',
            fieldKey: 'middleName',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text', collectionTab: 'personal' },
            documentData: null
          }
        },
        {
          id: 'sr-subj',
          serviceId: 'service-1',
          displayOrder: 3,
          requirement: {
            id: 'req-subj',
            name: 'Mother Maiden Name',
            fieldKey: 'mothersMaidenName',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text', collectionTab: 'subject' },
            documentData: null
          }
        },
        {
          id: 'sr-mixed',
          serviceId: 'service-1',
          displayOrder: 4,
          requirement: {
            id: 'req-mixed',
            name: 'Mixed Field',
            fieldKey: 'mixedField',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text', collection_tab: 'Personal Info' },
            documentData: null
          }
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementsWithVariedTabs as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All should be recognized as personal info fields.
      expect(data.fields).toHaveLength(4);
      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      expect(fieldKeys).toContain('dateOfBirth');
      expect(fieldKeys).toContain('middleName');
      expect(fieldKeys).toContain('mothersMaidenName');
      expect(fieldKeys).toContain('mixedField');
    });

    it('should identify common personal fields by fieldKey when no collectionTab — but still exclude locked invitation fieldKeys', async () => {
      // Task 8.3: ssn is in PERSONAL_INFO_FIELD_KEYS so it is captured by the
      // fieldKey-based fallback. It is NOT in LOCKED_INVITATION_FIELD_KEYS so
      // it must still be returned. customField is not in either set and is
      // excluded.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const requirementsWithoutTab = [
        {
          id: 'sr-ssn',
          serviceId: 'service-1',
          displayOrder: 9,
          requirement: {
            id: 'req-ssn',
            name: 'SSN',
            fieldKey: 'ssn',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text' /* no collectionTab */ },
            documentData: null
          }
        },
        {
          id: 'sr-custom',
          serviceId: 'service-1',
          displayOrder: 10,
          requirement: {
            id: 'req-custom',
            name: 'Custom Field',
            fieldKey: 'customField',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text' /* no collectionTab */ },
            documentData: null
          }
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementsWithoutTab as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // SSN is a common personal field and not in the locked set — should be
      // included. customField is not recognized at all — excluded.
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('ssn');
    });

    it('should return empty array when package has no services', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationNoServices = {
        ...mockInvitation,
        package: {
          id: 'package-123',
          packageServices: []
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoServices as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toEqual([]);
    });

    it('should preserve complete fieldData', async () => {
      // Use a NON-locked fieldKey so the Task 8.3 filter doesn't strip the
      // requirement before the response builder gets to it.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const complexFieldData = {
        dataType: 'text',
        collectionTab: 'personal_info',
        retentionHandling: 'delete_at_customer_rule',
        requiresVerification: true,
        shortName: 'MN',
        instructions: 'Legal name only',
        customProperty: 'should be preserved'
      };

      const requirementWithComplexData = [{
        id: 'sr-complex',
        serviceId: 'service-1',
        displayOrder: 1,
        requirement: {
          id: 'req-complex',
          name: 'Complex Field',
          fieldKey: 'middleName', // non-locked
          type: 'field',
          disabled: false,
          fieldData: complexFieldData,
          documentData: null
        }
      }];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementWithComplexData as any);
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All fieldData should be preserved.
      expect(data.fields[0].fieldData).toEqual(complexFieldData);
      expect(data.fields[0].instructions).toBe('Legal name only');
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should handle session service errors', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockRejectedValueOnce(
        new Error('Session service error')
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  // ===========================================================================
  // TD-060 — Required-field accuracy contract tests.
  //
  // Per the spec at docs/specs/fix-td059-td060-personal-info-required-fields-and-sidebar-reactivity.md
  // Test Cases 1-7. The route now:
  //   1. Queries dsx_availability filtered to package services + non-disabled
  //      countries to get the (serviceId, locationId) pairs that count.
  //   2. Queries dsx_mappings filtered to those pairs + the personal-info
  //      requirement IDs.
  //   3. AND-aggregates isRequired across the matching mapping rows. A field
  //      is baseline-required ONLY when every applicable mapping row says so.
  //   4. Defaults to isRequired: false when no applicable mapping rows exist.
  //
  // Task 8.3 update — the original fixture used `firstName`, which is now a
  // locked invitation fieldKey and gets filtered out before the response
  // builder runs. We swap to `middleName` (non-locked, personal-info) so the
  // AND-aggregation contract is still exercised on a returned field.
  // ===========================================================================
  describe('TD-060: required-field accuracy', () => {
    const baselineSession = {
      token: mockToken,
      invitationId: 'inv-123',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000),
    };

    // Single non-locked personal-info requirement so the AND-aggregation
    // result is unambiguous in each test case AND the Task 8.3 filter does
    // not strip the field before the response builder sees it.
    const singleRequirement = [
      {
        id: 'sr-middleName',
        serviceId: 'service-1',
        displayOrder: 1,
        requirement: {
          id: 'req-middleName',
          name: 'Middle Name',
          fieldKey: 'middleName',
          type: 'field',
          disabled: false,
          fieldData: {
            dataType: 'text',
            collectionTab: 'personal_info',
          },
          documentData: null,
        },
      },
    ];

    it('TD-060 Case 1: returns isRequired: true when EVERY package (service, location) mapping row has isRequired=true', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      // 2 services x 2 locations = 4 (serviceId, locationId) pairs available
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
        { serviceId: 'service-1', locationId: 'loc-B' },
        { serviceId: 'service-2', locationId: 'loc-A' },
        { serviceId: 'service-2', locationId: 'loc-B' },
      ] as any);

      // 4 mapping rows for req-middleName, ALL isRequired:true → baseline required
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-B', isRequired: true },
        { requirementId: 'req-middleName', serviceId: 'service-2', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-middleName', serviceId: 'service-2', locationId: 'loc-B', isRequired: true },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('middleName');
      expect(data.fields[0].isRequired).toBe(true);
    });

    it('TD-060 Case 2: returns isRequired: false when SOME but not all package mapping rows have isRequired=true', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
        { serviceId: 'service-1', locationId: 'loc-B' },
        { serviceId: 'service-2', locationId: 'loc-A' },
        { serviceId: 'service-2', locationId: 'loc-B' },
      ] as any);

      // 4 rows but one has isRequired:false → not baseline required
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-B', isRequired: true },
        { requirementId: 'req-middleName', serviceId: 'service-2', locationId: 'loc-A', isRequired: false },
        { requirementId: 'req-middleName', serviceId: 'service-2', locationId: 'loc-B', isRequired: true },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('middleName');
      // Cross-section registry handles the conditional case at runtime — baseline
      // returned by the API is false.
      expect(data.fields[0].isRequired).toBe(false);
    });

    it('TD-060 Case 3: ignores mappings for services NOT in the candidate package', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      // Only service-1 has any availability — the candidate's service-2 has none.
      // service-X (not in the candidate's package at all) is what would be
      // required-true in legacy behavior; it must be ignored here. The
      // dsx_availability mock returns ONLY the candidate's package services
      // because the route filters by serviceId IN package serviceIds.
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
      ] as any);

      // Mapping row for service-1/loc-A says NOT required. Even if a separate
      // mapping for service-X said required, it never reaches dsx_mappings
      // because service-X's pair is not in the OR-pair filter (it wasn't in
      // dsx_availability). So the route's mapping query returns only what
      // matches the package filter.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].isRequired).toBe(false);

      // The dsx_availability query must scope to the candidate's package
      // serviceIds. Verify the route's where clause includes that filter.
      expect(prisma.dSXAvailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId: { in: ['service-1', 'service-2'] },
          }),
        })
      );
    });

    it('TD-060 Case 4: ignores (service, location) pairs where dsx_availability.isAvailable=false', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      // dsx_availability.findMany is called with isAvailable: true in the where
      // clause. The mock simulates the database honoring that filter — only
      // service-1/loc-A is returned. The service-1/loc-Z pair (with
      // isAvailable: false at the DB level) is absent from the result set.
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
      ] as any);

      // The mapping row for the unavailable pair (loc-Z) is NEVER fetched
      // because (service-1, loc-Z) isn't in the OR-pair filter. The mapping
      // query result includes only the available pair, marked NOT required.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields[0].isRequired).toBe(false);

      // Verify the availability query asked for isAvailable: true.
      expect(prisma.dSXAvailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isAvailable: true,
          }),
        })
      );
    });

    it('TD-060 Case 5: ignores globally disabled locations via country.NOT.disabled filter', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      // The route applies country: { NOT: { disabled: true } } as a relation
      // filter. The mock simulates the database honoring that filter — the
      // disabled location row (e.g., loc-D) is absent from the result set.
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
      ] as any);

      // The mapping for the disabled location is never queried because its
      // pair isn't in the OR-pair list. The remaining row says NOT required.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-middleName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields[0].isRequired).toBe(false);

      // Confirm the availability query uses the `country: { NOT: { disabled: true } }`
      // form. This is the prescribed Prisma idiom for "disabled IS NOT TRUE"
      // (Country.disabled is nullable in the schema, so NOT { disabled: true }
      // includes both disabled = false rows and disabled IS NULL rows).
      expect(prisma.dSXAvailability.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: { NOT: { disabled: true } },
          }),
        })
      );
    });

    it('TD-060 Case 6: returns all fields not required when package has services but no DSX mappings apply', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      // Package has services, but none of them have DSX availability rows
      // (e.g., new services not yet configured). The availability result is
      // empty, so the route short-circuits and returns isRequired: false for
      // every field.
      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([] as any);

      // The mapping query should not be called at all when availabilityRows
      // is empty. We assert that and the field's isRequired below.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].isRequired).toBe(false);
    });

    it('TD-060 Case 7: returns isRequired: false when a field has zero applicable mapping rows', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(baselineSession);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(singleRequirement as any);

      vi.mocked(prisma.dSXAvailability.findMany).mockResolvedValueOnce([
        { serviceId: 'service-1', locationId: 'loc-A' },
        { serviceId: 'service-2', locationId: 'loc-B' },
      ] as any);

      // The requirement exists in dsx_requirements but has zero mapping rows
      // for the candidate's (service, location) pairs. Default → false.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('middleName');
      expect(data.fields[0].isRequired).toBe(false);
    });
  });
});
