// /GlobalRX_v2/src/app/api/candidate/application/[token]/fields/__tests__/route.test.ts

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

describe('GET /api/candidate/application/[token]/fields', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: {}
  };

  const mockDSXMappings = [
    {
      id: 'mapping-1',
      serviceId: 'service-1',
      locationId: 'US',
      isRequired: true,
      requirement: {
        id: 'req-1',
        name: 'First Name',
        fieldKey: 'firstName',
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'text',
          instructions: 'Enter your legal first name',
          collectionTab: 'personal_info'
        },
        documentData: null
      }
    },
    {
      id: 'mapping-2',
      serviceId: 'service-1',
      locationId: 'US',
      isRequired: false,
      requirement: {
        id: 'req-2',
        name: 'Middle Name',
        fieldKey: 'middleName',
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

  const mockServiceRequirements = [
    {
      id: 'sr-1',
      serviceId: 'service-1',
      displayOrder: 3,
      requirement: {
        id: 'req-3',
        name: 'Email Address',
        fieldKey: 'email',
        type: 'field',
        disabled: false,
        fieldData: {
          dataType: 'email',
          collectionTab: 'personal_info'
        },
        documentData: null
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when no session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('validation', () => {
    it('should return 400 when serviceId is missing', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing serviceId or countryId parameter');
    });

    it('should return 400 when countryId is missing', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Missing serviceId or countryId parameter');
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  describe('field retrieval', () => {
    it('should return location-specific fields from DSXMapping', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce(mockDSXMappings as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.fields).toHaveLength(2);
      expect(data.fields[0]).toEqual({
        requirementId: 'req-1',
        name: 'First Name',
        fieldKey: 'firstName',
        type: 'field',
        dataType: 'text',
        isRequired: true,
        instructions: 'Enter your legal first name',
        fieldData: mockDSXMappings[0].requirement.fieldData,
        documentData: null,
        displayOrder: 999 // Default for location-specific
      });
    });

    it('should return service-level requirements not in location mapping', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(mockServiceRequirements as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].requirementId).toBe('req-3');
      expect(data.fields[0].name).toBe('Email Address');
      expect(data.fields[0].displayOrder).toBe(3);
    });

    it('should combine and deduplicate location and service requirements', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Location mapping with req-1
      const locationMapping = [{
        ...mockDSXMappings[0],
        requirement: { ...mockDSXMappings[0].requirement, id: 'req-1' }
      }];

      // Service requirement also with req-1 (should be deduplicated)
      const serviceReqs = [{
        ...mockServiceRequirements[0],
        requirement: { ...mockServiceRequirements[0].requirement, id: 'req-1' }
      }];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce(locationMapping as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(serviceReqs as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have one field (deduplicated)
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].requirementId).toBe('req-1');
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

      const disabledMapping = [{
        ...mockDSXMappings[0],
        requirement: { ...mockDSXMappings[0].requirement, disabled: true }
      }];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce(disabledMapping as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have no fields (disabled requirement filtered out)
      expect(data.fields).toHaveLength(0);
    });

    it('should preserve complete fieldData and documentData', async () => {
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
        shortName: 'FN',
        instructions: 'Legal name only',
        addressConfig: { someProperty: 'value' },
        customProperty: 'should be preserved'
      };

      const complexDocumentData = {
        documentType: 'passport',
        acceptedFormats: ['pdf', 'jpg'],
        maxSize: 5000000
      };

      const mappingWithComplexData = [{
        ...mockDSXMappings[0],
        requirement: {
          ...mockDSXMappings[0].requirement,
          fieldData: complexFieldData,
          documentData: complexDocumentData
        }
      }];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce(mappingWithComplexData as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All fieldData and documentData should be preserved
      expect(data.fields[0].fieldData).toEqual(complexFieldData);
      expect(data.fields[0].documentData).toEqual(complexDocumentData);
    });

    it('should sort fields by displayOrder', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const unorderedRequirements = [
        { ...mockServiceRequirements[0], requirement: { ...mockServiceRequirements[0].requirement, id: 'req-1', name: 'Email Address' }, displayOrder: 5 },
        { ...mockServiceRequirements[0], requirement: { ...mockServiceRequirements[0].requirement, id: 'req-2', name: 'Field 2' }, displayOrder: 1 },
        { ...mockServiceRequirements[0], requirement: { ...mockServiceRequirements[0].requirement, id: 'req-3', name: 'Field 3' }, displayOrder: 3 }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(unorderedRequirements as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.fields).toHaveLength(3);
      expect(data.fields[0].name).toBe('Field 2');
      expect(data.fields[1].name).toBe('Field 3');
      expect(data.fields[2].name).toBe('Email Address');
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
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
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});