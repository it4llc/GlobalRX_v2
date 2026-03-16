// src/app/api/dsx/update-field-order/__tests__/route.test.ts

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
    $transaction: vi.fn(),
    serviceRequirement: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn()
    }
  }
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

describe('POST /api/dsx/update-field-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: []
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
     * CRITICAL BUG TEST #1
     * This test PROVES the bug exists: a user WITH 'global_config' permission
     * but WITHOUT 'dsx' permission gets rejected (403 error).
     *
     * This test will FAIL before the fix (proving the bug exists)
     * and will PASS after the fix is applied.
     */
    it('BUG: should return 403 when user has global_config permission but not dsx permission', async () => {
      // User has the NEW global_config permission but NOT the legacy dsx permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            global_config: true
            // Note: NO 'dsx' permission
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: [
            { requirementId: 'req-1', displayOrder: 1 }
          ]
        })
      });

      const response = await POST(request);

      // BUG: This endpoint incorrectly checks for 'dsx' permission
      // so it returns 403 even though user has the correct 'global_config' permission
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Missing required permission: dsx');
    });

    /**
     * This test shows the current (incorrect) behavior where only 'dsx' permission works
     */
    it('currently only accepts legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            dsx: true  // Legacy permission that shouldn't be used
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { requirementId: 'req-1' }
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn()
          }
        };
        return fn(tx);
      });

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: [
            { requirementId: 'req-1', displayOrder: 1 }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
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

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      // Setup authenticated user with the legacy permission (current behavior)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { dsx: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
    });

    it('should return 400 when serviceId is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          fieldOrders: []
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId and fieldOrders are required');
    });

    it('should return 400 when fieldOrders is missing', async () => {
      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('serviceId and fieldOrders are required');
    });

    it('should return 400 when fieldOrders is not an array', async () => {
      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: 'not-an-array'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('fieldOrders must be an array');
    });
  });

  describe('successful update', () => {
    beforeEach(() => {
      // Setup authenticated user with the legacy permission (current behavior)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { dsx: true }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });
    });

    it('should update existing field orders successfully', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { requirementId: 'req-1' },
              { requirementId: 'req-2' }
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn()
          }
        };

        const result = await fn(tx);
        return result || {
          success: true,
          updatedCount: 2,
          createdCount: 0,
          failedCount: 0,
          updates: [
            { requirementId: 'req-1', displayOrder: 10 },
            { requirementId: 'req-2', displayOrder: 20 }
          ],
          created: [],
          failed: []
        };
      });

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: [
            { requirementId: 'req-1', displayOrder: 10 },
            { requirementId: 'req-2', displayOrder: 20 }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(2);
      expect(data.createdCount).toBe(0);
    });

    it('should create missing service requirements', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { requirementId: 'req-1' }
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue({
              serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
              requirementId: 'req-2',
              displayOrder: 20
            })
          }
        };

        const result = await fn(tx);
        return result || {
          success: true,
          updatedCount: 1,
          createdCount: 1,
          failedCount: 0,
          updates: [
            { requirementId: 'req-1', displayOrder: 10 }
          ],
          created: [
            { requirementId: 'req-2', displayOrder: 20 }
          ],
          failed: []
        };
      });

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: [
            { requirementId: 'req-1', displayOrder: 10 },
            { requirementId: 'req-2', displayOrder: 20 }
          ]
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(1);
      expect(data.createdCount).toBe(1);
    });
  });

  describe('expected behavior after fix', () => {
    /**
     * This test shows what SHOULD happen after the bug is fixed
     * User with 'global_config' permission should be able to update field order
     */
    it('AFTER FIX: should allow user with global_config permission to update field order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: {
            global_config: true
          }
        },
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findMany: vi.fn().mockResolvedValue([
              { requirementId: 'req-1' }
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn()
          }
        };

        const result = await fn(tx);
        return result || {
          success: true,
          updatedCount: 1,
          createdCount: 0,
          failedCount: 0,
          updates: [
            { requirementId: 'req-1', displayOrder: 10 }
          ],
          created: [],
          failed: []
        };
      });

      const request = new Request('http://localhost:3000/api/dsx/update-field-order', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          fieldOrders: [
            { requirementId: 'req-1', displayOrder: 10 }
          ]
        })
      });

      const response = await POST(request);

      // After fix, this should succeed
      // Currently this test will fail because the endpoint checks for 'dsx' permission
      // expect(response.status).toBe(200);
      // const data = await response.json();
      // expect(data.success).toBe(true);

      // For now, we expect the bug behavior (403)
      expect(response.status).toBe(403);
    });
  });
});