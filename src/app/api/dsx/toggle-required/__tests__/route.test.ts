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
  }
}));

// Import the mocked canAccessDataRx after mocking
import { canAccessDataRx } from '@/lib/auth-utils';

describe('POST /api/dsx/toggle-required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('permissions', () => {
    it('should return 403 when user lacks global_config permission', async () => {
      // User has NO global_config permission
      const mockUser = {
        id: '1',
        permissions: {
          candidate_workflow: true
          // Note: NO global_config permission
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString()
      });

      // canAccessDataRx returns false for users without global_config
      vi.mocked(canAccessDataRx).mockReturnValueOnce(false);

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
      const data = await response.json();
      expect(data.error).toBe('Forbidden - Insufficient permissions');

      // Verify it checked using canAccessDataRx
      expect(canAccessDataRx).toHaveBeenCalledWith(mockUser);
    });

    it('should allow user with global_config permission to toggle requirements', async () => {
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
      expect(data.message).toBe('Created new required mapping');
    });

    it('should return 403 when vendor user tries to toggle requirements', async () => {
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

    it('should return 403 when customer user tries to toggle requirements', async () => {
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
      expect(data.error).toContain('Missing required parameters');
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
      expect(data.error).toContain('Missing required parameters');
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
      expect(data.error).toContain('Missing required parameters');
    });
  });

  describe('toggling logic', () => {
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

    it('should create new mapping when none exists and setting to required', async () => {
      // No existing mapping
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce(null);

      // Mock creating new mapping
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
      expect(data.mapping.id).toBe('new-mapping');
    });

    it('should not create mapping when none exists and setting to not required', async () => {
      // No existing mapping
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
      expect(prisma.dSXMapping.create).not.toHaveBeenCalled();
    });

    it('should update existing mapping to required', async () => {
      // Existing mapping
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce({
        id: 'existing-mapping',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock updating mapping
      vi.mocked(prisma.dSXMapping.update).mockResolvedValueOnce({
        id: 'existing-mapping',
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
      expect(data.message).toBe('Mapping marked as required');
      expect(data.mapping.isRequired).toBe(true);
    });

    it('should update existing mapping to optional', async () => {
      // Existing mapping
      vi.mocked(prisma.dSXMapping.findFirst).mockResolvedValueOnce({
        id: 'existing-mapping',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock updating mapping
      vi.mocked(prisma.dSXMapping.update).mockResolvedValueOnce({
        id: 'existing-mapping',
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        locationId: 'location-456',
        requirementId: 'req-789',
        isRequired: false,
        createdAt: new Date(),
        updatedAt: new Date()
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
      expect(data.mapping.isRequired).toBe(false);
    });
  });
});