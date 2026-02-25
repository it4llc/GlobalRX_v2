'use client';
// src/components/modules/global-config/tabs/requirements-table.tsx
// Uses the useRequirementsTable hook for business logic extraction

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Requirement } from '@/types';
import { Tooltip } from '@/components/ui/tooltip';
import { useRequirementsTable } from '@/hooks/useRequirementsTable';
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
  // Use the extracted business logic hook
  const {
    hierarchicalLocations,
    expandedRows,
    localMappings,
    localAvailability,
    hasUnsavedChanges,
    isGeneratingHierarchy,
    error,
    hierarchyLevels,
    handleCheckboxChange,
    handleAvailabilityChange,
    handleSaveChanges,
    handleCancelChanges,
    isRequirementSelected,
    isLocationAvailable,
    toggleRowExpansion,
    hasChildren,
  } = useRequirementsTable({
    locations,
    requirements,
    serviceId,
    initialMappings,
    initialAvailability,
    onMappingChange,
    onAvailabilityChange,
  });

  const isLoading = isLoadingProp || isGeneratingHierarchy;

  // Helper function to render checkbox
  const renderCheckbox = (locationId: string, requirementId: string, isAvailable: boolean) => {
    const isChecked = isRequirementSelected(locationId, requirementId);

    return (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) =>
            handleCheckboxChange(locationId, requirementId, checked as boolean)
          }
          disabled={disabled || !isAvailable}
          aria-label={`${locationId} ${requirementId}`}
        />
      </div>
    );
  };

  // Get table rows for rendering
  const getTableRows = () => {
    const rows: React.ReactNode[] = [];

    const renderLocation = (location: Location, level: number = 0) => {
      const isAvailable = isLocationAvailable(location.id);
      const isExpanded = expandedRows[location.id] || false;
      const hasChildrenFlag = hasChildren(location);

      // Apply indentation based on hierarchy level (5 levels: ALL, Country, State, County, City)
      const indentationClass = level === 0 ? '' : `pl-${Math.min(level * 4, 16)}`;

      rows.push(
        <tr
          key={location.id}
          className={`border-b hover:bg-gray-50 ${!isAvailable ? 'opacity-50' : ''}`}
        >
          <td className={`py-2 px-4 ${indentationClass}`}>
            <div className="flex items-center">
              {hasChildrenFlag && (
                <button
                  onClick={() => toggleRowExpansion(location.id)}
                  className="mr-2"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${location.name}`}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              <span className={hasChildrenFlag ? 'font-semibold' : ''}>
                {location.name || location.countryName || location.id}
              </span>
            </div>
          </td>
          <td className="py-2 px-4">
            <Checkbox
              checked={isAvailable}
              onCheckedChange={(checked) =>
                handleAvailabilityChange(location.id, checked as boolean)
              }
              disabled={disabled}
              aria-label={`${location.name} availability`}
            />
          </td>
          {requirements.map((req) => (
            <td key={req.id} className="py-2 px-4">
              {renderCheckbox(location.id, req.id, isAvailable)}
            </td>
          ))}
        </tr>
      );

      // Render children if expanded
      if (isExpanded && location.children) {
        location.children.forEach((child) => {
          renderLocation(child, level + 1);
        });
      }
    };

    // Start rendering from top-level locations
    hierarchicalLocations.forEach((location) => {
      renderLocation(location);
    });

    return rows;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{serviceName} Requirements</CardTitle>
          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <>
                <Button
                  onClick={handleCancelChanges}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  size="sm"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="text-gray-500">Loading locations...</div>
          </div>
        ) : hierarchicalLocations.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No locations available for this service
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className="text-left py-2 px-4">Location</th>
                  <th className="text-left py-2 px-4">Available</th>
                  {requirements.map((req) => (
                    <th key={req.id} className="text-center py-2 px-4">
                      <Tooltip content={req.description || req.name}>
                        <span>{req.name}</span>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{getTableRows()}</tbody>
            </table>
          </div>
        )}

        {/* Add requirement buttons */}
        {!disabled && (
          <div className="flex gap-2 mt-4">
            {onAddField && (
              <Button onClick={onAddField} variant="outline" size="sm">
                Add Field
              </Button>
            )}
            {onAddDocument && (
              <Button onClick={onAddDocument} variant="outline" size="sm">
                Add Document
              </Button>
            )}
            {onAddForm && (
              <Button onClick={onAddForm} variant="outline" size="sm">
                Add Form
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}