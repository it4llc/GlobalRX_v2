'use client';
import clientLogger from '@/lib/client-logger';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useTranslation } from '@/contexts/TranslationContext';
import { useAuth } from '@/contexts/AuthContext'; // Ensure this is from contexts, NOT from hooks
import { Button } from '@/components/ui/button';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { PlusCircle, GripVertical, Edit, Trash2, AlertTriangle } from 'lucide-react';

interface WorkflowSection {
  id: string;
  name: string;
  displayOrder: number;
  isRequired: boolean;
  dependsOnSection?: string | null;
  dependencyLogic?: string | null;
  sectionType?: string;
  configuration?: any;
  createdAt: string;
  updatedAt: string;
  dependentOn?: {
    id: string;
    name: string;
  } | null;
  dependentSections?: {
    id: string;
    name: string;
  }[];
}

interface WorkflowSectionListProps {
  workflowId: string;
  onAddSection: () => void;
  onEditSection: (section: WorkflowSection) => void;
}

export function WorkflowSectionList({
  workflowId,
  onAddSection,
  onEditSection
}: WorkflowSectionListProps) {
  const { t } = useTranslation();
  const { fetchWithAuth, checkPermission } = useAuth();
  
  const [sections, setSections] = useState<WorkflowSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  
  // Check permissions for both workflows and customers
  const canEdit = checkPermission('workflows', 'edit') || 
                  checkPermission('customers', 'edit') || 
                  checkPermission('admin');

  // Fetch sections
  useEffect(() => {
    if (!workflowId) return;
    
    const fetchSections = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetchWithAuth(`/api/workflows/${workflowId}/sections`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch sections: ${response.status}`);
        }
        
        const data = await response.json();
        // Sort sections by displayOrder
        const sortedSections = [...data].sort((a, b) => a.displayOrder - b.displayOrder);
        setSections(sortedSections);
      } catch (err) {
        clientLogger.error('Error fetching workflow sections:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSections();
  }, [workflowId, fetchWithAuth, refreshKey]);
  
  // Handle drag end event
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source } = result;
    
    // Return if dropped outside the list or at the same position
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }
    
    // Reorder the sections array
    const reorderedSections = Array.from(sections);
    const [movedSection] = reorderedSections.splice(source.index, 1);
    reorderedSections.splice(destination.index, 0, movedSection);
    
    // Update display order for each section
    const sectionsWithNewOrder = reorderedSections.map((section, index) => ({
      ...section,
      displayOrder: index
    }));
    
    // Optimistically update the UI
    setSections(sectionsWithNewOrder);
    
    // Call the API to update the order
    setIsReordering(true);
    try {
      const response = await fetchWithAuth(`/api/workflows/${workflowId}/sections`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sections: sectionsWithNewOrder.map(section => ({
            id: section.id,
            displayOrder: section.displayOrder
          }))
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update section order: ${response.status}`);
      }
      
      // Update with server response to ensure consistency
      const updatedSections = await response.json();
      setSections(updatedSections);
    } catch (err) {
      clientLogger.error('Error updating section order:', err);
      setError(err instanceof Error ? err.message : 'Failed to update section order');
      // Refresh to get the correct order from the server
      setRefreshKey(prev => prev + 1);
    } finally {
      setIsReordering(false);
    }
  };

  // Handle section deletion
  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm(t('module.candidateWorkflow.confirmDeleteSection', 'Are you sure you want to delete this section?'))) {
      return;
    }
    
    setIsDeleting(sectionId);
    
    try {
      const response = await fetchWithAuth(`/api/workflows/${workflowId}/sections/${sectionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        // Try to parse error message
        let errorMessage = `Failed to delete section (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // Ignore parsing error
        }
        
        throw new Error(errorMessage);
      }
      
      // Remove the section from the state
      setSections(sections.filter(section => section.id !== sectionId));
    } catch (err) {
      clientLogger.error('Error deleting section:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsDeleting(null);
    }
  };
  
  // Format dependency information for display
  const formatDependency = (section: WorkflowSection) => {
    if (!section.dependentOn) return null;
    
    return (
      <div className="text-sm text-gray-500 mt-1">
        <span className="font-medium">{t('module.candidateWorkflow.dependsOn', 'Depends on')}:</span> {section.dependentOn.name}
      </div>
    );
  };
  
  // Check if a section has dependent sections
  const hasDependentSections = (sectionId: string) => {
    return sections.some(section => section.dependsOnSection === sectionId);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center my-8">
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <AlertBox
        type="error"
        title={t('common.error', 'Error')}
        message={error}
        action={
          <Button onClick={() => setRefreshKey(prev => prev + 1)}>
            {t('common.retry', 'Retry')}
          </Button>
        }
      />
    );
  }

  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded-md p-8 flex flex-col items-center justify-center text-center">
          <div className="text-gray-400 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-2">
            {t('module.candidateWorkflow.noSections', 'No Sections Created')}
          </h3>
          <p className="text-gray-500 max-w-md mb-6">
            {t('module.candidateWorkflow.noSectionsDescription', 'This workflow doesn\'t have any sections yet. Sections help organize the candidate workflow into logical steps.')}
          </p>
          {canEdit && (
            <Button onClick={onAddSection}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {t('module.candidateWorkflow.createFirstSection', 'Create First Section')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          {t('module.candidateWorkflow.sections', 'Workflow Sections')}
        </h2>
        {canEdit && (
          <Button onClick={onAddSection}>
            <PlusCircle className="h-4 w-4 mr-2" />
            {t('module.candidateWorkflow.addSection', 'Add Section')}
          </Button>
        )}
      </div>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable 
          droppableId="workflow-sections" 
          isDropDisabled={!canEdit || isReordering} 
          isCombineEnabled={false}
          ignoreContainerClipping={false}
        >
          {(provided) => (
            <div 
              className="border border-gray-200 rounded-md overflow-hidden"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              <div className="divide-y divide-gray-200">
                {sections.map((section, index) => (
                  <Draggable 
                    key={section.id} 
                    draggableId={section.id} 
                    index={index}
                    isDragDisabled={!canEdit || isReordering}
                  >
                    {(provided, snapshot) => (
                      <div 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white p-4 flex items-start ${snapshot.isDragging ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        {/* Drag handle */}
                        <div 
                          className="flex-shrink-0 pt-1 pr-3 cursor-move text-gray-400"
                          {...provided.dragHandleProps}
                        >
                          <GripVertical size={20} />
                        </div>
                        
                        {/* Section content */}
                        <div className="flex-grow">
                          <div className="flex items-center">
                            <h3 className="font-medium text-gray-900">{section.name}</h3>
                            {/* Section Type Badge */}
                            <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                              {section.sectionType === 'form' ? t('module.candidateWorkflow.sectionTypes.form', 'Form/Notice') :
                               section.sectionType === 'idInfo' ? t('module.candidateWorkflow.sectionTypes.idInfo', 'ID Information') :
                               section.sectionType === 'personalInfo' ? t('module.candidateWorkflow.sectionTypes.personalInfo', 'Personal Information') :
                               section.sectionType === 'employment' ? t('module.candidateWorkflow.sectionTypes.employment', 'Employment') :
                               section.sectionType === 'education' ? t('module.candidateWorkflow.sectionTypes.education', 'Education') :
                               section.sectionType === 'other' ? t('module.candidateWorkflow.sectionTypes.other', 'Other') :
                               section.sectionType === 'documents' ? t('module.candidateWorkflow.sectionTypes.documents', 'Document Collection') :
                               section.sectionType === 'summary' ? t('module.candidateWorkflow.sectionTypes.summary', 'Summary') :
                               section.sectionType === 'consent' ? t('module.candidateWorkflow.sectionTypes.consent', 'Consent') :
                               section.sectionType || 'Unknown'
                              }
                            </span>
                            {!section.isRequired && (
                              <span className="ml-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">
                                {t('common.optional', 'Optional')}
                              </span>
                            )}
                          </div>
                          
                          {formatDependency(section)}
                          
                          {/* Display warning if other sections depend on this one */}
                          {hasDependentSections(section.id) && (
                            <div className="mt-2 text-amber-600 text-sm flex items-center">
                              <AlertTriangle size={14} className="mr-1" />
                              {t('module.candidateWorkflow.hasDependent', 'Other sections depend on this one')}
                            </div>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex-shrink-0 flex space-x-2">
                          {canEdit && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onEditSection(section)}
                                title={t('common.edit', 'Edit')}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSection(section.id)}
                                disabled={isDeleting === section.id || hasDependentSections(section.id)}
                                title={hasDependentSections(section.id) 
                                  ? t('module.candidateWorkflow.cannotDelete', 'Cannot delete - other sections depend on this one') 
                                  : t('common.delete', 'Delete')}
                                className={hasDependentSections(section.id) ? 'opacity-50 cursor-not-allowed' : ''}
                              >
                                {isDeleting === section.id ? (
                                  <LoadingIndicator size="sm" />
                                ) : (
                                  <Trash2 size={16} className="text-red-500" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
              
              {/* Show reordering indicator */}
              {isReordering && (
                <div className="flex justify-center items-center p-4 bg-blue-50 border-t border-blue-100">
                  <LoadingIndicator size="sm" className="mr-2" />
                  <span className="text-sm text-blue-600">
                    {t('module.candidateWorkflow.savingOrder', 'Saving new order...')}
                  </span>
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}