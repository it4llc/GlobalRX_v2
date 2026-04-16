// src/components/fulfillment/OrderDetailsView.tsx
// Main content component for displaying order information in fulfillment workflow.
//
// LAYOUT REDESIGN CHANGES (feature/order-details-layout):
// - Removed Order Information, Customer Details, Notes, and Status History sections
// - These sections moved to left sidebar for better information architecture
// - Main content now focuses only on Subject Information and Services
// - Subject Information redesigned with compact 3-column grid layout
// - Typography improvements: labels use text-xs font-semibold with colons, data uses text-base text-black
// - SSN field now masked for security (shows XXX-XX-#### format)
// - Removed non-functional UI elements (Edit button, Actions dropdown, manual status dropdown)
// - Enhanced mobile responsiveness
//
// Key design decisions:
// - Empty values display as "--" for consistency
// - Status badges use color coding for quick visual scanning
// - Single column layout optimized for detailed viewing
// - Section-based organization for easy navigation

'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { ChevronLeft, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { ServiceFulfillmentTable } from './ServiceFulfillmentTable';
import { hasNewActivity } from '@/lib/utils/activity-comparison';
import type { HydratedOrderDataRecord } from '@/types/order-data-hydration';

interface OrderDetailsViewProps {
  order?: {
    id: string;
    orderNumber: string;
    statusCode: string;
    notes?: string | null;
    subject?: Record<string, unknown>;
    customer: {
      id: string;
      name: string;
      code?: string;
    };
    items?: Array<{
      id: string;
      status: string;
      lastActivityAt?: string | null;
      orderItemViews?: Array<{ lastViewedAt: string }>;
      service?: {
        id: string;
        name: string;
        code?: string;
        category?: string | null;
      };
      location?: {
        id: string;
        name: string;
        code2?: string | null;
      };
      data?: Array<{
        id: string;
        fieldName: string;
        fieldValue: string;
        fieldType?: string | null;
      }>;
      serviceFulfillment?: {
        id: string;
        status: string;
        assignedVendorId: string | null;
        vendorNotes: string | null;
        internalNotes: string | null;
        assignedAt: string | null;
        assignedBy: string | null;
        completedAt: string | null;
      };
    }>;
    /** Display-ready OrderData keyed by orderItemId — from Phase 1 hydration */
    hydratedOrderData?: Record<string, HydratedOrderDataRecord[]>;
    statusHistory?: Array<{
      id: string;
      status?: string;
      fromStatus?: string;
      toStatus?: string;
      changedAt?: string | Date;
      createdAt?: string | Date;
      notes?: string;
      user?: {
        firstName?: string;
        lastName?: string;
        email: string;
      };
    }>;
    assignedVendor?: {
      id: string;
      name: string;
    };
    vendorNotes?: string;
    internalNotes?: string;
    user?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    createdAt: Date | string;
    updatedAt: Date | string;
  };
  error?: string | null;
  loading?: boolean;
  onRetry?: () => void;
}

// Format empty values with consistent "--" placeholder
// This ensures a uniform appearance across all order data fields
// and prevents UI layout issues from undefined/null values
const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return format(value, 'MM/dd/yyyy');
  }
  // Handle ISO date strings from API responses
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return format(new Date(value), 'MM/dd/yyyy');
    } catch {
      return value; // Fall back to raw string if parsing fails
    }
  }
  return String(value);
};

// Format status
const formatStatus = (status: string): string => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Get status color class
const getStatusColorClass = (status: string): string => {
  const statusColors: Record<string, string> = {
    pending: 'text-yellow-600 bg-yellow-50',
    processing: 'text-blue-600 bg-blue-50',
    completed: 'text-green-600 bg-green-50',
    cancelled: 'text-red-600 bg-red-50',
    on_hold: 'text-gray-600 bg-gray-50',
    failed: 'text-pink-600 bg-pink-50',
  };
  return statusColors[status] || 'text-gray-600 bg-gray-50';
};

// Format user name for display
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
 * Order Details View Component - Streamlined Main Content
 *
 * Displays the main content area of the order details page, focusing on:
 * - Subject Information (personal details with security masking)
 * - Services table (with fulfillment status and actions)
 *
 * SECURITY FEATURES:
 * - SSN masking: Displays only last 4 digits in XXX-XX-#### format
 * - Permission-based rendering: Hides sensitive data from customers/vendors
 * - Safe error handling with retry capability
 *
 * LAYOUT IMPROVEMENTS:
 * - Compact 3-column grid for subject information
 * - Improved typography distinction between labels and data
 * - Consistent "--" placeholder for empty values
 * - Mobile-responsive design with grid column adjustments
 *
 * @param order - Order data object with subject and services information
 * @param error - Error message to display if data loading failed
 * @param loading - Loading state indicator
 * @param onRetry - Callback function to retry failed data loading
 * @returns JSX.Element The main content view for order details
 */
export function OrderDetailsView({ order, error, loading, onRetry }: OrderDetailsViewProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();

  // Check if current user is a customer - customers get read-only view
  const isCustomer = user?.userType === 'customer';
  const readOnly = isCustomer;

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const handleBack = () => {
    // Customers always go back to dashboard, others use browser back
    if (user?.userType === 'customer') {
      router.push('/portal/dashboard');
    } else {
      router.back();
    }
  };

  // Handle error states
  if (error) {
    return (
      <main className="order-details-view" role="main">
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div className="text-red-800 font-medium">{error}</div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Handle loading state
  if (loading || !order) {
    return (
      <main className="order-details-view" role="main">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </main>
    );
  }

  // Extract subject fields
  const subject = order.subject || {};

  return (
    <main className="order-details-view" role="main">
      <div className="space-y-6">
        {/* Back Navigation and Header */}
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {user?.userType === 'customer' ? t('common.backToDashboard') : t('common.back')}
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            </div>

          </div>
        </div>


        {/* Subject Information Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-3">{t('module.fulfillment.subjectInformation')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.firstName')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.firstName)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.lastName')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.lastName)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.middleName')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.middleName)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.dateOfBirth')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.email')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.email)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.phone')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.phone)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.ssn')}:</dt>
                <dd className="mt-0.5 text-base text-black">
                  {subject.ssn ? `XXX-XX-${String(subject.ssn).slice(-4)}` : '--'}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.address')}:</dt>
                <dd className="mt-0.5 text-base text-black">{formatValue(subject.address)}</dd>
              </div>
              {subject.city !== undefined && subject.city !== null && subject.city !== '' && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.city')}:</dt>
                  <dd className="mt-0.5 text-base text-black">{formatValue(subject.city)}</dd>
                </div>
              )}
              {subject.state !== undefined && subject.state !== null && subject.state !== '' && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.state')}:</dt>
                  <dd className="mt-0.5 text-base text-black">{formatValue(subject.state)}</dd>
                </div>
              )}
              {subject.zipCode !== undefined && subject.zipCode !== null && subject.zipCode !== '' && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500">{t('module.fulfillment.zipCode')}:</dt>
                  <dd className="mt-0.5 text-base text-black">{formatValue(subject.zipCode)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>


        {/* Services Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.services')}</h2>
          <div className="bg-white rounded-lg border p-4">
            {order.items && order.items.length > 0 ? (
              <ServiceFulfillmentTable
                orderId={order.id}
                services={order.items
                  .filter(item => item.id) // Ensure item has a valid ID
                  .map((item) => {
                    // Convert data array to orderData object (legacy format — kept for backward compatibility)
                    // The data field contains field-value pairs that represent service-specific requirements
                    const orderData = item.data?.reduce((acc, dataItem) => {
                      if (dataItem.fieldName && dataItem.fieldValue) {
                        acc[dataItem.fieldName] = dataItem.fieldValue;
                      }
                      return acc;
                    }, {} as Record<string, string>) || null;

                    return {
                      // ID MAPPING FIX (March 19, 2026): Use ServiceFulfillment ID when it exists, OrderItem ID as fallback
                      // Comments are indexed by ServiceFulfillment ID when it exists
                      // ServiceFulfillmentTable needs the correct ID for comment lookups
                      // This fixes the comment display bug where IDs didn't match between UI and API
                      id: item.serviceFulfillment?.id || item.id,
                      orderId: order.id,
                      orderItemId: item.id,
                      // PHASE 2D FIX: Only compute hasNewActivity for customer users
                      // Non-customer users don't have OrderItemView records (excluded server-side)
                      // Without views, hasNewActivity always returns true, causing red dots for all users
                      hasNewActivity: user?.userType === 'customer'
                        ? hasNewActivity(
                            item.lastActivityAt,
                            item.orderItemViews?.[0]?.lastViewedAt
                          )
                        : false,
                      serviceId: item.service?.id || '',
                      locationId: item.location?.id || '',
                      // BUG FIX (March 19, 2026): serviceFulfillment.status field no longer exists (removed in fulfillment ID standardization)
                      // Use item.status directly as the single source of truth for service status
                      status: item.status || 'pending',
                      assignedVendorId: item.serviceFulfillment?.assignedVendorId || null,
                      vendorNotes: item.serviceFulfillment?.vendorNotes || null,
                      internalNotes: item.serviceFulfillment?.internalNotes || null,
                      assignedAt: item.serviceFulfillment?.assignedAt || null,
                      assignedBy: item.serviceFulfillment?.assignedBy || null,
                      completedAt: item.serviceFulfillment?.completedAt || null,
                      createdAt: order.createdAt.toString(),
                      updatedAt: order.updatedAt.toString(),
                      orderData,  // Legacy format — kept for backward compatibility
                      // Hydrated display-ready records for this item (Phase 1)
                      hydratedOrderData: order.hydratedOrderData?.[item.id] || null,
                      service: item.service ? {
                        id: item.service.id,
                        name: item.service.name,
                        code: item.service.code,
                        category: item.service.category || null
                      } : {
                        id: `service-${item.id}`,
                        name: 'Unknown Service',
                        code: undefined,
                        category: null
                      },
                      location: item.location ? {
                        id: item.location.id,
                        name: item.location.name,
                        code2: item.location.code2 || null
                      } : {
                        id: `location-${item.id}`,
                        name: 'Unknown Location',
                        code2: null
                      },
                      assignedVendor: null
                    };
                  })}
                readOnly={readOnly}
                showNotes={!isCustomer}
                isCustomer={isCustomer}
              />
            ) : (
              <div className="p-4 text-sm text-gray-500">{t('module.fulfillment.noServices')}</div>
            )}
          </div>
        </section>

      </div>
    </main>
  );
}