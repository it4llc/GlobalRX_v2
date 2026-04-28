// /GlobalRX_v2/src/lib/utils/customer-order-permissions.test.ts

import { describe, it, expect } from 'vitest';
import { filterDataForCustomer } from './customer-order-permissions';

describe('customer-order-permissions', () => {
  describe('filterDataForCustomer', () => {
    const mockOrderData = {
      id: 'order-123',
      orderNumber: 'ORD-001',
      customerId: 'customer-1',
      statusCode: 'processing',
      subject: { firstName: 'John', lastName: 'Doe' },
      assignedVendor: { id: 'vendor-1', name: 'Test Vendor' },
      vendorNotes: 'Vendor specific notes',
      internalNotes: 'Internal company notes',
      pricing: { total: 100, subtotal: 90 },
      createdBy: 'user-1',
      createdByName: 'Admin User',
      updatedBy: 'user-2',
      updatedByName: 'Another Admin',
      user: { id: 'user-1', name: 'Admin User' },
      services: [
        {
          id: 'service-1',
          name: 'Background Check',
          assignedVendor: { id: 'vendor-1' },
          vendorNotes: 'Service vendor notes',
          internalNotes: 'Service internal notes',
          vendorPrice: 50
        }
      ],
      serviceFulfillments: [
        {
          id: 'fulfillment-1',
          status: 'assigned',
          assignedVendor: { id: 'vendor-1' },
          assignedVendorId: 'vendor-1',
          vendorNotes: 'Fulfillment vendor notes',
          internalNotes: 'Fulfillment internal notes'
        }
      ],
      statusHistory: [
        {
          id: 'history-1',
          fromStatus: 'pending',
          toStatus: 'processing',
          changedBy: 'user-1',
          changedByName: 'Admin User',
          changedByEmail: 'admin@example.com',
          user: { id: 'user-1' },
          createdAt: '2026-01-01'
        },
        {
          id: 'history-2',
          eventType: 'invitation_created',
          message: 'Invitation sent to candidate',
          changedBy: 'user-2',
          changedByName: 'Another Admin',
          changedByEmail: 'admin2@example.com',
          user: { id: 'user-2', name: 'Another Admin' },
          createdAt: '2026-01-02'
        },
        {
          id: 'history-3',
          eventType: 'invitation_extended',
          message: 'Invitation expiration extended by Another Admin',
          changedBy: 'user-2',
          changedByName: 'Another Admin',
          changedByEmail: 'admin2@example.com',
          user: { id: 'user-2', name: 'Another Admin' },
          createdAt: '2026-01-03'
        }
      ],
      items: [
        {
          id: 'item-1',
          serviceId: 'service-1',
          locationId: 'location-1',
          status: 'processing',
          serviceFulfillment: {
            id: 'fulfillment-1',
            assignedVendorId: 'vendor-1',
            vendorNotes: 'Item fulfillment vendor notes',
            internalNotes: 'Item fulfillment internal notes',
            assignedBy: 'user-1'
          }
        }
      ]
    };

    it('should remove vendor information from top level', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.assignedVendor).toBeUndefined();
      expect(filtered.vendorNotes).toBeUndefined();
    });

    it('should remove internal notes from top level', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.internalNotes).toBeUndefined();
    });

    it('should remove pricing information', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.pricing).toBeUndefined();
    });

    it('should remove user identity information', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.createdBy).toBeUndefined();
      expect(filtered.createdByName).toBeUndefined();
      expect(filtered.updatedBy).toBeUndefined();
      expect(filtered.updatedByName).toBeUndefined();
      expect(filtered.user).toBeUndefined();
    });

    it('should preserve core order information', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.id).toBe('order-123');
      expect(filtered.orderNumber).toBe('ORD-001');
      expect(filtered.customerId).toBe('customer-1');
      expect(filtered.statusCode).toBe('processing');
      expect(filtered.subject).toEqual({ firstName: 'John', lastName: 'Doe' });
    });

    it('should filter vendor information from services array', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.services).toBeDefined();
      expect(filtered.services).toHaveLength(1);

      const service = filtered.services![0];
      expect(service.id).toBe('service-1');
      expect(service.name).toBe('Background Check');
      expect(service.assignedVendor).toBeUndefined();
      expect(service.vendorNotes).toBeUndefined();
      expect(service.internalNotes).toBeUndefined();
      expect(service.vendorPrice).toBeUndefined();
    });

    it('should filter vendor information from serviceFulfillments array', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.serviceFulfillments).toBeDefined();
      expect(filtered.serviceFulfillments).toHaveLength(1);

      const fulfillment = filtered.serviceFulfillments![0];
      expect(fulfillment.id).toBe('fulfillment-1');
      expect(fulfillment.status).toBe('assigned');
      expect(fulfillment.assignedVendor).toBeUndefined();
      expect(fulfillment.assignedVendorId).toBeUndefined();
      expect(fulfillment.vendorNotes).toBeUndefined();
      expect(fulfillment.internalNotes).toBeUndefined();
    });

    it('should anonymize status history for regular status changes', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.statusHistory).toBeDefined();
      expect(filtered.statusHistory).toHaveLength(3);

      // Regular status change should be anonymized
      const statusChange = filtered.statusHistory!.find(h => h.id === 'history-1')!;
      expect(statusChange.fromStatus).toBe('pending');
      expect(statusChange.toStatus).toBe('processing');
      expect(statusChange.changedBy).toBeUndefined();
      expect(statusChange.changedByName).toBeUndefined();
      expect(statusChange.changedByEmail).toBeUndefined();
      expect(statusChange.user).toBeUndefined();
    });

    it('should preserve user information for invitation events', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.statusHistory).toBeDefined();

      // Invitation created event should preserve user info
      const invitationCreated = filtered.statusHistory!.find(h => h.id === 'history-2')!;
      expect(invitationCreated.eventType).toBe('invitation_created');
      expect(invitationCreated.message).toBe('Invitation sent to candidate');
      expect(invitationCreated.changedBy).toBe('user-2');
      expect(invitationCreated.changedByName).toBe('Another Admin');
      expect(invitationCreated.changedByEmail).toBe('admin2@example.com');
      expect(invitationCreated.user).toEqual({ id: 'user-2', name: 'Another Admin' });

      // Invitation extended event should preserve user info
      const invitationExtended = filtered.statusHistory!.find(h => h.id === 'history-3')!;
      expect(invitationExtended.eventType).toBe('invitation_extended');
      expect(invitationExtended.message).toBe('Invitation expiration extended by Another Admin');
      expect(invitationExtended.changedBy).toBe('user-2');
      expect(invitationExtended.changedByName).toBe('Another Admin');
      expect(invitationExtended.changedByEmail).toBe('admin2@example.com');
      expect(invitationExtended.user).toEqual({ id: 'user-2', name: 'Another Admin' });
    });

    it('should filter vendor information from items and nested service fulfillments', () => {
      const filtered = filterDataForCustomer(mockOrderData);

      expect(filtered.items).toBeDefined();
      expect(filtered.items).toHaveLength(1);

      const item = filtered.items![0];
      expect(item.id).toBe('item-1');
      expect(item.serviceId).toBe('service-1');
      expect(item.locationId).toBe('location-1');
      expect(item.status).toBe('processing');

      expect(item.serviceFulfillment).toBeDefined();
      const fulfillment = item.serviceFulfillment!;
      expect(fulfillment.id).toBe('fulfillment-1');
      expect(fulfillment.assignedVendorId).toBeUndefined();
      expect(fulfillment.vendorNotes).toBeUndefined();
      expect(fulfillment.internalNotes).toBeUndefined();
      expect(fulfillment.assignedBy).toBeUndefined();
    });

    it('should not mutate the original data object', () => {
      const originalData = { ...mockOrderData };
      const filtered = filterDataForCustomer(mockOrderData);

      // Original data should remain unchanged
      expect(mockOrderData.assignedVendor).toEqual({ id: 'vendor-1', name: 'Test Vendor' });
      expect(mockOrderData.vendorNotes).toBe('Vendor specific notes');
      expect(mockOrderData.internalNotes).toBe('Internal company notes');

      // Filtered data should be different
      expect(filtered.assignedVendor).toBeUndefined();
      expect(filtered.vendorNotes).toBeUndefined();
      expect(filtered.internalNotes).toBeUndefined();
    });

    it('should handle empty arrays gracefully', () => {
      const dataWithEmptyArrays = {
        id: 'order-123',
        services: [],
        serviceFulfillments: [],
        statusHistory: [],
        items: []
      };

      const filtered = filterDataForCustomer(dataWithEmptyArrays);

      expect(filtered.services).toEqual([]);
      expect(filtered.serviceFulfillments).toEqual([]);
      expect(filtered.statusHistory).toEqual([]);
      expect(filtered.items).toEqual([]);
    });

    it('should handle missing optional arrays', () => {
      const dataWithoutArrays = {
        id: 'order-123',
        orderNumber: 'ORD-001'
      };

      const filtered = filterDataForCustomer(dataWithoutArrays);

      expect(filtered.id).toBe('order-123');
      expect(filtered.orderNumber).toBe('ORD-001');
      // Should not crash when arrays are undefined
    });

    it('should handle statusHistory events without eventType', () => {
      const dataWithMixedHistory = {
        id: 'order-123',
        statusHistory: [
          {
            id: 'history-1',
            fromStatus: 'pending',
            toStatus: 'processing',
            changedBy: 'user-1',
            changedByName: 'Admin User',
            user: { id: 'user-1' }
          },
          {
            id: 'history-2',
            // No eventType - should be treated as regular status change
            fromStatus: 'processing',
            toStatus: 'completed',
            changedBy: 'user-2',
            changedByName: 'Another Admin',
            user: { id: 'user-2' }
          }
        ]
      };

      const filtered = filterDataForCustomer(dataWithMixedHistory);

      expect(filtered.statusHistory).toHaveLength(2);

      // Both should be anonymized since they don't have invitation_ eventType
      filtered.statusHistory!.forEach(history => {
        expect(history.changedBy).toBeUndefined();
        expect(history.changedByName).toBeUndefined();
        expect(history.user).toBeUndefined();
      });
    });

    it('should only preserve user info for invitation_ prefixed event types', () => {
      const dataWithVariousEvents = {
        id: 'order-123',
        statusHistory: [
          {
            id: 'history-1',
            eventType: 'invitation_created',
            message: 'Created invitation',
            changedBy: 'user-1',
            changedByName: 'Admin',
            user: { id: 'user-1' }
          },
          {
            id: 'history-2',
            eventType: 'invitation_resent',
            message: 'Resent invitation',
            changedBy: 'user-2',
            changedByName: 'Admin 2',
            user: { id: 'user-2' }
          },
          {
            id: 'history-3',
            eventType: 'order_status_changed',
            message: 'Changed order status',
            changedBy: 'user-3',
            changedByName: 'Admin 3',
            user: { id: 'user-3' }
          },
          {
            id: 'history-4',
            eventType: 'document_uploaded',
            message: 'Uploaded document',
            changedBy: 'user-4',
            changedByName: 'Admin 4',
            user: { id: 'user-4' }
          }
        ]
      };

      const filtered = filterDataForCustomer(dataWithVariousEvents);

      expect(filtered.statusHistory).toHaveLength(4);

      // Invitation events should preserve user info
      const invitationCreated = filtered.statusHistory!.find(h => h.id === 'history-1')!;
      expect(invitationCreated.changedBy).toBe('user-1');
      expect(invitationCreated.changedByName).toBe('Admin');
      expect(invitationCreated.user).toEqual({ id: 'user-1' });

      const invitationResent = filtered.statusHistory!.find(h => h.id === 'history-2')!;
      expect(invitationResent.changedBy).toBe('user-2');
      expect(invitationResent.changedByName).toBe('Admin 2');
      expect(invitationResent.user).toEqual({ id: 'user-2' });

      // Non-invitation events should be anonymized
      const statusChanged = filtered.statusHistory!.find(h => h.id === 'history-3')!;
      expect(statusChanged.changedBy).toBeUndefined();
      expect(statusChanged.changedByName).toBeUndefined();
      expect(statusChanged.user).toBeUndefined();

      const documentUploaded = filtered.statusHistory!.find(h => h.id === 'history-4')!;
      expect(documentUploaded.changedBy).toBeUndefined();
      expect(documentUploaded.changedByName).toBeUndefined();
      expect(documentUploaded.user).toBeUndefined();
    });
  });
});