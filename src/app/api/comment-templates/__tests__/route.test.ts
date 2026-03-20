// /GlobalRX_v2/src/app/api/comment-templates/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commentTemplate: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findFirst: vi.fn()
    },
    commentTemplateAvailability: {
      findMany: vi.fn().mockResolvedValue([])
    },
    service: {
      findMany: vi.fn().mockResolvedValue([])
    },
    order: {
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

describe('GET /api/comment-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock implementations that return empty arrays
    vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
    vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.service.findMany).mockResolvedValue([]);
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user is vendor', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'vendor',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when user is customer', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when internal user lacks comment_management permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should allow users with fulfillment permission when filtering by service/status', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceType=MVR&serviceStatus=SUBMITTED');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templates).toEqual([]);
    });
  });

  describe('successful retrieval', () => {
    it('should return templates, services, and statuses when user has permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      const mockTemplates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          shortName: 'Missing Doc',
          longName: 'Document Required - Customer Must Provide',
          templateText: 'Please provide [document type] for [candidate name]',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '550e8400-e29b-41d4-a716-446655440002',
          updatedBy: '550e8400-e29b-41d4-a716-446655440002',
          availabilities: []
        }
      ];

      const mockServices = [
        {
          code: 'MVR',
          name: 'Motor Vehicle Record',
          category: 'Driving',
          disabled: false
        },
        {
          code: 'CRIMINAL',
          name: 'Criminal Background',
          category: 'Background',
          disabled: false
        }
      ];

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce(mockTemplates);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce(mockServices);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].shortName).toBe('Missing Doc');
      expect(data.services).toHaveLength(2);
      expect(data.statuses).toEqual(['Draft', 'Submitted', 'Processing', 'Missing Information', 'Completed', 'Cancelled', 'Cancelled-DNB']);
    });

    it('should return empty arrays when no data exists', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.templates).toEqual([]);
      expect(data.services).toEqual([]);
      expect(data.statuses).toEqual(['Draft', 'Submitted', 'Processing', 'Missing Information', 'Completed', 'Cancelled', 'Cancelled-DNB']);
    });
  });

  // REGRESSION TEST: proves bug fix for comment template filtering by service/status
  // Bug: When no templates are configured for a service/status combo, the API incorrectly
  // returns ALL active templates instead of an empty array. Also, status normalization
  // is not using the existing formatServiceStatus() utility.
  describe('filtering by service type and status', () => {
    const mockSession = {
      user: {
        id: '1',
        userType: 'internal',
        permissions: { fulfillment: true }
      }
    };

    const mockServices = [
      {
        code: 'MVR',
        name: 'Motor Vehicle Record',
        category: 'Driving',
        disabled: false
      },
      {
        code: 'CRIMINAL',
        name: 'Criminal Background',
        category: 'Background',
        disabled: false
      }
    ];

    beforeEach(() => {
      // Set up persistent mocks for all tests in this describe block
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      // IMPORTANT: Use mockResolvedValue (not mockResolvedValueOnce) for services
      // so it persists across Promise.all calls and across multiple tests
      vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices);
      // Ensure other mocks have default values
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
    });

    it('should return ONLY templates configured for the specific service/status combination', async () => {
      // Setup: Two templates exist, but only one is configured for MVR + Submitted
      const allTemplates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          shortName: 'MVR Missing Doc',
          longName: 'MVR Document Required',
          templateText: 'Please provide driving record',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          shortName: 'Criminal Check',
          longName: 'Criminal Background Required',
          templateText: 'Criminal background check needed',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        }
      ];

      // Only template-1 is available for MVR + Submitted
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValueOnce([
        { templateId: '550e8400-e29b-41d4-a716-446655440001' }
      ]);

      // When querying for specific template IDs, return only the matching one
      vi.mocked(prisma.commentTemplate.findMany).mockImplementationOnce(async (args) => {
        if (args?.where?.id?.in) {
          return allTemplates.filter(t => args.where?.id?.in?.includes(t.id));
        }
        return allTemplates;
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceType=MVR&serviceStatus=SUBMITTED');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return ONLY the template configured for MVR + Submitted, NOT all templates
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].shortName).toBe('MVR Missing Doc');
      expect(data.templates[0].id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    // REGRESSION TEST: The main bug - when no templates match, returns ALL templates instead of empty array
    it('should return EMPTY array when NO templates are configured for the service/status combo', async () => {
      // Setup: Templates exist but NONE are configured for MVR + Submitted
      const allTemplates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          shortName: 'Criminal Check',
          longName: 'Criminal Background Required',
          templateText: 'Criminal background check needed',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          shortName: 'Education Verify',
          longName: 'Education Verification',
          templateText: 'Education verification needed',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        }
      ];

      // No templates are available for MVR + Submitted
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValueOnce([]);

      // The bug: When availableTemplateIds is empty, the code doesn't set a filter
      // This causes findMany to return ALL templates instead of none
      vi.mocked(prisma.commentTemplate.findMany).mockImplementationOnce(async (args) => {
        // Bug simulation: If no ID filter is set, the current code returns all templates
        if (!args?.where?.id) {
          // This is the BUG - returning all templates when we should return none
          return allTemplates;
        }
        // After fix: with id: { in: [] }, Prisma returns empty array
        if (args.where.id?.in?.length === 0) {
          return [];
        }
        return allTemplates.filter(t => args.where.id.in.includes(t.id));
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceType=MVR&serviceStatus=SUBMITTED');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // BUG: Currently fails because it returns all 2 templates
      // After fix: Should return empty array when no templates match the filter
      expect(data.templates).toHaveLength(0);
      expect(data.templates).toEqual([]);
    });

    // REGRESSION TEST: Status normalization should handle case mismatches
    it('should handle uppercase status "SUBMITTED" and match database "Submitted"', async () => {
      const template = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        shortName: 'MVR Doc',
        longName: 'MVR Document',
        templateText: 'Document needed',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1',
        availabilities: []
      };

      // Mock availability check - should normalize "SUBMITTED" to "Submitted"
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockImplementationOnce(async (args) => {
        // The bug fix should convert SUBMITTED to Submitted before querying
        expect(args.where.status).toBe('Submitted');
        expect(args.where.serviceCode).toBe('MVR');
        return [{ templateId: '550e8400-e29b-41d4-a716-446655440005' }];
      });

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([template]);

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceType=MVR&serviceStatus=SUBMITTED');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templates).toHaveLength(1);

      // Verify the availability query was called with normalized status
      expect(prisma.commentTemplateAvailability.findMany).toHaveBeenCalledWith({
        where: {
          serviceCode: 'MVR',
          status: 'Submitted' // Should be normalized from SUBMITTED
        },
        select: {
          templateId: true
        }
      });
    });

    it('should handle special case status "MISSING INFORMATION" and normalize to "Missing Information"', async () => {
      const template = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        shortName: 'Missing Info',
        longName: 'Missing Information Required',
        templateText: 'Information needed',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1',
        availabilities: []
      };

      // Mock availability check - should normalize "MISSING INFORMATION" to "Missing Information"
      vi.mocked(prisma.commentTemplateAvailability.findMany).mockImplementationOnce(async (args) => {
        // The bug fix should convert MISSING INFORMATION to Missing Information
        expect(args.where.status).toBe('Missing Information');
        expect(args.where.serviceCode).toBe('CRIMINAL');
        return [{ templateId: '550e8400-e29b-41d4-a716-446655440006' }];
      });

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([template]);

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceType=CRIMINAL&serviceStatus=MISSING INFORMATION');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templates).toHaveLength(1);

      // Verify the availability query was called with normalized status
      expect(prisma.commentTemplateAvailability.findMany).toHaveBeenCalledWith({
        where: {
          serviceCode: 'CRIMINAL',
          status: 'Missing Information' // Should be normalized from MISSING INFORMATION
        },
        select: {
          templateId: true
        }
      });
    });

    it('should filter by serviceStatus only when serviceType is not provided', async () => {
      const templates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440007',
          shortName: 'Processing Template',
          longName: 'Processing Status Template',
          templateText: 'Processing status text',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        }
      ];

      // When only serviceStatus is provided (no serviceType), should return all active templates
      // This is current behavior - not filtering by status alone
      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce(templates);
      // Don't override the services mock - it's already set up in beforeEach

      const request = new NextRequest('http://localhost:3000/api/comment-templates?serviceStatus=PROCESSING');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Currently returns all active templates when only status is provided
      expect(data.templates).toHaveLength(1);

      // Availability query should NOT be called when serviceType is missing
      expect(prisma.commentTemplateAvailability.findMany).not.toHaveBeenCalled();
    });

    it('should return all active templates when no filter parameters provided', async () => {
      const allTemplates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440008',
          shortName: 'Template 1',
          longName: 'First Template',
          templateText: 'First template text',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440009',
          shortName: 'Template 2',
          longName: 'Second Template',
          templateText: 'Second template text',
          isActive: true,
          hasBeenUsed: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '1',
          updatedBy: '1',
          availabilities: []
        }
      ];

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce(allTemplates);
      // Don't override the services mock - it's already set up in beforeEach

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should return all active templates for template management UI
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].shortName).toBe('Template 1');
      expect(data.templates[1].shortName).toBe('Template 2');

      // Should NOT call availability query when no filters
      expect(prisma.commentTemplateAvailability.findMany).not.toHaveBeenCalled();
    });

    it('should handle database-stored mixed case statuses correctly', async () => {
      const template = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        shortName: 'Mixed Case',
        longName: 'Mixed Case Template',
        templateText: 'Template for mixed case',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1',
        availabilities: []
      };

      // Test various case formats that might come from frontend
      const testCases = [
        { input: 'PROCESSING', expected: 'Processing' },
        { input: 'processing', expected: 'Processing' },
        { input: 'CANCELLED-DNB', expected: 'Cancelled-Dnb' },  // Current normalization behavior
        { input: 'cancelled-dnb', expected: 'Cancelled-Dnb' },
        { input: 'DRAFT', expected: 'Draft' },
        { input: 'COMPLETED', expected: 'Completed' }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        // Reset default mocks
        vi.mocked(prisma.commentTemplate.findMany).mockResolvedValue([]);
        vi.mocked(prisma.commentTemplateAvailability.findMany).mockResolvedValue([]);
        vi.mocked(prisma.service.findMany).mockResolvedValue(mockServices);

        vi.mocked(getServerSession).mockResolvedValue(mockSession);

        vi.mocked(prisma.commentTemplateAvailability.findMany).mockImplementationOnce(async (args) => {
          expect(args.where.status).toBe(testCase.expected);
          return [{ templateId: '550e8400-e29b-41d4-a716-446655440010' }];
        });

        vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([template]);

        const request = new NextRequest(`http://localhost:3000/api/comment-templates?serviceType=MVR&serviceStatus=${testCase.input}`);
        const response = await GET(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.templates).toHaveLength(1);
      }
    });
  });
});

describe('POST /api/comment-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user is vendor', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'vendor',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when internal user lacks comment_management permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('validation', () => {
    const mockSession = {
      user: {
        id: '1',
        type: 'internal',
        permissions: { comment_management: true }
      }
    };

    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    });

    it('should return 400 when shortName is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when longName is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when templateText is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when shortName exceeds 50 characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'a'.repeat(51),
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when duplicate shortName exists', async () => {
      vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce({
        id: '550e8400-e29b-41d4-a716-446655440003',
        shortName: 'Test',
        longName: 'Existing Template',
        templateText: 'Existing text',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1'
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('A template with this short name already exists');
    });
  });

  describe('successful creation', () => {
    it('should create template successfully with valid data', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);

      const newTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        shortName: 'New Template',
        longName: 'New Template Long Name',
        templateText: 'Template text with [placeholder]',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1'
      };

      vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
        ...newTemplate,
        availabilities: []
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'New Template',
          longName: 'New Template Long Name',
          templateText: 'Template text with [placeholder]'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.shortName).toBe('New Template');
      expect(data.longName).toBe('New Template Long Name');
      expect(data.templateText).toBe('Template text with [placeholder]');

      expect(prisma.commentTemplate.create).toHaveBeenCalledWith({
        data: {
          shortName: 'New Template',
          longName: 'New Template Long Name',
          templateText: 'Template text with [placeholder]',
          createdBy: '1',
          updatedBy: '1'
        },
        include: {
          availabilities: true
        }
      });
    });
  });
});