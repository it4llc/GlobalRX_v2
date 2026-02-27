// Enterprise-grade Requirements Table using TanStack Table
'use client';

import React, { useMemo, useState } from 'react';
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
import { Requirement } from '@/types';
import { cn } from '@/lib/utils';
import { useRequirementsDataTable, buildLocationHierarchy } from '@/hooks/useRequirementsDataTable';
import { useRequirementsColumns } from './RequirementsTableColumns';

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

// Controlled mode props - when parent manages all state
interface ControlledModeProps {
  controlled: true;
  serviceName: string;
  requirements: Requirement[];
  locations: Location[];
  locationRequirements: Record<string, string[]>; // DSX format: locationId -> requirementIds[]
  locationAvailability: Record<string, boolean>; // DSX format: locationId -> boolean
  onRequirementToggle: (locationId: string, requirementId: string) => void;
  onAvailabilityToggle: (locationId: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onAddField?: () => void;
  onAddDocument?: () => void;
  onAddForm?: () => void;
  isLoading?: boolean;
}

// Standalone mode props - when component manages own state (current behavior)
interface StandaloneModeProps {
  controlled?: false;
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

type RequirementsDataTableProps = ControlledModeProps | StandaloneModeProps;

/**
 * RequirementsDataTable Component
 *
 * Enterprise-grade requirements matrix table with two operating modes:
 *
 * CONTROLLED MODE (controlled: true):
 * - Parent component manages all state (recommended for complex integrations)
 * - Direct integration with DSX tab state management
 * - No internal state management or save logic
 * - Optimal performance and maintainability
 *
 * STANDALONE MODE (controlled: false/undefined):
 * - Component manages own state using useRequirementsDataTable hook
 * - Self-contained save/cancel functionality
 * - Backward compatible with existing usage
 *
 * Features:
 * - TanStack Table with virtual scrolling for performance
 * - Hierarchical location display with expand/collapse
 * - Requirement columns with checkbox propagation
 * - Sticky columns and visual enhancements
 */
export function RequirementsDataTable(props: RequirementsDataTableProps) {
  const isControlled = 'controlled' in props && props.controlled === true;

  if (isControlled) {
    return <ControlledRequirementsTable {...props} />;
  } else {
    return <StandaloneRequirementsTable {...props as StandaloneModeProps} />;
  }
}

// Controlled mode implementation - uses parent state directly
function ControlledRequirementsTable({
  serviceName,
  requirements,
  locations,
  locationRequirements,
  locationAvailability,
  onRequirementToggle,
  onAvailabilityToggle,
  onSave,
  isSaving,
  onAddField,
  onAddDocument,
  onAddForm,
  isLoading = false,
}: ControlledModeProps) {

  // Convert DSX format to hierarchical display format
  const hierarchicalData = useMemo(() => {
    // Convert locationRequirements (Record<string, string[]>) to flat mappings for hierarchy builder
    const flatMappings: Record<string, boolean> = {};
    Object.entries(locationRequirements).forEach(([locationId, reqIds]) => {
      reqIds.forEach(reqId => {
        flatMappings[`${locationId}___${reqId}`] = true;
      });
    });

    return buildLocationHierarchy(locations, flatMappings, locationAvailability);
  }, [locations, locationRequirements, locationAvailability]);

  // Sort requirements by type and displayOrder
  const sortedFields = useMemo(() =>
    requirements.filter(r => r.type === 'field').sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
  , [requirements]);

  const sortedDocuments = useMemo(() =>
    requirements.filter(r => r.type === 'document').sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
  , [requirements]);

  const sortedForms = useMemo(() =>
    requirements.filter(r => r.type === 'form').sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
  , [requirements]);

  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({ 'all': true });

  return (
    <RequirementsTableUI
      serviceName={serviceName}
      hierarchicalData={hierarchicalData}
      sortedFields={sortedFields}
      sortedDocuments={sortedDocuments}
      sortedForms={sortedForms}
      expandedState={expandedState}
      setExpandedState={setExpandedState}
      onRequirementToggle={onRequirementToggle}
      onAvailabilityToggle={onAvailabilityToggle}
      onSave={onSave}
      hasChanges={false} // Parent manages when save button shows
      isSaving={isSaving}
      isLoading={isLoading}
      onAddField={onAddField}
      onAddDocument={onAddDocument}
      onAddForm={onAddForm}
      // For controlled mode, we check DSX state directly
      isRequirementSelected={(locationId: string, requirementId: string) => {
        if (locationId === 'all') {
          // For ALL location, check if all children have this requirement
          const all = hierarchicalData[0];
          if (!all?.children?.length) return false;
          return all.children.every(child => {
            const childReqs = locationRequirements[child.id] || [];
            return childReqs.includes(requirementId);
          });
        }
        const reqs = locationRequirements[locationId] || [];
        return reqs.includes(requirementId);
      }}
      isLocationAvailable={(locationId: string) => {
        if (locationId === 'all') {
          // For ALL location, show available if any child is available
          return Object.values(locationAvailability).some(Boolean);
        }
        return locationAvailability[locationId] !== false;
      }}
    />
  );
}

// Standalone mode implementation - uses internal hook
function StandaloneRequirementsTable({
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
}: StandaloneModeProps) {

  // Use the business logic hook
  const {
    hierarchicalData,
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

  return (
    <RequirementsTableUI
      serviceName={serviceName}
      hierarchicalData={hierarchicalData}
      sortedFields={sortedFields}
      sortedDocuments={sortedDocuments}
      sortedForms={sortedForms}
      expandedState={expandedState}
      setExpandedState={setExpandedState}
      onRequirementToggle={handleRequirementChange}
      onAvailabilityToggle={handleAvailabilityChange}
      onSave={handleSave}
      onCancel={handleCancel}
      hasChanges={hasChanges}
      isSaving={false}
      isLoading={isLoading}
      disabled={disabled}
      onAddField={onAddField}
      onAddDocument={onAddDocument}
      onAddForm={onAddForm}
      isRequirementSelected={(locationId: string, requirementId: string) => {
        if (locationId === 'all') {
          const all = hierarchicalData[0];
          return all.requirements?.[requirementId] === true;
        }
        return localMappings[`${locationId}___${requirementId}`] === true;
      }}
      isLocationAvailable={(locationId: string) => {
        if (locationId === 'all') {
          const all = hierarchicalData[0];
          return all.available === true;
        }
        return localAvailability[locationId] !== false;
      }}
    />
  );
}

// Shared UI component props
interface RequirementsTableUIProps {
  serviceName: string;
  hierarchicalData: Location[];
  sortedFields: Requirement[];
  sortedDocuments: Requirement[];
  sortedForms: Requirement[];
  expandedState: Record<string, boolean>;
  setExpandedState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onRequirementToggle: (locationId: string, requirementId: string) => void;
  onAvailabilityToggle: (locationId: string) => void;
  onSave: () => void;
  onCancel?: () => void;
  hasChanges: boolean;
  isSaving: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onAddField?: () => void;
  onAddDocument?: () => void;
  onAddForm?: () => void;
  isRequirementSelected: (locationId: string, requirementId: string) => boolean;
  isLocationAvailable: (locationId: string) => boolean;
}

// Shared UI component used by both modes
function RequirementsTableUI({
  serviceName,
  hierarchicalData,
  sortedFields,
  sortedDocuments,
  sortedForms,
  expandedState,
  setExpandedState,
  onRequirementToggle,
  onAvailabilityToggle,
  onSave,
  onCancel,
  hasChanges,
  isSaving,
  isLoading,
  disabled = false,
  onAddField,
  onAddDocument,
  onAddForm,
  isRequirementSelected,
  isLocationAvailable,
}: RequirementsTableUIProps) {

  const parentRef = React.useRef<HTMLDivElement>(null);

  // Define columns for the table
  const columns = useRequirementsColumns({
    sortedFields,
    sortedDocuments,
    sortedForms,
    onRequirementToggle,
    onAvailabilityToggle,
    isRequirementSelected,
    isLocationAvailable,
    disabled,
  });

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
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel Changes
              </Button>
            )}
            <Button onClick={onSave} disabled={isLoading || isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (sortedFields.length + sortedDocuments.length + sortedForms.length) === 0 ? (
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