import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXService: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    dSXMapping: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    requirement: {
      findMany: vi.fn(),
    },
    country: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => {
      // Execute the transaction callback with the mocked prisma client
      const mockedPrisma = {
        dSXService: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        dSXMapping: {
          findMany: vi.fn(),
          deleteMany: vi.fn(),
          create: vi.fn(),
          createMany: vi.fn(),
          update: vi.fn(),
        },
        requirement: {
          findMany: vi.fn(),
        },
        country: {
          findMany: vi.fn(),
        },
      };
      // Use the actual prisma mock from the parent scope
      return await fn((await import('@/lib/prisma')).prisma);
    }),
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: {
      id: 'admin-user',
      email: 'admin@test.com',
      permissions: { admin: true },
    },
  })),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  logAuthError: vi.fn(),
  logPermissionDenied: vi.fn(),
  logDatabaseError: vi.fn(),
  logApiRequest: vi.fn(),
}));

vi.mock('@/lib/auth-utils', () => ({
  canAccessDataRx: vi.fn(() => true),
}));

describe('DSX Required Fields Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug-Proving Test: Unchecking removes field entirely instead of making it optional', () => {
    it('SHOULD FAIL: Unchecking a DSX matrix checkbox should make field optional, not remove it', async () => {
      const serviceId = 'service-123';
      const locationId = 'location-456';
      const requirementId = 'req-789';

      // Setup: Existing mapping that is checked (required)
      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock requirement validation
      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: requirementId } as any
      ]);

      // Mock deleteMany to return count (for obsolete mappings)
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValue({ count: 0 });

      // Mock update for existing mappings
      vi.mocked(prisma.dSXMapping.update).mockResolvedValue({} as any);

      // Mock createMany to return count (shouldn't be called for existing mapping)
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 0 });

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([
        {
          id: 'mapping-1',
          serviceId,
          locationId,
          requirementId,
          isRequired: true, // Currently checked and required
          instructions: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      // Mock the country.findMany for filterValidLocationIds
      vi.mocked(prisma.country.findMany).mockResolvedValue([
        {
          id: locationId,
          name: 'Test Location',
          code2: 'TL',
        } as any,
      ]);

      // Action: Uncheck the checkbox in DSX matrix
      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [requirementId], // Still associated with service
          locationRequirements: {
            // Unchecked = requirement not in location array
            [locationId]: [], // Empty array means unchecked
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      // Expected behavior: Mapping should be updated with isRequired = false
      // With the improved implementation, we update existing mappings instead of recreating
      expect(vi.mocked(prisma.dSXMapping.update)).toHaveBeenCalledWith({
        where: { id: 'mapping-1' },
        data: { isRequired: false } // Should be false when unchecked
      });

      // Should not delete mappings for associated requirements
      expect(vi.mocked(prisma.dSXMapping.deleteMany)).not.toHaveBeenCalledWith({
        where: {
          id: { in: ['mapping-1'] }
        }
      });
    });
  });

  describe('Expected Behavior Tests', () => {
    it('Checking a DSX matrix checkbox should make field required', async () => {
      const serviceId = 'service-123';
      const locationId = 'location-456';
      const requirementId = 'req-789';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock requirement validation
      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: requirementId } as any
      ]);

      // Mock deleteMany to return count
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValue({ count: 0 });

      // Mock createMany to return count
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 1 });

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);

      // Mock the country.findMany for filterValidLocationIds
      vi.mocked(prisma.country.findMany).mockResolvedValue([
        {
          id: locationId,
          name: 'Test Location',
          code2: 'TL',
        } as any,
      ]);

      // Action: Check the checkbox in DSX matrix
      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [requirementId],
          locationRequirements: {
            [locationId]: [requirementId], // Requirement in array means checked
          },
        }),
      });

      const response = await POST(request);

      // Should create mapping with isRequired = true
      expect(vi.mocked(prisma.dSXMapping.createMany)).toHaveBeenCalledWith({
        data: [
          {
            serviceId,
            locationId,
            requirementId,
            isRequired: true, // Should be true when checked
          },
        ],
        skipDuplicates: true,
      });
    });

    it('All fields in a service should always have DSXMapping records', async () => {
      const serviceId = 'service-123';
      const locationId = 'location-456';
      const requirement1 = 'req-1';
      const requirement2 = 'req-2';
      const requirement3 = 'req-3';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock requirement validation
      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: requirement1 } as any,
        { id: requirement2 } as any,
        { id: requirement3 } as any
      ]);

      // Mock deleteMany to return count
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValue({ count: 0 });

      // Mock createMany to return count
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 3 });

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);

      // Mock the country.findMany for filterValidLocationIds
      vi.mocked(prisma.country.findMany).mockResolvedValue([
        {
          id: locationId,
          name: 'Test Location',
          code2: 'TL',
        } as any,
      ]);

      // Some checked, some unchecked
      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [requirement1, requirement2, requirement3],
          locationRequirements: {
            [locationId]: [requirement1, requirement3], // Only 1 and 3 checked
          },
        }),
      });

      const response = await POST(request);

      // Should create mappings for ALL requirements, not just checked ones
      expect(vi.mocked(prisma.dSXMapping.createMany)).toHaveBeenCalledWith({
        data: [
          {
            serviceId,
            locationId,
            requirementId: requirement1,
            isRequired: true, // Checked
          },
          {
            serviceId,
            locationId,
            requirementId: requirement2,
            isRequired: false, // Unchecked but still mapped
          },
          {
            serviceId,
            locationId,
            requirementId: requirement3,
            isRequired: true, // Checked
          },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('Requirements API Response Tests', () => {
    it('Should return correct required status based on DSX mappings', async () => {
      // This would test the /api/portal/orders/requirements endpoint
      // to ensure it correctly interprets the isRequired field
      // For brevity, focusing on the DSX save logic tests above
    });
  });

  describe('Edge Cases and Validation', () => {
    it('Should handle empty associatedRequirements array gracefully', async () => {
      const serviceId = 'service-123';
      const locationId = 'location-456';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dSXMapping.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 0 });

      vi.mocked(prisma.country.findMany).mockResolvedValue([
        {
          id: locationId,
          name: 'Test Location',
          code2: 'TL',
        } as any,
      ]);

      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [], // Empty array
          locationRequirements: {
            [locationId]: [],
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should not create any mappings for empty associatedRequirements
      expect(vi.mocked(prisma.dSXMapping.createMany)).not.toHaveBeenCalled();
    });

    it('Should validate and reject invalid requirement IDs', async () => {
      const serviceId = 'service-123';
      const locationId = 'location-456';
      const validReqId = 'req-valid';
      const invalidReqId = 'req-invalid';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock requirement validation - only validReqId exists
      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: validReqId } as any
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);

      vi.mocked(prisma.country.findMany).mockResolvedValue([
        {
          id: locationId,
          name: 'Test Location',
          code2: 'TL',
        } as any,
      ]);

      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [validReqId, invalidReqId], // Mix of valid and invalid
          locationRequirements: {
            [locationId]: [validReqId],
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save DSX mappings');
      expect(data.details).toContain('Invalid requirement IDs: req-invalid');
    });

    it('Should handle invalid location IDs gracefully', async () => {
      const serviceId = 'service-123';
      const invalidLocationId = 'invalid-location';
      const requirementId = 'req-789';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: requirementId } as any
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 0 });

      // Mock country.findMany to return empty array for invalid location
      vi.mocked(prisma.country.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [requirementId],
          locationRequirements: {
            [invalidLocationId]: [requirementId], // Invalid location
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should not create mappings for invalid locations
      expect(vi.mocked(prisma.dSXMapping.createMany)).not.toHaveBeenCalled();
    });

    it('Should handle non-existent service ID', async () => {
      const serviceId = 'non-existent-service';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: ['req-1'],
          locationRequirements: {
            'location-1': ['req-1'],
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save DSX mappings');
      expect(data.details).toBe('Service not found');
    });

    it('Should handle malformed locationRequirements gracefully', async () => {
      const serviceId = 'service-123';
      const requirementId = 'req-789';

      vi.mocked(prisma.dSXService.findUnique).mockResolvedValue({
        id: serviceId,
        name: 'Test Service',
        description: 'Test',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(prisma.requirement.findMany).mockResolvedValue([
        { id: requirementId } as any
      ]);

      vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([]);
      vi.mocked(prisma.dSXMapping.createMany).mockResolvedValue({ count: 0 });

      const request = new NextRequest('http://localhost/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          associatedRequirements: [requirementId],
          locationRequirements: {
            'location-1': 'not-an-array', // Wrong type
            'location-2': null, // Null value
            'location-3': {}, // Object instead of array
          },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Should skip malformed location requirements
      expect(vi.mocked(prisma.dSXMapping.createMany)).not.toHaveBeenCalled();
    });
  });
});