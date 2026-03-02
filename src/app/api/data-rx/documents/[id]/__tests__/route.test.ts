// /GlobalRX_v2/src/app/api/data-rx/documents/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXRequirement: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
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

describe('GET /api/data-rx/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

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

      const mockDocument = {
        id: 'doc-123',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false,
        serviceRequirements: []
      };

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(mockDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('doc-123');
    });

    it('should allow access for user with global_config as true', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: 'doc-123',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

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

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce({
        id: 'doc-123',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

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

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

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

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(403);
    });
  });

  describe('permission checks - user type restrictions', () => {
    it('should deny access for vendor users even with global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '6',
          type: 'vendor',
          vendorId: 'vendor-123',
          permissions: { global_config: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(403);
    });

    it('should deny access for customer users even with global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '7',
          type: 'customer',
          customerId: 'customer-123',
          permissions: { global_config: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(403);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '8',
          type: 'internal',
          permissions: { global_config: '*' }  // Use correct permission
        }
      });
    });

    it('should return 404 when document does not exist', async () => {
      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents/nonexistent');
      const params = { params: { id: 'nonexistent' } };
      const response = await GET(request, params);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Document not found');
    });

    it('should include services when includeServices=true', async () => {
      const mockDocument = {
        id: 'doc-123',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false,
        serviceRequirements: [
          {
            service: {
              id: 'service-1',
              name: 'Service 1'
            }
          }
        ]
      };

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(mockDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123?includeServices=true');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            serviceRequirements: {
              include: {
                service: true
              }
            }
          })
        })
      );
    });

    it('should add documentName alias for frontend compatibility', async () => {
      const mockDocument = {
        id: 'doc-123',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.findUnique).mockResolvedValueOnce(mockDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123');
      const params = { params: { id: 'doc-123' } };
      const response = await GET(request, params);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documentName).toBe('Test Document');
    });
  });
});

describe('PUT /api/data-rx/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

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

      const updatedDocument = {
        id: 'doc-123',
        name: 'Updated Document',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(updatedDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Document' })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

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

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

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

    it('should return 400 when body is invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: 'not json'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
    });

    it('should return 400 when document name is empty', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({ name: '' })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Document name is required');
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

    it('should update document with valid data', async () => {
      const updatedDocument = {
        id: 'doc-123',
        name: 'Updated Document',
        type: 'document',
        documentData: {
          instructions: 'New instructions',
          scope: 'New scope',
          retentionHandling: 'no_delete'
        },
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(updatedDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Document',
          instructions: 'New instructions',
          scope: 'New scope'
        })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documentName).toBe('Updated Document');
    });

    it('should handle documentName field from frontend', async () => {
      const updatedDocument = {
        id: 'doc-123',
        name: 'Frontend Update',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(updatedDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'PUT',
        body: JSON.stringify({
          documentName: 'Frontend Update'  // Frontend field name
        })
      });
      const params = { params: { id: 'doc-123' } };
      const response = await PUT(request, params);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: expect.objectContaining({
          name: 'Frontend Update'
        })
      });
    });
  });
});

describe('DELETE /api/data-rx/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'DELETE'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await DELETE(request, params);

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

      const disabledDocument = {
        id: 'doc-123',
        name: 'Document',
        type: 'document',
        documentData: {},
        disabled: true
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(disabledDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'DELETE'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await DELETE(request, params);

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

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'DELETE'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await DELETE(request, params);

      expect(response.status).toBe(403);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should disable document instead of hard delete', async () => {
      const disabledDocument = {
        id: 'doc-123',
        name: 'Document',
        type: 'document',
        documentData: {},
        disabled: true
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(disabledDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'DELETE'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await DELETE(request, params);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { disabled: true }
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Document disabled successfully');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.dSXRequirement.update).mockRejectedValueOnce(
        new Error('Database connection error')
      );

      const request = new Request('http://localhost:3000/api/data-rx/documents/doc-123', {
        method: 'DELETE'
      });
      const params = { params: { id: 'doc-123' } };
      const response = await DELETE(request, params);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Database error');
    });
  });
});