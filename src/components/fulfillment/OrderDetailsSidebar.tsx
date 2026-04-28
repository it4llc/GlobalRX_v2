// /GlobalRX_v2/src/components/fulfillment/OrderDetailsSidebar.tsx
// Left sidebar component for order details page - Layout Redesign
//
// LAYOUT CHANGES (feature/order-details-layout):
// - Moved from right side to left side of page for improved information hierarchy
// - Consolidated all order metadata, customer info, and status management in one place
// - Added permission-based Quick Links section for customer details access
// - Improved typography consistency with text-xs font-semibold labels and text-base data
// - Enhanced user-type restrictions (customers see read-only view, vendors have limited access)
// - Status History section moved from main content to sidebar for better organization
// - Translation keys added for better internationalization support
//
// SECURITY IMPROVEMENTS:
// - Permission checks for customer details link (requires 'customers.view' permission)
// - User-type restrictions: Hides Quick Links from customers and vendors
// - Safe status change handling with proper permission validation

'use client';

import React from 'react';
import Link from 'next/link';
import { Printer, Download, ExternalLink } from 'lucide-react';
import { OrderStatusDropdown } from './OrderStatusDropdown';
import { format } from 'date-fns';
import clientLogger from '@/lib/client-logger';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { getOrderStatusColorClasses } from '@/lib/status-colors';
import { InvitationStatusSection } from '@/components/portal/order-details/InvitationStatusSection';
import { InvitationStatusDisplay } from '@/types/invitation-management';

interface OrderDetailsSidebarProps {
  order?: {
    id: string;
    orderNumber: string;
    statusCode: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    customer: {
      id: string;
      name: string;
      code?: string;
    };
    user?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    statusHistory?: Array<{
      id: string;
      fromStatus?: string;
      toStatus?: string;
      eventType?: string;
      message?: string;
      createdAt: Date | string;
      user?: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
      notes?: string | null;
    }>;
    candidateInvitations?: InvitationStatusDisplay[];
  } | null;
  onStatusChange?: (newStatus: string) => void;
  onStatusUpdate?: (newStatus: string) => void; // Alias for compatibility
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Format status for display
const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format timestamp
const formatTimestamp = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // Use uppercase 'a' for AM/PM to match date-fns format
    return format(dateObj, 'MM/dd/yyyy hh:mm a');
  } catch (error) {
    return '--';
  }
};

// Format user name
const formatUserName = (user?: { firstName?: string; lastName?: string; email: string }, unknownText?: string): string => {
  if (!user) return unknownText || 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) return user.firstName;
  if (user.lastName) return user.lastName;
  return user.email;
};

/**
 * Order Details Sidebar Component - Redesigned Layout
 *
 * Left sidebar containing comprehensive order metadata and actions.
 * Consolidated from the previous scattered layout to improve information architecture.
 *
 * SECTIONS INCLUDED:
 * - Order Information: Order number and basic details
 * - Status Management: Read-only for customers, dropdown for internal users
 * - Customer Information: Customer name and code
 * - Timestamps: Created and last updated dates
 * - Actions: Print and export functionality (internal users only)
 * - Quick Links: Customer details access (permission-based)
 * - Status History: Complete audit trail of status changes
 *
 * SECURITY FEATURES:
 * - Permission checks for customer details access (requires 'customers.view')
 * - User-type restrictions: Customers see read-only view, vendors have limited access
 * - Safe export functionality with error handling
 *
 * ACCESSIBILITY:
 * - Proper ARIA labels and semantic HTML structure
 * - Keyboard navigation support for interactive elements
 * - Screen reader friendly content organization
 *
 * @param order - Order data object
 * @param onStatusChange - Callback for status change events
 * @param onStatusUpdate - Alternative callback for backward compatibility
 * @param isLoading - Loading state indicator
 * @returns JSX.Element The sidebar component with order metadata and actions
 */
export function OrderDetailsSidebar({
  order,
  onStatusChange,
  onStatusUpdate,
  onRefresh,
  isLoading = false
}: OrderDetailsSidebarProps) {
  const { toastError } = useToast();
  const { t } = useTranslation();
  const { user, canManageCustomers, checkPermission } = useAuth();

  // Check if current user is a customer - customers get read-only view
  const isCustomer = user?.userType === 'customer';
  const isVendor = user?.userType === 'vendor';

  // Check if user has permission to view customer configurations
  const canViewCustomerConfigs = canManageCustomers();

  // Use either callback prop
  const handleStatusChange = onStatusChange || onStatusUpdate;

  // Show loading skeleton
  if (!order || isLoading) {
    return (
      <aside className="order-details-sidebar" role="complementary">
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse" data-testid="skeleton-loader">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  const handlePrint = () => {
    if (isLoading) return;
    window.print();
  };

  /**
   * Handles order data export functionality
   * Creates a JSON file with basic order information for download
   *
   * Security consideration: Only exports non-sensitive order metadata,
   * excludes personal subject information and internal notes
   */
  const handleExport = async () => {
    try {
      // Create a blob with order data
      const orderData = {
        orderNumber: order.orderNumber,
        status: order.statusCode,
        customer: order.customer.name,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Add more fields as needed
      };

      const blob = new Blob([JSON.stringify(orderData, null, 2)], {
        type: 'application/json',
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `order-${order.orderNumber}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      clientLogger.error('Export failed', { error, orderId: order.id });
      toastError(t('module.fulfillment.failedToExport'));
    }
  };

  return (
    <aside className="order-details-sidebar mobile-layout" role="complementary">
      <div className="space-y-6">
        {/* Order Header */}
        <section>
          <h2 className="text-lg font-semibold">{t('module.fulfillment.orderInformation')}</h2>
          <div className="order-number-display mt-2 text-xl font-bold text-gray-900">{order.orderNumber}</div>
        </section>

        {/* Order Status Section */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('common.status')}:</h3>
          {isCustomer ? (
            // For customers, show status as read-only text with color coding
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOrderStatusColorClasses(order.statusCode)}`}>
              {formatStatus(order.statusCode)}
            </span>
          ) : (
            // For internal users, show status dropdown
            <OrderStatusDropdown
              orderId={order.id}
              currentStatus={order.statusCode}
              onStatusChange={handleStatusChange}
              disabled={isLoading}
            />
          )}
        </section>

        {/* Customer Information */}
        <section className="customer-info" data-testid="customer-info">
          <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.customer')}:</h3>
          <div className="space-y-1">
            <div className="text-base text-black">
              {order.customer.name}
              {order.customer.code && (
                <span className="ml-1 text-gray-600">({order.customer.code})</span>
              )}
            </div>
          </div>
        </section>

        {/* Created By - only for internal users */}
        {order.user && !isCustomer && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.createdBy')}:</h3>
            <div className="text-base text-black">{formatUserName(order.user, 'Unknown')}</div>
          </section>
        )}

        {/* Timestamps */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.created')}:</h3>
          <div className="text-base text-black">{formatTimestamp(order.createdAt)}</div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.lastUpdated')}:</h3>
          <div className="text-base text-black">{formatTimestamp(order.updatedAt)}</div>
        </section>

        {/* Actions - only for internal users */}
        {!isCustomer && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.actions')}:</h3>
            <div className="space-y-2">
              <button
                onClick={handlePrint}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <Printer className="w-4 h-4 mr-2" />
                {t('common.print')}
              </button>
              <button
                onClick={handleExport}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <Download className="w-4 h-4 mr-2" />
                {t('common.export')}
              </button>
            </div>
          </section>
        )}

        {/* Quick Links - only for users with customer configuration permissions */}
        {!isCustomer && !isVendor && canViewCustomerConfigs && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 mb-2">{t('module.fulfillment.quickLinks')}:</h3>
            <div className="space-y-2">
              <Link
                href={`/customer-configs/${order.customer.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                {t('module.fulfillment.viewCustomerDetails')}
                <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </div>
          </section>
        )}

        {/* Invitation Status Section */}
        {order.candidateInvitations && order.candidateInvitations.length > 0 && (
          <InvitationStatusSection
            invitation={order.candidateInvitations[0]}
            canManageInvitations={!isCustomer || checkPermission('candidates', 'invite')}
            onActionSuccess={() => {
              // Refresh order data after successful action
              onRefresh?.();
            }}
          />
        )}

        {/* Status History */}
        <section className="status-history-section">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Status History</h3>
          {order.statusHistory && order.statusHistory.length > 0 ? (
            <div className="relative">
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {order.statusHistory.map((entry) => (
                <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3">
                  <div className="flex items-center space-x-1">
                    {entry.eventType ? (
                      <>
                        <span className="font-medium">{t(`invitation.event.${entry.eventType.replace('invitation_', '')}`)}</span>
                        {entry.message && <span className="text-gray-600 ml-1">- {entry.message}</span>}
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{formatStatus(entry.fromStatus || '')}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{formatStatus(entry.toStatus || '')}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(!isCustomer || entry.eventType?.startsWith('invitation_')) && <span>{entry.eventType ? 'By' : 'Changed by'} {formatUserName(entry.user, 'Unknown')}</span>}
                    <div>{formatTimestamp(entry.createdAt)}</div>
                  </div>
                  {entry.notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">{entry.notes}</div>
                  )}
                </div>
              ))}
              </div>
              {/* Visual indicator for scrollable content */}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">--</div>
          )}
        </section>
      </div>
    </aside>
  );
}