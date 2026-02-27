// Enterprise-grade Requirements Table using TanStack Table
'use client';

import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  ColumnDef,
  flexRender,
  Row,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Requirement } from '@/types';
import { cn } from '@/lib/utils';
import { useRequirementsDataTable } from '@/hooks/useRequirementsDataTable';

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

/**
 * RequirementsDataTable Component
 *
 * This is a pure UI component that renders the requirements matrix table.
 * All business logic is handled by the useRequirementsDataTable hook.
 *
 * The component is responsible for:
 * - Rendering the table UI with TanStack Table
 * - Implementing virtual scrolling for performance
 * - Displaying requirement columns with checkboxes
 * - Showing save/cancel buttons when changes are made
 * - Handling the visual aspects (sticky columns, striping, etc.)
 *
 * Business logic handled by the hook:
 * - Location hierarchy building
 * - Checkbox propagation logic
 * - Availability management
 * - State tracking and save/cancel
 */
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

  // Use the business logic hook
  const {
    hierarchicalData,
    flattenedLocations,
    sortedFields,
    sortedDocuments,
    sortedForms,
    localMappings,
    localAvailability,
    hasChanges,
    expandedState,
    handleRequirementChange,
    handleAvailabilityChange,
    handleSave,
    handleCancel,
    setExpandedState,
  } = useRequirementsDataTable({
    locations,
    requirements,
    initialMappings,
    initialAvailability,
    onMappingChange,
    onAvailabilityChange,
    disabled,
  });

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Define columns for the table
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
          // For ALL location, use the computed available state
          const isChecked = location.id === 'all'
            ? location.available === true
            : localAvailability[location.id] !== false;
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={isChecked}
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
      ...sortedFields.map((field): ColumnDef<Location> => ({
        id: `field-${field.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={field.description || field.name}>
            {field.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          // For ALL location, use the computed state from location.requirements
          const isChecked = location.id === 'all'
            ? location.requirements?.[field.id] === true
            : localMappings[`${location.id}___${field.id}`] === true;
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
      ...sortedDocuments.map((doc): ColumnDef<Location> => ({
        id: `doc-${doc.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={doc.description || doc.name}>
            {doc.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          // For ALL location, use the computed state from location.requirements
          const isChecked = location.id === 'all'
            ? location.requirements?.[doc.id] === true
            : localMappings[`${location.id}___${doc.id}`] === true;
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
      ...sortedForms.map((form): ColumnDef<Location> => ({
        id: `form-${form.id}`,
        header: () => (
          <div className="text-xs text-center break-words leading-tight" title={form.description || form.name}>
            {form.name}
          </div>
        ),
        size: 80,
        cell: ({ row }) => {
          const location = row.original;
          // For ALL location, use the computed state from location.requirements
          const isChecked = location.id === 'all'
            ? location.requirements?.[form.id] === true
            : localMappings[`${location.id}___${form.id}`] === true;
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
  }, [
    sortedFields,
    sortedDocuments,
    sortedForms,
    localMappings,
    localAvailability,
    handleRequirementChange,
    handleAvailabilityChange,
    disabled,
    // Add a key based on the requirement IDs and their order to force column re-render when order changes
    sortedFields.map((f: any) => f.id).join(','),
    sortedDocuments.map((d: any) => d.id).join(','),
    sortedForms.map((f: any) => f.id).join(',')
  ]);

  // Create table instance
  const table = useReactTable({
    data: hierarchicalData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) => row.children,
    getRowId: (row) => row.id,
    onExpandedChange: setExpandedState as any,
    state: {
      expanded: expandedState,
    },
  });

  // Virtualization for performance - use expanded row model
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
                  {table.getHeaderGroups().map((headerGroup: any) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header: any, index: number) => {
                        const isSticky = index <= 5; // First 6 columns are sticky
                        const stickyLeft = isSticky
                          ? headerGroup.headers
                              .slice(0, index)
                              .reduce((sum: number, h: any) => sum + h.column.getSize(), 0)
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
                  {virtualRows.map((virtualRow: any) => {
                    const row = rows[virtualRow.index] as Row<Location>;
                    return (
                      <tr key={row.id} className="hover:bg-gray-50">
                        {row.getVisibleCells().map((cell: any, index: number) => {
                          const isSticky = index <= 5;
                          const stickyLeft = isSticky
                            ? row.getVisibleCells()
                                .slice(0, index)
                                .reduce((sum: number, c: any) => sum + c.column.getSize(), 0)
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