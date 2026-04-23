// /GlobalRX_v2/src/app/api/workflows/[id]/sections/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Import mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('GET /api/workflows/[id]/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections');
      const response = await GET(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks customer_config.view permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections');
      const response = await GET(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('success', () => {
    it('should return sections grouped by placement and sorted by displayOrder', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockImplementation((user, resource, action) => {
        return resource === 'customer_config' && action === 'view';
      });

      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow'
      } as any);

      const mockSections = [
        {
          id: '1',
          workflowId: '123',
          name: 'Section 1',
          placement: 'before_services',
          type: 'text',
          content: 'Content 1',
          displayOrder: 0,
          isRequired: true,
          fileUrl: null,
          fileName: null
        },
        {
          id: '2',
          workflowId: '123',
          name: 'Section 2',
          placement: 'after_services',
          type: 'document',
          displayOrder: 0,
          isRequired: false,
          fileUrl: 'uploads/test.pdf',
          fileName: 'test.pdf'
        }
      ];

      vi.mocked(prisma.workflowSection.findMany).mockResolvedValueOnce(mockSections as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections');
      const response = await GET(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sections).toHaveLength(2);
      expect(data.metadata.beforeServicesCount).toBe(1);
      expect(data.metadata.afterServicesCount).toBe(1);
      expect(data.metadata.maxPerPlacement).toBe(10);
    });

    it('should return 404 when workflow not found', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections');
      const response = await GET(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Workflow not found');
    });
  });
});

describe('POST /api/workflows/[id]/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks customer_config.edit permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0); // No active orders
      vi.mocked(prisma.workflowSection.count).mockResolvedValue(0); // No sections yet
    });

    it('should return 400 when required fields are missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 400 when placement is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'invalid_placement',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 400 when type is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'invalid_type',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });

  describe('business rules', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
    });

    it('should return 409 when workflow has active orders', async () => {
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2); // Has active orders

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Cannot modify workflow with active orders');
    });

    it('should return 409 when placement has reached 10-section limit', async () => {
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0); // No active orders
      vi.mocked(prisma.workflowSection.count).mockResolvedValueOnce(10); // At limit

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Section limit reached');
      expect(data.message).toContain('Maximum 10 sections allowed');
    });
  });

  describe('success', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
      vi.mocked(prisma.workflowSection.count).mockResolvedValue(5); // Under limit
    });

    it('should create a section with correct defaults', async () => {
      // No need to mock findFirst here since we're providing displayOrder explicitly
      vi.mocked(prisma.workflowSection.create).mockResolvedValueOnce({
        id: 'new-section',
        workflowId: '123',
        name: 'Test Section',
        placement: 'before_services',
        type: 'text',
        content: null,
        displayOrder: 0,
        isRequired: true,
        fileUrl: null,
        fileName: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text',
          displayOrder: 0
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Test Section');
      expect(data.placement).toBe('before_services');
      expect(data.type).toBe('text');
      expect(data.isRequired).toBe(true);
    });

    it('should auto-assign displayOrder when not provided', async () => {
      vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
        displayOrder: 3
      } as any); // Highest existing order is 3

      vi.mocked(prisma.workflowSection.create).mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'new-section',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        } as any);
      });

      const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Section',
          placement: 'before_services',
          type: 'text'
          // displayOrder intentionally omitted to test auto-assignment
        })
      });

      const response = await POST(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(201);

      // Check that create was called with displayOrder 4
      expect(vi.mocked(prisma.workflowSection.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayOrder: 4
          })
        })
      );
    });
  });
});

describe('PATCH /api/workflows/[id]/sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 409 when workflow has active orders', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
      id: '123'
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(1); // Has active orders

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sections: [
          { id: 'section1', displayOrder: 1 },
          { id: 'section2', displayOrder: 0 }
        ]
      })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Cannot modify workflow with active orders');
  });

  it('should update display order for multiple sections', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
      id: '123'
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(0); // No active orders

    const mockTransaction = vi.fn().mockResolvedValueOnce([
      { id: 'section1', displayOrder: 1 },
      { id: 'section2', displayOrder: 0 }
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

    vi.mocked(prisma.workflowSection.findMany).mockResolvedValueOnce([
      { id: 'section2', displayOrder: 0, placement: 'before_services' },
      { id: 'section1', displayOrder: 1, placement: 'before_services' }
    ] as any);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sections: [
          { id: 'section1', displayOrder: 1 },
          { id: 'section2', displayOrder: 0 }
        ]
      })
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });

    expect(response.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalled();
  });
});