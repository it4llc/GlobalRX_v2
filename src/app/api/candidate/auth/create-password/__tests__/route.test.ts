// /GlobalRX_v2/src/app/api/candidate/auth/create-password/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// Mock auth server
vi.mock('@/lib/auth.server', () => ({
  hashPassword: vi.fn((password: string) => Promise.resolve(`hashed_${password}`))
}));

describe('POST /api/candidate/auth/create-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock for transaction
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      // Create a mock transaction object with the methods we need
      const tx = {
        candidateInvitation: {
          update: vi.fn()
        },
        orderStatusHistory: {
          create: vi.fn()
        }
      };

      // Execute the callback with our mock transaction
      return callback(tx);
    });
  });

  describe('authentication', () => {
    it('should NOT require authentication - candidates are not authenticated users', async () => {
      // This endpoint intentionally does not check for a session
      // The token itself is the authentication mechanism

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null);

      const response = await POST(request);

      // Should get 404 for invalid token, not 401 for no auth
      expect(response.status).toBe(404);
    });
  });

  describe('validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when password is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when password is too short', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'short'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringMatching(/at least 8 characters/i)
          })
        ])
      );
    });

    it('should return 400 when password lacks a letter', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: '12345678'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringMatching(/at least one letter/i)
          })
        ])
      );
    });

    it('should return 400 when password lacks a number', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'abcdefgh'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid input');
      expect(data.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringMatching(/at least one number/i)
          })
        ])
      );
    });
  });

  describe('invitation lookup', () => {
    it('should return 404 when token does not exist', async () => {
      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'non-existent-token',
          password: 'ValidPass123'
        })
      });

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(null);

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should return 400 when invitation has expired', async () => {
      const expiredDate = new Date('2024-01-01');
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.SENT,
        previousStatus: null,
        expiresAt: expiredDate,
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date('2024-01-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('This invitation has expired');
    });

    it('should return 400 when password already exists', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: 'existing-hash',
        status: INVITATION_STATUSES.ACCESSED,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: new Date('2024-06-01'),
        updatedAt: new Date('2024-06-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Unable to process request');
    });

    it('should return 400 when invitation is already completed', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.COMPLETED,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: new Date('2024-06-01'),
        lastAccessedAt: new Date('2024-06-01'),
        updatedAt: new Date('2024-06-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('This application has already been completed');
    });
  });

  describe('success case', () => {
    it('should create password and update invitation status on success', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.SENT,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date('2024-01-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          candidateInvitation: {
            update: vi.fn().mockResolvedValue({
              ...mockInvitation,
              passwordHash: 'hashed_ValidPass123',
              status: INVITATION_STATUSES.ACCESSED,
              lastAccessedAt: new Date()
            })
          },
          orderStatusHistory: {
            create: vi.fn().mockResolvedValue({
              id: 'history-1',
              orderId: 'order-1',
              fromStatus: INVITATION_STATUSES.SENT,
              toStatus: INVITATION_STATUSES.ACCESSED,
              changedBy: 'user-1',
              eventType: 'CANDIDATE_PASSWORD_CREATED',
              message: 'Candidate John Doe created a password',
              isAutomatic: false,
              createdAt: new Date()
            })
          }
        };
        return await callback(tx);
      });

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        success: true,
        status: INVITATION_STATUSES.ACCESSED
      });

      // Verify hashPassword was called
      expect(hashPassword).toHaveBeenCalledWith('ValidPass123');

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should update lastAccessedAt timestamp when creating password', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.SENT,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date('2024-01-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      let capturedUpdateData: any;
      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          candidateInvitation: {
            update: vi.fn().mockImplementation((args) => {
              capturedUpdateData = args.data;
              return Promise.resolve({
                ...mockInvitation,
                ...args.data
              });
            })
          },
          orderStatusHistory: {
            create: vi.fn().mockResolvedValue({ id: 'history-1' })
          }
        };
        return await callback(tx);
      });

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify lastAccessedAt was set
      expect(capturedUpdateData).toHaveProperty('lastAccessedAt');
      expect(capturedUpdateData.lastAccessedAt).toBeInstanceOf(Date);
    });

    it('should log order status history event when creating password', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.SENT,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date('2024-01-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);

      let capturedHistoryData: any;
      const mockTransaction = vi.fn(async (callback) => {
        const tx = {
          candidateInvitation: {
            update: vi.fn().mockResolvedValue({
              ...mockInvitation,
              passwordHash: 'hashed_password',
              status: INVITATION_STATUSES.ACCESSED
            })
          },
          orderStatusHistory: {
            create: vi.fn().mockImplementation((args) => {
              capturedHistoryData = args.data;
              return Promise.resolve({ id: 'history-1', ...args.data });
            })
          }
        };
        return await callback(tx);
      });

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify history entry was created with correct data
      expect(capturedHistoryData).toMatchObject({
        fromStatus: INVITATION_STATUSES.SENT,
        toStatus: INVITATION_STATUSES.ACCESSED,
        eventType: 'CANDIDATE_PASSWORD_CREATED',
        message: 'Candidate Jane Smith created a password',
        isAutomatic: false
      });
      expect(capturedHistoryData.order.connect).toEqual({ id: 'order-1' });
      expect(capturedHistoryData.user.connect).toEqual({ id: 'user-1' });
    });
  });

  describe('error handling', () => {
    it('should return 500 on database error', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should return 500 on transaction error', async () => {
      const mockInvitation = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        token: 'test-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.SENT,
        previousStatus: null,
        expiresAt: new Date('2027-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date('2024-01-01')
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValue(mockInvitation);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Transaction failed'));

      const request = new NextRequest('http://localhost/api/candidate/auth/create-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'test-token',
          password: 'ValidPass123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});