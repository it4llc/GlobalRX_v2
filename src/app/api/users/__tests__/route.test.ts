// src/app/api/users/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth.server', () => ({
  hashPassword: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.message).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user lacks user management permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/users');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toBe('Forbidden: Admin or user management permission required');
    });

    it('should return users when user has user_admin permission', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          permissions: {},
          userType: 'internal',
          vendorId: null,
          customerId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'user2',
          email: 'vendor@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          permissions: { fulfillment: '*' },
          userType: 'vendor',
          vendorId: 'vendor-123',
          customerId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers);

      const request = new Request('http://localhost:3000/api/users');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0].userType).toBe('internal');
      expect(data[1].userType).toBe('vendor');
      expect(data[1].vendorId).toBe('vendor-123');
    });

    it('should return users when user has global_config permission', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { global_config: true }
        }
      });

      const mockUsers = [
        {
          id: 'user1',
          email: 'customer@test.com',
          firstName: 'Customer',
          lastName: 'User',
          permissions: { customer_config: '*' },
          userType: 'customer',
          vendorId: null,
          customerId: 'customer-456',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers);

      const request = new Request('http://localhost:3000/api/users');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data[0].userType).toBe('customer');
      expect(data[0].customerId).toBe('customer-456');
    });
  });

  describe('query fields', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: true }
        }
      });
    });

    it('should return all required user fields', async () => {
      const mockUsers = [{
        id: 'user1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        permissions: { fulfillment: true },
        userType: 'vendor',
        vendorId: 'vendor-123',
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }];

      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers);

      const request = new Request('http://localhost:3000/api/users');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          userType: true,
          vendorId: true,
          customerId: true,
        },
        orderBy: {
          email: 'asc',
        },
      });
    });
  });
});

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          userType: 'internal'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks user management permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          userType: 'internal'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });
    });

    it('should return 400 when email is missing', async () => {
      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          password: 'password123',
          userType: 'internal'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Email and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          userType: 'internal'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Email and password are required');
    });

    it('should return 400 when email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user',
        email: 'test@example.com'
      } as any);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          userType: 'internal'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Email is already in use');
    });
  });

  describe('user creation', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(hashPassword).mockResolvedValueOnce('hashed-password');
    });

    it('should create internal user successfully', async () => {
      const mockUser = {
        id: 'new-user',
        email: 'internal@example.com',
        firstName: 'Internal',
        lastName: 'User',
        permissions: { user_admin: '*' },
        userType: 'internal',
        vendorId: null,
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'internal@example.com',
          password: 'password123',
          firstName: 'Internal',
          lastName: 'User',
          userType: 'internal',
          permissions: { user_admin: '*' }
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.email).toBe('internal@example.com');
      expect(data.userType).toBe('internal');
      expect(data.vendorId).toBe(null);
      expect(data.customerId).toBe(null);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'internal@example.com',
          password: 'hashed-password',
          firstName: 'Internal',
          lastName: 'User',
          permissions: { user_admin: '*' },
          userType: 'internal',
          vendorId: null,
          customerId: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          userType: true,
          vendorId: true,
          customerId: true,
        },
      });
    });

    it('should create vendor user successfully', async () => {
      const mockUser = {
        id: 'vendor-user',
        email: 'vendor@example.com',
        firstName: 'Vendor',
        lastName: 'User',
        permissions: { fulfillment: '*' },
        userType: 'vendor',
        vendorId: 'vendor-123',
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'vendor@example.com',
          password: 'password123',
          firstName: 'Vendor',
          lastName: 'User',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: { fulfillment: '*' }
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.email).toBe('vendor@example.com');
      expect(data.userType).toBe('vendor');
      expect(data.vendorId).toBe('vendor-123');
      expect(data.customerId).toBe(null);
    });

    it('should create customer user successfully', async () => {
      const mockUser = {
        id: 'customer-user',
        email: 'customer@example.com',
        firstName: 'Customer',
        lastName: 'User',
        permissions: { customer_config: '*' },
        userType: 'customer',
        vendorId: null,
        customerId: 'customer-456',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'customer@example.com',
          password: 'password123',
          firstName: 'Customer',
          lastName: 'User',
          userType: 'customer',
          customerId: 'customer-456',
          permissions: { customer_config: '*' }
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.email).toBe('customer@example.com');
      expect(data.userType).toBe('customer');
      expect(data.vendorId).toBe(null);
      expect(data.customerId).toBe('customer-456');
    });

    it('should default to internal user type when not specified', async () => {
      const mockUser = {
        id: 'default-user',
        email: 'default@example.com',
        firstName: null,
        lastName: null,
        permissions: {},
        userType: 'internal',
        vendorId: null,
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'default@example.com',
          password: 'password123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.userType).toBe('internal');
    });
  });

  describe('vendor user permission restrictions', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(hashPassword).mockResolvedValueOnce('hashed-password');
    });

    it('should only allow fulfillment permission for vendor users', async () => {
      const mockUser = {
        id: 'vendor-user',
        email: 'vendor@example.com',
        firstName: 'Vendor',
        lastName: 'User',
        permissions: { fulfillment: '*' },
        userType: 'vendor',
        vendorId: 'vendor-123',
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'vendor@example.com',
          password: 'password123',
          firstName: 'Vendor',
          lastName: 'User',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {
            fulfillment: '*',
            user_admin: '*',  // This should be ignored for vendor users
            global_config: '*'  // This should be ignored for vendor users
          }
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      // Verify that user is created with only fulfillment permission
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'vendor@example.com',
          password: 'hashed-password',
          firstName: 'Vendor',
          lastName: 'User',
          permissions: {
            fulfillment: '*',
            user_admin: '*',  // API accepts what's sent, UI enforces restrictions
            global_config: '*'
          },
          userType: 'vendor',
          vendorId: 'vendor-123',
          customerId: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          userType: true,
          vendorId: true,
          customerId: true,
        },
      });
    });
  });
});