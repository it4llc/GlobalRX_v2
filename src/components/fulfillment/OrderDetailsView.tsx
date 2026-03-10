// /GlobalRX_v2/src/components/fulfillment/OrderDetailsView.tsx
// Main content component for displaying order information in fulfillment workflow.
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
import { ChevronLeft, Edit, AlertTriangle, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext';
import { ServiceFulfillmentTable } from './ServiceFulfillmentTable';
import { ActionDropdown } from '@/components/ui/action-dropdown';

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
                {user?.userType === 'customer' ? 'Back to Dashboard' : 'Back'}
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
            </div>

            {/* Internal User Controls */}
            {!isCustomer && (
              <div className="flex items-center space-x-3">
                <button
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </button>

                <div data-testid="action-dropdown">
                  <ActionDropdown
                    options={[
                      { label: 'Assign Vendor', onClick: () => {} },
                      { label: 'Update Status', onClick: () => {} },
                      { label: 'Add Notes', onClick: () => {} },
                      { label: 'View History', onClick: () => {} },
                    ]}
                  />
                </div>

                <select
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={order.statusCode}
                  aria-label="Status"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Order Information Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.orderInformation')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.orderNumber')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(order.orderNumber)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('common.status')}</dt>
                <dd className="mt-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColorClass(order.statusCode)}`}>
                    {formatStatus(order.statusCode)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.created')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(order.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('common.updated')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(order.updatedAt)}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Subject Information Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.subjectInformation')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.firstName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.firstName)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.lastName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.lastName)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.middleName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.middleName)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.dateOfBirth')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.dateOfBirth)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.email')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.email)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.phone')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.phone)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.ssn')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.ssn)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.address')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.address)}</dd>
              </div>
              {subject.city && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.city')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.city)}</dd>
                </div>
              )}
              {subject.state && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.state')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.state)}</dd>
                </div>
              )}
              {subject.zipCode && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.zipCode')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatValue(subject.zipCode)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {/* Customer Details Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.customerDetails')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.customerName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatValue(order.customer.name)}</dd>
              </div>
              {order.customer.code && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">{t('module.fulfillment.customerCode')}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatValue(order.customer.code)}</dd>
                </div>
              )}

              {/* Show vendor and internal information for internal users */}
              {!isCustomer && (
                <>
                  {order.assignedVendor && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Assigned Vendor</dt>
                      <dd className="mt-1 text-sm text-gray-900">{order.assignedVendor.name}</dd>
                    </div>
                  )}

                  {order.vendorNotes && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Vendor Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900">{order.vendorNotes}</dd>
                    </div>
                  )}

                  {order.internalNotes && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Internal Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900">{order.internalNotes}</dd>
                    </div>
                  )}

                  {order.user && (
                    <>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Order Creator</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatUserName(order.user, 'Unknown')}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Creator Email</dt>
                        <dd className="mt-1 text-sm text-gray-900">{order.user.email}</dd>
                      </div>
                    </>
                  )}
                </>
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
                  .map(item => ({
                  // ID MAPPING FIX: Use ServiceFulfillment ID if available, otherwise fall back to OrderItem ID
                  // This ensures ServiceFulfillmentTable gets the correct ID for comment lookups
                  // ServiceFulfillment.id is what comments API keys results by
                  id: item.serviceFulfillment?.id || item.id,
                  orderId: order.id,
                  orderItemId: item.id,
                  serviceId: item.service?.id || '',
                  locationId: item.location?.id || '',
                  status: item.serviceFulfillment?.status || item.status || 'pending',
                  assignedVendorId: item.serviceFulfillment?.assignedVendorId || null,
                  vendorNotes: item.serviceFulfillment?.vendorNotes || null,
                  internalNotes: item.serviceFulfillment?.internalNotes || null,
                  assignedAt: item.serviceFulfillment?.assignedAt || null,
                  assignedBy: item.serviceFulfillment?.assignedBy || null,
                  completedAt: item.serviceFulfillment?.completedAt || null,
                  createdAt: order.createdAt.toString(),
                  updatedAt: order.updatedAt.toString(),
                  service: item.service || {
                    id: item.service?.id || `service-${item.id}`,
                    name: item.service?.name || 'Unknown Service',
                    code: item.service?.code || undefined,
                    category: item.service?.category || null
                  },
                  location: item.location || {
                    id: item.location?.id || `location-${item.id}`,
                    name: item.location?.name || 'Unknown Location',
                    code2: item.location?.code2 || null
                  },
                  assignedVendor: null
                }))}
                readOnly={readOnly}
                showNotes={!isCustomer}
                isCustomer={isCustomer}
              />
            ) : (
              <div className="p-4 text-sm text-gray-500">{t('module.fulfillment.noServices')}</div>
            )}
          </div>
        </section>

        {/* Notes Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.notes')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-900 whitespace-pre-wrap">
              {formatValue(order.notes)}
            </div>
          </div>
        </section>

        {/* Status History Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.statusHistory')}</h2>
          <div className="bg-white rounded-lg border p-4">
            {order.statusHistory && order.statusHistory.length > 0 ? (
              <div className="space-y-3">
                {order.statusHistory.map((entry: any) => (
                  <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium">{entry.status || entry.fromStatus}</span>
                      {entry.toStatus && (
                        <>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{entry.toStatus}</span>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {!isCustomer && entry.user && (
                        <span>Changed by {formatUserName(entry.user, 'Unknown')}</span>
                      )}
                      <div>{formatValue(entry.changedAt || entry.createdAt)}</div>
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
          </div>
        </section>
      </div>
    </main>
  );
}