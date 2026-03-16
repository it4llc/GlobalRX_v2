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

// Mock auth-utils with the actual function used by the route
vi.mock('@/lib/auth-utils', () => ({
  canAccessDataRx: vi.fn()
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

// Import the mocked canAccessDataRx after mocking
import { canAccessDataRx } from '@/lib/auth-utils';

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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirements: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user lacks global_config permission', async () => {
      const mockUser = {
        id: '1',
        permissions: {
          candidate_workflow: true
          // NO global_config permission
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // canAccessDataRx returns false for users without global_config
      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirements: [
            { id: 'req-1', type: 'data-field' }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden - Insufficient permissions');

      // Verify it checked using canAccessDataRx
      expect(canAccessDataRx).toHaveBeenCalledWith(mockUser);
    });

    it('should allow user with global_config permission to associate requirements', async () => {
      const mockUser = {
        id: '1',
        userType: 'internal',
        permissions: {
          global_config: true
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // canAccessDataRx returns true for users with global_config
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);

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
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        requirementId: 'req-1',
        displayOrder: 30,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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

    it('should return 403 when vendor user tries to manage requirements', async () => {
      const mockUser = {
        id: '2',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: {
          fulfillment: true
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirements: [{ id: 'req-1' }]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should return 403 when customer user tries to manage requirements', async () => {
      const mockUser = {
        id: '3',
        userType: 'customer',
        customerId: 'customer-123',
        permissions: {
          candidate_workflow: true
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
        userType: 'internal',
        permissions: { global_config: true }
      };
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
        userType: 'internal',
        permissions: { global_config: true }
      };
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(canAccessDataRx).mockReturnValueOnce(true);
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-1',
          displayOrder: 100,  // Preserved
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-2',
          displayOrder: 200,  // Preserved
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-4',
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-4',
          displayOrder: 310,  // New requirement gets new order
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-1',
          displayOrder: 10,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-2',
          displayOrder: 20,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-1',
          displayOrder: 10,  // First new requirement gets 10
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          id: 'sr-2',
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-2',
          displayOrder: 20,  // Second gets 20
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const request = new Request('http://localhost:3000/api/dsx/associate-requirements', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
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
});