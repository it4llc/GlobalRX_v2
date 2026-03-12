// /GlobalRX_v2/src/app/fulfillment/orders/[id]/page.tsx
// Order Fulfillment Details Page (Phase 2a) - Layout Redesign
//
// Dedicated page for viewing and managing order details in the fulfillment workflow.
// Replaces the previous modal-based approach with a full page experience.
//
// LAYOUT CHANGES (feature/order-details-layout):
// - Moved sidebar from right to left side of the page for improved information hierarchy
// - Reduced spacing between page edge and sidebar for better space utilization
// - Sidebar now contains: Order Information, Customer Details, Status, Timestamps, Actions, Quick Links, Status History
// - Main content now focuses solely on Subject Information and Services (streamlined view)
// - Removed non-functional UI elements (Edit button, Actions dropdown, manual status dropdown)
// - Enhanced mobile responsiveness with sidebar stacking below content on small screens
//
// Required permissions: fulfillment.* or admin.*

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { OrderDetailsView } from '@/components/fulfillment/OrderDetailsView';
import { OrderDetailsSidebar } from '@/components/fulfillment/OrderDetailsSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from '@/contexts/TranslationContext';
import clientLogger from '@/lib/client-logger';

// Order interface
interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  statusCode: string;
  subject: Record<string, unknown>;
  totalPrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
  };
  items?: Array<{
    id: string;
    serviceCode: string;
    locationId: string;
    price?: number;
  }>;
  assignedVendor?: {
    id: string;
    name: string;
  };
}

/**
 * Skeleton loader component for order details page loading state
 * Provides visual feedback while order data is being fetched from the API
 * Matches the layout structure of the actual content for smooth transitions
 */
function SkeletonLoader() {
  return (
    <div className="animate-pulse" data-testid="skeleton-loader">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
      <div className="space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    </div>
  );
}

/**
 * Order Details Page - Redesigned Layout Component
 *
 * This page displays comprehensive order information with a new layout design:
 * - Left sidebar: Contains order metadata, customer info, status management, actions, and history
 * - Main content: Focuses on subject information and services table
 *
 * SECURITY FEATURES:
 * - SSN masking: Only shows last 4 digits (XXX-XX-####) for security compliance
 * - Permission-based access: Customer details link requires 'customers.view' permission
 * - User-type restrictions: Hides internal information from customer and vendor users
 *
 * LAYOUT IMPROVEMENTS:
 * - Mobile-first design with responsive sidebar
 * - Improved typography hierarchy (labels vs data)
 * - Compact 3-column grid for subject information
 * - Removed non-functional UI elements that were misleading to users
 *
 * @returns JSX.Element The order details page with sidebar layout
 */
export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, checkPermission, isLoading: authLoading } = useAuth();
  const { toastError } = useToast();
  const { t } = useTranslation();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = params.id as string;

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      return;
    }

    // Check permissions - allow customers to view their own orders
    const isCustomer = user?.userType === 'customer';
    const hasFulfillmentPermission = checkPermission('fulfillment', '*') ||
                                     checkPermission('fulfillment', 'view') ||
                                     checkPermission('admin', '*');

    if (!hasFulfillmentPermission && !isCustomer) {
      setError(t('module.fulfillment.permissionDenied'));
      setLoading(false);
      return;
    }

    // Fetch order details
    fetchOrderDetails();
  }, [orderId, authLoading, checkPermission, t]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/fulfillment/orders/${orderId}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setError(t('module.fulfillment.orderNotFound'));
        } else if (response.status === 403) {
          setError(t('module.fulfillment.permissionDeniedThisOrder'));
        } else {
          setError(data.error || t('module.fulfillment.failedToLoadOrder'));
        }
        return;
      }

      setOrder(data);
    } catch (err) {
      clientLogger.error('Error fetching order', { error: err, orderId });
      setError(t('module.fulfillment.failedToLoadOrderTryAgain'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles order status changes from the sidebar dropdown
   * Updates local state optimistically for responsive UI feedback
   *
   * The actual API call is handled by OrderStatusDropdown component,
   * this callback just updates the parent state after successful API response
   *
   * @param newStatus - The new status code to set
   */
  const handleStatusChange = (newStatus: string) => {
    // Update the local order state immediately for responsive UI
    // The API call in OrderStatusDropdown has already succeeded by the time this is called
    if (order) {
      setOrder({
        ...order,
        statusCode: newStatus,
        updatedAt: new Date().toISOString(),
      });
    }

    // We don't refresh the full order details here because:
    // 1. The status change API already returns updated data
    // 2. Avoids unnecessary network requests and loading states
    // 3. The dropdown component handles API errors gracefully
  };

  // Handle loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SkeletonLoader />
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="text-red-800 font-medium">{error}</div>
            <div className="mt-4 space-x-4">
              <Link
                href={user?.userType === 'customer' ? '/portal/dashboard' : '/fulfillment/orders'}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {user?.userType === 'customer' ? 'Back to Dashboard' : 'Back to Orders'}
              </Link>
              <button
                onClick={fetchOrderDetails}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle no order state
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-gray-500">Order not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with breadcrumb */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <nav className="flex items-center space-x-2 text-sm">
              <Link
                href={user?.userType === 'customer' ? '/portal/dashboard' : '/fulfillment/orders'}
                className="flex items-center text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {user?.userType === 'customer' ? 'Back to Dashboard' : 'Back to Fulfillment'}
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 font-medium">{order.orderNumber}</span>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="px-4 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6 max-w-screen-2xl">
          {/* Sidebar - stacks below on mobile, appears on left on desktop */}
          <div className="lg:w-80 lg:flex-shrink-0">
            <OrderDetailsSidebar
              order={order}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Main content - single column */}
          <div className="flex-1 max-w-6xl">
            <OrderDetailsView order={order} />
          </div>
        </div>
      </div>
    </div>
  );
}