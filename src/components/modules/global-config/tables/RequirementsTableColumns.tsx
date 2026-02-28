// Column definitions for Requirements Table
import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Requirement } from '@/types';
import { cn } from '@/lib/utils';

// Location interface - should match the one in RequirementsDataTable.tsx
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

interface UseRequirementsColumnsProps {
  sortedFields: Requirement[];
  sortedDocuments: Requirement[];
  sortedForms: Requirement[];
  onRequirementToggle: (locationId: string, requirementId: string) => void;
  onAvailabilityToggle: (locationId: string) => void;
  isRequirementSelected: (locationId: string, requirementId: string) => boolean;
  isLocationAvailable: (locationId: string) => boolean;
  disabled?: boolean;
}

export function useRequirementsColumns({
  sortedFields,
  sortedDocuments,
  sortedForms,
  onRequirementToggle,
  onAvailabilityToggle,
  isRequirementSelected,
  isLocationAvailable,
  disabled = false,
}: UseRequirementsColumnsProps): ColumnDef<Location>[] {
  return useMemo(() => {
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
          const isChecked = isLocationAvailable(location.id);
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onAvailabilityToggle(location.id)}
                disabled={disabled}
              />
            </div>
          );
        },
      },
    ];

    // Create requirement checkbox column factory
    const createRequirementColumn = (requirement: Requirement, type: string): ColumnDef<Location> => ({
      id: `${type}-${requirement.id}`,
      header: () => (
        <div className="text-xs text-center break-words leading-tight" title={requirement.description || requirement.name}>
          {requirement.name}
        </div>
      ),
      size: 80,
      cell: ({ row }) => {
        const location = row.original;
        const isChecked = isRequirementSelected(location.id, requirement.id);
        const isAvailable = isLocationAvailable(location.id);
        return (
          <div className="flex justify-center">
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onRequirementToggle(location.id, requirement.id)}
              disabled={disabled || !isAvailable}
              className={cn(!isAvailable && 'opacity-50')}
            />
          </div>
        );
      },
    });

    // Add requirement columns
    const requirementColumns: ColumnDef<Location>[] = [
      ...sortedFields.map(field => createRequirementColumn(field, 'field')),
      ...sortedDocuments.map(doc => createRequirementColumn(doc, 'doc')),
      ...sortedForms.map(form => createRequirementColumn(form, 'form')),
    ];

    return [...baseColumns, ...requirementColumns];
  }, [
    sortedFields,
    sortedDocuments,
    sortedForms,
    onRequirementToggle,
    onAvailabilityToggle,
    isRequirementSelected,
    isLocationAvailable,
    disabled,
  ]);
}