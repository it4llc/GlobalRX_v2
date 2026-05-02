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
            functionalityType: 'idv'
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
      expect(data.invitation).toEqual({
        firstName: 'Sarah',
        lastName: 'Johnson',
        status: 'accessed',
        expiresAt: mockInvitation.expiresAt.toISOString(),
        companyName: 'Acme Corp'
      });

      // Check sections array - now includes Personal Information as first item
      expect(data.sections).toHaveLength(7); // 1 personal + 1 before + 3 services (edu deduplicated) + 2 after

      // Check before_services section comes first
      expect(data.sections[0]).toEqual({
        id: 'section-1',
        title: 'Notice of Processing',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null
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
        id: 'service_idv',
        title: 'candidate.portal.sections.identityVerification',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 2,
        functionalityType: 'idv',
        serviceIds: ['service-1']
      });

      expect(data.sections[3]).toEqual({
        id: 'service_record',
        title: 'candidate.portal.sections.addressHistory',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 3,
        functionalityType: 'record',
        serviceIds: ['service-2']
      });

      expect(data.sections[4]).toEqual({
        id: 'service_verification-edu',
        title: 'candidate.portal.sections.educationHistory',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 4,
        functionalityType: 'verification-edu',
        serviceIds: ['service-3', 'service-4']
      });

      // Check after_services sections
      expect(data.sections[5]).toEqual({
        id: 'section-2',
        title: 'Consent Form',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 5,
        functionalityType: null
      });

      expect(data.sections[6]).toEqual({
        id: 'section-3',
        title: 'Authorization',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 6,
        functionalityType: null
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
                functionalityType: 'idv'
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Identity Verification Service 2',
                functionalityType: 'idv'
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
        s.functionalityType === 'idv' && s.type === 'service_section'
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

      // Should have personal info and service sections only (no workflow sections)
      expect(data.sections[0].type).toBe('personal_info');
      expect(data.sections.slice(1).every((s: any) => s.type === 'service_section')).toBe(true);
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
      // With no services, should have: 1 before_services + 1 personal_info + 2 after_services = 4 sections
      expect(data.sections).toHaveLength(4);
      expect(data.sections[0].type).toBe('workflow_section'); // before_services
      expect(data.sections[1].type).toBe('personal_info');
      expect(data.sections[2].type).toBe('workflow_section'); // after_services
      expect(data.sections[3].type).toBe('workflow_section'); // after_services
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
                functionalityType: 'idv'
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
      expect(data.sections[1].functionalityType).toBe('idv');
      expect(data.sections[2].functionalityType).toBe('record');
      expect(data.sections[3].functionalityType).toBe('verification-edu');
      expect(data.sections[4].functionalityType).toBe('verification-emp');
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
      // Should still have the Personal Information section
      expect(data.sections).toHaveLength(1);
      expect(data.sections[0]).toEqual({
        id: 'personal_info',
        title: 'candidate.portal.sections.personalInformation',
        type: 'personal_info',
        placement: 'services',
        status: 'not_started',
        order: 0,
        functionalityType: null
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
                functionalityType: 'idv'
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

      // Services with null functionality type are NOT included
      const sections = data.sections;
      expect(sections[0].type).toBe('personal_info');
      expect(sections[1].functionalityType).toBe('idv');
      // Service with null functionality type should NOT be included
      expect(sections.length).toBe(2); // Only personal_info and idv
    });
  });
});