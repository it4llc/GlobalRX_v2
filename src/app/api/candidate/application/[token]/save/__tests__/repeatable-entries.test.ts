// /GlobalRX_v2/src/app/api/candidate/application/[token]/save/__tests__/repeatable-entries.test.ts
// Pass 1 tests for Phase 6 Stage 2: Save API extensions for repeatable entries

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { z } from 'zod';

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

// Define the schema that should be implemented
const repeatableSaveRequestSchema = z.object({
  sectionType: z.enum(['education', 'employment']),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string())
      ])
    }))
  }))
});

describe('POST /api/candidate/application/[token]/save - Repeatable Entries', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: INVITATION_STATUSES.ACCESSED,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    formData: {
      sections: {
        personal_info: {
          type: 'personal_info',
          fields: []
        }
      }
    },
    lastAccessedAt: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('education section saving', () => {
    it('should save education entries with entries array structure', async () => {
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

      const educationRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: '550e8400-e29b-41d4-a716-446655440002',
            entryOrder: 0,
            fields: [
              {
                requirementId: '550e8400-e29b-41d4-a716-446655440003',
                value: 'Harvard University'
              },
              {
                requirementId: '550e8400-e29b-41d4-a716-446655440004',
                value: '2018-09-01'
              }
            ]
          },
          {
            entryId: '550e8400-e29b-41d4-a716-446655440005',
            countryId: '550e8400-e29b-41d4-a716-446655440006',
            entryOrder: 1,
            fields: [
              {
                requirementId: '550e8400-e29b-41d4-a716-446655440003',
                value: 'MIT'
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(educationRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify the update was called with entries structure
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.education).toBeDefined();
      expect(formData.sections.education.entries).toHaveLength(2);
      expect(formData.sections.education.entries[0].entryId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(formData.sections.education.entries[1].entryId).toBe('550e8400-e29b-41d4-a716-446655440005');
    });

    it('should replace all education entries on save (whole-section replacement)', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithExistingEducation = {
        ...mockInvitation,
        formData: {
          sections: {
            education: {
              entries: [
                {
                  entryId: 'old-entry-1',
                  countryId: 'old-country-1',
                  entryOrder: 0,
                  fields: [{ requirementId: 'old-req-1', value: 'Old University' }]
                },
                {
                  entryId: 'old-entry-2',
                  countryId: 'old-country-2',
                  entryOrder: 1,
                  fields: [{ requirementId: 'old-req-2', value: 'Another Old University' }]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithExistingEducation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...invitationWithExistingEducation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      // Send only one new entry - should replace all existing entries
      const replacementRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: '550e8400-e29b-41d4-a716-446655440002',
            entryOrder: 0,
            fields: [
              {
                requirementId: '550e8400-e29b-41d4-a716-446655440003',
                value: 'New University'
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(replacementRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify old entries were completely replaced
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.education.entries).toHaveLength(1);
      expect(formData.sections.education.entries[0].entryId).toBe('550e8400-e29b-41d4-a716-446655440001');
      // Old entries should not exist
      expect(formData.sections.education.entries.find((e: any) => e.entryId === 'old-entry-1')).toBeUndefined();
      expect(formData.sections.education.entries.find((e: any) => e.entryId === 'old-entry-2')).toBeUndefined();
    });

    it('should handle empty entries array for education', async () => {
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

      const emptyEntriesRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: []
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(emptyEntriesRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify empty entries array is saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.education).toBeDefined();
      expect(formData.sections.education.entries).toEqual([]);
    });
  });

  describe('employment section saving', () => {
    it('should save employment entries with entries array structure', async () => {
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

      const employmentRequest = {
        sectionType: 'employment',
        sectionId: 'employment',
        entries: [
          {
            entryId: '650e8400-e29b-41d4-a716-446655440001',
            countryId: '650e8400-e29b-41d4-a716-446655440002',
            entryOrder: 0,
            fields: [
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440003',
                value: 'Google Inc.'
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440004',
                value: 'Software Engineer'
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440005',
                value: '2020-01-01'
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440006',
                value: true // Currently employed
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(employmentRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Verify the employment entry was saved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.employment).toBeDefined();
      expect(formData.sections.employment.entries).toHaveLength(1);
      expect(formData.sections.employment.entries[0].fields).toHaveLength(4);
    });

    it('should preserve entry order for multiple employment entries', async () => {
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

      const multipleEmploymentRequest = {
        sectionType: 'employment',
        sectionId: 'employment',
        entries: [
          {
            entryId: '650e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: 0,
            fields: [
              { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'Current Company' }
            ]
          },
          {
            entryId: '650e8400-e29b-41d4-a716-446655440002',
            countryId: null,
            entryOrder: 1,
            fields: [
              { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'Previous Company' }
            ]
          },
          {
            entryId: '650e8400-e29b-41d4-a716-446655440003',
            countryId: null,
            entryOrder: 2,
            fields: [
              { requirementId: '650e8400-e29b-41d4-a716-446655440003', value: 'First Company' }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(multipleEmploymentRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify entry order is preserved
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      expect(formData.sections.employment.entries).toHaveLength(3);
      expect(formData.sections.employment.entries[0].entryOrder).toBe(0);
      expect(formData.sections.employment.entries[1].entryOrder).toBe(1);
      expect(formData.sections.employment.entries[2].entryOrder).toBe(2);
    });
  });

  describe('backward compatibility', () => {
    it('should still accept personal_info saves with flat fields structure', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      // Mock DSXRequirement to return unlocked field keys for personal_info saves
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([
        { id: 'req-1', fieldKey: 'firstName' },
        { id: 'req-2', fieldKey: 'lastName' },
        { id: 'req-3', fieldKey: 'ssn' },
        { id: 'req-4', fieldKey: 'dateOfBirth' },
        { id: 'req-5', fieldKey: 'middleName' }
      ] as any);

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);
      vi.mocked(prisma.candidateInvitation.update).mockImplementation(async (args: any) => ({
        ...mockInvitation,
        formData: args.data.formData,
        lastAccessedAt: args.data.lastAccessedAt
      } as any));

      const personalInfoRequest = {
        sectionType: 'personal_info',
        sectionId: 'personal_info',
        fields: [
          {
            requirementId: 'req-1',
            value: 'John'
          },
          {
            requirementId: 'req-2',
            value: 'Doe'
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(personalInfoRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should still accept idv saves with flat fields structure', async () => {
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

      const idvRequest = {
        sectionType: 'idv',
        sectionId: 'idv',
        countryId: '750e8400-e29b-41d4-a716-446655440001',
        fields: [
          {
            requirementId: 'req-idv-1',
            value: '123456789'
          }
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
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should reject education save without entries field', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'education',
        sectionId: 'education',
        fields: [] // Should have entries array instead
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

    it('should reject employment save without entries field', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'employment',
        sectionId: 'employment',
        fields: [] // Should have entries array instead
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

    it('should reject entry with invalid UUID for entryId', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: 'not-a-uuid', // Invalid UUID
            countryId: '550e8400-e29b-41d4-a716-446655440002',
            entryOrder: 0,
            fields: []
          }
        ]
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

    it('should reject entry with invalid UUID for countryId', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: 'not-a-uuid', // Invalid UUID
            entryOrder: 0,
            fields: []
          }
        ]
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

    it('should accept null countryId', async () => {
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

      const validRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: null, // Null is valid
            entryOrder: 0,
            fields: []
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(validRequest)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
    });

    it('should reject entry with negative entryOrder', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: -1, // Invalid: negative number
            fields: []
          }
        ]
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

    it('should reject entry with missing entryOrder', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invalidRequest = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            // Missing entryOrder
            fields: []
          }
        ]
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
  });

  describe('complex field values in entries', () => {
    it('should save array values in entry fields', async () => {
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

      const requestWithArrays = {
        sectionType: 'education',
        sectionId: 'education',
        entries: [
          {
            entryId: '550e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: 0,
            fields: [
              {
                requirementId: '550e8400-e29b-41d4-a716-446655440003',
                value: ['Bachelor', 'Master', 'PhD'] // Array value
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithArrays)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify array was saved correctly
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const fieldValue = formData.sections.education.entries[0].fields[0].value;
      expect(fieldValue).toEqual(['Bachelor', 'Master', 'PhD']);
    });

    it('should save boolean values in entry fields', async () => {
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

      const requestWithBooleans = {
        sectionType: 'employment',
        sectionId: 'employment',
        entries: [
          {
            entryId: '650e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: 0,
            fields: [
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440003',
                value: 'Company Name'
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440004',
                value: true // Boolean for "currently employed"
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440005',
                value: false // Boolean for another field
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithBooleans)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify booleans were saved correctly
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const fields = formData.sections.employment.entries[0].fields;
      expect(fields[1].value).toBe(true);
      expect(fields[2].value).toBe(false);
    });

    it('should save number values in entry fields', async () => {
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

      const requestWithNumbers = {
        sectionType: 'employment',
        sectionId: 'employment',
        entries: [
          {
            entryId: '650e8400-e29b-41d4-a716-446655440001',
            countryId: null,
            entryOrder: 0,
            fields: [
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440003',
                value: 75000 // Salary as number
              },
              {
                requirementId: '650e8400-e29b-41d4-a716-446655440004',
                value: 40 // Hours per week
              }
            ]
          }
        ]
      };

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/save`,
        {
          method: 'POST',
          body: JSON.stringify(requestWithNumbers)
        }
      );

      const response = await POST(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);

      // Verify numbers were saved correctly
      const updateCall = vi.mocked(prisma.candidateInvitation.update).mock.calls[0];
      const formData = updateCall[0].data.formData as any;
      const fields = formData.sections.employment.entries[0].fields;
      expect(fields[0].value).toBe(75000);
      expect(fields[1].value).toBe(40);
    });
  });
});