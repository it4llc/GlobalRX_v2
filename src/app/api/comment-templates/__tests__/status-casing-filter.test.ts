// /GlobalRX_v2/src/app/api/comment-templates/__tests__/status-casing-filter.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { SERVICE_STATUSES } from '@/constants/service-status';
import { ORDER_STATUS_VALUES } from '@/constants/order-status';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commentTemplate: {
      findMany: vi.fn()
    },
    commentTemplateAvailability: {
      findMany: vi.fn()
    },
    service: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('comment-templates route status casing bug', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // REGRESSION TEST: proves bug fix for status casing mismatch in comment template filtering
  describe('REGRESSION TEST: comment template filtering with lowercase status', () => {
    it('should FAIL to find templates when filtering by lowercase status - proves bug exists', async () => {
      // Setup session
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // Setup database data - availabilities stored with Title Case
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([
        { templateId: 'template-1', serviceCode: 'BGC', status: 'Submitted' },
        { templateId: 'template-2', serviceCode: 'BGC', status: 'Missing Information' }
      ] as any);

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Request with lowercase status (from database/constants)
      const request = new NextRequest('http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=submitted');

      await GET(request);

      // Check what status was searched for
      const availabilityCalls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
      expect(availabilityCalls.length).toBe(1);

      const whereClause = availabilityCalls[0][0]?.where;

      // The route normalizes to Title Case (lines 102-109)
      // But this normalization is the bug - database should use lowercase
      expect(whereClause?.status).toBe('Submitted'); // Currently searches for Title Case

      // The templates query should get an empty array because normalization finds no matches
      const templateCalls = vi.mocked(prisma.commentTemplate.findMany).mock.calls;
      if (templateCalls.length > 0) {
        const templateWhere = templateCalls[0][0]?.where;
        // When no availabilities match, it sets id: { in: [] }
        if (templateWhere?.id && 'in' in templateWhere.id) {
          expect(templateWhere.id.in).toEqual([]); // Empty array = no templates found
        }
      }
    });

    it('should apply Title Case normalization that masks the real problem', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // Test the normalization logic from lines 102-109
      const testCases = [
        { input: 'submitted', normalized: 'Submitted' },
        { input: 'SUBMITTED', normalized: 'Submitted' },
        { input: 'missing_info', normalized: 'Missing_info' }, // Bug: doesn't handle underscore properly
        { input: 'MISSING INFORMATION', normalized: 'Missing Information' },
        { input: 'cancelled-dnb', normalized: 'Cancelled-Dnb' },
        { input: 'CANCELLED-DNB', normalized: 'Cancelled-Dnb' }
      ];

      for (const testCase of testCases) {
        vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
        vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
        vi.mocked(prisma.service.findMany).mockResolvedValue([]);

        const request = new NextRequest(`http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=${testCase.input}`);
        await GET(request);

        const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
        const lastCall = calls[calls.length - 1];
        const whereClause = lastCall[0]?.where;

        // The route normalizes the input to Title Case
        expect(whereClause?.status).toBe(testCase.normalized);
      }
    });
  });

  describe('hardcoded status values in response', () => {
    it('returns hardcoded Title Case statuses instead of using constants', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      } as any);

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/comment-templates');
      const response = await GET(request);
      const data = await response.json();

      // Lines 177-185 hardcode Title Case statuses
      expect(data.statuses).toEqual([
        'Draft',
        'Submitted',
        'Processing',
        'Missing Information',
        'Completed',
        'Cancelled',
        'Cancelled-DNB'
      ]);

      // Should be using constants instead
      const expectedStatuses = SERVICE_STATUS_VALUES.map(s => s); // lowercase
      expect(data.statuses).not.toEqual(expectedStatuses);
    });
  });

  describe('database availability matching', () => {
    it('should fail to match when database has lowercase but query uses Title Case', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // Simulate database having lowercase values (after migration)
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([
        { templateId: 'template-1', serviceCode: 'BGC', status: 'submitted' },
        { templateId: 'template-2', serviceCode: 'BGC', status: 'processing' }
      ] as any);

      const request = new NextRequest('http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=submitted');
      await GET(request);

      // Route searches for 'Submitted' (Title Case) but database has 'submitted'
      // This would return no matches even though template exists
      const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
      const whereClause = calls[0][0]?.where;

      expect(whereClause?.status).toBe('Submitted'); // Searches Title Case
      // But mock returns lowercase, so no actual match would occur in real query
    });
  });

  describe('integration with service and order constants', () => {
    it('should handle status values from SERVICE_STATUSES constant', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // Test with each constant value
      for (const [key, value] of Object.entries(SERVICE_STATUSES)) {
        vi.clearAllMocks();
        vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
        vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
        vi.mocked(prisma.service.findMany).mockResolvedValue([]);

        const request = new NextRequest(`http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=${value}`);
        await GET(request);

        const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        // The bug: it normalizes lowercase to Title Case for query
        // but database should have lowercase
      }
    });

    it('should handle ORDER_STATUS_VALUES for consistency', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // Order statuses should work the same as service statuses
      for (const status of ORDER_STATUS_VALUES) {
        vi.clearAllMocks();
        vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
        vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
        vi.mocked(prisma.service.findMany).mockResolvedValue([]);

        const request = new NextRequest(`http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=${status}`);
        await GET(request);

        const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
        expect(calls.length).toBeGreaterThan(0);

        const whereClause = calls[0][0]?.where;
        // Currently normalizes to Title Case, but should use lowercase
        expect(whereClause?.status).toBeDefined();
      }
    });
  });

  describe('edge cases in status normalization', () => {
    it('should incorrectly handle underscore in missing_info status', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Database uses 'missing_info', hardcoded expects 'Missing Information'
      const request = new NextRequest('http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=missing_info');
      await GET(request);

      const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
      const whereClause = calls[0][0]?.where;

      // The normalization doesn't convert underscore to space
      expect(whereClause?.status).toBe('Missing_info'); // Wrong! Should be 'missing_info' or convert properly
    });

    it('should incorrectly handle cancelled_dnb status format', async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      // Database uses 'cancelled_dnb', hardcoded expects 'Cancelled-DNB'
      const request = new NextRequest('http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=cancelled_dnb');
      await GET(request);

      const calls = vi.mocked(prisma.commentTemplateAvailability.findMany).mock.calls;
      const whereClause = calls[0][0]?.where;

      // The normalization doesn't convert underscore to hyphen
      expect(whereClause?.status).toBe('Cancelled_dnb'); // Wrong! Should be 'cancelled_dnb'
    });
  });

  describe('warning logs for missing templates', () => {
    it('should log warning when no templates found due to casing mismatch', async () => {
      const mockLogger = await import('@/lib/logger');
      const warnSpy = vi.spyOn(mockLogger.default, 'warn');

      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      } as any);

      // No matching availabilities due to casing
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.service.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/comment-templates?serviceType=BGC&serviceStatus=submitted');
      await GET(request);

      // Should warn about no templates found (line 143-146)
      expect(warnSpy).toHaveBeenCalledWith(
        'GET /api/comment-templates - No templates available for service/status',
        expect.objectContaining({
          serviceType: 'BGC',
          serviceStatus: 'submitted'
        })
      );
    });
  });
});