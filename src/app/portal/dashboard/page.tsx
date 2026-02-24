'use client';
import clientLogger from '@/lib/client-logger';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  ShoppingCartIcon,
  ClockIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import OrderDetailsDialog from '@/components/portal/order-details-dialog';

interface DashboardStats {
  total: number;
  pending: number;
  completed: number;
  draft: number;
  submitted: number;
  processing: number;
  cancelled: number;
}

interface OrderItem {
  id: string;
  service: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  statusCode: string;
  subject: any;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  totalPrice?: number | null;
}

export default function CustomerDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    pending: 0,
    completed: 0,
    draft: 0,
    submitted: 0,
    processing: 0,
    cancelled: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10); // 10 items per page, same as My Orders

  useEffect(() => {
    if (session?.user?.customerId) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      // Fetch real order statistics and more orders (same as My Orders page)
      const [statsResponse, ordersResponse] = await Promise.all([
        fetch('/api/portal/orders/stats'),
        fetch('/api/portal/orders?limit=50'), // Show more orders, same as My Orders page default
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setOrders(ordersData.orders);
        setFilteredOrders(ordersData.orders); // Initially show all orders
      }
    } catch (error) {
      clientLogger.error('Error fetching dashboard data:', error);
      // Set default values on error
      setStats({
        total: 0,
        pending: 0,
        completed: 0,
        draft: 0,
        submitted: 0,
        processing: 0,
        cancelled: 0,
      });
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders based on active filter
  const applyFilter = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1); // Reset to first page when filter changes

    if (filter === 'all') {
      setFilteredOrders(orders);
    } else if (filter === 'pending') {
      // Pending includes submitted and processing
      setFilteredOrders(orders.filter(order =>
        order.statusCode === 'submitted' || order.statusCode === 'processing'
      ));
    } else {
      setFilteredOrders(orders.filter(order => order.statusCode === filter));
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Dialog handlers
  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedOrderId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrders.length / limit);
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome back, {session?.user?.name || session?.user?.email}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {session?.user?.customerName && (
            <>Organization: {session.user.customerName}</>
          )}
        </p>
      </div>

      {/* Stats Grid - Now clickable filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => applyFilter('all')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            activeFilter === 'all' ? 'ring-2 ring-brand-blue bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-brand-blue" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.total}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => applyFilter('pending')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            activeFilter === 'pending' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.pending}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => applyFilter('completed')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            activeFilter === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.completed}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => applyFilter('draft')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            activeFilter === 'draft' ? 'ring-2 ring-gray-500 bg-gray-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ShoppingCartIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Drafts</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats.draft}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/portal/orders/new"
            className="inline-flex items-center justify-center rounded-md bg-brand-blue px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <ShoppingCartIcon className="h-5 w-5 mr-2" />
            Start New Order
          </Link>
          <Link
            href="/portal/orders"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <DocumentTextIcon className="h-5 w-5 mr-2" />
            View All Orders
          </Link>
          <Link
            href="/portal/profile"
            className="inline-flex items-center justify-center rounded-md bg-white px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Manage Profile
          </Link>
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {activeFilter === 'all' ? 'All Orders' :
             activeFilter === 'pending' ? 'Pending Orders' :
             activeFilter === 'completed' ? 'Completed Orders' :
             activeFilter === 'draft' ? 'Draft Orders' : 'Orders'}
          </h3>
          <p className="text-sm text-gray-500">
            {filteredOrders.length > 0
              ? `Showing ${Math.min(limit, filteredOrders.length)} of ${filteredOrders.length} ${activeFilter === 'all' ? '' : activeFilter} orders`
              : ''
            }
          </p>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500">
              {activeFilter === 'all'
                ? 'No orders found.'
                : `No ${activeFilter === 'pending' ? 'pending' : activeFilter} orders found.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {order.orderNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          {(() => {
                            // Format subject name using the same logic as My Orders
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
                              const nameFields = Object.entries(subjectData)
                                .filter(([key, value]) =>
                                  value && typeof value === 'string' &&
                                  (key.toLowerCase().includes('name') ||
                                   key.toLowerCase().includes('surname'))
                                )
                                .map(([key, value]) => value);

                              return nameFields.length > 0 ? nameFields.join(' ') : 'No subject';
                            }
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-1">
                            {order.items.slice(0, 2).map((item, idx) => (
                              <div key={item.id}>
                                <span className="font-medium">{item.service.name}:</span>{' '}
                                <span className="text-blue-600">{item.location.name}</span>
                              </div>
                            ))}
                            {order.items.length > 2 && (
                              <div className="text-gray-500 text-xs">
                                +{order.items.length - 2} more
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">No services</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.statusCode)}`}>
                        {order.statusCode.charAt(0).toUpperCase() + order.statusCode.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewOrder(order.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3 cursor-pointer"
                      >
                        View
                      </button>
                      {order.statusCode === 'draft' && (
                        <Link
                          href={`/portal/orders/${order.id}/edit`}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">{startIndex + 1}</span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(endIndex, filteredOrders.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredOrders.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
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
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={dialogOpen}
        onClose={handleCloseDialog}
      />
    </div>
  );
}