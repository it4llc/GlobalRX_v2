// /GlobalRX_v2/src/app/fulfillment/page.tsx
// Order Fulfillment Dashboard - Main listing page for fulfillment workflow
//
// Key features:
// - Statistics dashboard showing order counts by status
// - Filterable and searchable order list
// - Status-based visual indicators with color coding
// - New tab navigation to order details (preserves list context)
// - Full internationalization support for multi-language use
// - Permission-based access control (requires fulfillment.* permission)
//
// Required permissions: fulfillment.* or admin.*
'use client';

import React, { useState, useEffect } from 'react';
import { SubjectInfo } from '@/components/portal/orders/types';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { ServiceStatusList } from '@/components/orders/ServiceStatusList';
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
  subject: SubjectInfo | null;
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
      code?: string;
    };
    status: string;
  }>;
  createdAt: string;
  updatedAt: string;
  totalPrice?: number | null;
}


const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  more_info_needed: 'bg-orange-100 text-orange-800',
  missing_info: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  cancelled_dnb: 'bg-red-100 text-red-800',
};

export default function FulfillmentPage() {
  const { data: session } = useSession();
  const auth = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalServices: 0,
    inProgress: 0,
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);

  useEffect(() => {
    // Check if user has fulfillment permission OR is a customer user
    if (session && auth) {
      const isCustomer = session.user?.userType === 'customer';
      const hasFulfillmentPermission = auth.checkPermission('fulfillment');

      if (!hasFulfillmentPermission && !isCustomer) {
        router.push('/');
      }
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

      // Use stats from API response
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      // Error already logged by API layer, no need to log again
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'in_progress') {
        // In Progress = orders NOT in Draft, Completed, or Cancelled status
        filtered = filtered.filter(order =>
          order.statusCode !== 'draft' &&
          order.statusCode !== 'completed' &&
          order.statusCode !== 'cancelled'
        );
      } else {
        filtered = filtered.filter(order => order.statusCode === statusFilter);
      }
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
    // Phase 2a design decision: Open order details page in a new tab
    // Business rationale:
    // 1. Keeps the main order list accessible for quick navigation
    // 2. Allows fulfillers to compare multiple orders side-by-side
    // 3. Prevents accidental loss of search/filter state when returning to list
    // 4. Supports natural workflow where fulfillers often need to reference multiple orders
    window.open(`/fulfillment/orders/${orderId}`, '_blank');
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

  const getSubjectName = (subject: SubjectInfo | null) => {
    if (!subject) return t('module.fulfillment.na');
    return `${subject.firstName || ''} ${subject.lastName || ''}`.trim() || t('module.fulfillment.na');
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
            <h1 className="text-2xl font-bold text-gray-900">{t('module.fulfillment.pageTitle')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('module.fulfillment.pageDescription')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            {t('module.fulfillment.logout')}
          </Button>
        </div>
      </div>

      {/* Stats Cards - Only 3 cards as per requirements */}
      {/* BUG FIX (March 9, 2026): Dashboard now shows consistent 3 cards for ALL user types
          Previously showed 5 cards for internal/vendor users, 4 for customers.
          Business Requirement: Unified experience with Total Orders, Total Services, In Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm font-medium text-gray-600">{t('module.fulfillment.totalOrders')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-purple-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">{t('module.fulfillment.totalServices')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalServices}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`bg-white rounded-lg shadow p-6 transition-all hover:shadow-md ${
            statusFilter === 'in_progress' ? 'ring-2 ring-yellow-500 bg-yellow-50' : ''
          }`}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ClockIcon className="h-8 w-8 text-yellow-500" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-sm font-medium text-gray-600">{t('module.fulfillment.inProgress')}</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>{t('module.fulfillment.orders')}</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Input
                type="search"
                placeholder={t('module.fulfillment.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder={t('module.fulfillment.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('module.fulfillment.allStatuses')}</SelectItem>
                  <SelectItem value="submitted">{t('module.fulfillment.submitted')}</SelectItem>
                  <SelectItem value="processing">{t('module.fulfillment.processing')}</SelectItem>
                  <SelectItem value="more_info_needed">{t('module.fulfillment.moreInfoNeeded')}</SelectItem>
                  <SelectItem value="completed">{t('module.fulfillment.completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('module.fulfillment.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">{t('module.fulfillment.noOrdersFound')}</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('module.fulfillment.orderNumber')}</TableHead>
                      <TableHead>{t('module.fulfillment.subject')}</TableHead>
                      <TableHead>{t('module.fulfillment.customer')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('module.fulfillment.services')}</TableHead>
                      <TableHead>{t('module.fulfillment.created')}</TableHead>
                      <TableHead>{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>{getSubjectName(order.subject)}</TableCell>
                        <TableCell>{order.customer?.name || t('module.fulfillment.na')}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.statusCode] || 'bg-gray-100'}>
                            {formatStatus(order.statusCode)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {/* ServiceStatusList provides consistent service display across all order tables */}
                          <ServiceStatusList items={order.items} />
                        </TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOrderClick(order.id)}
                            title={t('module.fulfillment.openInNewTab')}
                          >
                            {t('module.fulfillment.view')}
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
                    {t('module.fulfillment.showing')} {startIndex + 1} {t('module.fulfillment.to')} {Math.min(endIndex, filteredOrders.length)} {t('module.fulfillment.of')}{' '}
                    {filteredOrders.length} {t('module.fulfillment.orders').toLowerCase()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t('module.fulfillment.previous')}
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      {t('module.fulfillment.page')} {currentPage} {t('module.fulfillment.of')} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t('module.fulfillment.next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      {/* BUG FIX: Pass isInternalUser=true to ensure dialog uses correct API endpoint
          Previously, all users hit /api/portal/orders/[id] which caused 401 errors
          for internal users. Now internal users route to /api/fulfillment/orders/[id] */}
      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedOrderId(null);
        }}
        isInternalUser={true}
      />
    </div>
  );
}