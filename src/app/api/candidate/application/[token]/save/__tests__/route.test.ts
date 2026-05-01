// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/route.test.ts

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
    debug: vi.fn()
  }
}));

// Mock CandidateSessionService
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    getSession: vi.fn()
  }
}));

describe('POST /api/candidate/application/[token]/save', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: {
      sections: {
        personal_info: {
          type: 'personal_info',
          fields: [
            {
              requirementId: 'req-1',
              value: 'John',
              savedAt: '2024-01-01T00:00:00Z'
            }
          ]
        }
      }
    },
    lastAccessedAt: null
  };

  const mockSaveRequest = {
    sectionType: 'personal_info',
    sectionId: 'personal_info',
    fields: [
      {
        requirementId: 'req-2',
        value: 'Doe'
      },
      {
        requirementId: 'req-3',
        value: '1990-01-01'
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when no session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

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
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('request validation', () => {
    it('should return 400 when request body is invalid', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        // Missing required fields
        fields: []
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(invalidRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when sectionType is invalid', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'invalid_type',
        sectionId: 'section-1',
        fields: []
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(invalidRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('should accept all valid sectionType values', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValue({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const validSectionTypes = ['personal_info', 'idv', 'workflow_section', 'service_section'];

      for (const sectionType of validSectionTypes) {
        const request = new NextRequest(
          `http://localhost/api/candidate/application/${mockToken}/save`,
          {
            method: 'POST',
            body: JSON.stringify({
              sectionType,
              sectionId: 'test-section',
              fields: []
            })
          }
        );

        const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });
        expect(response.status).toBe(200);
      }
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
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

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
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

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
        status: INVITATION_STATUSES.COMPLETED
      } as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  describe('data saving', () => {
    it('should save new field data to a new section', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithNoFormData = {
        ...mockInvitation,
        formData: {}
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithNoFormData as any);
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-2', fieldKey: 'middleName' }, // Not a locked field
        { id: 'req-3', fieldKey: 'dateOfBirth' } // Not a locked field
      ] as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...invitationWithNoFormData,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.savedAt).toBeDefined();

      // Verify the update was called correctly
      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          formData: {
            sections: {
              personal_info: {
                type: 'personal_info',
                fields: [
                  {
                    requirementId: 'req-2',
                    value: 'Doe',
                    savedAt: expect.any(String)
                  },
                  {
                    requirementId: 'req-3',
                    value: '1990-01-01',
                    savedAt: expect.any(String)
                  }
                ]
              }
            }
          },
          lastAccessedAt: expect.any(Date)
        }
      });
    });

    it('should update existing field data in an existing section', async () => {
      // Mock DSXRequirement for personal_info fields
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-2', fieldKey: 'middleName' }, // Not a locked field
        { id: 'req-3', fieldKey: 'dateOfBirth' } // Not a locked field
      ] as any);
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const updateRequest = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: [
          {
            requirementId: 'req-1', // Existing field
            value: 'Jane' // Updated value
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(updateRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify the existing field was updated
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const field = formData.sections.personal_info.fields.find((f: any) => f.requirementId === 'req-1');
      expect(field.value).toBe('Jane');
    });

    it('should add new fields to existing section', async () => {
      // Mock DSXRequirement for personal_info fields
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'ssn' }, // Existing field - not locked
        { id: 'req-2', fieldKey: 'middleName' }, // New field - not locked
        { id: 'req-3', fieldKey: 'dateOfBirth' } // New field - not locked
      ] as any);
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify both old and new fields are present
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const fields = formData.sections.personal_info.fields;

      // Should have original field plus two new ones
      expect(fields).toHaveLength(3);
      expect(fields.find((f: any) => f.requirementId === 'req-1')).toBeDefined();
      expect(fields.find((f: any) => f.requirementId === 'req-2')).toBeDefined();
      expect(fields.find((f: any) => f.requirementId === 'req-3')).toBeDefined();
    });

    it('should handle empty fields array', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const emptyRequest = {
        sectionType: 'idv',
        sectionId: 'idv',
        fields: []
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(emptyRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify the section was created even with no fields
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.idv).toBeDefined();
      expect(formData.sections.idv.type).toBe('idv');
      expect(formData.sections.idv.fields).toEqual([]);
    });

    it('should save complex field values', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const complexRequest = {
        sectionType: 'idv',
        sectionId: 'idv',
        fields: [
          {
            requirementId: 'req-array',
            value: ['option1', 'option2', 'option3'] // Array value
          },
          {
            requirementId: 'req-boolean',
            value: true // Boolean value
          },
          {
            requirementId: 'req-number',
            value: 42 // Number value
          },
          {
            requirementId: 'req-null',
            value: null // Null value
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(complexRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify complex values were saved correctly
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const fields = formData.sections.idv.fields;

      expect(fields.find((f: any) => f.requirementId === 'req-array').value).toEqual(['option1', 'option2', 'option3']);
      expect(fields.find((f: any) => f.requirementId === 'req-boolean').value).toBe(true);
      expect(fields.find((f: any) => f.requirementId === 'req-number').value).toBe(42);
      expect(fields.find((f: any) => f.requirementId === 'req-null').value).toBe(null);
    });
  });

  describe('status updates', () => {
    it('should update invitation status from sent to accessed', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const sentInvitation = {
        ...mockInvitation,
        status: INVITATION_STATUSES.SENT
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(sentInvitation as any);
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-2', fieldKey: 'middleName' }, // Not a locked field
        { id: 'req-3', fieldKey: 'dateOfBirth' } // Not a locked field
      ] as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...sentInvitation,
        ...args.data
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify status was updated
      expect(prisma.candidateInvitation.update).toHaveBeenCalledTimes(2);
      const statusUpdateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[1];
      expect(statusUpdateCall[0].data.status).toBe(INVITATION_STATUSES.ACCESSED);
    });

    it('should not update status if already accessed', async () => {
      // Mock DSXRequirement for personal_info fields
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-2', fieldKey: 'middleName' }, // Not a locked field
        { id: 'req-3', fieldKey: 'dateOfBirth' } // Not a locked field
      ] as any);
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const accessedInvitation = {
        ...mockInvitation,
        status: INVITATION_STATUSES.ACCESSED
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(accessedInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...accessedInvitation,
        ...args.data
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Should only call update once (for formData)
      expect(prisma.candidateInvitation.update).toHaveBeenCalledTimes(1);
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      expect(updateCall[0].data.status).toBeUndefined();
    });
  });

  describe('locked field filtering', () => {
    it('should filter out locked fields from personal_info section', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement to return locked field keys
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'firstName' }, // locked field
        { id: 'req-2', fieldKey: 'lastName' },  // locked field
        { id: 'req-3', fieldKey: 'email' },     // locked field
        { id: 'req-4', fieldKey: 'dateOfBirth' } // not locked
      ] as any);

      // Start with a fresh invitation without existing data
      const freshInvitation = {
        ...mockInvitation,
        formData: {} // No existing data
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(freshInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...freshInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const requestWithLockedFields = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: [
          { requirementId: 'req-1', value: 'John' },     // should be filtered
          { requirementId: 'req-2', value: 'Doe' },      // should be filtered
          { requirementId: 'req-3', value: 'john@example.com' }, // should be filtered
          { requirementId: 'req-4', value: '1990-01-01' } // should be saved
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithLockedFields)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify only non-locked field was saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.personal_info.fields;

      expect(savedFields).toHaveLength(1);
      expect(savedFields[0].requirementId).toBe('req-4');
      expect(savedFields[0].value).toBe('1990-01-01');
    });

    it('should silently ignore locked fields without throwing errors', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement to return mixed locked and unlocked fields
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'firstName' },   // locked
        { id: 'req-2', fieldKey: 'phone' },       // locked
        { id: 'req-3', fieldKey: 'phoneNumber' }, // locked (alias)
        { id: 'req-4', fieldKey: 'ssn' },         // not locked
        { id: 'req-5', fieldKey: 'gender' }       // not locked
      ] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        formData: {}
      } as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'personal_info',
            sectionId: 'personal_info',
            fields: [
              { requirementId: 'req-1', value: 'ChangedFirstName' }, // will be ignored
              { requirementId: 'req-2', value: '555-1234' },        // will be ignored
              { requirementId: 'req-3', value: '555-5678' },        // will be ignored
              { requirementId: 'req-4', value: '123-45-6789' },     // will be saved
              { requirementId: 'req-5', value: 'M' }                // will be saved
            ]
          })
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      // Should return success without errors
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.error).toBeUndefined();

      // Verify only unlocked fields were saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.personal_info.fields;

      expect(savedFields).toHaveLength(2);
      expect(savedFields.map((f: any) => f.requirementId)).toEqual(['req-4', 'req-5']);
      expect(savedFields.map((f: any) => f.value)).toEqual(['123-45-6789', 'M']);
    });

    it('should return success message when all fields are locked', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement to return only locked field keys
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'firstName' },
        { id: 'req-2', fieldKey: 'email' }
      ] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);

      const requestWithOnlyLockedFields = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: [
          { requirementId: 'req-1', value: 'John' },
          { requirementId: 'req-2', value: 'john@example.com' }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithOnlyLockedFields)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('No editable fields to save');

      // Verify no database update was made
      expect(prisma.candidateInvitation.update).not.toHaveBeenCalled();
    });

    it('should save all fields when none are locked', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement to return only unlocked field keys
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'ssn' },           // not locked
        { id: 'req-2', fieldKey: 'dateOfBirth' },   // not locked
        { id: 'req-3', fieldKey: 'middleName' },    // not locked
        { id: 'req-4', fieldKey: 'gender' },        // not locked
        { id: 'req-5', fieldKey: 'preferredName' }  // not locked
      ] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        formData: {}
      } as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const requestWithUnlockedFields = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: [
          { requirementId: 'req-1', value: '123-45-6789' },
          { requirementId: 'req-2', value: '1990-01-01' },
          { requirementId: 'req-3', value: 'Marie' },
          { requirementId: 'req-4', value: 'F' },
          { requirementId: 'req-5', value: 'Mary' }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithUnlockedFields)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify all fields were saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.personal_info.fields;

      expect(savedFields).toHaveLength(5);
      expect(savedFields.map((f: any) => f.requirementId)).toEqual([
        'req-1', 'req-2', 'req-3', 'req-4', 'req-5'
      ]);
    });

    it('should properly handle mixed locked and unlocked fields', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock complex real-world scenario with various fields
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-fname', fieldKey: 'firstName' },    // locked
        { id: 'req-lname', fieldKey: 'lastName' },     // locked
        { id: 'req-email', fieldKey: 'email' },        // locked
        { id: 'req-phone', fieldKey: 'phone' },        // locked
        { id: 'req-mname', fieldKey: 'middleName' },   // not locked
        { id: 'req-dob', fieldKey: 'dateOfBirth' },    // not locked
        { id: 'req-ssn', fieldKey: 'ssn' }             // not locked
      ] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        formData: {
          sections: {
            personal_info: {
              type: 'personal_info',
              fields: [
                // Some existing saved data
                { requirementId: 'req-ssn', value: 'OLD-SSN', savedAt: '2024-01-01T00:00:00Z' }
              ]
            }
          }
        }
      } as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'personal_info',
            sectionId: 'personal_info',
            fields: [
              { requirementId: 'req-fname', value: 'Attempted Change' },  // will be filtered
              { requirementId: 'req-lname', value: 'Attempted Change' },  // will be filtered
              { requirementId: 'req-mname', value: 'Marie' },             // will be saved
              { requirementId: 'req-dob', value: '1985-06-15' },         // will be saved
              { requirementId: 'req-ssn', value: '987-65-4321' }         // will update existing
            ]
          })
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify correct fields were saved/updated
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.personal_info.fields;

      // Should have 3 fields (2 new + 1 updated)
      expect(savedFields).toHaveLength(3);

      // Check that locked fields were not saved
      expect(savedFields.find((f: any) => f.requirementId === 'req-fname')).toBeUndefined();
      expect(savedFields.find((f: any) => f.requirementId === 'req-lname')).toBeUndefined();

      // Check that unlocked fields were saved
      expect(savedFields.find((f: any) => f.requirementId === 'req-mname')?.value).toBe('Marie');
      expect(savedFields.find((f: any) => f.requirementId === 'req-dob')?.value).toBe('1985-06-15');
      expect(savedFields.find((f: any) => f.requirementId === 'req-ssn')?.value).toBe('987-65-4321');
    });

    it('should not filter fields in non-personal_info sections', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithoutIdv = {
        ...mockInvitation,
        formData: {} // No existing idv section
      };
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithoutIdv as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const idvRequest = {
        sectionType: 'idv',
        sectionId: 'idv',
        fields: [
          { requirementId: 'req-1', value: 'firstName field value' },
          { requirementId: 'req-2', value: 'email field value' }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(idvRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify DSXRequirement.findMany was NOT called (only for personal_info)
      expect(prisma.dSXRequirement.findMany).not.toHaveBeenCalled();

      // Verify all fields were saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.idv.fields;

      expect(savedFields).toHaveLength(2);
    });

    it('should handle empty personal_info section request', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const emptyRequest = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: []
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(emptyRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Should not call DSXRequirement.findMany when fields array is empty
      expect(prisma.dSXRequirement.findMany).not.toHaveBeenCalled();

      // Should still update the section structure
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      expect(updateCall[0].data.formData.sections.personal_info).toBeDefined();
    });

    it('should handle DSXRequirement lookup failure gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement.findMany to return empty array (no requirements found)
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce({
        ...mockInvitation,
        formData: {}
      } as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify({
            sectionType: 'personal_info',
            sectionId: 'personal_info',
            fields: [
              { requirementId: 'req-unknown-1', value: 'Value1' },
              { requirementId: 'req-unknown-2', value: 'Value2' }
            ]
          })
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // When no requirements are found, all fields are considered unlocked and saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const savedFields = updateCall[0].data.formData.sections.personal_info.fields;

      expect(savedFields).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error during find', async () => {
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
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 on database error during update', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockRejectedValueOnce(
        new Error('Database update failed')
      );

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

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
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(mockSaveRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});