// src/app/api/portal/documents/[id]/__tests__/route.test.ts

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

describe('GET /api/portal/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    // Setup: No session
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/portal/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when user is not a customer type', async () => {
    // Setup: Session exists but user is internal type
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'internal',
        email: 'admin@example.com'
      }
    });

    const request = new Request('http://localhost:3000/api/portal/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid (non-UUID) document ID', async () => {
    // Setup: Valid customer session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'customer',
        customerId: 'customer-456',
        email: 'customer@example.com'
      }
    });

    const request = new Request('http://localhost:3000/api/portal/documents/invalid-id');
    const params = Promise.resolve({ id: 'invalid-id' });

    const response = await GET(request, { params });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid document ID format' });
  });

  it('returns 404 when document does not exist in order_data', async () => {
    // Setup: Valid customer session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'customer',
        customerId: 'customer-456',
        email: 'customer@example.com'
      }
    });

    // Mock document not found
    vi.mocked(getDocumentFromOrderData).mockResolvedValueOnce(null);

    const request = new Request('http://localhost:3000/api/portal/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: 'Document not found' });
  });

  it('returns 403 when customer does not own the order', async () => {
    // Setup: Valid customer session
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: 'user-123',
        userType: 'customer',
        customerId: 'customer-456',
        email: 'customer@example.com'
      }
    });

    // Mock document found but belongs to different customer
    vi.mocked(getDocumentFromOrderData).mockResolvedValueOnce({
      orderDataId: '550e8400-e29b-41d4-a716-446655440000',
      storagePath: 'uploads/documents/file.pdf',
      originalName: 'document.pdf',
      mimeType: 'application/pdf',
      customerId: 'different-customer-789',  // Different customer
      orderId: 'order-123',
      vendorId: null
    });

    const request = new Request('http://localhost:3000/api/portal/documents/550e8400-e29b-41d4-a716-446655440000');
    const params = Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' });

    const response = await GET(request, { params });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: 'Access denied' });
  });
});