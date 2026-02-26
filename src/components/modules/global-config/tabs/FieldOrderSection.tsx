// src/components/modules/global-config/tabs/FieldOrderSection.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { clientLogger, errorToLogMeta } from '@/lib/client-logger';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Helper function to format data type labels
function getDataTypeLabel(dataType: string): string {
  const typeLabels: Record<string, string> = {
    'text': 'Text',
    'number': 'Number',
    'date': 'Date',
    'select': 'Select',
    'checkbox': 'Checkbox',
    'radio': 'Radio',
    'textarea': 'Text Area',
    'email': 'Email',
    'phone': 'Phone',
    'url': 'URL',
    'file': 'File Upload'
  };
  return typeLabels[dataType] || dataType;
}

interface FieldOrderItem {
  requirementId: string;
  name: string;
  type: string;
  dataType?: string;
  collectionTab?: string;
  displayOrder: number;
}

interface FieldOrderSectionProps {
  serviceId: string;
  serviceName: string;
  requirements: any[];
  onOrderChanged?: () => void;
}

// Sortable item component
function SortableField({ field }: { field: FieldOrderItem }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.requirementId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t hover:bg-gray-50 ${isDragging ? 'opacity-50' : ''}`}
    >
      <td className="p-2">
        <div
          className="flex items-center cursor-move"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-gray-400 mr-1" />
        </div>
      </td>
      <td className="p-2 font-medium">{field.name}</td>
      <td className="p-2 text-sm text-gray-600">
        {field.type === 'field'
          ? getDataTypeLabel(field.dataType || 'text')
          : 'Document'}
      </td>
    </tr>
  );
}

export function FieldOrderSection({
  serviceId,
  serviceName,
  requirements,
  onOrderChanged
}: FieldOrderSectionProps) {
  const [personalInfoFields, setPersonalInfoFields] = useState<FieldOrderItem[]>([]);
  const [searchInfoFields, setSearchInfoFields] = useState<FieldOrderItem[]>([]);
  const [documentFields, setDocumentFields] = useState<FieldOrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { fetchWithAuth } = useAuth();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize field order from requirements
  useEffect(() => {
    clientLogger.debug('🔄 FieldOrderSection: Initializing with requirements for service:', serviceId);
    clientLogger.debug('📊 Raw requirements received:', requirements.map((r: any) => ({
      id: r.id,
      name: r.name,
      displayOrder: r.displayOrder,
      displayOrderType: typeof r.displayOrder
    })));

    if (requirements.length === 0) {
      clientLogger.debug('⚠️ No requirements received, skipping initialization');
      return;
    }

    const fields: FieldOrderItem[] = requirements.map((req: any) => {
      // Get collection tab from field data if it's a field type
      let collectionTab = 'subject'; // default
      if (req.type === 'field' && req.fieldData) {
        const fieldData = typeof req.fieldData === 'string'
          ? JSON.parse(req.fieldData)
          : req.fieldData;
        collectionTab = fieldData.collectionTab || 'subject';
      }

      const fieldOrder = {
        requirementId: req.id,
        name: req.name || req.fieldLabel || req.documentName,
        type: req.type,
        dataType: req.dataType,
        collectionTab,
        displayOrder: req.displayOrder || 999
      };

      clientLogger.debug(`📌 Mapping field: ${fieldOrder.name} -> displayOrder: ${fieldOrder.displayOrder} (tab: ${collectionTab})`);

      return fieldOrder;
    });

    // Separate into sections: documents get their own section, then personal vs search for fields
    const documentFieldsList = fields.filter(f => f.type === 'document');
    const personalFields = fields.filter(f => f.type === 'field' && f.collectionTab === 'subject');
    const searchFields = fields.filter(f => f.type === 'field' && f.collectionTab !== 'subject');

    // Sort each section independently by display order
    personalFields.sort((a, b) => a.displayOrder - b.displayOrder);
    searchFields.sort((a, b) => a.displayOrder - b.displayOrder);
    documentFieldsList.sort((a, b) => a.displayOrder - b.displayOrder);

    clientLogger.debug('🔢 Personal Info fields after sorting:', personalFields.map((f: any) => `${f.name}(${f.displayOrder})`).join(', '));
    clientLogger.debug('🔢 Search Info fields after sorting:', searchFields.map((f: any) => `${f.name}(${f.displayOrder})`).join(', '));
    clientLogger.debug('🔢 Document fields after sorting:', documentFieldsList.map((f: any) => `${f.name}(${f.displayOrder})`).join(', '));

    setPersonalInfoFields(personalFields);
    setSearchInfoFields(searchFields);
    setDocumentFields(documentFieldsList);
    setHasChanges(false);
  }, [requirements, serviceId]); // Re-run when requirements or serviceId changes

  // Handle drag end for personal info fields
  const handlePersonalDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = personalInfoFields.findIndex(f => f.requirementId === active.id);
      const newIndex = personalInfoFields.findIndex(f => f.requirementId === over.id);

      const newFields = [...personalInfoFields];
      const [movedField] = newFields.splice(oldIndex, 1);
      newFields.splice(newIndex, 0, movedField);

      setPersonalInfoFields(newFields);
      setHasChanges(true);
    }
  };

  // Handle drag end for search info fields
  const handleSearchDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = searchInfoFields.findIndex(f => f.requirementId === active.id);
      const newIndex = searchInfoFields.findIndex(f => f.requirementId === over.id);

      const newFields = [...searchInfoFields];
      const [movedField] = newFields.splice(oldIndex, 1);
      newFields.splice(newIndex, 0, movedField);

      setSearchInfoFields(newFields);
      setHasChanges(true);
    }
  };

  // Handle drag end for document fields
  const handleDocumentDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = documentFields.findIndex(f => f.requirementId === active.id);
      const newIndex = documentFields.findIndex(f => f.requirementId === over.id);

      const newFields = [...documentFields];
      const [movedField] = newFields.splice(oldIndex, 1);
      newFields.splice(newIndex, 0, movedField);

      setDocumentFields(newFields);
      setHasChanges(true);
    }
  };

  // Save the new order to the backend
  const saveOrder = async () => {
    setIsSaving(true);

    try {
      // Assign display orders with section prefixes to maintain proper grouping
      // Personal Info fields: 1000, 1010, 1020, etc.
      // Search Info fields: 2000, 2010, 2020, etc.
      // Document fields: 3000, 3010, 3020, etc.
      const personalOrders = personalInfoFields.map((field, index) => ({
        requirementId: field.requirementId,
        displayOrder: 1000 + (index * 10),
        section: 'personal',
        name: field.name
      }));

      const searchOrders = searchInfoFields.map((field, index) => ({
        requirementId: field.requirementId,
        displayOrder: 2000 + (index * 10),
        section: 'search',
        name: field.name
      }));

      const documentOrders = documentFields.map((field, index) => ({
        requirementId: field.requirementId,
        displayOrder: 3000 + (index * 10),
        section: 'documents',
        name: field.name
      }));

      const fieldOrders = [...personalOrders, ...searchOrders, ...documentOrders].map(({ requirementId, displayOrder }) => ({
        requirementId,
        displayOrder
      }));

      clientLogger.debug('💾 Saving field orders for service:', serviceId);
      clientLogger.debug('💾 Personal Info order:', personalOrders.map((fo: any) => `${fo.name}=${fo.displayOrder}`).join(', '));
      clientLogger.debug('💾 Search Info order:', searchOrders.map((fo: any) => `${fo.name}=${fo.displayOrder}`).join(', '));
      clientLogger.debug('💾 Document order:', documentOrders.map((fo: any) => `${fo.name}=${fo.displayOrder}`).join(', '));
      clientLogger.debug('💾 All field orders being sent:', [...personalOrders, ...searchOrders, ...documentOrders]);

      const response = await fetchWithAuth('/api/dsx/update-field-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          fieldOrders
        })
      });

      if (!response.ok) {
        const error = await response.text();
        clientLogger.error('Failed to save field order:', error);
        throw new Error('Failed to save field order');
      }

      const result = await response.json();
      clientLogger.debug('💾 Save result:', result);
      if (result.createdCount > 0) {
        clientLogger.warn('⚠️ Had to CREATE missing ServiceRequirement records:', result.created);
      }
      if (result.failedCount > 0) {
        clientLogger.error('❌ Failed to update some records:', result.failed);
      }

      setHasChanges(false);

      if (onOrderChanged) {
        clientLogger.debug('Calling onOrderChanged callback');
        onOrderChanged();
      }
    } catch (error: unknown) {
      clientLogger.error('Error saving field order:', error);
      alert('Failed to save field order. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original order from database
  const resetToOriginal = () => {
    // Re-initialize from the requirements prop (which should be the saved order from DB)
    const fields: FieldOrderItem[] = requirements.map((req: any) => {
      let collectionTab = 'subject';
      if (req.type === 'field' && req.fieldData) {
        const fieldData = typeof req.fieldData === 'string'
          ? JSON.parse(req.fieldData)
          : req.fieldData;
        collectionTab = fieldData.collectionTab || 'subject';
      }
      return {
        requirementId: req.id,
        name: req.name || req.fieldLabel || req.documentName,
        type: req.type,
        dataType: req.dataType,
        collectionTab,
        displayOrder: req.displayOrder || 999
      };
    });

    // Separate into sections: documents get their own section, then personal vs search for fields
    const documentFieldsList = fields.filter(f => f.type === 'document');
    const personalFields = fields.filter(f => f.type === 'field' && f.collectionTab === 'subject');
    const searchFields = fields.filter(f => f.type === 'field' && f.collectionTab !== 'subject');

    // Sort each section independently
    personalFields.sort((a, b) => a.displayOrder - b.displayOrder);
    searchFields.sort((a, b) => a.displayOrder - b.displayOrder);
    documentFieldsList.sort((a, b) => a.displayOrder - b.displayOrder);

    setPersonalInfoFields(personalFields);
    setSearchInfoFields(searchFields);
    setDocumentFields(documentFieldsList);
    setHasChanges(false);
  };

  if (personalInfoFields.length === 0 && searchInfoFields.length === 0 && documentFields.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Field Display Order for {serviceName}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToOriginal}
              disabled={isSaving || !hasChanges}
            >
              Cancel Changes
            </Button>
            <Button
              size="sm"
              onClick={saveOrder}
              disabled={!hasChanges || isSaving}
              className={hasChanges ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {isSaving ? 'Saving...' : hasChanges ? 'Save Order' : 'Order Saved'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Drag and drop fields to control the order they appear in the order entry form. Fields are organized by their collection tab.
        </p>

        {/* Personal Info Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-700 mb-2">Personal Info Fields</h4>
          <div className="border rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handlePersonalDragEnd}
            >
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">Field Name</th>
                    <th className="p-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={personalInfoFields.map((f: any) => f.requirementId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {personalInfoFields.length > 0 ? (
                      personalInfoFields.map((field: any) => (
                        <SortableField key={field.requirementId} field={field} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No personal info fields
                        </td>
                      </tr>
                    )}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>

        {/* Search Info Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-700 mb-2">Search Info Fields</h4>
          <div className="border rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSearchDragEnd}
            >
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">Field Name</th>
                    <th className="p-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={searchInfoFields.map((f: any) => f.requirementId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {searchInfoFields.length > 0 ? (
                      searchInfoFields.map((field: any) => (
                        <SortableField key={field.requirementId} field={field} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No search info fields
                        </td>
                      </tr>
                    )}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>

        {/* Documents Section */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-700 mb-2">Documents</h4>
          <div className="border rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDocumentDragEnd}
            >
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left w-12"></th>
                    <th className="p-2 text-left">Document Name</th>
                    <th className="p-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <SortableContext
                    items={documentFields.map((f: any) => f.requirementId)}
                    strategy={verticalListSortingStrategy}
                  >
                    {documentFields.length > 0 ? (
                      documentFields.map((field: any) => (
                        <SortableField key={field.requirementId} field={field} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-500">
                          No documents
                        </td>
                      </tr>
                    )}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>

        {hasChanges && (
          <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            You have unsaved changes. Click "Save Order" to apply them.
          </div>
        )}
      </CardContent>
    </Card>
  );
}