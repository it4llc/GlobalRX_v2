// src/components/modules/global-config/tabs/edit-field-modal.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable } from '@/components/ui/form-table';
import { FormRow } from '@/components/ui/form-row';
import { useAuth } from '@/contexts/AuthContext';
import { AddressBlockConfigurator, AddressBlockConfig } from './address-block-configurator';

// Data type options (same as in add-field-modal.tsx)
const dataTypeOptions = [
  { id: 'text', value: 'text', label: 'Text' },
  { id: 'number', value: 'number', label: 'Number' },
  { id: 'date', value: 'date', label: 'Date' },
  { id: 'email', value: 'email', label: 'Email' },
  { id: 'phone', value: 'phone', label: 'Phone' },
  { id: 'select', value: 'select', label: 'Select (Drop-down)' },
  { id: 'checkbox', value: 'checkbox', label: 'Checkbox' },
  { id: 'radio', value: 'radio', label: 'Radio Buttons' },
  { id: 'address_block', value: 'address_block', label: 'Address Block' },
];

// Retention handling options (same as in add-field-modal.tsx)
const retentionOptions = [
  { id: 'no_delete', value: 'no_delete', label: 'Don\'t delete' },
  { id: 'customer_rule', value: 'customer_rule', label: 'Delete at customer rule' },
  { id: 'global_rule', value: 'global_rule', label: 'Delete at global rule' },
];

// Collection tab options (same as in add-field-modal.tsx)
const collectionTabOptions = [
  { id: 'subject', value: 'subject', label: 'Subject Information (Order Level)' },
  { id: 'search', value: 'search', label: 'Search Details (Service Level)' },
];

// Interface for a dropdown option
export interface DropdownOption {
  value: string;
  label: string;
}

export interface FieldVersion {
  timestamp: string;
  modifiedBy: string;
  changes: Record<string, { from: any; to: any }>;
}

export interface FieldData {
  id: string;
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
  requiresVerification?: boolean;
  options?: DropdownOption[];
  addressConfig?: AddressBlockConfig;
  disabled?: boolean;
  versions?: FieldVersion[];
}

interface EditFieldModalProps {
  fieldId: string;
  onEditField: (field: FieldData) => void;
  onCancel: () => void;
}

export function EditFieldModal({ fieldId, onEditField, onCancel }: EditFieldModalProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [shortName, setShortName] = useState('');
  const [dataType, setDataType] = useState('');
  const [instructions, setInstructions] = useState('');
  const [retentionHandling, setRetentionHandling] = useState('');
  const [collectionTab, setCollectionTab] = useState('subject');
  const [optionsText, setOptionsText] = useState('');
  const [addressConfig, setAddressConfig] = useState<AddressBlockConfig | null>(null);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<FieldVersion[]>([]);
  
  const { fetchWithAuth } = useAuth();

  // Fetch field data when component mounts
  useEffect(() => {
    const fetchFieldData = async () => {
      setIsLoading(true);
      try {
        const response = await fetchWithAuth(`/api/data-rx/fields/${fieldId}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details || 'Failed to fetch field data');
        }
        
        const { field } = await response.json();
        
        // Set form values
        setFieldLabel(field.fieldLabel);
        setShortName(field.shortName);
        setDataType(field.dataType);
        setInstructions(field.instructions || '');
        setRetentionHandling(field.retentionHandling || '');
        setCollectionTab(field.collectionTab || 'subject');
        setRequiresVerification(field.requiresVerification || false);
        
        // Set options text
        if (field.options && field.options.length > 0) {
          const optionsStr = field.options.map((option: any) => option.label).join('\n');
          setOptionsText(optionsStr);
        }

        // Set address configuration
        if (field.addressConfig) {
          setAddressConfig(field.addressConfig);
        }
        
        // Set version history
        if (field.versions && field.versions.length > 0) {
          setVersions(field.versions);
        }
      } catch (error: unknown) {
        clientLogger.error('Error fetching field data:', error);
        // Show error in the UI
      } finally {
        setIsLoading(false);
      }
    };
    
    // Show modal on component mount
    dialogRef.current?.showModal();
    
    // Fetch field data
    fetchFieldData();
  }, [fieldId, fetchWithAuth]);

  // Reset form fields
  const resetForm = () => {
    setFieldLabel('');
    setShortName('');
    setDataType('');
    setInstructions('');
    setRetentionHandling('');
    setCollectionTab('subject');
    setOptionsText('');
    setAddressConfig(null);
    setRequiresVerification(false);
    setErrors({});
  };

  // Handle cancel button click
  const handleCancel = () => {
    resetForm();
    dialogRef.current?.close();
    onCancel();
  };

  // Parse options from text area (one option per line)
  const parseOptions = (text: string): DropdownOption[] => {
    if (!text.trim()) return [];
    
    return text
      .split('\n')
      .map((line: any) => line.trim())
      .filter(line => line.length > 0)
      .map((line: any) => {
        // Use the same text for both value and label
        // Generate a slug/value by converting to lowercase and replacing spaces with underscores
        const value = line.toLowerCase().replace(/\s+/g, '_');
        return {
          value,
          label: line
        };
      });
  };

  // Validate the entire form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fieldLabel.trim()) {
      newErrors.fieldLabel = 'Field label is required';
    }

    if (!shortName.trim()) {
      newErrors.shortName = 'Short name is required';
    }

    if (!dataType) {
      newErrors.dataType = 'Data type is required';
    }
    
    if (!retentionHandling) {
      newErrors.retentionHandling = 'Retention handling is required';
    }
    
    // Validate that options are provided for select, checkbox, or radio
    if ((dataType === 'select' || dataType === 'checkbox' || dataType === 'radio') && !optionsText.trim()) {
      newErrors.optionsText = 'At least one option is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    const fieldData: FieldData = {
      id: fieldId,
      fieldLabel,
      shortName,
      dataType,
      instructions,
      retentionHandling,
      collectionTab,
      requiresVerification,
    };

    // Add options if data type is select, checkbox, or radio
    if (dataType === 'select' || dataType === 'checkbox' || dataType === 'radio') {
      fieldData.options = parseOptions(optionsText);
    }

    // Add address configuration if data type is address_block
    if (dataType === 'address_block' && addressConfig) {
      fieldData.addressConfig = addressConfig;
    }

    onEditField(fieldData);
    resetForm();
    dialogRef.current?.close();
  };

  // Check if options section should be shown
  const showOptions = dataType === 'select' || dataType === 'checkbox' || dataType === 'radio';
  const showAddressConfig = dataType === 'address_block';

  // Format a timestamp to a readable date/time
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <ModalDialog
      ref={dialogRef}
      title="Edit Data Field"
      maxWidth={showAddressConfig ? '2xl' : 'md'}
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Save Changes"
        />
      }
      onClose={handleCancel}
    >
      {isLoading ? (
        <div className="py-4 text-center">Loading field data...</div>
      ) : (
        <>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showVersionHistory ? 'Hide Version History' : 'Show Version History'}
            </button>
          </div>
          
          {showVersionHistory && versions.length > 0 && (
            <div className="mb-6 border rounded p-3 bg-gray-50 max-h-40 overflow-y-auto">
              <h3 className="text-sm font-medium mb-2">Version History</h3>
              <div className="space-y-3">
                {versions.map((version, index) => (
                  <div key={index} className="text-xs border-b pb-2">
                    <div className="font-medium">
                      {formatTimestamp(version.timestamp)} by {version.modifiedBy}
                    </div>
                    <ul className="mt-1 pl-2">
                      {Object.entries(version.changes).map(([field, change]) => (
                        <li key={field} className="mb-1">
                          <span className="font-medium">{field}:</span> 
                          <span className="line-through text-red-600 mr-1">{JSON.stringify(change.from)}</span>
                          <span className="text-green-600">{JSON.stringify(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <FormTable>
            <FormRow
              label="Field Label"
              htmlFor="field-label"
              required={true}
              error={errors.fieldLabel}
            >
              <Input
                id="field-label"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="E.g., Full Name, Date of Birth"
              />
            </FormRow>

            <FormRow
              label="Short Name"
              htmlFor="short-name"
              required={true}
              error={errors.shortName}
            >
              <Input
                id="short-name"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="E.g., name, dob"
              />
            </FormRow>

            <FormRow
              label="Data Type"
              htmlFor="data-type"
              required={true}
              error={errors.dataType}
            >
              <StandardDropdown
                id="data-type"
                options={dataTypeOptions}
                value={dataType}
                onChange={(value) => {
                  clientLogger.info("Setting data type to:", value);
                  setDataType(value);
                }}
                placeholder="Select a data type"
              />
            </FormRow>

            <FormRow
              label="Instructions"
              htmlFor="instructions"
              required={false}
              alignTop={true}
            >
              <Textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Instructions to be shown to users"
                rows={3}
              />
            </FormRow>

            <FormRow
              label="Retention Handling"
              htmlFor="retention-handling"
              required={true}
              error={errors.retentionHandling}
            >
              <StandardDropdown
                id="retention-handling"
                options={retentionOptions}
                value={retentionHandling}
                onChange={setRetentionHandling}
                placeholder="Select retention policy"
              />
            </FormRow>

            <FormRow
              label="Collection Tab"
              htmlFor="collection-tab"
              required={true}
            >
              <StandardDropdown
                id="collection-tab"
                options={collectionTabOptions}
                value={collectionTab}
                onChange={setCollectionTab}
                placeholder="Select where field is collected"
              />
            </FormRow>

            <FormRow
              label="Requires Verification"
              htmlFor="requires-verification"
              required={false}
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires-verification"
                  checked={requiresVerification}
                  onChange={(e) => setRequiresVerification(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="requires-verification" className="ml-2 text-sm text-gray-700">
                  This field requires verification during fulfillment
                </label>
              </div>
            </FormRow>

            {/* Options Section - Simplified with text area */}
            {showOptions && (
              <FormRow
                label={`${dataType === 'select' ? 'Dropdown' : dataType === 'checkbox' ? 'Checkbox' : 'Radio'} Options`}
                htmlFor="options-text"
                required={true}
                error={errors.optionsText}
                alignTop={true}
              >
                <div>
                  <Textarea
                    id="options-text"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Enter one option per line"
                    rows={6}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Enter one option per line. For example:
                    <br />
                    Option 1
                    <br />
                    Option 2
                    <br />
                    Option 3
                  </p>
                </div>
              </FormRow>
            )}

            {/* Address Block Configuration */}
            {showAddressConfig && (
              <FormRow
                label="Address Components"
                htmlFor="address-config"
                required={true}
                alignTop={true}
              >
                <AddressBlockConfigurator
                  value={addressConfig}
                  onChange={setAddressConfig}
                />
              </FormRow>
            )}
          </FormTable>
        </>
      )}
    </ModalDialog>
  );
}