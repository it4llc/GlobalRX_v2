// src/hooks/useRequirementsTable.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import clientLogger from '@/lib/client-logger';
import { Requirement } from '@/types';

interface Location {
  id: string;
  name?: string;
  countryName?: string;
  code2?: string;
  code3?: string;
  twoLetter?: string;
  threeLetter?: string;
  numeric?: string;
  subregion1?: string;
  subregion2?: string;
  subregion3?: string;
  status?: boolean;
  disabled?: boolean;
  parentId?: string;
  children?: Location[];
  expanded?: boolean;
}

interface UseRequirementsTableProps {
  locations: Location[];
  requirements: Requirement[];
  serviceId?: string;
  initialMappings?: Record<string, boolean>;
  initialAvailability?: Record<string, boolean>;
  onMappingChange?: (mappings: Record<string, boolean>) => void;
  onAvailabilityChange?: (availability: Record<string, boolean>) => void;
}

interface UseRequirementsTableReturn {
  // Hierarchy data
  hierarchicalLocations: Location[];
  locationHierarchy: Record<string, string[]>;
  parentMap: Record<string, string>;
  locationsById: Record<string, Location>;
  hierarchyLevels: Record<string, number>;

  // State management
  localMappings: Record<string, boolean>;
  localAvailability: Record<string, boolean>;
  hasUnsavedChanges: boolean;
  expandedRows: Record<string, boolean>;

  // Loading and error states
  isGeneratingHierarchy: boolean;
  error: string | null;

  // Actions
  handleCheckboxChange: (locationId: string, requirementId: string, checked: boolean) => void;
  handleAvailabilityChange: (locationId: string, checked: boolean) => void;
  handleSaveChanges: () => void;
  handleCancelChanges: () => void;

  // Helpers
  isRequirementSelected: (locationId: string, requirementId: string) => boolean;
  isLocationAvailable: (locationId: string) => boolean;
  toggleRowExpansion: (locationId: string) => void;
  hasChildren: (location: Location) => boolean;
}

export function useRequirementsTable({
  locations,
  requirements,
  serviceId,
  initialMappings = {},
  initialAvailability = {},
  onMappingChange,
  onAvailabilityChange,
}: UseRequirementsTableProps): UseRequirementsTableReturn {
  const { fetchWithAuth } = useAuth();

  // Hierarchy state - using refs for immediate access in callbacks
  const [hierarchicalLocations, setHierarchicalLocations] = useState<Location[]>([]);
  const [locationHierarchy, setLocationHierarchy] = useState<Record<string, string[]>>({});
  const [parentMap, setParentMap] = useState<Record<string, string>>({});
  const [locationsById, setLocationsById] = useState<Record<string, Location>>({});
  const [hierarchyLevels, setHierarchyLevels] = useState<Record<string, number>>({});

  // Use refs to avoid stale closures in callbacks
  const locationHierarchyRef = useRef<Record<string, string[]>>({});
  const parentMapRef = useRef<Record<string, string>>({});

  // Component state
  const [localMappings, setLocalMappings] = useState<Record<string, boolean>>(initialMappings);
  const [localAvailability, setLocalAvailability] = useState<Record<string, boolean>>(initialAvailability);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isGeneratingHierarchy, setIsGeneratingHierarchy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track initialization
  const isInitialized = useRef(false);
  const lastServiceId = useRef(serviceId);

  // Initialize state from props when component mounts or serviceId changes
  useEffect(() => {
    if (!serviceId || Object.keys(initialMappings).length === 0) return;

    // If service ID changed, reinitialize the local state
    if (serviceId !== lastServiceId.current) {
      lastServiceId.current = serviceId;
      isInitialized.current = false;
    }

    // Only initialize once per service to prevent overwriting local changes
    if (!isInitialized.current) {
      setLocalMappings({ ...initialMappings });
      setLocalAvailability({ ...initialAvailability });
      isInitialized.current = true;
    }
  }, [serviceId, initialMappings, initialAvailability]);

  // Build location hierarchy
  useEffect(() => {
    if (locations.length === 0) return;

    setIsGeneratingHierarchy(true);

    try {
      clientLogger.info('Processing locations, count:', locations.length);

      // Create ALL location
      const allLocation: Location = {
        id: 'all',
        name: 'ALL',
        code2: 'ALL',
        code3: 'ALL',
        children: []
      };

      const locationsMap = new Map<string, Location>();
      const locationsById: Record<string, Location> = { 'all': allLocation };

      // Only include allLocation in rootLocations
      const rootLocations: Location[] = [allLocation];

      // Track hierarchical relationships
      const hierarchyRelationships: Record<string, string[]> = {
        'all': []
      };

      const newParentMap: Record<string, string> = {};
      const newHierarchyLevels: Record<string, number> = { 'all': 0 };

      // First pass: create all location objects and store in map
      locations.forEach(location => {
        if (!location || !location.id) return; // Skip invalid locations

        // Normalize the location object
        const locationCopy = {
          ...location,
          name: location.name || location.countryName || 'Unknown Location',
          children: []
        };

        locationsMap.set(location.id, locationCopy);
        locationsById[location.id] = locationCopy;
        hierarchyRelationships[location.id] = [];
      });

      // Second pass: build hierarchy and set levels
      locations.forEach(location => {
        if (!location || !location.id) return; // Skip invalid locations

        const locationObj = locationsMap.get(location.id);
        if (!locationObj) return;

        if (location.parentId && locationsMap.has(location.parentId)) {
          // Add to parent's children
          const parent = locationsMap.get(location.parentId);
          if (parent && parent.children) {
            parent.children.push(locationObj);
            hierarchyRelationships[location.parentId].push(location.id);
          }
          newParentMap[location.id] = location.parentId;

          // Set hierarchy level based on parent level
          newHierarchyLevels[location.id] = (newHierarchyLevels[location.parentId] || 0) + 1;
        } else {
          // It's a top-level location, add to ALL
          allLocation.children!.push(locationObj);
          hierarchyRelationships['all'].push(location.id);
          newParentMap[location.id] = 'all';

          // Countries are level 1
          newHierarchyLevels[location.id] = 1;
        }
      });

      // Sort countries alphabetically
      if (allLocation.children && allLocation.children.length > 0) {
        allLocation.children.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
      }

      // Update state and refs
      setHierarchicalLocations(rootLocations);
      setLocationHierarchy(hierarchyRelationships);
      setParentMap(newParentMap);
      setLocationsById(locationsById);
      setHierarchyLevels(newHierarchyLevels);

      // Update refs for immediate access in callbacks
      locationHierarchyRef.current = hierarchyRelationships;
      parentMapRef.current = newParentMap;

      // Pre-expand the "ALL" row
      setExpandedRows(prev => ({
        ...prev,
        'all': true
      }));

    } catch (err) {
      clientLogger.error('Error processing locations:', err);
      setError('Failed to process location data.');
    } finally {
      setIsGeneratingHierarchy(false);
    }
  }, [locations]);

  // Update parent checkboxes when any child changes
  const updateParentCheckboxes = useCallback((locationId: string, requirementId: string, newMappings: Record<string, boolean>) => {
    const parentId = parentMapRef.current[locationId];
    if (!parentId) return newMappings;

    // Check if all children of this parent have the requirement selected
    const childrenIds = locationHierarchyRef.current[parentId] || [];
    const allChildrenChecked = childrenIds.every(childId => {
      const key = `${childId}-${requirementId}`;
      return newMappings[key] === true;
    });

    // Update parent checkbox
    const parentKey = `${parentId}-${requirementId}`;
    const updatedMappings = { ...newMappings };

    if (allChildrenChecked && childrenIds.length > 0) {
      updatedMappings[parentKey] = true;
    } else {
      updatedMappings[parentKey] = false;
    }

    // Recursively update grandparent
    return updateParentCheckboxes(parentId, requirementId, updatedMappings);
  }, []);

  // Update parent availability when any child changes
  const updateParentAvailability = useCallback((locationId: string, newAvailability: Record<string, boolean>) => {
    const parentId = parentMapRef.current[locationId];
    if (!parentId) return newAvailability;

    // Check if all children of this parent are available
    const childrenIds = locationHierarchyRef.current[parentId] || [];
    const allChildrenAvailable = childrenIds.every(childId => newAvailability[childId] === true);

    // Update parent availability
    const updatedAvailability = { ...newAvailability };

    if (allChildrenAvailable && childrenIds.length > 0) {
      updatedAvailability[parentId] = true;
    } else {
      updatedAvailability[parentId] = false;
    }

    // Recursively update grandparent
    return updateParentAvailability(parentId, updatedAvailability);
  }, []);

  // Handle checkbox change with hierarchy propagation
  const handleCheckboxChange = useCallback((locationId: string, requirementId: string, checked: boolean) => {
    setLocalMappings(prevMappings => {
      const key = `${locationId}-${requirementId}`;
      let newMappings = { ...prevMappings };

      // Helper function to recursively update children
      const updateChildrenRecursively = (parentId: string, reqId: string, isChecked: boolean, mappings: Record<string, boolean>) => {
        const childrenIds = locationHierarchyRef.current[parentId] || [];

        childrenIds.forEach(childId => {
          const childKey = `${childId}-${reqId}`;
          mappings[childKey] = isChecked;

          // Recursively update grandchildren
          updateChildrenRecursively(childId, reqId, isChecked, mappings);
        });

        return mappings;
      };

      // Update the clicked checkbox
      newMappings[key] = checked;

      // If this location has children, update them recursively
      newMappings = updateChildrenRecursively(locationId, requirementId, checked, newMappings);

      // Update all parent checkboxes in the hierarchy
      let currentLocationId = locationId;
      while (parentMapRef.current[currentLocationId]) {
        newMappings = updateParentCheckboxes(currentLocationId, requirementId, newMappings);
        currentLocationId = parentMapRef.current[currentLocationId];
      }

      return newMappings;
    });

    setHasUnsavedChanges(true);
  }, [updateParentCheckboxes]);

  // Handle availability change with hierarchy propagation
  const handleAvailabilityChange = useCallback((locationId: string, checked: boolean) => {
    // Build the list of locations to update (including children)
    const locationsToUpdate: string[] = [locationId];

    // Helper to collect all child locations
    const collectChildren = (parentId: string) => {
      const childrenIds = locationHierarchyRef.current[parentId] || [];
      childrenIds.forEach(childId => {
        locationsToUpdate.push(childId);
        collectChildren(childId);
      });
    };

    collectChildren(locationId);

    // Update availability
    setLocalAvailability(prevAvailability => {
      let newAvailability = { ...prevAvailability };

      // Update all affected locations
      locationsToUpdate.forEach(locId => {
        newAvailability[locId] = checked;
      });

      // Update parent availability based on children
      newAvailability = updateParentAvailability(locationId, newAvailability);

      return newAvailability;
    });

    // If making unavailable, also clear all requirements for affected locations
    if (!checked) {
      setLocalMappings(prev => {
        const newMappings = { ...prev };

        locationsToUpdate.forEach(locId => {
          requirements.forEach(req => {
            const key = `${locId}-${req.id}`;
            newMappings[key] = false;
          });
        });

        return newMappings;
      });
    }

    setHasUnsavedChanges(true);
  }, [requirements, updateParentAvailability]);

  // Save changes
  const handleSaveChanges = useCallback(() => {
    clientLogger.info("Saving changes to mappings and availability");

    // Only save if there are changes
    if (hasUnsavedChanges) {
      try {
        // Filter out "all" location from mappings
        const filteredMappings: Record<string, boolean> = {};
        Object.entries(localMappings).forEach(([key, value]) => {
          // Only include mappings that don't involve the 'all' location
          if (!key.startsWith('all-')) {
            filteredMappings[key] = value;
          }
        });

        // Filter out "all" location from availability
        const filteredAvailability: Record<string, boolean> = {};
        Object.entries(localAvailability).forEach(([locationId, value]) => {
          // Don't include the 'all' location
          if (locationId !== 'all') {
            filteredAvailability[locationId] = value;
          }
        });

        clientLogger.info("Saving filtered mappings:", filteredMappings);
        clientLogger.info("Saving filtered availability:", filteredAvailability);

        // Send changes to parent component
        if (onMappingChange) {
          onMappingChange(filteredMappings);
        }

        if (onAvailabilityChange) {
          onAvailabilityChange(filteredAvailability);
        }

        // Mark changes as saved
        setHasUnsavedChanges(false);
      } catch (error: unknown) {
        clientLogger.error("Error saving changes:", error);
        setError("Failed to save changes. Please try again.");
      }
    }
  }, [hasUnsavedChanges, localMappings, localAvailability, onMappingChange, onAvailabilityChange]);

  // Cancel changes and revert to original data
  const handleCancelChanges = useCallback(() => {
    clientLogger.info("Cancelling changes and reverting to original data");
    setLocalMappings({...initialMappings});
    setLocalAvailability({...initialAvailability});
    setHasUnsavedChanges(false);
  }, [initialMappings, initialAvailability]);

  // Check if a requirement is selected for a location
  const isRequirementSelected = useCallback((locationId: string, requirementId: string): boolean => {
    const key = `${locationId}-${requirementId}`;
    return localMappings[key] === true;
  }, [localMappings]);

  // Check if a location is available
  const isLocationAvailable = useCallback((locationId: string): boolean => {
    return localAvailability[locationId] === true;
  }, [localAvailability]);

  // Toggle row expansion
  const toggleRowExpansion = useCallback((locationId: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  }, []);

  // Check if location has children
  const hasChildren = useCallback((location: Location) => {
    return location.children !== undefined && location.children.length > 0;
  }, []);

  return {
    // Hierarchy data
    hierarchicalLocations,
    locationHierarchy,
    parentMap,
    locationsById,
    hierarchyLevels,

    // State management
    localMappings,
    localAvailability,
    hasUnsavedChanges,
    expandedRows,

    // Loading and error states
    isGeneratingHierarchy,
    error,

    // Actions
    handleCheckboxChange,
    handleAvailabilityChange,
    handleSaveChanges,
    handleCancelChanges,

    // Helpers
    isRequirementSelected,
    isLocationAvailable,
    toggleRowExpansion,
    hasChildren,
  };
}