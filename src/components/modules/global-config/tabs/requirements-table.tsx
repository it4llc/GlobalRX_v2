// src/components/modules/global-config/tabs/requirements-table.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Requirement } from '@/types';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import styles from '@/styles/tables.module.css';

interface RequirementsTableProps {
  serviceName: string;
  requirements: Requirement[];
  onAddField?: () => void;
  onAddDocument?: () => void;
  onAddForm?: () => void;
  onMappingChange?: (mappings: Record<string, boolean>) => void;
  initialMappings?: Record<string, boolean>;
  serviceId?: string;
  onAvailabilityChange?: (availability: Record<string, boolean>) => void;
  initialAvailability?: Record<string, boolean>;
  isLoading: boolean;
  disabled?: boolean;
  locations?: Location[];
}

// A simplified version of the Location type
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

export function RequirementsTable({
  serviceName,
  requirements,
  onAddField,
  onAddDocument,
  onAddForm,
  onMappingChange,
  initialMappings = {},
  serviceId,
  onAvailabilityChange,
  initialAvailability = {},
  isLoading: isLoadingProp,
  disabled = false,
  locations = [] 
}: RequirementsTableProps) {
  const { fetchWithAuth } = useAuth();
  const [hierarchicalLocations, setHierarchicalLocations] = useState<Location[]>([]);
  const [isGeneratingHierarchy, setIsGeneratingHierarchy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for handling local changes
  const [localMappings, setLocalMappings] = useState<Record<string, boolean>>(initialMappings || {});
  const [localAvailability, setLocalAvailability] = useState<Record<string, boolean>>(initialAvailability || {});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // Track parent-child relationships
  const [locationHierarchy, setLocationHierarchy] = useState<Record<string, string[]>>({});
  const [parentMap, setParentMap] = useState<Record<string, string>>({});
  
  // Maintain a lookup for locations by ID and a separate hierarchy level map
  const [locationsById, setLocationsById] = useState<Record<string, Location>>({});
  const [hierarchyLevels, setHierarchyLevels] = useState<Record<string, number>>({});
  
  // Track if the component has been mounted and initialized
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
      console.log("Initializing local state for service:", serviceId);
      console.log("Initial mappings:", initialMappings);
      console.log("Initial availability:", initialAvailability);
      
      setLocalMappings({...initialMappings});
      setLocalAvailability({...initialAvailability});
      setHasUnsavedChanges(false);
      isInitialized.current = true;
    }
  }, [initialMappings, initialAvailability, serviceId]);

  // Group requirements by type
  const fields = requirements.filter(r => r.type === 'field');
  const documents = requirements.filter(r => r.type === 'document');
  const forms = requirements.filter(r => r.type === 'form');

  // Fetch and process locations to build hierarchy
  useEffect(() => {
    if (locations.length === 0) return;
    
    setIsGeneratingHierarchy(true);
    
    try {
      console.log('Processing locations, count:', locations.length);
      
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
      
      // Update state
      setHierarchicalLocations(rootLocations);
      setLocationHierarchy(hierarchyRelationships);
      setParentMap(newParentMap);
      setLocationsById(locationsById);
      setHierarchyLevels(newHierarchyLevels);
      
      // Pre-expand the "ALL" row
      setExpandedRows(prev => ({
        ...prev,
        'all': true
      }));
      
    } catch (err) {
      console.error('Error processing locations:', err);
      setError('Failed to process location data.');
    } finally {
      setIsGeneratingHierarchy(false);
    }
  }, [locations]);

  // Update parent checkboxes when any child changes
  const updateParentCheckboxes = useCallback((locationId: string, requirementId: string, newMappings: Record<string, boolean>) => {
    let currentParentId = parentMap[locationId];
    
    while (currentParentId) {
      const parentKey = `${currentParentId}___${requirementId}`;
      
      // Get all direct children of this parent
      const directChildren = locationHierarchy[currentParentId] || [];
      
      // Check if ALL direct children are checked
      const allChildrenChecked = directChildren.every(childId => {
        const childKey = `${childId}___${requirementId}`;
        return newMappings[childKey] === true;
      });
      
      // Update parent checkbox state
      newMappings[parentKey] = allChildrenChecked;
      
      // Move up to next parent
      currentParentId = parentMap[currentParentId];
    }
    
    return newMappings;
  }, [parentMap, locationHierarchy]);

  // Update parent availability checkboxes when any child changes
  const updateParentAvailability = useCallback((locationId: string, newAvailability: Record<string, boolean>) => {
    let currentParentId = parentMap[locationId];
    
    while (currentParentId) {
      // Get all direct children of this parent
      const directChildren = locationHierarchy[currentParentId] || [];
      
      // Check if ALL direct children are available
      const allChildrenAvailable = directChildren.every(childId => {
        return newAvailability[childId] !== false;
      });
      
      // Update parent checkbox state
      newAvailability[currentParentId] = allChildrenAvailable;
      
      // Move up to next parent
      currentParentId = parentMap[currentParentId];
    }
    
    return newAvailability;
  }, [parentMap, locationHierarchy]);

  // Handle checkbox change for requirements
  const handleCheckboxChange = useCallback((locationId: string, requirementId: string, checked: boolean) => {
    if (disabled) return; // Skip if disabled
    
    try {
      console.log(`Changing checkbox for ${locationId}-${requirementId} to ${checked}`);
      
      // Create a new mappings object to track changes
      const newMappings = { ...localMappings };
      
      // Create a unique key for this mapping - use '___' as a separator to avoid conflicts with UUIDs
      const key = `${locationId}___${requirementId}`;
      newMappings[key] = checked;
      
      // If checking a location, check all its children recursively
      if (checked) {
        const processChildren = (parentId: string) => {
          const children = locationHierarchy[parentId] || [];
          children.forEach(childId => {
            const childKey = `${childId}___${requirementId}`;
            newMappings[childKey] = true;
            
            // Process child's children recursively
            processChildren(childId);
          });
        };
        
        processChildren(locationId);
      }
      
      // If unchecking a location, uncheck all its children recursively
      if (!checked) {
        const processChildren = (parentId: string) => {
          const children = locationHierarchy[parentId] || [];
          children.forEach(childId => {
            const childKey = `${childId}___${requirementId}`;
            newMappings[childKey] = false;
            
            // Process child's children recursively
            processChildren(childId);
          });
        };
        
        processChildren(locationId);
        
        // Update all parent checkboxes to reflect this change
        updateParentCheckboxes(locationId, requirementId, newMappings);
      }
      
      // Update local state
      setLocalMappings(newMappings);
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error('Error handling checkbox change:', error);
    }
  }, [localMappings, locationHierarchy, updateParentCheckboxes, disabled]);

  // Handle availability checkbox change
  const handleAvailabilityChange = useCallback((locationId: string, checked: boolean) => {
    if (disabled) return; // Skip if disabled
    
    console.log(`Changing availability for ${locationId} to ${checked}`);
    
    // Create a new availability object
    let newAvailability = { ...localAvailability };
    
    // Update this location
    newAvailability[locationId] = checked;
    
    // Process children recursively
    const processChildren = (parentId: string, value: boolean) => {
      const children = locationHierarchy[parentId] || [];
      children.forEach(childId => {
        newAvailability[childId] = value;
        
        // Process child's children recursively
        processChildren(childId, value);
      });
    };
    
    // Apply to all children
    processChildren(locationId, checked);
    
    // If unchecking, update all parent checkboxes
    if (!checked) {
      // Update all parent checkboxes to reflect this change
      newAvailability = updateParentAvailability(locationId, newAvailability);
    }
    
    // Update local state
    setLocalAvailability(newAvailability);
    setHasUnsavedChanges(true);
  }, [localAvailability, locationHierarchy, updateParentAvailability, disabled]);

  // Save changes
  const handleSaveChanges = useCallback(() => {
    console.log("Saving changes to mappings and availability");
    
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
        
        console.log("Saving filtered mappings:", filteredMappings);
        console.log("Saving filtered availability:", filteredAvailability);
        
        // Send changes to parent component
        if (onMappingChange) {
          onMappingChange(filteredMappings);
        }
        
        if (onAvailabilityChange) {
          onAvailabilityChange(filteredAvailability);
        }
        
        // Mark changes as saved
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Error saving changes:", error);
        setError("Failed to save changes. Please try again.");
      }
    }
  }, [hasUnsavedChanges, localMappings, localAvailability, onMappingChange, onAvailabilityChange]);

  // Cancel changes and revert to original data
  const handleCancelChanges = useCallback(() => {
    console.log("Cancelling changes and reverting to original data");
    setLocalMappings({...initialMappings});
    setLocalAvailability({...initialAvailability});
    setHasUnsavedChanges(false);
  }, [initialMappings, initialAvailability]);

  // Check if a requirement is selected for a location
  const isRequirementSelected = useCallback((locationId: string, requirementId: string): boolean => {
    const key = `${locationId}___${requirementId}`;
    return localMappings[key] === true;
  }, [localMappings]);

  // Check if a location is available
  const isLocationAvailable = useCallback((locationId: string): boolean => {
    // Default to true if not explicitly set to false
    return localAvailability[locationId] !== false;
  }, [localAvailability]);

  // Toggle row expansion
  const toggleRowExpansion = useCallback((locationId: string) => {
    setExpandedRows(prevState => ({
      ...prevState,
      [locationId]: !prevState[locationId]
    }));
  }, []);

  // Check if a location has children
  const hasChildren = useCallback((location: Location) => {
    return location.children && location.children.length > 0;
  }, []);

  // Helper function for rendering checkboxes to reduce repetition
  const renderCheckbox = useCallback((locationId: string, requirementId: string, isAvailable: boolean) => {
    return (
      <td key={`requirement-${locationId}-${requirementId}`} className={styles.checkboxCell}>
        <div className={styles.checkboxWrapper}>
          <Checkbox
            id={`${locationId}-${requirementId}`}
            checked={isRequirementSelected(locationId, requirementId)}
            onCheckedChange={(checked) => handleCheckboxChange(locationId, requirementId, checked === true)}
            disabled={!isAvailable || disabled}
            className={!isAvailable ? "opacity-50" : ""}
          />
        </div>
      </td>
    );
  }, [isRequirementSelected, handleCheckboxChange, disabled]);

  // Calculate row data with a completely different approach
  const getTableRows = useCallback(() => {
    const rows: JSX.Element[] = [];
    
    const processLocation = (location: Location, index: number) => {
      const isExpanded = expandedRows[location.id] || false;
      const hasChildLocations = hasChildren(location);
      const isAvailable = isLocationAvailable(location.id);
      const level = hierarchyLevels[location.id] || 0;
      
      // For ALL location
      if (location.id === 'all') {
        rows.push(
          React.createElement(TableRow, {
            key: `location-row-${location.id}`,
            className: "hover:bg-gray-100",
          }, [
            // Country name column - show "ALL"
            React.createElement(TableCell, {
              key: `location-country-${location.id}`,
              className: "sticky-column country-name-column"
            },
              React.createElement('div', { className: "tree-indent" }, [
                hasChildLocations ?
                  React.createElement('button', {
                    key: "toggle-button",
                    type: "button",
                    className: "tree-toggle-button",
                    onClick: () => toggleRowExpansion(location.id),
                    'aria-label': isExpanded ? "Collapse" : "Expand"
                  },
                    isExpanded ?
                      React.createElement(ChevronDown, { className: "tree-toggle-icon" }) :
                      React.createElement(ChevronRight, { className: "tree-toggle-icon" })
                  ) :
                  React.createElement('span', { key: "spacer", className: "tree-toggle-spacer" }),
                React.createElement('span', { key: "name", className: "country-name-text" }, "ALL")
              ])
            ),

            // Empty subregion columns for ALL
            React.createElement(TableCell, { key: `location-subregion1-${location.id}`, className: "sticky-column subregion-column" }, ""),
            React.createElement(TableCell, { key: `location-subregion2-${location.id}`, className: "sticky-column subregion-column" }, ""),
            React.createElement(TableCell, { key: `location-subregion3-${location.id}`, className: "sticky-column subregion-column" }, ""),

            // Available column
            React.createElement(TableCell, {
              key: `location-available-${location.id}`,
              className: "sticky-column available-column checkbox-container"
            },
              React.createElement('div', { className: "checkbox-wrapper" },
                React.createElement(Checkbox, {
                  id: `available-${location.id}`,
                  checked: isAvailable,
                  onCheckedChange: (checked) => handleAvailabilityChange(location.id, checked === true),
                  disabled: disabled
                })
              )
            ),
            
            // Requirement checkboxes
            ...fields.map(field => renderCheckbox(location.id, field.id, isAvailable)),
            ...documents.map(doc => renderCheckbox(location.id, doc.id, isAvailable)),
            ...forms.map(form => renderCheckbox(location.id, form.id, isAvailable))
          ])
        );
        
        // If expanded, process children
        if (isExpanded && hasChildLocations && location.children) {
          location.children.forEach((child, childIndex) => {
            processLocation(child, childIndex);
          });
        }
        
        return;
      }
      
      // Initialize empty content for all columns
      let countryContent = "";
      let subregion1Content = "";
      let subregion2Content = "";
      let subregion3Content = "";
      
      // The key insight: display location name ONLY in the column corresponding to its level
      const locationName = location.name || '';
      
      switch (level) {
        case 1: // Country level - direct children of ALL
          countryContent = locationName;
          break;
        case 2: // State/Province level
          subregion1Content = locationName;
          break;
        case 3: // County/District level
          subregion2Content = locationName;
          break;
        case 4: // City/Local level
          subregion3Content = locationName;
          break;
        default:
          // Fallback - shouldn't happen with proper hierarchy
          if (parentMap[location.id] === 'all') {
            countryContent = locationName;
          } else {
            // This is a safety fallback - if we can't determine the proper level
            // Check the parent chain to find the country
            let currentId = location.id;
            let parent = parentMap[currentId];
            let foundCountry = false;
            
            while (parent && parent !== 'all') {
              currentId = parent;
              parent = parentMap[currentId];
            }
            
            // If we found the country for this location
            if (parent === 'all') {
              // This is a direct child of a country
              if (parentMap[location.id] === currentId) {
                subregion1Content = locationName;
              } else {
                // This is further down
                subregion2Content = locationName;
              }
            }
          }
      }
      
      rows.push(
        React.createElement(TableRow, {
          key: `location-row-${location.id}`,
          className: `${level > 1 ? 'bg-gray-50' : ''} hover:bg-gray-100`,
        }, [
          // Country name column
          React.createElement(TableCell, {
            key: `location-country-${location.id}`,
            className: "sticky-column country-name-column"
          },
            React.createElement('div', { className: "tree-indent" }, [
              hasChildLocations ?
                React.createElement('button', {
                  key: "toggle-button",
                  type: "button",
                  className: "tree-toggle-button",
                  onClick: () => toggleRowExpansion(location.id),
                  'aria-label': isExpanded ? "Collapse" : "Expand"
                },
                  isExpanded ?
                    React.createElement(ChevronDown, { className: "tree-toggle-icon" }) :
                    React.createElement(ChevronRight, { className: "tree-toggle-icon" })
                ) :
                React.createElement('span', { key: "spacer", className: "tree-toggle-spacer" }),
              React.createElement('span', { key: "name", className: "country-name-text" }, countryContent)
            ])
          ),
          
          // Subregion columns
          React.createElement(TableCell, {
            key: `location-subregion1-${location.id}`,
            className: "sticky-column subregion-column"
          }, subregion1Content),
          
          React.createElement(TableCell, {
            key: `location-subregion2-${location.id}`,
            className: "sticky-column subregion-column"
          }, subregion2Content),
          
          React.createElement(TableCell, {
            key: `location-subregion3-${location.id}`,
            className: "sticky-column subregion-column"
          }, subregion3Content),
          
          // Available column
          React.createElement(TableCell, {
            key: `location-available-${location.id}`,
            className: "sticky-column available-column checkbox-container"
          },
            React.createElement('div', { className: "checkbox-wrapper" },
              React.createElement(Checkbox, {
                id: `available-${location.id}`,
                checked: isAvailable,
                onCheckedChange: (checked) => handleAvailabilityChange(location.id, checked === true),
                disabled: disabled
              })
            )
          ),
          
          // Requirement checkboxes
          ...fields.map(field => renderCheckbox(location.id, field.id, isAvailable)),
          ...documents.map(doc => renderCheckbox(location.id, doc.id, isAvailable)),
          ...forms.map(form => renderCheckbox(location.id, form.id, isAvailable))
        ])
      );
      
      // Process children if expanded
      if (isExpanded && hasChildLocations && location.children) {
        location.children.forEach((child, childIndex) => {
          processLocation(child, childIndex);
        });
      }
    };
    
    // Process all root locations
    hierarchicalLocations.forEach((location, index) => {
      processLocation(location, index);
    });
    
    return rows;
  }, [
    hierarchicalLocations,
    expandedRows,
    hasChildren,
    isLocationAvailable,
    renderCheckbox,
    toggleRowExpansion,
    handleAvailabilityChange,
    disabled,
    fields,
    documents,
    forms,
    hierarchyLevels,
    parentMap
  ]);

  // Render component
  return React.createElement(Card, { key: "requirements-card" }, [
    React.createElement(CardHeader, { key: "requirements-card-header" }, [
      React.createElement('div', { 
        key: "header-content",
        className: "flex justify-between items-center mb-4" 
      }, [
        React.createElement(CardTitle, { key: "card-title" }, `Requirements for ${serviceName}`),
        
        React.createElement('div', { 
          key: "button-container",
          className: "flex space-x-4" 
        }, [
          onAddField && React.createElement(Button, { 
            key: "add-field-button",
            size: "sm", 
            variant: "outline", 
            onClick: onAddField, 
            disabled: disabled 
          }, "Add Data Field"),
          
          onAddDocument && React.createElement(Button, { 
            key: "add-document-button",
            size: "sm", 
            variant: "outline", 
            onClick: onAddDocument, 
            disabled: disabled 
          }, "Add Document"),
          
          onAddForm && React.createElement(Button, { 
            key: "add-form-button",
            size: "sm", 
            variant: "outline", 
            onClick: onAddForm, 
            disabled: true 
          }, "Add Form")
        ])
      ])
    ]),
    
    React.createElement(CardContent, { key: "requirements-card-content" }, [
      // Save/Cancel buttons - visible when there are changes
      hasUnsavedChanges && React.createElement('div', { 
        key: "action-buttons",
        className: "flex justify-end space-x-4 mb-4" 
      }, [
        React.createElement(Button, { 
          key: "cancel-button",
          variant: "outline", 
          onClick: handleCancelChanges, 
          disabled: disabled || isLoadingProp 
        }, "Cancel Changes"),
        
        React.createElement(Button, { 
          key: "save-button",
          onClick: handleSaveChanges, 
          disabled: disabled || isLoadingProp 
        }, "Save Changes")
      ]),
      
      // Loading state
      (isLoadingProp || isGeneratingHierarchy) ? 
        React.createElement('div', { key: "loading-state", className: "p-8 text-center" }, [
          React.createElement('div', { 
            key: "loading-spinner",
            className: "inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" 
          }),
          React.createElement('p', { key: "loading-text" }, "Loading locations...")
        ]) : 
      
      // Error state
      error ? 
        React.createElement('div', { key: "error-state", className: "p-8 text-center text-red-500" }, [
          React.createElement('p', { key: "error-message" }, error),
          React.createElement(Button, { 
            key: "retry-button",
            onClick: () => window.location.reload(), 
            className: "mt-2", 
            variant: "outline", 
            size: "sm" 
          }, "Try Again")
        ]) : 
      
      // Empty state
      requirements.length === 0 ? 
        React.createElement('div', { key: "empty-state", className: "p-8 text-center text-gray-500" }, [
          React.createElement('p', { key: "empty-message" }, "No requirements have been defined yet."),
          React.createElement('p', { key: "empty-instructions", className: "mt-2" }, "Click \"Add Data Field\" or \"Add Document\" to get started.")
        ]) : 
      
      // Table
      React.createElement('div', { key: "table-container", className: "requirements-table-container border rounded" }, [
        React.createElement(Table, { key: "requirements-table", className: "requirements-table" }, [
          React.createElement(TableHeader, { key: "table-header" }, [
            React.createElement(TableRow, { key: "header-row" }, [
              // Header columns
              React.createElement(TableHead, { 
                key: "head-country",
                className: "sticky-column country-name-column" 
              }, "Country Name"),
              
              React.createElement(TableHead, { 
                key: "head-subregion1",
                className: "sticky-column subregion-column" 
              }, "Subregion 1"),
              
              React.createElement(TableHead, { 
                key: "head-subregion2",
                className: "sticky-column subregion-column" 
              }, "Subregion 2"),
              
              React.createElement(TableHead, { 
                key: "head-subregion3",
                className: "sticky-column subregion-column" 
              }, "Subregion 3"),
              
              React.createElement(TableHead, { 
                key: "head-available",
                className: "sticky-column available-column",
                style: { width: '35px' }
              }, React.createElement('span', { key: "available-label" }, "Available")),
              
              // Field headers with tooltips
              ...fields.map(field => 
                React.createElement(TableHead, { 
                  key: `header-field-${field.id}`,
                  style: { width: '35px' }
                }, 
                  field.description ? 
                    React.createElement(Tooltip, {
                      content: (
                        <div>
                          <div className="font-semibold mb-1">{field.name}</div>
                          <p>{field.description}</p>
                        </div>
                      ),
                      position: "top",
                      iconOnly: true,
                      iconSize: "xs"
                    }, field.name) : 
                    React.createElement('span', {}, field.name)
                )
              ),
              
              // Document headers with tooltips
              ...documents.map(doc => 
                React.createElement(TableHead, { 
                  key: `header-doc-${doc.id}`,
                  style: { width: '35px' }
                }, 
                  doc.description ? 
                    React.createElement(Tooltip, {
                      content: (
                        <div>
                          <div className="font-semibold mb-1">{doc.name}</div>
                          <p>{doc.description}</p>
                        </div>
                      ),
                      position: "top",
                      iconOnly: true,
                      iconSize: "xs"
                    }, doc.name) : 
                    React.createElement('span', {}, doc.name)
                )
              ),
              
              // Form headers with tooltips
              ...forms.map(form => 
                React.createElement(TableHead, { 
                  key: `header-form-${form.id}`,
                  style: { width: '35px' }
                }, 
                  form.description ? 
                    React.createElement(Tooltip, {
                      content: (
                        <div>
                          <div className="font-semibold mb-1">{form.name}</div>
                          <p>{form.description}</p>
                        </div>
                      ),
                      position: "top",
                      iconOnly: true,
                      iconSize: "xs"
                    }, form.name) : 
                    React.createElement('span', {}, form.name)
                )
              )
            ])
          ]),
          
          // Table body with rows
          React.createElement(TableBody, { key: "table-body" }, getTableRows())
        ])
      ])
    ])
  ]);
}