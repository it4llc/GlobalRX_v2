// Enterprise-grade Requirements Table using TanStack Table
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  ColumnDef,
  flexRender,
  ExpandedState,
  Row,
  Cell,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { Requirement } from '@/types';
import { cn } from '@/lib/utils';

// Types
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

interface RequirementsDataTableProps {
  serviceName: string;
  requirements: Requirement[];
  locations: Location[];
  initialMappings?: Record<string, boolean>;
  initialAvailability?: Record<string, boolean>;
  onMappingChange?: (mappings: Record<string, boolean>) => void;
  onAvailabilityChange?: (availability: Record<string, boolean>) => void;
  onAddField?: () => void;
  onAddDocument?: () => void;
  onAddForm?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

// Transform flat locations into hierarchical structure with computed fields
function buildLocationHierarchy(
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
    available: availability['all'] !== false,
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

  // Sort countries alphabetically
  allLocation.children?.sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  return rootLocations;
}

// Flatten hierarchical structure for table display
function flattenLocations(locations: Location[], expanded: Set<string>): Location[] {
  const result: Location[] = [];

  function traverse(location: Location, parentExpanded: boolean = true) {
    if (parentExpanded) {
      result.push(location);
    }

    const isExpanded = expanded.has(location.id);
    if (location.children && parentExpanded && isExpanded) {
      location.children.forEach(child => traverse(child, true));
    }
  }

  locations.forEach(loc => traverse(loc));
  return result;
}

export function RequirementsDataTable({
  serviceName,
  requirements,
  locations,
  initialMappings = {},
  initialAvailability = {},
  onMappingChange,
  onAvailabilityChange,
  onAddField,
  onAddDocument,
  onAddForm,
  disabled = false,
  isLoading = false,
}: RequirementsDataTableProps) {
  // Debug logging
  console.log('RequirementsDataTable rendered with:', {
    serviceName,
    requirementsCount: requirements?.length,
    locationsCount: locations?.length,
    requirements: requirements,
    locations: locations,
    initialMappings: Object.keys(initialMappings).length,
    initialAvailability: Object.keys(initialAvailability).length,
  });

  // State
  const [localMappings, setLocalMappings] = useState(initialMappings);
  const [localAvailability, setLocalAvailability] = useState(initialAvailability);
  const [hasChanges, setHasChanges] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState>({ 'all': true }); // Expand ALL by default using row ID
  const parentRef = React.useRef<HTMLDivElement>(null);

  // Separate requirements by type
  const fields = useMemo(() => requirements.filter(r => r.type === 'field'), [requirements]);
  const documents = useMemo(() => requirements.filter(r => r.type === 'document'), [requirements]);
  const forms = useMemo(() => requirements.filter(r => r.type === 'form'), [requirements]);

  // Build hierarchical data
  const hierarchicalData = useMemo(() => {
    const data = buildLocationHierarchy(locations, localMappings, localAvailability);
    console.log('Hierarchical data built:', {
      dataLength: data?.length,
      firstItem: data?.[0],
      data: data
    });
    return data;
  }, [locations, localMappings, localAvailability]);

  // Handle checkbox changes
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
      if (locId !== 'all' && !location?.parentId) {
        newMappings[`all___${requirementId}`] = false;
      }
    };

    // Apply the updates
    updateChildren(locationId, checked);
    if (!checked) {
      updateParents(locationId);
    }

    setLocalMappings(newMappings);
    setHasChanges(true);
  }, [disabled, localMappings, hierarchicalData]);

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
      if (locId !== 'all' && !location?.parentId) {
        newAvailability['all'] = false;
      }
    };

    // Apply the updates
    updateChildren(locationId, checked);
    if (!checked) {
      updateParents(locationId);
    }

    setLocalAvailability(newAvailability);
    setHasChanges(true);
  }, [disabled, localAvailability, hierarchicalData]);

  // Define columns
  const columns = useMemo<ColumnDef<Location>[]>(() => {
    const baseColumns: ColumnDef<Location>[] = [
      {
        id: 'expander',
        header: () => null,
        size: 24,
        cell: ({ row }) => {
          const location = row.original;
          return location.children && location.children.length > 0 ? (
            <button
              onClick={row.getToggleExpandedHandler()}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              {row.getIsExpanded() ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : null;
        },
      },
      {
        id: 'country',
        header: 'Country',
        size: 100,
        cell: ({ row }) => {
          const location = row.original;
          const indent = location.level > 1 ? (location.level - 1) * 8 : 0;
          return (
            <div style={{ paddingLeft: `${indent}px` }} className="font-medium">
              {location.level === 0 ? 'ALL' :
               location.level === 1 ? location.name : ''}
            </div>
          );
        },
      },
      {
        id: 'subregion1',
        header: 'SUBREG-1',
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          return location.level === 2 ? location.name : location.subregion1 || '';
        },
      },
      {
        id: 'subregion2',
        header: 'SUBREG-2',
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          return location.level === 3 ? location.name : location.subregion2 || '';
        },
      },
      {
        id: 'subregion3',
        header: 'SUBREG-3',
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          return location.level === 4 ? location.name : location.subregion3 || '';
        },
      },
      {
        id: 'available',
        header: 'Avail',
        size: 50,
        cell: ({ row }) => {
          const location = row.original;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={localAvailability[location.id] !== false}
                onCheckedChange={(checked) =>
                  handleAvailabilityChange(location.id, checked === true)
                }
                disabled={disabled}
              />
            </div>
          );
        },
      },
    ];

    // Add requirement columns
    const requirementColumns: ColumnDef<Location>[] = [
      ...fields.map((field): ColumnDef<Location> => ({
        id: `field-${field.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={field.description || field.name}>
            {field.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          const isChecked = localMappings[`${location.id}___${field.id}`] === true;
          const isAvailable = localAvailability[location.id] !== false;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleRequirementChange(location.id, field.id, checked === true)
                }
                disabled={disabled || !isAvailable}
                className={cn(!isAvailable && 'opacity-50')}
              />
            </div>
          );
        },
      })),
      ...documents.map((doc): ColumnDef<Location> => ({
        id: `doc-${doc.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={doc.description || doc.name}>
            {doc.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          const isChecked = localMappings[`${location.id}___${doc.id}`] === true;
          const isAvailable = localAvailability[location.id] !== false;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleRequirementChange(location.id, doc.id, checked === true)
                }
                disabled={disabled || !isAvailable}
                className={cn(!isAvailable && 'opacity-50')}
              />
            </div>
          );
        },
      })),
      ...forms.map((form): ColumnDef<Location> => ({
        id: `form-${form.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={form.description || form.name}>
            {form.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          const isChecked = localMappings[`${location.id}___${form.id}`] === true;
          const isAvailable = localAvailability[location.id] !== false;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) =>
                  handleRequirementChange(location.id, form.id, checked === true)
                }
                disabled={disabled || !isAvailable}
                className={cn(!isAvailable && 'opacity-50')}
              />
            </div>
          );
        },
      })),
    ];

    return [...baseColumns, ...requirementColumns];
  }, [fields, documents, forms, localMappings, localAvailability, handleRequirementChange, handleAvailabilityChange, disabled]);

  // Create table instance
  const table = useReactTable({
    data: hierarchicalData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
    getRowId: (row) => row.id, // Use location ID as row ID
    onExpandedChange: setExpanded,
    state: {
      expanded,
    },
  });

  // Handle save/cancel
  const handleSave = () => {
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
  };

  const handleCancel = () => {
    setLocalMappings(initialMappings);
    setLocalAvailability(initialAvailability);
    setHasChanges(false);
  };

  // Virtualization for performance - use expanded row model
  const { rows } = table.getExpandedRowModel();
  console.log('Table rows:', {
    rowsCount: rows.length,
    rows: rows,
    firstRow: rows[0],
    coreRows: table.getCoreRowModel().rows.length,
    expandedState: expanded
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  console.log('Virtual rows:', {
    virtualRowsCount: virtualRows.length,
    totalSize,
    paddingTop,
    paddingBottom,
    virtualRows,
    parentRef: parentRef.current,
    scrollElement: parentRef.current?.scrollHeight
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Requirements for {serviceName}</CardTitle>
          <div className="flex gap-2">
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
        {hasChanges && (
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel Changes
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              Save Changes
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : requirements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No requirements have been defined yet.</p>
            <p className="text-sm mt-2">Click "Add Data Field" or "Add Document" to get started.</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-lg border">
            <div
              ref={parentRef}
              className="overflow-auto"
              style={{ height: '600px', position: 'relative' }}
            >
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-20 bg-gray-50">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header, index) => {
                        const isSticky = index <= 5; // First 6 columns are sticky
                        const stickyLeft = isSticky
                          ? headerGroup.headers
                              .slice(0, index)
                              .reduce((sum, h) => sum + h.column.getSize(), 0)
                          : undefined;

                        return (
                          <th
                            key={header.id}
                            className={cn(
                              'px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b',
                              isSticky && 'sticky bg-gray-50 z-10',
                              index > 5 && (index - 6) % 2 === 1 && 'bg-blue-50'
                            )}
                            style={{
                              width: header.column.getSize(),
                              left: stickyLeft,
                            }}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                  )}
                  {virtualRows.map(virtualRow => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell, index) => {
                          const isSticky = index <= 5;
                          const stickyLeft = isSticky
                            ? row.getVisibleCells()
                                .slice(0, index)
                                .reduce((sum, c) => sum + c.column.getSize(), 0)
                            : undefined;

                          return (
                            <td
                              key={cell.id}
                              className={cn(
                                index === 0 ? 'pl-1 pr-0 py-2' : 'px-2 py-2',
                                'text-sm border-b',
                                isSticky && 'sticky bg-white z-10',
                                index > 5 && (index - 6) % 2 === 1 && 'bg-blue-50/30'
                              )}
                              style={{
                                width: cell.column.getSize(),
                                left: stickyLeft,
                              }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}