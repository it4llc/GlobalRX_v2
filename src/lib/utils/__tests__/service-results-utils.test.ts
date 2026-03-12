// /GlobalRX_v2/src/lib/utils/__tests__/service-results-utils.test.ts

import { describe, it, expect } from 'vitest';

// Define utility functions that will be implemented
const isTerminalServiceStatus = (status: string): boolean => {
  const terminalStatuses = ['completed', 'cancelled'];
  return terminalStatuses.includes(status.toLowerCase());
};

const canEditServiceResults = (
  userType: string,
  permissions: Record<string, any>,
  vendorId?: string,
  serviceVendorId?: string | null
): boolean => {
  // Internal users need fulfillment.edit permission
  if (userType === 'internal' || userType === 'admin') {
    return permissions?.fulfillment?.edit === true || permissions?.fulfillment === '*';
  }

  // Vendors can edit their assigned services
  if (userType === 'vendor' && vendorId && serviceVendorId) {
    return vendorId === serviceVendorId;
  }

  // Customers cannot edit
  if (userType === 'customer') {
    return false;
  }

  return false;
};

const canViewServiceResults = (
  userType: string,
  permissions: Record<string, any>,
  vendorId?: string,
  serviceVendorId?: string | null,
  customerId?: string,
  orderCustomerId?: string
): boolean => {
  // Internal users need fulfillment.view permission
  if (userType === 'internal' || userType === 'admin') {
    return permissions?.fulfillment?.view === true ||
           permissions?.fulfillment?.edit === true ||
           permissions?.fulfillment === '*';
  }

  // Vendors can view their assigned services
  if (userType === 'vendor' && vendorId && serviceVendorId) {
    return vendorId === serviceVendorId;
  }

  // Customers can view their own orders
  if (userType === 'customer' && customerId && orderCustomerId) {
    return customerId === orderCustomerId;
  }

  return false;
};

const sanitizeFileName = (fileName: string): string => {
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  sanitized = sanitized.replace(/[\/\\]/g, '_');

  // Remove special characters that could cause issues
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.split('.').pop() || '';
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    const maxNameLength = 250 - extension.length;
    sanitized = nameWithoutExt.substring(0, maxNameLength) + '.' + extension;
  }

  return sanitized;
};

const generateAttachmentPath = (orderId: string, serviceId: string, fileName: string): string => {
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
  const sanitized = sanitizeFileName(fileName);
  return `uploads/service-results/${orderId}/${serviceId}/${uniqueId}_${sanitized}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const validatePDFFile = (file: { type: string; size: number }): { valid: boolean; error?: string } => {
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'File must be a PDF' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'File size cannot exceed 5MB' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File cannot be empty' };
  }

  return { valid: true };
};

describe('Service Results Utils', () => {
  describe('isTerminalServiceStatus', () => {
    it('should return true for completed status', () => {
      expect(isTerminalServiceStatus('completed')).toBe(true);
      expect(isTerminalServiceStatus('Completed')).toBe(true);
      expect(isTerminalServiceStatus('COMPLETED')).toBe(true);
    });

    it('should return true for cancelled status', () => {
      expect(isTerminalServiceStatus('cancelled')).toBe(true);
      expect(isTerminalServiceStatus('Cancelled')).toBe(true);
      expect(isTerminalServiceStatus('CANCELLED')).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(isTerminalServiceStatus('pending')).toBe(false);
      expect(isTerminalServiceStatus('processing')).toBe(false);
      expect(isTerminalServiceStatus('submitted')).toBe(false);
      expect(isTerminalServiceStatus('in_progress')).toBe(false);
      expect(isTerminalServiceStatus('missing_information')).toBe(false);
    });

    it('should return false for invalid statuses', () => {
      expect(isTerminalServiceStatus('')).toBe(false);
      expect(isTerminalServiceStatus('unknown')).toBe(false);
    });
  });

  describe('canEditServiceResults', () => {
    describe('internal users', () => {
      it('should allow edit with fulfillment.edit permission', () => {
        expect(canEditServiceResults('internal', { fulfillment: { edit: true } })).toBe(true);
      });

      it('should allow edit with fulfillment wildcard permission', () => {
        expect(canEditServiceResults('internal', { fulfillment: '*' })).toBe(true);
      });

      it('should deny edit without fulfillment.edit permission', () => {
        expect(canEditServiceResults('internal', { fulfillment: { view: true } })).toBe(false);
        expect(canEditServiceResults('internal', {})).toBe(false);
      });
    });

    describe('admin users', () => {
      it('should allow edit with fulfillment.edit permission', () => {
        expect(canEditServiceResults('admin', { fulfillment: { edit: true } })).toBe(true);
      });

      it('should allow edit with fulfillment wildcard permission', () => {
        expect(canEditServiceResults('admin', { fulfillment: '*' })).toBe(true);
      });
    });

    describe('vendor users', () => {
      it('should allow edit for assigned service', () => {
        expect(canEditServiceResults('vendor', {}, 'vendor-123', 'vendor-123')).toBe(true);
      });

      it('should deny edit for non-assigned service', () => {
        expect(canEditServiceResults('vendor', {}, 'vendor-123', 'vendor-999')).toBe(false);
      });

      it('should deny edit if service is not assigned to any vendor', () => {
        expect(canEditServiceResults('vendor', {}, 'vendor-123', null)).toBe(false);
      });

      it('should deny edit if vendor ID is missing', () => {
        expect(canEditServiceResults('vendor', {}, undefined, 'vendor-123')).toBe(false);
      });
    });

    describe('customer users', () => {
      it('should always deny edit for customers', () => {
        expect(canEditServiceResults('customer', {})).toBe(false);
        expect(canEditServiceResults('customer', { fulfillment: { edit: true } })).toBe(false);
      });
    });
  });

  describe('canViewServiceResults', () => {
    describe('internal users', () => {
      it('should allow view with fulfillment.view permission', () => {
        expect(canViewServiceResults('internal', { fulfillment: { view: true } })).toBe(true);
      });

      it('should allow view with fulfillment.edit permission', () => {
        expect(canViewServiceResults('internal', { fulfillment: { edit: true } })).toBe(true);
      });

      it('should allow view with fulfillment wildcard permission', () => {
        expect(canViewServiceResults('internal', { fulfillment: '*' })).toBe(true);
      });

      it('should deny view without fulfillment permissions', () => {
        expect(canViewServiceResults('internal', {})).toBe(false);
        expect(canViewServiceResults('internal', { customers: { view: true } })).toBe(false);
      });
    });

    describe('vendor users', () => {
      it('should allow view for assigned service', () => {
        expect(canViewServiceResults('vendor', {}, 'vendor-123', 'vendor-123')).toBe(true);
      });

      it('should deny view for non-assigned service', () => {
        expect(canViewServiceResults('vendor', {}, 'vendor-123', 'vendor-999')).toBe(false);
      });

      it('should deny view if service is not assigned', () => {
        expect(canViewServiceResults('vendor', {}, 'vendor-123', null)).toBe(false);
      });
    });

    describe('customer users', () => {
      it('should allow view for own orders', () => {
        expect(canViewServiceResults('customer', {}, undefined, undefined, 'customer-123', 'customer-123')).toBe(true);
      });

      it('should deny view for other customer orders', () => {
        expect(canViewServiceResults('customer', {}, undefined, undefined, 'customer-123', 'customer-999')).toBe(false);
      });

      it('should deny view if customer ID is missing', () => {
        expect(canViewServiceResults('customer', {}, undefined, undefined, undefined, 'customer-123')).toBe(false);
      });

      it('should deny view if order customer ID is missing', () => {
        expect(canViewServiceResults('customer', {}, undefined, undefined, 'customer-123', undefined)).toBe(false);
      });
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove path traversal attempts', () => {
      expect(sanitizeFileName('../../../etc/passwd.pdf')).toBe('___etc_passwd.pdf');
      expect(sanitizeFileName('..\\..\\windows\\system32\\config.pdf')).toBe('__windows_system32_config.pdf');
    });

    it('should replace slashes with underscores', () => {
      expect(sanitizeFileName('folder/subfolder/file.pdf')).toBe('folder_subfolder_file.pdf');
      expect(sanitizeFileName('folder\\subfolder\\file.pdf')).toBe('folder_subfolder_file.pdf');
    });

    it('should remove special characters', () => {
      expect(sanitizeFileName('file@#$%^&*().pdf')).toBe('file_________.pdf');
      expect(sanitizeFileName('my file (2024).pdf')).toBe('my_file__2024_.pdf');
    });

    it('should preserve allowed characters', () => {
      expect(sanitizeFileName('valid-file_name.123.pdf')).toBe('valid-file_name.123.pdf');
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should handle files without extensions', () => {
      expect(sanitizeFileName('filename')).toBe('filename');
    });
  });

  describe('generateAttachmentPath', () => {
    it('should generate path with correct structure', () => {
      const path = generateAttachmentPath('order-123', 'service-456', 'report.pdf');
      expect(path).toMatch(/^uploads\/service-results\/order-123\/service-456\/[a-z0-9]+_report\.pdf$/);
    });

    it('should generate unique paths for same inputs', () => {
      const path1 = generateAttachmentPath('order-123', 'service-456', 'report.pdf');
      const path2 = generateAttachmentPath('order-123', 'service-456', 'report.pdf');
      expect(path1).not.toBe(path2);
    });

    it('should sanitize filename in path', () => {
      const path = generateAttachmentPath('order-123', 'service-456', '../../../etc/passwd.pdf');
      expect(path).not.toContain('..');
      expect(path).toMatch(/^uploads\/service-results\/order-123\/service-456\/[a-z0-9]+____etc_passwd\.pdf$/);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
      expect(formatFileSize(1023)).toBe('1023 Bytes');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 100)).toBe('100 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
      expect(formatFileSize(1024 * 1024 * 5)).toBe('5 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe('1.5 GB');
    });
  });

  describe('validatePDFFile', () => {
    it('should accept valid PDF files', () => {
      const result = validatePDFFile({ type: 'application/pdf', size: 1024 * 100 });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept PDF at maximum size', () => {
      const result = validatePDFFile({ type: 'application/pdf', size: 5 * 1024 * 1024 });
      expect(result.valid).toBe(true);
    });

    it('should reject non-PDF files', () => {
      const result = validatePDFFile({ type: 'image/jpeg', size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File must be a PDF');
    });

    it('should reject files over 5MB', () => {
      const result = validatePDFFile({ type: 'application/pdf', size: 5 * 1024 * 1024 + 1 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size cannot exceed 5MB');
    });

    it('should reject empty files', () => {
      const result = validatePDFFile({ type: 'application/pdf', size: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File cannot be empty');
    });

    it('should reject Word documents', () => {
      const result = validatePDFFile({ type: 'application/msword', size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File must be a PDF');
    });

    it('should reject text files', () => {
      const result = validatePDFFile({ type: 'text/plain', size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File must be a PDF');
    });
  });
});