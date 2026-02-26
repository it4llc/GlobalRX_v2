/**
 * useDsxTab Hook
 *
 * Encapsulates all business logic for DSX (Data & Document Requirement Selection) tab management
 *
 * BUSINESS LOGIC RULES:
 *
 * 1. SERVICE-DRIVEN WORKFLOW:
 *    - User MUST select a service first (entry point)
 *    - Service selection loads ALL system locations (not filtered)
 *    - Service selection loads requirements for that service
 *    - Service selection loads existing DSX configuration
 *
 * 2. REQUIREMENTS MATRIX TABLE STRUCTURE:
 *    - First column: "Available" checkbox for each location
 *    - Remaining columns: Requirements (one per column)
 *    - Rows: ALL locations in the system
 *    - Cells: Checkboxes for requirement selection
 *
 * 3. AVAILABILITY LOGIC:
 *    - "Available" checkbox controls if service is offered in that location
 *    - When checked: Service IS offered in that location
 *    - When unchecked: Service NOT offered (even if requirements are checked)
 *    - CRITICAL: Unchecking "Available" preserves requirement selections
 *    - This allows re-enabling a location without reconfiguring requirements
 *
 * 4. REQUIREMENT SELECTION:
 *    - Each checkbox indicates if a requirement is needed in that location
 *    - Requirements can be selected even if location is unavailable
 *    - Bulk operations supported (select all/none per location or requirement)
 *
 * 5. FIELD ORDER MANAGEMENT:
 *    - Controls display order of requirement columns
 *    - Reordering via up/down buttons or drag-drop
 *    - Order persists per service
 *
 * 6. DATA PERSISTENCE:
 *    - Saves entire matrix configuration for selected service
 *    - Includes availability status for each location
 *    - Includes requirement selections (preserved even if unavailable)
 *    - Includes field order preferences
 *
 * 7. ERROR HANDLING:
 *    - Gracefully handles missing data
 *    - Prevents saves without service selection
 *    - Shows user-friendly error messages
 *    - Maintains UI consistency on errors
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logger from '@/lib/client-logger';

interface Service {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
  type?: string;
  parentId?: string;
}

interface Requirement {
  id: string;
  name: string;
  type?: string;
}

interface DsxConfiguration {
  serviceId?: string;
  locationAvailability?: Record<string, boolean>;
  locationRequirements?: Record<string, string[]>;
  fieldOrder?: string[];
}

export function useDsxTab() {
  // Core state
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [locationRequirements, setLocationRequirements] = useState<Record<string, string[]>>({});
  const [locationAvailability, setLocationAvailability] = useState<Record<string, boolean>>({});
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { fetchWithAuth } = useAuth();

  // Load services on mount
  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await fetchWithAuth('/api/services?includeDisabled=false');
      if (!response.ok) {
        throw new Error('Failed to fetch services');
      }

      const data = await response.json();
      // The API returns { services: [...] } not an array directly
      setServices(data.services || []);
    } catch (err: any) {
      logger.error('Error fetching services:', { error: err });
      setError('Failed to load services');
    }
  };

  const handleServiceSelect = async (serviceId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedService(serviceId);

      // Clear previous data
      setLocations([]);
      setRequirements([]);
      setLocationAvailability({});
      setLocationRequirements({});
      setFieldOrder([]);

      // Load all data for the selected service
      const [locationsResponse, dsxResponse] = await Promise.all([
        fetchWithAuth('/api/locations'),
        fetchWithAuth(`/api/dsx?serviceId=${serviceId}`)
      ]);

      if (!locationsResponse.ok || !dsxResponse.ok) {
        throw new Error('Failed to load service data');
      }

      const locationsData = await locationsResponse.json();
      const dsxData = await dsxResponse.json();

      setLocations(locationsData);

      // The DSX API returns requirements directly
      const requirementsData = dsxData.requirements || [];
      setRequirements(requirementsData);

      // Log for debugging
      logger.info('DSX data received:', {
        requirementsCount: requirementsData.length,
        requirementIds: requirementsData.map((r: any) => r.id)
      });

      // Process mappings to convert from legacy format to our format
      const newLocationRequirements: Record<string, string[]> = {};
      const newLocationAvailability: Record<string, boolean> = {};

      // Convert legacy mappings (locationId___requirementId) to our format
      if (dsxData.mappings) {
        Object.entries(dsxData.mappings).forEach(([key, value]) => {
          const [locationId, requirementId] = key.split('___');
          if (value === true) {
            if (!newLocationRequirements[locationId]) {
              newLocationRequirements[locationId] = [];
            }
            newLocationRequirements[locationId].push(requirementId);
          }
        });
      }

      // Process availability
      if (dsxData.availability) {
        Object.entries(dsxData.availability).forEach(([locationId, value]) => {
          newLocationAvailability[locationId] = value === true;
        });
      }

      setLocationRequirements(newLocationRequirements);
      setLocationAvailability(newLocationAvailability);

      // Set field order
      if (dsxData.fieldOrder && dsxData.fieldOrder.length > 0) {
        setFieldOrder(dsxData.fieldOrder);
      } else {
        // Initialize with default order if no configuration exists
        setFieldOrder(requirementsData.map((req: Requirement) => req.id));
      }
    } catch (err: any) {
      logger.error('Error loading service data:', { error: err });
      setError('Failed to load DSX configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvailabilityToggle = useCallback((locationId: string) => {
    setLocationAvailability(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  }, []);

  const handleSelectAllAvailability = useCallback(() => {
    const newAvailability: Record<string, boolean> = {};
    locations.forEach(location => {
      newAvailability[location.id] = true;
    });
    setLocationAvailability(newAvailability);
  }, [locations]);

  const handleDeselectAllAvailability = useCallback(() => {
    const newAvailability: Record<string, boolean> = {};
    locations.forEach(location => {
      newAvailability[location.id] = false;
    });
    setLocationAvailability(newAvailability);
  }, [locations]);

  const handleRequirementToggle = useCallback((locationId: string, requirementId: string) => {
    setLocationRequirements(prev => {
      const currentRequirements = prev[locationId] || [];
      const isSelected = currentRequirements.includes(requirementId);

      return {
        ...prev,
        [locationId]: isSelected
          ? currentRequirements.filter(id => id !== requirementId)
          : [...currentRequirements, requirementId]
      };
    });
  }, []);

  const handleSelectAllRequirements = useCallback((locationId: string) => {
    setLocationRequirements(prev => ({
      ...prev,
      [locationId]: requirements.map(req => req.id)
    }));
  }, [requirements]);

  const handleDeselectAllRequirements = useCallback((locationId: string) => {
    setLocationRequirements(prev => ({
      ...prev,
      [locationId]: []
    }));
  }, []);

  const handleRequirementToggleAllLocations = useCallback((requirementId: string, selected: boolean) => {
    setLocationRequirements(prev => {
      const newRequirements = { ...prev };

      locations.forEach(location => {
        const currentRequirements = newRequirements[location.id] || [];
        const hasRequirement = currentRequirements.includes(requirementId);

        if (selected && !hasRequirement) {
          newRequirements[location.id] = [...currentRequirements, requirementId];
        } else if (!selected && hasRequirement) {
          newRequirements[location.id] = currentRequirements.filter(id => id !== requirementId);
        }
      });

      return newRequirements;
    });
  }, [locations]);

  const handleFieldReorder = useCallback((requirementId: string, newIndex: number) => {
    setFieldOrder(prev => {
      const currentIndex = prev.indexOf(requirementId);
      if (currentIndex === -1) return prev;

      const newOrder = [...prev];
      newOrder.splice(currentIndex, 1);
      newOrder.splice(newIndex, 0, requirementId);

      return newOrder;
    });
  }, []);

  const handleMoveFieldUp = useCallback((requirementId: string) => {
    setFieldOrder(prev => {
      const currentIndex = prev.indexOf(requirementId);
      if (currentIndex <= 0) return prev;

      const newOrder = [...prev];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];

      return newOrder;
    });
  }, []);

  const handleMoveFieldDown = useCallback((requirementId: string) => {
    setFieldOrder(prev => {
      const currentIndex = prev.indexOf(requirementId);
      if (currentIndex === -1 || currentIndex >= prev.length - 1) return prev;

      const newOrder = [...prev];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];

      return newOrder;
    });
  }, []);

  const handleSave = async () => {
    if (!selectedService) {
      setError('Please select a service first');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Convert our format back to legacy format for the API
      const legacyMappings: Record<string, boolean> = {};
      Object.entries(locationRequirements).forEach(([locationId, reqIds]) => {
        reqIds.forEach(reqId => {
          legacyMappings[`${locationId}___${reqId}`] = true;
        });
      });

      const configData = {
        serviceId: selectedService,
        mappings: legacyMappings,
        availability: locationAvailability
      };

      const response = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save DSX configuration';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Use default error message if response isn't JSON
        }
        throw new Error(errorMessage);
      }

      setSuccessMessage('DSX configuration saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);

    } catch (err: any) {
      logger.error('Error saving DSX configuration:', { error: err });
      if (err.message !== "Session expired") {
        setError('Failed to save DSX configuration');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    selectedService,
    services,
    locations,
    requirements,
    locationRequirements,
    locationAvailability,
    fieldOrder,
    isLoading,
    isSaving,
    error,
    successMessage,
    handleServiceSelect,
    handleAvailabilityToggle,
    handleSelectAllAvailability,
    handleDeselectAllAvailability,
    handleRequirementToggle,
    handleSelectAllRequirements,
    handleDeselectAllRequirements,
    handleRequirementToggleAllLocations,
    handleFieldReorder,
    handleMoveFieldUp,
    handleMoveFieldDown,
    handleSave,
  };
}