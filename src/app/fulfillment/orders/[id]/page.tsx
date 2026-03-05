// /GlobalRX_v2/src/app/fulfillment/orders/[id]/page.tsx
// Order Fulfillment Details Page (Phase 2a)
//
// Dedicated page for viewing and managing order details in the fulfillment workflow.
// Replaces the previous modal-based approach with a full page experience.
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

// Skeleton loader component
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

    // Check permissions
    if (!checkPermission('fulfillment', '*') &&
        !checkPermission('fulfillment', 'view') &&
        !checkPermission('admin', '*')) {
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
                href="/fulfillment/orders"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Back to Orders
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
                href="/fulfillment/orders"
                className="flex items-center text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Fulfillment
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 font-medium">{order.orderNumber}</span>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content - single column */}
          <div className="flex-1">
            <OrderDetailsView order={order} />
          </div>

          {/* Sidebar - stacks below on mobile */}
          <div className="lg:w-80">
            <OrderDetailsSidebar
              order={order}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}