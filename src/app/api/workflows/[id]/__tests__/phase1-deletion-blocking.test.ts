// /GlobalRX_v2/src/app/api/workflows/[id]/__tests__/phase1-deletion-blocking.test.ts

// Phase 1 Candidate Invite - Test for Business Rule 4
// Tests workflow deletion blocking when packages are assigned

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permission-utils';

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
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn()
  }
}));

describe('Phase 1 - Workflow Deletion Blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    user: {
      id: 'test-user',
      permissions: { customer_config: { edit: true, delete: true } }
    }
  };

  describe('DELETE /api/workflows/[id] - Business Rule 4', () => {
    beforeEach(() => {
      // Setup default permission mocks
      vi.mocked(hasPermission).mockImplementation((user, permission, action) => {
        if (permission === 'customer_config') {
          if (action === 'delete' || action === 'edit') return true;
        }
        if (permission === 'admin') return false;
        return false;
      });
    });

    it('should return 400 with error message when packages are assigned to workflow', async () => {
      const workflowWithPackages = {
        id: 'workflow-123',
        name: 'Test Workflow',
        packages: [
          { id: 'pkg-1', name: 'Package 1' },
          { id: 'pkg-2', name: 'Package 2' },
          { id: 'pkg-3', name: 'Package 3' }
        ]
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(workflowWithPackages as any);

      const request = new Request('http://localhost:3000/api/workflows/workflow-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-123' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe(
        'This workflow cannot be deleted because it is assigned to 3 package(s). Please reassign or remove the workflow from those packages first.'
      );
      expect(data.packagesCount).toBe(3);

      // Verify workflow was NOT deleted
      expect(prisma.workflow.update).not.toHaveBeenCalled();
    });

    it('should return 400 with correct message for single package', async () => {
      const workflowWithOnePackage = {
        id: 'workflow-456',
        name: 'Single Package Workflow',
        packages: [
          { id: 'pkg-solo', name: 'Solo Package' }
        ]
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(workflowWithOnePackage as any);

      const request = new Request('http://localhost:3000/api/workflows/workflow-456', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-456' }) });

      expect(response.status).toBe(400);
      const data = await response.json();
      // Note: message says "1 package(s)" - keeping consistency with implementation
      expect(data.error).toContain('1 package(s)');
      expect(data.packagesCount).toBe(1);
    });

    it('should succeed when no packages are assigned', async () => {
      const workflowWithoutPackages = {
        id: 'workflow-789',
        name: 'Unassigned Workflow',
        packages: [] // No packages assigned
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(workflowWithoutPackages as any);
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        ...workflowWithoutPackages,
        disabled: true
      } as any);

      const request = new Request('http://localhost:3000/api/workflows/workflow-789', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-789' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Workflow deleted successfully');

      // Verify soft delete was performed
      expect(prisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 'workflow-789' },
        data: {
          disabled: true,
          updatedAt: expect.any(Date),
          updatedById: 'test-user'
        }
      });
    });

    it('should succeed when packages array is null', async () => {
      const workflowNullPackages = {
        id: 'workflow-null',
        name: 'Null Packages Workflow',
        packages: null // Packages might be null instead of empty array
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(workflowNullPackages as any);
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        ...workflowNullPackages,
        disabled: true
      } as any);

      const request = new Request('http://localhost:3000/api/workflows/workflow-null', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-null' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Workflow deleted successfully');
    });

    it('should return 404 when workflow does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession as any);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/workflows/non-existent', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Workflow not found');
    });

    it('should return 403 when user lacks delete permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'view-only-user',
          permissions: { customer_config: { view: true } }
        }
      } as any);

      // Mock hasPermission to return false for this user
      vi.mocked(hasPermission).mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/workflows/workflow-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-123' }) });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');

      // Verify workflow was not even fetched
      expect(prisma.workflow.findUnique).not.toHaveBeenCalled();
    });

    it('should allow admin users to delete workflows', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          permissions: { admin: true }
        }
      } as any);

      // Mock hasPermission to return true for admin
      vi.mocked(hasPermission).mockImplementation((user, permission) => {
        return permission === 'admin';
      });

      const workflowToDelete = {
        id: 'workflow-admin',
        name: 'Admin Deletable',
        packages: []
      };

      vi.mocked(prisma.workflow.findUnique).mockResolvedValueOnce(workflowToDelete as any);
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        ...workflowToDelete,
        disabled: true
      } as any);

      const request = new Request('http://localhost:3000/api/workflows/workflow-admin', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: 'workflow-admin' }) });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toBe('Workflow deleted successfully');
    });
  });
});