// /GlobalRX_v2/src/app/api/data-rx/templates/__tests__/route.test.ts

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
    dSXTemplate: {
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

describe('GET /api/data-rx/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templates).toBeDefined();
    });

    it('should allow access for user with global_config as true', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
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

      const request = new Request('http://localhost:3000/api/data-rx/templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('query parameters and business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '11',
          type: 'internal',
          permissions: { global_config: '*' }  // Use correct permission
        }
      });
    });

    it('should return all templates', async () => {
      const mockTemplates = [
        {
          id: 'template1',
          name: 'Background Check Template',
          type: 'standard',
          description: 'Standard background check',
          requirements: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'template2',
          name: 'Drug Screening Template',
          type: 'drug_test',
          description: 'Drug screening requirements',
          requirements: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce(mockTemplates);

      const request = new Request('http://localhost:3000/api/data-rx/templates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templates).toHaveLength(2);
      expect(data.templates[0].name).toBe('Background Check Template');
    });

    it('should filter by type when provided', async () => {
      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates?type=standard');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'standard' }
        })
      );
    });

    it('should filter by active status', async () => {
      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates?active=false');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false }
        })
      );
    });

    it('should include requirements when includeRequirements=true', async () => {
      vi.mocked(prisma.dSXTemplate.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/templates?includeRequirements=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            requirements: true
          }
        })
      );
    });
  });
});

describe('POST /api/data-rx/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Template',
          type: 'standard',
          description: 'A new template'
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

      const newTemplate = {
        id: 'new-template',
        name: 'New Template',
        type: 'standard',
        description: 'A new template',
        requirements: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.create).mockResolvedValueOnce(newTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Template',
          type: 'standard',
          description: 'A new template'
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

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Template',
          type: 'standard',
          description: 'A new template'
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

    it('should return 400 when template name is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          type: 'standard',
          description: 'Missing name'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('name');
    });

    it('should return 400 when template type is invalid', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Invalid Type Template',
          type: 'invalid_type',
          description: 'Template with invalid type'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('type');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/templates', {
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

    it('should create a new template with valid data', async () => {
      const newTemplate = {
        id: 'new-template',
        name: 'New Template',
        type: 'standard',
        description: 'A new template',
        requirements: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.create).mockResolvedValueOnce(newTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Template',
          type: 'standard',
          description: 'A new template'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.name).toBe('New Template');
      expect(data.type).toBe('standard');
    });

    it('should create template with requirements array', async () => {
      const newTemplate = {
        id: 'new-template',
        name: 'Template with Requirements',
        type: 'standard',
        description: 'Has requirements',
        requirements: ['req1', 'req2'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.create).mockResolvedValueOnce(newTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Template with Requirements',
          type: 'standard',
          description: 'Has requirements',
          requirements: ['req1', 'req2']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.requirements).toEqual(['req1', 'req2']);
    });

    it('should handle database unique constraint errors', async () => {
      vi.mocked(prisma.dSXTemplate.create).mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['name'] }
      });

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate Template',
          type: 'standard',
          description: 'Already exists'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });
  });
});

describe('PUT /api/data-rx/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'template-123',
          name: 'Updated Template'
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

      const updatedTemplate = {
        id: 'template-123',
        name: 'Updated Template',
        type: 'standard',
        description: 'Updated description',
        requirements: [],
        isActive: false,
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.update).mockResolvedValueOnce(updatedTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'template-123',
          name: 'Updated Template',
          description: 'Updated description',
          isActive: false
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

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'template-123',
          name: 'Updated Template'
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

    it('should return 400 when template ID is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Template'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Template ID is required');
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

    it('should update template with valid data', async () => {
      const updatedTemplate = {
        id: 'template-123',
        name: 'Updated Template',
        type: 'standard',
        description: 'Updated description',
        requirements: [],
        isActive: false,
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.update).mockResolvedValueOnce(updatedTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'template-123',
          name: 'Updated Template',
          description: 'Updated description',
          isActive: false
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Template');
      expect(data.isActive).toBe(false);
    });

    it('should update only provided fields', async () => {
      const updatedTemplate = {
        id: 'template-123',
        name: 'Original Name',
        type: 'standard',
        description: 'New description only',
        requirements: [],
        isActive: true,
        updatedAt: new Date()
      };

      vi.mocked(prisma.dSXTemplate.update).mockResolvedValueOnce(updatedTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'PUT',
        body: JSON.stringify({
          id: 'template-123',
          description: 'New description only'
        })
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);
      expect(prisma.dSXTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: expect.objectContaining({
          description: 'New description only'
        })
      });
    });
  });
});

describe('DELETE /api/data-rx/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/templates?id=template-123', {
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

      const deactivatedTemplate = {
        id: 'template-123',
        name: 'Template',
        type: 'standard',
        description: 'Template description',
        requirements: [],
        isActive: false
      };

      vi.mocked(prisma.dSXTemplate.update).mockResolvedValueOnce(deactivatedTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates?id=template-123', {
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

      const request = new Request('http://localhost:3000/api/data-rx/templates?id=template-123', {
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

    it('should return 400 when template ID is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/templates', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Template ID is required');
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

    it('should deactivate template instead of hard delete', async () => {
      const deactivatedTemplate = {
        id: 'template-123',
        name: 'Template',
        type: 'standard',
        description: 'Template description',
        requirements: [],
        isActive: false
      };

      vi.mocked(prisma.dSXTemplate.update).mockResolvedValueOnce(deactivatedTemplate);

      const request = new Request('http://localhost:3000/api/data-rx/templates?id=template-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);
      expect(prisma.dSXTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { isActive: false }
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Template deactivated successfully');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.dSXTemplate.update).mockRejectedValueOnce(
        new Error('Database connection error')
      );

      const request = new Request('http://localhost:3000/api/data-rx/templates?id=template-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Database error');
    });
  });
});