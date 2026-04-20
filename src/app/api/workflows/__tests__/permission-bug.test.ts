// REGRESSION TEST: proves bug fix for customer config permission consistency
// Bug: Workflow API checks for "workflows" permission but User Admin saves "customer_config"
// This test should FAIL before the fix and PASS after the fix

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { workflowCreateSchema } from '@/types/workflow';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workflow: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Workflow API Permission Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/workflows - Permission Bug Regression', () => {
    // REGRESSION TEST: This is the key test that proves the bug exists
    it('REGRESSION: should accept user with customer_config permission (currently fails)', async () => {
      // User has the permission that User Admin UI saves
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin-user',
          permissions: { customer_config: '*' } // This is what User Admin saves
        }
      } as any);

      const mockWorkflows = [
        {
          id: 'wf1',
          name: 'Test Workflow',
          description: 'Test Description',
          status: 'active',
          defaultLanguage: 'en',
          expirationDays: 30,
          autoCloseEnabled: false,
          extensionAllowed: false,
          extensionDays: 0,
          reminderEnabled: false,
          reminderFrequency: 0,
          maxReminders: 0,
          disabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          packageId: 'pkg1',
          package: { id: 'pkg1', name: 'Test Package' },
          sections: []
        }
      ];

      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce(mockWorkflows as any);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(1);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      // This SHOULD return 200 with workflows, but currently returns 403
      // After the fix, this assertion will pass
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workflows).toBeDefined();
      expect(data.workflows).toHaveLength(1);
    });

    // This test shows what currently works (wrong behavior)
    it('accepts user with "customer_config" permission (correct key)', async () => {
      // User has the CORRECT permission key
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-with-correct-key',
          permissions: { customer_config: { view: true } } // Correct key
        }
      } as any);

      const mockWorkflows = [];
      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce(mockWorkflows);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      // Works with correct permission key
      expect(response.status).toBe(200);
    });

    // Test with correct permission key
    it('accepts user with "customer_config" permission (alternate test)', async () => {
      // User has the CORRECT permission key
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-with-correct-perm',
          permissions: { customer_config: { view: true } } // Correct key
        }
      } as any);

      const mockWorkflows = [];
      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce(mockWorkflows);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      // Works with correct permission key
      expect(response.status).toBe(200);
    });

    it('should reject user without any relevant permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-no-perms',
          permissions: { fulfillment: '*' } // Unrelated permission
        }
      } as any);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should accept admin users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          permissions: { admin: true }
        }
      } as any);

      const mockWorkflows = [];
      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce(mockWorkflows);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/workflows - Permission Bug Regression', () => {
    // REGRESSION TEST: Key test for POST endpoint
    it('REGRESSION: should accept user with customer_config permission for create (currently fails)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin-user',
          permissions: { customer_config: { edit: true } } // What User Admin saves
        }
      } as any);

      const packageId = '550e8400-e29b-41d4-a716-446655440000'; // Valid UUID
      const newWorkflow = {
        id: 'new-wf',
        name: 'New Workflow',
        description: 'New Description',
        status: 'draft',
        defaultLanguage: 'en',
        expirationDays: 30,
        autoCloseEnabled: false,
        extensionAllowed: false,
        extensionDays: 0,
        reminderEnabled: false,
        reminderFrequency: 0,
        maxReminders: 0,
        disabled: false,
        packageId: packageId,
        createdById: 'customer-admin-user',
        updatedById: 'customer-admin-user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.workflow.create).mockResolvedValueOnce(newWorkflow as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
        ...newWorkflow,
        package: { id: packageId, name: 'Test Package' },
        sections: []
      } as any);

      const request = new Request('http://localhost:3000/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Workflow',
          description: 'New Description',
          status: 'draft',
          defaultLanguage: 'en',
          expirationDays: 30,
          autoCloseEnabled: false,
          extensionAllowed: false,
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          packageIds: [packageId]
        })
      });

      const response = await POST(request);

      // Should return 201 with created workflow
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('New Workflow');
    });

    // Test with correct permission key
    it('accepts user with "customer_config" permission for create (correct key)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-correct-key',
          permissions: { customer_config: { edit: true } } // Correct key
        }
      } as any);

      const packageId = '550e8400-e29b-41d4-a716-446655440000';
      const newWorkflow = {
        id: 'new-wf2',
        name: 'Workflow 2',
        packageId: packageId,
        createdById: 'user-correct-key',
        updatedById: 'user-correct-key'
      };

      vi.mocked(prisma.workflow.create).mockResolvedValueOnce(newWorkflow as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce({
        ...newWorkflow,
        package: { id: packageId, name: 'Test Package' },
        sections: []
      } as any);

      const request = new Request('http://localhost:3000/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Workflow 2',
          customerId: '550e8400-e29b-41d4-a716-446655440000',
          packageIds: [packageId]
        })
      });

      const response = await POST(request);

      // Works with correct permission key
      expect(response.status).toBe(201);
    });

    it('should reject user without edit permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'view-only-user',
          permissions: { customer_config: { view: true } } // Has view but not edit
        }
      } as any);

      const request = new Request('http://localhost:3000/api/workflows', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Should Fail',
          packageIds: ['pkg1']
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Authentication checks', () => {
    it('should return 401 when not authenticated for GET', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when not authenticated for POST', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/workflows', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Permission format variations', () => {
    it('REGRESSION: should accept customer_config with wildcard format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: '*' } // Wildcard format
        }
      } as any);

      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('REGRESSION: should accept customer_config with object format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: { view: true, edit: true } } // Object format
        }
      } as any);

      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('REGRESSION: should accept customer_config with boolean format', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-admin',
          permissions: { customer_config: true } // Boolean format
        }
      } as any);

      vi.mocked(prisma.workflow.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.workflow.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/workflows');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });
});