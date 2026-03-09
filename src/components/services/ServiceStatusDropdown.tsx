// /GlobalRX_v2/src/components/services/ServiceStatusDropdown.tsx
// Service status change dropdown component per Phase 2d specification
//
// Key features:
// - Internal users only (Phase 2d)
// - All 7 statuses available with no restrictions
// - Terminal status confirmation dialog
// - Order locking integration
// - Audit trail via ServiceComment

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { DialogFooter } from '@/components/ui/DialogFooter';
import type { DialogRef } from '@/components/ui/ModalDialog';
import { SERVICE_STATUSES, SERVICE_STATUS_VALUES, type ServiceStatus } from '@/constants/service-status';
import {
  TERMINAL_STATUSES,
  formatStatusDisplay,
  getStatusColorClass,
  isTerminalStatus
} from '@/lib/schemas/serviceStatusSchemas';

interface ServiceStatusDropdownProps {
  serviceId: string;
  currentStatus: ServiceStatus;
  onStatusChange?: (newStatus: ServiceStatus) => void;
  disabled?: boolean;
  locked?: boolean;
  lockedBy?: string;
}

export function ServiceStatusDropdown({
  serviceId,
  currentStatus: initialStatus,
  onStatusChange,
  disabled = false,
  locked = false,
  lockedBy
}: ServiceStatusDropdownProps) {
  const [currentStatus, setCurrentStatus] = useState<ServiceStatus>(initialStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ServiceStatus | null>(null);
  const [commentText, setCommentText] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<DialogRef>(null);
  const commentDialogRef = useRef<DialogRef>(null);

  const { toastSuccess, toastError } = useToast();

  // All available status options
  const statusOptions = SERVICE_STATUS_VALUES;

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
    if (!disabled && !isLoading && !locked) {
      setIsOpen(!isOpen);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  const handleStatusSelect = async (newStatus: ServiceStatus) => {
    // Close dropdown immediately
    setIsOpen(false);

    // Don't do anything if selecting the same status
    if (newStatus === currentStatus) {
      return;
    }

    // Check if we're reopening a terminal status
    if (isTerminalStatus(currentStatus)) {
      setPendingStatus(newStatus);
      confirmDialogRef.current?.showModal();
      return;
    }

    // Otherwise, show optional comment dialog
    setPendingStatus(newStatus);
    setCommentText('');
    commentDialogRef.current?.showModal();
  };

  const handleConfirmReopen = () => {
    confirmDialogRef.current?.close();
    if (pendingStatus) {
      setCommentText('');
      commentDialogRef.current?.showModal();
    }
  };

  const handleCancelReopen = () => {
    confirmDialogRef.current?.close();
    setPendingStatus(null);
  };

  const submitStatusChange = async (withComment = false) => {
    if (!pendingStatus) return;

    commentDialogRef.current?.close();
    setIsLoading(true);

    try {
      const payload: any = {
        status: pendingStatus,
      };

      // Add confirmation flag if reopening terminal status
      if (isTerminalStatus(currentStatus)) {
        payload.confirmReopenTerminal = true;
      }

      // Add comment if provided
      if (withComment && commentText.trim()) {
        payload.comment = commentText.trim();
      }

      const response = await fetch(`/api/services/${serviceId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 403) {
          toastError('You do not have permission to change service status');
        } else if (response.status === 423) {
          toastError(`Service is locked by ${data.lockedBy || 'another user'}`);
        } else if (response.status === 404) {
          toastError('Service not found');
        } else {
          toastError(data.error || 'Failed to update service status');
        }
        return;
      }

      // Update local state
      setCurrentStatus(pendingStatus);

      // Call parent callback
      onStatusChange?.(pendingStatus);

      // Show success message
      const message = isTerminalStatus(currentStatus)
        ? `Service reopened and status changed to ${formatStatusDisplay(pendingStatus)}`
        : `Service status changed to ${formatStatusDisplay(pendingStatus)}`;
      toastSuccess(message);

    } catch (error) {
      toastError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
      setPendingStatus(null);
      setCommentText('');
    }
  };

  const handleSkipComment = () => {
    submitStatusChange(false);
  };

  const handleAddComment = () => {
    submitStatusChange(true);
  };

  // Determine if dropdown should be disabled
  const isDisabled = disabled || isLoading || locked;

  return (
    <>
      <div className="service-status-dropdown relative inline-block" ref={dropdownRef}>
        <button
          role="button"
          aria-label={`Service status: ${formatStatusDisplay(currentStatus)}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={isDisabled}
          className={cn(
            'flex items-center justify-between min-w-[150px] px-3 py-1.5 text-sm font-medium rounded-md',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
            getStatusColorClass(currentStatus),
            isDisabled && 'cursor-not-allowed opacity-50',
            locked && 'border-red-300',
            isLoading && 'cursor-wait'
          )}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          data-testid="service-status-dropdown"
          title={locked ? `Locked by ${lockedBy || 'another user'}` : undefined}
        >
          <span>{formatStatusDisplay(currentStatus)}</span>
          {isLoading ? (
            <div
              className="w-4 h-4 ml-2 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"
              data-testid="loading-spinner"
            />
          ) : (
            <ChevronDown
              className={cn('w-4 h-4 ml-2 transition-transform', isOpen && 'rotate-180')}
              data-testid="dropdown-icon"
            />
          )}
        </button>

        {isOpen && !isDisabled && (
          <div
            role="listbox"
            className="absolute z-50 mt-1 min-w-[200px] bg-white rounded-md shadow-lg border border-gray-200"
          >
            <div className="py-1 max-h-60 overflow-auto">
              {statusOptions.map((status, index) => (
                <div
                  key={status}
                  role="option"
                  aria-selected={status === currentStatus}
                  tabIndex={0}
                  className={cn(
                    'px-3 py-2 text-sm cursor-pointer transition-colors',
                    'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                    status === currentStatus && 'bg-gray-100 font-medium'
                  )}
                  onClick={() => handleStatusSelect(status as ServiceStatus)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStatusSelect(status as ServiceStatus);
                    } else if (e.key === 'ArrowDown' && index < statusOptions.length - 1) {
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
                  <span className={cn('inline-block px-2 py-0.5 rounded text-xs', getStatusColorClass(status))}>
                    {formatStatusDisplay(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation dialog for reopening terminal status */}
      <ModalDialog
        ref={confirmDialogRef}
        title="Confirm Status Change"
        footer={
          <DialogFooter
            onCancel={handleCancelReopen}
            onConfirm={handleConfirmReopen}
            confirmText="Yes, Reopen"
            confirmVariant="primary"
          />
        }
      >
        <div className="py-4">
          <p className="text-sm text-gray-700">
            This service is currently <strong>{formatStatusDisplay(currentStatus)}</strong>.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Are you sure you want to re-open it and change the status to{' '}
            <strong>{pendingStatus && formatStatusDisplay(pendingStatus)}</strong>?
          </p>
        </div>
      </ModalDialog>

      {/* Optional comment dialog */}
      <ModalDialog
        ref={commentDialogRef}
        title="Add Comment (Optional)"
        footer={
          <DialogFooter
            onCancel={handleSkipComment}
            onConfirm={handleAddComment}
            cancelText="Skip"
            confirmText="Add Comment"
            confirmVariant="primary"
            disabled={commentText.length > 1000}
          />
        }
      >
        <div className="py-4">
          <p className="text-sm text-gray-700 mb-3">
            Status changing from <strong>{formatStatusDisplay(currentStatus)}</strong> to{' '}
            <strong>{pendingStatus && formatStatusDisplay(pendingStatus)}</strong>
          </p>
          <label htmlFor="status-comment" className="block text-sm font-medium text-gray-700 mb-2">
            Optional comment about this status change:
          </label>
          <textarea
            id="status-comment"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows={3}
            placeholder="Add any context about why the status is changing..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={1000}
          />
          <div className="mt-2 text-right text-xs text-gray-500">
            {commentText.length}/1000 characters
          </div>
        </div>
      </ModalDialog>
    </>
  );
}