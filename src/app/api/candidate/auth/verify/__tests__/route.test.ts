// /GlobalRX_v2/src/app/api/candidate/auth/verify/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  compare: vi.fn()
}));

// Mock CandidateSessionService
vi.mock('@/lib/services/candidateSession.service', () => ({
  CandidateSessionService: {
    checkRateLimit: vi.fn(),
    recordFailedAttempt: vi.fn(),
    clearRateLimit: vi.fn(),
    createSession: vi.fn(),
    getNewExpirationTime: vi.fn(() => new Date(Date.now() + 4 * 60 * 60 * 1000))
  }
}));

describe('POST /api/candidate/auth/verify', () => {
  const mockInvitation = {
    id: 'test-invitation-id',
    token: 'test-token-123',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@example.com',
    passwordHash: '$2a$10$hash',
    status: 'accessed',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    lastAccessedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    orderId: 'order-id',
    customerId: 'customer-id',
    createdBy: 'user-id'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(CandidateSessionService.checkRateLimit).mockReturnValue({ allowed: true });
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
  });

  describe('request validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Token and password are required');
    });

    it('should return 400 when password is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Token and password are required');
    });

    it('should return 400 when both token and password are missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Token and password are required');
    });
  });

  describe('invitation lookup', () => {
    it('should return generic error when invitation token does not exist', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'non-existent-token',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should check rate limit using invitation ID from database lookup', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(CandidateSessionService.checkRateLimit).toHaveBeenCalledWith(mockInvitation.id);
    });
  });

  describe('rate limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(CandidateSessionService.checkRateLimit).mockReturnValue({
        allowed: false,
        remainingMinutes: 12
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.error).toBe('Too many attempts. Please try again later.');
      expect(data.retryAfterMinutes).toBe(12);
    });

    it('should provide default retry time when none specified', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(CandidateSessionService.checkRateLimit).mockReturnValue({
        allowed: false
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(429);

      const data = await response.json();
      expect(data.retryAfterMinutes).toBe(15);
    });
  });

  describe('invitation status validation', () => {
    it('should return specific error for completed invitations', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        status: 'completed'
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('This invitation has already been completed');
    });

    it('should return generic error for draft invitations', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        status: 'draft'
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should return generic error for sent status invitations', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        status: 'sent'
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });
  });

  describe('invitation expiration', () => {
    it('should return specific error for expired invitations', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('This invitation has expired');
    });

    it('should allow login for invitations expiring in the future', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('password verification', () => {
    it('should return generic error when password hash is null', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        passwordHash: null
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');
    });

    it('should compare password using bcrypt', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(bcrypt.compare).toHaveBeenCalledWith('TestPassword123', '$2a$10$hash');
    });

    it('should record failed attempt and return error for wrong password', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'WrongPassword'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Invalid credentials');

      expect(CandidateSessionService.recordFailedAttempt).toHaveBeenCalledWith(mockInvitation.id);
    });
  });

  describe('successful login', () => {
    it('should clear rate limit on successful login', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(CandidateSessionService.clearRateLimit).toHaveBeenCalledWith(mockInvitation.id);
    });

    it('should update lastAccessedAt timestamp on successful login', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: mockInvitation.id },
        data: { lastAccessedAt: expect.any(Date) }
      });
    });

    it('should create session on successful login', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(CandidateSessionService.createSession).toHaveBeenCalledWith({
        invitationId: mockInvitation.id,
        token: mockInvitation.token,
        firstName: mockInvitation.firstName,
        status: mockInvitation.status,
        expiresAt: expect.any(Date)
      });
    });

    it('should return success response with invitation data', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        invitation: {
          id: mockInvitation.id,
          firstName: mockInvitation.firstName,
          status: mockInvitation.status,
          token: mockInvitation.token
        }
      });
    });
  });

  describe('error handling', () => {
    it('should return 500 for database errors', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 for bcrypt errors', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(bcrypt.compare).mockRejectedValue(new Error('Bcrypt error'));

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 for session creation errors', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValue(mockInvitation);
      vi.mocked(CandidateSessionService.createSession).mockRejectedValue(new Error('Session error'));

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('security', () => {
    it('should not reveal invitation existence for different error conditions', async () => {
      // Test that "Invalid credentials" is returned for multiple conditions
      const testCases = [
        {
          name: 'non-existent token',
          mockSetup: () => vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null)
        },
        {
          name: 'no password hash',
          mockSetup: () => vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
            ...mockInvitation,
            passwordHash: null
          })
        },
        {
          name: 'wrong password',
          mockSetup: () => {
            vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
            vi.mocked(bcrypt.compare).mockResolvedValue(false);
          }
        }
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        testCase.mockSetup();

        const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
          method: 'POST',
          body: JSON.stringify({
            token: 'test-token-123',
            password: 'TestPassword123'
          })
        });

        const response = await POST(request);
        expect(response.status).toBe(401);

        const data = await response.json();
        expect(data.error).toBe('Invalid credentials');
      }
    });

    it('should not call bcrypt for invitations without password hash', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue({
        ...mockInvitation,
        passwordHash: null
      });

      const request = new NextRequest('http://localhost/api/candidate/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token-123',
          password: 'TestPassword123'
        })
      });

      await POST(request);

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });
});