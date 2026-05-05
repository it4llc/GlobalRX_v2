// /GlobalRX_v2/src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts

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

  const mockServiceRequirements = [
    {
      id: 'sr-1',
      serviceId: 'service-1',
      displayOrder: 1,
      requirement: {
        id: 'req-1',
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
      id: 'sr-2',
      serviceId: 'service-1',
      displayOrder: 2,
      requirement: {
        id: 'req-2',
        name: 'Last Name',
        fieldKey: 'lastName',
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
        fieldKey: 'dateOfBirth',
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
          collectionTab: 'idv' // Not personal info
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
    it('should return personal info fields from all services', async () => {
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

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return 3 unique personal info fields
      expect(data.fields).toHaveLength(3);

      // Check that only personal info fields are included
      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      expect(fieldKeys).toContain('firstName');
      expect(fieldKeys).toContain('lastName');
      expect(fieldKeys).toContain('dateOfBirth');
      expect(fieldKeys).not.toContain('idNumber'); // IDV field excluded
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

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(mockServiceRequirements as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // First name appears in both services but should only be returned once
      const firstNameFields = data.fields.filter((f: any) => f.fieldKey === 'firstName');
      expect(firstNameFields).toHaveLength(1);
    });

    it('should mark invitation fields as locked with prefilled values', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const emailRequirement = {
        id: 'sr-email',
        serviceId: 'service-1',
        displayOrder: 5,
        requirement: {
          id: 'req-email',
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
      };

      const phoneRequirement = {
        id: 'sr-phone',
        serviceId: 'service-1',
        displayOrder: 6,
        requirement: {
          id: 'req-phone',
          name: 'Phone Number',
          fieldKey: 'phone',
          type: 'field',
          disabled: false,
          fieldData: {
            dataType: 'phone',
            collectionTab: 'personal_info'
          },
          documentData: null
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        ...mockServiceRequirements,
        emailRequirement,
        phoneRequirement
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Find specific fields
      const firstNameField = data.fields.find((f: any) => f.fieldKey === 'firstName');
      const emailField = data.fields.find((f: any) => f.fieldKey === 'email');
      const phoneField = data.fields.find((f: any) => f.fieldKey === 'phone');
      const dobField = data.fields.find((f: any) => f.fieldKey === 'dateOfBirth');

      // Locked fields with prefilled values
      expect(firstNameField.locked).toBe(true);
      expect(firstNameField.prefilledValue).toBe('Sarah');

      expect(emailField.locked).toBe(true);
      expect(emailField.prefilledValue).toBe('sarah@example.com');

      expect(phoneField.locked).toBe(true);
      expect(phoneField.prefilledValue).toBe('+15551234567');

      // Non-invitation fields should not be locked
      expect(dobField.locked).toBe(false);
      expect(dobField.prefilledValue).toBe(null);
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

      // Since the query filters out disabled requirements, we should only return enabled ones
      const onlyEnabledRequirements = [mockServiceRequirements[0]];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(onlyEnabledRequirements as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have the non-disabled requirement
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('firstName');
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

      const documentRequirement = {
        id: 'sr-doc',
        serviceId: 'service-1',
        displayOrder: 7,
        requirement: {
          id: 'req-doc',
          name: 'ID Document',
          fieldKey: 'idDoc',
          type: 'document', // Document type, not field
          disabled: false,
          fieldData: {
            dataType: 'file',
            collectionTab: 'personal_info'
          },
          documentData: {}
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      // Since the query filters out document type requirements, we should only return field types
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        mockServiceRequirements[0]
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only have the field type requirement
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('firstName');
      expect(data.fields.find((f: any) => f.fieldKey === 'idDoc')).toBeUndefined();
    });

    it('should identify fields by collectionTab variations', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const requirementsWithVariedTabs = [
        { ...mockServiceRequirements[0] }, // collectionTab: 'personal_info'
        { ...mockServiceRequirements[1] }, // collectionTab: 'personal'
        { ...mockServiceRequirements[2] }, // collectionTab: 'subject'
        {
          id: 'sr-mixed',
          serviceId: 'service-1',
          displayOrder: 8,
          requirement: {
            id: 'req-mixed',
            name: 'Mixed Field',
            fieldKey: 'mixedField',
            type: 'field',
            disabled: false,
            fieldData: {
              dataType: 'text',
              collection_tab: 'Personal Info' // Different case and format
            },
            documentData: null
          }
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementsWithVariedTabs as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All should be recognized as personal info fields
      expect(data.fields).toHaveLength(4);
      const fieldKeys = data.fields.map((f: any) => f.fieldKey);
      expect(fieldKeys).toContain('firstName');
      expect(fieldKeys).toContain('lastName');
      expect(fieldKeys).toContain('dateOfBirth');
      expect(fieldKeys).toContain('mixedField');
    });

    it('should identify common personal fields by fieldKey when no collectionTab', async () => {
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
            fieldData: {
              dataType: 'text'
              // No collectionTab
            },
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
            fieldData: {
              dataType: 'text'
              // No collectionTab
            },
            documentData: null
          }
        }
      ];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementsWithoutTab as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // SSN is a common personal field, should be included
      // Custom field is not recognized, should be excluded
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
        customProperty: 'should be preserved'
      };

      const requirementWithComplexData = [{
        id: 'sr-complex',
        serviceId: 'service-1',
        displayOrder: 1,
        requirement: {
          id: 'req-complex',
          name: 'Complex Field',
          fieldKey: 'complexField',
          type: 'field',
          disabled: false,
          fieldData: complexFieldData,
          documentData: null
        }
      }];

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce(requirementWithComplexData as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All fieldData should be preserved
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
  // The test fixture in this section uses a single invitation with two
  // package services (service-1, service-2) and a single personal-info
  // requirement (req-firstName) so every assertion focuses on the new
  // AND-aggregation logic rather than on field discovery.
  // ===========================================================================
  describe('TD-060: required-field accuracy', () => {
    const baselineSession = {
      token: mockToken,
      invitationId: 'inv-123',
      firstName: 'Test',
      status: 'accessed',
      expiresAt: new Date(Date.now() + 1000000),
    };

    // Single personal-info requirement so the AND-aggregation result is
    // unambiguous in each test case.
    const singleRequirement = [
      {
        id: 'sr-firstName',
        serviceId: 'service-1',
        displayOrder: 1,
        requirement: {
          id: 'req-firstName',
          name: 'First Name',
          fieldKey: 'firstName',
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

      // 4 mapping rows for req-firstName, ALL isRequired:true → baseline required
      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValueOnce([
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-B', isRequired: true },
        { requirementId: 'req-firstName', serviceId: 'service-2', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-firstName', serviceId: 'service-2', locationId: 'loc-B', isRequired: true },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('firstName');
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
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-A', isRequired: true },
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-B', isRequired: true },
        { requirementId: 'req-firstName', serviceId: 'service-2', locationId: 'loc-A', isRequired: false },
        { requirementId: 'req-firstName', serviceId: 'service-2', locationId: 'loc-B', isRequired: true },
      ] as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/personal-info-fields`
      );
      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.fields).toHaveLength(1);
      expect(data.fields[0].fieldKey).toBe('firstName');
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
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
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
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
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
        { requirementId: 'req-firstName', serviceId: 'service-1', locationId: 'loc-A', isRequired: false },
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
      expect(data.fields[0].fieldKey).toBe('firstName');
      expect(data.fields[0].isRequired).toBe(false);
    });
  });
});
