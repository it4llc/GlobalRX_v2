// src/hooks/useRequirementsDataTable.ts
/**
 * Business logic hook for RequirementsDataTable component
 *
 * This hook manages the complex business logic for the requirements matrix table,
 * including location hierarchy building, checkbox propagation, availability management,
 * and state tracking.
 *
 * BUSINESS RULES:
 *
 * 1. Location Hierarchy:
 *    - ALL is always the root node containing all locations
 *    - Supports 5 levels: ALL → Country → Subregion1 → Subregion2 → Subregion3
 *    - Countries are sorted alphabetically for consistent display
 *    - Each location tracks its level in the hierarchy (0-4)
 *
 * 2. Checkbox Propagation for Requirements:
 *    - CHECKING: When a parent is checked, ALL descendants are automatically checked
 *    - UNCHECKING: When a child is unchecked, ALL ancestors up to ALL are unchecked
 *    - This ensures logical consistency (parent can't be "complete" if child isn't)
 *
 * 3. ALL Checkbox Special Logic:
 *    - The ALL checkbox state is PROVIDED by the parent component
 *    - When used in controlled mode, parent manages ALL state computation
 *    - When used standalone, hook computes ALL state based on children
 *    - ALL state is excluded from saved data (managed separately by parent)
 *
 * 4. Location Availability:
 *    - Controls whether requirements can be selected for a location
 *    - When unavailable, requirement checkboxes are disabled but preserve state
 *    - Follows same propagation rules as requirements (cascade to children/parents)
 *    - Used to indicate if a service is offered in that location
 *
 * 5. Requirement Organization:
 *    - Requirements are grouped by type: fields, documents, forms
 *    - Within each type, sorted by displayOrder (ascending)
 *    - Items without displayOrder are placed at end (order value 999)
 *    - Forms are currently disabled in the UI but logic is ready
 *
 * 6. State Management:
 *    - Changes are tracked locally until explicitly saved
 *    - Save filters out ALL location data before persisting
 *    - Cancel reverts all changes to initial state
 *    - hasChanges flag tracks if any modifications were made
 *
 * Key Features:
 * - Builds hierarchical location structure with ALL as root
 * - Manages parent-child checkbox propagation for requirements (standalone mode)
 * - Uses provided state directly in controlled mode
 * - Tracks local changes with save/cancel functionality (standalone mode)
 * - Provides flattened data for virtual scrolling
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Requirement } from '@/types';

// Location type for the table
interface Location {
  id: string;
  name?: string;
  countryName?: string;
  subregion1?: string;
  subregion2?: string;
  subregion3?: string;
  parentId?: string;
  children?: Location[];
  level?: number;
  available?: boolean;
  requirements?: Record<string, boolean>;
}

interface UseRequirementsDataTableProps {
  locations: Location[];
  requirements: Requirement[];
  initialMappings?: Record<string, boolean>;
  initialAvailability?: Record<string, boolean>;
  onMappingChange?: (mappings: Record<string, boolean>) => void;
  onAvailabilityChange?: (availability: Record<string, boolean>) => void;
  disabled?: boolean;
}

interface UseRequirementsDataTableReturn {
  // Hierarchical data
  hierarchicalData: Location[];
  flattenedLocations: Location[];

  // Sorted requirements by type
  sortedFields: Requirement[];
  sortedDocuments: Requirement[];
  sortedForms: Requirement[];

  // State management
  localMappings: Record<string, boolean>;
  localAvailability: Record<string, boolean>;
  hasChanges: boolean;
  expandedState: Record<string, boolean>;

  // Actions
  handleRequirementChange: (locationId: string, requirementId: string, checked: boolean) => void;
  handleAvailabilityChange: (locationId: string, checked: boolean) => void;
  handleSave: () => void;
  handleCancel: () => void;
  setExpandedState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

/**
 * Transform flat locations into hierarchical structure with computed fields
 *
 * BUSINESS LOGIC:
 * - Creates a virtual ALL node as the root of the hierarchy
 * - Organizes locations based on parentId relationships
 * - Computes level for each location (0=ALL, 1=Country, 2=Subregion1, etc.)
 * - Uses provided ALL state directly from mappings and availability parameters
 * - Sorts countries alphabetically for consistent user experience
 * - Preserves requirement selections even for unavailable locations
 *
 * @param locations - Flat array of location objects from the database
 * @param mappings - Record of locationId___requirementId -> boolean for selections
 * @param availability - Record of locationId -> boolean for service availability
 * @returns Hierarchical location tree with ALL as root
 */
export function buildLocationHierarchy(
  locations: Location[],
  mappings: Record<string, boolean>,
  availability: Record<string, boolean>
): Location[] {
  const locationMap = new Map<string, Location>();
  const rootLocations: Location[] = [];

  // Create ALL location
  const allLocation: Location = {
    id: 'all',
    name: 'ALL',
    level: 0,
    children: [],
    available: availability['all'] !== false, // Use the passed-in availability directly
    requirements: {}
  };

  locationMap.set('all', allLocation);
  rootLocations.push(allLocation);

  // First pass: create location objects
  locations.forEach(loc => {
    const location: Location = {
      ...loc,
      name: loc.name || loc.countryName || '',
      children: [],
      level: 0,
      available: availability[loc.id] !== false,
      requirements: {}
    };
    locationMap.set(loc.id, location);
  });

  // Second pass: build hierarchy
  locations.forEach(loc => {
    const location = locationMap.get(loc.id);
    if (!location) return;

    if (loc.parentId && locationMap.has(loc.parentId)) {
      const parent = locationMap.get(loc.parentId);
      if (parent) {
        parent.children!.push(location);
        location.level = (parent.level || 0) + 1;
      }
    } else {
      allLocation.children!.push(location);
      location.level = 1;
    }
  });

  // Add requirement mappings
  Object.entries(mappings).forEach(([key, value]) => {
    const [locationId, requirementId] = key.split('___');
    const location = locationMap.get(locationId);
    if (location && location.requirements) {
      location.requirements[requirementId] = value;
    }
  });


  // Update the ALL location's requirements based on passed-in mappings
  if (allLocation.requirements) {
    // Get all unique requirement IDs from mappings
    const requirementIds = new Set<string>();
    Object.keys(mappings).forEach(key => {
      const [locationId, requirementId] = key.split('___');
      if (requirementId) {
        requirementIds.add(requirementId);
      }
    });

    // For each requirement, use the passed-in mapping for ALL
    requirementIds.forEach(requirementId => {
      const allKey = `all___${requirementId}`;
      allLocation.requirements[requirementId] = mappings[allKey] === true;
    });
  }

  // Sort countries alphabetically
  allLocation.children?.sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  return rootLocations;
}

/**
 * Flatten hierarchical structure for table display
 */
function flattenLocations(locations: Location[], expanded: Record<string, boolean>): Location[] {
  const result: Location[] = [];

  function traverse(location: Location, parentExpanded: boolean = true) {
    if (parentExpanded) {
      result.push(location);
    }

    const isExpanded = expanded[location.id];
    if (location.children && parentExpanded && isExpanded) {
      location.children.forEach(child => traverse(child, true));
    }
  }

  locations.forEach(loc => traverse(loc));
  return result;
}

export function useRequirementsDataTable({
  locations,
  requirements,
  initialMappings = {},
  initialAvailability = {},
  onMappingChange,
  onAvailabilityChange,
  disabled = false,
}: UseRequirementsDataTableProps): UseRequirementsDataTableReturn {
  // State management
  const [localMappings, setLocalMappings] = useState(initialMappings);
  const [localAvailability, setLocalAvailability] = useState(initialAvailability);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({ 'all': true });

  // Separate and sort requirements by type
  const sortedFields = useMemo(() => {
    const fields = requirements.filter(r => r.type === 'field');
    return fields.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
  }, [requirements]);

  const sortedDocuments = useMemo(() => {
    const documents = requirements.filter(r => r.type === 'document');
    return documents.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
  }, [requirements]);

  const sortedForms = useMemo(() => {
    const forms = requirements.filter(r => r.type === 'form');
    return forms.sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });
  }, [requirements]);

  // Build hierarchical data
  const hierarchicalData = useMemo(() => {
    return buildLocationHierarchy(locations, localMappings, localAvailability);
  }, [locations, localMappings, localAvailability]);

  // Flatten locations based on expansion state
  const flattenedLocations = useMemo(() => {
    return flattenLocations(hierarchicalData, expandedState);
  }, [hierarchicalData, expandedState]);

  // Handle requirement checkbox changes
  const handleRequirementChange = useCallback((locationId: string, requirementId: string, checked: boolean) => {
    if (disabled) return;

    const newMappings = { ...localMappings };

    // Build a location map for easy parent lookup
    const locationMap = new Map<string, Location>();
    const buildLocationMap = (locs: Location[]) => {
      locs.forEach(loc => {
        locationMap.set(loc.id, loc);
        if (loc.children) buildLocationMap(loc.children);
      });
    };
    buildLocationMap(hierarchicalData);

    // Update this location and all children
    const updateChildren = (locId: string, value: boolean) => {
      newMappings[`${locId}___${requirementId}`] = value;
      const location = locationMap.get(locId);
      if (location?.children) {
        location.children.forEach(child => updateChildren(child.id, value));
      }
    };

    // If unchecking, also uncheck all parents up the chain
    const updateParents = (locId: string) => {
      const location = locationMap.get(locId);
      if (location?.parentId) {
        newMappings[`${location.parentId}___${requirementId}`] = false;
        updateParents(location.parentId);
      }
      // Also check if this is under "all"
      if (locId !== 'all') {
        // Find if this location is directly under ALL
        const all = locationMap.get('all');
        if (all?.children?.some(c => c.id === locId)) {
          newMappings[`all___${requirementId}`] = false;
        }
      }
    };

    // Apply the updates
    updateChildren(locationId, checked);
    if (!checked) {
      updateParents(locationId);
      // If this is directly under ALL, uncheck ALL too
      if (locationId !== 'all') {
        newMappings[`all___${requirementId}`] = false;
      }
    }

    setLocalMappings(newMappings);
    setHasChanges(true);
  }, [disabled, localMappings, hierarchicalData]);

  // Handle availability checkbox changes
  const handleAvailabilityChange = useCallback((locationId: string, checked: boolean) => {
    if (disabled) return;

    const newAvailability = { ...localAvailability };

    // Build a location map for easy parent lookup
    const locationMap = new Map<string, Location>();
    const buildLocationMap = (locs: Location[]) => {
      locs.forEach(loc => {
        locationMap.set(loc.id, loc);
        if (loc.children) buildLocationMap(loc.children);
      });
    };
    buildLocationMap(hierarchicalData);

    // Update this location and all children
    const updateChildren = (locId: string, value: boolean) => {
      newAvailability[locId] = value;
      const location = locationMap.get(locId);
      if (location?.children) {
        location.children.forEach(child => updateChildren(child.id, value));
      }
    };

    // If unchecking, also uncheck all parents up the chain
    const updateParents = (locId: string) => {
      const location = locationMap.get(locId);
      if (location?.parentId) {
        newAvailability[location.parentId] = false;
        updateParents(location.parentId);
      }
      // Also check if this is under "all"
      if (locId !== 'all') {
        // Find if this location is directly under ALL
        const all = locationMap.get('all');
        if (all?.children?.some(c => c.id === locId)) {
          newAvailability['all'] = false;
        }
      }
    };

    // Apply the updates
    updateChildren(locationId, checked);
    if (!checked) {
      updateParents(locationId);
      // If this is directly under ALL, uncheck ALL too
      if (locationId !== 'all') {
        newAvailability['all'] = false;
      }
    }

    setLocalAvailability(newAvailability);
    setHasChanges(true);
  }, [disabled, localAvailability, hierarchicalData]);

  // Handle save
  const handleSave = useCallback(() => {
    if (onMappingChange) {
      // Filter out 'all' location mappings
      const filtered = Object.fromEntries(
        Object.entries(localMappings).filter(([key]) => !key.startsWith('all___'))
      );
      onMappingChange(filtered);
    }
    if (onAvailabilityChange) {
      // Filter out 'all' location
      const filtered = Object.fromEntries(
        Object.entries(localAvailability).filter(([key]) => key !== 'all')
      );
      onAvailabilityChange(filtered);
    }
    setHasChanges(false);
  }, [localMappings, localAvailability, onMappingChange, onAvailabilityChange]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setLocalMappings(initialMappings);
    setLocalAvailability(initialAvailability);
    setHasChanges(false);
  }, [initialMappings, initialAvailability]);

  // Update local state when props change
  useEffect(() => {
    setLocalMappings(initialMappings);
    setLocalAvailability(initialAvailability);
  }, [initialMappings, initialAvailability]);

  return {
    // Hierarchical data
    hierarchicalData,
    flattenedLocations,

    // Sorted requirements
    sortedFields,
    sortedDocuments,
    sortedForms,

    // State management
    localMappings,
    localAvailability,
    hasChanges,
    expandedState,

    // Actions
    handleRequirementChange,
    handleAvailabilityChange,
    handleSave,
    handleCancel,
    setExpandedState,
  };
}