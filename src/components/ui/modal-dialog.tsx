// /GlobalRX_v2/src/components/ui/modal-dialog.tsx
import React, { forwardRef, useImperativeHandle, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from './button';

// Dialog reference interface
export interface DialogRef {
  showModal: () => void;
  close: () => void;
}

// Modal dialog props
interface ModalDialogProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  open?: boolean;
  onClose?: () => void;
}

// Dialog footer props
interface DialogFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
  disabled?: boolean;
  loading?: boolean;
}

// Modal dialog component
// DUAL CONTROL PATTERN: This component supports both imperative (ref.showModal/close)
// and declarative (open prop) control modes. The bug fix added declarative support
// while maintaining full backward compatibility with existing ref-based usage.
// When open prop is undefined, only ref control works. When open prop is defined,
// it overrides ref control to provide predictable state management.
export const ModalDialog = forwardRef<DialogRef, ModalDialogProps>(
  ({ title, children, footer, maxWidth = 'md', open, onClose }, ref) => {
    const dialogRef = useRef<HTMLDialogElement>(null);

    // Size map for max-width utility classes
    const sizeMap: Record<string, string> = {
      'sm': 'max-w-sm',
      'md': 'max-w-md',
      'lg': 'max-w-lg',
      'xl': 'max-w-xl',
      '2xl': 'max-w-2xl',
      'full': 'max-w-full'
    };

    // Export methods for the ref
    useImperativeHandle(ref, () => ({
      showModal: () => {
        if (dialogRef.current) {
          try {
            dialogRef.current.showModal();
          } catch (error) {
            // showModal() throws error if dialog is already open
            // Ignore this error and continue
          }
        }
      },
      close: () => {
        if (dialogRef.current) {
          dialogRef.current.close();
        }
      }
    }));

    // Declarative control via open prop
    useEffect(() => {
      if (open !== undefined && dialogRef.current) {
        if (open) {
          try {
            dialogRef.current.showModal();
          } catch (error) {
            // showModal() throws error if dialog is already open
            // Ignore this error and continue
          }
        } else {
          dialogRef.current.close();
        }
      }
    }, [open]);

    // Ensure declarative state is maintained when open prop is defined
    useEffect(() => {
      if (open !== undefined && dialogRef.current) {
        // Use setTimeout to ensure this runs after all other effects
        const timeoutId = setTimeout(() => {
          if (!dialogRef.current) return;

          const currentlyOpen = dialogRef.current.hasAttribute('open');

          // If declarative and actual state don't match, fix it
          if (open && !currentlyOpen) {
            try {
              dialogRef.current.showModal();
            } catch (error) {
              // Ignore error if dialog is already open
            }
          } else if (!open && currentlyOpen) {
            dialogRef.current.close();
          }
        }, 0);

        return () => clearTimeout(timeoutId);
      }
    }); // Run after every render to catch any state changes

    // Handle closing the dialog
    const handleClose = () => {
      if (onClose) onClose();
      dialogRef.current?.close();
    };

    return (
      <dialog
        ref={dialogRef}
        className={`p-0 rounded-lg shadow-lg w-[calc(100%-32px)] ${sizeMap[maxWidth] || 'max-w-md'}`}
        aria-labelledby="dialog-title"
      >
        <div>
          {/* Header */}
          <div className="flex justify-between items-center border-b p-4">
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-label="Close dialog"
            >
              X
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t p-4 flex justify-end space-x-2 bg-gray-50">
              {footer}
            </div>
          )}
        </div>
      </dialog>
    );
  }
);

ModalDialog.displayName = 'ModalDialog';

// Dialog footer component
export function DialogFooter({
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  disabled = false,
  loading = false
}: DialogFooterProps) {
  return (
    <>
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={loading}
      >
        {cancelText}
      </Button>
      <Button
        onClick={onConfirm}
        disabled={disabled || loading}
      >
        {loading ? 'Loading...' : confirmText}
      </Button>
    </>
  );
}