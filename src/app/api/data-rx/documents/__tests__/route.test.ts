// /GlobalRX_v2/src/app/api/data-rx/documents/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSXRequirement: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
    error: vi.fn()
  },
  logDatabaseError: vi.fn()
}));

describe('GET /api/data-rx/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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

      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/documents');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documents).toBeDefined();
    });

    it('should allow access for user with global_config as true', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'internal',
          permissions: { global_config: true }
        }
      });

      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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

      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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
          permissions: { dsx: true }  // Legacy permission no longer supported
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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

      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/data-rx/documents');
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
          permissions: { global_config: '*' }  // Vendor shouldn't have this
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should deny access for customer users even with global_config', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '9',
          type: 'customer',
          customerId: 'customer-123',
          permissions: { global_config: '*' }  // Customer shouldn't have this
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('should deny access for internal users without proper permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '10',
          type: 'internal',
          permissions: { candidate_workflow: true }  // Wrong permission
        }
      });

      const request = new Request('http://localhost:3000/api/data-rx/documents');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('query parameters and business logic', () => {
    beforeEach(() => {
      // Set up a valid session for business logic tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '11',
          type: 'internal',
          permissions: { global_config: '*' }  // Use the correct permission
        }
      });
    });

    it('should filter documents by serviceId when provided', async () => {
      const mockDocuments = [
        {
          id: 'doc1',
          name: 'Document 1',
          type: 'document',
          disabled: false,
          documentData: {},
          serviceRequirements: []
        }
      ];

      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce(mockDocuments);

      const request = new Request('http://localhost:3000/api/data-rx/documents?serviceId=c47ac10b-58cc-4372-a567-0e02b2c3d479');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceRequirements: {
              some: {
                serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
              }
            }
          })
        })
      );
    });

    it('should include disabled documents when includeDisabled=true', async () => {
      const mockDocuments = [];
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce(mockDocuments);

      const request = new Request('http://localhost:3000/api/data-rx/documents?includeDisabled=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'document'
            // Note: disabled filter should not be present
          })
        })
      );
    });

    it('should include services when includeServices=true', async () => {
      const mockDocuments = [];
      vi.mocked(prisma.dSXRequirement.findMany).mockResolvedValueOnce(mockDocuments);

      const request = new Request('http://localhost:3000/api/data-rx/documents?includeServices=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.findMany).toHaveBeenCalledWith(
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
  });
});

describe('POST /api/data-rx/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Document'
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

      const newDocument = {
        id: 'new-doc',
        name: 'Test Document',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.create).mockResolvedValueOnce(newDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Document'
        })
      });

      const response = await POST(request);
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

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Document'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      // Use valid permission for validation tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          type: 'internal',
          permissions: { global_config: '*' }
        }
      });
    });

    it('should return 400 when document name is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          instructions: 'Some instructions'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Document name is required');
    });

    it('should return 400 when body is invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/documents', {
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

    it('should create a new document with valid data', async () => {
      const newDocument = {
        id: 'new-doc',
        name: 'New Document',
        type: 'document',
        documentData: {
          instructions: 'Test instructions',
          scope: 'Test scope',
          retentionHandling: 'no_delete'
        },
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.create).mockResolvedValueOnce(newDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Document',
          instructions: 'Test instructions',
          scope: 'Test scope'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.documentName).toBe('New Document');
    });

    it('should update existing document when id is provided', async () => {
      const updatedDocument = {
        id: 'existing-doc',
        name: 'Updated Document',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(updatedDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          id: 'existing-doc',
          name: 'Updated Document'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.update).toHaveBeenCalledWith({
        where: { id: 'existing-doc' },
        data: expect.any(Object)
      });
    });

    it('should handle documentName field from frontend', async () => {
      const newDocument = {
        id: 'new-doc',
        name: 'Frontend Document',
        type: 'document',
        documentData: {},
        disabled: false
      };

      vi.mocked(prisma.dSXRequirement.create).mockResolvedValueOnce(newDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents', {
        method: 'POST',
        body: JSON.stringify({
          documentName: 'Frontend Document'  // Frontend field name
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Frontend Document'
        })
      });
    });
  });
});

describe('DELETE /api/data-rx/documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/data-rx/documents?id=doc-123');
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

      const disabledDocument = {
        id: 'doc-123',
        name: 'Document',
        type: 'document',
        documentData: {},
        disabled: true
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(disabledDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents?id=doc-123');
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

      const request = new Request('http://localhost:3000/api/data-rx/documents?id=doc-123');
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

    it('should return 400 when document ID is missing', async () => {
      const request = new Request('http://localhost:3000/api/data-rx/documents');
      const response = await DELETE(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Document ID is required');
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

    it('should disable document instead of deleting', async () => {
      const disabledDocument = {
        id: 'doc-123',
        name: 'Document',
        type: 'document',
        documentData: {},
        disabled: true
      };

      vi.mocked(prisma.dSXRequirement.update).mockResolvedValueOnce(disabledDocument);

      const request = new Request('http://localhost:3000/api/data-rx/documents?id=doc-123');
      const response = await DELETE(request);

      expect(response.status).toBe(200);
      expect(prisma.dSXRequirement.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { disabled: true }
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Document disabled successfully');
    });
  });
});