// /GlobalRX_v2/src/components/fulfillment/OrderStatusDropdown.tsx
// Status change dropdown component for fulfillment workflow.
//
// Key features:
// - Unrestricted status changes (Phase 2a business requirement)
// - Success/error toast notifications for user feedback
// - Optimistic UI updates with error rollback
// - Keyboard navigation support for accessibility
// - Loading states to prevent duplicate submissions

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { getOrderStatusBadgeClasses } from '@/lib/status-colors';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_VALUES, type OrderStatus } from '@/lib/schemas/orderStatusSchemas';

export interface StatusOption {
  value: string;
  label: string;
}

interface OrderStatusDropdownProps {
  orderId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  disabled?: boolean;
  options?: StatusOption[];
}

// Map order status values to display labels
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  processing: 'Processing',
  missing_info: 'Missing Information',
  completed: 'Completed',
  cancelled: 'Cancelled',
  cancelled_dnb: 'Cancelled-DNB'
};

// Default status options using the seven standardized order status values
const defaultStatusOptions: StatusOption[] = ORDER_STATUS_VALUES.map(value => ({
  value,
  label: STATUS_LABELS[value] || value
}));

// Format status for display
const formatStatusLabel = (status: string, options: StatusOption[]): string => {
  // Normalize status to lowercase for matching
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');

  // Check if we have a label for this status
  if (STATUS_LABELS[normalizedStatus]) {
    return STATUS_LABELS[normalizedStatus];
  }

  // Check in provided options
  const option = options.find(opt => opt.value === normalizedStatus);
  if (option) return option.label;

  // Fallback formatting
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};


export function OrderStatusDropdown({
  orderId,
  currentStatus: initialStatus,
  onStatusChange,
  disabled = false,
  options = defaultStatusOptions,
}: OrderStatusDropdownProps) {
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toastSuccess, toastError } = useToast();

  // Update current status when prop changes
  useEffect(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled && !isLoading) {
      setIsOpen(!isOpen);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  const handleStatusSelect = async (newStatus: string) => {
    // Close dropdown immediately for responsive UX
    setIsOpen(false);

    // Don't do anything if selecting the same status (no-op)
    if (newStatus === currentStatus) {
      return;
    }

    // Start loading state to prevent duplicate submissions
    setIsLoading(true);

    try {
      const response = await fetch(`/api/fulfillment/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 403) {
          toastError('You do not have permission to update order status');
        } else if (response.status === 404) {
          toastError('Order not found');
        } else if (response.status === 500) {
          toastError('Failed to update order status');
        } else {
          toastError(data.error || 'Failed to update order status');
        }

        // Don't update the UI on error
        return;
      }

      // Update local state
      setCurrentStatus(newStatus);

      // Call parent callback
      onStatusChange?.(newStatus);

      // Show success message
      toastSuccess(data.message || 'Order status updated successfully');
    } catch (error) {
      // Handle network errors
      toastError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="order-status-dropdown relative" ref={dropdownRef}>
      <button
        role="button"
        aria-label={`Order status: ${currentStatus}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled || isLoading}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md border',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
          getOrderStatusBadgeClasses(currentStatus),
          disabled && 'cursor-not-allowed opacity-50',
          isLoading && 'cursor-wait'
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        data-testid="order-status-dropdown"
      >
        <span>{formatStatusLabel(currentStatus, options)}</span>
        {isLoading ? (
          <div
            className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
            data-testid="loading-spinner"
          />
        ) : (
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
            data-testid="dropdown-icon"
          />
        )}
      </button>

      {isOpen && !disabled && !isLoading && (
        <div
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg border border-gray-200"
        >
          <div className="py-1 max-h-60 overflow-auto">
            {options.map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={option.value === currentStatus}
                tabIndex={0}
                className={cn(
                  'px-3 py-2 text-sm cursor-pointer transition-colors dropdown-item',
                  'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                  option.value === currentStatus && 'bg-gray-100 font-medium selected'
                )}
                onClick={() => handleStatusSelect(option.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStatusSelect(option.value);
                  } else if (e.key === 'ArrowDown' && index < options.length - 1) {
                    e.preventDefault();
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                    nextElement?.focus();
                  } else if (e.key === 'ArrowUp' && index > 0) {
                    e.preventDefault();
                    const prevElement = e.currentTarget.previousElementSibling as HTMLElement;
                    prevElement?.focus();
                  }
                }}
                autoFocus={index === 0}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}