// /GlobalRX_v2/src/app/api/workflows/[id]/__tests__/phase2-route.test.ts
// Testing ONLY Phase 2 changes to the workflow route

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Import mocked hasPermission after mocking
import { hasPermission } from '@/lib/permission-utils';

describe('PUT /api/workflows/[id] - Phase 2 Changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 2 field updates', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0); // No active orders
    });

    it('should save emailSubject field', async () => {
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: 'Welcome to GlobalRx',
        emailBody: null,
        gapToleranceDays: null,
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailSubject: 'Welcome to GlobalRx'
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.emailSubject).toBe('Welcome to GlobalRx');

      // Verify update was called with the right data
      expect(vi.mocked(prisma.workflow.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailSubject: 'Welcome to GlobalRx'
          })
        })
      );
    });

    it('should save emailBody field', async () => {
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: null,
        emailBody: 'Please complete your background screening.',
        gapToleranceDays: null,
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailBody: 'Please complete your background screening.'
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.emailBody).toBe('Please complete your background screening.');
    });

    it('should save gapToleranceDays field', async () => {
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: null,
        emailBody: null,
        gapToleranceDays: 7,
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gapToleranceDays: 7
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.gapToleranceDays).toBe(7);
    });

    it('should save all Phase 2 fields together', async () => {
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: 'Welcome!',
        emailBody: 'Please complete screening.',
        gapToleranceDays: 14,
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailSubject: 'Welcome!',
          emailBody: 'Please complete screening.',
          gapToleranceDays: 14
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.emailSubject).toBe('Welcome!');
      expect(data.emailBody).toBe('Please complete screening.');
      expect(data.gapToleranceDays).toBe(14);
    });

    it('should allow null gapToleranceDays', async () => {
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: null,
        emailBody: null,
        gapToleranceDays: null,
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gapToleranceDays: null
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.gapToleranceDays).toBe(null);
    });
  });

  describe('Phase 2 validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
      vi.mocked(prisma.order.count).mockResolvedValue(0);
    });

    it('should reject emailSubject over 200 characters', async () => {
      const longSubject = 'a'.repeat(201);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailSubject: longSubject
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject emailBody over 5000 characters', async () => {
      const longBody = 'a'.repeat(5001);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailBody: longBody
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject gapToleranceDays less than 1', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gapToleranceDays: 0
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });

    it('should reject gapToleranceDays greater than 365', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gapToleranceDays: 366
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request data');
    });
  });

  describe('Phase 2 workflow locking', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '1', userType: 'internal' }
      });
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(prisma.workflow.findUnique).mockResolvedValue({
        id: '123',
        name: 'Test Workflow'
      } as any);
    });

    it('should return 409 when workflow has active orders', async () => {
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2); // Has active orders

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailSubject: 'New Subject'
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Cannot modify workflow with active orders');
      expect(data.message).toContain('draft or processing status');
    });

    it('should allow updates when workflow has no active orders', async () => {
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0); // No active orders
      vi.mocked(prisma.workflow.update).mockResolvedValueOnce({
        id: '123',
        name: 'Test Workflow',
        emailSubject: 'Updated Subject',
        packages: [],
        sections: []
      } as any);

      const request = new NextRequest('http://localhost:3000/api/workflows/123', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailSubject: 'Updated Subject'
        })
      });

      const response = await PUT(request, {
        params: Promise.resolve({ id: '123' })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.emailSubject).toBe('Updated Subject');
    });
  });
});