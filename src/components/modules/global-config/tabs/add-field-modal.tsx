// src/components/modules/global-config/tabs/add-field-modal.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { DialogRef, ModalDialog, DialogFooter } from '@/components/ui/modal-dialog';
import { FormTable } from '@/components/ui/form-table';
import { FormRow } from '@/components/ui/form-row';

// Field data type options
const dataTypeOptions = [
  { id: 'text', value: 'text', label: 'Text' },
  { id: 'number', value: 'number', label: 'Number' },
  { id: 'date', value: 'date', label: 'Date' },
  { id: 'email', value: 'email', label: 'Email' },
  { id: 'phone', value: 'phone', label: 'Phone' },
  { id: 'select', value: 'select', label: 'Select (Drop-down)' },
  { id: 'checkbox', value: 'checkbox', label: 'Checkbox' },
  { id: 'radio', value: 'radio', label: 'Radio Buttons' },
];

// Retention handling options
const retentionOptions = [
  { id: 'no_delete', value: 'no_delete', label: 'Don\'t delete' },
  { id: 'customer_rule', value: 'customer_rule', label: 'Delete at customer rule' },
  { id: 'global_rule', value: 'global_rule', label: 'Delete at global rule' },
];

// Interface for a dropdown option
export interface DropdownOption {
  value: string;
  label: string;
}

export interface FieldData {
  fieldLabel: string;
  shortName: string;
  dataType: string;
  instructions: string;
  retentionHandling: string;
  options?: DropdownOption[];
}

interface AddFieldModalProps {
  onAddField: (field: FieldData) => void;
  onCancel: () => void;
}

export function AddFieldModal({ onAddField, onCancel }: AddFieldModalProps) {
  const dialogRef = useRef<DialogRef>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [shortName, setShortName] = useState('');
  const [dataType, setDataType] = useState('');
  const [instructions, setInstructions] = useState('');
  const [retentionHandling, setRetentionHandling] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show modal on component mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Reset form fields
  const resetForm = () => {
    setFieldLabel('');
    setShortName('');
    setDataType('');
    setInstructions('');
    setRetentionHandling('');
    setOptionsText('');
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
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
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
      fieldLabel,
      shortName,
      dataType,
      instructions,
      retentionHandling,
    };
    
    // Add options if data type is select, checkbox, or radio
    if (dataType === 'select' || dataType === 'checkbox' || dataType === 'radio') {
      fieldData.options = parseOptions(optionsText);
    }

    onAddField(fieldData);
    resetForm();
    dialogRef.current?.close();
  };

  // Check if options section should be shown
  const showOptions = dataType === 'select' || dataType === 'checkbox' || dataType === 'radio';

  return (
    <ModalDialog
      ref={dialogRef}
      title="Add New Data Field"
      footer={
        <DialogFooter
          onCancel={handleCancel}
          onConfirm={handleSubmit}
          cancelText="Cancel"
          confirmText="Add Field"
        />
      }
      onClose={handleCancel}
    >
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
              console.log("Setting data type to:", value);
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
      </FormTable>
    </ModalDialog>
  );
}