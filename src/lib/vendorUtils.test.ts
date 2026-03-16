// /GlobalRX_v2/src/lib/vendorUtils.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canUserAccessVendorOrders,
  canUserManageVendors,
  validateOnlyOnePrimaryVendor,
  getUserViewMode,
  canUserToggleViews,
  filterOrdersByUserAccess
} from '@/lib/vendorUtils';

describe('Vendor Utilities', () => {
  describe('canUserAccessVendorOrders', () => {
    it('should return true for internal users', () => {
      const user = {
        id: '1',
        userType: 'internal',
        permissions: { candidate_workflow: true }
      };

      expect(canUserAccessVendorOrders(user, 'vendor-123')).toBe(true);
    });

    it('should return true for vendor users accessing their own vendor', () => {
      const user = {
        id: '2',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: {}
      };

      expect(canUserAccessVendorOrders(user, 'vendor-123')).toBe(true);
    });

    it('should return false for vendor users accessing different vendor', () => {
      const user = {
        id: '3',
        userType: 'vendor',
        vendorId: 'vendor-456',
        permissions: {}
      };

      expect(canUserAccessVendorOrders(user, 'vendor-123')).toBe(false);
    });

    it('should return false for customer users', () => {
      const user = {
        id: '4',
        userType: 'customer',
        customerId: 'customer-123',
        permissions: { candidate_workflow: true }
      };

      expect(canUserAccessVendorOrders(user, 'vendor-123')).toBe(false);
    });

    it('should return false for null user', () => {
      expect(canUserAccessVendorOrders(null, 'vendor-123')).toBe(false);
    });

    it('should handle undefined vendorId for vendor users', () => {
      const user = {
        id: '5',
        userType: 'vendor',
        permissions: {}
      };

      expect(canUserAccessVendorOrders(user, 'vendor-123')).toBe(false);
    });
  });

  describe('canUserManageVendors', () => {
    it('should return true for internal users with global_config permission', () => {
      const user = {
        id: '1',
        userType: 'internal',
        permissions: { global_config: true }
      };

      expect(canUserManageVendors(user)).toBe(true);
    });

    it('should return true for internal users with user_admin permission', () => {
      const user = {
        id: '2',
        userType: 'internal',
        permissions: { user_admin: true }
      };

      expect(canUserManageVendors(user)).toBe(true);
    });

    it('should return false for internal users without admin permissions', () => {
      const user = {
        id: '3',
        userType: 'internal',
        permissions: { candidate_workflow: true }
      };

      expect(canUserManageVendors(user)).toBe(false);
    });

    it('should return false for vendor users', () => {
      const user = {
        id: '4',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: { user_admin: true }
      };

      expect(canUserManageVendors(user)).toBe(false);
    });

    it('should return false for customer users', () => {
      const user = {
        id: '5',
        userType: 'customer',
        customerId: 'customer-123',
        permissions: { global_config: true }
      };

      expect(canUserManageVendors(user)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(canUserManageVendors(null)).toBe(false);
    });

    it('should return false for user without permissions object', () => {
      const user = {
        id: '6',
        userType: 'internal'
      };

      expect(canUserManageVendors(user)).toBe(false);
    });
  });


  describe('validateOnlyOnePrimaryVendor', () => {
    it('should return true when only one primary vendor', () => {
      const vendors = [
        { id: 'v1', isPrimary: false },
        { id: 'v2', isPrimary: true },
        { id: 'v3', isPrimary: false }
      ];

      expect(validateOnlyOnePrimaryVendor(vendors)).toBe(true);
    });

    it('should return true when no primary vendors', () => {
      const vendors = [
        { id: 'v1', isPrimary: false },
        { id: 'v2', isPrimary: false }
      ];

      expect(validateOnlyOnePrimaryVendor(vendors)).toBe(true);
    });

    it('should return false when multiple primary vendors', () => {
      const vendors = [
        { id: 'v1', isPrimary: true },
        { id: 'v2', isPrimary: true }
      ];

      expect(validateOnlyOnePrimaryVendor(vendors)).toBe(false);
    });

    it('should handle empty array', () => {
      expect(validateOnlyOnePrimaryVendor([])).toBe(true);
    });

    it('should handle single vendor', () => {
      const vendors = [{ id: 'v1', isPrimary: true }];
      expect(validateOnlyOnePrimaryVendor(vendors)).toBe(true);
    });
  });

  describe('getUserViewMode', () => {
    it('should return both views for internal users with config permissions', () => {
      const user = {
        id: '1',
        userType: 'internal',
        permissions: {
          global_config: true,
          candidate_workflow: true
        }
      };

      const viewMode = getUserViewMode(user);

      expect(viewMode.availableViews).toEqual(['config', 'orders']);
      expect(viewMode.defaultView).toBe('config');
      expect(viewMode.canToggle).toBe(true);
    });

    it('should return only orders view for internal users without config permissions', () => {
      const user = {
        id: '2',
        userType: 'internal',
        permissions: {
          candidate_workflow: true
        }
      };

      const viewMode = getUserViewMode(user);

      expect(viewMode.availableViews).toEqual(['orders']);
      expect(viewMode.defaultView).toBe('orders');
      expect(viewMode.canToggle).toBe(false);
    });

    it('should return only orders view for vendor users', () => {
      const user = {
        id: '3',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: {}
      };

      const viewMode = getUserViewMode(user);

      expect(viewMode.availableViews).toEqual(['orders']);
      expect(viewMode.defaultView).toBe('orders');
      expect(viewMode.canToggle).toBe(false);
    });

    it('should return only orders view for customer users', () => {
      const user = {
        id: '4',
        userType: 'customer',
        customerId: 'customer-123',
        permissions: { candidate_workflow: true }
      };

      const viewMode = getUserViewMode(user);

      expect(viewMode.availableViews).toEqual(['orders']);
      expect(viewMode.defaultView).toBe('orders');
      expect(viewMode.canToggle).toBe(false);
    });

    it('should return no views for null user', () => {
      const viewMode = getUserViewMode(null);

      expect(viewMode.availableViews).toEqual([]);
      expect(viewMode.defaultView).toBeNull();
      expect(viewMode.canToggle).toBe(false);
    });
  });

  describe('canUserToggleViews', () => {
    it('should return true for internal users with both config and workflow permissions', () => {
      const user = {
        id: '1',
        userType: 'internal',
        permissions: {
          customer_config: true,
          candidate_workflow: true
        }
      };

      expect(canUserToggleViews(user)).toBe(true);
    });

    it('should return false for internal users with only config permissions', () => {
      const user = {
        id: '2',
        userType: 'internal',
        permissions: {
          global_config: true
        }
      };

      expect(canUserToggleViews(user)).toBe(false);
    });

    it('should return false for vendor users regardless of permissions', () => {
      const user = {
        id: '3',
        userType: 'vendor',
        vendorId: 'vendor-123',
        permissions: {
          global_config: true,
          candidate_workflow: true
        }
      };

      expect(canUserToggleViews(user)).toBe(false);
    });

    it('should return false for customer users', () => {
      const user = {
        id: '4',
        userType: 'customer',
        permissions: {
          candidate_workflow: true
        }
      };

      expect(canUserToggleViews(user)).toBe(false);
    });
  });

  describe('filterOrdersByUserAccess', () => {
    const orders = [
      { id: 'o1', customerId: 'c1', assignedVendorId: 'v1' },
      { id: 'o2', customerId: 'c2', assignedVendorId: 'v2' },
      { id: 'o3', customerId: 'c1', assignedVendorId: null },
      { id: 'o4', customerId: 'c2', assignedVendorId: 'v1' }
    ];

    it('should return all orders for internal users', () => {
      const user = {
        id: '1',
        userType: 'internal',
        permissions: { candidate_workflow: true }
      };

      const filtered = filterOrdersByUserAccess(orders, user);
      expect(filtered).toHaveLength(4);
    });

    it('should return only vendor-assigned orders for vendor users', () => {
      const user = {
        id: '2',
        userType: 'vendor',
        vendorId: 'v1',
        permissions: {}
      };

      const filtered = filterOrdersByUserAccess(orders, user);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(o => o.id)).toEqual(['o1', 'o4']);
    });

    it('should return only customer orders for customer users', () => {
      const user = {
        id: '3',
        userType: 'customer',
        customerId: 'c1',
        permissions: { candidate_workflow: true }
      };

      const filtered = filterOrdersByUserAccess(orders, user);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(o => o.id)).toEqual(['o1', 'o3']);
    });

    it('should return empty array for null user', () => {
      const filtered = filterOrdersByUserAccess(orders, null);
      expect(filtered).toHaveLength(0);
    });

    it('should return empty array for vendor user with no vendorId', () => {
      const user = {
        id: '4',
        userType: 'vendor',
        permissions: {}
      };

      const filtered = filterOrdersByUserAccess(orders, user);
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty orders array', () => {
      const user = {
        id: '5',
        userType: 'internal',
        permissions: {}
      };

      const filtered = filterOrdersByUserAccess([], user);
      expect(filtered).toHaveLength(0);
    });
  });
});