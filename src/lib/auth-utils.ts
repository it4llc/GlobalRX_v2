// src/lib/auth-utils.ts
/**
 * Centralized authentication and permission utilities
 * Uses only the new module-based permission format
 */

import type { User } from 'next-auth';
import { hasPermission } from './permission-utils';

/**
 * Module permissions in the new format:
 * - user_admin: User management
 * - global_config: Global configurations (includes vendors)
 * - customer_config: Customer management
 * - fulfillment: Order fulfillment
 * - vendors: Vendor management (deprecated - use global_config)
 * - candidate_workflow: Candidate/order workflow
 */

export type ModulePermission =
  | 'user_admin'
  | 'global_config'
  | 'customer_config'
  | 'fulfillment'
  | 'candidate_workflow'
  | 'vendors'; // deprecated

export type UserType = 'internal' | 'vendor' | 'customer' | 'admin';

/**
 * Check if a user has a specific module permission
 * @param user - The user object from session
 * @param module - The module permission to check
 * @returns true if user has the permission
 */
export function hasModulePermission(user: User | null | undefined, module: ModulePermission): boolean {
  if (!user || !user.permissions) return false;

  // CRITICAL: Vendor users can ONLY have fulfillment permission
  // Customer users can ONLY have candidate_workflow permission
  const userType = getUserType(user);
  if (userType === 'vendor' && module !== 'fulfillment') {
    return false;
  }
  if (userType === 'customer' && module !== 'candidate_workflow') {
    return false;
  }

  const permissions = user.permissions;

  // Check if user has the specific module permission
  if (permissions[module]) {
    // Permission can be true, '*', or an array containing '*'
    if (permissions[module] === true ||
        permissions[module] === '*' ||
        (Array.isArray(permissions[module]) && permissions[module].includes('*'))) {
      return true;
    }
  }

  // Special case: global_config also grants vendor management
  if (module === 'vendors' && permissions.global_config) {
    if (permissions.global_config === true ||
        permissions.global_config === '*' ||
        (Array.isArray(permissions.global_config) && permissions.global_config.includes('*'))) {
      return true;
    }
  }

  return false;
}

/**
 * Get the user type from the user object
 * @param user - The user object from session
 * @returns The user type
 */
export function getUserType(user: User | null | undefined): UserType | null {
  if (!user) return null;

  // Check userType field (with fallback to legacy .type for test compatibility)
  // Using a type guard for the legacy 'type' property
  const legacyUser = user as User & { type?: string };
  const userType = legacyUser.type || user.userType;

  // If no userType is set, return null instead of defaulting to 'internal'
  if (!userType) return null;

  // Normalize the value - sometimes it might be uppercase or have different casing
  if (typeof userType === 'string') {
    return userType.toLowerCase() as UserType;
  }

  return userType;
}

/**
 * Check if a user is an internal/admin user
 */
export function isInternalUser(user: User | null | undefined): boolean {
  const type = getUserType(user);
  // Only return true if explicitly set to internal or admin
  // Don't assume internal if type is null
  return type === 'internal' || type === 'admin';
}

/**
 * Check if a user is a vendor user
 */
export function isVendorUser(user: User | null | undefined): boolean {
  const type = getUserType(user);
  // Also check vendorId as additional verification
  return type === 'vendor' || (!!user?.vendorId && type !== 'internal' && type !== 'admin' && type !== 'customer');
}

/**
 * Check if a user is a customer user
 */
export function isCustomerUser(user: User | null | undefined): boolean {
  const type = getUserType(user);
  return type === 'customer';
}

/**
 * Check if a user can manage vendors
 * ONLY internal users with global_config or vendors permission
 * Vendor and customer users are explicitly excluded
 */
export function canManageVendors(user: User | null | undefined): boolean {
  // Explicitly exclude vendor and customer users
  if (isVendorUser(user) || isCustomerUser(user)) return false;
  if (!isInternalUser(user)) return false;
  return hasModulePermission(user, 'global_config') || hasModulePermission(user, 'vendors');
}

/**
 * Check if a user can manage customers
 * ONLY internal users with customer_config permission
 * Vendor and customer users are explicitly excluded
 */
export function canManageCustomers(user: User | null | undefined): boolean {
  // Explicitly exclude vendor and customer users
  if (isVendorUser(user) || isCustomerUser(user)) return false;
  if (!isInternalUser(user)) return false;
  return hasModulePermission(user, 'customer_config');
}

/**
 * Check if a user can manage users
 * ONLY internal users with user_admin or global_config permission
 * Vendor and customer users are explicitly excluded
 */
export function canManageUsers(user: User | null | undefined): boolean {
  // Explicitly exclude vendor and customer users
  if (isVendorUser(user) || isCustomerUser(user)) return false;
  if (!isInternalUser(user)) return false;
  return hasModulePermission(user, 'user_admin') || hasModulePermission(user, 'global_config');
}

/**
 * Check if a user can access fulfillment
 * Internal users or vendor users with fulfillment permission
 */
export function canAccessFulfillment(user: User | null | undefined): boolean {
  const type = getUserType(user);
  if (type === 'customer') return false; // Customers can't access fulfillment
  return hasModulePermission(user, 'fulfillment');
}

/**
 * Check if user can access global configurations
 * Only internal users with global_config permission
 */
export function canAccessGlobalConfig(user: User | null | undefined): boolean {
  if (!isInternalUser(user)) return false;
  return hasModulePermission(user, 'global_config');
}

/**
 * Check if user can access Data Rx (DSX configuration)
 * ONLY internal users with global_config permission have access
 *
 * BREAKING CHANGE: Legacy 'dsx' permission is no longer supported.
 * This is an intentional breaking change to identify users who need
 * permission migration and consolidate Data Rx access under the
 * centralized global_config permission system.
 *
 * Business rationale: Data Rx configuration affects global system
 * settings and document requirements across all customers. Only users
 * with global configuration privileges should have access.
 *
 * Migration required: Users previously granted 'dsx' permission
 * must be updated to have 'global_config' permission instead.
 */
export function canAccessDataRx(user: User | null | undefined): boolean {
  if (!isInternalUser(user)) return false;

  // ONLY check for global_config permission
  // Legacy 'dsx' permission is intentionally NOT supported to force migration
  return hasModulePermission(user, 'global_config');
}

/**
 * Check if a user can manage candidate invitations
 * Customer users with candidate_workflow permission can manage their own invitations
 * Internal/admin users with customer_config permission can also manage invitations
 */
export function canManageCandidateInvitations(user: User | null | undefined): boolean {
  if (!user) return false;

  const userType = getUserType(user);

  // Customer users can manage invitations with candidate_workflow permission
  if (userType === 'customer') {
    return hasModulePermission(user, 'candidate_workflow');
  }

  // Internal/admin users can manage invitations with customer_config permission
  if (isInternalUser(user)) {
    return hasModulePermission(user, 'customer_config');
  }

  return false;
}

/**
 * Check if a user can create/send candidate invitations
 * This is a granular permission separate from managing invitations (extend/resend)
 * Internal and customer users with candidates.invite permission or admin permission can invite
 * Vendor users are explicitly excluded
 * @param user - The user object from session
 * @returns true if the user can create candidate invitations, false otherwise
 */
export function canInviteCandidates(user: User | null | undefined): boolean {
  if (!user) return false;

  const userType = getUserType(user);

  // Vendor users can never invite candidates
  if (userType === 'vendor') return false;

  // Check for admin permission first - admins can always invite
  if (hasPermission(user, 'admin')) {
    return true;
  }

  // Check for the specific candidates.invite permission
  return hasPermission(user, 'candidates', 'invite');
}