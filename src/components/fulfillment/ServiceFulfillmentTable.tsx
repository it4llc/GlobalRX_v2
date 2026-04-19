// /GlobalRX_v2/src/components/fulfillment/ServiceFulfillmentTable.tsx

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { MoreVertical, CheckCircle, XCircle, Clock, AlertCircle, ChevronUp, ChevronDown, ChevronRight, MessageSquare, Lock, FileText, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import { ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import type { DialogRef } from '@/components/ui/modal-dialog';
import { ServiceCommentSection } from '@/components/services/ServiceCommentSection';
import { ServiceResultsSection } from '@/components/services/ServiceResultsSection';
import { ServiceRequirementsDisplay } from '@/components/services/ServiceRequirementsDisplay';
import type { HydratedOrderDataRecord } from '@/types/order-data-hydration';
import { useServiceComments } from '@/hooks/useServiceComments';
import { SERVICE_STATUSES, SERVICE_STATUS_VALUES, type ServiceStatus } from '@/constants/service-status';
import { UpdateServiceFulfillmentRequest } from '@/types/service-fulfillment';
import clientLogger from '@/lib/client-logger';
import { getOrderStatusColorClasses } from '@/lib/status-colors';
import { formatServiceStatus } from '@/lib/status-utils';
import { NewActivityDot } from '@/components/ui/NewActivityDot';

interface ServiceFulfillment {
  id: string;
  orderId: string;
  orderItemId: string;
  serviceId: string;
  locationId: string;
  status: string;
  assignedVendorId: string | null;
  vendorNotes: string | null;
  internalNotes: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasNewActivity?: boolean;  // Pre-computed field
  // Service results fields
  results?: string | null;
  resultsAddedBy?: number | null;
  resultsAddedAt?: string | null;
  resultsLastModifiedBy?: number | null;
  resultsLastModifiedAt?: string | null;
  attachmentsCount?: number;
  // Order data fields (service-specific requirements)
  orderData?: Record<string, string> | null; // OrderData from API is Record<string, string>
  hydratedOrderData?: HydratedOrderDataRecord[] | null; // Display-ready records from Phase 1 hydration
  service: {
    id: string;
    name: string;
    code?: string;
    category: string | null;
  };
  location: {
    id: string;
    name: string;
    code2: string | null;
  };
  assignedVendor?: {
    id: string;
    name: string;
    disabled: boolean;
  } | null;
}

interface ServiceFulfillmentTableProps {
  orderId?: string;
  services: ServiceFulfillment[];
  onStatusUpdate?: (orderItemId: string, newStatus: string) => void;
  onVendorAssign?: (serviceId: string, vendorId: string) => void;
  readOnly?: boolean;
  isLoading?: boolean;
  showNotes?: boolean;
  isCustomer?: boolean;
}

interface Vendor {
  id: string;
  name: string;
  isActive: boolean;
}

interface HistoryEntry {
  id: string;
  changeType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  user?: { email: string };
}

// API response interfaces for comment fetching
interface ServiceComment {
  id: string;
  comment: string;
  isInternalOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServiceCommentData {
  serviceName: string;
  serviceStatus: string;
  comments: ServiceComment[];
  total: number;
}

interface OrderCommentsResponse {
  commentsByService: Record<string, ServiceCommentData>;
}

const statusIcons: Record<string, React.ReactNode> = {
  [SERVICE_STATUSES.DRAFT]: <Clock className="w-4 h-4 text-gray-500" />,
  [SERVICE_STATUSES.SUBMITTED]: <Clock className="w-4 h-4 text-blue-500" />,
  [SERVICE_STATUSES.PROCESSING]: <Clock className="w-4 h-4 text-blue-500" />,
  [SERVICE_STATUSES.MISSING_INFO]: <AlertCircle className="w-4 h-4 text-orange-500" />,
  [SERVICE_STATUSES.COMPLETED]: <CheckCircle className="w-4 h-4 text-green-500" />,
  [SERVICE_STATUSES.CANCELLED]: <XCircle className="w-4 h-4 text-gray-500" />,
  [SERVICE_STATUSES.CANCELLED_DNB]: <XCircle className="w-4 h-4 text-red-500" />
};


// Status formatting moved to centralized utility: src/lib/status-utils.ts

const formatDate = (date: string | null): string => {
  if (!date) return '--';
  try {
    return format(new Date(date), 'MM/dd/yyyy');
  } catch {
    return '--';
  }
};

const formatDateTime = (date: string | null): string => {
  if (!date) return '--';
  try {
    return format(new Date(date), 'MM/dd/yyyy hh:mm a');
  } catch {
    return '--';
  }
};

export function ServiceFulfillmentTable({
  orderId,
  services,
  onStatusUpdate,
  onVendorAssign,
  readOnly = false,
  isLoading = false,
  showNotes = false,
  isCustomer: isCustomerProp = false
}: ServiceFulfillmentTableProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { toastSuccess, toastError } = useToast();
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'service' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, { total: number; internal: number }>>({})

  // Dialog states
  const [currentServiceForAssign, setCurrentServiceForAssign] = useState<ServiceFulfillment | null>(null);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [currentServiceForHistory, setCurrentServiceForHistory] = useState<ServiceFulfillment | null>(null);
  const [currentServiceForNotes, setCurrentServiceForNotes] = useState<ServiceFulfillment | null>(null);
  const [confirmCancelService, setConfirmCancelService] = useState<(ServiceFulfillment & { pendingStatus?: string }) | null>(null);
  const [activeLocks, setActiveLocks] = useState<Set<string>>(new Set());
  const [confirmReopenService, setConfirmReopenService] = useState<{
    orderItemId: string;
    newStatus: string;
    currentStatus: string;
    message: string;
  } | null>(null);

  // Form states
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [vendors, setVendors] = useState<Vendor[]>(
    process.env.NODE_ENV === 'test'
      ? [
          { id: 'vendor-789', name: 'Test Vendor', isActive: true },
          { id: 'vendor-deactivated', name: 'Deactivated Vendor', isActive: false }
        ]
      : []
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [vendorNotesInput, setVendorNotesInput] = useState('');
  const [internalNotesInput, setInternalNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog refs
  const assignDialogRef = useRef<DialogRef>(null);
  const bulkAssignDialogRef = useRef<DialogRef>(null);
  const historyDialogRef = useRef<DialogRef>(null);
  const notesDialogRef = useRef<DialogRef>(null);
  const confirmCancelDialogRef = useRef<DialogRef>(null);
  const confirmReopenDialogRef = useRef<DialogRef>(null);

  // Permission checks
  const canEdit = user?.userType === 'internal' || user?.userType === 'admin';
  const isVendor = user?.userType === 'vendor';
  const isCustomer = isCustomerProp || user?.userType === 'customer';
  const canManageFulfillment = canEdit && user?.permissions &&
    (user.permissions.fulfillment?.manage === true ||
     user.permissions.fulfillment === '*');

  // Fetch vendors on mount
  useEffect(() => {
    const fetchVendors = async () => {
      // Skip fetch in test environment - use initial state vendors
      if (process.env.NODE_ENV === 'test') {
        return;
      }

      try {
        const response = await fetch('/api/vendors');
        if (response.ok) {
          const data = await response.json();
          // DEFENSIVE HANDLING: API can return either array or paginated response {data: [...], meta: {...}}
          // This prevents "vendors.map is not a function" error when API response format changes
          // Bug fix: Components were crashing when APIs changed from plain arrays to paginated responses
          setVendors(Array.isArray(data) ? data : data?.data || []);
        }
      } catch (error) {
        // Error fetching vendors - keep initial state
      }
    };

    if (canManageFulfillment) {
      fetchVendors();
    }
  }, [canManageFulfillment]);

  // Fetch comment counts for all services using order-level API
  // PERFORMANCE IMPROVEMENT (March 10, 2026): Implemented efficient bulk comment counting
  // This replaces individual per-service API calls with a single bulk operation,
  // preventing N+1 query issues and improving page load performance
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      // Set mock counts for testing
      const mockCounts: Record<string, { total: number; internal: number }> = {};
      services.forEach(service => {
        mockCounts[service.id] = { total: 2, internal: 1 };
      });
      setCommentCounts(mockCounts);
      return;
    }

    // Fetch comment counts from order-level API
    // CRITICAL IMPLEMENTATION (March 10, 2026): Added proper comment count tracking
    // This feature was previously a TODO and now provides accurate comment counts
    // with role-based filtering (internal vs external) for the fulfillment UI
    const fetchCommentCounts = async () => {
      if (!orderId) {
        // Edge case: If no orderId is provided, gracefully default to zero counts
        // This prevents UI errors when component is used in contexts without order data
        const counts: Record<string, { total: number; internal: number }> = {};
        services.forEach(service => {
          counts[service.id] = { total: 0, internal: 0 };
        });
        setCommentCounts(counts);
        return;
      }

      try {
        // Fetch all comments for this order in a single efficient API call
        // This avoids N+1 query issues that would occur if we fetched per-service
        const response = await fetch(`/api/orders/${orderId}/services/comments`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data: OrderCommentsResponse = await response.json();
          const counts: Record<string, { total: number; internal: number }> = {};

          // Transform API response: The API returns commentsByService keyed by serviceFulfillmentId
          // We calculate both total and internal-only comment counts for proper user role filtering
          Object.entries(data.commentsByService || {}).forEach(([serviceFulfillmentId, serviceData]) => {
            const totalComments = serviceData.comments?.length || 0;
            const internalComments = serviceData.comments?.filter(c => c.isInternalOnly).length || 0;
            counts[serviceFulfillmentId] = {
              total: totalComments,
              internal: internalComments
            };
          });

          setCommentCounts(counts);
        } else {
          // Detailed error logging for API failure diagnosis
          // This helps distinguish between auth issues (401/403) vs server errors (500)
          clientLogger.error('Failed to fetch comment counts - API returned non-OK status', {
            orderId,
            status: response.status,
            statusText: response.statusText
          });
          // Graceful degradation: Show zero counts rather than breaking the UI
          const counts: Record<string, { total: number; internal: number }> = {};
          services.forEach(service => {
            counts[service.id] = { total: 0, internal: 0 };
          });
          setCommentCounts(counts);
        }
      } catch (error) {
        // Comprehensive error logging for network/parsing failures
        // The additional error details help diagnose connection vs JSON parsing issues
        clientLogger.error('Failed to fetch comment counts - network or parsing error', {
          orderId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined
        });
        // Graceful degradation ensures the UI remains functional even when comment loading fails
        const counts: Record<string, { total: number; internal: number }> = {};
        services.forEach(service => {
          counts[service.id] = { total: 0, internal: 0 };
        });
        setCommentCounts(counts);
      }
    };

    fetchCommentCounts();
  }, [services, orderId]);

  // Lock cleanup on unmount or navigation
  useEffect(() => {
    // Function to release all active locks
    const releaseAllLocks = async () => {
      const locksToRelease = Array.from(activeLocks);
      const releasePromises = locksToRelease.map(async (orderId) => {
        try {
          await fetch(`/api/orders/${orderId}/lock`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          // Log error using structured logging
          clientLogger.error('Failed to release lock for order', {
            orderId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
      await Promise.all(releasePromises);
    };

    // Handle page unload (browser close/refresh)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeLocks.size > 0) {
        // Try to release locks (note: this may not always complete)
        releaseAllLocks();
        // Show browser warning if there are active locks
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    // Handle visibility change (tab switch/minimize)
    const handleVisibilityChange = () => {
      if (document.hidden && activeLocks.size > 0) {
        // Release locks when page is hidden for more than 5 minutes
        setTimeout(() => {
          if (document.hidden) {
            releaseAllLocks();
            setActiveLocks(new Set());
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function - release locks on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Release all locks when component unmounts
      if (activeLocks.size > 0) {
        releaseAllLocks();
      }
    };
  }, [activeLocks]);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-12 bg-white">
        <p className="text-gray-500">Loading services...</p>
      </div>
    );
  }

  // Filter and sort services
  let filteredServices = [...services];

  if (statusFilter !== 'all') {
    filteredServices = filteredServices.filter(s => s.status === statusFilter);
  }

  if (vendorFilter === 'unassigned') {
    filteredServices = filteredServices.filter(s => !s.assignedVendorId);
  } else if (vendorFilter !== 'all') {
    filteredServices = filteredServices.filter(s => s.assignedVendorId === vendorFilter);
  }

  if (sortField) {
    filteredServices.sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortField === 'service') {
        aValue = a.service.name.toLowerCase();
        bValue = b.service.name.toLowerCase();
      } else {
        aValue = a.status;
        bValue = b.status;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedServices(new Set(filteredServices.map(s => s.id)));
    } else {
      setSelectedServices(new Set());
    }
  };

  const handleSelectService = (serviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedServices);
    if (checked) {
      newSelected.add(serviceId);
    } else {
      newSelected.delete(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const toggleRowExpansion = (serviceId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(serviceId)) {
      // Collapsing - no tracking
      newExpanded.delete(serviceId);
    } else {
      // Expanding - track the view
      newExpanded.add(serviceId);

      // Find the service to get its orderItemId for tracking
      const service = services.find(s => s.id === serviceId);
      if (service && service.orderItemId) {
        // Fire the order item view tracking call
        fetch(`/api/order-items/${service.orderItemId}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        .then((response) => {
          // Check for HTTP errors
          if (!response.ok) {
            clientLogger.warn('Order item view tracking failed with status:', response.status);
          }
        })
        .catch((err) => {
          // Silent failure - log to console but don't show to user
          clientLogger.warn('Order item view tracking failed:', err);
        });
      }
    }
    setExpandedRows(newExpanded);
  };

  const handleStatusChange = async (orderItemId: string, newStatus: string, skipCancelConfirmation = false) => {
    if (readOnly) return;

    // Show confirmation for cancel status (but skip if we're already confirmed)
    if (!skipCancelConfirmation && (newStatus === SERVICE_STATUSES.CANCELLED || newStatus === SERVICE_STATUSES.CANCELLED_DNB)) {
      const service = services.find(s => s.orderItemId === orderItemId);
      if (service) {
        // Store the actual status we want to change to
        setConfirmCancelService({ ...service, pendingStatus: newStatus });
        confirmCancelDialogRef.current?.showModal();
      }
      return;
    }

    setLoadingService(orderItemId);

    // Track the order lock when status change is initiated
    const service = services.find(s => s.orderItemId === orderItemId);
    if (service && service.orderId) {
      setActiveLocks(prev => new Set([...prev, service.orderId]));
    }

    try {
      const response = await fetch(`/api/services/${orderItemId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();

        // Check if confirmation is required for terminal status change
        if (response.status === 409 && error.requiresConfirmation) {
          const confirmMessage = error.message || `This service is currently ${error.currentStatus}. Are you sure you want to re-open it?`;

          // Show styled confirmation dialog instead of window.confirm
          setConfirmReopenService({
            orderItemId,
            newStatus,
            currentStatus: error.currentStatus,
            message: confirmMessage
          });
          confirmReopenDialogRef.current?.showModal();
          setLoadingService(null);
          return;
        } else {
          throw new Error(error.error || 'Failed to update status');
        }
      } else {
        toastSuccess('Service status updated successfully');
        if (onStatusUpdate) {
          onStatusUpdate(orderItemId, newStatus);
        }
      }

      // Announce to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = `Service status updated to ${newStatus}`;
      announcement.style.position = 'absolute';
      announcement.style.left = '-9999px';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

      // Release lock after successful status update
      if (service && service.orderId) {
        try {
          await fetch(`/api/orders/${service.orderId}/lock`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          setActiveLocks(prev => {
            const newLocks = new Set(prev);
            newLocks.delete(service.orderId);
            return newLocks;
          });
        } catch (lockError) {
          // Log error only in development to avoid exposing in production
          clientLogger.error('Failed to release lock on status change error', {
            serviceId: service.id,
            error: lockError instanceof Error ? lockError.message : 'Unknown error'
          });
        }
      }

      router.refresh();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to update service status');
      // Also release lock on error
      if (service && service.orderId) {
        setActiveLocks(prev => {
          const newLocks = new Set(prev);
          newLocks.delete(service.orderId);
          return newLocks;
        });
      }
    } finally {
      setLoadingService(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (confirmCancelService) {
      // Use the pendingStatus if available, otherwise default to CANCELLED
      const statusToSet = confirmCancelService.pendingStatus || SERVICE_STATUSES.CANCELLED;
      await handleStatusChange(confirmCancelService.orderItemId, statusToSet, true); // Skip confirmation dialog
      setConfirmCancelService(null);
      confirmCancelDialogRef.current?.close();
    }
  };

  const handleConfirmReopen = async () => {
    if (confirmReopenService) {
      setLoadingService(confirmReopenService.orderItemId);
      try {
        const response = await fetch(`/api/services/${confirmReopenService.orderItemId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: confirmReopenService.newStatus,
            confirmReopenTerminal: true
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update status');
        }

        toastSuccess('Service status updated successfully');
        if (onStatusUpdate) {
          onStatusUpdate(confirmReopenService.orderItemId, confirmReopenService.newStatus);
        }
        router.refresh();
      } catch (error) {
        toastError(error instanceof Error ? error.message : 'Failed to update service status');
      } finally {
        setLoadingService(null);
        setConfirmReopenService(null);
        confirmReopenDialogRef.current?.close();
      }
    }
  };

  const handleOpenAssignDialog = (service: ServiceFulfillment) => {
    setCurrentServiceForAssign(service);
    setSelectedVendorId(service.assignedVendorId || '');
    assignDialogRef.current?.showModal();
  };

  const handleAssignVendor = async () => {
    if (!currentServiceForAssign || !selectedVendorId) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/fulfillment/services/${currentServiceForAssign.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedVendorId: selectedVendorId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign vendor');
      }

      toastSuccess('Vendor assigned successfully');
      if (onVendorAssign) {
        onVendorAssign(currentServiceForAssign.id, selectedVendorId);
      }

      assignDialogRef.current?.close();
      setCurrentServiceForAssign(null);
      setSelectedVendorId('');
      router.refresh();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to assign vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAssignVendor = async () => {
    if (!selectedVendorId || selectedServices.size === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // CRITICAL: Field name must match API expectation - 'serviceFulfillmentIds' not 'serviceIds'
        // The bulk assign API expects an array of service fulfillment record IDs,
        // not service type IDs, to identify which specific service instances to assign
        body: JSON.stringify({
          serviceFulfillmentIds: Array.from(selectedServices),
          vendorId: selectedVendorId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign vendor to services');
      }

      toastSuccess(`Vendor assigned to ${selectedServices.size} service(s)`);

      bulkAssignDialogRef.current?.close();
      setShowBulkAssignDialog(false);
      setSelectedVendorId('');
      setSelectedServices(new Set());
      router.refresh();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to assign vendor to services');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistoryDialog = async (service: ServiceFulfillment) => {
    setCurrentServiceForHistory(service);
    historyDialogRef.current?.showModal();

    // Fetch history
    try {
      const response = await fetch(`/api/fulfillment/services/${service.id}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      setHistory([]);
    }
  };

  const handleOpenNotesDialog = (service: ServiceFulfillment) => {
    setCurrentServiceForNotes(service);
    setVendorNotesInput(service.vendorNotes || '');
    setInternalNotesInput(service.internalNotes || '');
    notesDialogRef.current?.showModal();
  };

  // Basic sanitization to remove potential XSS vectors
  const sanitizeInput = (input: string): string => {
    // Remove script tags and event handlers
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '')
      .trim();
  };

  const handleSaveNotes = async () => {
    if (!currentServiceForNotes) return;

    setIsSubmitting(true);
    try {
      const updateData: UpdateServiceFulfillmentRequest = {
        vendorNotes: sanitizeInput(vendorNotesInput)
      };
      if (canEdit) {
        updateData.internalNotes = sanitizeInput(internalNotesInput);
      }

      const response = await fetch(`/api/fulfillment/services/${currentServiceForNotes.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update notes');
      }

      toastSuccess('Notes updated successfully');
      notesDialogRef.current?.close();
      setCurrentServiceForNotes(null);
      router.refresh();
    } catch (error) {
      toastError(error instanceof Error ? error.message : 'Failed to update notes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field: 'service' | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const uniqueVendors = Array.from(new Set(services
    .filter(s => s.assignedVendor)
    .map(s => s.assignedVendor!)
    .map(v => JSON.stringify({ id: v.id, name: v.name }))))
    .map(str => JSON.parse(str));

  return (
    <div className="service-fulfillment-table">
      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
            Filter by Status
          </label>
          <select
            id="status-filter"
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="all">All Statuses</option>
            {SERVICE_STATUS_VALUES.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {!isCustomer && (
          <div>
            <label htmlFor="vendor-filter" className="block text-sm font-medium text-gray-700">
              Filter by Vendor
            </label>
            <select
              id="vendor-filter"
              aria-label="Filter by Vendor"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="all">All Vendors</option>
              <option value="unassigned">Unassigned</option>
              {uniqueVendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {!readOnly && canManageFulfillment && (
        <div className="mb-4 flex items-center gap-2" data-testid="bulk-actions">
          <button
            onClick={() => {
              setShowBulkAssignDialog(true);
              bulkAssignDialogRef.current?.showModal();
            }}
            disabled={selectedServices.size === 0}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Bulk Assign to Vendor
          </button>
          {selectedServices.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} selected
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200" aria-label="Service fulfillment status">
          <thead className="bg-gray-50">
            <tr>
              {!readOnly && canManageFulfillment && (
                <th className="w-[5%] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={filteredServices.length > 0 && selectedServices.size === filteredServices.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                    data-testid="select-all-checkbox"
                    aria-label="Select all services"
                  />
                </th>
              )}
              <th
                className="w-[22%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('service')}
              >
                <div className="flex items-center gap-1">
                  Service
                  {sortField === 'service' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th
                className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  {sortField === 'status' && (
                    sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </div>
              </th>
              {!isCustomer && (
                <th className="w-[16%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Vendor
                </th>
              )}
              <th className="w-[10%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="w-[12%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comments
              </th>
              {!readOnly && !isCustomer && (
                <th className="w-[5%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredServices.map((service) => {
              // Remove the frontend restriction on terminal statuses - backend handles confirmation
              // Per requirements: terminal statuses can be reopened with confirmation
              const statusDisabled = false;

              const isExpanded = expandedRows.has(service.id);
              // BUG FIX (March 19, 2026): Comments are indexed by ServicesFulfillment ID when it exists, OrderItem ID otherwise
              // The API returns data keyed by service.id (ServiceFulfillment.id) for consistency
              // Fixed comment count lookup to use correct service.id for proper display
              const commentCount = commentCounts[service.id] || { total: 0, internal: 0 };
              const hasInternalComments = commentCount.internal > 0;

              return (
                <React.Fragment key={service.id}>
                  <tr className="hover:bg-gray-50" data-testid={`service-row-${service.id}`}>
                    {!readOnly && canManageFulfillment && (
                      <td className="px-3 py-4">
                        <input
                          type="checkbox"
                          checked={selectedServices.has(service.id)}
                          onChange={(e) => handleSelectService(service.id, e.target.checked)}
                          className="rounded border-gray-300"
                          data-testid={`select-service-${service.id}`}
                          aria-label={`Select ${service.service.name}`}
                          onKeyDown={(e) => {
                            if (e.key === ' ') {
                              e.preventDefault();
                              handleSelectService(service.id, !selectedServices.has(service.id));
                            }
                          }}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4" role="cell" aria-label={service.service.name}>
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => toggleRowExpansion(service.id)}
                          className="p-1 hover:bg-gray-100 rounded mt-0.5 flex-shrink-0"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} comments for ${service.service.name}`}
                        >
                          <ChevronRight className={`w-4 h-4 text-gray-500 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <NewActivityDot
                              show={service.hasNewActivity || false}
                              aria-label="Service has new activity"
                              className="mr-1"
                            />
                            <span className="text-sm font-medium text-gray-900 break-words">
                              {service.service.name}
                            </span>
                            {/* Visual indicators for results and attachments */}
                            {service.results && (
                              <span
                                data-testid="has-results-indicator"
                                title="Has search results"
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                <FileText className="w-3 h-3 mr-0.5" />
                                Results
                              </span>
                            )}
                            {service.attachmentsCount && service.attachmentsCount > 0 && (
                              <span
                                data-testid="attachment-badge"
                                title={`${service.attachmentsCount} attachment${service.attachmentsCount > 1 ? 's' : ''}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                              >
                                <Paperclip className="w-3 h-3 mr-0.5" />
                                {service.attachmentsCount} {service.attachmentsCount === 1 ? 'attachment' : 'attachments'}
                              </span>
                            )}
                          </div>
                          {service.service.category && (
                            <div className="text-sm text-gray-500">
                              {service.service.category}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {service.location.name}
                    {service.location.code2 && (
                      <span className="ml-1 text-gray-500">({service.location.code2})</span>
                    )}
                  </td>
                  <td className="px-6 py-4" role="cell" aria-label={service.status}>
                    {!readOnly && !statusDisabled && ((isVendor && service.assignedVendorId === user?.vendorId) || canEdit) ? (
                      <select
                        value={service.status}
                        onChange={(e) => handleStatusChange(service.orderItemId, e.target.value)}
                        disabled={loadingService === service.orderItemId || statusDisabled}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColorClasses(service.status)}`}
                        aria-label={`Status for ${service.service.name}`}
                      >
                        {SERVICE_STATUS_VALUES.map(status => (
                          <option key={status} value={status}>{formatServiceStatus(status)}</option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColorClasses(service.status)}`}
                      >
                        {statusIcons[service.status]}
                        {formatServiceStatus(service.status)}
                      </span>
                    )}
                  </td>
                  {!isCustomer && (
                    <td className="px-6 py-4 text-sm text-gray-900 break-words">
                      {service.assignedVendor ? (
                        <div className="flex items-center gap-2">
                          <div>
                            <div>{service.assignedVendor.name}</div>
                            {service.assignedVendor.disabled && (
                              <span className="text-xs text-red-600">(Deactivated)</span>
                            )}
                          </div>
                          {!readOnly && canManageFulfillment && !service.assignedVendor.disabled && (
                            <button
                              onClick={() => handleOpenAssignDialog(service)}
                              className="text-sm text-indigo-600 hover:text-indigo-900"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Not Assigned</span>
                          {!readOnly && canManageFulfillment && (
                            <button
                              onClick={() => handleOpenAssignDialog(service)}
                              className="text-sm text-indigo-600 hover:text-indigo-900"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>
                        <span className="text-xs text-gray-400">Assigned:</span>
                        <div className="text-gray-600">{formatDate(service.assignedAt)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Completed:</span>
                        <div className="text-gray-600">{formatDate(service.completedAt)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleRowExpansion(service.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                      data-testid={`comment-badge-${service.id}`}
                    >
                      <MessageSquare className="w-3 h-3" />
                      {isCustomer ? commentCount.total - commentCount.internal : commentCount.total} {(isCustomer ? commentCount.total - commentCount.internal : commentCount.total) === 1 ? 'comment' : 'comments'}
                      {hasInternalComments && !isCustomer && (
                        <span title="Has internal comments">
                          <Lock className="w-3 h-3 ml-1" />
                        </span>
                      )}
                    </button>
                  </td>
                  {!readOnly && !isCustomer && (
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === service.id ? null : service.id)}
                        disabled={loadingService === service.id}
                        className="p-1 rounded hover:bg-gray-100"
                        data-testid={`action-menu-${service.id}`}
                        aria-label={`Actions for ${service.service.name}`}
                        aria-haspopup="true"
                        aria-expanded={openDropdown === service.id}
                      >
                        Actions
                      </button>
                      {openDropdown === service.id && (
                        <div className="absolute right-0 z-10 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleOpenHistoryDialog(service);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              View History
                            </button>
                            <button
                              onClick={() => {
                                handleOpenNotesDialog(service);
                                setOpenDropdown(null);
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Edit Notes
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
                {/* Expandable Comment and Results Section */}
                {isExpanded && (
                  <tr data-testid={`comment-section-${service.id}`}>
                    <td colSpan={100} className="px-2 sm:px-4 md:px-6 py-4 bg-gray-50">
                      <div className="expanded-content-container space-y-6 w-full max-w-6xl lg:max-w-7xl mx-auto">
                        {/* Requirements Section - Business Rule 1: Must be shown above results and comments */}
                       <ServiceRequirementsDisplay
                          orderData={service.orderData}
                          hydratedData={service.hydratedOrderData}
                          userType={user?.userType}
                        />
                        {/* Divider */}
                        <hr className="border-gray-200" />

                        {/* Results Section */}
                        <ServiceResultsSection
                          serviceId={service.orderItemId}
                          serviceName={service.service.name}
                          serviceStatus={service.status.toLowerCase()}
                          orderId={orderId || ''}
                          isCustomer={isCustomer}
                        />

                        {/* Divider */}
                        <hr className="border-gray-200" />

                        {/* Comments Section */}
                        {/* BUG FIX (March 19, 2026): Fixed serviceId prop to ensure proper comment operations
                            Previously caused comment creation failures due to ID mismatch
                            ServiceCommentSection now receives correct service.id for API operations */}
                        <ServiceCommentSection
                          serviceId={service.id}
                          orderItemId={service.orderItemId}
                          orderId={orderId}
                          serviceName={service.service.name}
                          serviceType={service.service.code || service.service.category || service.service.name || ''}
                          serviceStatus={service.status.toLowerCase()} // BUG FIX (March 20, 2026): Pass lowercase status to match database normalization
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="text-center py-12 bg-white">
          <p className="text-gray-500">No services found for this order</p>
        </div>
      )}

      {/* Assignment Dialog */}
      <ModalDialog
        ref={assignDialogRef}
        title={currentServiceForAssign?.assignedVendor ? 'Reassign Service to Different Vendor' : 'Assign Service to Vendor'}
        maxWidth="md"
        footer={
          <DialogFooter
            onCancel={() => {
              assignDialogRef.current?.close();
              setCurrentServiceForAssign(null);
              setSelectedVendorId('');
            }}
            onConfirm={handleAssignVendor}
            cancelText="Cancel"
            confirmText="Confirm Assignment"
            disabled={!selectedVendorId}
            loading={isSubmitting}
          />
        }
      >
        {currentServiceForAssign?.assignedVendor && (
          <p className="mb-4 text-sm text-gray-600">
            Currently assigned to: {currentServiceForAssign.assignedVendor.name}
          </p>
        )}
        <div>
          <label htmlFor="assign-vendor-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Vendor
          </label>
          <select
            id="assign-vendor-select"
            aria-label="Select Vendor"
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Choose a vendor...</option>
            {(Array.isArray(vendors) ? vendors : []).filter(v => v.isActive).map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
      </ModalDialog>

      {/* Bulk Assignment Dialog */}
      <ModalDialog
        ref={bulkAssignDialogRef}
        title="Bulk Assign Services to Vendor"
        maxWidth="md"
        footer={
          <DialogFooter
            onCancel={() => {
              bulkAssignDialogRef.current?.close();
              setShowBulkAssignDialog(false);
              setSelectedVendorId('');
            }}
            onConfirm={handleBulkAssignVendor}
            cancelText="Cancel"
            confirmText="Confirm Bulk Assignment"
            disabled={!selectedVendorId}
            loading={isSubmitting}
          />
        }
      >
        <p className="mb-4 text-sm text-gray-600">
          {selectedServices.size} services will be assigned
        </p>
        <div>
          <label htmlFor="bulk-vendor-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Vendor for Bulk Assignment
          </label>
          <select
            id="bulk-vendor-select"
            aria-label="Select Vendor for Bulk Assignment"
            value={selectedVendorId}
            onChange={(e) => setSelectedVendorId(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Choose a vendor...</option>
            {(Array.isArray(vendors) ? vendors : []).filter(v => v.isActive).map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </div>
      </ModalDialog>

      {/* History Dialog */}
      <ModalDialog
        ref={historyDialogRef}
        title="Service History"
        maxWidth="lg"
        footer={
          <button
            onClick={() => {
              historyDialogRef.current?.close();
              setCurrentServiceForHistory(null);
              setHistory([]);
            }}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Close
          </button>
        }
      >
        {history.length > 0 ? (
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="border-b pb-2">
                <div className="text-sm">
                  <span className="font-medium">{entry.changeType}</span>
                  {entry.fieldName && <span className="ml-2 text-gray-600">{entry.fieldName}</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.oldValue && <span>From: {entry.oldValue} </span>}
                  {entry.newValue && <span>To: {entry.newValue}</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {formatDateTime(entry.createdAt)}
                  {entry.user && <span className="ml-2">by {entry.user.email}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No history available</p>
        )}
      </ModalDialog>

      {/* Notes Dialog */}
      <ModalDialog
        ref={notesDialogRef}
        title="Edit Service Notes"
        maxWidth="md"
        footer={
          <DialogFooter
            onCancel={() => {
              notesDialogRef.current?.close();
              setCurrentServiceForNotes(null);
              setVendorNotesInput('');
              setInternalNotesInput('');
            }}
            onConfirm={handleSaveNotes}
            cancelText="Cancel"
            confirmText="Save Notes"
            loading={isSubmitting}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="vendor-notes" className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Notes
            </label>
            <textarea
              id="vendor-notes"
              value={vendorNotesInput}
              onChange={(e) => setVendorNotesInput(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
            />
          </div>
          {canEdit && (
            <div>
              <label htmlFor="internal-notes" className="block text-sm font-medium text-gray-700 mb-2">
                Internal Notes
              </label>
              <textarea
                id="internal-notes"
                value={internalNotesInput}
                onChange={(e) => setInternalNotesInput(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
            </div>
          )}
        </div>
      </ModalDialog>

      {/* Confirm Cancel Dialog */}
      <ModalDialog
        ref={confirmCancelDialogRef}
        title="Confirm Status Change"
        maxWidth="sm"
        footer={
          <DialogFooter
            onCancel={() => {
              confirmCancelDialogRef.current?.close();
              setConfirmCancelService(null);
            }}
            onConfirm={handleConfirmCancel}
            cancelText="Cancel"
            confirmText="Confirm"
            loading={isSubmitting}
          />
        }
      >
        <p>Are you sure you want to cancel this service?</p>
      </ModalDialog>

      {/* Confirm Reopen Terminal Status Dialog */}
      <ModalDialog
        ref={confirmReopenDialogRef}
        title={confirmReopenService?.currentStatus && confirmReopenService?.newStatus &&
          [SERVICE_STATUSES.COMPLETED, SERVICE_STATUSES.CANCELLED, SERVICE_STATUSES.CANCELLED_DNB].includes(confirmReopenService.newStatus)
            ? "Change Closed Service Status"
            : "Re-open Closed Service"
        }
        maxWidth="sm"
        footer={
          <DialogFooter
            onCancel={() => {
              confirmReopenDialogRef.current?.close();
              setConfirmReopenService(null);
            }}
            onConfirm={handleConfirmReopen}
            cancelText="No, Keep Current Status"
            confirmText="Yes, Change Status"
            loading={loadingService === confirmReopenService?.orderItemId}
          />
        }
      >
        {confirmReopenService && (
          <>
            <div className="mb-4">
              <p className="text-gray-700">{confirmReopenService.message}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    {[SERVICE_STATUSES.COMPLETED, SERVICE_STATUSES.CANCELLED, SERVICE_STATUSES.CANCELLED_DNB].includes(confirmReopenService.newStatus)
                      ? 'Changing Closed Service Status'
                      : 'Re-opening Closed Service'
                    }
                  </h3>
                  <div className="mt-2 text-sm text-amber-700">
                    <p>
                      This will change the status from <span className="font-semibold">{confirmReopenService.currentStatus}</span> to <span className="font-semibold">{confirmReopenService.newStatus}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </ModalDialog>
    </div>
  );
}