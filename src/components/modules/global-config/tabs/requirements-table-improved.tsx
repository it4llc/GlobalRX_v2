// src/components/modules/global-config/tabs/requirements-table-improved.tsx
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

  const [localMappings, setLocalMappings] = useState<Record<string, boolean>>(initialMappings || {});
  const [localAvailability, setLocalAvailability] = useState<Record<string, boolean>>(initialAvailability || {});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [locationHierarchy, setLocationHierarchy] = useState<Record<string, string[]>>({});
  const [parentMap, setParentMap] = useState<Record<string, string>>({});
  const [locationsById, setLocationsById] = useState<Record<string, Location>>({});
  const [hierarchyLevels, setHierarchyLevels] = useState<Record<string, number>>({});

  const isInitialized = useRef(false);
  const lastServiceId = useRef(serviceId);

  // Initialize state from props when component mounts or serviceId changes
  useEffect(() => {
    if (!serviceId || Object.keys(initialMappings).length === 0) return;

    if (serviceId !== lastServiceId.current) {
      lastServiceId.current = serviceId;
      isInitialized.current = false;
    }

    if (!isInitialized.current) {
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

  // Build hierarchy (keep existing logic)
  useEffect(() => {
    if (locations.length === 0) return;

    setIsGeneratingHierarchy(true);

    try {
      const allLocation: Location = {
        id: 'all',
        name: 'ALL',
        code2: 'ALL',
        code3: 'ALL',
        children: []
      };

      const locationsMap = new Map<string, Location>();
      const locationsById: Record<string, Location> = { 'all': allLocation };
      const rootLocations: Location[] = [allLocation];
      const hierarchyRelationships: Record<string, string[]> = { 'all': [] };
      const newParentMap: Record<string, string> = {};
      const newHierarchyLevels: Record<string, number> = { 'all': 0 };

      locations.forEach(location => {
        if (!location || !location.id) return;
        const locationCopy = {
          ...location,
          name: location.name || location.countryName || 'Unknown Location',
          children: []
        };
        locationsMap.set(location.id, locationCopy);
        locationsById[location.id] = locationCopy;
        hierarchyRelationships[location.id] = [];
      });

      locations.forEach(location => {
        if (!location || !location.id) return;
        const locationObj = locationsMap.get(location.id);
        if (!locationObj) return;

        if (location.parentId && locationsMap.has(location.parentId)) {
          const parent = locationsMap.get(location.parentId);
          if (parent && parent.children) {
            parent.children.push(locationObj);
            hierarchyRelationships[location.parentId].push(location.id);
          }
          newParentMap[location.id] = location.parentId;
          newHierarchyLevels[location.id] = (newHierarchyLevels[location.parentId] || 0) + 1;
        } else {
          allLocation.children!.push(locationObj);
          hierarchyRelationships['all'].push(location.id);
          newParentMap[location.id] = 'all';
          newHierarchyLevels[location.id] = 1;
        }
      });

      if (allLocation.children && allLocation.children.length > 0) {
        allLocation.children.sort((a, b) => {
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB);
        });
      }

      setHierarchicalLocations(rootLocations);
      setLocationHierarchy(hierarchyRelationships);
      setParentMap(newParentMap);
      setLocationsById(locationsById);
      setHierarchyLevels(newHierarchyLevels);
      setExpandedRows(prev => ({ ...prev, 'all': true }));

    } catch (err) {
      console.error('Error processing locations:', err);
      setError('Failed to process location data.');
    } finally {
      setIsGeneratingHierarchy(false);
    }
  }, [locations]);

  const updateParentCheckboxes = useCallback((locationId: string, requirementId: string, newMappings: Record<string, boolean>) => {
    let currentParentId = parentMap[locationId];

    while (currentParentId) {
      const parentKey = `${currentParentId}___${requirementId}`;
      const directChildren = locationHierarchy[currentParentId] || [];
      const allChildrenChecked = directChildren.every(childId => {
        const childKey = `${childId}___${requirementId}`;
        return newMappings[childKey] === true;
      });
      newMappings[parentKey] = allChildrenChecked;
      currentParentId = parentMap[currentParentId];
    }

    return newMappings;
  }, [parentMap, locationHierarchy]);

  const updateParentAvailability = useCallback((locationId: string, newAvailability: Record<string, boolean>) => {
    let currentParentId = parentMap[locationId];

    while (currentParentId) {
      const directChildren = locationHierarchy[currentParentId] || [];
      const allChildrenAvailable = directChildren.every(childId => {
        return newAvailability[childId] !== false;
      });
      newAvailability[currentParentId] = allChildrenAvailable;
      currentParentId = parentMap[currentParentId];
    }

    return newAvailability;
  }, [parentMap, locationHierarchy]);

  const handleCheckboxChange = useCallback((locationId: string, requirementId: string, checked: boolean) => {
    if (disabled) return;

    const newMappings = { ...localMappings };
    const key = `${locationId}___${requirementId}`;
    newMappings[key] = checked;

    const processChildren = (parentId: string) => {
      const children = locationHierarchy[parentId] || [];
      children.forEach(childId => {
        const childKey = `${childId}___${requirementId}`;
        newMappings[childKey] = checked;
        processChildren(childId);
      });
    };

    processChildren(locationId);

    if (!checked) {
      updateParentCheckboxes(locationId, requirementId, newMappings);
    }

    setLocalMappings(newMappings);
    setHasUnsavedChanges(true);
  }, [localMappings, locationHierarchy, updateParentCheckboxes, disabled]);

  const handleAvailabilityChange = useCallback((locationId: string, checked: boolean) => {
    if (disabled) return;

    let newAvailability = { ...localAvailability };
    newAvailability[locationId] = checked;

    const processChildren = (parentId: string, value: boolean) => {
      const children = locationHierarchy[parentId] || [];
      children.forEach(childId => {
        newAvailability[childId] = value;
        processChildren(childId, value);
      });
    };

    processChildren(locationId, checked);

    if (!checked) {
      newAvailability = updateParentAvailability(locationId, newAvailability);
    }

    setLocalAvailability(newAvailability);
    setHasUnsavedChanges(true);
  }, [localAvailability, locationHierarchy, updateParentAvailability, disabled]);

  const handleSaveChanges = useCallback(() => {
    if (hasUnsavedChanges) {
      const filteredMappings: Record<string, boolean> = {};
      Object.entries(localMappings).forEach(([key, value]) => {
        if (!key.startsWith('all-')) {
          filteredMappings[key] = value;
        }
      });

      const filteredAvailability: Record<string, boolean> = {};
      Object.entries(localAvailability).forEach(([locationId, value]) => {
        if (locationId !== 'all') {
          filteredAvailability[locationId] = value;
        }
      });

      if (onMappingChange) {
        onMappingChange(filteredMappings);
      }

      if (onAvailabilityChange) {
        onAvailabilityChange(filteredAvailability);
      }

      setHasUnsavedChanges(false);
    }
  }, [hasUnsavedChanges, localMappings, localAvailability, onMappingChange, onAvailabilityChange]);

  const handleCancelChanges = useCallback(() => {
    setLocalMappings({...initialMappings});
    setLocalAvailability({...initialAvailability});
    setHasUnsavedChanges(false);
  }, [initialMappings, initialAvailability]);

  const isRequirementSelected = useCallback((locationId: string, requirementId: string): boolean => {
    const key = `${locationId}___${requirementId}`;
    return localMappings[key] === true;
  }, [localMappings]);

  const isLocationAvailable = useCallback((locationId: string): boolean => {
    return localAvailability[locationId] !== false;
  }, [localAvailability]);

  const toggleRowExpansion = useCallback((locationId: string) => {
    setExpandedRows(prevState => ({
      ...prevState,
      [locationId]: !prevState[locationId]
    }));
  }, []);

  const hasChildren = useCallback((location: Location) => {
    return location.children && location.children.length > 0;
  }, []);

  const renderLocationRow = (location: Location, level: number = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const isExpanded = expandedRows[location.id] || false;
    const hasChildLocations = hasChildren(location);
    const isAvailable = isLocationAvailable(location.id);

    let countryContent = "";
    let subregion1Content = "";
    let subregion2Content = "";
    let subregion3Content = "";

    if (location.id === 'all') {
      countryContent = 'ALL';
    } else {
      const locationName = location.name || '';
      switch (hierarchyLevels[location.id]) {
        case 1: countryContent = locationName; break;
        case 2: subregion1Content = locationName; break;
        case 3: subregion2Content = locationName; break;
        case 4: subregion3Content = locationName; break;
      }
    }

    rows.push(
      <tr key={location.id} className={level > 1 ? 'bg-gray-50' : ''}>
        <td className={`${styles.stickyColumn} ${styles.countryColumn}`}>
          <div className={styles.treeIndent}>
            {hasChildLocations ? (
              <button
                type="button"
                className={styles.treeToggle}
                onClick={() => toggleRowExpansion(location.id)}
                aria-label={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? '−' : '+'}
              </button>
            ) : (
              <span className={styles.treeSpacer} />
            )}
            <span>{countryContent}</span>
          </div>
        </td>
        <td className={`${styles.stickyColumn} ${styles.subregion1Column}`}>
          {subregion1Content}
        </td>
        <td className={`${styles.stickyColumn} ${styles.subregion2Column}`}>
          {subregion2Content}
        </td>
        <td className={`${styles.stickyColumn} ${styles.subregion3Column}`}>
          {subregion3Content}
        </td>
        <td className={`${styles.stickyColumn} ${styles.availableColumn} ${styles.checkboxCell}`}>
          <div className={styles.checkboxWrapper}>
            <Checkbox
              id={`available-${location.id}`}
              checked={isAvailable}
              onCheckedChange={(checked) => handleAvailabilityChange(location.id, checked === true)}
              disabled={disabled}
            />
          </div>
        </td>
        {fields.map(field => (
          <td key={`${location.id}-${field.id}`} className={styles.checkboxCell}>
            <div className={styles.checkboxWrapper}>
              <Checkbox
                id={`${location.id}-${field.id}`}
                checked={isRequirementSelected(location.id, field.id)}
                onCheckedChange={(checked) => handleCheckboxChange(location.id, field.id, checked === true)}
                disabled={!isAvailable || disabled}
                className={!isAvailable ? "opacity-50" : ""}
              />
            </div>
          </td>
        ))}
        {documents.map(doc => (
          <td key={`${location.id}-${doc.id}`} className={styles.checkboxCell}>
            <div className={styles.checkboxWrapper}>
              <Checkbox
                id={`${location.id}-${doc.id}`}
                checked={isRequirementSelected(location.id, doc.id)}
                onCheckedChange={(checked) => handleCheckboxChange(location.id, doc.id, checked === true)}
                disabled={!isAvailable || disabled}
                className={!isAvailable ? "opacity-50" : ""}
              />
            </div>
          </td>
        ))}
        {forms.map(form => (
          <td key={`${location.id}-${form.id}`} className={styles.checkboxCell}>
            <div className={styles.checkboxWrapper}>
              <Checkbox
                id={`${location.id}-${form.id}`}
                checked={isRequirementSelected(location.id, form.id)}
                onCheckedChange={(checked) => handleCheckboxChange(location.id, form.id, checked === true)}
                disabled={!isAvailable || disabled}
                className={!isAvailable ? "opacity-50" : ""}
              />
            </div>
          </td>
        ))}
      </tr>
    );

    if (isExpanded && hasChildLocations && location.children) {
      location.children.forEach(child => {
        rows.push(...renderLocationRow(child, level + 1));
      });
    }

    return rows;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center mb-4">
          <CardTitle>Requirements for {serviceName}</CardTitle>
          <div className="flex space-x-4">
            {onAddField && (
              <Button size="sm" variant="outline" onClick={onAddField} disabled={disabled}>
                Add Data Field
              </Button>
            )}
            {onAddDocument && (
              <Button size="sm" variant="outline" onClick={onAddDocument} disabled={disabled}>
                Add Document
              </Button>
            )}
            {onAddForm && (
              <Button size="sm" variant="outline" onClick={onAddForm} disabled={true}>
                Add Form
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {hasUnsavedChanges && (
          <div className="flex justify-end space-x-4 mb-4">
            <Button variant="outline" onClick={handleCancelChanges} disabled={disabled || isLoadingProp}>
              Cancel Changes
            </Button>
            <Button onClick={handleSaveChanges} disabled={disabled || isLoadingProp}>
              Save Changes
            </Button>
          </div>
        )}

        {(isLoadingProp || isGeneratingHierarchy) ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2" />
            <p>Loading locations...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-2" variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No requirements have been defined yet.</p>
            <p className="mt-2">Click "Add Data Field" or "Add Document" to get started.</p>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <div className={styles.scrollWrapper}>
              <table className={styles.requirementsTable}>
                <thead>
                  <tr>
                    <th className={`${styles.stickyColumn} ${styles.countryColumn}`}>
                      Country Name
                    </th>
                    <th className={`${styles.stickyColumn} ${styles.subregion1Column}`}>
                      Subregion 1
                    </th>
                    <th className={`${styles.stickyColumn} ${styles.subregion2Column}`}>
                      Subregion 2
                    </th>
                    <th className={`${styles.stickyColumn} ${styles.subregion3Column}`}>
                      Subregion 3
                    </th>
                    <th className={`${styles.stickyColumn} ${styles.availableColumn}`}>
                      Avail
                    </th>
                    {fields.map(field => (
                      <th key={field.id} className={`${styles.requirementColumn} ${styles.header}`}>
                        {field.description ? (
                          <Tooltip
                            content={
                              <div>
                                <div className="font-semibold mb-1">{field.name}</div>
                                <p>{field.description}</p>
                              </div>
                            }
                            position="top"
                          >
                            <div className={styles.rotatedHeader}>{field.name}</div>
                          </Tooltip>
                        ) : (
                          <div className={styles.rotatedHeader}>{field.name}</div>
                        )}
                      </th>
                    ))}
                    {documents.map(doc => (
                      <th key={doc.id} className={`${styles.requirementColumn} ${styles.header}`}>
                        {doc.description ? (
                          <Tooltip
                            content={
                              <div>
                                <div className="font-semibold mb-1">{doc.name}</div>
                                <p>{doc.description}</p>
                              </div>
                            }
                            position="top"
                          >
                            <div className={styles.rotatedHeader}>{doc.name}</div>
                          </Tooltip>
                        ) : (
                          <div className={styles.rotatedHeader}>{doc.name}</div>
                        )}
                      </th>
                    ))}
                    {forms.map(form => (
                      <th key={form.id} className={`${styles.requirementColumn} ${styles.header}`}>
                        {form.description ? (
                          <Tooltip
                            content={
                              <div>
                                <div className="font-semibold mb-1">{form.name}</div>
                                <p>{form.description}</p>
                              </div>
                            }
                            position="top"
                          >
                            <div className={styles.rotatedHeader}>{form.name}</div>
                          </Tooltip>
                        ) : (
                          <div className={styles.rotatedHeader}>{form.name}</div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hierarchicalLocations.map(location => renderLocationRow(location))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}