// /GlobalRX_v2/src/app/api/candidate/invitations/enhanced/[token]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { lookupByTokenWithCustomer } from '@/lib/services/candidate-invitation.service';
import type { InvitationLookupResponse } from '@/types/candidateInvitation';

// Mock the service
vi.mock('@/lib/services/candidate-invitation.service', () => ({
  lookupByTokenWithCustomer: vi.fn()
}));

describe('GET /api/candidate/invitations/enhanced/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should NOT require authentication - candidates are not authenticated users', async () => {
      // This endpoint is intentionally public for candidates accessing via email link
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        customerName: 'Acme Corp',
        hasPassword: false
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/test-token');
      const params = Promise.resolve({ token: 'test-token' });

      const response = await GET(request, { params });

      // Should succeed without authentication
      expect(response.status).toBe(200);
    });
  });

  describe('validation', () => {
    it('should return 400 when token is missing', async () => {
      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/');
      const params = Promise.resolve({ token: '' });

      const response = await GET(request, { params });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Token is required');
    });
  });

  describe('success cases', () => {
    it('should return invitation data when token is valid', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: '+1',
        phoneNumber: '555-1234',
        status: 'sent',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        customerName: 'Acme Corp',
        hasPassword: false
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/test-token');
      const params = Promise.resolve({ token: 'test-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        ...mockInvitation,
        expiresAt: mockInvitation.expiresAt.toISOString(),
        createdAt: mockInvitation.createdAt.toISOString()
      });
    });

    it('should include customer name in response', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'accessed',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: new Date('2024-06-01'),
        customerName: 'Test Company Inc',
        hasPassword: true
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/test-token');
      const params = Promise.resolve({ token: 'test-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.customerName).toBe('Test Company Inc');
    });

    it('should include password status in response', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'accessed',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: new Date('2024-06-01'),
        customerName: 'Acme Corp',
        hasPassword: true
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/test-token');
      const params = Promise.resolve({ token: 'test-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.hasPassword).toBe(true);
    });

    it('should return expired status when invitation is expired', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'expired',
        expiresAt: new Date('2024-01-01'),
        createdAt: new Date('2023-12-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        customerName: 'Acme Corp',
        hasPassword: false
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/expired-token');
      const params = Promise.resolve({ token: 'expired-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('expired');
    });

    it('should return completed status when invitation is completed', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'completed',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: new Date('2024-06-01'),
        lastAccessedAt: new Date('2024-06-01'),
        customerName: 'Acme Corp',
        hasPassword: true
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/completed-token');
      const params = Promise.resolve({ token: 'completed-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('completed');
      expect(data.completedAt).toBe(mockInvitation.completedAt?.toISOString());
    });
  });

  describe('error cases', () => {
    it('should return 404 when invitation not found', async () => {
      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/invalid-token');
      const params = Promise.resolve({ token: 'invalid-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Invitation not found');
    });

    it('should return 500 on service error', async () => {
      vi.mocked(lookupByTokenWithCustomer).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/test-token');
      const params = Promise.resolve({ token: 'test-token' });

      const response = await GET(request, { params });
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('service interaction', () => {
    it('should call lookupByTokenWithCustomer with the correct token', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        customerName: 'Acme Corp',
        hasPassword: false
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const testToken = 'specific-test-token-123';
      const request = new NextRequest(`http://localhost/api/candidate/invitations/enhanced/${testToken}`);
      const params = Promise.resolve({ token: testToken });

      await GET(request, { params });

      expect(lookupByTokenWithCustomer).toHaveBeenCalledWith(testToken);
      expect(lookupByTokenWithCustomer).toHaveBeenCalledTimes(1);
    });
  });

  describe('Next.js 15 params handling', () => {
    it('should await params promise before accessing token', async () => {
      const mockInvitation: InvitationLookupResponse = {
        id: 'inv-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        status: 'sent',
        expiresAt: new Date('2025-01-01'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        customerName: 'Acme Corp',
        hasPassword: false
      };

      vi.mocked(lookupByTokenWithCustomer).mockResolvedValue(mockInvitation);

      const request = new NextRequest('http://localhost/api/candidate/invitations/enhanced/async-token');

      // Simulate delayed params resolution
      const params = new Promise<{ token: string }>((resolve) => {
        setTimeout(() => resolve({ token: 'async-token' }), 10);
      });

      const response = await GET(request, { params });
      expect(response.status).toBe(200);

      expect(lookupByTokenWithCustomer).toHaveBeenCalledWith('async-token');
    });
  });
});