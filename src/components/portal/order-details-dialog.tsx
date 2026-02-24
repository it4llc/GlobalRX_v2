'use client';

import { useState, useEffect } from 'react';
import clientLogger from '@/lib/client-logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  subject: any;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
}

const getStatusColor = (statusCode: string): string => {
  switch (statusCode.toLowerCase()) {
    case 'draft':
      return 'bg-gray-100 text-gray-800';
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatStatus = (statusCode: string): string => {
  return statusCode.charAt(0).toUpperCase() + statusCode.slice(1);
};

const formatSubjectName = (subject: any): string => {
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

export default function OrderDetailsDialog({ orderId, open, onClose }: OrderDetailsDialogProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && orderId) {
      fetchOrderDetails();
    }
  }, [open, orderId]);

  const fetchOrderDetails = async () => {
    if (!orderId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/portal/orders/${orderId}`);

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
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(order.statusCode)}`}>
                    {formatStatus(order.statusCode)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>Subject:</strong> {formatSubjectName(order.subject)}</p>
                  <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                  <p><strong>Updated:</strong> {new Date(order.updatedAt).toLocaleString()}</p>
                </div>
              </div>

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