// /GlobalRX_v2/src/app/api/workflows/[id]/sections/[sectionId]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '../route';
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

// Dynamic import mock for MAX_SECTIONS_PER_PLACEMENT
vi.mock('@/types/workflow-section', async () => {
  const actual = await vi.importActual('@/types/workflow-section');
  return {
    ...actual,
    MAX_SECTIONS_PER_PLACEMENT: 10
  };
});

// Import mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('GET /api/workflows/[id]/sections/[sectionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await GET(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user lacks permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await GET(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Forbidden');
  });

  it('should return 404 when workflow not found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await GET(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Workflow not found');
  });

  it('should return 404 when section not found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await GET(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Section not found');
  });

  it('should return a single section on success', async () => {
    const mockSection = {
      id: '456',
      workflowId: '123',
      name: 'Test Section',
      placement: 'before_services',
      type: 'text',
      content: 'Test content',
      displayOrder: 0,
      isRequired: true,
      fileUrl: null,
      fileName: null
    };

    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce(mockSection as any);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await GET(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('456');
    expect(data.name).toBe('Test Section');
  });
});

describe('PUT /api/workflows/[id]/sections/[sectionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 409 when workflow has active orders', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
      id: '456',
      workflowId: '123',
      placement: 'before_services'
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(1); // Active orders exist

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name' })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Cannot modify workflow with active orders');
  });

  it('should update a section successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
      id: '456',
      workflowId: '123',
      placement: 'before_services',
      displayOrder: 0
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.workflowSection.update).mockResolvedValueOnce({
      id: '456',
      name: 'Updated Name',
      placement: 'before_services',
      type: 'text'
    } as any);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name' })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('Updated Name');
  });

  it('should handle placement change and adjust displayOrder', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst)
      .mockResolvedValueOnce({
        id: '456',
        workflowId: '123',
        placement: 'before_services',
        displayOrder: 1
      } as any)
      .mockResolvedValueOnce({
        displayOrder: 2
      } as any); // Max order in new placement
    vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.workflowSection.count).mockResolvedValueOnce(5); // Under limit
    vi.mocked(prisma.workflowSection.update).mockResolvedValueOnce({
      id: '456',
      placement: 'after_services',
      displayOrder: 3
    } as any);
    vi.mocked(prisma.workflowSection.findMany).mockResolvedValueOnce([
      { id: 'other1', displayOrder: 2 },
      { id: 'other2', displayOrder: 3 }
    ] as any);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([]);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456', {
      method: 'PUT',
      body: JSON.stringify({ placement: 'after_services' })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(200);

    // Verify update was called with new displayOrder
    expect(vi.mocked(prisma.workflowSection.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          placement: 'after_services',
          displayOrder: 3
        })
      })
    );
  });

  it('should return 409 when placement change would exceed section limit', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
      id: '456',
      workflowId: '123',
      placement: 'before_services'
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.workflowSection.count).mockResolvedValueOnce(10); // At limit

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456', {
      method: 'PUT',
      body: JSON.stringify({ placement: 'after_services' })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Section limit reached in target placement');
  });
});

describe('DELETE /api/workflows/[id]/sections/[sectionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 409 when workflow has active orders', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
      id: '456',
      placement: 'before_services'
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await DELETE(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('Cannot modify workflow with active orders');
  });

  it('should delete section and compact displayOrder', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: '1', userType: 'internal' }
    });
    vi.mocked(hasPermission).mockReturnValue(true);
    vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({ id: '123' } as any);
    vi.mocked(prisma.workflowSection.findFirst).mockResolvedValueOnce({
      id: '456',
      placement: 'before_services',
      displayOrder: 1
    } as any);
    vi.mocked(prisma.order.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.workflowSection.delete).mockResolvedValueOnce({} as any);
    vi.mocked(prisma.workflowSection.findMany).mockResolvedValueOnce([
      { id: 'other1', displayOrder: 2 },
      { id: 'other2', displayOrder: 3 }
    ] as any);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([]);

    const request = new NextRequest('http://localhost:3000/api/workflows/123/sections/456');
    const response = await DELETE(request, { params: Promise.resolve({ id: '123', sectionId: '456' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Section deleted successfully');
    expect(vi.mocked(prisma.workflowSection.delete)).toHaveBeenCalledWith({
      where: { id: '456' }
    });
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled();
  });
});