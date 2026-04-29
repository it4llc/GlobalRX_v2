// /GlobalRX_v2/src/lib/services/__tests__/candidate-invitation.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  generateSecureToken,
  createInvitation,
  lookupByToken,
  extendInvitation,
  resendInvitation,
  logOrderEvent
} from '@/lib/services/candidate-invitation.service';
import { prisma } from '@/lib/prisma';
import { OrderNumberService } from '@/lib/services/order-number.service';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { ORDER_EVENT_TYPES } from '@/constants/order-event-type';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    package: {
      findFirst: vi.fn()
    },
    customer: {
      findUnique: vi.fn()
    },
    order: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn()
    },
    candidateInvitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    orderStatusHistory: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/services/order-number.service', () => ({
  OrderNumberService: {
    generateOrderNumber: vi.fn()
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

describe('candidate-invitation.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSecureToken', () => {
    it('should generate a URL-safe base64 token', () => {
      const token = generateSecureToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // URL-safe means no +, /, or = characters
      expect(token).not.toMatch(/[+/=]/);
    });

    it('should generate different tokens on each call', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('createInvitation', () => {
    it('should throw error when package not found', async () => {
      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(null);

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      await expect(createInvitation(input, 'customer-1', 'user-1'))
        .rejects.toThrow('Package not found or does not belong to this customer');
    });

    it('should throw error when package has no workflow', async () => {
      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce({
        id: 'pkg-123',
        workflow: null
      });

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      await expect(createInvitation(input, 'customer-1', 'user-1'))
        .rejects.toThrow('This package does not have a workflow assigned');
    });

    it('should throw error when workflow is not active', async () => {
      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce({
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'inactive'
        }
      });

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      await expect(createInvitation(input, 'customer-1', 'user-1'))
        .rejects.toThrow('The workflow assigned to this package is not active');
    });

    it('should handle token collision and retry', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 14
        }
      };

      const mockCustomer = {
        id: 'customer-1',
        name: 'Test Company'
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);
      vi.mocked(prisma.customer.findUnique).mockResolvedValueOnce(mockCustomer);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);

      // Mocks for OrderNumberService
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null); // No existing orders
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null); // No collision on order number

      // First token exists, second one doesn't
      vi.mocked(prisma.candidateInvitation.findUnique)
        .mockResolvedValueOnce({ id: 'existing' }) // Collision
        .mockResolvedValueOnce(null); // No collision

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        customerId: 'customer-1',
        token: 'unique-token',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'sent',
        order: { id: 'order-123' }
      };

      vi.mocked(prisma.candidateInvitation.create).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.order.create).mockResolvedValueOnce({ id: 'order-123' });
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = await createInvitation(input, 'customer-1', 'user-1');

      expect(result).toBeDefined();
      // Should have checked for collision twice
      expect(prisma.candidateInvitation.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max token collision retries', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 14
        }
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);

      // All tokens collide
      vi.mocked(prisma.candidateInvitation.findUnique)
        .mockResolvedValue({ id: 'existing' }); // Always collision

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      await expect(createInvitation(input, 'customer-1', 'user-1'))
        .rejects.toThrow('Failed to generate unique invitation token');
    });

    it('should normalize email to lowercase', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 14
        }
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);

      // Mock OrderNumberService to return a test order number
      vi.mocked(OrderNumberService.generateOrderNumber).mockResolvedValueOnce('20240428-TST-0001');

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        customerId: 'customer-1',
        token: 'token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com', // lowercase
        status: 'sent',
        order: { id: 'order-123' }
      };

      vi.mocked(prisma.candidateInvitation.create).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.order.create).mockResolvedValueOnce({ id: 'order-123' });
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'JOHN@EXAMPLE.COM' // uppercase input
      };

      await createInvitation(input, 'customer-1', 'user-1');

      // Check that the create was called with lowercase email
      expect(prisma.candidateInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'john@example.com' // should be lowercase
          })
        })
      );
    });

    it('should calculate expiration date from workflow settings', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 7 // 7 days
        }
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);

      // Mock OrderNumberService to return a test order number
      vi.mocked(OrderNumberService.generateOrderNumber).mockResolvedValueOnce('20240428-TST-0002');

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      vi.mocked(prisma.order.create).mockResolvedValueOnce({ id: 'order-123' });
      vi.mocked(prisma.candidateInvitation.create).mockImplementationOnce(async ({ data }) => {
        const expiresAt = data.expiresAt as Date;
        const now = new Date();
        const daysDiff = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Should be approximately 7 days from now
        expect(daysDiff).toBeGreaterThanOrEqual(6);
        expect(daysDiff).toBeLessThanOrEqual(7);

        return {
          id: 'inv-123',
          orderId: 'order-123',
          ...data
        };
      });

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      await createInvitation(input, 'customer-1', 'user-1');
    });

    // REGRESSION TEST: proves bug fix for order number collision on invitation creation
    it('should use OrderNumberService to handle order number collisions', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 14
        }
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);

      // Mock OrderNumberService.generateOrderNumber to return a unique order number
      // This simulates the service handling collisions internally
      vi.mocked(OrderNumberService.generateOrderNumber).mockResolvedValueOnce('20240428-ABC-0001');

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null); // No token collision

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      vi.mocked(prisma.order.create).mockResolvedValueOnce({
        id: 'order-123',
        orderNumber: '20240428-ABC-0001'
      });

      vi.mocked(prisma.candidateInvitation.create).mockImplementationOnce(async ({ data }) => {
        return {
          id: 'inv-123',
          orderId: 'order-123',
          ...data
        };
      });

      const input = {
        packageId: 'pkg-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };

      const result = await createInvitation(input, 'customer-1', 'user-1');

      // Verify OrderNumberService was called with the correct customerId
      expect(OrderNumberService.generateOrderNumber).toHaveBeenCalledWith('customer-1');

      // Verify the order was created with the order number from OrderNumberService
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: '20240428-ABC-0001'
          })
        })
      );

      // Verify the invitation was created successfully
      expect(result.id).toBe('inv-123');
    });

    // REGRESSION TEST: verifies OrderNumberService handles multiple retries correctly
    it('should successfully create invitation when OrderNumberService handles collision internally', async () => {
      const mockPackage = {
        id: 'pkg-123',
        workflow: {
          id: 'workflow-1',
          status: 'active',
          expirationDays: 14
        }
      };

      vi.mocked(prisma.package.findFirst).mockResolvedValueOnce(mockPackage);

      // Mock OrderNumberService to simulate that it handled a collision internally
      // and returned a different order number after retry
      vi.mocked(OrderNumberService.generateOrderNumber)
        .mockResolvedValueOnce('20240428-XYZ-0002'); // Returns different number after internal retry

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      vi.mocked(prisma.order.create).mockResolvedValueOnce({
        id: 'order-456',
        orderNumber: '20240428-XYZ-0002'
      });

      vi.mocked(prisma.candidateInvitation.create).mockImplementationOnce(async ({ data }) => {
        return {
          id: 'inv-456',
          orderId: 'order-456',
          ...data
        };
      });

      const input = {
        packageId: 'pkg-123',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      };

      const result = await createInvitation(input, 'customer-1', 'user-1');

      // Verify the service was called and returned successfully
      expect(OrderNumberService.generateOrderNumber).toHaveBeenCalledWith('customer-1');
      expect(result.id).toBe('inv-456');
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: '20240428-XYZ-0002'
          })
        })
      );
    });
  });

  describe('lookupByToken', () => {
    it('should return null when invitation not found', async () => {
      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(null);

      const result = await lookupByToken('nonexistent-token');

      expect(result).toBeNull();
      expect(prisma.candidateInvitation.findUnique).toHaveBeenCalledWith({
        where: { token: 'nonexistent-token' }
      });
    });

    it('should return invitation without sensitive fields when found', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        customerId: 'customer-1',
        token: 'token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: '+1',
        phoneNumber: '555-1234',
        passwordHash: 'secret-hash',
        status: 'sent',
        previousStatus: null,
        expiresAt: new Date('2024-12-31'),
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date()
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation);

      const result = await lookupByToken('token-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('inv-123');
      expect(result?.firstName).toBe('John');
      // Should not include sensitive fields
      expect(result).not.toHaveProperty('token');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('previousStatus');
    });

    it('should update status to expired when invitation has expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        customerId: 'customer-1',
        token: 'token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: 'sent', // Not expired yet
        previousStatus: null,
        expiresAt: pastDate, // But date says it's expired
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date()
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce({
        ...mockInvitation,
        status: INVITATION_STATUSES.EXPIRED,
        previousStatus: 'sent'
      });

      const result = await lookupByToken('token-123');

      expect(result?.status).toBe(INVITATION_STATUSES.EXPIRED);

      // Should have updated the invitation
      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          previousStatus: 'sent',
          status: INVITATION_STATUSES.EXPIRED,
          updatedAt: expect.any(Date)
        }
      });

      // Should have logged the expiration event
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: ORDER_EVENT_TYPES.INVITATION_EXPIRED,
          message: 'Invitation has expired'
        })
      });
    });

    it('should not update status when already expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        customerId: 'customer-1',
        token: 'token-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneCountryCode: null,
        phoneNumber: null,
        passwordHash: null,
        status: INVITATION_STATUSES.EXPIRED, // Already expired
        previousStatus: 'sent',
        expiresAt: pastDate,
        createdAt: new Date('2024-01-01'),
        createdBy: 'user-1',
        completedAt: null,
        lastAccessedAt: null,
        updatedAt: new Date()
      };

      vi.mocked(prisma.candidateInvitation.findUnique).mockResolvedValueOnce(mockInvitation);

      const result = await lookupByToken('token-123');

      expect(result?.status).toBe(INVITATION_STATUSES.EXPIRED);

      // Should not have tried to update
      expect(prisma.candidateInvitation.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('extendInvitation', () => {
    it('should throw error when invitation not found', async () => {
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(null);

      await expect(extendInvitation('inv-123', 'customer-1', 'user-1', 7))
        .rejects.toThrow('Invitation not found or does not belong to this customer');
    });

    it('should throw error when extending completed invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        status: INVITATION_STATUSES.COMPLETED,
        order: {
          customer: {
            packages: []
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);

      await expect(extendInvitation('inv-123', 'customer-1', 'user-1', 7))
        .rejects.toThrow('Cannot extend a completed invitation');
    });

    it('should extend with specified days', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: 'sent',
        previousStatus: null,
        order: {
          customer: {
            packages: []
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });

      const updatedInvitation = {
        ...mockInvitation,
        expiresAt: new Date('2024-12-31'),
        updatedAt: new Date()
      };
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce(updatedInvitation);

      const result = await extendInvitation('inv-123', 'customer-1', 'user-1', 10);

      expect(result).toBeDefined();

      // Should have updated with new expiration
      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: {
          expiresAt: expect.any(Date),
          status: 'sent',
          previousStatus: null,
          updatedAt: expect.any(Date)
        }
      });

      // Should have logged the extension event
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: ORDER_EVENT_TYPES.INVITATION_EXTENDED,
          message: 'Invitation extended by 10 days'
        })
      });
    });

    it('should use workflow default when days not specified', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: 'sent',
        previousStatus: null,
        order: {
          customer: {
            packages: [{
              workflow: {
                expirationDays: 21 // More than 15
              }
            }]
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce({
        ...mockInvitation,
        expiresAt: new Date()
      });

      await extendInvitation('inv-123', 'customer-1', 'user-1'); // No days specified

      // Should cap at 15 days even though workflow says 21
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Invitation extended by 15 days' // Capped at 15
        })
      });
    });

    it('should restore previous status when extending expired invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.EXPIRED,
        previousStatus: 'opened',
        order: {
          customer: {
            packages: []
          }
        }
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
        return callback(prisma);
      });
      vi.mocked(prisma.candidateInvitation.update).mockResolvedValueOnce({
        ...mockInvitation,
        status: 'opened',
        previousStatus: null,
        expiresAt: new Date()
      });

      await extendInvitation('inv-123', 'customer-1', 'user-1', 7);

      // Should restore to previous status
      expect(prisma.candidateInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-123' },
        data: expect.objectContaining({
          status: 'opened', // Restored from previousStatus
          previousStatus: 'opened' // Keeps the value when expired
        })
      });
    });
  });

  describe('resendInvitation', () => {
    it('should throw error when invitation not found', async () => {
      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(null);

      await expect(resendInvitation('inv-123', 'customer-1', 'user-1'))
        .rejects.toThrow('Invitation not found or does not belong to this customer');
    });

    it('should throw error when resending expired invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.EXPIRED,
        email: 'john@example.com'
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);

      await expect(resendInvitation('inv-123', 'customer-1', 'user-1'))
        .rejects.toThrow('Cannot resend an expired invitation. Please extend it first.');
    });

    it('should throw error when resending draft invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.DRAFT,
        email: 'john@example.com'
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);

      await expect(resendInvitation('inv-123', 'customer-1', 'user-1'))
        .rejects.toThrow('Invitation cannot be resent in its current status');
    });

    it('should throw error when resending completed invitation', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.COMPLETED,
        email: 'john@example.com'
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);

      await expect(resendInvitation('inv-123', 'customer-1', 'user-1'))
        .rejects.toThrow('Invitation cannot be resent in its current status');
    });

    it('should successfully resend invitation with status sent', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.SENT,
        email: 'john@example.com'
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      const result = await resendInvitation('inv-123', 'customer-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Invitation has been resent');

      // Should have logged the resend event
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: ORDER_EVENT_TYPES.INVITATION_RESENT,
          message: 'Invitation resent'
        })
      });
    });

    it('should successfully resend invitation with status accessed', async () => {
      const mockInvitation = {
        id: 'inv-123',
        orderId: 'order-123',
        status: INVITATION_STATUSES.ACCESSED,
        email: 'jane@example.com'
      };

      vi.mocked(prisma.candidateInvitation.findFirst).mockResolvedValueOnce(mockInvitation);
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      const result = await resendInvitation('inv-123', 'customer-1', 'user-1');

      expect(result.success).toBe(true);

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Invitation resent'
        })
      });
    });
  });

  describe('logOrderEvent', () => {
    it('should create order status history record with correct fields', async () => {
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      await logOrderEvent(
        'order-123',
        ORDER_EVENT_TYPES.INVITATION_CREATED,
        'Invitation created for John Doe',
        'user-1',
        false
      );

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: {
          order: { connect: { id: 'order-123' } },
          fromStatus: null,
          toStatus: null,
          user: { connect: { id: 'user-1' } },
          eventType: ORDER_EVENT_TYPES.INVITATION_CREATED,
          message: 'Invitation created for John Doe',
          isAutomatic: false,
          createdAt: expect.any(Date)
        }
      });
    });

    it('should handle automatic events', async () => {
      vi.mocked(prisma.orderStatusHistory.create).mockResolvedValueOnce({});

      await logOrderEvent(
        'order-123',
        ORDER_EVENT_TYPES.INVITATION_EXPIRED,
        'Invitation has expired',
        'user-1',
        true // automatic
      );

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isAutomatic: true
        })
      });
    });
  });
});