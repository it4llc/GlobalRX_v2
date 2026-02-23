// src/components/modules/global-config/tabs/data-rx-tab.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FieldData, AddFieldModal } from './add-field-modal';
import { DocumentData, AddDocumentModal } from './add-document-modal';
import { EditFieldModal } from './edit-field-modal';
import { DocumentsTable } from './documents-table';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { ActionDropdown } from '@/components/ui/action-dropdown';
import { DialogRef, ModalDialog } from '@/components/ui/modal-dialog';
import { Shield, ShieldCheck } from 'lucide-react';

interface DataField {
  id: string;
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
  requiresVerification?: boolean;
  options?: Array<{ value: string; label: string }>;
  disabled?: boolean;
  services?: Array<{ id: string, name: string }>;
  collectionTab?: string;
  addressConfig?: any;
}

interface Document {
  id: string;
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling?: string;
  disabled?: boolean;
  services?: Array<{ id: string, name: string }>;
  filePath?: string;
  documentData?: any; // This can be a string or an object
}

enum TabType {
  Fields = 'fields',
  Documents = 'documents'
}

export function DataRxTab() {
  // State for active inner tab (fields or documents)
  const [activeTab, setActiveTab] = useState<TabType>(TabType.Fields);

  // State for data fields and documents
  const [dataFields, setDataFields] = useState<DataField[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  
  // State for modals
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
  // Reference for the options dialog
  const optionsDialogRef = useRef<DialogRef>(null);
  const [selectedOptions, setSelectedOptions] = useState<{ label: string, options: Array<{value: string, label: string}> } | null>(null);
  
  // Reference for the services dialog
  const servicesDialogRef = useRef<DialogRef>(null);
  const [selectedServices, setSelectedServices] = useState<{ name: string, services: Array<{ id: string, name: string }> } | null>(null);
  
  // State for loading and errors
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { fetchWithAuth } = useAuth();
  
  // Fetch data fields and documents
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch data fields
      const fieldsResponse = await fetchWithAuth('/api/data-rx/fields?includeServices=true');
      if (!fieldsResponse.ok) {
        throw new Error('Failed to fetch data fields');
      }
      const fieldsData = await fieldsResponse.json();
      setDataFields(fieldsData.fields || []);
      
      // Fetch documents
      const documentsResponse = await fetchWithAuth('/api/data-rx/documents?includeServices=true');
      if (!documentsResponse.ok) {
        throw new Error('Failed to fetch documents');
      }
      const documentsData = await documentsResponse.json();
      setDocuments(documentsData.documents || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);
  
  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Track mouse position for positioning the dialog
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Handle opening the options dialog
  const handleShowOptions = (field: DataField, event?: React.MouseEvent) => {
    if (field.options && field.options.length > 0) {
      // Set options to display
      setSelectedOptions({
        label: field.fieldLabel,
        options: field.options
      });
      
      // Save click coordinates for positioning
      if (event) {
        setMousePosition({ 
          x: event.clientX, 
          y: event.clientY 
        });
      }
      
      // Show the dialog
      setTimeout(() => {
        optionsDialogRef.current?.showModal();
      }, 10);
    }
  };
  
  // Handle opening the services dialog
  const handleShowServices = (item: DataField | Document, event?: React.MouseEvent) => {
    if (item.services && item.services.length > 0) {
      // Set services to display
      setSelectedServices({
        name: 'fieldLabel' in item ? item.fieldLabel : item.documentName,
        services: item.services
      });
      
      // Save click coordinates for positioning
      if (event) {
        setMousePosition({ 
          x: event.clientX, 
          y: event.clientY 
        });
      }
      
      // Show the dialog
      setTimeout(() => {
        servicesDialogRef.current?.showModal();
      }, 10);
    }
  };
  
  // Effect to position the dialog after it opens
  useEffect(() => {
    const positionDialog = (dialog: HTMLElement | null, isOptions: boolean) => {
      if (!dialog) return;
      
      // Position relative to saved mouse position
      const x = mousePosition.x;
      const y = mousePosition.y;
      
      // Try to keep dialog within viewport
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const dialogHeight = dialog.offsetHeight;
      const dialogWidth = dialog.offsetWidth;
      
      // Calculate optimal positions
      let topPos = y + 10; // Default below click
      let leftPos = x - 10;
      
      // Adjust if needed to keep within viewport
      if (topPos + dialogHeight > windowHeight) {
        topPos = y - dialogHeight - 10; // Position above
      }
      
      if (leftPos + dialogWidth > windowWidth) {
        leftPos = windowWidth - dialogWidth - 10; // Adjust left
      }
      
      if (leftPos < 0) leftPos = 10; // Don't go off left edge
      if (topPos < 0) topPos = 10; // Don't go off top edge
      
      // Apply positioning
      dialog.style.position = 'fixed';
      dialog.style.top = `${topPos}px`;
      dialog.style.left = `${leftPos}px`;
      dialog.style.margin = '0';
      dialog.style.transform = 'none';
    };
    
    // Position options dialog if open
    if (selectedOptions) {
      const optionsDialog = document.querySelector('dialog.options-modal') as HTMLElement;
      positionDialog(optionsDialog, true);
    }
    
    // Position services dialog if open
    if (selectedServices) {
      const servicesDialog = document.querySelector('dialog.services-modal') as HTMLElement;
      positionDialog(servicesDialog, false);
    }
  }, [selectedOptions, selectedServices, mousePosition]);
  
  // Handle adding a new data field
  const handleAddField = async (fieldData: FieldData) => {
    console.log('DataRxTab - Received field data:', fieldData);
    try {
      setIsLoading(true);

      // Create the field object
      const fieldObject = {
        fieldLabel: fieldData.fieldLabel,
        shortName: fieldData.shortName,
        dataType: fieldData.dataType,
        instructions: fieldData.instructions || "",
        retentionHandling: fieldData.retentionHandling || "no_delete",
        collectionTab: fieldData.collectionTab || "subject",
        addressConfig: fieldData.addressConfig || null,
        requiresVerification: fieldData.requiresVerification || false
      };

      console.log('DataRxTab - Sending to API:', fieldObject);

      // Add options property for dropdown fields
      if (fieldData.dataType === 'select' && fieldData.options && fieldData.options.length > 0) {
        fieldObject.options = fieldData.options;
      }
      
      const response = await fetchWithAuth('/api/data-rx/fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fieldObject),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to save field');
      }
      
      // Close modal and refresh data
      setShowAddFieldModal(false);
      fetchData();
    } catch (err) {
      console.error('Error adding field:', err);
      setError('Failed to add field: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle editing a data field
  const handleEditField = async (fieldData: FieldData) => {
    try {
      setIsLoading(true);
      
      // Create the field object
      const fieldObject = {
        fieldLabel: fieldData.fieldLabel,
        shortName: fieldData.shortName,
        dataType: fieldData.dataType,
        instructions: fieldData.instructions || "",
        retentionHandling: fieldData.retentionHandling || "no_delete",
        collectionTab: fieldData.collectionTab || "subject",
        addressConfig: fieldData.addressConfig || null,
        requiresVerification: fieldData.requiresVerification || false,
        options: fieldData.options || []
      };
      
      const response = await fetchWithAuth(`/api/data-rx/fields/${fieldData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fieldObject),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to update field');
      }
      
      // Close modal and refresh data
      setShowEditFieldModal(false);
      setSelectedFieldId(null);
      fetchData();
    } catch (err) {
      console.error('Error updating field:', err);
      setError('Failed to update field: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Open edit field modal
  const handleOpenEditModal = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    setShowEditFieldModal(true);
  };
  
  // Handle adding a new document
  const handleAddDocument = async (documentData: DocumentData) => {
    try {
      setIsLoading(true);
      
      const documentObject = {
        documentName: documentData.documentName,
        instructions: documentData.instructions,
        scope: documentData.scope,
        retentionHandling: documentData.retentionHandling
      };
      
      const response = await fetchWithAuth('/api/data-rx/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(documentObject),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Failed to save document');
      }
      
      // Close modal and refresh data
      setShowAddDocumentModal(false);
      fetchData();
    } catch (err) {
      console.error('Error adding document:', err);
      setError('Failed to add document: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle document status toggling
  const handleToggleDocumentStatus = async (documentId: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      
      const response = await fetchWithAuth(`/api/data-rx/documents/${documentId}/toggle-status`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle document status');
      }
      
      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Error toggling document status:', err);
      setError('Failed to toggle document status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle field status toggle
  const handleToggleFieldStatus = async (fieldId: string) => {
    try {
      setIsLoading(true);
      
      const response = await fetchWithAuth(`/api/data-rx/fields/${fieldId}/toggle-status`, {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error('Failed to toggle field status');
      }
      
      // Refresh data
      fetchData();
    } catch (err) {
      console.error('Error toggling field status:', err);
      setError('Failed to toggle field status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Map data type to readable label
  const getDataTypeLabel = (dataType: string): string => {
    const typeMap: Record<string, string> = {
      'text': 'Text',
      'number': 'Number',
      'date': 'Date',
      'email': 'Email',
      'phone': 'Phone',
      'select': 'Dropdown',
      'checkbox': 'Checkbox',
      'radio': 'Radio Buttons',
      'address_block': 'Address Block'
    };

    return typeMap[dataType] || dataType;
  };

  // Data type options for dropdown
  const dataTypeOptions = [
    { id: 'text', value: 'text', label: 'Text' },
    { id: 'number', value: 'number', label: 'Number' },
    { id: 'date', value: 'date', label: 'Date' },
    { id: 'email', value: 'email', label: 'Email' },
    { id: 'phone', value: 'phone', label: 'Phone' },
    { id: 'select', value: 'select', label: 'Dropdown' },
    { id: 'checkbox', value: 'checkbox', label: 'Checkbox' },
    { id: 'radio', value: 'radio', label: 'Radio Buttons' },
    { id: 'address_block', value: 'address_block', label: 'Address Block' },
  ];

  // Retention handling options
  const retentionOptions = [
    { id: 'no_delete', value: 'no_delete', label: "Don't delete" },
    { id: 'customer_rule', value: 'customer_rule', label: 'Customer rule' },
    { id: 'global_rule', value: 'global_rule', label: 'Global rule' },
    { id: 'none', value: 'none', label: 'None' },
  ];
  
  // For the DataField type
  const getRetentionLabelForField = (field: DataField): string => {
    const retentionMap: Record<string, string> = {
      'no_delete': 'Don\'t delete',
      'customer_rule': 'Customer rule',
      'global_rule': 'Global rule',
      'none': 'None'
    };

    return retentionMap[field.retentionHandling] || 'None';
  };

  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Requirements (Data Rx)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              Create and manage data fields and documents that will be used to gather information from candidates.
            </p>
            
            {error && (
              <div className="px-4 py-3 rounded bg-red-50 text-red-500 border border-red-200">
                <div className="flex justify-between items-center">
                  <span>{error}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchData}
                    className="ml-4 text-sm"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}
            
            {/* Inner tabs for Fields and Documents */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab(TabType.Fields)}
                  className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                      activeTab === TabType.Fields
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Data Fields
                </button>
                <button
                  onClick={() => setActiveTab(TabType.Documents)}
                  className={`py-2 px-4 text-center border-b-2 font-medium text-sm ${
                      activeTab === TabType.Documents
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  Documents
                </button>
              </nav>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Fields Tab Content */}
      {activeTab === TabType.Fields && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Data Fields</CardTitle>
            <Button 
              onClick={() => setShowAddFieldModal(true)}
              disabled={isLoading}
            >
              Add Field
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="text-center py-4">Loading...</div>}
            
            {!isLoading && dataFields.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No data fields have been created yet. Click "Add Field" to create one.
              </div>
            ) : (
              <div className="relative">
                {/* Scroll indicator */}
                <div className="overflow-x-auto border rounded-lg shadow-sm data-rx-table-container" style={{ maxWidth: '100%' }}>
                  {/* Gradient shadow on right side when scrollable */}
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none z-10 opacity-75" />
                  <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky-actions" style={{ width: '8%' }}>Actions</TableHead>
                    <TableHead className="sticky-label" style={{ width: '20%' }}>Field Label</TableHead>
                    <TableHead style={{ width: '12%' }}>Short Name</TableHead>
                    <TableHead style={{ width: '10%' }}>Data Type</TableHead>
                    <TableHead style={{ width: '18%' }}>Instructions</TableHead>
                    <TableHead style={{ width: '10%' }}>Retention</TableHead>
                    <TableHead style={{ width: '8%' }}>Verification</TableHead>
                    <TableHead style={{ width: '10%' }}>Services</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataFields.map((field) => {
                    return (
                      <TableRow
                        key={field.id}
                        className={field.disabled ? "opacity-60 bg-gray-50" : ""}
                      >
                        <TableCell className={`sticky-actions ${field.disabled ? 'bg-gray-50' : 'bg-white'}`}>
                          <ActionDropdown
                            options={[
                              {
                                label: 'Edit',
                                onClick: () => handleOpenEditModal(field.id),
                                color: 'rgb(59, 130, 246)'
                              },
                              {
                                label: field.disabled ? 'Enable' : 'Disable',
                                onClick: () => handleToggleFieldStatus(field.id),
                                color: field.disabled ? 'rgb(59, 130, 246)' : 'rgb(220, 38, 38)'
                              }
                            ]}
                          />
                        </TableCell>
                        <TableCell className={`font-medium sticky-label ${field.disabled ? 'bg-gray-50' : 'bg-white'}`}>
                          {field.fieldLabel}
                          {field.disabled && <span className="ml-2 text-xs text-gray-500">(Disabled)</span>}
                        </TableCell>
                        <TableCell>
                          {field.shortName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span>{getDataTypeLabel(field.dataType)}</span>
                          {['select', 'checkbox', 'radio'].includes(field.dataType) && field.options && field.options.length > 0 && (
                            <span
                              style={{
                                fontSize: '8px',
                                marginLeft: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                              }}
                              title={`Options: ${field.options.map(o => o.label).join(', ')}`}
                              onClick={(e) => handleShowOptions(field, e)}
                            >
                              <span style={{
                                fontSize: '8px',
                                color: '#3b82f6',
                                fontWeight: 'bold',
                                border: '1px solid #3b82f6',
                                borderRadius: '50%',
                                width: '11px',
                                height: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1
                              }}>i</span>
                            </span>
                          )}
                          </div>
                        </TableCell>
                        <TableCell className="truncate">
                          {field.instructions}
                        </TableCell>
                        <TableCell>
                          {getRetentionLabelForField(field)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            {field.requiresVerification ? (
                              <ShieldCheck
                                className="w-5 h-5 text-green-600"
                                title="Verification required during fulfillment"
                              />
                            ) : (
                              <Shield
                                className="w-5 h-5 text-gray-300"
                                title="No verification required"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {field.services && field.services.length > 0 ? (
                            <span
                              className="text-blue-600 text-sm cursor-pointer hover:underline"
                              onClick={(e) => handleShowServices(field, e)}
                            >
                              {field.services.length} service{field.services.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                  </Table>
                </div>
                {/* Scroll hint message */}
                {dataFields.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2 text-right italic">
                    ↔ Scroll horizontally to see all columns and actions
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Documents Tab Content */}
      {activeTab === TabType.Documents && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Documents</CardTitle>
            <Button 
              onClick={() => setShowAddDocumentModal(true)}
              disabled={isLoading}
            >
              Add Document
            </Button>
          </CardHeader>
          <CardContent>
            {/* Use the DocumentsTable component to display and manage documents */}
            <DocumentsTable 
              documents={documents}
              isLoading={isLoading}
              onToggleStatus={handleToggleDocumentStatus}
              onRefresh={fetchData}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Modal dialogs */}
      {showAddFieldModal && (
        <AddFieldModal 
          onAddField={handleAddField}
          onCancel={() => setShowAddFieldModal(false)}
        />
      )}
      
      {showAddDocumentModal && (
        <AddDocumentModal 
          onAddDocument={handleAddDocument}
          onCancel={() => setShowAddDocumentModal(false)}
        />
      )}
      
      {/* Edit field modal */}
      {showEditFieldModal && selectedFieldId && (
        <EditFieldModal 
          fieldId={selectedFieldId}
          onEditField={handleEditField}
          onCancel={() => {
            setShowEditFieldModal(false);
            setSelectedFieldId(null);
          }}
        />
      )}
      
      {/* Options dialog */}
      <ModalDialog
        ref={optionsDialogRef}
        title={selectedOptions ? `Options` : "Field Options"}
        footer={
          <Button 
            onClick={() => optionsDialogRef.current?.close()}
            size="sm"
            variant="outline"
          >
            Close
          </Button>
        }
        onClose={() => {
          setSelectedOptions(null);
        }}
        maxWidth="sm"
        className="compact-modal options-modal" /* Using your existing compact modal class */
      >
        <div className="py-1">
          {selectedOptions && (
            <>
              <ul className="list-disc pl-4 space-y-0.5 text-xs">
                {selectedOptions.options.map((option, i) => (
                  <li key={i}>{option.label}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </ModalDialog>
      
      {/* Services dialog */}
      <ModalDialog
        ref={servicesDialogRef}
        title={selectedServices ? `Services Using "${selectedServices.name}"` : "Services"}
        footer={
          <Button 
            onClick={() => servicesDialogRef.current?.close()}
            size="sm"
            variant="outline"
          >
            Close
          </Button>
        }
        onClose={() => {
          setSelectedServices(null);
        }}
        maxWidth="sm"
        className="compact-modal services-modal" /* Using your existing compact modal class */
      >
        <div className="py-1">
          {selectedServices && (
            <>
              <ul className="list-disc pl-4 space-y-0.5 text-xs">
                {selectedServices.services.map((service, i) => (
                  <li key={i}>{service.name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </ModalDialog>
      
      {/* Add inline styles for the modal dialogs and scrollbar */}
      <style jsx global>{`
        .options-modal, .services-modal {
          min-width: 200px !important;
          max-width: 300px !important;
        }

        .options-modal > div, .services-modal > div {
          padding: 8px !important;
        }

        .options-modal h3, .services-modal h3 {
          font-size: 0.875rem !important;
          margin: 0 0 4px 0 !important;
        }

        .options-modal .py-2, .services-modal .py-2 {
          padding-top: 4px !important;
          padding-bottom: 4px !important;
        }

        .options-modal ul, .services-modal ul {
          margin: 0 !important;
        }

        /* Make horizontal scrollbar always visible and more prominent */
        .data-rx-table-container {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e0 #f7fafc;
          position: relative;
        }

        /* Sticky first column (Actions) */
        .sticky-actions {
          position: sticky !important;
          left: 0px !important;
          z-index: 20;
          background: white;
          min-width: 100px;
          width: 100px;
        }

        /* Sticky second column (Field Label) */
        .sticky-label {
          position: sticky !important;
          left: 100px !important;
          z-index: 15;
          background: white;
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
          min-width: 200px;
        }

        /* Ensure sticky columns have proper background on hover */
        tr:hover .sticky-actions,
        tr:hover .sticky-label {
          background: inherit;
        }

        /* Add border to separate sticky columns */
        .sticky-actions::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #e2e8f0;
        }

        .sticky-label::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 1px;
          background: #e2e8f0;
        }

        .data-rx-table-container::-webkit-scrollbar {
          height: 12px;
          display: block !important;
          visibility: visible !important;
        }

        .data-rx-table-container::-webkit-scrollbar-track {
          background: #f7fafc;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .data-rx-table-container::-webkit-scrollbar-thumb {
          background: #cbd5e0;
          border-radius: 4px;
          border: 1px solid #a0aec0;
        }

        .data-rx-table-container::-webkit-scrollbar-thumb:hover {
          background: #a0aec0;
        }
      `}</style>
    </div>
  );
}