// /GlobalRX_v2/src/app/api/packages/__tests__/workflow-filter-bug.test.ts
// Bug Fix Regression Tests for Package Workflow Status Filtering
//
// Bug description: /api/packages?hasWorkflow=true returns ALL packages with any workflow,
// instead of only packages with active (status='active'), enabled (disabled=false) workflows.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
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
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Package Workflow Filter Bug - Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    user: {
      id: 'user-1',
      userType: 'customer',
      customerId: 'customer-1',
      permissions: {}
    }
  };

  describe('REGRESSION TEST: proves bug fix for package workflow status filtering', () => {
    it('should only return packages with active, enabled workflows when hasWorkflow=true', async () => {
      // REGRESSION TEST: proves bug fix for package workflow status filtering

      // Setup: mock packages with various workflow states
      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Package with Active Workflow',
          description: 'Has active, enabled workflow',
          workflowId: 'workflow-1',
          workflow: {
            id: 'workflow-1',
            name: 'Active Workflow',
            description: 'This workflow is active and enabled',
            status: 'active',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        },
        {
          id: 'pkg-2',
          name: 'Package with Disabled Workflow',
          description: 'Has active but disabled workflow',
          workflowId: 'workflow-2',
          workflow: {
            id: 'workflow-2',
            name: 'Disabled Workflow',
            description: 'This workflow is disabled',
            status: 'active',
            disabled: true,
            expirationDays: 15,
            reminderEnabled: false
          }
        },
        {
          id: 'pkg-3',
          name: 'Package with Draft Workflow',
          description: 'Has draft workflow',
          workflowId: 'workflow-3',
          workflow: {
            id: 'workflow-3',
            name: 'Draft Workflow',
            description: 'This workflow is still in draft',
            status: 'draft',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        },
        {
          id: 'pkg-4',
          name: 'Package with Archived Workflow',
          description: 'Has archived workflow',
          workflowId: 'workflow-4',
          workflow: {
            id: 'workflow-4',
            name: 'Archived Workflow',
            description: 'This workflow is archived',
            status: 'archived',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: false
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior (post-fix): Only the package with active, enabled workflow should be returned
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('pkg-1');
      expect(data[0].name).toBe('Package with Active Workflow');
      // The API doesn't return status and disabled fields in the response
      expect(data[0].workflow).toBeDefined();
      expect(data[0].workflow.name).toBe('Active Workflow');

      // Verify that packages with disabled, draft, or archived workflows are NOT included
      const packageIds = data.map((pkg: any) => pkg.id);
      expect(packageIds).not.toContain('pkg-2'); // disabled workflow
      expect(packageIds).not.toContain('pkg-3'); // draft workflow
      expect(packageIds).not.toContain('pkg-4'); // archived workflow
    });

    it('should exclude packages where workflow is disabled even if status is active', async () => {
      // Edge case: workflow has status='active' but disabled=true
      const mockPackages = [
        {
          id: 'pkg-disabled',
          name: 'Package with Disabled Active Workflow',
          description: 'Active status but disabled flag',
          workflowId: 'workflow-disabled',
          workflow: {
            id: 'workflow-disabled',
            name: 'Active but Disabled',
            description: 'Status is active but disabled flag is true',
            status: 'active',
            disabled: true,
            expirationDays: 30,
            reminderEnabled: true
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior: Package should NOT be returned because workflow is disabled
      expect(data).toHaveLength(0);
    });

    it('should exclude packages where workflow status is draft', async () => {
      // Edge case: workflow is enabled but still in draft status
      const mockPackages = [
        {
          id: 'pkg-draft',
          name: 'Package with Draft Workflow',
          description: 'Workflow is in draft status',
          workflowId: 'workflow-draft',
          workflow: {
            id: 'workflow-draft',
            name: 'Draft Workflow',
            description: 'Not yet activated',
            status: 'draft',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior: Package should NOT be returned because workflow is in draft status
      expect(data).toHaveLength(0);
    });

    it('should exclude packages where workflow status is archived', async () => {
      // Edge case: workflow was active but is now archived
      const mockPackages = [
        {
          id: 'pkg-archived',
          name: 'Package with Archived Workflow',
          description: 'Workflow has been archived',
          workflowId: 'workflow-archived',
          workflow: {
            id: 'workflow-archived',
            name: 'Archived Workflow',
            description: 'No longer in use',
            status: 'archived',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: false
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior: Package should NOT be returned because workflow is archived
      expect(data).toHaveLength(0);
    });

    it('should exclude packages with no workflow when hasWorkflow=true', async () => {
      // Edge case: package has no workflow at all
      const mockPackages = [
        {
          id: 'pkg-no-workflow',
          name: 'Package Without Workflow',
          description: 'No workflow assigned',
          workflowId: null,
          workflow: null
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior: Package should NOT be returned because it has no workflow
      expect(data).toHaveLength(0);
    });

    it('should return all packages when hasWorkflow filter is not applied', async () => {
      // Verify that without the filter, all packages are returned regardless of workflow state
      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Package with Active Workflow',
          description: 'Has active workflow',
          workflowId: 'workflow-1',
          workflow: {
            id: 'workflow-1',
            name: 'Active Workflow',
            description: 'Active and enabled',
            status: 'active',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        },
        {
          id: 'pkg-2',
          name: 'Package with Draft Workflow',
          description: 'Has draft workflow',
          workflowId: 'workflow-2',
          workflow: {
            id: 'workflow-2',
            name: 'Draft Workflow',
            description: 'Still in draft',
            status: 'draft',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: false
          }
        },
        {
          id: 'pkg-3',
          name: 'Package without Workflow',
          description: 'No workflow',
          workflowId: null,
          workflow: null
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // Without filter, all packages should be returned
      expect(data).toHaveLength(3);
      expect(data[0].hasWorkflow).toBe(true);
      expect(data[1].hasWorkflow).toBe(true);
      expect(data[2].hasWorkflow).toBe(false);
    });

    it('should handle mixed workflow statuses correctly when filter is applied', async () => {
      // Complex scenario: multiple packages, only some should pass the filter
      const mockPackages = [
        {
          id: 'pkg-active-1',
          name: 'First Active Package',
          description: 'Active and enabled',
          workflowId: 'workflow-active-1',
          workflow: {
            id: 'workflow-active-1',
            name: 'First Active Workflow',
            description: 'Should be included',
            status: 'active',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        },
        {
          id: 'pkg-disabled',
          name: 'Disabled Package',
          description: 'Active but disabled',
          workflowId: 'workflow-disabled',
          workflow: {
            id: 'workflow-disabled',
            name: 'Disabled Workflow',
            description: 'Should NOT be included',
            status: 'active',
            disabled: true,
            expirationDays: 15,
            reminderEnabled: false
          }
        },
        {
          id: 'pkg-active-2',
          name: 'Second Active Package',
          description: 'Another active and enabled',
          workflowId: 'workflow-active-2',
          workflow: {
            id: 'workflow-active-2',
            name: 'Second Active Workflow',
            description: 'Should be included',
            status: 'active',
            disabled: false,
            expirationDays: 30,
            reminderEnabled: false
          }
        },
        {
          id: 'pkg-draft',
          name: 'Draft Package',
          description: 'Draft workflow',
          workflowId: 'workflow-draft',
          workflow: {
            id: 'workflow-draft',
            name: 'Draft Workflow',
            description: 'Should NOT be included',
            status: 'draft',
            disabled: false,
            expirationDays: 15,
            reminderEnabled: true
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // CORRECT behavior: Only packages with active, enabled workflows
      expect(data).toHaveLength(2);

      const packageIds = data.map((pkg: any) => pkg.id);
      expect(packageIds).toContain('pkg-active-1');
      expect(packageIds).toContain('pkg-active-2');
      expect(packageIds).not.toContain('pkg-disabled');
      expect(packageIds).not.toContain('pkg-draft');

      // Verify all returned packages have workflows (filtering is done server-side)
      data.forEach((pkg: any) => {
        expect(pkg.workflow).toBeDefined();
        expect(pkg.hasWorkflow).toBe(true);
      });
    });
  });

  describe('Query handling for workflow filter should be updated', () => {
    it('should use application-level filtering for active, enabled workflows', async () => {
      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      await GET(request);

      // The implementation uses application-level filtering, not database-level
      // It fetches all packages with workflows, then filters in memory
      expect(prisma.package.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'customer-1',
            workflowId: { not: null }
          })
        })
      );
    });
  });
});