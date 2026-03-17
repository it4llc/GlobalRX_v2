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
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
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
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden - Insufficient permissions');

      // Verify it checked using canAccessDataRx
      expect(canAccessDataRx).toHaveBeenCalledWith(mockUser);
    });

    it('should allow user with global_config permission to update field order', async () => {
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

      // Mock the transaction to succeed
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'sr-1',
              serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
              requirementId: 'req-1',
              displayOrder: 20
            }),
            update: vi.fn().mockResolvedValue({
              id: 'sr-1',
              serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
              requirementId: 'req-1',
              displayOrder: 1
            })
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

    it('should return 403 when vendor user tries to update field order', async () => {
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

    it('should update existing field orders successfully', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findFirst: vi.fn()
              .mockResolvedValueOnce({
                id: 'sr-1',
                requirementId: 'req-1',
                displayOrder: 30
              })
              .mockResolvedValueOnce({
                id: 'sr-2',
                requirementId: 'req-2',
                displayOrder: 40
              }),
            update: vi.fn()
              .mockResolvedValueOnce({
                id: 'sr-1',
                requirementId: 'req-1',
                displayOrder: 10
              })
              .mockResolvedValueOnce({
                id: 'sr-2',
                requirementId: 'req-2',
                displayOrder: 20
              })
          }
        };

        const result = await fn(tx);
        return result || {
          updated: [
            { requirementId: 'req-1', displayOrder: 10 },
            { requirementId: 'req-2', displayOrder: 20 }
          ],
          created: []
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
      expect(data.updated).toBe(2);
      expect(data.created).toBe(0);
    });

    it('should create missing service requirements', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        const tx = {
          serviceRequirement: {
            findFirst: vi.fn()
              .mockResolvedValueOnce({
                id: 'sr-1',
                requirementId: 'req-1',
                displayOrder: 30
              })
              .mockResolvedValueOnce(null), // req-2 doesn't exist
            update: vi.fn()
              .mockResolvedValueOnce({
                id: 'sr-1',
                requirementId: 'req-1',
                displayOrder: 10
              }),
            create: vi.fn().mockResolvedValueOnce({
              id: 'sr-new',
              serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
              requirementId: 'req-2',
              displayOrder: 20
            })
          }
        };

        const result = await fn(tx);
        return result || {
          updated: [
            { requirementId: 'req-1', displayOrder: 10 }
          ],
          created: [
            { requirementId: 'req-2', displayOrder: 20 }
          ]
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
      expect(data.updated).toBe(1);
      expect(data.created).toBe(1);
    });
  });
});