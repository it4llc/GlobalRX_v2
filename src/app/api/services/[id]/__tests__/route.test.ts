// REGRESSION TEST: verification-idv-conversion BR 3 / Decision 3
// PUT and PATCH on /api/services/[id] must reject unknown functionality
// types (including the legacy bare string `'idv'`) with HTTP 400.
// Pre-rename these handlers accepted any string. PATCH only validates
// when the field is present so that callers updating other fields are
// not forced to round-trip the existing value.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PUT, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com'
  }
};

const serviceId = 'service-abc';
const routeParams = { params: Promise.resolve({ id: serviceId }) };

describe('PUT /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects functionalityType: "idv" with 400 and "Unknown functionality type"', async () => {
    // After verification-idv-conversion (BR 3 / Decision 3), the legacy
    // bare string `'idv'` is no longer in the allow-list. PUT must reject
    // it with HTTP 400 before touching the database.

    (getServerSession as any).mockResolvedValue(mockSession);

    const request = new NextRequest(`http://localhost:3000/api/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Stale Client IDV',
        category: 'IDV',
        description: 'Legacy idv string',
        functionalityType: 'idv'
      })
    });

    const response = await PUT(request, routeParams);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Unknown functionality type');
    expect(prisma.service.findUnique).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('accepts functionalityType: "verification-idv" and returns 200', async () => {
    // verification-idv is the new canonical IDV value (BR 1 / DoD 2).

    (getServerSession as any).mockResolvedValue(mockSession);

    (prisma.service.findUnique as any).mockResolvedValue({
      id: serviceId,
      name: 'Old Name',
      category: 'IDV',
      description: 'Old desc',
      functionalityType: 'verification-idv',
      code: 'IDVER',
      disabled: false
    });

    const updatedService = {
      id: serviceId,
      name: 'Identity Verification',
      category: 'IDV',
      description: 'Updated description',
      functionalityType: 'verification-idv',
      code: 'IDVER',
      disabled: false,
      updatedById: mockSession.user.id,
      updatedAt: new Date()
    };
    (prisma.service.update as any).mockResolvedValue(updatedService);

    const request = new NextRequest(`http://localhost:3000/api/services/${serviceId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Identity Verification',
        category: 'IDV',
        description: 'Updated description',
        functionalityType: 'verification-idv'
      })
    });

    const response = await PUT(request, routeParams);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.functionalityType).toBe('verification-idv');
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: serviceId },
      data: expect.objectContaining({
        functionalityType: 'verification-idv'
      })
    });
  });
});

describe('PATCH /api/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects functionalityType: "idv" with 400 on a partial update', async () => {
    // PATCH allow-list validation runs only when functionalityType is
    // present (BR 3 / Decision 3). When it is present and unknown, the
    // route rejects with HTTP 400 before any DB write.

    (getServerSession as any).mockResolvedValue(mockSession);

    const request = new NextRequest(`http://localhost:3000/api/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        functionalityType: 'idv'
      })
    });

    const response = await PATCH(request, routeParams);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Unknown functionality type');
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('does not reject a partial update that omits functionalityType', async () => {
    // The PATCH allow-list check is gated on `functionalityType !== undefined`
    // so a caller updating only name/description/category is not forced to
    // round-trip the existing functionalityType value. This test pins that
    // behavior so a future refactor does not accidentally start requiring
    // the field on every PATCH.

    (getServerSession as any).mockResolvedValue(mockSession);

    const updatedService = {
      id: serviceId,
      name: 'Renamed',
      category: 'IDV',
      description: 'Same desc',
      functionalityType: 'verification-idv',
      code: 'IDVER',
      disabled: false,
      updatedById: mockSession.user.id,
      updatedAt: new Date()
    };
    (prisma.service.update as any).mockResolvedValue(updatedService);

    const request = new NextRequest(`http://localhost:3000/api/services/${serviceId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Renamed'
      })
    });

    const response = await PATCH(request, routeParams);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.name).toBe('Renamed');
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: serviceId },
      data: expect.objectContaining({
        name: 'Renamed',
        updatedById: mockSession.user.id
      })
    });
    expect(prisma.service.update).toHaveBeenCalledTimes(1);
    const updateCall = (prisma.service.update as any).mock.calls[0][0];
    expect(updateCall.data.functionalityType).toBeUndefined();
  });
});
