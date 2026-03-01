// /GlobalRX_v2/src/hooks/useVendorManagement.ts

import { useState, useCallback } from 'react';
import type { VendorOrganization, CreateVendorOrganization, UpdateVendorOrganization } from '@/lib/schemas/vendorSchemas';

interface VendorQueryParams {
  active?: boolean;
  primary?: boolean;
}

interface UseVendorManagementReturn {
  vendors: VendorOrganization[];
  loading: boolean;
  error: string | null;
  fetchVendors: (params?: VendorQueryParams) => Promise<void>;
  createVendor: (vendor: CreateVendorOrganization) => Promise<VendorOrganization>;
  updateVendor: (id: string, updates: UpdateVendorOrganization) => Promise<VendorOrganization>;
  deleteVendor: (id: string) => Promise<void>;
  setPrimaryVendor: (id: string | null) => Promise<void>;
  getPrimaryVendor: () => VendorOrganization | null;
  clearError: () => void;
}

export function useVendorManagement(): UseVendorManagementReturn {
  const [vendors, setVendors] = useState<VendorOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchVendors = useCallback(async (params?: VendorQueryParams) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (params?.active !== undefined) {
        searchParams.append('active', params.active.toString());
      }
      if (params?.primary !== undefined) {
        searchParams.append('primary', params.primary.toString());
      }

      const url = `/api/vendors${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch vendors');
      }

      const vendorData = await response.json();
      setVendors(vendorData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch vendors';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createVendor = useCallback(async (vendor: CreateVendorOrganization): Promise<VendorOrganization> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vendor)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create vendor');
      }

      const createdVendor = await response.json();

      // Refresh the vendors list
      await fetchVendors();

      return createdVendor;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create vendor';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVendors]);

  const updateVendor = useCallback(async (id: string, updates: UpdateVendorOrganization): Promise<VendorOrganization> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update vendor');
      }

      const updatedVendor = await response.json();

      // Refresh the vendors list
      await fetchVendors();

      return updatedVendor;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update vendor';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVendors]);

  const deleteVendor = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete vendor');
      }

      // Refresh the vendors list
      await fetchVendors();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete vendor';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVendors]);

  const setPrimaryVendor = useCallback(async (id: string | null): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      if (id === null) {
        // If id is null, just refresh (no specific vendor to set as primary)
        await fetchVendors();
        return;
      }

      const response = await fetch(`/api/vendors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPrimary: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set primary vendor');
      }

      // Refresh the vendors list
      await fetchVendors();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set primary vendor';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVendors]);

  const getPrimaryVendor = useCallback((): VendorOrganization | null => {
    return vendors.find(vendor => vendor.isPrimary) || null;
  }, [vendors]);

  return {
    vendors,
    loading,
    error,
    fetchVendors,
    createVendor,
    updateVendor,
    deleteVendor,
    setPrimaryVendor,
    getPrimaryVendor,
    clearError
  };
}