// /GlobalRX_v2/src/app/api/data-rx/locations/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXLocation: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  logDatabaseError: vi.fn()
}));

describe('GET /api/data-rx/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permission checks - global_config permission', () => {
    it('should allow access for user with global_config permission as wildcard', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });

      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.locations).toBeDefined();
    });

    it('should allow access for user with global_config as true', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should allow access for user with global_config as array', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: ['*'] }
        }
      });

      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('permission checks - legacy dsx permission (no longer supported)', () => {
    it('should return 403 for user with legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '4',
          type: 'internal',
          permissions: { dsx: true }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });

    it('should return 403 for user with dsx as wildcard', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '5',
          type: 'internal',
          permissions: { dsx: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should return 403 for user with dsx as array', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '6',
          type: 'internal',
          permissions: { dsx: ['*'] }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('permission checks - combined permissions', () => {
    it('should allow access for user with global_config even if they also have dsx', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '7',
          type: 'internal',
          permissions: {
            global_config: '*',
            dsx: true  // This is ignored, only global_config matters
          }
        }
      });

      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('permission checks - user type restrictions', () => {
    it('should deny access for vendor users even with global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '8',
          type: 'vendor',
          vendorId: 'vendor-123',
          permissions: { global_config: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should deny access for customer users even with global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '9',
          type: 'customer',
          customerId: 'customer-123',
          permissions: { global_config: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should deny access for internal users without proper permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '10',
          type: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '11',
          type: 'internal',
          permissions: { global_config: '*' }  // Use correct permission
        }
      });
    });

    it('should return all locations', async () => {
      const mockLocations = [
        {
          id: 'loc1',
          name: 'Location 1',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          disabled: false
        },
        {
          id: 'loc2',
          name: 'Location 2',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          disabled: false
        }
      ];

      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce(mockLocations);

      const request = new Request('http://localhost:3000/api/data-rx/locations');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.locations).toHaveLength(2);
      expect(data.locations[0].name).toBe('Location 1');
    });

    it('should filter by disabled status when includeDisabled=false', async () => {
      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations?includeDisabled=false');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXLocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { disabled: false }
        })
      );
    });

    it('should include all locations when includeDisabled=true', async () => {
      vi.mocked(prisma.dSXLocation.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/locations?includeDisabled=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXLocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}
        })
      );
    });
  });
});

describe('POST /api/data-rx/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
          address: '789 Elm St',
          city: 'Chicago',
          state: 'IL',
          zip: '60601'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('permission checks - global_config permission', () => {
    it('should allow access for user with global_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });

      const newLocation = {
        id: 'new-loc',
        name: 'New Location',
        address: '789 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        disabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXLocation.create).mockResolvedValueOnce(newLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
          address: '789 Elm St',
          city: 'Chicago',
          state: 'IL',
          zip: '60601'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('permission checks - legacy dsx permission', () => {
    it('should return 403 for user with legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { dsx: true }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
          address: '789 Elm St',
          city: 'Chicago',
          state: 'IL',
          zip: '60601'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Incomplete Location'
          // Missing address, city, state, zip
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('required');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: 'not json'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '4',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should create a new location with valid data', async () => {
      const newLocation = {
        id: 'new-loc',
        name: 'New Location',
        address: '789 Elm St',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        disabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXLocation.create).mockResolvedValueOnce(newLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Location',
          address: '789 Elm St',
          city: 'Chicago',
          state: 'IL',
          zip: '60601'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('New Location');
      expect(data.city).toBe('Chicago');
    });

    it('should handle database unique constraint errors', async () => {
      vi.mocked(prisma.dSXLocation.create).mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['name'] }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Location',
          address: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });
});

describe('PUT /api/data-rx/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'loc-123',
          name: 'Updated Location'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(401);
    });
  });

  describe('permission checks - global_config permission', () => {
    it('should allow access for user with global_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });

      const updatedLocation = {
        id: 'loc-123',
        name: 'Updated Location',
        address: '999 Park Ave',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
        disabled: false,
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXLocation.update).mockResolvedValueOnce(updatedLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'loc-123',
          name: 'Updated Location',
          address: '999 Park Ave',
          city: 'Boston',
          state: 'MA',
          zip: '02101'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
    });
  });

  describe('permission checks - legacy dsx permission', () => {
    it('should return 403 for user with legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { dsx: true }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'loc-123',
          name: 'Updated Location'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should return 400 when location ID is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Location'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Location ID is required');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '4',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should update location with valid data', async () => {
      const updatedLocation = {
        id: 'loc-123',
        name: 'Updated Location',
        address: '999 Park Ave',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
        disabled: false,
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXLocation.update).mockResolvedValueOnce(updatedLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'loc-123',
          name: 'Updated Location',
          address: '999 Park Ave',
          city: 'Boston',
          state: 'MA',
          zip: '02101'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Location');
      expect(data.city).toBe('Boston');
    });
  });
});

describe('DELETE /api/data-rx/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/locations?id=loc-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });
  });

  describe('permission checks - global_config permission', () => {
    it('should allow access for user with global_config permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });

      const disabledLocation = {
        id: 'loc-123',
        name: 'Location',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        disabled: true
      };

      vi.mocked(prisma.dSXLocation.update).mockResolvedValueOnce(disabledLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations?id=loc-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);
    });
  });

  describe('permission checks - legacy dsx permission', () => {
    it('should return 403 for user with legacy dsx permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { dsx: true }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/locations?id=loc-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should return 400 when location ID is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/locations', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Location ID is required');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '4',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should disable location instead of hard delete', async () => {
      const disabledLocation = {
        id: 'loc-123',
        name: 'Location',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        disabled: true
      };

      vi.mocked(prisma.dSXLocation.update).mockResolvedValueOnce(disabledLocation);

      const request = new Request('http://localhost:3000/api/data-rx/locations?id=loc-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      expect(prisma.dSXLocation.update).toHaveBeenCalledWith({
        where: { id: 'loc-123' },
        data: { disabled: true }
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Location disabled successfully');
    });
  });
});