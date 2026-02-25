// src/hooks/useDataRxTab.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import clientLogger from '@/lib/client-logger';

// Types
export interface DataField {
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

export interface Document {
  id: string;
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling?: string;
  disabled?: boolean;
  services?: Array<{ id: string, name: string }>;
  filePath?: string;
  documentData?: any;
}

export interface FieldData {
  id?: string;
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions?: string;
  retentionHandling?: string;
  collectionTab?: string;
  addressConfig?: any;
  requiresVerification?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface DocumentData {
  documentName: string;
  instructions: string;
  scope: string;
  retentionHandling: string;
}

export type TabType = 'fields' | 'documents';

// Hook implementation
export function useDataRxTab() {
  // State for active inner tab (fields or documents)
  const [activeTab, setActiveTab] = useState<TabType>('fields');

  // State for data fields and documents
  const [dataFields, setDataFields] = useState<DataField[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // State for modals
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

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
      clientLogger.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWithAuth]);

  // Load data when component mounts
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle adding a new data field
  const handleAddField = async (fieldData: FieldData) => {
    clientLogger.info('DataRxTab - Received field data:', fieldData);
    try {
      setIsLoading(true);

      // Create the field object
      const fieldObject: any = {
        fieldLabel: fieldData.fieldLabel,
        shortName: fieldData.shortName,
        dataType: fieldData.dataType,
        instructions: fieldData.instructions || "",
        retentionHandling: fieldData.retentionHandling || "no_delete",
        collectionTab: fieldData.collectionTab || "subject",
        addressConfig: fieldData.addressConfig || null,
        requiresVerification: fieldData.requiresVerification || false
      };

      clientLogger.info('DataRxTab - Sending to API:', fieldObject);

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
      clientLogger.error('Error adding field:', err);
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
      clientLogger.error('Error updating field:', err);
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
      clientLogger.error('Error adding document:', err);
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
      clientLogger.error('Error toggling document status:', err);
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
      clientLogger.error('Error toggling field status:', err);
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
  const getRetentionLabelForField = (field: Pick<DataField, 'retentionHandling'>): string => {
    const retentionMap: Record<string, string> = {
      'no_delete': 'Don\'t delete',
      'customer_rule': 'Customer rule',
      'global_rule': 'Global rule',
      'none': 'None'
    };

    return retentionMap[field.retentionHandling] || 'None';
  };

  return {
    // State
    activeTab,
    dataFields,
    documents,
    isLoading,
    error,
    showAddFieldModal,
    showAddDocumentModal,
    showEditFieldModal,
    selectedFieldId,

    // Actions
    setActiveTab,
    setShowAddFieldModal,
    setShowAddDocumentModal,
    setShowEditFieldModal,
    handleAddField,
    handleEditField,
    handleOpenEditModal,
    handleAddDocument,
    handleToggleDocumentStatus,
    handleToggleFieldStatus,
    fetchData,

    // Utilities
    getDataTypeLabel,
    getRetentionLabelForField,
    dataTypeOptions,
    retentionOptions,

    // Expose error setter for testing
    setError: (err: string | null) => setError(err),
  };
}