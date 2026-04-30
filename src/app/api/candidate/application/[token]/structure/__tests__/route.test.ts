// /GlobalRX_v2/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts

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

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);

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

      // Check sections array
      expect(data.sections).toHaveLength(6); // 1 before + 3 services (edu deduplicated) + 2 after

      // Check before_services section
      expect(data.sections[0]).toEqual({
        id: 'section-1',
        title: 'Notice of Processing',
        type: 'workflow_section',
        placement: 'before_services',
        status: 'not_started',
        order: 0,
        functionalityType: null
      });

      // Check service sections are in correct order
      expect(data.sections[1]).toEqual({
        id: 'service_idv',
        title: 'Identity Verification',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 1,
        functionalityType: 'idv'
      });

      expect(data.sections[2]).toEqual({
        id: 'service_record',
        title: 'Address History',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 2,
        functionalityType: 'record'
      });

      expect(data.sections[3]).toEqual({
        id: 'service_verification-edu',
        title: 'Education History',
        type: 'service_section',
        placement: 'services',
        status: 'not_started',
        order: 3,
        functionalityType: 'verification-edu'
      });

      // Check after_services sections
      expect(data.sections[4]).toEqual({
        id: 'section-2',
        title: 'Consent Form',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 4,
        functionalityType: null
      });

      expect(data.sections[5]).toEqual({
        id: 'section-3',
        title: 'Authorization',
        type: 'workflow_section',
        placement: 'after_services',
        status: 'not_started',
        order: 5,
        functionalityType: null
      });
    });

    it('should deduplicate services with the same functionality type', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      // Invitation with multiple edu services
      const invitationWithDuplicates = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Education Check 1',
                functionalityType: 'verification-edu'
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Education Check 2',
                functionalityType: 'verification-edu'
              }
            },
            {
              id: 'ps-3',
              service: {
                id: 'service-3',
                name: 'Education Check 3',
                functionalityType: 'verification-edu'
              }
            }
          ]
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithDuplicates as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have one education section
      const eduSections = data.sections.filter((s: any) =>
        s.functionalityType === 'verification-edu'
      );
      expect(eduSections).toHaveLength(1);
      expect(eduSections[0].title).toBe('Education History');
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
          workflow: {
            id: 'workflow-123',
            sections: []
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoWorkflow as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have service sections
      expect(data.sections.every((s: any) => s.type === 'service_section')).toBe(true);
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

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoServices as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have workflow sections
      expect(data.sections.every((s: any) => s.type === 'workflow_section')).toBe(true);
    });

    it('should maintain correct order for service sections', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      // Services in wrong order in package
      const invitationMixedOrder = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: { id: 'workflow-123', sections: [] },
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Employment Check',
                functionalityType: 'verification-emp'
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Record Check',
                functionalityType: 'record'
              }
            },
            {
              id: 'ps-3',
              service: {
                id: 'service-3',
                name: 'ID Check',
                functionalityType: 'idv'
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

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationMixedOrder as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Check that services are in the fixed order
      const serviceSections = data.sections.filter((s: any) => s.type === 'service_section');
      expect(serviceSections[0].functionalityType).toBe('idv');
      expect(serviceSections[1].functionalityType).toBe('record');
      expect(serviceSections[2].functionalityType).toBe('verification-edu');
      expect(serviceSections[3].functionalityType).toBe('verification-emp');
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

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoPackage as any);

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

      const emptyInvitation = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: { id: 'workflow-123', sections: [] },
          packageServices: []
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(emptyInvitation as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sections).toEqual([]);
    });

    it('should handle missing customer name gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123'
      });

      const invitationNoCustomerName = {
        ...mockInvitation,
        order: {
          id: 'order-123',
          customer: null
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoCustomerName as any);

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

      const invitationNullFunctionality = {
        ...mockInvitation,
        package: {
          ...mockInvitation.package,
          workflow: { id: 'workflow-123', sections: [] },
          packageServices: [
            {
              id: 'ps-1',
              service: {
                id: 'service-1',
                name: 'Some Service',
                functionalityType: null
              }
            },
            {
              id: 'ps-2',
              service: {
                id: 'service-2',
                name: 'Valid Service',
                functionalityType: 'idv'
              }
            }
          ]
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNullFunctionality as any);

      const request = new NextRequest(`http://localhost/api/candidate/application/${mockToken}/structure`);
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only include service with valid functionality type
      const serviceSections = data.sections.filter((s: any) => s.type === 'service_section');
      expect(serviceSections).toHaveLength(1);
      expect(serviceSections[0].functionalityType).toBe('idv');
    });
  });
});