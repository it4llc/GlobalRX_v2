// src/app/api/fulfillment/documents/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { getDocumentFromOrderData, streamFile } from '@/lib/services/document-download.service';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/services/document-download.service', () => ({
  getDocumentFromOrderData: vi.fn(),
  streamFile: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('GET /api/fulfillment/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    // Setup: No session
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/fulfillment/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when user is a customer type (wrong endpoint)', async () => {
    // Setup: Session exists but user is customer type (should use portal endpoint instead)
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'customer',
        customerId: 'customer-456',
        email: 'customer@example.com'
      }
    });

    const request = new Request('http://localhost:3000/api/fulfillment/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid user type for this endpoint' });
  });

  it('returns 400 for invalid (non-UUID) document ID', async () => {
    // Setup: Valid internal user session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'internal',
        email: 'internal@example.com',
        permissions: {
          fulfillment: '*'
        }
      }
    });

    const request = new Request('http://localhost:3000/api/fulfillment/documents/invalid-id');
    const params = Promise.resolve({ id: 'invalid-id' });

    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid document ID format' });
  });

  it('returns 404 when document does not exist in order_data', async () => {
    // Setup: Valid internal user session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'internal',
        email: 'internal@example.com',
        permissions: {
          fulfillment: '*'
        }
      }
    });

    // Mock document not found
    vi.mocked(getDocumentFromOrderData).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/fulfillment/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: 'Document not found' });
  });
});