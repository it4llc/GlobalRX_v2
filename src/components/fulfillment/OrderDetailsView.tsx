// /GlobalRX_v2/src/components/fulfillment/OrderDetailsView.tsx
// Main content component for displaying order information in fulfillment workflow.
//
// Key design decisions:
// - Empty values display as "--" for consistency
// - Status badges use color coding for quick visual scanning
// - Single column layout optimized for detailed viewing
// - Section-based organization for easy navigation

'use client';

import React from 'react';
import { format } from 'date-fns';
import { useTranslation } from '@/contexts/TranslationContext';

interface OrderDetailsViewProps {
  order: {
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
    }>;
    createdAt: Date | string;
    updatedAt: Date | string;
  };
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

export function OrderDetailsView({ order }: OrderDetailsViewProps) {
  const { t } = useTranslation();
  // Extract subject fields
  const subject = order.subject || {};

  return (
    <main className="order-details-view" role="main">
      <div className="space-y-6">
        {/* Order Header */}
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
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
            </dl>
          </div>
        </section>

        {/* Services Section */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.services')}</h2>
          <div className="bg-white rounded-lg border">
            {order.items && order.items.length > 0 ? (
              <div className="services-list">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('module.fulfillment.service')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('module.fulfillment.location')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.service ? formatValue(item.service.name) : '--'}
                          {item.service?.category && (
                            <div className="text-xs text-gray-500">{item.service.category}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.location ? formatValue(item.location.name) : '--'}
                          {item.location?.code2 && (
                            <div className="text-xs text-gray-500">({item.location.code2})</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColorClass(item.status)}`}>
                            {formatStatus(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

        {/* Status History Section - Basic placeholder, full implementation in sidebar */}
        <section>
          <h2 className="text-lg font-medium text-gray-900 mb-4">{t('module.fulfillment.statusHistory')}</h2>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">
              {t('module.fulfillment.seeStatusHistory')}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}