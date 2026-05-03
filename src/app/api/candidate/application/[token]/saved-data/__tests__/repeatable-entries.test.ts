// /GlobalRX_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/repeatable-entries.test.ts
// Pass 1 tests for Phase 6 Stage 2: Saved-data API extensions for repeatable entries

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
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

describe('GET /api/candidate/application/[token]/saved-data - Repeatable Entries', () => {
  const mockToken = 'test-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('education section retrieval', () => {
    it('should return education data with entries array structure', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithEducation = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            education: {
              entries: [
                {
                  entryId: '550e8400-e29b-41d4-a716-446655440001',
                  countryId: '550e8400-e29b-41d4-a716-446655440002',
                  entryOrder: 0,
                  fields: [
                    {
                      requirementId: '550e8400-e29b-41d4-a716-446655440003',
                      value: 'Harvard University',
                      savedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                      requirementId: '550e8400-e29b-41d4-a716-446655440004',
                      value: '2018-09-01',
                      savedAt: '2024-01-01T00:00:00Z'
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
                      value: 'MIT',
                      savedAt: '2024-01-01T00:00:00Z'
                    }
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithEducation as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify education section has entries array structure
      expect(data.sections.education).toBeDefined();
      expect(data.sections.education.entries).toBeDefined();
      expect(Array.isArray(data.sections.education.entries)).toBe(true);
      expect(data.sections.education.entries).toHaveLength(2);

      // Verify first entry
      const firstEntry = data.sections.education.entries[0];
      expect(firstEntry.entryId).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(firstEntry.countryId).toBe('550e8400-e29b-41d4-a716-446655440002');
      expect(firstEntry.entryOrder).toBe(0);
      expect(firstEntry.fields).toHaveLength(2);

      // Verify second entry
      const secondEntry = data.sections.education.entries[1];
      expect(secondEntry.entryId).toBe('550e8400-e29b-41d4-a716-446655440005');
      expect(secondEntry.countryId).toBe('550e8400-e29b-41d4-a716-446655440006');
      expect(secondEntry.entryOrder).toBe(1);
      expect(secondEntry.fields).toHaveLength(1);
    });

    it('should return empty entries array when education section has no entries', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationEmptyEducation = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            education: {
              entries: []
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationEmptyEducation as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sections.education).toBeDefined();
      expect(data.sections.education.entries).toEqual([]);
    });

    it('should handle education section not existing in formData', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationNoEducation = {
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
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationNoEducation as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Education section should not be included if it doesn't exist
      expect(data.sections.education).toBeUndefined();
    });
  });

  describe('employment section retrieval', () => {
    it('should return employment data with entries array structure', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithEmployment = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            employment: {
              entries: [
                {
                  entryId: '650e8400-e29b-41d4-a716-446655440001',
                  countryId: '650e8400-e29b-41d4-a716-446655440002',
                  entryOrder: 0,
                  fields: [
                    {
                      requirementId: '650e8400-e29b-41d4-a716-446655440003',
                      value: 'Google Inc.',
                      savedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                      requirementId: '650e8400-e29b-41d4-a716-446655440004',
                      value: 'Software Engineer',
                      savedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                      requirementId: '650e8400-e29b-41d4-a716-446655440005',
                      value: '2020-01-01',
                      savedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                      requirementId: '650e8400-e29b-41d4-a716-446655440006',
                      value: true, // Currently employed
                      savedAt: '2024-01-01T00:00:00Z'
                    }
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithEmployment as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify employment section has entries array structure
      expect(data.sections.employment).toBeDefined();
      expect(data.sections.employment.entries).toBeDefined();
      expect(Array.isArray(data.sections.employment.entries)).toBe(true);
      expect(data.sections.employment.entries).toHaveLength(1);

      // Verify entry details
      const entry = data.sections.employment.entries[0];
      expect(entry.entryId).toBe('650e8400-e29b-41d4-a716-446655440001');
      expect(entry.countryId).toBe('650e8400-e29b-41d4-a716-446655440002');
      expect(entry.entryOrder).toBe(0);
      expect(entry.fields).toHaveLength(4);

      // Verify boolean value is preserved
      const currentlyEmployedField = entry.fields.find((f: any) =>
        f.requirementId === '650e8400-e29b-41d4-a716-446655440006'
      );
      expect(currentlyEmployedField.value).toBe(true);
    });

    it('should return multiple employment entries in correct order', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationMultipleEmployment = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            employment: {
              entries: [
                {
                  entryId: 'entry-1',
                  countryId: null,
                  entryOrder: 0,
                  fields: [
                    { requirementId: 'req-1', value: 'Current Company', savedAt: '2024-01-01T00:00:00Z' }
                  ]
                },
                {
                  entryId: 'entry-2',
                  countryId: null,
                  entryOrder: 1,
                  fields: [
                    { requirementId: 'req-1', value: 'Previous Company', savedAt: '2024-01-01T00:00:00Z' }
                  ]
                },
                {
                  entryId: 'entry-3',
                  countryId: null,
                  entryOrder: 2,
                  fields: [
                    { requirementId: 'req-1', value: 'First Company', savedAt: '2024-01-01T00:00:00Z' }
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationMultipleEmployment as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sections.employment.entries).toHaveLength(3);
      expect(data.sections.employment.entries[0].entryOrder).toBe(0);
      expect(data.sections.employment.entries[1].entryOrder).toBe(1);
      expect(data.sections.employment.entries[2].entryOrder).toBe(2);
      expect(data.sections.employment.entries[0].fields[0].value).toBe('Current Company');
      expect(data.sections.employment.entries[1].fields[0].value).toBe('Previous Company');
      expect(data.sections.employment.entries[2].fields[0].value).toBe('First Company');
    });
  });

  describe('backward compatibility', () => {
    it('should still return personal_info with flat fields structure', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithPersonalInfo = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
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
                  savedAt: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithPersonalInfo as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Personal info should still have flat fields structure
      expect(data.sections.personal_info).toBeDefined();
      expect(data.sections.personal_info.fields).toBeDefined();
      expect(Array.isArray(data.sections.personal_info.fields)).toBe(true);
      expect(data.sections.personal_info.entries).toBeUndefined(); // No entries array
      expect(data.sections.personal_info.fields).toHaveLength(2);
    });

    it('should still return idv with flat fields structure and countryId', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithIdv = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            idv: {
              type: 'idv',
              countryId: '750e8400-e29b-41d4-a716-446655440001',
              fields: [
                {
                  requirementId: 'req-idv-1',
                  value: '123456789',
                  savedAt: '2024-01-01T00:00:00Z'
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithIdv as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // IDV should still have flat fields structure with countryId
      expect(data.sections.idv).toBeDefined();
      expect(data.sections.idv.countryId).toBe('750e8400-e29b-41d4-a716-446655440001');
      expect(data.sections.idv.fields).toBeDefined();
      expect(Array.isArray(data.sections.idv.fields)).toBe(true);
      expect(data.sections.idv.entries).toBeUndefined(); // No entries array
    });
  });

  describe('mixed section types', () => {
    it('should return both flat and entries-based sections together', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationMixed = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            personal_info: {
              type: 'personal_info',
              fields: [
                { requirementId: 'req-1', value: 'John', savedAt: '2024-01-01T00:00:00Z' }
              ]
            },
            idv: {
              type: 'idv',
              countryId: '750e8400-e29b-41d4-a716-446655440001',
              fields: [
                { requirementId: 'req-idv-1', value: '123456789', savedAt: '2024-01-01T00:00:00Z' }
              ]
            },
            education: {
              entries: [
                {
                  entryId: '550e8400-e29b-41d4-a716-446655440001',
                  countryId: '550e8400-e29b-41d4-a716-446655440002',
                  entryOrder: 0,
                  fields: [
                    { requirementId: 'req-edu-1', value: 'University', savedAt: '2024-01-01T00:00:00Z' }
                  ]
                }
              ]
            },
            employment: {
              entries: [
                {
                  entryId: '650e8400-e29b-41d4-a716-446655440001',
                  countryId: null,
                  entryOrder: 0,
                  fields: [
                    { requirementId: 'req-emp-1', value: 'Company', savedAt: '2024-01-01T00:00:00Z' }
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationMixed as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Personal info and IDV should have flat structure
      expect(data.sections.personal_info.fields).toBeDefined();
      expect(data.sections.personal_info.entries).toBeUndefined();

      expect(data.sections.idv.fields).toBeDefined();
      expect(data.sections.idv.countryId).toBe('750e8400-e29b-41d4-a716-446655440001');
      expect(data.sections.idv.entries).toBeUndefined();

      // Education and employment should have entries structure
      expect(data.sections.education.entries).toBeDefined();
      expect(data.sections.education.fields).toBeUndefined();

      expect(data.sections.employment.entries).toBeDefined();
      expect(data.sections.employment.fields).toBeUndefined();
    });
  });

  describe('complex field values in entries', () => {
    it('should return array values correctly', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithArrays = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            education: {
              entries: [
                {
                  entryId: '550e8400-e29b-41d4-a716-446655440001',
                  countryId: null,
                  entryOrder: 0,
                  fields: [
                    {
                      requirementId: 'req-1',
                      value: ['Bachelor', 'Master', 'PhD'],
                      savedAt: '2024-01-01T00:00:00Z'
                    }
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithArrays as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      const fieldValue = data.sections.education.entries[0].fields[0].value;
      expect(Array.isArray(fieldValue)).toBe(true);
      expect(fieldValue).toEqual(['Bachelor', 'Master', 'PhD']);
    });

    it('should return number and boolean values correctly', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationWithTypes = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {
            employment: {
              entries: [
                {
                  entryId: '650e8400-e29b-41d4-a716-446655440001',
                  countryId: null,
                  entryOrder: 0,
                  fields: [
                    { requirementId: 'req-1', value: 75000, savedAt: '2024-01-01T00:00:00Z' }, // number
                    { requirementId: 'req-2', value: true, savedAt: '2024-01-01T00:00:00Z' }, // boolean
                    { requirementId: 'req-3', value: false, savedAt: '2024-01-01T00:00:00Z' }, // boolean
                    { requirementId: 'req-4', value: null, savedAt: '2024-01-01T00:00:00Z' }, // null
                    { requirementId: 'req-5', value: 0, savedAt: '2024-01-01T00:00:00Z' } // zero
                  ]
                }
              ]
            }
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationWithTypes as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      const fields = data.sections.employment.entries[0].fields;
      expect(fields[0].value).toBe(75000);
      expect(fields[0].value).toEqual(expect.any(Number));
      expect(fields[1].value).toBe(true);
      expect(fields[2].value).toBe(false);
      expect(fields[3].value).toBe(null);
      expect(fields[4].value).toBe(0);
    });
  });

  describe('empty and null cases', () => {
    it('should handle null formData', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationNullFormData = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: null
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationNullFormData as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sections).toBeDefined();
      expect(data.sections.personal_info).toEqual({ fields: [] });
      expect(data.sections.idv).toEqual({ fields: [] });
    });

    it('should handle empty formData object', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationEmptyFormData = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {}
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationEmptyFormData as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sections).toBeDefined();
      expect(data.sections.personal_info).toEqual({ fields: [] });
      expect(data.sections.idv).toEqual({ fields: [] });
    });

    it('should handle formData with empty sections object', async () => {
      const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
      vi.mocked(CandidateSessionService.getSession).mockResolvedValueOnce({
        token: mockToken,
        invitationId: 'inv-123',
        firstName: 'Test',
        status: 'accessed',
        expiresAt: new Date(Date.now() + 1000000)
      });

      const mockInvitationEmptySections = {
        id: 'inv-123',
        token: mockToken,
        status: INVITATION_STATUSES.ACCESSED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        formData: {
          sections: {}
        }
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitationEmptySections as any);

      const request = new NextRequest(
        `http://localhost/api/candidate/application/${mockToken}/saved-data`
      );

      const response = await GET(request, { params: Promise.resolve({ token: mockToken }) });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.sections).toBeDefined();
      expect(data.sections.personal_info).toEqual({ fields: [] });
      expect(data.sections.idv).toEqual({ fields: [] });
    });
  });
});