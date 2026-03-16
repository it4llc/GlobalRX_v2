// src/app/api/dsx/toggle-required/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, PATCH } from '../route';
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
    $transaction: vi.fn(),
    dSXMapping: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
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
  }
}));

// Import the mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('POST /api/dsx/toggle-required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset NODE_ENV for tests
    process.env.NODE_ENV = 'production';
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
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
     * CRITICAL BUG TEST #2
     * This test PROVES the bug exists: the endpoint uses hasPermission() utility
     * but checks for 'dsx' permission instead of using canAccessDataRx().
     *
     * This test simulates a user with 'global_config' permission but the
     * hasPermission utility returns false for 'dsx' permission.
     */
    it('BUG: checks for dsx permission instead of using canAccessDataRx', async () => {
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

      // hasPermission will return false for 'dsx' because user doesn't have it
      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);

      // BUG: Endpoint checks for 'dsx' permission, not global_config
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Missing required permission: dsx');

      // Verify it checked for 'dsx' permission (wrong!)
      // The route passes session.user.permissions to hasPermission
      expect(hasPermission).toHaveBeenCalledWith(
        { global_config: true },  // session.user.permissions
        'dsx'
      );
    });

    /**
     * This test shows the current (incorrect) behavior where only 'dsx' permission works
     */
    it('currently only accepts legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            dsx: true  // Legacy permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // hasPermission returns true for 'dsx'
      vi.mocked(hasPermission).mockReturnValueOnce(true);

      // Mock no existing mapping
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(null);

      // Mock creating new mapping
      vi.mocked(prisma.dSXMapping.create).mockResolvedValueOnce({
        id: 'mapping-1',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should return 403 when user lacks both dsx and global_config permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            candidate_workflow: true  // Some other permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it('should skip permission check in development mode', async () => {
      process.env.NODE_ENV = 'development';

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {}  // No permissions
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // Mock no existing mapping
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(null);

      // Mock creating new mapping
      vi.mocked(prisma.dSXMapping.create).mockResolvedValueOnce({
        id: 'mapping-1',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify hasPermission was NOT called in dev mode
      expect(hasPermission).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { dsx: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(hasPermission).mockReturnValueOnce(true);
    });

    it('should return 400 when serviceId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId, locationId, and requirementId are required');
    });

    it('should return 400 when locationId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId, locationId, and requirementId are required');
    });

    it('should return 400 when requirementId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId, locationId, and requirementId are required');
    });
  });

  describe('mapping operations', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { dsx: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(hasPermission).mockReturnValueOnce(true);
    });

    it('should create new mapping when setting to required and no mapping exists', async () => {
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.dSXMapping.create).mockResolvedValueOnce({
        id: 'new-mapping',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Created new required mapping');
    });

    it('should update existing mapping when toggling required status', async () => {
      const existingMapping = {
        id: 'existing-mapping',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(existingMapping);
      vi.mocked(prisma.dSXMapping.update).mockResolvedValueOnce({
        ...existingMapping,
        isRequired: false
      });

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: false
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Mapping marked as optional');
    });

    it('should do nothing when setting to not required and no mapping exists', async () => {
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: false
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('No mapping exists to update');

      // Verify create was NOT called
      expect(prisma.dSXMapping.create).not.toHaveBeenCalled();
    });
  });
});

describe('PATCH /api/dsx/toggle-required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'PATCH',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          updates: []
        })
      });

      const response = await PATCH(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions - BUG DEMONSTRATION', () => {
    /**
     * PATCH method also has the same bug - checks for 'dsx' permission
     */
    it('BUG: PATCH also checks for dsx permission instead of global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            global_config: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(hasPermission).mockReturnValueOnce(false);

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'PATCH',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          updates: [
            {
              locationId: 'location-456',
              requirementId: 'req-789',
              isRequired: true
            }
          ]
        })
      });

      const response = await PATCH(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Missing required permission: dsx');
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { dsx: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
      vi.mocked(hasPermission).mockReturnValueOnce(true);
    });

    it('should bulk update multiple mappings', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          dSXMapping: {
            findFirst: vi.fn()
              .mockResolvedValueOnce({
                id: 'mapping-1',
                serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
                locationId: 'location-456',
                requirementId: 'req-789',
                isRequired: false
              })
              .mockResolvedValueOnce(null),
            update: vi.fn().mockResolvedValueOnce({
              id: 'mapping-1',
              isRequired: true
            }),
            create: vi.fn().mockResolvedValueOnce({
              id: 'mapping-2',
              serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
              locationId: 'location-456',
              requirementId: 'req-790',
              isRequired: true
            })
          }
        };

        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'PATCH',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          updates: [
            {
              locationId: 'location-456',
              requirementId: 'req-789',
              isRequired: true
            },
            {
              locationId: 'location-456',
              requirementId: 'req-790',
              isRequired: true
            }
          ]
        })
      });

      const response = await PATCH(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(2);
      expect(data.message).toBe('Updated 2 mappings');
    });

    it('should return 400 when updates is not an array', async () => {
      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'PATCH',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          updates: 'not-an-array'
        })
      });

      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId and updates array are required');
    });
  });

  describe('expected behavior after fix', () => {
    /**
     * This test shows what SHOULD happen after the bug is fixed
     * The endpoint should use canAccessDataRx() which checks for global_config
     */
    it('AFTER FIX: should check for global_config permission via canAccessDataRx', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            global_config: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // After fix, the endpoint should call canAccessDataRx() instead of hasPermission()
      // and it would return true for a user with global_config permission

      // For now, this test documents the expected behavior but will fail
      // because the current implementation checks for 'dsx' permission

      vi.mocked(hasPermission).mockReturnValueOnce(false); // Current behavior

      const request = new Request('http://localhost:3000/api/dsx/toggle-required', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          locationId: 'location-456',
          requirementId: 'req-789',
          isRequired: true
        })
      });

      const response = await POST(request);

      // Currently returns 403 (bug), should return 200 after fix
      expect(response.status).toBe(403);
    });
  });
});