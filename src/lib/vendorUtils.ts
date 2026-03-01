// /GlobalRX_v2/src/lib/vendorUtils.ts

interface User {
  id: string;
  type: string;
  vendorId?: string;
  customerId?: string;
  permissions?: Record<string, any>;
}

interface Vendor {
  id: string;
  isPrimary: boolean;
  isActive: boolean;
}

interface Order {
  id: string;
  customerId: string;
  assignedVendorId?: string | null;
}

/**
 * Checks if a user can access orders for a specific vendor
 * Internal users can access all vendor orders
 * Vendor users can only access their own vendor's orders
 * Customer users cannot access vendor orders
 */
export function canUserAccessVendorOrders(user: User | null, vendorId: string): boolean {
  if (!user) return false;

  // Internal users can access all vendor orders
  if (user.type === 'internal') {
    return true;
  }

  // Vendor users can only access their own vendor's orders
  if (user.type === 'vendor') {
    return user.vendorId === vendorId;
  }

  // Customer users cannot access vendor orders
  return false;
}

/**
 * Checks if a user can manage vendor organizations
 *
 * Business Rule: Only internal users with administrative permissions can manage vendors.
 * This prevents customer and vendor users from creating/modifying vendor organizations.
 *
 * Vendor management includes: create, update, delete vendors and set primary status.
 * The permission check supports multiple permission formats for backward compatibility.
 */
export function canUserManageVendors(user: User | null): boolean {
  if (!user) {
    return false;
  }

  // Check if user is internal type (handle both 'type' and 'userType' field names)
  const userType = user.type || (user as any).userType;
  // If no type is set, check if they have admin-like permissions which implies internal user
  const isInternalUser = userType === 'internal' || userType === 'admin' || !userType;

  if (!isInternalUser) {
    return false;
  }

  if (!user.permissions) {
    return false;
  }

  // Check for vendor permissions in the new module-based structure
  // Also check legacy formats for backward compatibility
  const hasVendorPermissions =
    user.permissions.vendors?.create === true ||
    user.permissions.vendors?.manage === true ||
    user.permissions.vendors === '*' ||
    Array.isArray(user.permissions.vendors) && user.permissions.vendors.includes('*');

  const hasAdminPermissions =
    user.permissions.user_admin?.create === true ||
    user.permissions.user_admin?.manage === true ||
    user.permissions.user_admin === true || // Legacy format
    user.permissions.user_admin === '*' ||
    Array.isArray(user.permissions.user_admin) && user.permissions.user_admin.includes('*');

  const hasGlobalConfigPermissions =
    user.permissions.global_config?.create === true ||
    user.permissions.global_config?.manage === true ||
    user.permissions.global_config === true || // Legacy format
    user.permissions.global_config === '*' ||
    Array.isArray(user.permissions.global_config) && user.permissions.global_config.includes('*');

  // Also check for generic admin permissions
  const hasGenericAdminPermissions =
    user.permissions.admin === true ||
    user.permissions.admin === '*' ||
    Array.isArray(user.permissions.admin) && user.permissions.admin.includes('*');

  // Check for customers permissions (common in existing users)
  const hasCustomersPermissions =
    user.permissions.customers === '*' ||
    Array.isArray(user.permissions.customers) && user.permissions.customers.includes('*');

  return hasVendorPermissions || hasAdminPermissions || hasGlobalConfigPermissions ||
         hasGenericAdminPermissions || hasCustomersPermissions;
}

/**
 * Determines vendor assignment for a new order
 *
 * Business Rule: New orders are automatically assigned to the primary vendor if active.
 * If no primary vendor is configured or the primary is inactive, orders go to the
 * internal fulfillment team. This ensures orders are never left unassigned.
 *
 * Assignment Priority:
 * 1. Active primary vendor (auto-assignment)
 * 2. Internal team (fallback when no primary or primary inactive)
 */
export function getVendorAssignmentForOrder(vendors: Vendor[]): {
  vendorId: string | null;
  assignmentReason: string;
} {
  if (vendors.length === 0) {
    return {
      vendorId: null,
      assignmentReason: 'No vendors configured, assigned to internal team'
    };
  }

  // Find the first active primary vendor
  const primaryVendor = vendors.find(v => v.isPrimary && v.isActive);

  if (primaryVendor) {
    return {
      vendorId: primaryVendor.id,
      assignmentReason: 'Auto-assigned to primary vendor'
    };
  }

  // Check if primary vendor exists but is inactive
  const inactivePrimary = vendors.find(v => v.isPrimary && !v.isActive);
  if (inactivePrimary) {
    return {
      vendorId: null,
      assignmentReason: 'Primary vendor is inactive, assigned to internal team'
    };
  }

  // No primary vendor configured
  return {
    vendorId: null,
    assignmentReason: 'No primary vendor configured, assigned to internal team'
  };
}

/**
 * Validates that only one vendor is marked as primary
 */
export function validateOnlyOnePrimaryVendor(vendors: { isPrimary: boolean }[]): boolean {
  const primaryVendors = vendors.filter(v => v.isPrimary);
  return primaryVendors.length <= 1;
}

/**
 * Determines user's view mode capabilities
 */
export function getUserViewMode(user: User | null): {
  availableViews: string[];
  defaultView: string | null;
  canToggle: boolean;
} {
  if (!user) {
    return {
      availableViews: [],
      defaultView: null,
      canToggle: false
    };
  }

  // Check specific permission types
  const hasGlobalConfig = user.permissions?.global_config === true;
  const hasCustomerConfig = user.permissions?.customer_config === true;
  const hasUserAdmin = user.permissions?.user_admin === true;
  const hasWorkflowPermissions = user.permissions?.candidate_workflow === true;

  // Only internal users with proper permissions can access config view
  const hasConfigPermissions = user.type === 'internal' && (hasGlobalConfig || hasCustomerConfig || hasUserAdmin);

  const availableViews: string[] = [];

  if (hasConfigPermissions) {
    availableViews.push('config');
    // Users with config permissions can also access orders view (for admin oversight)
    availableViews.push('orders');
  } else if (hasWorkflowPermissions || user.type !== 'internal') {
    availableViews.push('orders');
  }

  // Default view priority: config for internal with permissions, orders for others
  const defaultView = hasConfigPermissions ? 'config' : (availableViews.includes('orders') ? 'orders' : null);

  // Can toggle logic:
  // - Only internal users can toggle
  // - global_config permission grants full access (can toggle without workflow permission)
  // - other config permissions require workflow permission to toggle
  const canToggle = user.type === 'internal' && (hasGlobalConfig || (hasConfigPermissions && hasWorkflowPermissions));

  return {
    availableViews,
    defaultView,
    canToggle
  };
}

/**
 * Checks if user can toggle between config and orders views
 */
export function canUserToggleViews(user: User | null): boolean {
  if (!user || user.type !== 'internal') {
    return false;
  }

  if (!user.permissions) {
    return false;
  }

  // Must have both config permission AND workflow permission to toggle
  const hasConfigPermission = user.permissions.global_config === true ||
                              user.permissions.customer_config === true ||
                              user.permissions.user_admin === true;

  const hasWorkflowPermission = user.permissions.candidate_workflow === true;

  return hasConfigPermission && hasWorkflowPermission;
}

/**
 * Filters orders based on user access permissions
 */
export function filterOrdersByUserAccess(orders: Order[], user: User | null): Order[] {
  if (!user) {
    return [];
  }

  // Internal users see all orders
  if (user.type === 'internal') {
    return orders;
  }

  // Vendor users see only orders assigned to their vendor
  if (user.type === 'vendor') {
    if (!user.vendorId) {
      return [];
    }
    return orders.filter(order => order.assignedVendorId === user.vendorId);
  }

  // Customer users see only their own orders
  if (user.type === 'customer') {
    if (!user.customerId) {
      return [];
    }
    return orders.filter(order => order.customerId === user.customerId);
  }

  return [];
}