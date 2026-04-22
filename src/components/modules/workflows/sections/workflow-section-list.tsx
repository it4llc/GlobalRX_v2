'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { ActionDropdown } from '@/components/ui/action-dropdown';
// Using plain HTML table elements like FieldOrderSection for drag-and-drop compatibility
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlusCircle, GripVertical, Edit, Trash2, Lock } from 'lucide-react';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';
import { MAX_SECTIONS_PER_PLACEMENT } from '@/types/workflow-section';

interface WorkflowSection {
  id: string;
  name: string;
  placement: 'before_services' | 'after_services';
  type: 'text' | 'document';
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  displayOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowSectionListProps {
  workflowId: string;
  onAddSection: (placement?: 'before_services' | 'after_services') => void;
  onEditSection: (section: WorkflowSection) => void;
  refreshTrigger?: number;
  hasActiveOrders?: boolean;
}

export function WorkflowSectionList({
  workflowId,
  onAddSection,
  onEditSection,
  refreshTrigger,
  hasActiveOrders = false,
}: WorkflowSectionListProps) {
  const { t } = useTranslation();
  const { fetchWithAuth, checkPermission } = useAuth();

  const [sections, setSections] = useState<WorkflowSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<WorkflowSection | null>(null);

  const canEdit = checkPermission('customer_config', 'edit') || checkPermission('admin');

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch sections
  const fetchSections = async () => {
    if (!workflowId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/api/workflows/${workflowId}/sections`);

      if (!response.ok) {
        throw new Error(`Failed to fetch sections: ${response.status}`);
      }

      const data = await response.json();
      setSections(data.sections || []);
    } catch (err) {
      const logMeta = errorToLogMeta(err);
      clientLogger.error('Failed to fetch workflow sections', logMeta);
      setError('Failed to load workflow sections');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [workflowId, refreshTrigger]);

  // Group sections by placement
  const beforeServicesSections = sections
    .filter((s) => s.placement === 'before_services')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const afterServicesSections = sections
    .filter((s) => s.placement === 'after_services')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Handle drag and drop
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || hasActiveOrders) return;

    // Find which placement group this drag is in
    const activeSection = sections.find(s => s.id === active.id);
    const overSection = sections.find(s => s.id === over.id);

    if (!activeSection || !overSection || activeSection.placement !== overSection.placement) return;

    const placement = activeSection.placement;
    const sourceSections = placement === 'before_services' ? beforeServicesSections : afterServicesSections;

    const oldIndex = sourceSections.findIndex((s) => s.id === active.id);
    const newIndex = sourceSections.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSections = arrayMove(sourceSections, oldIndex, newIndex);

    // Update display orders
    const updates = reorderedSections.map((section, index) => ({
      ...section,
      displayOrder: index,
    }));

    // Optimistically update UI
    setSections((prev) => {
      const otherSections = prev.filter((s) => s.placement !== placement);
      return [...otherSections, ...updates];
    });

    setIsReordering(true);

    try {
      // Send updates to server
      for (const section of updates) {
        if (section.displayOrder !== sourceSections.find((s) => s.id === section.id)?.displayOrder) {
          const response = await fetchWithAuth(
            `/api/workflows/${workflowId}/sections/${section.id}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ displayOrder: section.displayOrder }),
            }
          );

          if (!response.ok) {
            throw new Error('Failed to update section order');
          }
        }
      }

      clientLogger.info('Section order updated', { workflowId, placement });
    } catch (err) {
      const logMeta = errorToLogMeta(err);
      clientLogger.error('Failed to reorder sections', logMeta);
      setError('Failed to update section order');
      await fetchSections(); // Reload to get correct order
    } finally {
      setIsReordering(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!sectionToDelete || hasActiveOrders) return;

    setIsDeleting(sectionToDelete.id);
    setDeleteDialogOpen(false);

    try {
      const response = await fetchWithAuth(
        `/api/workflows/${workflowId}/sections/${sectionToDelete.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('This workflow has active orders and cannot be modified');
        }
        throw new Error('Failed to delete section');
      }

      clientLogger.info('Section deleted', {
        sectionId: sectionToDelete.id,
        workflowId,
      });

      await fetchSections();
    } catch (err) {
      const logMeta = errorToLogMeta(err);
      clientLogger.error('Failed to delete section', logMeta);
      setError(logMeta.message || 'Failed to delete section');
    } finally {
      setIsDeleting(null);
      setSectionToDelete(null);
    }
  };

  // Sortable row component
  const SortableRow = ({ section, index }: { section: WorkflowSection; index: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: section.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={`border-t hover:bg-muted/50 ${isDragging ? 'opacity-50' : ''} ${
          isDeleting === section.id ? 'opacity-50' : ''
        }`}
      >
        {canEdit && !hasActiveOrders && (
          <td className="p-2">
            <div
              className="flex items-center cursor-move"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          </td>
        )}
        <td className="p-2 font-medium">{section.name}</td>
        <td className="p-2">
          <Badge variant={section.type === 'text' ? 'default' : 'secondary'}>
            {section.type === 'text' ? 'Text' : 'Document'}
          </Badge>
        </td>
        <td className="p-2">
          {section.isRequired ? (
            <Badge variant="destructive">Required</Badge>
          ) : (
            <Badge variant="outline">Optional</Badge>
          )}
        </td>
        <td className="p-2 max-w-xs truncate">
          {section.type === 'text'
            ? section.content
              ? `${section.content.substring(0, 50)}...`
              : 'No content'
            : section.fileName || 'No file uploaded'}
        </td>
        <td className="p-2">
          <ActionDropdown
            options={[
              {
                label: 'Edit',
                onClick: () => onEditSection(section),
                color: hasActiveOrders ? '#ccc' : 'rgb(37, 99, 235)',
              },
              {
                label: 'Delete',
                onClick: hasActiveOrders || isDeleting === section.id
                  ? () => {}
                  : () => {
                      setSectionToDelete(section);
                      setDeleteDialogOpen(true);
                    },
                color: hasActiveOrders || isDeleting === section.id ? '#ccc' : 'rgb(220, 38, 38)',
              }
            ]}
          />
        </td>
      </tr>
    );
  };

  const renderSectionGroup = (
    title: string,
    placement: 'before_services' | 'after_services',
    sectionList: WorkflowSection[]
  ) => {
    const sectionCount = sectionList.length;
    const isAtLimit = sectionCount >= MAX_SECTIONS_PER_PLACEMENT;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Badge variant="secondary">
              {sectionCount}/{MAX_SECTIONS_PER_PLACEMENT} sections
            </Badge>
            {hasActiveOrders && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          {canEdit && !hasActiveOrders && (
            <Button
              onClick={() => onAddSection(placement)}
              disabled={isAtLimit}
              size="sm"
              variant="outline"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          )}
        </div>

        {isAtLimit && !hasActiveOrders && (
          <AlertBox
            type="warning"
            message={`Maximum ${MAX_SECTIONS_PER_PLACEMENT} sections allowed per placement`}
            className="mb-4"
          />
        )}

        {sectionList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            No sections in this placement
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {canEdit && !hasActiveOrders && <th className="p-2 text-left w-12"></th>}
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Required</th>
                  <th className="p-2 text-left">Content/File</th>
                  <th className="p-2 text-left w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                <SortableContext
                  items={sectionList.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sectionList.map((section, index) => (
                    <SortableRow key={section.id} section={section} index={index} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <AlertBox type="error" message={error} />;
  }

  return (
    <>
      {hasActiveOrders && (
        <AlertBox
          type="warning"
          message="This workflow has active orders and cannot be modified. Complete or cancel all active orders to enable editing."
          className="mb-6"
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        {renderSectionGroup('Before Services', 'before_services', beforeServicesSections)}
        {renderSectionGroup('After Services', 'after_services', afterServicesSections)}
      </DndContext>

      {isReordering && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <LoadingIndicator />
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the section "{sectionToDelete?.name}"? This action
              cannot be undone.
              {sectionToDelete?.type === 'document' && sectionToDelete?.fileName && (
                <span className="block mt-2">
                  The associated document ({sectionToDelete.fileName}) will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}