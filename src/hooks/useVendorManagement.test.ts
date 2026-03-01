// /GlobalRX_v2/src/hooks/useVendorManagement.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useVendorManagement } from './useVendorManagement';

// Mock fetch
global.fetch = vi.fn();

describe('useVendorManagement Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchVendors', () => {
    it('should fetch and return vendors list', async () => {
      const mockVendors = [
        { id: '1', name: 'Vendor 1', isActive: true, isPrimary: false },
        { id: '2', name: 'Vendor 2', isActive: true, isPrimary: true }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVendors
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      // Initially loading should be false
      expect(result.current.loading).toBe(false);
      expect(result.current.vendors).toEqual([]);

      // Fetch vendors
      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      expect(result.current.vendors).toEqual(mockVendors);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state during fetch', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => []
          } as Response), 100)
        )
      );

      const { result } = renderHook(() => useVendorManagement());

      // Start fetch and wait for state update
      let fetchPromise: Promise<void>;
      act(() => {
        fetchPromise = result.current.fetchVendors();
      });

      // Should be loading after state update
      expect(result.current.loading).toBe(true);

      await waitFor(() => fetchPromise!);

      // Should not be loading anymore
      expect(result.current.loading).toBe(false);
    });

    it('should handle fetch errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      expect(result.current.error).toBe('Failed to fetch vendors');
      expect(result.current.loading).toBe(false);
      expect(result.current.vendors).toEqual([]);
    });

    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('should support query parameters', async () => {
      const mockVendors = [
        { id: '1', name: 'Active Vendor', isActive: true }
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVendors
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.fetchVendors({ active: true, primary: false });
      });

      expect(fetch).toHaveBeenCalledWith('/api/vendors?active=true&primary=false');
      expect(result.current.vendors).toEqual(mockVendors);
    });
  });

  describe('createVendor', () => {
    it('should create vendor and refresh list', async () => {
      const newVendor = {
        name: 'New Vendor',
        code: 'NV',
        contactEmail: 'new@vendor.com',
        contactPhone: '555-0000',
        isActive: true,
        isPrimary: false
      };

      const createdVendor = {
        id: 'new-vendor',
        ...newVendor
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => createdVendor
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [createdVendor]
        } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        const created = await result.current.createVendor(newVendor);
        expect(created).toEqual(createdVendor);
      });

      // Should have called POST and then GET to refresh
      expect(fetch).toHaveBeenCalledWith('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendor)
      });

      expect(fetch).toHaveBeenCalledWith('/api/vendors');
      expect(result.current.vendors).toEqual([createdVendor]);
    });

    it('should handle creation errors', async () => {
      const newVendor = {
        name: 'Existing Vendor',
        contactEmail: 'new@vendor.com',
        contactPhone: '555-0000',
        isActive: true,
        isPrimary: false
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Vendor name already exists' })
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      let thrownError: Error | null = null;
      await waitFor(async () => {
        try {
          await result.current.createVendor(newVendor);
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe('Vendor name already exists');
      expect(result.current.error).toBe('Vendor name already exists');
    });
  });

  describe('updateVendor', () => {
    it('should update vendor and refresh list', async () => {
      const vendorId = 'vendor-123';
      const updates = {
        name: 'Updated Vendor Name',
        contactEmail: 'updated@vendor.com'
      };

      const updatedVendor = {
        id: vendorId,
        name: 'Updated Vendor Name',
        contactEmail: 'updated@vendor.com'
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedVendor
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [updatedVendor]
        } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        const updated = await result.current.updateVendor(vendorId, updates);
        expect(updated).toEqual(updatedVendor);
      });

      expect(fetch).toHaveBeenCalledWith(`/api/vendors/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      expect(result.current.vendors).toEqual([updatedVendor]);
    });

    it('should handle update errors', async () => {
      const vendorId = 'non-existent';
      const updates = { name: 'New Name' };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Vendor not found' })
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      let thrownError: Error | null = null;
      await waitFor(async () => {
        try {
          await result.current.updateVendor(vendorId, updates);
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe('Vendor not found');
      expect(result.current.error).toBe('Vendor not found');
    });
  });

  describe('deleteVendor', () => {
    it('should delete vendor and refresh list', async () => {
      const vendorId = 'vendor-123';

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Vendor deleted successfully' })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.deleteVendor(vendorId);
      });

      expect(fetch).toHaveBeenCalledWith(`/api/vendors/${vendorId}`, {
        method: 'DELETE'
      });

      expect(result.current.vendors).toEqual([]);
    });

    it('should handle deletion conflicts', async () => {
      const vendorId = 'vendor-with-orders';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Cannot delete vendor with assigned orders' })
      } as Response);

      const { result } = renderHook(() => useVendorManagement());

      let thrownError: Error | null = null;
      await waitFor(async () => {
        try {
          await result.current.deleteVendor(vendorId);
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe('Cannot delete vendor with assigned orders');
      expect(result.current.error).toBe('Cannot delete vendor with assigned orders');
    });
  });

  describe('setPrimaryVendor', () => {
    it('should set vendor as primary and refresh list', async () => {
      const vendorId = 'vendor-123';

      const updatedVendor = {
        id: vendorId,
        name: 'Primary Vendor',
        isPrimary: true
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => updatedVendor
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [updatedVendor]
        } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.setPrimaryVendor(vendorId);
      });

      expect(fetch).toHaveBeenCalledWith(`/api/vendors/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true })
      });
    });

    it('should unset primary status when vendorId is null', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => []
        } as Response);

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.setPrimaryVendor(null);
      });

      // Should call fetchVendors to refresh
      expect(fetch).toHaveBeenCalledWith('/api/vendors');
    });
  });

  describe('getPrimaryVendor', () => {
    it('should return the primary vendor from current list', () => {
      const vendors = [
        { id: '1', name: 'Vendor 1', isPrimary: false },
        { id: '2', name: 'Primary Vendor', isPrimary: true },
        { id: '3', name: 'Vendor 3', isPrimary: false }
      ];

      const { result } = renderHook(() => useVendorManagement());

      // Set vendors in state (this would normally come from fetchVendors)
      result.current.vendors.length = 0;
      result.current.vendors.push(...vendors);

      const primary = result.current.getPrimaryVendor();
      expect(primary).toEqual({ id: '2', name: 'Primary Vendor', isPrimary: true });
    });

    it('should return null when no primary vendor exists', () => {
      const vendors = [
        { id: '1', name: 'Vendor 1', isPrimary: false },
        { id: '2', name: 'Vendor 2', isPrimary: false }
      ];

      const { result } = renderHook(() => useVendorManagement());

      result.current.vendors.length = 0;
      result.current.vendors.push(...vendors);

      const primary = result.current.getPrimaryVendor();
      expect(primary).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should clear errors on successful operations', async () => {
      // Start with an error
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Initial error'));

      const { result } = renderHook(() => useVendorManagement());

      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      expect(result.current.error).toBe('Initial error');

      // Now make a successful call
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response);

      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      expect(result.current.error).toBeNull();
    });

    it('should clear error when clearError is called', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() => useVendorManagement());

      // First create an error by calling fetchVendors with a failing request
      await waitFor(async () => {
        await result.current.fetchVendors();
      });

      // Error should be set
      expect(result.current.error).toBe('Test error');

      // Now clear the error wrapped in act()
      act(() => {
        result.current.clearError();
      });

      // Error should be null
      expect(result.current.error).toBeNull();
    });
  });
});