// /GlobalRx_v2/src/lib/status-utils.ts

/**
 * Status Utility Functions
 *
 * Centralized module for handling service status formatting across the application.
 * This ensures consistent status display regardless of how the status is stored in the database.
 *
 * Background: The database stores status values in different formats (lowercase, with underscores, etc.)
 * but the UI needs to display them in a consistent, user-friendly format.
 */

/**
 * Formats a raw status value from the database into a display-friendly format.
 *
 * Examples:
 * - "draft" → "Draft"
 * - "pending" → "Pending"
 * - "in_progress" → "In Progress"
 * - "pending_review" → "Pending Review"
 * - "missing_info" → "Missing Info"
 * - "cancelled_dnb" → "Cancelled DNB"
 *
 * @param status - The raw status value from the database
 * @returns The formatted status string for display
 */
export function formatServiceStatus(status: string | null | undefined): string {
  if (!status) return '';

  // Special cases for acronyms and specific formatting
  const specialCases: Record<string, string> = {
    'cancelled_dnb': 'Cancelled-DNB',
    'cancelled-dnb': 'Cancelled-DNB',
    'missing_info': 'Missing Information',
    'missing_information': 'Missing Information',
  };

  // Check for special cases first
  const lowerStatus = status.toLowerCase();
  if (specialCases[lowerStatus]) {
    return specialCases[lowerStatus];
  }

  // Standard formatting: split by underscore, hyphen, or space, capitalize each word
  return status
    .split(/[_\-\s]+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalizes a status value to a consistent database format.
 * This is useful when comparing statuses or storing them.
 *
 * @param {string | null | undefined} status - The status value to normalize
 * @returns {string} The normalized status string (lowercase with underscores)
 */
export function normalizeServiceStatus(status: string | null | undefined): string {
  if (!status) return '';

  // Convert to lowercase, trim, and replace spaces/hyphens with underscores
  return status
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/**
 * Checks if two status values are equivalent, regardless of formatting.
 *
 * @param {string | null | undefined} status1 - First status value
 * @param {string | null | undefined} status2 - Second status value
 * @returns {boolean} True if the statuses are equivalent
 */
export function areStatusesEqual(status1: string | null | undefined, status2: string | null | undefined): boolean {
  return normalizeServiceStatus(status1) === normalizeServiceStatus(status2);
}

/**
 * Gets the display color class for a status value.
 * This maintains consistency with existing status color schemes.
 *
 * @param {string | null | undefined} status - The status value
 * @returns {string} The CSS class string for the status color (Tailwind classes)
 */
export function getServiceStatusColor(status: string | null | undefined): string {
  const normalized = normalizeServiceStatus(status);

  const statusColors: Record<string, string> = {
    'draft': 'bg-gray-100 text-gray-800',
    'pending': 'bg-blue-100 text-blue-800',
    'submitted': 'bg-blue-100 text-blue-800',
    'processing': 'bg-blue-100 text-blue-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'pending_review': 'bg-yellow-100 text-yellow-800',
    'missing_info': 'bg-orange-100 text-orange-800',
    'missing_information': 'bg-orange-100 text-orange-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
    'cancelled_dnb': 'bg-red-100 text-red-800',
  };

  return statusColors[normalized] || 'bg-gray-100 text-gray-800';
}