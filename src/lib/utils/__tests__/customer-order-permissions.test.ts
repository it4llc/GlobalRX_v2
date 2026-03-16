// /GlobalRX_v2/src/lib/utils/__tests__/customer-order-permissions.test.ts
// Unit tests for customer order view-only permission logic

import { describe, it, expect } from 'vitest';
import {
  canCustomerViewOrder,
  filterDataForCustomer,
  getVisibleCommentCount
} from '../customer-order-permissions';

describe('canCustomerViewOrder', () => {
  describe('valid access scenarios', () => {
    it('should allow customer to view their own order', () => {
      const result = canCustomerViewOrder('customer', 'cust-123', 'cust-123');
      expect(result).toBe(true);
    });

    it('should allow internal users to view any order', () => {
      const result = canCustomerViewOrder('internal', null, 'cust-123');
      expect(result).toBe(true);
    });

    it('should allow admin users to view any order', () => {
      const result = canCustomerViewOrder('admin', null, 'cust-456');
      expect(result).toBe(true);
    });

    it('should allow vendor users to view orders (vendor logic separate)', () => {
      // Vendors have their own logic, but shouldn't be blocked here
      const result = canCustomerViewOrder('vendor', null, 'cust-789');
      expect(result).toBe(true);
    });
  });

  describe('invalid access scenarios', () => {
    it('should deny customer viewing another customers order', () => {
      const result = canCustomerViewOrder('customer', 'cust-123', 'cust-456');
      expect(result).toBe(false);
    });

    it('should deny customer with null customerId', () => {
      const result = canCustomerViewOrder('customer', null, 'cust-123');
      expect(result).toBe(false);
    });

    it('should deny customer with empty customerId', () => {
      const result = canCustomerViewOrder('customer', '', 'cust-123');
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined userType as denied', () => {
      const result = canCustomerViewOrder(undefined as any, 'cust-123', 'cust-123');
      expect(result).toBe(false);
    });

    it('should handle case sensitivity in userType', () => {
      const result = canCustomerViewOrder('CUSTOMER', 'cust-123', 'cust-123');
      expect(result).toBe(false); // Strict checking, must be lowercase
    });
  });
});

describe('filterDataForCustomer', () => {
  const fullOrderData = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    orderNumber: '20240310-ABC-0001',
    statusCode: 'processing',
    customerId: 'cust-123',
    subject: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123-45-6789',
      dateOfBirth: '1990-01-01'
    },
    customer: {
      id: 'cust-123',
      name: 'ACME Corp',
      code: 'ABC'
    },
    assignedVendor: {
      id: 'vendor-456',
      name: 'Background Check Co',
      email: 'vendor@example.com'
    },
    vendorNotes: 'Internal vendor communication',
    internalNotes: 'Staff only notes',
    pricing: {
      cost: 50.00,
      markup: 25.00,
      total: 75.00
    },
    createdBy: 'user-789',
    createdByName: 'Jane Admin',
    updatedBy: 'user-890',
    updatedByName: 'Bob Manager'
  };

  describe('customer user filtering', () => {
    it('should remove vendor information for customers', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.assignedVendor).toBeUndefined();
      expect(filtered.vendorNotes).toBeUndefined();
    });

    it('should remove internal notes for customers', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.internalNotes).toBeUndefined();
    });

    it('should remove pricing information for customers', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.pricing).toBeUndefined();
    });

    it('should remove user identity information for customers', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.createdBy).toBeUndefined();
      expect(filtered.createdByName).toBeUndefined();
      expect(filtered.updatedBy).toBeUndefined();
      expect(filtered.updatedByName).toBeUndefined();
    });

    it('should keep essential order information', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(filtered.orderNumber).toBe('20240310-ABC-0001');
      expect(filtered.statusCode).toBe('processing');
      expect(filtered.customerId).toBe('cust-123');
    });

    it('should keep subject information', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.subject).toEqual(fullOrderData.subject);
    });

    it('should keep customer information', () => {
      const filtered = filterDataForCustomer(fullOrderData);

      expect(filtered.customer).toEqual(fullOrderData.customer);
    });
  });

  describe('service fulfillment filtering', () => {
    it('should filter vendor information from services', () => {
      const dataWithServices = {
        ...fullOrderData,
        services: [
          {
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            name: 'Background Check',
            status: 'processing',
            assignedVendor: {
              id: 'vendor-123',
              name: 'Vendor Co'
            },
            vendorNotes: 'Vendor internal notes',
            internalNotes: 'Our internal notes',
            vendorPrice: 50.00
          }
        ]
      };

      const filtered = filterDataForCustomer(dataWithServices);

      expect(filtered.services[0].assignedVendor).toBeUndefined();
      expect(filtered.services[0].vendorNotes).toBeUndefined();
      expect(filtered.services[0].internalNotes).toBeUndefined();
      expect(filtered.services[0].vendorPrice).toBeUndefined();
      expect(filtered.services[0].name).toBe('Background Check');
      expect(filtered.services[0].status).toBe('processing');
    });
  });

  describe('status history filtering', () => {
    it('should anonymize user information in status history', () => {
      const dataWithHistory = {
        ...fullOrderData,
        statusHistory: [
          {
            id: 'history-1',
            status: 'submitted',
            changedAt: '2024-03-10T10:00:00Z',
            changedBy: 'user-123',
            changedByName: 'Alice User',
            changedByEmail: 'alice@example.com'
          }
        ]
      };

      const filtered = filterDataForCustomer(dataWithHistory);

      expect(filtered.statusHistory[0].changedBy).toBeUndefined();
      expect(filtered.statusHistory[0].changedByName).toBeUndefined();
      expect(filtered.statusHistory[0].changedByEmail).toBeUndefined();
      expect(filtered.statusHistory[0].status).toBe('submitted');
      expect(filtered.statusHistory[0].changedAt).toBe('2024-03-10T10:00:00Z');
    });
  });
});

describe('getVisibleCommentCount', () => {
  describe('customer users', () => {
    it('should count only external comments for customers', () => {
      const comments = [
        { isInternalOnly: false },
        { isInternalOnly: true },
        { isInternalOnly: false },
        { isInternalOnly: true },
        { isInternalOnly: false }
      ];

      const count = getVisibleCommentCount(comments, 'customer');
      expect(count).toBe(3);
    });

    it('should return 0 when all comments are internal', () => {
      const comments = [
        { isInternalOnly: true },
        { isInternalOnly: true },
        { isInternalOnly: true }
      ];

      const count = getVisibleCommentCount(comments, 'customer');
      expect(count).toBe(0);
    });

    it('should return total when all comments are external', () => {
      const comments = [
        { isInternalOnly: false },
        { isInternalOnly: false },
        { isInternalOnly: false }
      ];

      const count = getVisibleCommentCount(comments, 'customer');
      expect(count).toBe(3);
    });

    it('should return 0 for empty array', () => {
      const count = getVisibleCommentCount([], 'customer');
      expect(count).toBe(0);
    });
  });

  describe('internal users', () => {
    it('should count all comments for internal users', () => {
      const comments = [
        { isInternalOnly: false },
        { isInternalOnly: true },
        { isInternalOnly: false },
        { isInternalOnly: true },
        { isInternalOnly: false }
      ];

      const count = getVisibleCommentCount(comments, 'internal');
      expect(count).toBe(5);
    });

    it('should count all comments for admin users', () => {
      const comments = [
        { isInternalOnly: true },
        { isInternalOnly: true },
        { isInternalOnly: false }
      ];

      const count = getVisibleCommentCount(comments, 'admin');
      expect(count).toBe(3);
    });
  });

  describe('vendor users', () => {
    it('should count only external comments for vendors', () => {
      const comments = [
        { isInternalOnly: false },
        { isInternalOnly: true },
        { isInternalOnly: false }
      ];

      const count = getVisibleCommentCount(comments, 'vendor');
      expect(count).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle null comments array', () => {
      const count = getVisibleCommentCount(null as any, 'customer');
      expect(count).toBe(0);
    });

    it('should handle undefined comments array', () => {
      const count = getVisibleCommentCount(undefined as any, 'customer');
      expect(count).toBe(0);
    });

    it('should handle comments with missing isInternalOnly', () => {
      const comments = [
        { isInternalOnly: false },
        {} as any, // Missing isInternalOnly
        { isInternalOnly: true }
      ];

      const count = getVisibleCommentCount(comments, 'customer');
      expect(count).toBe(1); // For safety, treat missing as internal (only explicit false = external)
    });
  });
});