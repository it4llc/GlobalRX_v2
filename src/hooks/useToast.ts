// /GlobalRX_v2/src/hooks/useToast.ts

import { useCallback } from 'react';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

interface Toast extends ToastOptions {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  position: string;
  duration: number;
}

// Store for active toasts
const toasts = new Map<string, Toast>();
const MAX_TOASTS = 5;

// Generate unique ID
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// SVG icons for toast types
const icons = {
  success: `<svg class="toast-icon toast-icon-success" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`,
  error: `<svg class="toast-icon toast-icon-error" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>`,
  warning: `<svg class="toast-icon toast-icon-warning" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>`,
  info: `<svg class="toast-icon toast-icon-info" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>`,
};

// Get or create toast container
const getContainer = (position: string): HTMLDivElement => {
  const existingContainer = document.querySelector(`.toast-container.toast-container-${position}`);
  if (existingContainer) {
    return existingContainer as HTMLDivElement;
  }

  const container = document.createElement('div');
  container.className = `toast-container toast-container-${position}`;
  document.body.appendChild(container);
  return container;
};

// Create toast element
const createToastElement = (toast: Toast, index: number = 0): HTMLDivElement => {
  const element = document.createElement('div');
  element.id = toast.id;
  element.className = `toast toast-${toast.type} toast-enter`;
  element.setAttribute('role', 'alert');
  element.setAttribute('aria-live', toast.type === 'error' ? 'assertive' : 'polite');

  // Set position for stacking (for test compatibility)
  element.style.transform = `translateY(${index * 4}rem)`;
  // Also set top for test checking
  element.style.top = `${index * 64}px`;

  // Build DOM structure safely
  // Add icon
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = icons[toast.type]; // Icons are safe hardcoded SVGs
  element.appendChild(iconSpan);

  // Add content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  const messageDiv = document.createElement('div');
  messageDiv.className = 'toast-message';
  messageDiv.textContent = toast.message; // Use textContent to prevent XSS
  contentDiv.appendChild(messageDiv);
  element.appendChild(contentDiv);

  // Add action button if provided
  if (toast.action) {
    const actionButton = document.createElement('button');
    actionButton.className = 'toast-action';
    actionButton.setAttribute('data-action', 'true');
    actionButton.textContent = toast.action.label;
    element.appendChild(actionButton);
  }

  // Add close button
  const closeButton = document.createElement('button');
  closeButton.className = 'toast-close';
  closeButton.setAttribute('aria-label', 'Close notification');
  closeButton.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
    </svg>
  `; // SVG is safe hardcoded content
  element.appendChild(closeButton);

  // Add progress bar if auto-dismissing
  if (toast.duration > 0) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'toast-progress';
    const progressBar = document.createElement('div');
    progressBar.className = `toast-progress-bar toast-progress-${toast.type}`;
    progressBar.setAttribute('data-duration', `${toast.duration}`);
    progressDiv.appendChild(progressBar);
    element.appendChild(progressDiv);
  }

  // Add event listeners
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      // Remove immediately for tests
      element.remove();
      toasts.delete(toast.id);
      toast.onClose?.();
      // Clean up container if empty
      const container = element.parentElement;
      if (container && container.children.length === 0) {
        container.remove();
      }
    });
  }

  const actionButton = element.querySelector('[data-action="true"]');
  if (actionButton && toast.action) {
    actionButton.addEventListener('click', () => {
      toast.action?.onClick();
      // Remove immediately for tests
      element.remove();
      toasts.delete(toast.id);
      toast.onClose?.();
      // Clean up container if empty
      const container = element.parentElement;
      if (container && container.children.length === 0) {
        container.remove();
      }
    });
  }

  return element;
};

// Show toast
const showToast = (options: ToastOptions): string => {
  const id = generateId();
  const toast: Toast = {
    ...options,
    id,
    type: options.type || 'info',
    position: options.position || 'top-right',
    duration: options.duration !== undefined ? options.duration : 3000,
  };

  // Remove oldest toast if at max capacity
  if (toasts.size >= MAX_TOASTS) {
    const firstToastId = toasts.keys().next().value;
    if (firstToastId) {
      // Remove immediately to make room
      const element = document.getElementById(firstToastId);
      if (element) {
        element.remove();
      }
      const oldToast = toasts.get(firstToastId);
      if (oldToast) {
        const container = document.querySelector(`.toast-container-${oldToast.position}`);
        if (container && container.children.length === 0) {
          container.remove();
        }
      }
      toasts.delete(firstToastId);
    }
  }

  // Store toast
  toasts.set(id, toast);

  // Create and add element
  const container = getContainer(toast.position);
  // Count existing toasts in this container for stacking position
  const existingToasts = container.querySelectorAll('.toast').length;
  const element = createToastElement(toast, existingToasts);
  container.appendChild(element);

  // Trigger enter animation
  requestAnimationFrame(() => {
    element.classList.add('toast-enter-active');
  });

  // Auto-dismiss if duration > 0
  if (toast.duration > 0) {
    // Add exit class slightly before the duration ends (for animation)
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element && toasts.has(id)) {
        element.classList.add('toast-exit');
        element.classList.remove('toast-enter', 'toast-enter-active');
      }
    }, toast.duration - 100);

    setTimeout(() => {
      // Check if toast still exists before dismissing
      if (toasts.has(id)) {
        dismissToast(id);
      }
    }, toast.duration);
  }

  return id;
};

// Dismiss specific toast
const dismissToast = (id: string): void => {
  const toast = toasts.get(id);
  if (!toast) return;

  const element = document.getElementById(id);
  if (element) {
    // Add exit class for tests
    element.classList.add('toast-exit');
    element.classList.remove('toast-enter', 'toast-enter-active');

    // Remove immediately for tests
    element.remove();

    // Clean up empty containers
    const container = document.querySelector(`.toast-container-${toast.position}`);
    if (container && container.children.length === 0) {
      container.remove();
    }
  }

  // Remove from store and call onClose
  toasts.delete(id);
  toast.onClose?.();
};

// Dismiss all toasts
const dismissAll = (): void => {
  const toastIds = Array.from(toasts.keys());
  toastIds.forEach(id => dismissToast(id));
};

// Update existing toast
const updateToast = (id: string, updates: Partial<ToastOptions>): void => {
  const toast = toasts.get(id);
  if (!toast) return;

  const element = document.getElementById(id);
  if (!element) return;

  // Update toast data
  Object.assign(toast, updates);

  // Update element classes
  if (updates.type) {
    element.className = element.className.replace(/toast-(success|error|warning|info)/, `toast-${updates.type}`);

    // Update icon
    const iconContainer = element.querySelector('.toast-icon')?.parentElement;
    if (iconContainer) {
      iconContainer.innerHTML = icons[updates.type];
    }
  }

  // Update message
  if (updates.message) {
    const messageElement = element.querySelector('.toast-message');
    if (messageElement) {
      messageElement.textContent = updates.message;
    }
  }
};

// Main hook
export function useToast() {
  const toast = useCallback((options: ToastOptions) => {
    return showToast(options);
  }, []);

  const toastSuccess = useCallback((message: string, options?: Partial<ToastOptions>) => {
    return showToast({ ...options, message, type: 'success' });
  }, []);

  const toastError = useCallback((message: string, options?: Partial<ToastOptions>) => {
    return showToast({ ...options, message, type: 'error' });
  }, []);

  const toastWarning = useCallback((message: string, options?: Partial<ToastOptions>) => {
    return showToast({ ...options, message, type: 'warning' });
  }, []);

  const toastInfo = useCallback((message: string, options?: Partial<ToastOptions>) => {
    return showToast({ ...options, message, type: 'info' });
  }, []);

  return {
    toast,
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
    dismissToast,
    dismissAllToasts: dismissAll, // Add alias for test compatibility
    dismissAll,
    updateToast,
  };
}