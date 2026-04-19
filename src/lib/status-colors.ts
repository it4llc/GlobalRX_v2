// /GlobalRX_v2/src/lib/status-colors.ts
/**
 * Single source of truth for order and service status colors.
 * No other file should define its own status color mappings.
 * All components should import and use these functions.
 */

/**
 * Normalizes a status string for consistent matching.
 * Converts to lowercase and replaces hyphens/spaces with underscores.
 */
function normalizeStatus(status: string): string {
  return status.toLowerCase().replace(/[-\s]/g, '_');
}

/**
 * Returns Tailwind CSS classes for background and text color based on order status.
 * @param status - The order status (case-insensitive, handles spaces/hyphens/underscores)
 * @returns String containing bg-* and text-* Tailwind classes
 */
export function getOrderStatusColorClasses(status: string): string {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'processing':
      return 'bg-green-50 text-green-600';
    case 'completed':
      return 'bg-green-200 text-green-900';
    case 'missing_information':
    case 'missing_info':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
    case 'cancelled_dnb':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Returns Tailwind CSS classes for background, text, and border color based on order status.
 * Used for components that need borders like badges and dropdowns.
 * @param status - The order status (case-insensitive, handles spaces/hyphens/underscores)
 * @returns String containing bg-*, text-*, and border-* Tailwind classes
 */
export function getOrderStatusBadgeClasses(status: string): string {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case 'draft':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'submitted':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'processing':
      return 'bg-green-50 text-green-600 border-green-300';
    case 'completed':
      return 'bg-green-200 text-green-900 border-green-500';
    case 'missing_information':
    case 'missing_info':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'cancelled':
    case 'cancelled_dnb':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}