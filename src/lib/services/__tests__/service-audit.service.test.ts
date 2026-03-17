// /GlobalRX_v2/src/lib/services/__tests__/service-audit.service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceAuditService } from '../service-audit.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceAuditLog: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    },
    servicesFulfillment: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('ServiceAuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logChange', () => {
    it('should create an audit log entry for status change', async () => {
      const auditData = {
        serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-789',
        changeType: 'status_change' as const,
        fieldName: 'status',
        oldValue: 'pending',
        newValue: 'processing',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      const mockCreatedLog = {
        id: 'log-001',
        ...auditData,
        createdAt: new Date()
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce(mockCreatedLog);

      const result = await ServiceAuditService.logChange(auditData);

      expect(result).toEqual(mockCreatedLog);
      expect(prisma.serviceAuditLog.create).toHaveBeenCalledWith({
        data: auditData
      });
    });

    it('should create an audit log entry for vendor assignment', async () => {
      const auditData = {
        serviceFulfillmentId: 'd47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440003',
        userId: 'admin-123',
        changeType: 'vendor_assignment' as const,
        fieldName: 'assignedVendorId',
        oldValue: null,
        newValue: 'vendor-123',
        notes: 'Assigned to preferred vendor',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120.0'
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce({
        id: 'log-002',
        ...auditData,
        createdAt: new Date()
      });

      await ServiceAuditService.logChange(auditData);

      expect(prisma.serviceAuditLog.create).toHaveBeenCalledWith({
        data: auditData
      });
    });

    it('should create an audit log entry for note updates', async () => {
      const auditData = {
        serviceFulfillmentId: '947ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        userId: 'user-456',
        changeType: 'note_update' as const,
        fieldName: 'vendorNotes',
        oldValue: 'Initial note',
        newValue: 'Updated note with more details',
        ipAddress: null,
        userAgent: null
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce({
        id: 'log-003',
        ...auditData,
        createdAt: new Date()
      });

      await ServiceAuditService.logChange(auditData);

      expect(prisma.serviceAuditLog.create).toHaveBeenCalledWith({
        data: auditData
      });
    });

    it('should handle long text values in oldValue and newValue', async () => {
      const longText = 'A'.repeat(5000); // Max 5000 chars
      const auditData = {
        serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-789',
        changeType: 'note_update' as const,
        fieldName: 'internalNotes',
        oldValue: longText,
        newValue: longText + 'B',
        ipAddress: null,
        userAgent: null
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce({
        id: 'log-004',
        ...auditData,
        createdAt: new Date()
      });

      await ServiceAuditService.logChange(auditData);

      expect(prisma.serviceAuditLog.create).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const auditData = {
        serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-789',
        changeType: 'status_change' as const,
        fieldName: 'status',
        oldValue: 'pending',
        newValue: 'processing'
      };

      vi.mocked(prisma.serviceAuditLog.create).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(ServiceAuditService.logChange(auditData))
        .rejects.toThrow('Database connection failed');
    });

    it('should include optional notes field when provided', async () => {
      const auditData = {
        serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-789',
        changeType: 'status_change' as const,
        fieldName: 'status',
        oldValue: 'processing',
        newValue: 'completed',
        notes: 'Completed after customer verification',
        ipAddress: '127.0.0.1',
        userAgent: 'Safari/17.0'
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce({
        id: 'log-005',
        ...auditData,
        createdAt: new Date()
      });

      await ServiceAuditService.logChange(auditData);

      expect(prisma.serviceAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notes: 'Completed after customer verification'
        })
      });
    });
  });

  describe('logBulkChange', () => {
    it('should create multiple audit logs for bulk vendor assignment', async () => {
      const changes = [
        {
          serviceFulfillmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: '550e8400-e29b-41d4-a716-446655440004',
          oldVendorId: null,
          newVendorId: 'vendor-123'
        },
        {
          serviceFulfillmentId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: '550e8400-e29b-41d4-a716-446655440005',
          oldVendorId: 'vendor-old',
          newVendorId: 'vendor-123'
        },
        {
          serviceFulfillmentId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: '550e8400-e29b-41d4-a716-446655440006',
          oldVendorId: null,
          newVendorId: 'vendor-123'
        }
      ];

      const userId = 'admin-user';
      const context = {
        ipAddress: '10.0.0.1',
        userAgent: 'Test Browser'
      };

      vi.mocked(prisma.serviceAuditLog.createMany).mockResolvedValueOnce({
        count: 3
      });

      const result = await ServiceAuditService.logBulkChange(changes, userId, context);

      expect(result).toEqual({ created: 3 });

      expect(prisma.serviceAuditLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            serviceFulfillmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderId: '550e8400-e29b-41d4-a716-446655440004',
            userId: 'admin-user',
            changeType: 'vendor_assignment',
            fieldName: 'assignedVendorId',
            oldValue: null,
            newValue: 'vendor-123',
            ipAddress: '10.0.0.1',
            userAgent: 'Test Browser',
            createdAt: expect.any(Date)
          },
          {
            serviceFulfillmentId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderId: '550e8400-e29b-41d4-a716-446655440005',
            userId: 'admin-user',
            changeType: 'vendor_assignment',
            fieldName: 'assignedVendorId',
            oldValue: 'vendor-old',
            newValue: 'vendor-123',
            ipAddress: '10.0.0.1',
            userAgent: 'Test Browser',
            createdAt: expect.any(Date)
          },
          {
            serviceFulfillmentId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
            orderId: '550e8400-e29b-41d4-a716-446655440006',
            userId: 'admin-user',
            changeType: 'vendor_assignment',
            fieldName: 'assignedVendorId',
            oldValue: null,
            newValue: 'vendor-123',
            ipAddress: '10.0.0.1',
            userAgent: 'Test Browser',
            createdAt: expect.any(Date)
          }
        ]
      });
    });

    it('should handle empty changes array', async () => {
      const result = await ServiceAuditService.logBulkChange([], 'user-123', {});

      expect(result).toEqual({ created: 0 });
      expect(prisma.serviceAuditLog.createMany).not.toHaveBeenCalled();
    });

    it('should handle database errors in bulk operations', async () => {
      const changes = [
        {
          serviceFulfillmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: '550e8400-e29b-41d4-a716-446655440004',
          oldVendorId: null,
          newVendorId: 'vendor-123'
        }
      ];

      vi.mocked(prisma.serviceAuditLog.createMany).mockRejectedValueOnce(
        new Error('Bulk insert failed')
      );

      await expect(ServiceAuditService.logBulkChange(changes, 'user-123', {}))
        .rejects.toThrow('Bulk insert failed');
    });
  });

  describe('getHistory', () => {
    it('should return audit history for a service', async () => {
      const serviceFulfillmentId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
      const mockHistory = [
        {
          id: 'log-1',
          serviceFulfillmentId,
          orderId: '550e8400-e29b-41d4-a716-446655440002',
          userId: 'user-1',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'pending',
          newValue: 'submitted',
          notes: null,
          ipAddress: '127.0.0.1',
          userAgent: 'Chrome',
          createdAt: new Date('2024-03-01T10:00:00Z'),
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User'
          }
        },
        {
          id: 'log-2',
          serviceFulfillmentId,
          orderId: '550e8400-e29b-41d4-a716-446655440002',
          userId: 'user-2',
          changeType: 'vendor_assignment',
          fieldName: 'assignedVendorId',
          oldValue: null,
          newValue: 'vendor-123',
          notes: 'Assigned to preferred vendor',
          ipAddress: '192.168.1.1',
          userAgent: 'Firefox',
          createdAt: new Date('2024-03-01T11:00:00Z'),
          user: {
            id: 'user-2',
            email: 'manager@example.com',
            firstName: 'Manager',
            lastName: 'User'
          }
        },
        {
          id: 'log-3',
          serviceFulfillmentId,
          orderId: '550e8400-e29b-41d4-a716-446655440002',
          userId: 'vendor-user',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'submitted',
          newValue: 'processing',
          notes: null,
          ipAddress: '10.0.0.1',
          userAgent: 'Safari',
          createdAt: new Date('2024-03-01T12:00:00Z'),
          user: {
            id: 'vendor-user',
            email: 'vendor@example.com',
            firstName: 'Vendor',
            lastName: 'User'
          }
        }
      ];

      vi.mocked(prisma.serviceAuditLog.findMany).mockResolvedValueOnce(mockHistory);

      const result = await ServiceAuditService.getHistory(serviceFulfillmentId);

      expect(result).toEqual(mockHistory);
      expect(prisma.serviceAuditLog.findMany).toHaveBeenCalledWith({
        where: { serviceFulfillmentId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
    });

    it('should return empty array for service with no history', async () => {
      vi.mocked(prisma.serviceAuditLog.findMany).mockResolvedValueOnce([]);

      const result = await ServiceAuditService.getHistory('service-no-history');

      expect(result).toEqual([]);
    });

    it('should handle database errors when fetching history', async () => {
      vi.mocked(prisma.serviceAuditLog.findMany).mockRejectedValueOnce(
        new Error('Query timeout')
      );

      await expect(ServiceAuditService.getHistory('c47ac10b-58cc-4372-a567-0e02b2c3d479'))
        .rejects.toThrow('Query timeout');
    });

    it('should include all change types in history', async () => {
      const mockHistory = [
        {
          id: 'log-1',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'pending',
          newValue: 'submitted',
          createdAt: new Date('2024-03-01T10:00:00Z')
        },
        {
          id: 'log-2',
          changeType: 'vendor_assignment',
          fieldName: 'assignedVendorId',
          oldValue: 'vendor-old',
          newValue: 'vendor-new',
          createdAt: new Date('2024-03-01T11:00:00Z')
        },
        {
          id: 'log-3',
          changeType: 'note_update',
          fieldName: 'vendorNotes',
          oldValue: 'Initial notes',
          newValue: 'Updated notes with findings',
          createdAt: new Date('2024-03-01T12:00:00Z')
        },
        {
          id: 'log-4',
          changeType: 'note_update',
          fieldName: 'internalNotes',
          oldValue: null,
          newValue: 'Internal review completed',
          createdAt: new Date('2024-03-01T13:00:00Z')
        }
      ];

      vi.mocked(prisma.serviceAuditLog.findMany).mockResolvedValueOnce(mockHistory);

      const result = await ServiceAuditService.getHistory('c47ac10b-58cc-4372-a567-0e02b2c3d479');

      expect(result).toHaveLength(4);
      expect(result.map(log => log.changeType)).toEqual([
        'status_change',
        'vendor_assignment',
        'note_update',
        'note_update'
      ]);
    });
  });

  describe('getHistoryByOrder', () => {
    it('should return all audit logs for an order', async () => {
      const orderId = '550e8400-e29b-41d4-a716-446655440002';
      const mockHistory = [
        {
          id: 'log-1',
          serviceFulfillmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId,
          changeType: 'status_change',
          createdAt: new Date('2024-03-01T10:00:00Z')
        },
        {
          id: 'log-2',
          serviceFulfillmentId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId,
          changeType: 'vendor_assignment',
          createdAt: new Date('2024-03-01T10:30:00Z')
        },
        {
          id: 'log-3',
          serviceFulfillmentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId,
          changeType: 'status_change',
          createdAt: new Date('2024-03-01T11:00:00Z')
        }
      ];

      vi.mocked(prisma.serviceAuditLog.findMany).mockResolvedValueOnce(mockHistory);

      const result = await ServiceAuditService.getOrderHistory(orderId);

      expect(result).toEqual(mockHistory);
      expect(prisma.serviceAuditLog.findMany).toHaveBeenCalledWith({
        where: { orderId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          serviceFulfillment: {
            include: {
              service: true,
              location: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('getStatsByUser', () => {
    it('should return audit statistics for a user', async () => {
      const userId = 'user-123';
      const startDate = new Date('2024-03-01');
      const endDate = new Date('2024-03-31');

      vi.mocked(prisma.serviceAuditLog.count).mockResolvedValueOnce(25);

      const mockGroupedStats = [
        { changeType: 'status_change', _count: 15 },
        { changeType: 'vendor_assignment', _count: 7 },
        { changeType: 'note_update', _count: 3 }
      ];

      vi.mocked(prisma.serviceAuditLog.findMany).mockResolvedValueOnce(mockGroupedStats);

      const result = await ServiceAuditService.getStatsByUser(userId, startDate, endDate);

      expect(result).toEqual({
        totalChanges: 25,
        byType: {
          status_change: 15,
          vendor_assignment: 7,
          note_update: 3
        }
      });

      expect(prisma.serviceAuditLog.count).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
    });
  });

  describe('audit trail integrity', () => {
    it('should never allow modification of existing audit logs', async () => {
      // This test verifies that the service doesn't expose any update methods
      // Audit logs should be immutable once created

      expect(ServiceAuditService).not.toHaveProperty('updateLog');
      expect(ServiceAuditService).not.toHaveProperty('deleteLog');
      expect(ServiceAuditService).not.toHaveProperty('modifyLog');
    });

    it('should always include timestamp in audit logs', async () => {
      const auditData = {
        serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 'user-789',
        changeType: 'status_change' as const,
        fieldName: 'status',
        oldValue: 'pending',
        newValue: 'processing'
      };

      vi.mocked(prisma.serviceAuditLog.create).mockResolvedValueOnce({
        id: 'log-timestamp',
        ...auditData,
        ipAddress: null,
        userAgent: null,
        notes: null,
        createdAt: new Date('2024-03-01T15:30:00Z')
      });

      const result = await ServiceAuditService.logChange(auditData);

      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });
});