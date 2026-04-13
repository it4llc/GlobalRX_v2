// /GlobalRX_v2/src/app/api/services/[id]/status/__tests__/td028-auto-progression.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { OrderLockService } from '@/lib/services/order-lock.service';
import { updateServiceStatusSchema, isTerminalStatus } from '@/types/service-fulfillment';

// Mock dependencies - copied from route.test.ts
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    serviceComment: {
      create: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    orderStatusHistory: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/constants/service-status', () => ({
  SERVICE_STATUSES: {
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    CANCELLED_DNB: 'cancelled_dnb',
    SUBMITTED: 'submitted'
  }
}));

vi.mock('@/types/service-fulfillment', () => ({
  updateServiceStatusSchema: {
    safeParse: vi.fn()
  },
  isTerminalStatus: vi.fn()
}));

// Mock OrderLockService
const mockCheckLock = vi.fn();
const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();

vi.mock('@/lib/services/order-lock.service', () => ({
  OrderLockService: vi.fn().mockImplementation(function() {
    this.checkLock = mockCheckLock;
    this.acquireLock = mockAcquireLock;
    this.releaseLock = mockReleaseLock;
  })
}));

// Mock ActivityTrackingService
vi.mock('@/lib/services/activity-tracking.service', () => ({
  ActivityTrackingService: {
    updateOrderActivity: vi.fn().mockResolvedValue(undefined),
    updateOrderItemActivity: vi.fn().mockResolvedValue(undefined)
  }
}));

// THE KEY MOCK: ServiceFulfillmentService.checkAllServicesSubmitted as a spy
const checkAllServicesSubmittedSpy = vi.fn();
vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    checkAllServicesSubmitted: checkAllServicesSubmittedSpy
  }
}));

describe('TD-028: Auto-progression case-sensitivity bug', () => {
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockUserId = 'user-456';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440003';

  const mockSession = {
    user: {
      id: mockUserId,
      email: 'user@example.com',
      userType: 'internal',
      permissions: { fulfillment: true }
    }
  };

  const mockService = {
    id: mockServiceId,
    orderId: mockOrderId,
    status: 'processing',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: {
      id: mockOrderId
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default session
    (getServerSession as any).mockResolvedValue(mockSession);

    // Set up lock service to allow the operation
    mockCheckLock.mockResolvedValue({ isLockedByOther: false, isLocked: false, canEdit: true });
    mockAcquireLock.mockResolvedValue({ success: true });
    mockReleaseLock.mockResolvedValue(true);

    // Set up Prisma mocks
    (prisma.orderItem.findUnique as any).mockResolvedValue(mockService);

    // Set up transaction mock
    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const tx = {
        orderItem: {
          findUnique: vi.fn().mockResolvedValue(mockService),
          update: vi.fn().mockResolvedValue({ ...mockService, status: 'submitted' })
        },
        serviceComment: {
          create: vi.fn().mockResolvedValue({
            id: 'comment-123',
            orderItemId: mockServiceId,
            isStatusChange: true,
            statusChangedFrom: 'processing',
            statusChangedTo: 'submitted',
            createdBy: mockUserId,
            createdAt: new Date()
          })
        },
        order: {
          findUnique: vi.fn().mockResolvedValue({ id: mockOrderId, statusCode: 'draft' }),
          update: vi.fn().mockResolvedValue({ id: mockOrderId, statusCode: 'submitted' })
        },
        orderStatusHistory: {
          create: vi.fn().mockResolvedValue({
            id: 'history-123',
            orderId: mockOrderId,
            fromStatus: 'draft',
            toStatus: 'submitted',
            isAutomatic: true
          })
        },
        commentTemplate: {
          findFirst: vi.fn().mockResolvedValue(null)
        }
      };

      return fn(tx);
    });

    // Set up ServiceFulfillmentService spy default
    checkAllServicesSubmittedSpy.mockResolvedValue(false);

    // isTerminalStatus should return false for 'submitted'
    (isTerminalStatus as any).mockReturnValue(false);
  });

  // REGRESSION TEST: TD-028 auto-progression case-sensitivity
  it('Test 1: REGRESSION TEST - should call checkAllServicesSubmitted when status is lowercase submitted', async () => {
    // Validate that 'submitted' is accepted
    (updateServiceStatusSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { status: 'submitted' }
    });

    const request = new Request(`http://localhost/api/services/${mockServiceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'submitted'  // lowercase - what the real frontend sends
      })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: mockServiceId }) });

    // The route should succeed
    expect(response.status).toBe(200);

    // THE KEY ASSERTION: Before the fix, this will FAIL because line 360 checks for 'Submitted'
    // After the fix, this will PASS because line 360 will check SERVICE_STATUSES.SUBMITTED
    expect(checkAllServicesSubmittedSpy).toHaveBeenCalled();
    expect(checkAllServicesSubmittedSpy).toHaveBeenCalledWith(mockOrderId);
  });

  it('Test 2: Opposite-direction guard - Title Case Submitted should not trigger auto-progression', async () => {
    // Validation should reject Title Case
    (updateServiceStatusSchema.safeParse as any).mockReturnValue({
      success: false,
      error: {
        issues: [{ message: 'Invalid enum value' }]
      }
    });

    const request = new Request(`http://localhost/api/services/${mockServiceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'Submitted'  // Title Case - invalid
      })
    });

    await PUT(request, { params: Promise.resolve({ id: mockServiceId }) });

    // The only assertion: auto-progression check should NOT be called
    expect(checkAllServicesSubmittedSpy).not.toHaveBeenCalled();
  });

  it('Test 3: Non-submitted status should not trigger auto-progression check', async () => {
    // Validate that 'processing' is accepted
    (updateServiceStatusSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { status: 'processing' }
    });

    const request = new Request(`http://localhost/api/services/${mockServiceId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'processing'  // valid non-submitted status
      })
    });

    const response = await PUT(request, { params: Promise.resolve({ id: mockServiceId }) });

    // The route should succeed
    expect(response.status).toBe(200);

    // But auto-progression check should NOT be called for non-submitted statuses
    expect(checkAllServicesSubmittedSpy).not.toHaveBeenCalled();
  });
});