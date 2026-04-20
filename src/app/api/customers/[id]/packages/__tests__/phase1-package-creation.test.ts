// /GlobalRX_v2/src/app/api/customers/[id]/packages/__tests__/phase1-package-creation.test.ts

// Phase 1 Candidate Invite - Test for Business Rule 3
// Tests package creation with optional workflowId

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { canManageCustomers } from '@/lib/auth-utils';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: vi.fn()
    },
    package: {
      create: vi.fn(),
      findUnique: vi.fn()
    },
    workflow: {
      findUnique: vi.fn()
    },
    packageService: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/auth-utils', () => ({
  canManageCustomers: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn()
  }
}));

vi.mock('@/lib/utils', () => ({
  getErrorDetails: vi.fn((error) => ({
    message: error?.message || 'Unknown error',
    stack: error?.stack || ''
  }))
}));

describe('Phase 1 - Package Creation with workflowId', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'test-user',
        permissions: { customer_config: { edit: true } }
      }
    } as any);

    vi.mocked(canManageCustomers).mockReturnValue(true);
  });

  const mockCustomer = {
    id: '550e8400-e29b-41d4-a716-446655440010',
    name: 'Test Customer',
    services: [] // No services for simplicity
  };

  describe('POST /api/customers/[id]/packages - workflowId handling', () => {
    it('should create package with valid workflowId', async () => {
      const workflowId = '550e8400-e29b-41d4-a716-446655440001';
      const newPackageId = '550e8400-e29b-41d4-a716-446655440020';

      // Call 1: Check if customer exists
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer as any);

      // Call 2: Validate workflow exists
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
        id: workflowId,
        name: 'Test Workflow'
      } as any);

      // Call 3: Transaction to create package
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            create: vi.fn().mockResolvedValue({
              id: newPackageId,
              name: 'Package with Workflow',
              description: 'Test package',
              customerId: mockCustomer.id,
              workflowId: workflowId
            })
          },
          packageService: {
            create: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 4: Get created package with packageServices
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: newPackageId,
        name: 'Package with Workflow',
        description: 'Test package',
        customerId: mockCustomer.id,
        workflowId: workflowId,
        packageServices: [] // No services
      } as any);

      const request = new Request('http://localhost:3000/api/customers/550e8400-e29b-41d4-a716-446655440010/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Package with Workflow',
          description: 'Test package',
          services: [],
          workflowId: workflowId
        })
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440010' })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Package with Workflow');
      expect(data.workflowId).toBe(workflowId);

      // Verify workflow validation was called
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: workflowId }
      });
    });

    it('should create package without workflowId (null)', async () => {
      const newPackageId = '550e8400-e29b-41d4-a716-446655440021';

      // Call 1: Check if customer exists
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer as any);

      // NO workflow.findUnique call because workflowId is null

      // Call 2: Transaction to create package
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            create: vi.fn().mockResolvedValue({
              id: newPackageId,
              name: 'Package without Workflow',
              description: 'No workflow assigned',
              customerId: mockCustomer.id,
              workflowId: null
            })
          },
          packageService: {
            create: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 3: Get created package
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: newPackageId,
        name: 'Package without Workflow',
        description: 'No workflow assigned',
        customerId: mockCustomer.id,
        workflowId: null,
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/customers/550e8400-e29b-41d4-a716-446655440010/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Package without Workflow',
          description: 'No workflow assigned',
          services: [],
          workflowId: null
        })
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440010' })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Package without Workflow');
      expect(data.workflowId).toBe(null);

      // Verify workflow validation was NOT called
      expect(prisma.workflow.findUnique).not.toHaveBeenCalled();
    });

    it('should reject invalid workflowId format', async () => {
      // Call 1: Check if customer exists
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer as any);

      // No other calls - Zod validation should fail

      const request = new Request('http://localhost:3000/api/customers/550e8400-e29b-41d4-a716-446655440010/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Workflow Package',
          description: 'Test package',
          services: [],
          workflowId: 'not-a-uuid' // Invalid UUID format
        })
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440010' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Validation failed');

      // Should not reach workflow validation
      expect(prisma.workflow.findUnique).not.toHaveBeenCalled();
    });

    it('should reject non-existent workflowId', async () => {
      const nonExistentWorkflowId = '550e8400-e29b-41d4-a716-446655440099';

      // Call 1: Check if customer exists
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer as any);

      // Call 2: Validate workflow - returns null (doesn't exist)
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

      // No transaction or final findUnique - should return 400

      const request = new Request('http://localhost:3000/api/customers/550e8400-e29b-41d4-a716-446655440010/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Package with Non-existent Workflow',
          description: 'Test package',
          services: [],
          workflowId: nonExistentWorkflowId
        })
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440010' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Workflow not found');
      expect(data.workflowId).toBe(nonExistentWorkflowId);

      // Verify workflow validation was called
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: nonExistentWorkflowId }
      });

      // Verify transaction was NOT called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create package when workflowId is omitted', async () => {
      const newPackageId = '550e8400-e29b-41d4-a716-446655440022';

      // Call 1: Check if customer exists
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer as any);

      // NO workflow.findUnique call because workflowId is undefined

      // Call 2: Transaction to create package
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          package: {
            create: vi.fn().mockResolvedValue({
              id: newPackageId,
              name: 'Package with Omitted Workflow',
              description: 'Workflow field omitted',
              customerId: mockCustomer.id,
              workflowId: undefined
            })
          },
          packageService: {
            create: vi.fn()
          }
        };
        return callback(tx);
      });

      // Call 3: Get created package
      vi.mocked(prisma.package.findUnique).mockResolvedValueOnce({
        id: newPackageId,
        name: 'Package with Omitted Workflow',
        description: 'Workflow field omitted',
        customerId: mockCustomer.id,
        workflowId: null,
        packageServices: []
      } as any);

      const request = new Request('http://localhost:3000/api/customers/550e8400-e29b-41d4-a716-446655440010/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Package with Omitted Workflow',
          description: 'Workflow field omitted',
          services: []
          // workflowId field completely omitted
        })
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440010' })
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('Package with Omitted Workflow');
      // When omitted, workflowId is stored as null in the database
      expect(data.workflowId).toBe(null);

      // Verify workflow validation was NOT called
      expect(prisma.workflow.findUnique).not.toHaveBeenCalled();
    });
  });
});