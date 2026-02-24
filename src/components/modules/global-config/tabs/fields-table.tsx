'use client';
// src/components/modules/global-config/tabs/fields-table.tsx
import clientLogger from '@/lib/client-logger';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ModalDialog, DialogRef } from '@/components/ui/modal-dialog';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface FieldsTableProps {
  fields: any[];
  isLoading: boolean;
  onToggleStatus: (fieldId: string, currentStatus: boolean) => void;
  onRefresh: () => void;
}

export function FieldsTable({ fields, isLoading, onToggleStatus, onRefresh }: FieldsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const editDialogRef = useRef<DialogRef>(null);
  const [selectedField, setSelectedField] = useState<any>(null);
  const { fetchWithAuth } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to get retention handling label
  const getRetentionLabel = (retention: string): string => {
    const retentionMap: Record<string, string> = {
      'no_delete': 'Don\'t delete',
      'customer_rule': 'Delete at customer rule',
      'global_rule': 'Delete at global rule',
      'none': 'None'
    };
    
    return retentionMap[retention] || retention;
  };
  
  // Filter fields based on search term and disabled status
  const filteredFields = fields.filter(field => {
    const matchesSearch = 
      field.fieldLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.dataType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.instructions?.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = showDisabled ? true : !field.disabled;
    
    return matchesSearch && matchesStatus;
  });

  // Handle field edit
  const handleEdit = (field: any) => {
    setSelectedField(field);
    if (editDialogRef.current) {
      editDialogRef.current.showModal();
    }
  };
  
  // Handle field update
  const handleUpdateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField) return;
    
    try {
      setIsUpdating(true);
      setError(null);
      
      const response = await fetchWithAuth(`/api/data-rx/fields/${selectedField.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldLabel: selectedField.fieldLabel,
          shortName: selectedField.shortName,
          dataType: selectedField.dataType,
          instructions: selectedField.instructions,
          retentionHandling: selectedField.retentionHandling,
          options: selectedField.options || [],
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update field');
      }
      
      // Close dialog and refresh data
      if (editDialogRef.current) {
        editDialogRef.current.close();
      }
      
      onRefresh();
    } catch (error) {
      clientLogger.error('Error updating field:', error);
      setError('Failed to update field. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="show-disabled" 
            checked={showDisabled}
            onCheckedChange={setShowDisabled}
          />
          <label htmlFor="show-disabled">Show disabled fields</label>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p>Loading fields...</p>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {searchTerm ? (
                <p>No fields matching "{searchTerm}"</p>
              ) : (
                <p>No fields have been created yet. Click "Add Data Field" to get started.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field Name</TableHead>
                  <TableHead>Short Name</TableHead>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Instructions</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFields.map((field) => (
                  <TableRow 
                    key={field.id}
                    className={field.disabled ? 'opacity-60' : ''}
                  >
                    <TableCell className="font-medium">{field.fieldLabel}</TableCell>
                    <TableCell>{field.shortName}</TableCell>
                    <TableCell>{field.dataType}</TableCell>
                    <TableCell className="truncate max-w-xs" title={field.instructions}>
                      {field.instructions || '-'}
                    </TableCell>
                    <TableCell>
                      {getRetentionLabel(field.retentionHandling || field.retention || 'none')}
                    </TableCell>
                    <TableCell>
                      {field.disabled ? (
                        <Badge variant="secondary">Disabled</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ActionDropdown
                        options={[
                          {
                            label: 'Edit',
                            onClick: () => handleEdit(field),
                            color: 'rgb(37, 99, 235)', // Blue color
                          },
                          {
                            label: field.disabled ? 'Enable' : 'Disable',
                            onClick: () => onToggleStatus(field.id, field.disabled),
                            color: field.disabled ? 'rgb(37, 99, 235)' : 'rgb(220, 38, 38)', // Blue or red color
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Field Dialog */}
      <ModalDialog
        ref={editDialogRef}
        title="Edit Data Field"
      >
        {selectedField && (
          <form onSubmit={handleUpdateField} className="space-y-4 py-4">
            {error && (
              <div className="px-4 py-3 rounded bg-red-50 text-red-500 border border-red-200 mb-4">
                {error}
              </div>
            )}
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="field-label" className="text-right">Field Label:</label>
              <input
                id="field-label"
                type="text"
                className="col-span-3 p-2 border rounded"
                value={selectedField.fieldLabel || ''}
                onChange={(e) => setSelectedField({ ...selectedField, fieldLabel: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="short-name" className="text-right">Short Name:</label>
              <input
                id="short-name"
                type="text"
                className="col-span-3 p-2 border rounded"
                value={selectedField.shortName || ''}
                onChange={(e) => setSelectedField({ ...selectedField, shortName: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="data-type" className="text-right">Data Type:</label>
              <select
                id="data-type"
                className="col-span-3 p-2 border rounded"
                value={selectedField.dataType || ''}
                onChange={(e) => setSelectedField({ ...selectedField, dataType: e.target.value })}
                required
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="select">Select (Drop-down)</option>
                <option value="checkbox">Checkbox</option>
                <option value="radio">Radio Buttons</option>
              </select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="retention-handling" className="text-right">Retention:</label>
              <select
                id="retention-handling"
                className="col-span-3 p-2 border rounded"
                value={selectedField.retentionHandling || ''}
                onChange={(e) => setSelectedField({ ...selectedField, retentionHandling: e.target.value })}
                required
              >
                <option value="no_delete">Don't delete</option>
                <option value="customer_rule">Delete at customer rule</option>
                <option value="global_rule">Delete at global rule</option>
              </select>
            </div>
            
            <div className="grid grid-cols-4 items-start gap-4">
              <label htmlFor="instructions" className="text-right pt-2">Instructions:</label>
              <textarea
                id="instructions"
                className="col-span-3 p-2 border rounded"
                value={selectedField.instructions || ''}
                onChange={(e) => setSelectedField({ ...selectedField, instructions: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => editDialogRef.current?.close()}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>
    </>
  );
}