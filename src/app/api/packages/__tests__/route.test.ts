// /GlobalRX_v2/src/app/api/packages/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
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
    package: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('GET /api/packages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not a customer user', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden — must be a customer user');
    });

    it('should return 403 when customer user lacks customerId', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: null,
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden — must be a customer user');
    });

    it('should return 403 when user is a vendor user', async () => {
      const mockSession = {
        user: {
          id: 'vendor-1',
          userType: 'vendor',
          vendorId: 'vendor-org-1',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden — must be a customer user');
    });
  });

  describe('success cases', () => {
    it('should return all packages for the customer when no filter is applied', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: {}
        }
      };

      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Background Check',
          description: 'Standard background check',
          workflowId: 'workflow-1',
          workflow: {
            id: 'workflow-1',
            name: 'Standard Workflow',
            description: 'Default workflow',
            expirationDays: 15,
            reminderEnabled: true
          }
        },
        {
          id: 'pkg-2',
          name: 'Drug Screen',
          description: 'Basic drug screening',
          workflowId: null,
          workflow: null
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        id: 'pkg-1',
        name: 'Background Check',
        description: 'Standard background check',
        hasWorkflow: true,
        workflow: {
          name: 'Standard Workflow',
          description: 'Default workflow',
          expirationDays: 15,
          reminderEnabled: true
        }
      });
      expect(data[1]).toEqual({
        id: 'pkg-2',
        name: 'Drug Screen',
        description: 'Basic drug screening',
        hasWorkflow: false,
        workflow: null
      });

      expect(prisma.package.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-1'
        },
        select: {
          id: true,
          name: true,
          description: true,
          workflowId: true,
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
              expirationDays: true,
              reminderEnabled: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
    });

    it('should return only packages with workflows when hasWorkflow=true filter is applied', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Background Check',
          description: 'Standard background check',
          workflowId: 'workflow-1',
          workflow: {
            id: 'workflow-1',
            name: 'Standard Workflow',
            description: 'Default workflow',
            expirationDays: 15,
            reminderEnabled: false
          }
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toEqual({
        id: 'pkg-1',
        name: 'Background Check',
        description: 'Standard background check',
        hasWorkflow: true,
        workflow: {
          name: 'Standard Workflow',
          description: 'Default workflow',
          expirationDays: 15,
          reminderEnabled: false
        }
      });

      expect(prisma.package.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-1',
          workflowId: { not: null }
        },
        select: {
          id: true,
          name: true,
          description: true,
          workflowId: true,
          workflow: {
            select: {
              id: true,
              name: true,
              description: true,
              expirationDays: true,
              reminderEnabled: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });
    });

    it('should return empty array when customer has no packages', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-2',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual([]);
    });

    it('should return empty array when filtering for workflows but none exist', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=true');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should return 500 when database query fails', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('query parameter handling', () => {
    it('should ignore hasWorkflow filter when value is not "true"', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: {}
        }
      };

      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Package 1',
          description: null,
          workflowId: 'workflow-1',
          workflow: {
            id: 'workflow-1',
            name: 'Workflow 1',
            description: null,
            expirationDays: 30,
            reminderEnabled: false
          }
        },
        {
          id: 'pkg-2',
          name: 'Package 2',
          description: null,
          workflowId: null,
          workflow: null
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      // Test with hasWorkflow=false (should be ignored, return all packages)
      const request = new NextRequest('http://localhost/api/packages?hasWorkflow=false');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);

      // Verify it was called without the workflow filter
      expect(prisma.package.findMany).toHaveBeenCalledWith({
        where: {
          customerId: 'customer-1'
        },
        select: expect.any(Object),
        orderBy: { name: 'asc' }
      });
    });

    it('should handle packages with null descriptions correctly', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: {}
        }
      };

      const mockPackages = [
        {
          id: 'pkg-1',
          name: 'Minimal Package',
          description: null,
          workflowId: null,
          workflow: null
        }
      ];

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(prisma.package.findMany).mockResolvedValue(mockPackages);

      const request = new NextRequest('http://localhost/api/packages');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data[0]).toEqual({
        id: 'pkg-1',
        name: 'Minimal Package',
        description: null,
        hasWorkflow: false,
        workflow: null
      });
    });
  });
});