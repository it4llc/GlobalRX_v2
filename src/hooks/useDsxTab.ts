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
 *    - ALL state is computed and managed explicitly to ensure UI consistency
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
        requirementIds: requirementsData.map((r: any) => r.id),
        mappingsReceived: !!dsxData.mappings,
        mappingsCount: dsxData.mappings ? Object.keys(dsxData.mappings).length : 0,
        availabilityReceived: !!dsxData.availability,
        availabilityCount: dsxData.availability ? Object.keys(dsxData.availability).length : 0
      });

      // Process mappings to convert from legacy format to our format
      const newLocationRequirements: Record<string, string[]> = {};
      const newLocationAvailability: Record<string, boolean> = {};

      // Convert legacy mappings (locationId___requirementId) to our format
      if (dsxData.mappings) {
        logger.info('Processing mappings:', dsxData.mappings);
        Object.entries(dsxData.mappings).forEach(([key, value]) => {
          const [locationId, requirementId] = key.split('___');
          if (value === true) {
            if (!newLocationRequirements[locationId]) {
              newLocationRequirements[locationId] = [];
            }
            newLocationRequirements[locationId].push(requirementId);
          }
        });
        logger.info('Processed location requirements:', newLocationRequirements);
      } else {
        logger.warn('No mappings data received from API');
      }

      // Process availability
      if (dsxData.availability) {
        Object.entries(dsxData.availability).forEach(([locationId, value]) => {
          newLocationAvailability[locationId] = value === true;
        });
      }


      // Compute and add ALL state explicitly
      const allAvailable = locationsData.length > 0 && locationsData.every((loc: any) => newLocationAvailability[loc.id] !== false);
      newLocationAvailability['all'] = allAvailable;

      // Compute ALL requirements state
      const allLocationRequirements: Record<string, string[]> = { ...newLocationRequirements };
      if (requirementsData.length > 0) {
        const allRequirementIds: string[] = [];
        requirementsData.forEach((req: any) => {
          // Check if ALL locations have this requirement
          const allLocationsHaveReq = locationsData.length > 0 && locationsData.every((loc: any) =>
            newLocationRequirements[loc.id]?.includes(req.id)
          );
          if (allLocationsHaveReq) {
            allRequirementIds.push(req.id);
          }
        });
        allLocationRequirements['all'] = allRequirementIds;
      }

      setLocationRequirements(allLocationRequirements);
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
    if (locationId === 'all') {
      // Special handling for ALL checkbox - determine current UI state
      // The ALL checkbox appears checked when all individual locations are available
      const allCurrentlyChecked = locations.every(loc => locationAvailability[loc.id] !== false);
      const newValue = !allCurrentlyChecked;


      const newAvailability: Record<string, boolean> = { ...locationAvailability };
      locations.forEach(location => {
        newAvailability[location.id] = newValue;
      });
      newAvailability['all'] = newValue; // ALL state matches the new value
      setLocationAvailability(newAvailability);
    } else {
      // Normal single location toggle
      setLocationAvailability(prev => {
        const newAvailability = {
          ...prev,
          [locationId]: !prev[locationId]
        };

        // Update ALL state based on whether all individual locations are now available
        const allLocationsAvailable = locations.every(loc =>
          newAvailability[loc.id] !== false
        );
        newAvailability['all'] = allLocationsAvailable;

        return newAvailability;
      });
    }
  }, [locations, locationAvailability]);

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
      const newRequirements = { ...prev };

      if (locationId === 'all') {
        // Special handling for ALL - toggle requirement for all locations
        const allCurrentlyHave = locations.every(loc =>
          newRequirements[loc.id]?.includes(requirementId)
        );
        const newValue = !allCurrentlyHave;

        locations.forEach(loc => {
          const currentReqs = newRequirements[loc.id] || [];
          if (newValue) {
            // Add requirement to all locations that don't have it
            if (!currentReqs.includes(requirementId)) {
              newRequirements[loc.id] = [...currentReqs, requirementId];
            }
          } else {
            // Remove requirement from all locations
            newRequirements[loc.id] = currentReqs.filter(id => id !== requirementId);
          }
        });

        // Update ALL state
        const allReqs = newRequirements['all'] || [];
        if (newValue) {
          if (!allReqs.includes(requirementId)) {
            newRequirements['all'] = [...allReqs, requirementId];
          }
        } else {
          newRequirements['all'] = allReqs.filter(id => id !== requirementId);
        }
      } else {
        // Normal single location toggle
        const currentRequirements = newRequirements[locationId] || [];
        const isSelected = currentRequirements.includes(requirementId);

        newRequirements[locationId] = isSelected
          ? currentRequirements.filter(id => id !== requirementId)
          : [...currentRequirements, requirementId];

        // Update ALL state based on whether all individual locations now have this requirement
        const allLocationsHaveReq = locations.every(loc =>
          newRequirements[loc.id]?.includes(requirementId)
        );
        const allReqs = newRequirements['all'] || [];
        if (allLocationsHaveReq) {
          if (!allReqs.includes(requirementId)) {
            newRequirements['all'] = [...allReqs, requirementId];
          }
        } else {
          newRequirements['all'] = allReqs.filter(id => id !== requirementId);
        }
      }

      return newRequirements;
    });
  }, [locations]);

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

      // Convert to the format expected by the API: requirementId -> locationIds[]
      const apiMappingsFormat: Record<string, string[]> = {};
      Object.entries(locationRequirements).forEach(([locationId, reqIds]) => {
        reqIds.forEach(reqId => {
          if (!apiMappingsFormat[reqId]) {
            apiMappingsFormat[reqId] = [];
          }
          apiMappingsFormat[reqId].push(locationId);
        });
      });

      logger.info('Saving mappings in API format:', apiMappingsFormat);

      // Save mappings first
      const mappingsData = {
        serviceId: selectedService,
        type: 'mappings',
        data: apiMappingsFormat
      };

      const mappingsResponse = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mappingsData)
      });

      if (!mappingsResponse.ok) {
        const errorData = await mappingsResponse.json();
        throw new Error(errorData.error || 'Failed to save mappings');
      }

      // Save availability second
      const availabilityData = {
        serviceId: selectedService,
        type: 'availability',
        data: locationAvailability
      };

      const availabilityResponse = await fetchWithAuth('/api/dsx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(availabilityData)
      });

      const response = availabilityResponse;

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

      // Refresh the data to show the saved state
      await handleServiceSelect(selectedService);

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