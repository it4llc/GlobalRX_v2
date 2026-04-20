// /GlobalRX_v2/src/app/api/packages/[id]/__tests__/phase1-workflow-handling-fixed.test.ts

// Phase 1 Candidate Invite - Test for Business Rules 2 & 3
// Tests workflowId handling in package API - FIXED version with proper mock sequencing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    package: {
      findUnique: vi.fn()
    },
    workflow: {
      findUnique: vi.fn()
    },
    packageService: {
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn()
  }
}));

describe('Phase 1 - Package workflowId handling (FIXED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    user: {
      id: 'test-user',
      permissions: { customer_config: { edit: true, view: true } }
    }
  };

  describe('PUT /api/packages/[id] - workflowId updates', () => {
    it('should accept and save workflowId', async () => {
      // Setup mocks for this test
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      // Call 1: Check if package exists (line 144)
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Existing Package',
        description: 'Existing Description',
        workflowId: null,
        customer: {
          id: 'cust-123',
          services: [] // No services for simplicity
        }
      } as any);

      // Call 2: Validate workflow exists (line 221)
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
        id: '550e8400-e29b-41d4-a716-446655440001', // Valid UUID
        name: 'Test Workflow'
      } as any);

      // Call 3: Transaction (line 234)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({
              id: 'pkg-123',
              name: 'Updated Package',
              workflowId: '550e8400-e29b-41d4-a716-446655440001'
            })
          },
          packageService: {
            deleteMany: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 4: Get updated package (line 270)
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Updated Package',
        workflowId: '550e8400-e29b-41d4-a716-446655440001',
        workflow: {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Test Workflow'
        },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Package',
          workflowId: '550e8400-e29b-41d4-a716-446655440001' // Valid UUID
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      // Debug: see what error we're getting
      if (response.status !== 200) {
        const errorData = await response.clone().json();
        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(errorData, null, 2));
      }

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.workflowId).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should accept null workflowId to remove workflow assignment', async () => {
      // Setup mocks for this test
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      // Call 1: Check if package exists - has existing workflow
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Package with Workflow',
        workflowId: '550e8400-e29b-41d4-a716-446655440002', // Currently has a workflow (valid UUID)
        customer: {
          id: 'cust-123',
          services: []
        }
      } as any);

      // NO workflow.findUnique call because workflowId is null

      // Call 2: Transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({
              id: 'pkg-123',
              workflowId: null // Removed
            })
          },
          packageService: {
            deleteMany: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 3: Get updated package
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Package with Workflow',
        workflowId: null,
        workflow: null,
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          workflowId: null
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
      expect(data.workflowId).toBe(null);
    });

    it('should reject invalid workflowId (not a UUID) with 400', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      // Call 1: Check if package exists
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Test Package',
        customer: {
          id: 'cust-123',
          services: []
        }
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          workflowId: 'not-a-uuid'
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      // Fails at Zod validation, never reaches workflow check
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Validation failed');
    });

    it('should reject non-existent workflowId with 400', async () => {
      // Setup mocks for this test
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      // Call 1: Check if package exists
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Test Package',
        workflowId: null,
        customer: {
          id: 'cust-123',
          services: []
        }
      } as any);

      // Call 2: Validate workflow - returns null (doesn't exist)
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

      // NO transaction or second package.findUnique - returns 400 error

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          workflowId: '550e8400-e29b-41d4-a716-446655440000' // Valid UUID but doesn't exist
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Workflow not found');
      expect(data.workflowId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should accept update without workflowId field (unchanged)', async () => {
      // Setup mocks for this test
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      // Call 1: Check if package exists
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Existing Package',
        workflowId: 'existing-workflow-id',
        customer: {
          id: 'cust-123',
          services: []
        }
      } as any);

      // NO workflow.findUnique because workflowId field not in request

      // Call 2: Transaction
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            update: vi.fn().mockResolvedValue({
              id: 'pkg-123',
              name: 'Name Only Update',
              workflowId: 'existing-workflow-id' // Unchanged
            })
          },
          packageService: {
            deleteMany: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 3: Get updated package
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Name Only Update',
        workflowId: 'existing-workflow-id',
        workflow: {
          id: 'existing-workflow-id',
          name: 'Existing Workflow'
        },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Name Only Update'
          // No workflowId field
        })
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Name Only Update');
      expect(data.workflowId).toBe('existing-workflow-id'); // Unchanged
    });
  });

  describe('GET /api/packages/[id] - workflowId retrieval', () => {
    it('should return workflow data when workflowId is set', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Test Package',
        workflowId: '550e8400-e29b-41d4-a716-446655440003',
        workflow: {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Test Workflow'
        },
        customer: { name: 'Test Customer' },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workflowId).toBe('550e8400-e29b-41d4-a716-446655440003');
      expect(data.workflow).toBeDefined();
      expect(data.workflow.name).toBe('Test Workflow');
    });

    it('should return null workflow when workflowId is not set', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);

      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: 'pkg-123',
        name: 'Test Package',
        workflowId: null,
        workflow: null,
        customer: { name: 'Test Customer' },
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/packages/pkg-123');
      const response = await GET(request, { params: Promise.resolve({ id: 'pkg-123' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workflowId).toBe(null);
      expect(data.workflow).toBe(null);
    });
  });
});