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

  describe('Phase 6 Stage 3 — record service service-level baseline filtering', () => {
    // Per spec: for record-type services, service-level (non-location-specific)
    // requirements are SKIPPED unless they are address_block. Education and
    // Employment continue to use the service-level baseline as before.
    it('skips service-level non-address_block requirements for record services', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      // service.functionalityType === 'record' triggers the filter.
      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);

      // Service-level requirements: a non-address_block (text) and an address_block.
      const recordServiceRequirements = [
        {
          ...mockServiceRequirements[0],
          requirement: {
            id: 'sr-text',
            name: 'Some Generic Text Field',
            fieldKey: 'someText',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text' },
            documentData: null
          },
          displayOrder: 1
        },
        {
          ...mockServiceRequirements[0],
          requirement: {
            id: 'sr-address',
            name: 'Residence Address',
            fieldKey: 'residenceAddress',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'address_block', addressConfig: null },
            documentData: null
          },
          displayOrder: 2
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(recordServiceRequirements as any);
      // No location mappings.
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // The text field is filtered out — only the address_block survives.
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].requirementId).toBe('sr-address');
      expect(data.fields[0].dataType).toBe('address_block');
    });

    it('keeps service-level non-address_block requirements for non-record (verification-edu) services', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      // Non-record service — baseline behavior preserved.
      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'verification-edu' } as any);

      const eduServiceRequirements = [
        {
          ...mockServiceRequirements[0],
          requirement: {
            id: 'sr-school',
            name: 'School Name',
            fieldKey: 'schoolName',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'text' },
            documentData: null
          },
          displayOrder: 1
        }
      ];

      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(eduServiceRequirements as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].requirementId).toBe('sr-school');
      expect(data.fields[0].dataType).toBe('text');
    });
  });

  describe('Phase 6 Stage 3 — subregionId support and DSX availability', () => {
    it('returns 400 when subregionId is provided but is not a UUID', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US&subregionId=not-a-uuid`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid subregionId parameter');
    });

    it('walks the ancestor chain when subregionId is provided and merges mappings across levels', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const countryId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const stateId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const countyId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);

      // Ancestor walk: county → state → country (returns null for parentId at country root)
      vi.mocked(prisma.country.findUnique)
        .mockResolvedValueOnce({ id: countyId, parentId: stateId } as any)
        .mockResolvedValueOnce({ id: stateId, parentId: countryId } as any)
        .mockResolvedValueOnce({ id: countryId, parentId: null } as any);

      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      // Country-level mapping: requires "ID Type" (not required).
      // State-level mapping: same requirement, marked required (OR-merge wins).
      // County-level: a different additional requirement.
      vi.mocked(prisma.dSXMapping.findMany)
        .mockResolvedValueOnce([
          {
            id: 'm-country',
            serviceId: 'service-1',
            locationId: countryId,
            isRequired: false,
            requirement: {
              id: 'req-id-type',
              name: 'ID Type',
              fieldKey: 'idType',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
          }
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'm-state',
            serviceId: 'service-1',
            locationId: stateId,
            isRequired: true,
            requirement: {
              id: 'req-id-type',
              name: 'ID Type',
              fieldKey: 'idType',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
          }
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'm-county',
            serviceId: 'service-1',
            locationId: countyId,
            isRequired: false,
            requirement: {
              id: 'req-county-form',
              name: 'County Form',
              fieldKey: 'countyForm',
              type: 'document',
              disabled: false,
              fieldData: { dataType: 'document' },
              documentData: { instructions: 'Fill out the county form' }
            }
          }
        ] as any);

      // No availability rows → defaults to available.
      vi.mocked(prisma.dSXAvailability.findFirst).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=${countryId}&subregionId=${countyId}`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Two unique requirements: req-id-type (OR-merged to required) and req-county-form.
      const ids = data.fields.map((f: { requirementId: string }) => f.requirementId);
      expect(ids).toContain('req-id-type');
      expect(ids).toContain('req-county-form');

      const idType = data.fields.find((f: { requirementId: string }) => f.requirementId === 'req-id-type');
      // OR-merged across country (false) + state (true) → true.
      expect(idType.isRequired).toBe(true);
    });

    it('skips additional requirements at a level where the service is unavailable', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const countryId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const stateId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);

      vi.mocked(prisma.country.findUnique)
        .mockResolvedValueOnce({ id: stateId, parentId: countryId } as any)
        .mockResolvedValueOnce({ id: countryId, parentId: null } as any);

      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      // Country-level mapping returns the address block.
      // State-level mapping would return state-specific requirements but
      // the service is unavailable at the state level → those must be skipped.
      vi.mocked(prisma.dSXMapping.findMany)
        .mockResolvedValueOnce([
          {
            id: 'm-country',
            serviceId: 'service-1',
            locationId: countryId,
            isRequired: true,
            requirement: {
              id: 'req-AB',
              name: 'Residence Address',
              fieldKey: 'residenceAddress',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'address_block', addressConfig: null },
              documentData: null
            }
          }
        ] as any)
        // State-level mappings are NOT consulted because the availability
        // check returns isAvailable: false and the loop continues.
        .mockResolvedValueOnce([]);

      // Inline implementation per Mocking Rule M3: read the locationId from
      // the args and return false only for the state, true for everything else.
      // Note: Stage-3 spec says missing rows default to available, so when we
      // do return a row we must explicitly set isAvailable=false to trigger
      // the skip logic.
      vi.mocked(prisma.dSXAvailability.findFirst).mockImplementation(async (args: { where?: { serviceId?: string; locationId?: string } } | undefined) => {
        const where = args?.where;
        if (where && where.locationId === stateId) {
          return { id: 'av-state', serviceId: where.serviceId ?? '', locationId: stateId, isAvailable: false } as never;
        }
        return null as never;
      });

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=${countryId}&subregionId=${stateId}`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Address block from country level survives — it's always returned.
      const ids = data.fields.map((f: { requirementId: string }) => f.requirementId);
      expect(ids).toContain('req-AB');
    });

    it('treats missing dsx_availability rows as available (default behavior per spec)', async () => {
      // Reset mocks whose implementations or Once-queues may leak from prior
      // tests in this file. vi.clearAllMocks (called in beforeEach) does not
      // reset implementations or unconsumed Once-queues — only resetAllMocks
      // does, and this file uses clear. The previous "skips additional
      // requirements" test queues a [] response for dSXMapping.findMany that
      // the route never consumes (because the state-level call is skipped),
      // so the leftover queue value would be returned to this test instead of
      // our intended [m-state] value.
      vi.mocked(prisma.dSXAvailability.findFirst).mockReset();
      vi.mocked(prisma.dSXMapping.findMany).mockReset();
      vi.mocked(prisma.country.findUnique).mockReset();

      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const countryId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const stateId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.country.findUnique)
        .mockResolvedValueOnce({ id: stateId, parentId: countryId } as any)
        .mockResolvedValueOnce({ id: countryId, parentId: null } as any);
      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.dSXMapping.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'm-state',
            serviceId: 'service-1',
            locationId: stateId,
            isRequired: false,
            requirement: {
              id: 'req-state-doc',
              name: 'State-Specific Document',
              fieldKey: 'stateDoc',
              type: 'document',
              disabled: false,
              fieldData: { dataType: 'document' },
              documentData: null
            }
          }
        ] as any);

      // No availability rows ANYWHERE → all levels treated as available.
      vi.mocked(prisma.dSXAvailability.findFirst).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=${countryId}&subregionId=${stateId}`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      const ids = data.fields.map((f: { requirementId: string }) => f.requirementId);
      // State-level requirement is included because the level was not marked unavailable.
      expect(ids).toContain('req-state-doc');
    });

    it('does NOT call dsx_availability when subregionId is omitted (legacy single-level call)', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'verification-edu' } as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      await GET(request, { params: Promise.resolve({ token: mockToken }) });

      // dsx_availability must not be consulted in the legacy single-level path.
      expect(prisma.dSXAvailability.findFirst).not.toHaveBeenCalled();
    });
  });

});
