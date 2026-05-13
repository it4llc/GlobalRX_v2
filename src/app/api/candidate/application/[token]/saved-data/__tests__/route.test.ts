// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/route.test.ts

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

describe('GET /api/candidate/application/[token]/saved-data', () => {
  const mockToken = 'test-token-123';

  const mockInvitation = {
    id: 'inv-123',
    token: mockToken,
    status: 'in_progress',
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
            },
            {
              requirementId: 'req-2',
              value: 'Doe',
              savedAt: '2024-01-01T00:01:00Z'
            },
            {
              requirementId: 'req-3',
              value: '1990-01-01',
              savedAt: '2024-01-01T00:02:00Z'
            }
          ]
        },
        idv: {
          type: 'idv',
          country: 'US',
          fields: [
            {
              requirementId: 'req-idv-1',
              value: '123-45-6789',
              savedAt: '2024-01-01T00:03:00Z'
            },
            {
              requirementId: 'req-idv-2',
              value: 'passport',
              savedAt: '2024-01-01T00:04:00Z'
            }
          ]
        },
        'service_record': {
          type: 'service_section',
          fields: [
            {
              requirementId: 'req-rec-1',
              value: '123 Main St',
              savedAt: '2024-01-01T00:05:00Z'
            }
          ]
        }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when no session exists', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce(null);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(410);
      const data = await response.json();
      expect(data.error).toBe('Invitation already completed');
    });
  });

  describe('data retrieval', () => {
    it('should return saved form data', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Check that all sections are present
      expect(data.sections).toBeDefined();
      expect(data.sections.personal_info).toBeDefined();
      expect(data.sections.idv).toBeDefined();
      expect(data.sections.service_section).toBeDefined();

      // Verify personal_info fields (without internal metadata)
      expect(data.sections.personal_info.fields).toEqual([
        { requirementId: 'req-1', value: 'John' },
        { requirementId: 'req-2', value: 'Doe' },
        { requirementId: 'req-3', value: '1990-01-01' }
      ]);

      // Verify idv fields
      expect(data.sections.idv.fields).toEqual([
        { requirementId: 'req-idv-1', value: '123-45-6789' },
        { requirementId: 'req-idv-2', value: 'passport' }
      ]);

      // Verify service section fields
      expect(data.sections.service_section.fields).toEqual([
        { requirementId: 'req-rec-1', value: '123 Main St' }
      ]);
    });

    it('should return empty sections when no data is saved', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationNoData = {
        ...mockInvitation,
        formData: {}
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNoData as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have empty sections for personal_info and idv
      expect(data.sections.personal_info).toEqual({ fields: [] });
      expect(data.sections.idv).toEqual({ fields: [] });
    });

    it('should handle null formData gracefully', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationNullData = {
        ...mockInvitation,
        formData: null
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationNullData as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should have empty sections
      expect(data.sections.personal_info).toEqual({ fields: [] });
      expect(data.sections.idv).toEqual({ fields: [] });
    });

    it('should group fields by section type', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithMultipleSections = {
        ...mockInvitation,
        formData: {
          sections: {
            'section-1': {
              type: 'workflow_section',
              fields: [
                { requirementId: 'req-w-1', value: 'value1' }
              ]
            },
            'section-2': {
              type: 'workflow_section',
              fields: [
                { requirementId: 'req-w-2', value: 'value2' }
              ]
            },
            'service_verification-idv': {
              type: 'service_section',
              fields: [
                { requirementId: 'req-s-1', value: 'value3' }
              ]
            },
            'service_record': {
              type: 'service_section',
              fields: [
                { requirementId: 'req-s-2', value: 'value4' }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithMultipleSections as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Phase 6 Stage 4 (BR 8 / DoD #3): workflow-section sections are now
      // returned as a per-section bucket keyed by workflow_sections.id with
      // shape `{ type: 'workflow_section', acknowledged: boolean }`. The
      // legacy "grouped by section type" `data.sections.workflow_section`
      // shape no longer exists. The two workflow sections appear under their
      // own UUID keys; neither is acknowledged because the saved values are
      // plain strings, not the `{ acknowledged: true }` object form.
      expect(data.sections['section-1']).toEqual({
        type: 'workflow_section',
        acknowledged: false
      });
      expect(data.sections['section-2']).toEqual({
        type: 'workflow_section',
        acknowledged: false
      });

      // Service sections continue to use the legacy "grouped by section type"
      // shape — both `service_verification-idv` and `service_record` fall through to the
      // `service_section` bucket.
      expect(data.sections.service_section.fields).toHaveLength(2);
      expect(data.sections.service_section.fields).toContainEqual({ requirementId: 'req-s-1', value: 'value3' });
      expect(data.sections.service_section.fields).toContainEqual({ requirementId: 'req-s-2', value: 'value4' });
    });

    it('should exclude internal metadata from returned fields', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithMetadata = {
        ...mockInvitation,
        formData: {
          sections: {
            personal_info: {
              type: 'personal_info',
              lastModified: '2024-01-01T00:00:00Z', // Internal metadata
              version: 2, // Internal metadata
              fields: [
                {
                  requirementId: 'req-1',
                  value: 'John',
                  savedAt: '2024-01-01T00:00:00Z', // Internal metadata
                  savedBy: 'system', // Internal metadata
                  retryCount: 1 // Internal metadata
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithMetadata as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only return requirementId and value, no metadata
      expect(data.sections.personal_info.fields).toEqual([
        { requirementId: 'req-1', value: 'John' }
      ]);

      // Verify metadata is not included
      expect(data.sections.personal_info.fields[0].savedAt).toBeUndefined();
      expect(data.sections.personal_info.fields[0].savedBy).toBeUndefined();
      expect(data.sections.personal_info.fields[0].retryCount).toBeUndefined();
    });

    it('should handle complex field values', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithComplexValues = {
        ...mockInvitation,
        formData: {
          sections: {
            idv: {
              type: 'idv',
              fields: [
                {
                  requirementId: 'req-array',
                  value: ['option1', 'option2', 'option3'] // Array value
                },
                {
                  requirementId: 'req-object',
                  value: { street: '123 Main St', city: 'Anytown' } // Object value
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
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithComplexValues as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // All value types should be preserved
      expect(data.sections.idv.fields).toEqual([
        { requirementId: 'req-array', value: ['option1', 'option2', 'option3'] },
        { requirementId: 'req-object', value: { street: '123 Main St', city: 'Anytown' } },
        { requirementId: 'req-boolean', value: true },
        { requirementId: 'req-number', value: 42 },
        { requirementId: 'req-null', value: null }
      ]);
    });

    it('should handle sections with no fields array', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const invitationWithMalformedSection = {
        ...mockInvitation,
        formData: {
          sections: {
            personal_info: {
              type: 'personal_info'
              // Missing fields array
            },
            idv: {
              type: 'idv',
              fields: null // Null fields
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(invitationWithMalformedSection as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return empty arrays for malformed sections
      expect(data.sections.personal_info.fields).toEqual([]);
      expect(data.sections.idv.fields).toEqual([]);
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
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
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});