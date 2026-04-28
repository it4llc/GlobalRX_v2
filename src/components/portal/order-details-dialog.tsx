// /GlobalRX_v2/src/components/portal/order-details-dialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { SubjectInfo } from '@/components/portal/orders/types';
import clientLogger, { errorToLogMeta } from '@/lib/client-logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getOrderStatusColorClasses } from '@/lib/status-colors';
import { InvitationStatusSection } from '@/components/portal/order-details/InvitationStatusSection';
import { InvitationStatusDisplay } from '@/types/invitation-management';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { format } from 'date-fns';

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

interface OrderDetails {
  id: string;
  orderNumber: string;
  statusCode: string;
  subject: SubjectInfo | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  candidateInvitations?: InvitationStatusDisplay[];
  statusHistory?: Array<{
    id: string;
    fromStatus?: string;
    toStatus?: string;
    eventType?: string;
    message?: string;
    createdAt: Date | string;
    user?: {
      firstName?: string;
      lastName?: string;
      email: string;
    };
    notes?: string | null;
  }>;
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  isInternalUser?: boolean; // Flag to determine which endpoint to use
}


const formatStatus = (statusCode: string): string => {
  return statusCode
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Format timestamp
const formatTimestamp = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MM/dd/yyyy hh:mm a');
  } catch (error) {
    return '--';
  }
};

// Format user name
const formatUserName = (user?: { firstName?: string; lastName?: string; email: string }, unknownText?: string): string => {
  if (!user) return unknownText || 'Unknown';
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) return user.firstName;
  if (user.lastName) return user.lastName;
  return user.email;
};

const formatSubjectName = (subject: SubjectInfo | null): string => {
  if (!subject) return 'No subject';

  const firstName = subject.firstName ||
                  subject['First Name'] ||
                  subject['first_name'];

  const lastName = subject.lastName ||
                 subject['Last Name'] ||
                 subject['Surname/Last Name'] ||
                 subject['surname'] ||
                 subject['last_name'];

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else {
    // Check if we can find any name-like fields
    const nameFields = Object.entries(subject)
      .filter(([key, value]) =>
        value && typeof value === 'string' &&
        (key.toLowerCase().includes('name') ||
         key.toLowerCase().includes('surname'))
      )
      .map(([key, value]) => value);

    return nameFields.length > 0 ? nameFields.join(' ') : 'No subject';
  }
};

export default function OrderDetailsDialog({ orderId, open, onClose, isInternalUser = false }: OrderDetailsDialogProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { checkPermission, user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    }
  }, [open, orderId, isInternalUser]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      // BUG FIX: Use different endpoint based on user type to resolve 401 error
      // The issue was that internal users with fulfillment permission were trying
      // to use /api/portal/orders/[id] which only allows customer users, causing
      // a 401 Unauthorized error. Now we route to the correct endpoint:
      // - Internal users → /api/fulfillment/orders/[id] (allows fulfillment permissions)
      // - Customer users → /api/portal/orders/[id] (requires customerId matching)
      const endpoint = isInternalUser
        ? `/api/fulfillment/orders/${orderId}`
        : `/api/portal/orders/${orderId}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }

      const orderData = await response.json();
      setOrder(orderData);
    } catch (err) {
      clientLogger.error('Error fetching order details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrder(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `Order Details - ${order.orderNumber}` : 'Order Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading order details...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchOrderDetails}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : order ? (
            <>
              {/* Order Header */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">{order.orderNumber}</h3>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getOrderStatusColorClasses(order.statusCode)}`}>
                    {formatStatus(order.statusCode)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>Subject:</strong> {formatSubjectName(order.subject)}</p>
                  <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                  <p><strong>Updated:</strong> {new Date(order.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Invitation Status Section */}
              {order.candidateInvitations && order.candidateInvitations.length > 0 && (
                <InvitationStatusSection
                  invitation={order.candidateInvitations[0]}
                  canManageInvitations={isInternalUser || checkPermission('candidates', 'invite')}
                  onActionSuccess={() => {
                    // Refetch order data
                    fetchOrderDetails();
                  }}
                />
              )}

              {/* Status History */}
              {order.statusHistory && order.statusHistory.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Status History</h4>
                  <div className="relative">
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                      {order.statusHistory.map((entry) => (
                      <div key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3">
                        <div className="flex items-center space-x-1">
                          {entry.eventType ? (
                            <>
                              <span className="font-medium">{t(`invitation.event.${entry.eventType.replace('invitation_', '')}`)}</span>
                              {entry.message && <span className="text-gray-600 ml-1">- {entry.message}</span>}
                            </>
                          ) : (
                            <>
                              <span className="font-medium">{formatStatus(entry.fromStatus || '')}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium">{formatStatus(entry.toStatus || '')}</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {entry.user && <span>Changed by {formatUserName(entry.user, 'Unknown')}</span>}
                          <div>{formatTimestamp(entry.createdAt)}</div>
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-gray-600 mt-1 italic">{entry.notes}</div>
                        )}
                      </div>
                    ))}
                    </div>
                    {/* Visual indicator for scrollable content */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
                  </div>
                </div>
              )}

              {/* Subject Details */}
              {order.subject && Object.keys(order.subject).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Subject Information</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(() => {
                        // Define logical field order with clean labels (backend now provides normalized data)
                        const fieldOrder = [
                          // Name fields first
                          { key: 'firstName', label: 'First Name' },
                          { key: 'middleName', label: 'Middle Name' },
                          { key: 'lastName', label: 'Last Name' },

                          // Personal information
                          { key: 'dateOfBirth', label: 'Date of Birth' },
                          { key: 'gender', label: 'Gender' },
                          { key: 'age', label: 'Age' },

                          // Contact information
                          { key: 'email', label: 'Email' },
                          { key: 'phone', label: 'Phone' },

                          // Address information (backend resolves IDs to readable strings)
                          { key: 'address', label: 'Address' },
                          { key: 'city', label: 'City' },
                          { key: 'state', label: 'State/Province' },
                          { key: 'postalCode', label: 'Postal Code' },
                          { key: 'country', label: 'Country' },
                        ];

                        const displayedKeys = new Set<string>();
                        const fields: Array<{ key: string; value: string; label: string }> = [];

                        // First, display fields in logical order
                        fieldOrder.forEach(({ key, label }) => {
                          if (order.subject[key] && !displayedKeys.has(key)) {
                            const value = String(order.subject[key]).trim();
                            if (value) {
                              fields.push({ key, value, label });
                              displayedKeys.add(key);
                            }
                          }
                        });

                        // Then add any remaining fields
                        Object.entries(order.subject).forEach(([key, value]) => {
                          if (!displayedKeys.has(key) && value) {
                            const displayValue = String(value).trim();
                            if (displayValue) {
                              // Create a readable label from the key
                              const label = key.charAt(0).toUpperCase() + key.slice(1)
                                .replace(/([A-Z])/g, ' $1')
                                .trim();
                              fields.push({ key, value: displayValue, label });
                              displayedKeys.add(key);
                            }
                          }
                        });

                        return fields.map(({ key, value, label }) => {
                          // Special handling for address field to show with line breaks
                          if (key === 'address') {
                            return (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-gray-700">{label}:</span>
                                <div className="text-gray-900 mt-1">
                                  {value.split(',').map((line, index) => (
                                    <div key={index}>{line.trim()}</div>
                                  ))}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-gray-700">{label}:</span>{' '}
                              <span className="text-gray-900">{value}</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-semibold mb-3">Services & Locations</h4>
                {order.items.length > 0 ? (
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h5 className="font-medium text-gray-900">{item.service.name}</h5>
                            <p className="text-sm text-blue-600">{item.location.name}</p>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Item {index + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No services assigned to this order.</p>
                )}
              </div>

              {/* Notes */}
              {order.notes && (
                <div>
                  <h4 className="font-semibold mb-3">Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{order.notes}</p>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}