// src/__tests__/permission-utils.test.ts
import { describe, it, expect } from 'vitest';
import { hasPermission, normalizePermissions } from '@/lib/permission-utils';

describe('Permission Utilities', () => {
  describe('hasPermission', () => {
    describe('Array-based permissions', () => {
      it('should return true for wildcard permission', () => {
        const user = { permissions: { customers: ['*'] } };
        expect(hasPermission(user, 'customers', 'view')).toBe(true);
        expect(hasPermission(user, 'customers', 'edit')).toBe(true);
        expect(hasPermission(user, 'customers', 'delete')).toBe(true);
        expect(hasPermission(user, 'customers', 'create')).toBe(true);
      });

      it('should return true for specific action permission', () => {
        const user = { permissions: { customers: ['view', 'edit'] } };
        expect(hasPermission(user, 'customers', 'view')).toBe(true);
        expect(hasPermission(user, 'customers', 'edit')).toBe(true);
        expect(hasPermission(user, 'customers', 'delete')).toBe(false);
      });

      it('should return false for missing action', () => {
        const user = { permissions: { customers: ['view'] } };
        expect(hasPermission(user, 'customers', 'edit')).toBe(false);
        expect(hasPermission(user, 'customers', 'delete')).toBe(false);
      });
    });

    describe('Object-based permissions', () => {
      it('should handle boolean flags correctly', () => {
        const user = {
          permissions: {
            customers: { view: true, edit: false, delete: true }
          }
        };
        expect(hasPermission(user, 'customers', 'view')).toBe(true);
        expect(hasPermission(user, 'customers', 'edit')).toBe(false);
        expect(hasPermission(user, 'customers', 'delete')).toBe(true);
        expect(hasPermission(user, 'customers', 'create')).toBe(false);
      });

      it('should return false for undefined actions', () => {
        const user = {
          permissions: {
            customers: { view: true }
          }
        };
        expect(hasPermission(user, 'customers', 'edit')).toBe(false);
        expect(hasPermission(user, 'customers', 'nonexistent')).toBe(false);
      });
    });

    describe('Boolean permissions', () => {
      it('should handle top-level boolean permissions', () => {
        const user = { permissions: { admin: true, viewer: false } };
        expect(hasPermission(user, 'admin')).toBe(true);
        expect(hasPermission(user, 'viewer')).toBe(false);
      });

      it('should work without action parameter for boolean permissions', () => {
        const user = { permissions: { superuser: true } };
        expect(hasPermission(user, 'superuser')).toBe(true);
        // With an action, boolean permissions return true (line 22-24 in implementation)
        expect(hasPermission(user, 'superuser', 'any-action')).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should return false for null/undefined user', () => {
        expect(hasPermission(null, 'customers', 'view')).toBe(false);
        expect(hasPermission(undefined, 'customers', 'view')).toBe(false);
      });

      it('should return false for missing permissions property', () => {
        const user = { id: '123', name: 'Test User' };
        expect(hasPermission(user, 'customers', 'view')).toBe(false);
      });

      it('should return false for missing resource', () => {
        const user = { permissions: { users: ['*'] } };
        expect(hasPermission(user, 'customers', 'view')).toBe(false);
        expect(hasPermission(user, 'nonexistent', 'view')).toBe(false);
      });

      it('should handle empty arrays', () => {
        const user = { permissions: { customers: [] } };
        expect(hasPermission(user, 'customers', 'view')).toBe(false);
        // Empty arrays return false - no permissions granted
        expect(hasPermission(user, 'customers')).toBe(false);
      });

      it('should handle empty objects', () => {
        const user = { permissions: { customers: {} } };
        expect(hasPermission(user, 'customers', 'view')).toBe(false);
        expect(hasPermission(user, 'customers')).toBe(true); // Empty object is truthy
      });
    });

    describe('Mixed scenarios', () => {
      it('should handle resource-only check with array permissions', () => {
        const user = { permissions: { customers: ['view', 'edit'] } };
        // Non-empty arrays without action should return true (has some permissions)
        expect(hasPermission(user, 'customers')).toBe(true);
      });

      it('should handle resource-only check with object permissions', () => {
        const user = { permissions: { customers: { view: true } } };
        expect(hasPermission(user, 'customers')).toBe(true);
      });
    });
  });

  describe('normalizePermissions', () => {
    it('should convert wildcard array to full permission object', () => {
      const permissions = { customers: ['*'] };
      const normalized = normalizePermissions(permissions);

      expect(normalized.customers).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: true
      });
    });

    it('should convert specific array permissions to object', () => {
      const permissions = { customers: ['view', 'edit'] };
      const normalized = normalizePermissions(permissions);

      // Implementation only sets actions to true, doesn't set false for missing ones
      expect(normalized.customers).toEqual({
        view: true,
        edit: true
      });
    });

    it('should preserve object-based permissions', () => {
      const permissions = {
        customers: {
          view: true,
          edit: false,
          create: true,
          delete: false
        }
      };
      const normalized = normalizePermissions(permissions);

      expect(normalized.customers).toEqual(permissions.customers);
    });

    it('should handle boolean permissions', () => {
      const permissions = {
        admin: true,
        viewer: false
      };
      const normalized = normalizePermissions(permissions);

      // Admin gets full permissions and also grants access to all resources (lines 78-87)
      expect(normalized.admin).toEqual({
        view: true,
        create: true,
        edit: true,
        delete: true
      });
      // False boolean permissions get empty object (line 72)
      expect(normalized.viewer).toEqual({});
    });

    it('should handle mixed permission types', () => {
      const permissions = {
        customers: ['*'],
        users: { view: true, edit: false },
        admin: true,
        products: ['view', 'create']
      };
      const normalized = normalizePermissions(permissions);

      expect(normalized.customers.view).toBe(true);
      expect(normalized.customers.edit).toBe(true);
      expect(normalized.users.view).toBe(true);
      expect(normalized.users.edit).toBe(false); // Admin shouldn't override explicit false
      expect(normalized.admin.delete).toBe(true);
      expect(normalized.products.view).toBe(true);
      expect(normalized.products.create).toBe(true);
      expect(normalized.products.delete).toBeUndefined();
    });

    it('should return empty object for null/undefined permissions', () => {
      expect(normalizePermissions(null)).toEqual({});
      expect(normalizePermissions(undefined)).toEqual({});
      expect(normalizePermissions({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      const permissions = { customers: [] };
      const normalized = normalizePermissions(permissions);

      expect(normalized.customers).toEqual({});
    });
  });
});