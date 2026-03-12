// /GlobalRX_v2/src/lib/utils/service-results-utils.ts

/**
 * Utility functions for Service Results Block feature
 */

/**
 * Check if a service is in a terminal status (cannot be edited)
 */
export function isTerminalStatus(status: string): boolean {
  const terminalStatuses = ['completed', 'cancelled'];
  return terminalStatuses.includes(status.toLowerCase());
}

/**
 * Check if a user can edit service results
 */
export function canEditResults(
  user: { permissions?: any; vendorId?: string } | null,
  service: { assignedVendorId?: string | null; status?: string }
): boolean {
  if (!user) return false;

  // Check terminal status
  if (service.status && isTerminalStatus(service.status)) {
    return false;
  }

  // Check fulfillment.edit permission
  if (user.permissions?.fulfillment?.edit === true) {
    return true;
  }

  // Check vendor assignment
  if (user.vendorId && service.assignedVendorId === user.vendorId) {
    return true;
  }

  return false;
}

/**
 * Check if a user can view service results
 */
export function canViewResults(
  user: { permissions?: any; vendorId?: string; customerId?: string } | null,
  service: { assignedVendorId?: string | null },
  order: { customerId?: string }
): boolean {
  if (!user) return false;

  // Check fulfillment.view permission
  if (user.permissions?.fulfillment?.view === true) {
    return true;
  }

  // Check vendor assignment
  if (user.vendorId && service.assignedVendorId === user.vendorId) {
    return true;
  }

  // Check customer ownership
  if (user.customerId && order.customerId === user.customerId) {
    return true;
  }

  return false;
}

/**
 * Generate a unique filename for attachments
 */
export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitized = sanitizeFileName(originalName);
  const parts = sanitized.split('.');
  const ext = parts.pop();
  const base = parts.join('.');
  return `${timestamp}_${random}_${base}.${ext}`;
}

/**
 * Sanitize a filename to remove invalid characters
 */
export function sanitizeFileName(fileName: string): string {
  // Replace special characters with underscores, preserve dots, dashes, and alphanumeric
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: { name?: string; size?: number; type?: string }): { valid: boolean; error?: string } {
  if (!file.name || !file.size || !file.type) {
    return { valid: false, error: 'Invalid file' };
  }

  // Check file extension
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  // Check MIME type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Invalid file type' };
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 5MB' };
  }

  return { valid: true };
}

/**
 * Build file storage path
 */
export function buildStoragePath(orderId: string, serviceId: string, fileName: string): string {
  return `uploads/service-results/${orderId}/${serviceId}/${fileName}`;
}