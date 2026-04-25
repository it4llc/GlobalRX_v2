// /GlobalRX_v2/src/app/api/candidate/invitations/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { createInvitation } from '@/lib/services/candidate-invitation.service';
import { canInviteCandidates, isCustomerUser } from '@/lib/auth-utils';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/auth-utils', () => ({
  canInviteCandidates: vi.fn(),
  isCustomerUser: vi.fn()
}));

vi.mock('@/lib/services/candidate-invitation.service', () => ({
  createInvitation: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('POST /api/candidate/invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks candidates.invite permission', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("You don't have permission to create invitations");
    });

    it('should return 403 when vendor user tries to create invitation', async () => {
      const mockSession = {
        user: {
          id: 'vendor-1',
          userType: 'vendor',
          vendorId: 'vendor-org-1',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe("You don't have permission to create invitations");
    });
  });

  describe('validation', () => {
    it('should return 400 when request body is invalid JSON', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid JSON in request body');
    });

    it('should return 400 when required fields are missing', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000'
          // Missing firstName, lastName, email
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when email is invalid', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'invalid-email'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when phoneNumber is provided without phoneCountryCode', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneNumber: '555-1234' // Missing phoneCountryCode
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when admin user does not provide customerId', async () => {
      const mockSession = {
        user: {
          id: 'admin-1',
          userType: 'internal',
          permissions: { admin: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(false);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
          // Missing customerId for admin user
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('customerId is required for admin users');
    });
  });

  describe('authorization', () => {
    it('should return 403 when customer user tries to create invitation for another customer', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          customerId: '223e4567-e89b-12d3-a456-426614174001' // Different customer (valid UUID)
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden - cannot create invitation for another customer');
    });

    it('should return 500 when customer user has no customerId', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: null, // Missing customerId for customer user
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('business logic errors', () => {
    it('should return 404 when package not found', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockRejectedValue(new Error('Package not found'));

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Package not found');
    });

    it('should return 403 when package does not belong to customer', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockRejectedValue(new Error('Package does not belong to this customer'));

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden - package does not belong to this customer');
    });

    it('should return 422 when package has no active workflow', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockRejectedValue(
        new Error('This package does not have a workflow assigned. A workflow with email template and expiration settings is required to create an invitation.')
      );

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toContain('workflow');
    });

    it('should return 500 when token generation fails', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockRejectedValue(new Error('Failed to generate unique invitation token'));

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Failed to generate unique token. Please try again.');
    });
  });

  describe('success', () => {
    it('should create invitation and return 201 for customer user with candidates.invite permission', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      const mockInvitation = {
        id: 'invitation-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'secure-token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: 'secret-hash', // This should be stripped
        status: 'sent',
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'user-1',
        updatedAt: new Date()
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBe('invitation-1');
      expect(data.token).toBe('secure-token-123');
      expect(data.firstName).toBe('John');
      expect(data.lastName).toBe('Doe');
      expect(data.email).toBe('john@example.com');
      expect(data.status).toBe('sent');
      expect(data.passwordHash).toBeUndefined(); // Should be stripped
    });

    it('should create invitation with phone details when provided', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidates: { invite: true } }
        }
      };

      const mockInvitation = {
        id: 'invitation-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'secure-token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: '+1',
        phoneNumber: '555-1234',
        passwordHash: null,
        status: 'sent',
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'user-1',
        updatedAt: new Date()
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(createInvitation).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneCountryCode: '+1',
          phoneNumber: '555-1234'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.phoneCountryCode).toBe('+1');
      expect(data.phoneNumber).toBe('555-1234');
    });

    it('should create invitation for admin user with provided customerId', async () => {
      const mockSession = {
        user: {
          id: 'admin-1',
          userType: 'internal',
          permissions: { admin: true }
        }
      };

      const mockInvitation = {
        id: 'invitation-1',
        orderId: 'order-1',
        customerId: '223e4567-e89b-12d3-a456-426614174002',
        token: 'secure-token-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: 'sent',
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'admin-1',
        updatedAt: new Date()
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(false);
      vi.mocked(createInvitation).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          customerId: '223e4567-e89b-12d3-a456-426614174002'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.customerId).toBe('223e4567-e89b-12d3-a456-426614174002');
      expect(data.firstName).toBe('Jane');
    });

    it('should create invitation for internal user with candidates.invite permission', async () => {
      const mockSession = {
        user: {
          id: 'internal-1',
          userType: 'internal',
          permissions: { candidates: { invite: true } }
        }
      };

      const mockInvitation = {
        id: 'invitation-1',
        orderId: 'order-1',
        customerId: '223e4567-e89b-12d3-a456-426614174002',
        token: 'secure-token-123',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: 'sent',
        expiresAt: new Date(),
        createdAt: new Date(),
        createdBy: 'internal-1',
        updatedAt: new Date()
      };

      vi.mocked(getServerSession).mockResolvedValue(mockSession);
      vi.mocked(canInviteCandidates).mockReturnValue(true);
      vi.mocked(isCustomerUser).mockReturnValue(false);
      vi.mocked(createInvitation).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations', {
        method: 'POST',
        body: JSON.stringify({
          packageId: '123e4567-e89b-12d3-a456-426614174000',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          customerId: '223e4567-e89b-12d3-a456-426614174002'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.id).toBe('invitation-1');
      expect(data.createdBy).toBe('internal-1');
    });
  });
});