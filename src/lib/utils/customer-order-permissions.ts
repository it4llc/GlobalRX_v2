// /GlobalRX_v2/src/lib/utils/customer-order-permissions.ts
// Customer order view-only access utility functions
//
// These functions implement the business logic for the customer order view-only feature,
// which allows customer users to see detailed order information on the same fulfillment
// page as internal users, but with appropriate data filtering and access restrictions.
//
// Key security considerations:
// - Customer users can only view orders belonging to their customer account
// - All vendor information (names, assignments, pricing) is filtered out
// - Internal notes and sensitive data is removed from responses
// - Comment counts show only external comments for customers
//
// This module separates the complex filtering logic from the API route to improve
// testability and maintain clean separation of concerns.

// Type definitions for order data structures
interface ServiceComment {
  id: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy?: string;
  createdAt: string;
  [key: string]: unknown;
}

interface ServiceFulfillment {
  id: string;
  status: string;
  assignedVendorId?: string | null;
  assignedVendor?: unknown;
  vendorNotes?: string | null;
  internalNotes?: string | null;
  assignedBy?: string | null;
  [key: string]: unknown;
}

interface StatusHistory {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: string;
  changedByName?: string;
  changedByEmail?: string;
  user?: unknown;
  createdAt: string;
  [key: string]: unknown;
}

interface OrderItem {
  id: string;
  serviceId: string;
  locationId: string;
  status: string;
  serviceFulfillment?: ServiceFulfillment;
  [key: string]: unknown;
}

interface Service {
  id: string;
  name: string;
  assignedVendor?: unknown;
  vendorNotes?: string | null;
  internalNotes?: string | null;
  vendorPrice?: number | null;
  [key: string]: unknown;
}

interface OrderData {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  statusCode?: string;
  subject?: unknown;
  assignedVendor?: unknown;
  vendorNotes?: string | null;
  internalNotes?: string | null;
  pricing?: unknown;
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  user?: unknown;
  services?: Service[];
  serviceFulfillments?: ServiceFulfillment[];
  statusHistory?: StatusHistory[];
  items?: OrderItem[];
  [key: string]: unknown;
}

/**
 * Checks if a user can view a specific order
 *
 * This function implements the core access control logic for the customer order
 * view-only feature. It ensures that customers can only access orders belonging
 * to their customer account, while maintaining existing access patterns for
 * other user types.
 *
 * Business rules implemented:
 * - Customer users: Can only view orders where user.customerId = order.customerId
 * - Internal/Admin users: Can view any order (existing behavior maintained)
 * - Vendor users: Access controlled at API level by vendor assignment
 * - Unknown user types: Denied by default (security first approach)
 *
 * @param userType - The type of user (customer, internal, admin, vendor)
 * @param userCustomerId - The customer ID of the user (for customer users)
 * @param orderCustomerId - The customer ID of the order
 * @returns true if the user can view the order, false otherwise
 */
export const canCustomerViewOrder = (
  userType: string,
  userCustomerId: string | null,
  orderCustomerId: string
): boolean => {
  // Internal and admin users can view any order (existing behavior)
  // This maintains backward compatibility for all internal operations
  if (userType === 'internal' || userType === 'admin') {
    return true;
  }

  // Vendor users have their own logic handled elsewhere
  // but shouldn't be blocked here (vendor assignment checks happen in API layer)
  if (userType === 'vendor') {
    return true;
  }

  // Customer users can only view their own orders
  // This is the core security rule for the customer view-only feature
  if (userType === 'customer') {
    // Must have a valid customerId configured in their account
    if (!userCustomerId || userCustomerId === '') {
      return false;
    }
    // Customer ID must match the order's customer ID exactly
    // This prevents customers from accessing orders of other customers
    return userCustomerId === orderCustomerId;
  }

  // Unknown user types are denied by default for security
  // This ensures that any new user types must be explicitly handled
  return false;
};

/**
 * Filters sensitive data from order details for customer users
 * @param data - The full order data object
 * @returns Order data with sensitive fields removed
 */
export const filterDataForCustomer = (data: OrderData): OrderData => {
  // Create a shallow copy to avoid mutating the original
  const filtered = { ...data };

  // Remove vendor information
  delete filtered.assignedVendor;
  delete filtered.vendorNotes;

  // Remove internal notes
  delete filtered.internalNotes;

  // Remove pricing information
  delete filtered.pricing;

  // Remove user identity information
  delete filtered.createdBy;
  delete filtered.createdByName;
  delete filtered.updatedBy;
  delete filtered.updatedByName;
  delete filtered.user;

  // Filter services if present
  if (filtered.services && Array.isArray(filtered.services)) {
    filtered.services = filtered.services.map((service: Service) => {
      const filteredService = { ...service };
      delete filteredService.assignedVendor;
      delete filteredService.vendorNotes;
      delete filteredService.internalNotes;
      delete filteredService.vendorPrice;
      return filteredService;
    });
  }

  // Filter service fulfillments if present (different structure than services)
  if (filtered.serviceFulfillments && Array.isArray(filtered.serviceFulfillments)) {
    filtered.serviceFulfillments = filtered.serviceFulfillments.map((fulfillment: ServiceFulfillment) => {
      const filteredFulfillment = { ...fulfillment };
      delete filteredFulfillment.assignedVendor;
      delete filteredFulfillment.assignedVendorId;
      delete filteredFulfillment.vendorNotes;
      delete filteredFulfillment.internalNotes;
      return filteredFulfillment;
    });
  }

  // Anonymize status history if present
  if (filtered.statusHistory && Array.isArray(filtered.statusHistory)) {
    filtered.statusHistory = filtered.statusHistory.map((history: StatusHistory) => {
      const filteredHistory = { ...history };

      // For invitation events, keep user info intact
      // For regular status changes, anonymize user info
      const eventType = filteredHistory.eventType as string | undefined;
      if (!eventType || !eventType.startsWith('invitation_')) {
        delete filteredHistory.changedBy;
        delete filteredHistory.changedByName;
        delete filteredHistory.changedByEmail;
        // Also remove user object if present
        delete filteredHistory.user;
      }

      return filteredHistory;
    });
  }

  // Filter order items if present (for nested service fulfillments)
  if (filtered.items && Array.isArray(filtered.items)) {
    filtered.items = filtered.items.map((item: OrderItem) => {
      const filteredItem = { ...item };

      // Filter service fulfillment within items
      if (filteredItem.serviceFulfillment) {
        const filteredFulfillment = { ...filteredItem.serviceFulfillment };
        delete filteredFulfillment.assignedVendorId;
        delete filteredFulfillment.vendorNotes;
        delete filteredFulfillment.internalNotes;
        delete filteredFulfillment.assignedBy;
        filteredItem.serviceFulfillment = filteredFulfillment;
      }

      return filteredItem;
    });
  }

  return filtered;
};

/**
 * Counts the number of comments visible to a specific user type
 * @param comments - Array of comment objects with isInternalOnly flag
 * @param userType - The type of user viewing the comments
 * @returns Number of comments visible to the user
 */
export const getVisibleCommentCount = (
  comments: Array<{ isInternalOnly?: boolean }>,
  userType: string
): number => {
  // Handle null or undefined comments
  if (!comments || !Array.isArray(comments)) {
    return 0;
  }

  // Internal and admin users can see all comments
  if (userType === 'internal' || userType === 'admin') {
    return comments.length;
  }

  // Customer and vendor users can only see external comments
  if (userType === 'customer' || userType === 'vendor') {
    return comments.filter(comment => {
      // For safety, treat undefined isInternalOnly as internal (true)
      // Only show comments explicitly marked as external
      return comment.isInternalOnly === false;
    }).length;
  }

  // Unknown user types see no comments
  return 0;
};