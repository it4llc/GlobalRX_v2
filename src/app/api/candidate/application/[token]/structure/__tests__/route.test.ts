// /GlobalRX_v2/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

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

// Prisma return-type alias for the `candidateInvitation.findUnique` shape the
// route loads (the same include tree assembled inline in the original success
// case test). Defined once so the phone-combining fixtures below can be typed
// without an `as any` cast each. Adding a field to the route's include block
// will surface as a type error here, which is the desired safety.
type MockInvitationPayload = Prisma.CandidateInvitationGetPayload<{
  include: {
    order: { include: { customer: true } };
    package: {
      include: {
        workflow: { include: { sections: true } };
        packageServices: { include: { service: true } };
      };
    };
  };
}>;

describe('GET /api/candidate/application/[token]/structure', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@example.com',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    orderId: 'order-123',
    customerId: 'customer-123',
    packageId: 'package-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-123',
    phoneCountryCode: null,
    phoneNumber: null,
    passwordHash: 'hash',
    previousStatus: null,
    completedAt: null,
    lastAccessedAt: null,
    order: {
      id: 'order-123',
      customer: {
        id: 'customer-123',
        name: 'Acme Corp'
      }
    },
    package: {
      id: 'package-123',
      name: 'Standard Background Check',
      workflow: {
        id: 'workflow-123',
        sections: [
          {
            id: 'section-1',
            name: 'Notice of Processing',
            placement: 'before_services',
            displayOrder: 1,
            type: 'text',
            isRequired: true
          },
          {
            id: 'section-2',
            name: 'Consent Form',
            placement: 'after_services',
            displayOrder: 1,
            type: 'text',
            isRequired: true
          },
          {
            id: 'section-3',
            name: 'Authorization',
            placement: 'after_services',
            displayOrder: 2,
            type: 'text',
            isRequired: true
          }
        ]
      },
      packageServices: [
        {
          id: 'ps-1',
          service: {
            id: 'service-1',
            name: 'Identity Verification Service',
            functionalityType: 'verification-idv'
          }
        },
        {
          id: 'ps-2',
          service: {
            id: 'service-2',
            name: 'Criminal Record Check',
            functionalityType: 'record'
          }
        },
        {
          id: 'ps-3',
          service: {
            id: 'service-3',
            name: 'Education Verification',
            functionalityType: 'verification-edu'
          }
        },
        {
          id: 'ps-4',
          service: {
            id: 'service-4',
            name: 'Another Education Check',
            functionalityType: 'verification-edu'
          }
        }
      ]
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when no session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when session token does not match URL token', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: 'different-token',
        invitationId: 'inv-123'
      });

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('success cases', () => {
    it('should return correct structure with workflow and service sections', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        mockInvitation as Prisma.CandidateInvitationGetPayload<{
          include: {
            order: { include: { customer: true } },
            package: {
              include: {
                workflow: { include: { sections: true } },
                packageServices: { include: { service: true } }
              }
            }
          }
        }>
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Check invitation info
      // Task 8.1 — the structure response now returns `email` and `phone`
      // in the invitation block so the candidate shell can populate
      // template variable values. The mock invitation has phoneCountryCode
      // and phoneNumber both null, so the derived `phone` is null here.
      expect(data.invitation).toEqual({
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah@example.com',
        phone: null,
        status: 'accessed',
        expiresAt: mockInvitation.expiresAt.toISOString(),
        companyName: 'Acme Corp'
      });

      // Check sections array - now includes Personal Information as first item
      // Phase 7 Stage 1 §3.3 — the structure response now appends a synthetic
      // `review_submit` entry after all after_services workflow sections, so
      // the total length grows by 1 (Rule 29).
      expect(data.sections).toHaveLength(8); // 1 personal + 1 before + 3 services (edu deduplicated) + 2 after + 1 review_submit

      // Check before_services section comes first
      // Phase 6 Stage 4: workflow_section sections now carry a workflowSection
      // payload (id, name, type, placement, displayOrder, isRequired) so the
      // renderer can display the content without an extra fetch. Optional
      // string fields (content, fileUrl, fileName) that are undefined on the
      // source row are dropped from the JSON response.
      expect(data.sections[0]).toEqual({
        id: 'section-1',
        title: 'Notice of Processing',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null,
        workflowSection: {
          id: 'section-1',
          name: 'Notice of Processing',
          type: 'text',
          placement: 'before_services',
          displayOrder: 1,
          isRequired: true
        }
      });

      // Check Personal Information section comes after before_services
      expect(data.sections[1]).toEqual({
        id: 'personal_info',
        title: 'candidate.portal.sections.personalInformation',
        type: 'personal_info',
        placement: 'services',
        status: 'not_started',
        order: 1,
        functionalityType: null
      });

      // Check service sections are in correct order
      expect(data.sections[2]).toEqual({
        id: 'service_verification-idv',
        title: 'candidate.portal.sections.identityVerification',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 2,
        functionalityType: 'verification-idv',
        serviceIds: ['service-1']
      });

      // Phase 6 Stage 3: record-functionality services now emit a dedicated
      // `address_history` section (id: 'address_history', type: 'address_history')
      // instead of a generic service_section. Position remains index 2 of the
      // service section ordering (after IDV, before Education) per the spec
      // "Section Position in the Candidate Application" and Definition of Done
      // items #10 and #11.
      // Phase 7 Stage 1 §3.3 — Address History now carries a resolved
      // `scope` block. With null/missing scope on the underlying record
      // service, normalizeRawScope returns count_exact 1 (current address
      // default per packageScopeShape's record default). The frontend uses
      // scopeDescriptionKey + scopeDescriptionPlaceholders to localize.
      expect(data.sections[3]).toEqual({
        id: 'address_history',
        title: 'candidate.portal.sections.addressHistory',
        type: 'address_history',
        placement: 'services',
        status: 'not_started',
        order: 3,
        functionalityType: 'record',
        serviceIds: ['service-2'],
        scope: {
          scopeType: 'count_exact',
          scopeValue: 1,
          scopeDescriptionKey: 'candidate.portal.scopeCountExact',
          scopeDescriptionPlaceholders: { type: 'address' },
        },
      });

      // Phase 7 Stage 1 §3.3 — Education service section also carries the
      // resolved scope. The mock service has no explicit scope JSON so the
      // normalized scope is `all` (the non-record default).
      expect(data.sections[4]).toEqual({
        id: 'service_verification-edu',
        title: 'candidate.portal.sections.educationHistory',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 4,
        functionalityType: 'verification-edu',
        serviceIds: ['service-3', 'service-4'],
        scope: {
          scopeType: 'all',
          scopeValue: null,
          scopeDescriptionKey: 'candidate.portal.scopeAll',
          scopeDescriptionPlaceholders: { type: 'education' },
        },
      });

      // Check after_services sections
      // Phase 6 Stage 4: workflow_section sections in the after_services zone
      // also carry the workflowSection payload — same shape as before_services,
      // different placement value.
      expect(data.sections[5]).toEqual({
        id: 'section-2',
        title: 'Consent Form',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 5,
        functionalityType: null,
        workflowSection: {
          id: 'section-2',
          name: 'Consent Form',
          type: 'text',
          placement: 'after_services',
          displayOrder: 1,
          isRequired: true
        }
      });

      expect(data.sections[6]).toEqual({
        id: 'section-3',
        title: 'Authorization',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 6,
        functionalityType: null,
        workflowSection: {
          id: 'section-3',
          name: 'Authorization',
          type: 'text',
          placement: 'after_services',
          displayOrder: 2,
          isRequired: true
        }
      });

      // Phase 7 Stage 1 §3.3 — synthetic Review & Submit section as the
      // last entry, after every after_services workflow section (Rule 29).
      expect(data.sections[7]).toEqual({
        id: 'review_submit',
        title: 'candidate.portal.sections.reviewSubmit',
        type: 'review_submit',
        placement: 'after_services',
        status: 'not_started',
        order: 7,
        functionalityType: null,
      });
    });

    it('should deduplicate services with the same functionality type', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationWithDuplicates = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Identity Verification Service 1',
                functionalityType: 'verification-idv'
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Identity Verification Service 2',
                functionalityType: 'verification-idv'
              }
            },
            {
              id: 'ps-3',
              service: {
                id: 'service-3',
                name: 'Criminal Background',
                functionalityType: 'record'
              }
            }
          ]
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithDuplicates as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have deduplicated IDV services
      const idvSections = data.sections.filter((s: any) =>
        s.functionalityType === 'verification-idv' && s.type === 'service_section'
      );
      expect(idvSections).toHaveLength(1);
      expect(idvSections[0].serviceIds).toEqual(['service-1', 'service-2']);
    });

    it('should handle package with no workflow sections', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationNoWorkflow = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: null
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationNoWorkflow as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have personal info and service sections only (no workflow sections).
      // Phase 6 Stage 3: record-functionality services emit a dedicated
      // `address_history` section type, so the set of valid types after
      // personal_info now includes 'service_section' AND 'address_history'.
      // Phase 7 Stage 1 §3.3: the synthetic 'review_submit' entry is appended
      // last and must also be accepted in the post-personal-info slice.
      expect(data.sections[0].type).toBe('personal_info');
      const validServiceSectionTypes = ['service_section', 'address_history', 'review_submit'];
      expect(
        data.sections.slice(1).every((s: any) => validServiceSectionTypes.includes(s.type))
      ).toBe(true);
    });

    it('should handle package with no services', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationNoServices = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          packageServices: []
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationNoServices as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have workflow sections first, then personal info
      // With no services, should have: 1 before_services + 1 personal_info + 2 after_services
      // + 1 review_submit (Phase 7 Stage 1 §3.3) = 5 sections
      expect(data.sections).toHaveLength(5);
      expect(data.sections[0].type).toBe('workflow_section'); // before_services
      expect(data.sections[1].type).toBe('personal_info');
      expect(data.sections[2].type).toBe('workflow_section'); // after_services
      expect(data.sections[3].type).toBe('workflow_section'); // after_services
      expect(data.sections[4].type).toBe('review_submit');     // synthetic Review & Submit
    });

    it('should maintain correct order for service sections', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationWithServices = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: null,
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Employment Verification',
                functionalityType: 'verification-emp'
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Identity Check',
                functionalityType: 'verification-idv'
              }
            },
            {
              id: 'ps-3',
              service: {
                id: 'service-3',
                name: 'Criminal Records',
                functionalityType: 'record'
              }
            },
            {
              id: 'ps-4',
              service: {
                id: 'service-4',
                name: 'Education Check',
                functionalityType: 'verification-edu'
              }
            }
          ]
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithServices as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Check the fixed order (personal info first, then services in order): IDV, Records, Education, Employment
      expect(data.sections[0].type).toBe('personal_info');
      expect(data.sections[1].functionalityType).toBe('verification-idv');
      expect(data.sections[2].functionalityType).toBe('record');
      expect(data.sections[3].functionalityType).toBe('verification-edu');
      expect(data.sections[4].functionalityType).toBe('verification-emp');
    });

    // Task 8.1 — phone display string is combined server-side so the
    // candidate UI does not have to know the storage shape. Cover all
    // three branches the route now implements.
    describe('phone combining (Task 8.1)', () => {
      it('should combine phoneCountryCode and phoneNumber with a single space when both are present', async () => {
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123'
        });

        const invitationWithBothPhoneFields = {
          ...mockInvitation,
          phoneCountryCode: '+1',
          phoneNumber: '5551234567'
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
          invitationWithBothPhoneFields as MockInvitationPayload
        );

        const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.invitation.phone).toBe('+1 5551234567');
      });

      it('should return just phoneNumber when phoneCountryCode is null but phoneNumber is present', async () => {
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123'
        });

        const invitationWithOnlyPhoneNumber = {
          ...mockInvitation,
          phoneCountryCode: null,
          phoneNumber: '5551234567'
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
          invitationWithOnlyPhoneNumber as MockInvitationPayload
        );

        const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.invitation.phone).toBe('5551234567');
      });

      it('should return null when both phoneCountryCode and phoneNumber are null', async () => {
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123'
        });

        const invitationWithNoPhone = {
          ...mockInvitation,
          phoneCountryCode: null,
          phoneNumber: null
        };

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
          invitationWithNoPhone as MockInvitationPayload
        );

        const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.invitation.phone).toBeNull();
      });

      it('should expose email from the invitation row on the response', async () => {
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123'
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
          mockInvitation as MockInvitationPayload
        );

        const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.invitation.email).toBe('sarah@example.com');
      });
    });
  });

  describe('error cases', () => {
    it('should return 404 when invitation not found', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should return 500 when package is missing from invitation', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationNoPackage = {
        ...mockInvitation,
        package: null
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationNoPackage as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('No package associated with invitation');
    });

    it('should handle database errors gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValueOnce(
        new Error('Database connection error')
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
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

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('edge cases', () => {
    it('should handle empty sections array gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationEmpty = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: null,
          packageServices: []
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationEmpty as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should still have the Personal Information section.
      // Phase 7 Stage 1 §3.3: a synthetic Review & Submit entry is also
      // appended unconditionally, so the empty-package response is 2 entries.
      expect(data.sections).toHaveLength(2);
      expect(data.sections[0]).toEqual({
        id: 'personal_info',
        title: 'candidate.portal.sections.personalInformation',
        type: 'personal_info',
        placement: 'services',
        status: 'not_started',
        order: 0,
        functionalityType: null
      });
      expect(data.sections[1]).toEqual({
        id: 'review_submit',
        title: 'candidate.portal.sections.reviewSubmit',
        type: 'review_submit',
        placement: 'after_services',
        status: 'not_started',
        order: 1,
        functionalityType: null,
      });
    });

    it('should handle missing customer name gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationNoCustomer = {
        ...mockInvitation,
        order: {
          ...mockInvitation.order,
          customer: null
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationNoCustomer as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.invitation.companyName).toBe('Unknown Company');
    });

    it('should handle services with null functionality type', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationWithNullType = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: null,
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Custom Service',
                functionalityType: null
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'ID Check',
                functionalityType: 'verification-idv'
              }
            }
          ]
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(
        invitationWithNullType as any
      );

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Services with null functionality type are NOT included.
      // Phase 7 Stage 1 §3.3 — the synthetic Review & Submit entry is
      // appended after the service sections, so the total is now 3.
      const sections = data.sections;
      expect(sections[0].type).toBe('personal_info');
      expect(sections[1].functionalityType).toBe('verification-idv');
      // Service with null functionality type should NOT be included
      expect(sections.length).toBe(3); // personal_info + idv + review_submit
      expect(sections[2].type).toBe('review_submit');
    });
  });
});
