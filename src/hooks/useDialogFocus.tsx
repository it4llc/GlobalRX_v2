// src/hooks/useDialogFocus.tsx
"use client";

import { useEffect, useRef } from 'react';

export function useDialogFocus(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      // Store the current active element to restore focus later
      initialFocusRef.current = document.activeElement as HTMLElement;
      
      // Find the first focusable element and focus it
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      }
    }

    return () => {
      // Restore focus when dialog closes
      if (initialFocusRef.current) {
        initialFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  return dialogRef;
}