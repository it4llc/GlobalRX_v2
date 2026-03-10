// /GlobalRX_v2/src/components/fulfillment/OrderDetailsSidebar.tsx

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
      fromStatus: string;
      toStatus: string;
      createdAt: Date | string;
      user?: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
      notes?: string | null;
    }>;
  } | null;
  onStatusChange?: (newStatus: string) => void;
  onStatusUpdate?: (newStatus: string) => void; // Alias for compatibility
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

export function OrderDetailsSidebar({
  order,
  onStatusChange,
  onStatusUpdate,
  isLoading = false
}: OrderDetailsSidebarProps) {
  const { toastError } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Check if current user is a customer - customers get read-only view
  const isCustomer = user?.userType === 'customer';

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
          <h2 className="text-lg font-semibold">Order Information</h2>
          <div className="order-number-display mt-2 text-xl font-bold text-gray-900">{order.orderNumber}</div>
        </section>

        {/* Order Status Section */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-2">{t('common.status')}</h3>
          {isCustomer ? (
            // For customers, show status as read-only text
            <div className="text-sm font-medium text-gray-900">
              {formatStatus(order.statusCode)}
            </div>
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
          <h3 className="text-sm font-medium text-gray-500 mb-2">Customer</h3>
          <div className="space-y-1">
            <div className="font-medium">
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
            <h3 className="text-sm font-medium text-gray-500 mb-2">Created By</h3>
            <div className="text-sm">{formatUserName(order.user, 'Unknown')}</div>
          </section>
        )}

        {/* Timestamps */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Created</h3>
          <div className="text-sm">{formatTimestamp(order.createdAt)}</div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Last Updated</h3>
          <div className="text-sm">{formatTimestamp(order.updatedAt)}</div>
        </section>

        {/* Actions - only for internal users */}
        {!isCustomer && (
          <section>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handlePrint}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </button>
              <button
                onClick={handleExport}
                disabled={isLoading}
                className={`w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </section>
        )}

        {/* Quick Links */}
        <section>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Quick Links</h3>
          <div className="space-y-2">
            <Link
              href={`/customers/${order.customer.id}`}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              View Customer Details
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
            <Link
              href={`/fulfillment/orders?customerId=${order.customer.id}`}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              Order History
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </div>
        </section>

        {/* Status History */}
        <section className="status-history-section">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Status History</h3>
          {order.statusHistory && order.statusHistory.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {order.statusHistory.map((entry) => (
                <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3">
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">{formatStatus(entry.fromStatus)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium">{formatStatus(entry.toStatus)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {!isCustomer && <span>Changed by {formatUserName(entry.user, 'Unknown')}</span>}
                    <div>{formatTimestamp(entry.createdAt)}</div>
                  </div>
                  {entry.notes && (
                    <div className="text-xs text-gray-600 mt-1 italic">{entry.notes}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">--</div>
          )}
        </section>
      </div>
    </aside>
  );
}