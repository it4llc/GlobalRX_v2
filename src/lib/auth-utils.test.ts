// /GlobalRX_v2/src/lib/auth-utils.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canInviteCandidates } from './auth-utils';
import { hasPermission } from './permission-utils';

// Mock dependencies
vi.mock('./permission-utils', () => ({
  hasPermission: vi.fn()
}));

describe('canInviteCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/undefined handling', () => {
    it('should return false when user is null', () => {
      const result = canInviteCandidates(null);
      expect(result).toBe(false);
    });

    it('should return false when user is undefined', () => {
      const result = canInviteCandidates(undefined);
      expect(result).toBe(false);
    });
  });

  describe('vendor user handling', () => {
    it('should return false for vendor users even with permission', () => {
      const vendorUser = {
        id: 'vendor-1',
        email: 'vendor@example.com',
        userType: 'vendor',
        vendorId: 'vendor-org-1',
        permissions: {
          candidates: { invite: true }
        }
      };

      // Even if hasPermission would return true, vendor users are blocked
      vi.mocked(hasPermission).mockReturnValue(true);

      const result = canInviteCandidates(vendorUser as any);
      expect(result).toBe(false);

      // Should not even check permissions for vendor users
      expect(hasPermission).not.toHaveBeenCalled();
    });

    it('should return false for vendor users without permission', () => {
      const vendorUser = {
        id: 'vendor-1',
        email: 'vendor@example.com',
        userType: 'vendor',
        vendorId: 'vendor-org-1',
        permissions: {}
      };

      const result = canInviteCandidates(vendorUser as any);
      expect(result).toBe(false);
      expect(hasPermission).not.toHaveBeenCalled();
    });
  });

  describe('admin user handling', () => {
    it('should return true for admin users with admin permission', () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        userType: 'admin',
        permissions: {
          admin: true
        }
      };

      // First call checks admin permission, returns true
      vi.mocked(hasPermission).mockImplementation((user, resource) => {
        if (resource === 'admin') return true;
        return false;
      });

      const result = canInviteCandidates(adminUser as any);
      expect(result).toBe(true);

      // Should check for admin permission
      expect(hasPermission).toHaveBeenCalledWith(adminUser, 'admin');
      // Should not check candidates.invite since admin returned true
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });

    it('should check candidates.invite for admin users without admin permission', () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        userType: 'admin',
        permissions: {
          candidates: { invite: true }
        }
      };

      // Mock: no admin permission, but has candidates.invite
      vi.mocked(hasPermission).mockImplementation((user, resource, action) => {
        if (resource === 'admin') return false;
        if (resource === 'candidates' && action === 'invite') return true;
        return false;
      });

      const result = canInviteCandidates(adminUser as any);
      expect(result).toBe(true);

      expect(hasPermission).toHaveBeenCalledWith(adminUser, 'admin');
      expect(hasPermission).toHaveBeenCalledWith(adminUser, 'candidates', 'invite');
    });
  });

  describe('internal user handling', () => {
    it('should return true for internal users with candidates.invite permission', () => {
      const internalUser = {
        id: 'internal-1',
        email: 'internal@example.com',
        userType: 'internal',
        permissions: {
          candidates: { invite: true }
        }
      };

      vi.mocked(hasPermission).mockImplementation((user, resource, action) => {
        if (resource === 'admin') return false;
        if (resource === 'candidates' && action === 'invite') return true;
        return false;
      });

      const result = canInviteCandidates(internalUser as any);
      expect(result).toBe(true);

      expect(hasPermission).toHaveBeenCalledWith(internalUser, 'admin');
      expect(hasPermission).toHaveBeenCalledWith(internalUser, 'candidates', 'invite');
    });

    it('should return false for internal users without candidates.invite permission', () => {
      const internalUser = {
        id: 'internal-1',
        email: 'internal@example.com',
        userType: 'internal',
        permissions: {
          user_admin: true,
          customer_config: true
        }
      };

      vi.mocked(hasPermission).mockReturnValue(false);

      const result = canInviteCandidates(internalUser as any);
      expect(result).toBe(false);

      expect(hasPermission).toHaveBeenCalledWith(internalUser, 'admin');
      expect(hasPermission).toHaveBeenCalledWith(internalUser, 'candidates', 'invite');
    });

    it('should return true for internal users with admin permission even without explicit candidates.invite', () => {
      const internalUser = {
        id: 'internal-1',
        email: 'internal@example.com',
        userType: 'internal',
        permissions: {
          admin: true
        }
      };

      vi.mocked(hasPermission).mockImplementation((user, resource) => {
        if (resource === 'admin') return true;
        return false;
      });

      const result = canInviteCandidates(internalUser as any);
      expect(result).toBe(true);

      // Should only check admin, not candidates.invite
      expect(hasPermission).toHaveBeenCalledWith(internalUser, 'admin');
      expect(hasPermission).toHaveBeenCalledTimes(1);
    });
  });

  describe('customer user handling', () => {
    it('should return true for customer users with candidates.invite permission', () => {
      const customerUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        userType: 'customer',
        customerId: 'customer-org-1',
        permissions: {
          candidates: { invite: true }
        }
      };

      vi.mocked(hasPermission).mockImplementation((user, resource, action) => {
        if (resource === 'admin') return false;
        if (resource === 'candidates' && action === 'invite') return true;
        return false;
      });

      const result = canInviteCandidates(customerUser as any);
      expect(result).toBe(true);

      expect(hasPermission).toHaveBeenCalledWith(customerUser, 'admin');
      expect(hasPermission).toHaveBeenCalledWith(customerUser, 'candidates', 'invite');
    });

    it('should return false for customer users without candidates.invite permission', () => {
      const customerUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        userType: 'customer',
        customerId: 'customer-org-1',
        permissions: {
          orders: { view: true, create: true }
        }
      };

      vi.mocked(hasPermission).mockReturnValue(false);

      const result = canInviteCandidates(customerUser as any);
      expect(result).toBe(false);

      expect(hasPermission).toHaveBeenCalledWith(customerUser, 'admin');
      expect(hasPermission).toHaveBeenCalledWith(customerUser, 'candidates', 'invite');
    });

    it('should return false for customer users with malformed permissions', () => {
      const customerUser = {
        id: 'customer-1',
        email: 'customer@example.com',
        userType: 'customer',
        customerId: 'customer-org-1',
        permissions: null
      };

      vi.mocked(hasPermission).mockReturnValue(false);

      const result = canInviteCandidates(customerUser as any);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle user with no userType field', () => {
      const userWithoutType = {
        id: 'user-1',
        email: 'user@example.com',
        permissions: {
          candidates: { invite: true }
        }
      };

      vi.mocked(hasPermission).mockImplementation((user, resource, action) => {
        if (resource === 'admin') return false;
        if (resource === 'candidates' && action === 'invite') return true;
        return false;
      });

      const result = canInviteCandidates(userWithoutType as any);
      expect(result).toBe(true);
    });

    it('should handle user with empty permissions object', () => {
      const userWithEmptyPermissions = {
        id: 'user-1',
        email: 'user@example.com',
        userType: 'internal',
        permissions: {}
      };

      vi.mocked(hasPermission).mockReturnValue(false);

      const result = canInviteCandidates(userWithEmptyPermissions as any);
      expect(result).toBe(false);
    });

    it('should handle user with candidates permission set to false explicitly', () => {
      const userWithExplicitFalse = {
        id: 'user-1',
        email: 'user@example.com',
        userType: 'customer',
        customerId: 'customer-1',
        permissions: {
          candidates: { invite: false }
        }
      };

      vi.mocked(hasPermission).mockReturnValue(false);

      const result = canInviteCandidates(userWithExplicitFalse as any);
      expect(result).toBe(false);
    });
  });
});