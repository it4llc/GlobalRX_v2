// /GlobalRX_v2/src/components/comment-templates/CommentTemplateGrid.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useCommentTemplates } from '@/hooks/useCommentTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ModalDialog, DialogRef, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable, FormRow } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { CommentTemplate, CommentTemplateAvailability } from '@/lib/schemas/commentTemplateSchemas';

interface CommentTemplateGridProps {
  onTemplateSelect?: (template: CommentTemplate) => void;
}

export function CommentTemplateGrid({ onTemplateSelect }: CommentTemplateGridProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    templates,
    services,
    statuses,
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getAvailability,
    updateAvailability,
    refresh
  } = useCommentTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState<CommentTemplate | null>(null);
  const [availabilities, setAvailabilities] = useState<CommentTemplateAvailability[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  const [newTemplate, setNewTemplate] = useState({
    shortName: '',
    longName: '',
    templateText: ''
  });

  const [editTemplate, setEditTemplate] = useState({
    shortName: '',
    longName: '',
    templateText: '',
    isActive: true
  });

  const createDialogRef = useRef<DialogRef>(null);
  const editDialogRef = useRef<DialogRef>(null);

  // Comment management requires specific permission - only internal users with this
  // permission can create, edit, or configure comment templates
  const hasEditPermission = !!user?.permissions?.comment_management;

  // Load availability configuration whenever a template is selected
  // This enables the main workflow: select template → see its availability grid → edit grid
  useEffect(() => {
    if (selectedTemplate?.id) {
      loadAvailability(selectedTemplate.id);
    } else {
      setAvailabilities([]);
    }
  }, [selectedTemplate?.id]);

  const loadAvailability = async (templateId: string) => {
    try {
      const availData = await getAvailability(templateId);
      setAvailabilities(availData);
    } catch (error) {
      // Error is handled by the hook
      setAvailabilities([]);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const created = await createTemplate(newTemplate);
      createDialogRef.current?.close();
      setNewTemplate({ shortName: '', longName: '', templateText: '' });

      // Select the new template to show its grid
      setSelectedTemplate(created);
      refresh();
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    setIsUpdating(true);
    try {
      await updateTemplate(selectedTemplate.id!, editTemplate);
      editDialogRef.current?.close();
      refresh();
      // Reload to get updated template
      const updated = templates.find(t => t.id === selectedTemplate.id);
      if (updated) {
        setSelectedTemplate(updated);
      }
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    // Business rule: Templates that have been used can only be soft deleted (deactivated)
    // to preserve audit trail and prevent breaking existing data relationships.
    // Unused templates can be hard deleted (permanently removed from database)
    if (confirm(`Are you sure you want to ${selectedTemplate.hasBeenUsed ? 'deactivate' : 'permanently delete'} this template?`)) {
      try {
        await deleteTemplate(selectedTemplate.id!);
        editDialogRef.current?.close();
        setSelectedTemplate(null);
        refresh();
      } catch (error) {
        // Error is handled by the hook
      }
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
  };

  const handleEditTemplate = () => {
    if (!selectedTemplate) return;

    setEditTemplate({
      shortName: selectedTemplate.shortName,
      longName: selectedTemplate.longName,
      templateText: selectedTemplate.templateText,
      isActive: selectedTemplate.isActive
    });
    editDialogRef.current?.showModal();
  };

  const isAvailable = (serviceCode: string, status: string): boolean => {
    return availabilities?.some(
      a => a.serviceCode === serviceCode && a.status === status
    ) || false;
  };

  const toggleAvailability = (serviceCode: string, status: string) => {
    setAvailabilities(prev => {
      const exists = prev.some(a => a.serviceCode === serviceCode && a.status === status);
      if (exists) {
        return prev.filter(a => !(a.serviceCode === serviceCode && a.status === status));
      } else {
        return [...prev, { templateId: selectedTemplate?.id!, serviceCode, status } as CommentTemplateAvailability];
      }
    });
  };

  const toggleServiceCategory = (categoryServices: string[], status: string) => {
    setAvailabilities(prev => {
      const newAvailabilities = [...prev];

      // Check if all services in category are selected for this status
      const allSelected = categoryServices.every(serviceCode =>
        newAvailabilities.some(a => a.serviceCode === serviceCode && a.status === status)
      );

      if (allSelected) {
        // Category header checkbox behavior: if all services in category are selected,
        // clicking the category header deselects all services in that category for this status
        return newAvailabilities.filter(
          a => !(categoryServices.includes(a.serviceCode) && a.status === status)
        );
      } else {
        // Category header checkbox behavior: if any service in category is unselected,
        // clicking the category header selects all missing services in that category for this status
        categoryServices.forEach(serviceCode => {
          if (!newAvailabilities.some(a => a.serviceCode === serviceCode && a.status === status)) {
            newAvailabilities.push({
              templateId: selectedTemplate?.id!,
              serviceCode,
              status
            } as CommentTemplateAvailability);
          }
        });
        return newAvailabilities;
      }
    });
  };

  const toggleAllServices = (status: string) => {
    setAvailabilities(prev => {
      const allServiceCodes = services.map(s => s.code);

      // Check if all services are selected for this status
      const allSelected = allServiceCodes.every(serviceCode =>
        prev.some(a => a.serviceCode === serviceCode && a.status === status)
      );

      if (allSelected) {
        // "All" row checkbox behavior: if every service is selected for this status,
        // clicking "All" deselects all services for this entire status column
        return prev.filter(a => a.status !== status);
      } else {
        // "All" row checkbox behavior: if any service is unselected for this status,
        // clicking "All" selects every service for this status column
        // Remove existing selections for this status first to avoid duplicates
        const filtered = prev.filter(a => a.status !== status);
        const newItems = allServiceCodes.map(serviceCode => ({
          templateId: selectedTemplate?.id!,
          serviceCode,
          status
        } as CommentTemplateAvailability));
        return [...filtered, ...newItems];
      }
    });
  };

  const saveAvailability = async () => {
    if (!selectedTemplate) return;

    setIsSavingAvailability(true);
    try {
      await updateAvailability(selectedTemplate.id!, {
        availabilities: availabilities.map(a => ({
          serviceCode: a.serviceCode,
          status: a.status
        }))
      });
      // Optionally show success message
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setIsSavingAvailability(false);
    }
  };

  // Group services by category
  const servicesByCategory = services.reduce((acc, service) => {
    const category = service.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, typeof services>);

  // Define the status order to match typical workflow progression
  // These are hardcoded status columns as specified - represents the standard
  // order lifecycle: draft → submitted → processing → completed
  const displayStatuses = ['DRAFT', 'SUBMITTED', 'PROCESSING', 'COMPLETED'];

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600 p-4">Error: {error}</div>;
  }

  return (
    <div className="w-full p-4">
      <div className="space-y-6">
        {/* Template Management Controls */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium mb-2">
              {t('commentTemplates.selectTemplate')}
            </label>
            <Select
              value={selectedTemplate?.id || ""}
              onValueChange={handleTemplateSelect}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.filter(t => t.isActive).map((template) => (
                  <SelectItem key={template.id} value={template.id!}>
                    {template.shortName} - {template.longName}
                    {template.hasBeenUsed && ' 📌'}
                  </SelectItem>
                ))}
                {templates.filter(t => t.isActive).length === 0 && (
                  <div className="p-2 text-gray-500 text-sm">
                    No templates created yet
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => {
              setNewTemplate({ shortName: '', longName: '', templateText: '' });
              createDialogRef.current?.showModal();
            }}
            disabled={!hasEditPermission}
          >
            {t('commentTemplates.addNew')}
          </Button>
          {selectedTemplate && (
            <Button
              variant="outline"
              onClick={handleEditTemplate}
              disabled={!hasEditPermission}
            >
              Edit Selected
            </Button>
          )}
        </div>

        {/* Selected Template Details */}
        {selectedTemplate && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-medium mb-2">{selectedTemplate.shortName}</h3>
            <p className="text-gray-600 mb-2">{selectedTemplate.longName}</p>
            <p className="text-sm text-gray-500 italic">{selectedTemplate.templateText}</p>
          </div>
        )}

        {/* Availability Grid - Always visible when template is selected */}
        {selectedTemplate && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Availability Configuration: {selectedTemplate.shortName}
              </h3>
              <Button
                onClick={saveAvailability}
                disabled={!hasEditPermission || isSavingAvailability}
              >
                {isSavingAvailability ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Select when this template should be available based on service and order status.
              Click category names to select all services in that category.
            </p>
            <div className="overflow-x-auto border rounded-lg">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="w-48 sticky left-0 bg-gray-100 text-center">Service</TableHead>
                    {displayStatuses.map(status => (
                      <TableHead key={status} className="text-center min-w-[100px]">
                        {status}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* All Services Row */}
                  <TableRow className="bg-blue-50 font-bold border-b-2">
                    <TableCell className="sticky left-0 bg-blue-50">All</TableCell>
                    {displayStatuses.map(status => (
                      <TableCell key={`all-${status}`} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                          checked={services.every(s =>
                            isAvailable(s.code, status)
                          )}
                          onCheckedChange={() => toggleAllServices(status)}
                          disabled={!hasEditPermission}
                        />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>

                  {Object.entries(servicesByCategory).map(([category, categoryServices]) => (
                    <>
                      {/* Category Header Row */}
                      <TableRow key={`cat-${category}`} className="bg-gray-50 font-semibold">
                        <TableCell className="sticky left-0 bg-gray-50">{category}</TableCell>
                        {displayStatuses.map(status => (
                          <TableCell key={`${category}-${status}`} className="text-center">
                            <div className="flex justify-center">
                              <Checkbox
                              checked={categoryServices.every(s =>
                                isAvailable(s.code, status)
                              )}
                              onCheckedChange={() =>
                                toggleServiceCategory(categoryServices.map(s => s.code), status)
                              }
                              disabled={!hasEditPermission}
                            />
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                      {/* Service Rows */}
                      {categoryServices.map(service => (
                        <TableRow key={service.code} className="hover:bg-gray-50">
                          <TableCell className="pl-8 sticky left-0 bg-white">
                            └─ {service.name}
                          </TableCell>
                          {displayStatuses.map(status => (
                            <TableCell key={`${service.code}-${status}`} className="text-center">
                              <div className="flex justify-center">
                                <Checkbox
                                checked={isAvailable(service.code, status)}
                                onCheckedChange={() => toggleAvailability(service.code, status)}
                                disabled={!hasEditPermission}
                              />
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* When no template is selected */}
        {!selectedTemplate && templates.length > 0 && (
          <div className="text-center py-12 text-gray-500">
            Select a template from the dropdown above to configure its availability
          </div>
        )}

        {/* When no templates exist */}
        {templates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No comment templates have been created yet</p>
            <Button
              onClick={() => {
                setNewTemplate({ shortName: '', longName: '', templateText: '' });
                createDialogRef.current?.showModal();
              }}
              disabled={!hasEditPermission}
            >
              Create Your First Template
            </Button>
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <ModalDialog
        ref={createDialogRef}
        title="Create New Template"
        footer={
          <DialogFooter
            onCancel={() => createDialogRef.current?.close()}
            onConfirm={handleCreate}
            confirmText="Create"
            disabled={!newTemplate.shortName || !newTemplate.longName || !newTemplate.templateText}
            loading={isCreating}
          />
        }
      >
        <FormTable>
          <FormRow label="Short Name" required>
            <Input
              value={newTemplate.shortName}
              onChange={(e) => setNewTemplate({ ...newTemplate, shortName: e.target.value })}
              placeholder="e.g., Missing Doc"
              maxLength={50}
            />
            <div className="text-sm text-gray-500 mt-1">
              {newTemplate.shortName.length}/50 characters - Used in dropdowns
            </div>
          </FormRow>
          <FormRow label="Long Name" required>
            <Input
              value={newTemplate.longName}
              onChange={(e) => setNewTemplate({ ...newTemplate, longName: e.target.value })}
              placeholder="e.g., Document Required - Customer Must Provide"
              maxLength={100}
            />
            <div className="text-sm text-gray-500 mt-1">
              {newTemplate.longName.length}/100 characters - Descriptive display name
            </div>
          </FormRow>
          <FormRow label="Template Text" required>
            <Textarea
              value={newTemplate.templateText}
              onChange={(e) => setNewTemplate({ ...newTemplate, templateText: e.target.value })}
              placeholder="Enter the template text. Use [brackets] for placeholders that fulfillers will customize. Example: Please provide [document type] for [candidate name]"
              rows={5}
              maxLength={1000}
            />
            <div className="text-sm text-gray-500 mt-1">
              {newTemplate.templateText.length}/1000 characters
            </div>
          </FormRow>
        </FormTable>
      </ModalDialog>

      {/* Edit Template Dialog */}
      <ModalDialog
        ref={editDialogRef}
        title="Edit Template"
        footer={
          <div className="flex justify-between w-full">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!hasEditPermission}
            >
              {selectedTemplate?.hasBeenUsed ? 'Deactivate' : 'Delete'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => editDialogRef.current?.close()}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={!editTemplate.shortName || !editTemplate.longName || !editTemplate.templateText || isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        }
      >
        {selectedTemplate && (
          <FormTable>
            <FormRow label="Short Name" required>
              <Input
                value={editTemplate.shortName}
                onChange={(e) => setEditTemplate({ ...editTemplate, shortName: e.target.value })}
                maxLength={50}
              />
            </FormRow>
            <FormRow label="Long Name" required>
              <Input
                value={editTemplate.longName}
                onChange={(e) => setEditTemplate({ ...editTemplate, longName: e.target.value })}
                maxLength={100}
              />
            </FormRow>
            <FormRow label="Template Text" required>
              <Textarea
                value={editTemplate.templateText}
                onChange={(e) => setEditTemplate({ ...editTemplate, templateText: e.target.value })}
                rows={5}
                maxLength={1000}
              />
              <div className="text-sm text-gray-500 mt-1">
                {editTemplate.templateText.length}/1000 characters
              </div>
            </FormRow>
            <FormRow label="Active">
              <Checkbox
                checked={editTemplate.isActive}
                onCheckedChange={(checked) => setEditTemplate({ ...editTemplate, isActive: !!checked })}
              />
            </FormRow>
          </FormTable>
        )}
      </ModalDialog>
    </div>
  );
}