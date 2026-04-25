// /GlobalRX_v2/src/app/portal/orders/page.tsx

'use client';
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';

import { useSession } from 'next-auth/react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { ServiceStatusList } from '@/components/orders/ServiceStatusList';
import { useTranslation } from '@/contexts/TranslationContext';
import { getOrderStatusColorClasses } from '@/lib/status-colors';

interface OrderItem {
  id: string;
  service: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
    code?: string;
  };
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  statusCode: string;
  subject: Record<string, string | number | boolean | null> | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  candidateInvitations?: Array<{
    id: string;
    status: string;
  }>;
}

interface OrdersResponse {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}



export default function OrdersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);

  const fetchOrders = async (searchTerm = search, status = statusFilter, page = currentPage) => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = new URLSearchParams();

      if (searchTerm) params.append('search', searchTerm);
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/portal/orders?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data: OrdersResponse = await response.json();
      setOrders(data.orders);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      clientLogger.error('Error fetching orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.customerId) {
      fetchOrders();
    }
  }, [session]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchOrders(search, statusFilter, 1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchOrders(search, status, 1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchOrders(search, statusFilter, page);
  };

  const totalPages = Math.ceil(total / limit);

  const handleViewOrder = (orderId: string) => {
    // Navigate to the fulfillment order details page instead of opening a dialog
    router.push(`/fulfillment/orders/${orderId}`);
  };

  if (!session) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{t('portal.orders.title')}</h2>
          <Link
            href="/portal/orders/new"
            className="inline-flex items-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            {t('portal.orders.newOrder')}
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('portal.orders.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('portal.orders.allStatus')}</option>
              <option value="draft">{t('services.status.draft')}</option>
              <option value="submitted">{t('services.status.submitted')}</option>
              <option value="processing">{t('services.status.processing')}</option>
              <option value="completed">{t('services.status.completed')}</option>
              <option value="cancelled">{t('services.status.cancelled')}</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('common.search')}
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">{t('portal.orders.loadingOrders')}</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => fetchOrders()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">{t('portal.orders.noOrdersFound')}</p>
            <Link
              href="/portal/orders/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('portal.orders.createFirstOrder')}
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('portal.orders.order')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('portal.orders.services')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('portal.orders.created')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('portal.orders.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {(() => {
                              // Try to find name in various field formats
                              const subjectData = order.subject || {};

                              const firstName = subjectData.firstName ||
                                              subjectData['First Name'] ||
                                              subjectData['first_name'];

                              const lastName = subjectData.lastName ||
                                             subjectData['Last Name'] ||
                                             subjectData['Surname/Last Name'] ||
                                             subjectData['surname'] ||
                                             subjectData['last_name'];

                              if (firstName && lastName) {
                                return `${firstName} ${lastName}`;
                              } else if (firstName) {
                                return firstName;
                              } else if (lastName) {
                                return lastName;
                              } else {
                                // Check if we can find any name-like fields
                                const nameFields = Object.entries(subjectData)
                                  .filter(([key, value]) =>
                                    value && typeof value === 'string' &&
                                    (key.toLowerCase().includes('name') ||
                                     key.toLowerCase().includes('surname'))
                                  )
                                  .map(([key, value]) => value);

                                return nameFields.length > 0 ? nameFields.join(' ') : t('portal.orders.noSubject');
                              }
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {/* ServiceStatusList component displays each service in its own row
                            Critical for customer portal where users need clear service status visibility */}
                        <ServiceStatusList items={order.items} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOrderStatusColorClasses(order.statusCode)}`}>
                            {t(`services.status.${order.statusCode}`)}
                          </span>
                          {order.candidateInvitations && order.candidateInvitations.length > 0 && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              {t('portal.orders.candidateInviteBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewOrder(order.id)}
                          className="text-blue-600 hover:text-blue-900 mr-3 cursor-pointer"
                        >
                          {t('common.view')}
                        </button>
                        {/* Hide edit button for candidate invite orders - they are managed by candidates, not customers */}
                        {order.statusCode === 'draft' && (!order.candidateInvitations || order.candidateInvitations.length === 0) && (
                          <Link
                            href={`/portal/orders/${order.id}/edit`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {t('common.edit')}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('common.previous')}
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {t('portal.orders.showing')}{' '}
                        <span className="font-medium">{(currentPage - 1) * limit + 1}</span>{' '}
                        {t('portal.orders.to')}{' '}
                        <span className="font-medium">
                          {Math.min(currentPage * limit, total)}
                        </span>{' '}
                        {t('portal.orders.of')} <span className="font-medium">{total}</span> {t('portal.orders.results')}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.previous')}
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === currentPage
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.next')}
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}