import { useState, useCallback } from 'react';
import { OrderRequirements, ServiceItem } from '../types';
import clientLogger from '@/lib/client-logger';

/**
 * Custom hook for managing order requirements
 * Handles fetching requirements based on service+location changes
 * Extracted from the large order form component
 */
export function useOrderRequirements() {
  const [requirements, setRequirements] = useState<OrderRequirements>({
    subjectFields: [],
    searchFields: [],
    documents: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch requirements for a list of service items
   * Triggered when services or locations change
   */
  const fetchRequirements = useCallback(async (serviceItems: ServiceItem[]) => {
    if (serviceItems.length === 0) {
      clientLogger.info('No service items to fetch requirements for');
      setRequirements({ subjectFields: [], searchFields: [], documents: [] });
      return;
    }

    clientLogger.debug('Fetching requirements for service items', {
      serviceItemsCount: serviceItems.length
    });

    setIsLoading(true);
    setError(null);

    try {
      const requestBody = {
        items: serviceItems.map((item: ServiceItem) => ({
          serviceId: item.serviceId,
          locationId: item.locationId,
        })),
      };

      clientLogger.debug('Requirements request body prepared', {
        hasRequestBody: !!requestBody
      });

      const response = await fetch('/api/portal/orders/requirements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      clientLogger.debug('Requirements response received', {
        status: response.status
      });

      if (response.ok) {
        const data = await response.json();
        clientLogger.info('Requirements data received', {
          hasData: !!data,
          subjectFieldsCount: data.subjectFields?.length || 0,
          searchFieldsCount: data.searchFields?.length || 0,
          documentsCount: data.documents?.length || 0
        });
        setRequirements(data);
        return data;
      } else {
        const errorData = await response.text();
        const errorMessage = `Failed to fetch requirements: ${response.status}`;
        clientLogger.error(errorMessage, {
          status: response.status,
          errorData
        });
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching requirements';
      clientLogger.error('Error fetching requirements', {
        error: errorMessage
      });
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch requirements for edit mode with additional field mapping
   */
  const fetchRequirementsForEdit = useCallback(async (
    serviceItems: ServiceItem[],
    editOrderId: string,
    onFieldsLoaded?: (data: OrderRequirements) => void
  ) => {
    try {
      const data = await fetchRequirements(serviceItems);

      // Handle field mapping for edit mode if callback provided
      if (onFieldsLoaded && data) {
        onFieldsLoaded(data);
      }

      return data;
    } catch (error) {
      clientLogger.error('Error fetching requirements for edit mode', {
        editOrderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }, [fetchRequirements]);

  /**
   * Clear requirements (useful when cart is emptied)
   */
  const clearRequirements = useCallback(() => {
    setRequirements({ subjectFields: [], searchFields: [], documents: [] });
    setError(null);
  }, []);

  /**
   * Get requirements for a specific service item
   */
  const getRequirementsForServiceItem = useCallback((serviceId: string, locationId: string) => {
    return {
      searchFields: requirements.searchFields.filter(
        field => field.serviceId === serviceId && field.locationId === locationId
      )
    };
  }, [requirements]);

  /**
   * Check if requirements have been loaded
   */
  const hasRequirements = useCallback(() => {
    return requirements.subjectFields.length > 0 ||
           requirements.searchFields.length > 0 ||
           requirements.documents.length > 0;
  }, [requirements]);

  /**
   * Get summary of requirements
   */
  const getRequirementsSummary = useCallback(() => {
    return {
      subjectFieldsCount: requirements.subjectFields.length,
      searchFieldsCount: requirements.searchFields.length,
      documentsCount: requirements.documents.length,
      requiredSubjectFields: requirements.subjectFields.filter(f => f.required).length,
      requiredSearchFields: requirements.searchFields.filter(f => f.required).length,
      requiredDocuments: requirements.documents.filter(d => d.required).length
    };
  }, [requirements]);

  return {
    requirements,
    isLoading,
    error,
    fetchRequirements,
    fetchRequirementsForEdit,
    clearRequirements,
    getRequirementsForServiceItem,
    hasRequirements,
    getRequirementsSummary
  };
}