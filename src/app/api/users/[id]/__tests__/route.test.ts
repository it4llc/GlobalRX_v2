// src/app/api/users/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '../route';
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
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth.server', () => ({
  hashPassword: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn()
  }
}));

describe('GET /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/user-123');
      const response = await GET(request, { params: { id: 'user-123' } });

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/users/user-123');
      const response = await GET(request, { params: { id: 'user-123' } });

      expect(response.status).toBe(403);
    });
  });

  describe('user retrieval', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });
    });

    it('should return user with all required fields', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        permissions: { fulfillment: '*' },
        userType: 'vendor',
        vendorId: 'vendor-456',
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

      const request = new Request('http://localhost:3000/api/users/user-123');
      const response = await GET(request, { params: { id: 'user-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.id).toBe('user-123');
      expect(data.userType).toBe('vendor');
      expect(data.vendorId).toBe('vendor-456');
      expect(data.customerId).toBe(null);
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
    });
  });
});

describe('PUT /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'updated@example.com',
          userType: 'internal'
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'updated@example.com',
          userType: 'internal'
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    it('should return 400 when email is missing', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: 'Updated'
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Email is required');
    });

    it('should return 404 when user not found', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      // Mock user not found
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userType: 'internal'
        })
      });

      const response = await PUT(request, { params: { id: 'nonexistent' } });
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toBe('User not found');
    });

    it('should return 400 when email is already used by another user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      // Mock existing user being updated
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'current@example.com'
      } as any);

      // Mock email check - email is taken by different user
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'other-user',
        email: 'taken@example.com'
      } as any);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'taken@example.com',
          firstName: 'Test',
          lastName: 'User',
          userType: 'internal'
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toBe('Email is already in use by another user');
    });
  });

  describe('user updates', () => {

    it('should update user from internal to vendor', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'existing@example.com'
      } as any);

      const updatedUser = {
        id: 'user-123',
        email: 'vendor@example.com',
        firstName: 'Vendor',
        lastName: 'User',
        permissions: { fulfillment: '*' },
        userType: 'vendor',
        vendorId: 'vendor-456',
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedUser);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'vendor@example.com',
          firstName: 'Vendor',
          lastName: 'User',
          userType: 'vendor',
          vendorId: 'vendor-456',
          permissions: { fulfillment: '*' }
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.userType).toBe('vendor');
      expect(data.vendorId).toBe('vendor-456');
      expect(data.customerId).toBe(null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          email: 'vendor@example.com',
          firstName: 'Vendor',
          lastName: 'User',
          permissions: { fulfillment: '*' },
          userType: 'vendor',
          vendorId: 'vendor-456',
          customerId: null,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          permissions: true,
          userType: true,
          vendorId: true,
          customerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('should update user from vendor to customer', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'existing@example.com'
      } as any);

      const updatedUser = {
        id: 'user-123',
        email: 'customer@example.com',
        firstName: 'Customer',
        lastName: 'User',
        permissions: { customer_config: '*' },
        userType: 'customer',
        vendorId: null,
        customerId: 'customer-789',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedUser);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'customer@example.com',
          firstName: 'Customer',
          lastName: 'User',
          userType: 'customer',
          customerId: 'customer-789',
          permissions: { customer_config: '*' }
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.userType).toBe('customer');
      expect(data.vendorId).toBe(null);
      expect(data.customerId).toBe('customer-789');
    });

    it('should update password when provided', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'existing@example.com'
      } as any);

      vi.mocked(hashPassword).mockResolvedValueOnce('new-hashed-password');

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        permissions: {},
        userType: 'internal',
        vendorId: null,
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedUser);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'newpassword123',
          firstName: 'Test',
          lastName: 'User',
          userType: 'internal',
          permissions: {}
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(200);

      expect(hashPassword).toHaveBeenCalledWith('newpassword123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          password: 'new-hashed-password'
        }),
        select: expect.any(Object)
      });
    });

    it('should not update password when not provided', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'existing@example.com'
      } as any);

      const updatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        permissions: {},
        userType: 'internal',
        vendorId: null,
        customerId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(prisma.user.update).mockResolvedValueOnce(updatedUser);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'PUT',
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userType: 'internal',
          permissions: {}
        })
      });

      const response = await PUT(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(200);

      expect(hashPassword).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.not.objectContaining({
          password: expect.anything()
        }),
        select: expect.any(Object)
      });
    });
  });
});

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks permissions', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(403);
    });
  });

  describe('user deletion', () => {
    it('should return 404 when user not found', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/users/nonexistent', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'nonexistent' } });
      expect(response.status).toBe(404);
    });

    it('should delete user successfully', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: {
          id: '1',
          permissions: { user_admin: '*' }
        }
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-123',
        email: 'test@example.com'
      } as any);
      vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as any);

      const request = new Request('http://localhost:3000/api/users/user-123', {
        method: 'DELETE'
      });

      const response = await DELETE(request, { params: { id: 'user-123' } });
      expect(response.status).toBe(204);

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      });
    });
  });
});