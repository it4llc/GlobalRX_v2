'use client';
// Enterprise-grade Locations Table using TanStack Table
import clientLogger from '@/lib/client-logger';

import React, { useState, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  ColumnDef,
  flexRender,
  ExpandedState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Edit, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Types
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
  level?: number;
}

interface LocationsDataTableProps {
  locations: Location[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEdit?: (location: Location) => void;
  onToggleStatus?: (location: Location) => void;
}

// Transform flat locations into hierarchical structure
function buildLocationHierarchy(locations: Location[]): Location[] {
  const locationMap = new Map<string, Location>();
  const rootLocations: Location[] = [];

  // First pass: create location objects
  locations.forEach(loc => {
    locationMap.set(loc.id, { ...loc, children: [], level: 0 });
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
      rootLocations.push(location);
    }
  });

  // Sort countries alphabetically
  rootLocations.sort((a, b) =>
    (a.name || a.countryName || '').localeCompare(b.name || b.countryName || '')
  );

  return rootLocations;
}

export function LocationsDataTable({
  locations,
  isLoading = false,
  error = null,
  onRefresh,
  onEdit,
  onToggleStatus,
}: LocationsDataTableProps) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Location>>({});
  const [isSaving, setIsSaving] = useState(false);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const { fetchWithAuth } = useAuth();

  // Build hierarchical data
  const hierarchicalData = useMemo(() =>
    buildLocationHierarchy(locations),
    [locations]
  );

  // Edit handlers
  const handleEditClick = (location: Location) => {
    setEditingId(location.id);
    setEditFormData({
      id: location.id,
      name: location.name || location.countryName,
      twoLetter: location.twoLetter || location.code2,
      threeLetter: location.threeLetter || location.code3,
      numeric: location.numeric,
      subregion1: location.subregion1,
      subregion2: location.subregion2,
      subregion3: location.subregion3,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Map the fields to what the API expects
      const apiData = {
        id: editFormData.id,
        countryName: editFormData.name,  // API expects countryName, not name
        twoLetter: editFormData.twoLetter,
        threeLetter: editFormData.threeLetter,
        numeric: editFormData.numeric,
        subregion1: editFormData.subregion1 || '',
        subregion2: editFormData.subregion2 || '',
        subregion3: editFormData.subregion3 || '',
      };

      const response = await fetchWithAuth(`/api/locations/${editFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update location');
      }

      setEditingId(null);
      setEditFormData({});
      if (onRefresh) onRefresh();
    } catch (err) {
      clientLogger.error('Error updating location:', err);
      alert(`Failed to update location: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditFormData({});
  };

  // Define columns
  const columns = useMemo<ColumnDef<Location>[]>(() => [
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
      size: 150,
      cell: ({ row }) => {
        const location = row.original;
        const indent = location.level > 0 ? location.level * 12 : 0;
        const isEditing = editingId === location.id;

        if (isEditing && location.level === 0) {
          return (
            <div style={{ paddingLeft: `${indent}px` }}>
              <input
                type="text"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                className="w-full px-2 py-1 border rounded"
                autoFocus
              />
            </div>
          );
        }

        return (
          <div style={{ paddingLeft: `${indent}px` }} className="font-medium">
            {location.level === 0 ? (location.name || location.countryName || '-') : ''}
          </div>
        );
      },
    },
    {
      id: 'twoLetter',
      header: '2-Letter',
      size: 70,
      cell: ({ row }) => {
        const location = row.original;
        const isEditing = editingId === location.id;

        if (isEditing && !location.parentId) {
          return (
            <input
              type="text"
              value={editFormData.twoLetter || ''}
              onChange={(e) => setEditFormData({ ...editFormData, twoLetter: e.target.value })}
              className="w-full px-2 py-1 border rounded"
              maxLength={2}
            />
          );
        }

        return !location.parentId ? (location.code2 || location.twoLetter || '-') : '-';
      },
    },
    {
      id: 'threeLetter',
      header: '3-Letter',
      size: 70,
      cell: ({ row }) => {
        const location = row.original;
        const isEditing = editingId === location.id;

        if (isEditing && !location.parentId) {
          return (
            <input
              type="text"
              value={editFormData.threeLetter || ''}
              onChange={(e) => setEditFormData({ ...editFormData, threeLetter: e.target.value })}
              className="w-full px-2 py-1 border rounded"
              maxLength={3}
            />
          );
        }

        return !location.parentId ? (location.code3 || location.threeLetter || '-') : '-';
      },
    },
    {
      id: 'numeric',
      header: 'Numeric',
      size: 70,
      cell: ({ row }) => {
        const location = row.original;
        const isEditing = editingId === location.id;

        if (isEditing && !location.parentId) {
          return (
            <input
              type="text"
              value={editFormData.numeric || ''}
              onChange={(e) => setEditFormData({ ...editFormData, numeric: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          );
        }

        return !location.parentId ? (location.numeric || '-') : '-';
      },
    },
    {
      id: 'subregion1',
      header: 'SUBREG-1',
      size: 100,
      cell: ({ row }) => {
        const location = row.original;
        // Show location name if it's a level 1 subregion, otherwise show subregion1 field
        if (location.level === 1 && location.parentId) {
          return location.name || location.countryName || location.subregion1 || '-';
        }
        return location.subregion1 || '-';
      },
    },
    {
      id: 'subregion2',
      header: 'SUBREG-2',
      size: 100,
      cell: ({ row }) => {
        const location = row.original;
        // Show location name if it's a level 2 subregion
        if (location.level === 2 && location.parentId) {
          return location.name || location.countryName || location.subregion2 || '-';
        }
        return location.subregion2 || '-';
      },
    },
    {
      id: 'subregion3',
      header: 'SUBREG-3',
      size: 100,
      cell: ({ row }) => {
        const location = row.original;
        // Show location name if it's a level 3 subregion
        if (location.level === 3 && location.parentId) {
          return location.name || location.countryName || location.subregion3 || '-';
        }
        return location.subregion3 || '-';
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 70,
      cell: ({ row }) => {
        const location = row.original;
        return (
          <span className={cn(
            "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
            location.disabled ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
          )}>
            {location.disabled ? 'Disabled' : 'Active'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 80,
      cell: ({ row }) => {
        const location = row.original;
        const isEditing = editingId === location.id;

        if (isEditing) {
          return (
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                className="p-1 hover:bg-green-100 rounded text-green-600"
                title="Save"
                disabled={isSaving}
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-gray-100 rounded"
                title="Cancel"
                disabled={isSaving}
              >
                ✕
              </button>
            </div>
          );
        }

        return (
          <div className="flex gap-1">
            <button
              onClick={() => handleEditClick(location)}
              className="p-1 hover:bg-gray-100 rounded"
              title="Edit"
            >
              <Edit size={14} />
            </button>
            {onToggleStatus && (
              <button
                onClick={() => onToggleStatus(location)}
                className={cn(
                  "p-1 rounded",
                  location.disabled
                    ? "hover:bg-green-100 text-green-600"
                    : "hover:bg-red-100 text-red-600"
                )}
                title={location.disabled ? "Enable" : "Disable"}
              >
                <Power size={14} />
              </button>
            )}
          </div>
        );
      },
    },
  ], [onToggleStatus, editingId, editFormData, isSaving, handleEditClick, handleSave, handleCancel]);

  // Create table instance
  const table = useReactTable({
    data: hierarchicalData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
    getRowId: (row) => row.id,
    onExpandedChange: setExpanded,
    state: {
      expanded,
    },
  });

  // Virtualization for performance
  const { rows } = table.getExpandedRowModel();

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

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Locations Management</CardTitle>
          {onRefresh && (
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="px-4 py-3 mb-4 rounded bg-red-50 text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No locations found.</p>
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
                        const isSticky = index <= 1; // Expander and Country columns
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
                              isSticky && 'sticky bg-gray-50 z-10'
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
                          const isSticky = index <= 1;
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
                                isSticky && 'sticky bg-white z-10'
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