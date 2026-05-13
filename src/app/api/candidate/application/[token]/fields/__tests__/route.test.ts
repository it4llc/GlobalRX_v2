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
      // TD-084 SEMANTICS CHANGE: under BR 3 the route no longer applies a
      // service-level fallback that forces isRequired=true on requirements
      // with no dsx_mappings row. The visibility carve-out for address_block
      // requirements survives — they remain in the response with isRequired
      // explicitly set to false (per architect's plan §1.4 / §3.2.1 point 8).
      // This test was previously fixtured with a non-address_block (email)
      // requirement; the rewrite swaps in an address_block to exercise the
      // visibility-preserving carve-out the new contract retains.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const addressBlockServiceRequirements = [
        {
          id: 'sr-address',
          serviceId: 'service-1',
          displayOrder: 3,
          requirement: {
            id: 'req-address',
            name: 'Residence Address',
            fieldKey: 'residenceAddress',
            type: 'field',
            disabled: false,
            fieldData: { dataType: 'address_block', addressConfig: null },
            documentData: null
          }
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(addressBlockServiceRequirements as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // TD-084 BR 3 + visibility carve-out: the address_block is still in the
      // response (visibility preserved per BR 5) but isRequired flips to false
      // (the service-level fallback no longer forces true).
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].requirementId).toBe('req-address');
      expect(data.fields[0].name).toBe('Residence Address');
      expect(data.fields[0].dataType).toBe('address_block');
      expect(data.fields[0].isRequired).toBe(false);
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
      // TD-084 BR 3 — the route no longer applies a service-level fallback
      // that forces non-address_block service-level requirements into the
      // response. The previous fixture (service-level requirements with no
      // dsx_mappings row) would yield zero fields under the new contract.
      // The rewrite fixtures dsx_mappings-backed requirements at the
      // candidate's country so the displayOrder sort is exercised against
      // real per-country mappings — which is the only path that survives
      // BR 3. The displayOrder values come from the matching
      // service_requirements rows (per the route's displayOrderByRequirementId
      // lookup), so each test row pairs a mapping with a sibling
      // service_requirements row carrying the displayOrder.
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const requirementShape = (id: string, name: string) => ({
        id,
        name,
        fieldKey: id,
        type: 'field',
        disabled: false,
        fieldData: { dataType: 'text' },
        documentData: null,
      });

      // dsx_mappings rows — these drive whether each requirement appears in
      // the response under BR 3. displayOrder is sourced from the parallel
      // service_requirements rows below.
      const mappings = [
        { id: 'm-1', serviceId: 'service-1', locationId: 'US', isRequired: false, requirement: requirementShape('req-1', 'Email Address') },
        { id: 'm-2', serviceId: 'service-1', locationId: 'US', isRequired: false, requirement: requirementShape('req-2', 'Field 2') },
        { id: 'm-3', serviceId: 'service-1', locationId: 'US', isRequired: false, requirement: requirementShape('req-3', 'Field 3') },
      ];

      // service_requirements rows — supply the displayOrder for each
      // requirement. The route's `displayOrderByRequirementId` lookup reads
      // `serviceReq.requirementId` (the foreign-key column), so each fixture
      // row carries it explicitly alongside the joined requirement object.
      const serviceReqs = [
        { id: 'sr-1', serviceId: 'service-1', requirementId: 'req-1', displayOrder: 5, requirement: requirementShape('req-1', 'Email Address') },
        { id: 'sr-2', serviceId: 'service-1', requirementId: 'req-2', displayOrder: 1, requirement: requirementShape('req-2', 'Field 2') },
        { id: 'sr-3', serviceId: 'service-1', requirementId: 'req-3', displayOrder: 3, requirement: requirementShape('req-3', 'Field 3') },
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce(mappings as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(serviceReqs as any);

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
      // TD-084 SEMANTICS CHANGE: under BR 3 the route no longer keeps
      // service-level non-address_block requirements for ANY service type
      // when there is no dsx_mappings row at the candidate's selected
      // country. The previous behavior (non-record services kept the
      // requirement at isRequired=true via the service-level fallback at
      // route.ts:331) is removed by the architect's plan §1.4. Education and
      // Employment subject/universal fields that previously flowed through
      // here are filtered out at the section component layer
      // (EducationSection.tsx:253, EmploymentSection.tsx:259) and were never
      // rendered in those sections anyway — they reach Personal Info via the
      // cross-section registry on a separate data path (out of scope per
      // TD-084 §Out of Scope / TD-052).
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      // Non-record service. Pre-TD-084: the service-level baseline kept the
      // schoolName field. Post-TD-084: BR 3 says no service-level fallback
      // for non-address_block requirements regardless of service type.
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
      // TD-084 BR 3: the non-address_block service-level requirement is no
      // longer kept (for either record or non-record services). The response
      // has zero fields.
      expect(data.fields).toHaveLength(0);
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


  // ===========================================================================
  // TD-084 — Required-Indicator Per-Country Alignment (route side)
  //
  // Spec:           docs/specs/td-084-required-indicator-per-country-alignment.md
  //                 (BR 1, BR 2, BR 3, BR 5; DoD 2, 5, 6, 9, 10)
  // Technical plan: docs/plans/td-084-technical-plan.md §1.1, §1.2, §3.2.1, §6
  //
  // Pass 1 RED tests: these tests cannot pass until the implementer
  //  - adds the `serviceIds` (repeated) query-parameter shape to the route
  //    handler (architect's plan §1.2),
  //  - replaces the per-level dsx_mappings findMany loop with the batched
  //    `serviceIds × levelIds` query and the new `orMergeMappings` helper
  //    (architect's plan §3.2.1 points 6–7), and
  //  - removes the service-level fallback that forces `isRequired: true`,
  //    keeping only the address_block visibility carve-out with
  //    `isRequired: false` (architect's plan §1.4).
  //
  // Mocking discipline notes:
  //  - vi.clearAllMocks() in the file-level beforeEach clears call history
  //    but does NOT clear unconsumed `mockResolvedValueOnce` queues. The DoD 2
  //    and DoD 5 tests below use the new `serviceIds` query shape that the
  //    route does not yet support — so the route returns 400 early, BEFORE
  //    consuming the queued Prisma mocks. Those unconsumed queues would leak
  //    into subsequent tests and silently change their outcomes. To prevent
  //    that, every TD-084 test starts with an explicit mockReset() on the
  //    Prisma mocks it depends on (matches the existing pattern at
  //    route.test.ts:855–857).
  // ===========================================================================

  // TD-084 — per-test queue reset. Vitest's `vi.clearAllMocks()` clears call
  // history but does not clear queued `mockResolvedValueOnce` values. The
  // DoD 2 / DoD 5 tests trigger a route 400 (the new `serviceIds` shape is
  // not yet supported), leaving their fixture queues unconsumed. Calling
  // mockReset on the relevant Prisma mocks at the start of every TD-084 test
  // guarantees a clean queue and predictable test isolation.
  function resetTd084PrismaMocks(): void {
    vi.mocked(prisma.candidateInvitation.findUnique).mockReset();
    vi.mocked(prisma.country.findUnique).mockReset();
    vi.mocked(prisma.service.findUnique).mockReset();
    vi.mocked(prisma.serviceRequirement.findMany).mockReset();
    vi.mocked(prisma.dSXMapping.findMany).mockReset();
    vi.mocked(prisma.dSXAvailability.findFirst).mockReset();
  }

  describe('TD-084 — required-indicator per-country alignment', () => {
    describe('Cross-service OR-merge (BR 1, DoD 2)', () => {
      it('DoD 2: route response carries isRequired=true when TWO services in the package map the same requirement at the same country with isRequired=[true,false] (OR-merge). On the Pass 1 baseline this test FAILS — the route accepts only a single serviceId query parameter and therefore cannot OR-merge across services. After the implementer adds `serviceIds` (repeated) and the batched query per architect plan §1.2 / §3.2.1, the response carries isRequired=true.', async () => {
        resetTd084PrismaMocks();
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123',
          firstName: 'Test',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 1000000)
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
        // Post-implementation: prisma.service.findMany covers the
        // `serviceIds IN (...)` lookup. Pre-implementation: prisma.service.findUnique
        // is still used for the legacy single-serviceId path. Both are stubbed
        // here so the implementer can adopt either shape without breaking this
        // test setup.
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'verification-edu' } as any);
        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

        // Two rows: same requirementId, same locationId, different serviceIds,
        // differing isRequired. The OR-fold must yield true.
        vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
          {
            id: 'm-svcA',
            serviceId: 'svc-A',
            locationId: 'US',
            isRequired: true,
            requirement: {
              id: 'req-shared',
              name: 'Shared Requirement',
              fieldKey: 'sharedReq',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
          },
          {
            id: 'm-svcB',
            serviceId: 'svc-B',
            locationId: 'US',
            isRequired: false,
            requirement: {
              id: 'req-shared',
              name: 'Shared Requirement',
              fieldKey: 'sharedReq',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
          }
        ] as any);

        // Post-implementation shape: repeated `serviceIds` query parameter
        // (architect's plan §1.2). On Pass 1 the route returns 400 ("Missing
        // serviceId or countryId parameter") because it does not yet read
        // `serviceIds`. After the implementation, the response contains the
        // OR-merged requirement at isRequired=true.
        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/fields?serviceIds=svc-A&serviceIds=svc-B&countryId=US`
        );

        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        const shared = data.fields.find((f: { requirementId: string }) => f.requirementId === 'req-shared');
        expect(shared).toBeDefined();
        // OR(true, false) = true
        expect(shared.isRequired).toBe(true);
      });
    });

    describe('Geographic-hierarchy OR-merge under the new serviceIds shape (BR 2, DoD 5)', () => {
      it('DoD 5: route response carries isRequired=true when dsx_mappings has rows at BOTH the country level and a subregion level for the same (requirementId, serviceId) with differing isRequired flags. Tested at the new `serviceIds`-aware request shape. The existing geographic-OR test at route.test.ts:669–770 covers the legacy single-serviceId shape; this new test adds explicit BR 2 coverage at the package-aware (serviceIds=…) shape required by the architect plan.', async () => {
        resetTd084PrismaMocks();
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

        // Ancestor walk: state → country.
        vi.mocked(prisma.country.findUnique)
          .mockResolvedValueOnce({ id: stateId, parentId: countryId } as any)
          .mockResolvedValueOnce({ id: countryId, parentId: null } as any);

        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);
        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

        // Geographic walk on the legacy single-serviceId path: the route
        // queries dSXMapping.findMany once per level (country, then state).
        // Country-level: isRequired=false. State-level: isRequired=true.
        // OR-fold must yield true.
        vi.mocked(prisma.dSXMapping.findMany)
          .mockResolvedValueOnce([
            {
              id: 'm-country',
              serviceId: 'svc-record-A',
              locationId: countryId,
              isRequired: false,
              requirement: {
                id: 'req-geo',
                name: 'Geo Requirement',
                fieldKey: 'geoReq',
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
              serviceId: 'svc-record-A',
              locationId: stateId,
              isRequired: true,
              requirement: {
                id: 'req-geo',
                name: 'Geo Requirement',
                fieldKey: 'geoReq',
                type: 'field',
                disabled: false,
                fieldData: { dataType: 'text' },
                documentData: null
              }
            }
          ] as any);
        // No availability rows → defaults to available at every level.
        vi.mocked(prisma.dSXAvailability.findFirst).mockResolvedValue(null);

        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/fields?serviceIds=svc-record-A&countryId=${countryId}&subregionId=${stateId}`
        );

        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        const geo = data.fields.find((f: { requirementId: string }) => f.requirementId === 'req-geo');
        expect(geo).toBeDefined();
        expect(geo.isRequired).toBe(true);
      });
    });

    describe('No service-level fallback (BR 3, DoD 6)', () => {
      it('DoD 6 (route, non-address_block): a service has a service_requirements row but NO dsx_mappings row at the country; the response does NOT include the requirement. FAILS on the Pass 1 baseline (today the route forces isRequired=true and includes it for non-record services per route.ts:323–334). PASSES after the architect plan §1.4 removes that block.', async () => {
        resetTd084PrismaMocks();
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123',
          firstName: 'Test',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 1000000)
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
        // Non-record service. Pre-TD-084: the service-level baseline kept
        // this requirement at isRequired=true. Post-TD-084: BR 3 says no
        // fallback — the requirement is absent from the response entirely.
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'verification-edu' } as any);

        const eduServiceRequirements = [
          {
            id: 'sr-degree',
            serviceId: 'service-1',
            displayOrder: 1,
            requirement: {
              id: 'req-degree-no-mapping',
              name: 'Degree Awarded',
              fieldKey: 'degreeAwarded',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
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
        // Non-address_block service-level requirement with no mapping → absent
        // from the response. BR 3 + no visibility carve-out for non-address_block.
        expect(data.fields).toHaveLength(0);
      });

      it('DoD 6 (route, isRequired=false guard): same non-address_block fixture as above — even if the implementer chose to include the requirement, it MUST carry isRequired=false (BR 3). Asserted defensively so the route cannot silently restore a pre-TD-084 isRequired=true contract.', async () => {
        resetTd084PrismaMocks();
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

        const eduServiceRequirements = [
          {
            id: 'sr-degree-2',
            serviceId: 'service-1',
            displayOrder: 1,
            requirement: {
              id: 'req-degree-no-mapping-2',
              name: 'Degree Awarded',
              fieldKey: 'degreeAwarded',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'text' },
              documentData: null
            }
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
        // If for any reason the requirement IS in the response, isRequired
        // MUST be false. (This is BR 3 — no service-level fallback that
        // forces true.)
        const degree = data.fields.find((f: { requirementId: string }) => f.requirementId === 'req-degree-no-mapping-2');
        if (degree !== undefined) {
          expect(degree.isRequired).toBe(false);
        } else {
          // The other valid outcome is that the requirement is omitted
          // entirely (the test above asserts this is the implementer's
          // chosen outcome for non-address_block).
          expect(degree).toBeUndefined();
        }
      });

      it('DoD 6 (route, address_block visibility carve-out): an address_block service-level requirement with NO dsx_mappings row at the country IS in the response (visibility preserved per BR 5) AND isRequired=false. FAILS on the Pass 1 baseline (today the carve-out forces isRequired=true for record services per route.ts:325–331).', async () => {
        resetTd084PrismaMocks();
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123',
          firstName: 'Test',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 1000000)
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);

        const addressBlockServiceRequirements = [
          {
            id: 'sr-residence',
            serviceId: 'service-1',
            displayOrder: 2,
            requirement: {
              id: 'req-residence-address',
              name: 'Residence Address',
              fieldKey: 'residenceAddress',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'address_block', addressConfig: null },
              documentData: null
            }
          }
        ];

        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(addressBlockServiceRequirements as any);
        vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);

        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=service-1&countryId=US`
        );

        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        // BR 5 (visibility preserved): the address_block IS in the response.
        expect(data.fields).toHaveLength(1);
        expect(data.fields[0].requirementId).toBe('req-residence-address');
        expect(data.fields[0].dataType).toBe('address_block');
        // BR 3 (no service-level fallback forcing true): isRequired is false.
        expect(data.fields[0].isRequired).toBe(false);
      });
    });

    describe('Per-section concrete fixtures — IDV smoke test (DoD 9)', () => {
      it('DoD 9: IDV service with an In-Country Address as a service-level requirement, country=US, no dsx_mappings row. The route returns isRequired=false for the In-Country Address (BR 3) and the field IS in the response (BR 5 visibility carve-out for address_block). Reproduces the smoke-test case that surfaced TD-084.', async () => {
        resetTd084PrismaMocks();
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123',
          firstName: 'Test',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 1000000)
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'verification-idv' } as any);

        const idvServiceRequirements = [
          {
            id: 'sr-in-country-address',
            serviceId: 'svc-idv-1',
            displayOrder: 5,
            requirement: {
              id: 'req-in-country-address',
              name: 'In-Country Address',
              fieldKey: 'inCountryAddress',
              type: 'field',
              disabled: false,
              fieldData: { dataType: 'address_block', addressConfig: null },
              documentData: null
            }
          }
        ];

        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(idvServiceRequirements as any);
        vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([]);

        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=svc-idv-1&countryId=US`
        );

        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        // The In-Country Address is in the response (visibility preserved).
        expect(data.fields).toHaveLength(1);
        expect(data.fields[0].requirementId).toBe('req-in-country-address');
        expect(data.fields[0].dataType).toBe('address_block');
        // After TD-084 the asterisk goes away: isRequired=false.
        expect(data.fields[0].isRequired).toBe(false);
      });
    });

    describe('Per-section concrete fixtures — Address History (DoD 10)', () => {
      it('DoD 10: package whose record services map the address_block requirement at the entry country with isRequired=false on every row. The route returns isRequired=false for the parent address_block, so per AddressBlockInput.tsx:327–330 (NOT modified) the per-piece asterisks do not render.', async () => {
        resetTd084PrismaMocks();
        const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
        vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
          token: mockToken,
          invitationId: 'inv-123',
          firstName: 'Test',
          status: 'accessed',
          expiresAt: new Date(Date.now() + 1000000)
        });

        vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'record' } as any);
        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

        // One mapping row at the country, isRequired=false.
        vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
          {
            id: 'm-addr-us',
            serviceId: 'svc-record-1',
            locationId: 'US',
            isRequired: false,
            requirement: {
              id: 'req-residence-address',
              name: 'Residence Address',
              fieldKey: 'residenceAddress',
              type: 'field',
              disabled: false,
              fieldData: {
                dataType: 'address_block',
                addressConfig: {
                  street1: { enabled: true, label: 'Street Address', required: true },
                  city: { enabled: true, label: 'City', required: true },
                  state: { enabled: true, label: 'State', required: true },
                  postalCode: { enabled: true, label: 'ZIP', required: true }
                }
              },
              documentData: null
            }
          }
        ] as any);

        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/fields?serviceId=svc-record-1&countryId=US`
        );

        const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

        expect(response.status).toBe(200);
        const data = await response.json();
        const addrField = data.fields.find((f: { requirementId: string }) => f.requirementId === 'req-residence-address');
        expect(addrField).toBeDefined();
        // Parent isRequired=false → no per-piece asterisk renders (downstream
        // AddressBlockInput component, untouched by TD-084).
        expect(addrField.isRequired).toBe(false);
      });
    });
  });
});
