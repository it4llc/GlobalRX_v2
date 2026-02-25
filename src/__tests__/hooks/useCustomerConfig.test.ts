/**
 * Tests for useCustomerConfig hook
 * This hook encapsulates all business logic for customer configuration management
 *
 * Business Rules:
 * 1. Email: Optional, but if provided must be valid format (no domain validation)
 * 2. Required fields: Only customer name is required
 * 3. Account relationships:
 *    - Master account: If not a subaccount, it's its own master
 *    - Billing: Independent (own bill) or through another account
 * 4. Logo upload: Should follow best practices with clear UI requirements
 *    - On create: Save other changes even if logo fails
 *    - On update: Don't save if logo fails, stay in edit mode
 * 5. Data retention: Default to "Delete at Global Rule" unless specified
 * 6. Permissions: All data requires view permission, edit permission for all changes
 * 7. Error handling: Stay in edit mode on failure, highlight failing field
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useCustomerConfig } from '@/hooks/useCustomerConfig';

// Mock dependencies
const mockFetchWithAuth = vi.fn();
const mockCheckPermission = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    checkPermission: mockCheckPermission,
  }),
}));

vi.mock('@/lib/client-logger', () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useCustomerConfig', () => {
  const mockCustomerData = {
    id: 'customer-123',
    name: 'Acme Corporation',
    address: '123 Business St',
    contactName: 'John Doe',
    contactEmail: 'john@acme.com',
    contactPhone: '+1-555-0123',
    masterAccountId: null, // Not a subaccount, so it's its own master
    billingAccountId: null, // Bills independently
    invoiceTerms: 'Net 30',
    invoiceContact: 'billing@acme.com',
    invoiceMethod: 'Email',
    serviceIds: ['service-1', 'service-2'],
    logoUrl: '/logo.png',
    primaryColor: '#1f2937',
    secondaryColor: '#3b82f6',
    accentColor: '#10b981',
    dataRetentionDays: null, // null means "Delete at Global Rule"
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckPermission.mockReturnValue(true);
  });

  describe('loadCustomer', () => {
    it('should fetch and set customer data successfully', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.customer).toEqual(mockCustomerData);
      expect(result.current.error).toBeNull();
    });

    it('should handle 404 error when customer not found', async () => {
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.customer).toBeNull();
      expect(result.current.error).toBe('Customer not found');
    });

    it('should handle permission denied - no customer data visible without permission', async () => {
      mockCheckPermission.mockReturnValue(false);

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.customer).toBeNull();
      expect(result.current.error).toBe('You do not have permission to view customer details');
      expect(mockFetchWithAuth).not.toHaveBeenCalled(); // Should not even try to fetch
    });
  });

  describe('validation', () => {
    it('should validate email format correctly - empty is OK, invalid format is not', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      // Empty email is valid
      expect(result.current.validateEmail('')).toBe(true);
      expect(result.current.validateEmail(null)).toBe(true);
      expect(result.current.validateEmail(undefined)).toBe(true);

      // Valid emails
      expect(result.current.validateEmail('valid@email.com')).toBe(true);
      expect(result.current.validateEmail('user.name+tag@example.co.uk')).toBe(true);

      // Invalid emails (basic format validation only, no domain check)
      expect(result.current.validateEmail('invalid-email')).toBe(false);
      expect(result.current.validateEmail('missing-at.com')).toBe(false);
      expect(result.current.validateEmail('missing-domain@')).toBe(false);
      expect(result.current.validateEmail('@missing-local')).toBe(false);
    });

    it('should validate form - only customer name is required', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const formData = {
        name: '', // Only this should cause validation error
        contactEmail: '', // Empty is OK
        contactPhone: '', // No validation yet
        accountType: 'master' as const,
        billingType: 'independent' as const,
        masterAccountId: '',
        billingAccountId: '',
      };

      const error = result.current.validateForm(formData, 'customer-123');
      expect(error).toBe('Customer name is required');
    });

    it('should validate form and return error for invalid email if provided', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const formData = {
        name: 'Test Company',
        contactEmail: 'invalid-email-format',
        accountType: 'master' as const,
        billingType: 'independent' as const,
        masterAccountId: '',
        billingAccountId: '',
      };

      const error = result.current.validateForm(formData, 'customer-123');
      expect(error).toBe('Invalid email format');
    });

    it('should allow billing through any other account', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const formData = {
        name: 'Test Company',
        contactEmail: 'test@example.com',
        accountType: 'master' as const,
        billingType: 'through_other' as const,
        masterAccountId: '',
        billingAccountId: 'other-customer-456', // Any other account is OK
      };

      const error = result.current.validateForm(formData, 'customer-123');
      expect(error).toBeNull();
    });

    it('should prevent self-referencing for master account', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const formData = {
        name: 'Test Company',
        contactEmail: '',
        accountType: 'subaccount' as const,
        billingType: 'independent' as const,
        masterAccountId: 'customer-123', // Self-reference not allowed
        billingAccountId: '',
      };

      const error = result.current.validateForm(formData, 'customer-123');
      expect(error).toBe('A customer cannot be its own master account');
    });

    it('should prevent self-referencing for billing account', () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const formData = {
        name: 'Test Company',
        contactEmail: '',
        accountType: 'master' as const,
        billingType: 'through_other' as const,
        masterAccountId: '',
        billingAccountId: 'customer-123', // Self-reference not allowed
      };

      const error = result.current.validateForm(formData, 'customer-123');
      expect(error).toBe('A customer cannot be its own billing account');
    });
  });

  describe('data retention handling', () => {
    it('should default to null (Delete at Global Rule) when not specified', async () => {
      const customerWithNoRetention = { ...mockCustomerData, dataRetentionDays: undefined };

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => customerWithNoRetention,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should convert undefined to null for "Delete at Global Rule"
      expect(result.current.formData.dataRetentionDays).toBeNull();
    });

    it('should preserve specific retention days when set', async () => {
      const customerWithRetention = { ...mockCustomerData, dataRetentionDays: 90 };

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => customerWithRetention,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.formData.dataRetentionDays).toBe(90);
    });
  });

  describe('updateCustomer - different behavior for create vs update', () => {
    it('should save other changes even if logo upload fails during CREATE', async () => {
      // No initial fetch for new customer (null ID)
      const { result } = renderHook(() => useCustomerConfig(null)); // null ID for new customer

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Customer creation succeeds
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockCustomerData, id: 'new-customer-456' }),
      });

      // Logo upload fails
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Logo upload failed' }),
      });

      const formData = {
        ...mockCustomerData,
        name: 'New Customer',
        accountType: 'master' as const,
        billingType: 'independent' as const,
      };

      const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' });

      await act(async () => {
        const updateResult = await result.current.updateCustomer(formData, logoFile, true); // isCreate = true
        expect(updateResult.success).toBe(true); // Should still succeed
        expect(updateResult.isInEditMode).toBe(false); // Should exit edit mode
        expect(updateResult.error).toContain('logo upload failed'); // But show logo error
      });
    });

    it('should NOT save and stay in edit mode if logo upload fails during UPDATE', async () => {
      // Initial load - customer exists (update scenario)
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Logo upload fails
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => JSON.stringify({ error: 'Logo upload failed' }),
      });

      const formData = {
        ...mockCustomerData,
        name: 'Updated Customer',
        accountType: 'master' as const,
        billingType: 'independent' as const,
      };

      const logoFile = new File(['logo'], 'logo.png', { type: 'image/png' });

      await act(async () => {
        const updateResult = await result.current.updateCustomer(formData, logoFile, false); // isCreate = false
        expect(updateResult.success).toBe(false); // Should fail
        expect(updateResult.isInEditMode).toBe(true); // Should stay in edit mode
        expect(updateResult.error).toContain('Logo upload failed');
      });

      // Customer should not have been updated
      expect(mockFetchWithAuth).not.toHaveBeenCalledWith(
        '/api/customers/customer-123',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should handle update errors by staying in edit mode', async () => {
      // Initial load
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Update fails
      mockFetchWithAuth.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Database error', field: 'contactEmail' }),
      });

      const formData = {
        ...mockCustomerData,
        name: 'Updated Corp',
        accountType: 'master' as const,
        billingType: 'independent' as const,
      };

      await act(async () => {
        const updateResult = await result.current.updateCustomer(formData, null, false);
        expect(updateResult.success).toBe(false);
        expect(updateResult.isInEditMode).toBe(true); // Stay in edit mode
        expect(updateResult.failingField).toBe('contactEmail'); // Highlight failing field
        expect(updateResult.error).toBe('Database error');
      });
    });
  });

  describe('logo upload requirements', () => {
    it('should validate logo file type', async () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const invalidFile = new File(['content'], 'file.txt', { type: 'text/plain' });

      const validation = result.current.validateLogoFile(invalidFile);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('supported formats');
      expect(validation.error).toContain('JPG, PNG, GIF, SVG'); // Clear requirements in message
    });

    it('should validate logo file size', async () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      // Create a mock file that's too large (over 5MB)
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'logo.png', { type: 'image/png' });

      const validation = result.current.validateLogoFile(largeFile);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('5MB'); // Clear size limit in message
    });

    it('should accept valid logo files', async () => {
      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      const validFiles = [
        new File(['content'], 'logo.png', { type: 'image/png' }),
        new File(['content'], 'logo.jpg', { type: 'image/jpeg' }),
        new File(['content'], 'logo.gif', { type: 'image/gif' }),
        new File(['content'], 'logo.svg', { type: 'image/svg+xml' }),
      ];

      for (const file of validFiles) {
        const validation = result.current.validateLogoFile(file);
        expect(validation.isValid).toBe(true);
        expect(validation.error).toBeNull();
      }
    });
  });

  describe('permissions', () => {
    it('should check view and edit permissions separately', () => {
      mockCheckPermission.mockImplementation((resource, action) => {
        if (resource === 'customers' && action === 'view') return true;
        if (resource === 'customers' && action === 'edit') return false;
        return false;
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      expect(result.current.canView).toBe(true);
      expect(result.current.canEdit).toBe(false);
    });

    it('should allow view-only users to see all customer data including billing', async () => {
      mockCheckPermission.mockImplementation((resource, action) => {
        if (resource === 'customers' && action === 'view') return true;
        if (resource === 'customers' && action === 'edit') return false;
        return false;
      });

      mockFetchWithAuth.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const { result } = renderHook(() => useCustomerConfig('customer-123'));

      await waitFor(() => {
        expect(result.current.customer).toEqual(mockCustomerData);
      });

      // View-only users can see all fields including billing info
      expect(result.current.customer.invoiceTerms).toBe('Net 30');
      expect(result.current.customer.invoiceContact).toBe('billing@acme.com');
      expect(result.current.canEdit).toBe(false);
    });
  });
});