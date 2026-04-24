// /GlobalRX_v2/src/app/api/candidate/invitations/lookup/[token]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { lookupByToken } from '@/lib/services/candidate-invitation.service';

// Mock dependencies
vi.mock('@/lib/services/candidate-invitation.service', () => ({
  lookupByToken: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('GET /api/candidate/invitations/lookup/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/');

      const response = await GET(request, { params: Promise.resolve({ token: '' }) });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Token is required');
    });
  });

  describe('lookup', () => {
    it('should return 404 when invitation not found', async () => {
      vi.mocked(lookupByToken).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/invalid-token');

      const response = await GET(request, { params: Promise.resolve({ token: 'invalid-token' }) });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Invitation not found');

      expect(lookupByToken).toHaveBeenCalledWith('invalid-token');
    });

    it('should return 200 with invitation data when found', async () => {
      const mockInvitation = {
        id: 'invitation-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: '2024-12-31T23:59:59Z',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null
      };

      vi.mocked(lookupByToken).mockResolvedValueOnce(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/valid-token-123');

      const response = await GET(request, { params: Promise.resolve({ token: 'valid-token-123' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockInvitation);

      expect(lookupByToken).toHaveBeenCalledWith('valid-token-123');
    });

    it('should return invitation with expired status when invitation has expired', async () => {
      const mockExpiredInvitation = {
        id: 'invitation-2',
        orderId: 'order-2',
        customerId: 'customer-1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneCountryCode: '+1',
        phoneNumber: '555-1234',
        status: 'expired',
        expiresAt: '2023-01-01T00:00:00Z',
        createdAt: '2022-12-01T00:00:00Z',
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null
      };

      vi.mocked(lookupByToken).mockResolvedValueOnce(mockExpiredInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/expired-token');

      const response = await GET(request, { params: Promise.resolve({ token: 'expired-token' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('expired');
    });

    it('should not return sensitive fields like passwordHash or token', async () => {
      // The service should already exclude these, but we verify the response
      const mockInvitation = {
        id: 'invitation-3',
        orderId: 'order-3',
        customerId: 'customer-1',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: '2024-12-31T23:59:59Z',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null
        // Note: No passwordHash, token, or previousStatus fields
      };

      vi.mocked(lookupByToken).mockResolvedValueOnce(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/secure-token');

      const response = await GET(request, { params: Promise.resolve({ token: 'secure-token' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).not.toHaveProperty('passwordHash');
      expect(data).not.toHaveProperty('token');
      expect(data).not.toHaveProperty('previousStatus');
    });

    it('should handle service errors gracefully', async () => {
      vi.mocked(lookupByToken).mockRejectedValueOnce(new Error('Database connection error'));

      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/any-token');

      const response = await GET(request, { params: Promise.resolve({ token: 'any-token' }) });
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('no authentication required', () => {
    it('should work without any authentication headers', async () => {
      // This endpoint is intentionally public for candidates
      const mockInvitation = {
        id: 'invitation-4',
        orderId: 'order-4',
        customerId: 'customer-1',
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: '2024-12-31T23:59:59Z',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null
      };

      vi.mocked(lookupByToken).mockResolvedValueOnce(mockInvitation);

      // No session or auth headers needed
      const request = new NextRequest('http://localhost/api/candidate/invitations/lookup/public-token');

      const response = await GET(request, { params: Promise.resolve({ token: 'public-token' }) });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.firstName).toBe('Alice');
    });
  });
});