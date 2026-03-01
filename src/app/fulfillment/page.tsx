// src/app/fulfillment/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import OrderDetailsDialog from '@/components/portal/order-details-dialog';

interface Order {
  id: string;
  orderNumber: string;
  statusCode: string;
  subject: any;
  notes?: string | null;
  customer?: {
    id: string;
    name: string;
  };
  assignedVendor?: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    service: {
      id: string;
      name: string;
    };
    location: {
      id: string;
      name: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
  totalPrice?: number | null;
}

interface Stats {
  total: number;
  submitted: number;
  processing: number;
  completed: number;
  cancelled: number;
  moreInfoNeeded: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  more_info_needed: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function FulfillmentPage() {
  const { data: session } = useSession();
  const auth = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    submitted: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    moreInfoNeeded: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    // Check if user has fulfillment permission
    if (session && auth && !auth.checkPermission('fulfillment')) {
      router.push('/');
    }
  }, [session, auth, router]);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, statusFilter, searchQuery]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100'); // Fetch more orders for stats

      const response = await fetch(`/api/fulfillment?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders);

      // Calculate stats
      const newStats = {
        total: data.orders.length,
        submitted: data.orders.filter((o: Order) => o.statusCode === 'submitted').length,
        processing: data.orders.filter((o: Order) => o.statusCode === 'processing').length,
        completed: data.orders.filter((o: Order) => o.statusCode === 'completed').length,
        cancelled: data.orders.filter((o: Order) => o.statusCode === 'cancelled').length,
        moreInfoNeeded: data.orders.filter((o: Order) => o.statusCode === 'more_info_needed').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(order => order.statusCode === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.subject?.firstName?.toLowerCase().includes(query) ||
        order.subject?.lastName?.toLowerCase().includes(query) ||
        order.customer?.name?.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getSubjectName = (subject: any) => {
    if (!subject) return 'N/A';
    return `${subject.firstName || ''} ${subject.lastName || ''}`.trim() || 'N/A';
  };

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / limit);
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Fulfillment</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage and process orders assigned to your organization
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('submitted')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'submitted' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-blue-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Submitted</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.submitted}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('processing')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'processing' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.processing}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'cancelled' ? 'ring-2 ring-red-500 bg-red-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <XCircleIcon className="h-8 w-8 text-red-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">Cancelled</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.cancelled}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Orders</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Input
                type="search"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="more_info_needed">More Info Needed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No orders found</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>{getSubjectName(order.subject)}</TableCell>
                        <TableCell>{order.customer?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.statusCode] || 'bg-gray-100'}>
                            {formatStatus(order.statusCode)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.items.length > 0 ? (
                            <div className="text-sm">
                              {order.items.map((item, idx) => (
                                <div key={item.id}>
                                  {idx > 0 && ', '}
                                  {item.service.name}
                                </div>
                              ))}
                            </div>
                          ) : (
                            'No services'
                          )}
                        </TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOrderClick(order.id)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of{' '}
                    {filteredOrders.length} orders
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedOrderId(null);
        }}
      />
    </div>
  );
}