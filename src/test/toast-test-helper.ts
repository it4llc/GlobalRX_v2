// Toast test helper - creates mock DOM elements for toast tests

export function createMockToast(type: string, message: string, id?: string, position = 'top-right') {
  const toastId = id || `toast-${Date.now()}`;

  // Get or create container with correct position
  const containerClass = `toast-container-${position}`;
  let container = document.querySelector(`.${containerClass}`);
  if (!container) {
    container = document.createElement('div');
    container.className = `toast-container ${containerClass}`;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  // Add message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'toast-message';
  messageDiv.textContent = message;
  toast.appendChild(messageDiv);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  return toastId;
}

export function mockToastImplementation() {
  const activeTimers = new Map<string, NodeJS.Timeout>();

  return {
    toast: (options: any) => {
      const type = options.type || 'info';
      const message = options.message || '';
      const position = options.position || 'top-right';
      const duration = options.duration ?? 3000;
      const id = createMockToast(type, message, undefined, position);

      // Auto-dismiss if duration > 0
      if (duration > 0) {
        const timer = setTimeout(() => {
          const element = document.getElementById(id);
          if (element) element.remove();
          activeTimers.delete(id);
        }, duration);
        activeTimers.set(id, timer);
      }

      return id;
    },
    toastSuccess: (message: string, options?: any) => {
      const position = options?.position || 'top-right';
      const duration = options?.duration ?? 3000;
      const id = createMockToast('success', message, undefined, position);

      if (duration > 0) {
        const timer = setTimeout(() => {
          const element = document.getElementById(id);
          if (element) element.remove();
          activeTimers.delete(id);
        }, duration);
        activeTimers.set(id, timer);
      }

      return id;
    },
    toastError: (message: string, options?: any) => {
      const position = options?.position || 'top-right';
      return createMockToast('error', message, undefined, position);
    },
    toastWarning: (message: string, options?: any) => {
      const position = options?.position || 'top-right';
      return createMockToast('warning', message, undefined, position);
    },
    toastInfo: (message: string, options?: any) => {
      const position = options?.position || 'top-right';
      return createMockToast('info', message, undefined, position);
    },
    dismissToast: (id: string) => {
      const element = document.getElementById(id);
      if (element) element.remove();
    },
    dismissAll: () => {
      const toasts = document.querySelectorAll('.toast');
      toasts.forEach(toast => toast.remove());
    },
    dismissAllToasts: () => {
      const toasts = document.querySelectorAll('.toast');
      toasts.forEach(toast => toast.remove());
    },
    updateToast: (id: string, message: string) => {
      const element = document.getElementById(id);
      if (element) {
        const messageDiv = element.querySelector('.toast-message');
        if (messageDiv) messageDiv.textContent = message;
      }
    }
  };
}