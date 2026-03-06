// src/app/api/dsx/associate-requirements/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
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
    serviceRequirement: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn()
    },
    dSXMapping: {
      deleteMany: vi.fn()
    }
  }
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
  },
  logDatabaseError: vi.fn()
}));

// Import the mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('POST /api/dsx/associate-requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions - BUG DEMONSTRATION', () => {
    /**
     * CRITICAL BUG TEST #3
     * This test PROVES the bug exists: the endpoint uses hasPermission()
     * with 'dsx' permission and 'manage' action, which is incorrect.
     *
     * It should be using canAccessDataRx() to check for global_config permission.
     */
    it('BUG: checks for dsx permission with manage action instead of using canAccessDataRx', async () => {
      // User has global_config permission
      const mockUser = {
        id: '1',
        permissions: {
          global_config: true
          // Note: NO 'dsx' permission
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // hasPermission will be called with the user object and 'dsx', 'manage'
      // It will return false because user doesn't have 'dsx' permission
      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' }
          ]
        })
      });

      const response = await POST(request);

      // BUG: Endpoint checks for 'dsx' permission with 'manage' action
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');

      // Verify it checked for 'dsx' permission with 'manage' action (wrong!)
      expect(hasPermission).toHaveBeenCalledWith(
        mockUser,  // The user object itself, not session.user.permissions
        'dsx',
        'manage'
      );
    });

    /**
     * This test shows the current (incorrect) behavior where only 'dsx' permission works
     */
    it('currently only accepts legacy dsx permission with manage action', async () => {
      const mockUser = {
        id: '1',
        permissions: {
          dsx: { manage: true }  // Legacy permission structure
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // hasPermission returns true for 'dsx' with 'manage' action
      vi.mocked(hasPermission).mockReturnValueOnce(true);

      // Mock existing requirements
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        { requirementId: 'old-req-1', displayOrder: 10 },
        { requirementId: 'old-req-2', displayOrder: 20 }
      ]);

      // Mock delete operations
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValueOnce({ count: 1 });
      vi.mocked(prisma.serviceRequirement.deleteMany).mockResolvedValueOnce({ count: 2 });

      // Mock create operation
      vi.mocked(prisma.serviceRequirement.create).mockResolvedValueOnce({
        id: 'sr-1',
        serviceId: 'service-123',
        requirementId: 'req-1',
        displayOrder: 30,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return 403 when user has dsx permission without manage action', async () => {
      const mockUser = {
        id: '1',
        permissions: {
          dsx: { view: true }  // Has dsx but not manage action
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [{ id: 'req-1' }]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should return 403 when user lacks both dsx and global_config permissions', async () => {
      const mockUser = {
        id: '1',
        permissions: {
          candidate_workflow: true  // Some other permission
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        permissions: { dsx: { manage: true } }
      };
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(hasPermission).mockReturnValueOnce(true);
    });

    it('should return 400 when serviceId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          requirements: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Service ID is required');
    });

    it('should return 400 when requirements is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Requirements array is required');
    });

    it('should return 400 when requirements is not an array', async () => {
      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: 'not-an-array'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Requirements array is required');
    });

    it('should return 400 when requirements is empty array', async () => {
      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Requirements array is required');
    });
  });

  describe('requirement association', () => {
    beforeEach(() => {
      const mockUser = {
        id: '1',
        permissions: { dsx: { manage: true } }
      };
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(hasPermission).mockReturnValueOnce(true);
    });

    it('should preserve display order for existing requirements', async () => {
      // Mock existing requirements with display orders
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        { requirementId: 'req-1', displayOrder: 100 },
        { requirementId: 'req-2', displayOrder: 200 },
        { requirementId: 'req-3', displayOrder: 300 }
      ]);

      // Mock delete operations
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValueOnce({ count: 1 });
      vi.mocked(prisma.serviceRequirement.deleteMany).mockResolvedValueOnce({ count: 3 });

      // Mock create operations - verify display order is preserved
      vi.mocked(prisma.serviceRequirement.create)
        .mockResolvedValueOnce({
          id: 'sr-1',
          serviceId: 'service-123',
          requirementId: 'req-1',
          displayOrder: 100,  // Preserved
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'service-123',
          requirementId: 'req-2',
          displayOrder: 200,  // Preserved
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-4',
          serviceId: 'service-123',
          requirementId: 'req-4',
          displayOrder: 310,  // New requirement gets new order
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' },  // Existing
            { id: 'req-2', type: 'document' },    // Existing
            { id: 'req-4', type: 'data-field' }   // New
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(3);

      // Verify display orders were preserved for existing requirements
      expect(prisma.serviceRequirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requirementId: 'req-1',
            displayOrder: 100  // Preserved from existing
          })
        })
      );

      expect(prisma.serviceRequirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requirementId: 'req-2',
            displayOrder: 200  // Preserved from existing
          })
        })
      );
    });

    it('should remove DSX mappings for removed requirements', async () => {
      // Existing requirements: req-1, req-2, req-3
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([
        { requirementId: 'req-1', displayOrder: 10 },
        { requirementId: 'req-2', displayOrder: 20 },
        { requirementId: 'req-3', displayOrder: 30 }
      ]);

      // New requirements: only req-1 and req-2 (req-3 is being removed)
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.serviceRequirement.deleteMany).mockResolvedValueOnce({ count: 3 });

      vi.mocked(prisma.serviceRequirement.create)
        .mockResolvedValueOnce({
          id: 'sr-1',
          serviceId: 'service-123',
          requirementId: 'req-1',
          displayOrder: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'service-123',
          requirementId: 'req-2',
          displayOrder: 20,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' },
            { id: 'req-2', type: 'document' }
            // req-3 is NOT included, so it should be removed
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify DSX mappings were deleted for removed requirement
      expect(prisma.dSXMapping.deleteMany).toHaveBeenCalledWith({
        where: {
          serviceId: 'service-123',
          requirementId: {
            in: ['req-3']  // The removed requirement
          }
        }
      });
    });

    it('should assign new display orders to completely new requirements', async () => {
      // No existing requirements
      vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.serviceRequirement.deleteMany).mockResolvedValueOnce({ count: 0 });

      // Mock create operations for new requirements
      vi.mocked(prisma.serviceRequirement.create)
        .mockResolvedValueOnce({
          id: 'sr-1',
          serviceId: 'service-123',
          requirementId: 'req-1',
          displayOrder: 10,  // First new requirement gets 10
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'service-123',
          requirementId: 'req-2',
          displayOrder: 20,  // Second gets 20
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' },
            { id: 'req-2', type: 'document' }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
    });
  });

  describe('expected behavior after fix', () => {
    /**
     * This test shows what SHOULD happen after the bug is fixed
     * The endpoint should use canAccessDataRx() which checks for global_config
     */
    it('AFTER FIX: should allow user with global_config permission to associate requirements', async () => {
      const mockUser = {
        id: '1',
        permissions: {
          global_config: true
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // After fix, the endpoint should call canAccessDataRx() instead of hasPermission()
      // For now, we mock hasPermission to return false (current bug behavior)
      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'service-123',
          requirements: [
            { id: 'req-1', type: 'data-field' }
          ]
        })
      });

      const response = await POST(request);

      // Currently returns 403 (bug), should return 200 after fix
      expect(response.status).toBe(403);

      // After fix, this test would pass:
      // expect(response.status).toBe(200);
      // const data = await response.json();
      // expect(data.success).toBe(true);
    });
  });
});