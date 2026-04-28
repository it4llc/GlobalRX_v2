// /GlobalRX_v2/src/app/api/candidate/invitations/[id]/resend/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { resendInvitation } from '@/lib/services/candidate-invitation.service';
import { canInviteCandidates, isCustomerUser, isInternalUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock(import('@/lib/auth-utils'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    canInviteCandidates: vi.fn(),
    isCustomerUser: vi.fn(),
    isInternalUser: vi.fn()
  };
});

vi.mock('@/lib/services/candidate-invitation.service', () => ({
  resendInvitation: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('POST /api/candidate/invitations/[id]/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks permissions', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: {}
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Forbidden - insufficient permissions');
    });
  });

  describe('validation', () => {
    it('should return 400 when invitation ID is missing', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);

      const request = new NextRequest('http://localhost/api/candidate/invitations//resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: '' }) });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invitation ID is required');
    });
  });

  describe('authorization', () => {
    it('should return 404 when customer user tries to resend invitation from another customer', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(null); // Not found for this customer

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should allow admin user to resend any invitation', async () => {
      const mockSession = {
        user: {
          id: 'admin-1',
          userType: 'internal',
          permissions: { customer_config: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-2',
        status: 'sent'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(true);
      vi.mocked(isCustomerUser).mockReturnValue(false);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockResolvedValueOnce({
        success: true,
        message: 'Invitation has been resent'
      });

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(200);

      expect(resendInvitation).toHaveBeenCalledWith('inv-123', 'customer-2', 'admin-1');
    });
  });

  describe('business logic errors', () => {
    it('should return 404 when invitation not found', async () => {
      const mockSession = {
        user: {
          id: 'admin-1',
          userType: 'internal',
          permissions: { customer_config: true }
        }
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(true);
      vi.mocked(isCustomerUser).mockReturnValue(false);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-notfound/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-notfound' }) });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should return 422 when trying to resend an expired invitation', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-1',
        status: 'expired'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockRejectedValueOnce(
        new Error('Cannot resend an expired invitation. Please extend it first.')
      );

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toBe('Cannot resend an expired invitation. Please extend it first.');
    });

    it('should return 422 when trying to resend an in_progress invitation', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-1',
        status: 'in_progress'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockRejectedValueOnce(
        new Error('Invitation cannot be resent in its current status')
      );

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toBe('Invitation cannot be resent in its current status');
    });

    it('should return 422 when trying to resend a completed invitation', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-1',
        status: 'completed'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockRejectedValueOnce(
        new Error('Invitation cannot be resent in its current status')
      );

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(422);

      const data = await response.json();
      expect(data.error).toBe('Invitation cannot be resent in its current status');
    });
  });

  describe('success', () => {
    it('should resend invitation with status sent', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-1',
        status: 'sent',
        email: 'john@example.com'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockResolvedValueOnce({
        success: true,
        message: 'Invitation has been resent'
      });

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Invitation has been resent');

      expect(resendInvitation).toHaveBeenCalledWith('inv-123', 'customer-1', 'user-1');
    });

    it('should resend invitation with status opened', async () => {
      const mockSession = {
        user: {
          id: 'user-1',
          userType: 'customer',
          customerId: 'customer-1',
          permissions: { candidate_workflow: true }
        }
      };

      const mockInvitation = {
        id: 'inv-123',
        customerId: 'customer-1',
        status: 'opened',
        email: 'jane@example.com'
      };

      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
      vi.mocked(isInternalUser).mockReturnValueOnce(false);
      vi.mocked(isCustomerUser).mockReturnValue(true);
      vi.mocked(canInviteCandidates).mockReturnValueOnce(true);
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(resendInvitation).mockResolvedValueOnce({
        success: true,
        message: 'Invitation has been resent'
      });

      const request = new NextRequest('http://localhost/api/candidate/invitations/inv-123/resend', {
        method: 'POST'
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'inv-123' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});