// src/lib/permission-utils.ts

/**
 * Helper function to check if a user has a specific permission
 * Handles both array-based and object-based permission formats
 */
export function hasPermission(user: any, resource: string, action?: string): boolean {
  if (!user?.permissions) return false;
  
  // Case 1: Star permission array like {"customers": ["*"]}
  if (Array.isArray(user.permissions[resource])) {
    return user.permissions[resource].includes('*') || 
           (action && user.permissions[resource].includes(action));
  }
  
  // Case 2: Object with boolean flags like {"customers": {"view": true}}
  if (typeof user.permissions[resource] === 'object' && action) {
    return !!user.permissions[resource][action];
  }
  
  // Case 3: Boolean value like {"admin": true}
  if (typeof user.permissions[resource] === 'boolean') {
    return !!user.permissions[resource];
  }
  
  // If we have the resource but no action specified
  return !!user.permissions[resource];
}

/**
 * Normalizes permission structure to the object-based format
 * Useful for ensuring a consistent format across the application
 */
export function normalizePermissions(permissions: any): Record<string, Record<string, boolean>> {
  const normalized: Record<string, Record<string, boolean>> = {};
  
  if (!permissions) return normalized;
  
  // Process each resource
  Object.keys(permissions).forEach(resource => {
    // Case 1: Star permission array
    if (Array.isArray(permissions[resource])) {
      normalized[resource] = {};
      
      // If it has a wildcard, grant all standard permissions
      if (permissions[resource].includes('*')) {
        normalized[resource].view = true;
        normalized[resource].create = true;
        normalized[resource].edit = true;
        normalized[resource].delete = true;
      } else {
        // Otherwise, set specific actions to true
        permissions[resource].forEach(action => {
          normalized[resource][action] = true;
        });
      }
    }
    // Case 2: Already object-based
    else if (typeof permissions[resource] === 'object') {
      normalized[resource] = { ...permissions[resource] };
    }
    // Case 3: Boolean value
    else if (typeof permissions[resource] === 'boolean') {
      if (permissions[resource] === true) {
        normalized[resource] = {
          view: true,
          create: true,
          edit: true,
          delete: true
        };
      } else {
        normalized[resource] = {};
      }
    }
  });
  
  // Add admin shortcut if it exists
  if (permissions.admin === true) {
    normalized.admin = { view: true, create: true, edit: true, delete: true };
    
    // Admin has access to everything
    normalized.customers = { view: true, create: true, edit: true, delete: true };
    normalized.services = { view: true, create: true, edit: true, delete: true };
    normalized.packages = { view: true, create: true, edit: true, delete: true };
    normalized.locations = { view: true, create: true, edit: true, delete: true };
    normalized.users = { view: true, create: true, edit: true, delete: true };
  }
  
  return normalized;
}

/**
 * Use this to debug permission issues - it shows all formats of permissions
 */
export function debugPermissions(user: any, resource: string, action?: string): string {
  if (!user?.permissions) {
    return "No permissions found on user object";
  }
  
  const result = {
    userHasPermission: hasPermission(user, resource, action),
    permissionDetails: {
      resource,
      action: action || 'any',
      permissionExists: resource in user.permissions,
      permissionType: Array.isArray(user.permissions[resource]) 
        ? 'array' 
        : typeof user.permissions[resource]
    },
    adminAccess: !!user.permissions.admin,
    rawPermissions: user.permissions,
    normalizedPermissions: normalizePermissions(user.permissions)
  };
  
  return JSON.stringify(result, null, 2);
}