// /GlobalRX_v2/src/components/candidate/form-engine/DynamicFieldRenderer.tsx

'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup } from '@/components/ui/radio-group';
import { Radio } from '@/components/ui/radio';
import { AddressBlockInput } from './AddressBlockInput';
import type { FieldMetadata, FieldValue } from '@/types/candidate-portal';
import type { AddressBlockValue, AddressConfig } from '@/types/candidate-address';

export interface DynamicFieldProps {
  requirementId: string;
  name: string;
  fieldKey: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  onBlur?: () => void;
  locked?: boolean;
  error?: string;
  // Phase 6 Stage 3: required for address_block fields so the embedded
  // AddressBlockInput can populate its state/province dropdown via the
  // /subdivisions endpoint. Optional because non-address-block fields
  // ignore it. Existing callers (PersonalInfoSection, IdvSection,
  // EducationSection, EmploymentSection) pass this prop through.
  countryId?: string | null;
  // Phase 6 Stage 3: required by AddressBlockInput for token-scoped
  // subdivisions API calls. Same optional rationale as countryId.
  token?: string;
}

/**
 * Dynamic Field Renderer
 *
 * A reusable component that takes a field definition and renders the appropriate input.
 * This is the core building block that all sections will use.
 */
export function DynamicFieldRenderer({
  requirementId,
  name,
  fieldKey,
  dataType,
  isRequired,
  instructions,
  fieldData = {},
  value,
  onChange,
  onBlur,
  locked = false,
  error,
  countryId = null,
  token
}: DynamicFieldProps) {

  // Helper to get HTML input type from data type
  const getInputType = (type: string): string => {
    switch (type) {
      case 'date':
        return 'date';
      case 'email':
        return 'email';
      case 'phone':
        return 'tel';
      case 'number':
        return 'number';
      default:
        return 'text';
    }
  };

  // Render different field types
  const renderField = () => {
    // Phase 6 Stage 3: replace the Stage 2 placeholder with the real
    // AddressBlockInput component. The renderer always passes showDates=false
    // because Education / Employment address blocks have no dates. The
    // AddressHistorySection bypasses the renderer for its own address_block
    // field and renders <AddressBlockInput showDates={true} ... /> directly.
    if (dataType === 'address_block') {
      const addressBlockValue: AddressBlockValue =
        value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
          ? (value as AddressBlockValue)
          : {};
      const addressConfig =
        (fieldData as { addressConfig?: AddressConfig | null }).addressConfig ?? null;
      return (
        <AddressBlockInput
          requirementId={requirementId}
          addressConfig={addressConfig}
          countryId={countryId}
          value={addressBlockValue}
          onChange={(next) => onChange(next as FieldValue)}
          onBlur={onBlur}
          locked={locked}
          isRequired={isRequired}
          showDates={false}
          token={token}
        />
      );
    }

    // Handle select/dropdown
    if (dataType === 'select' || dataType === 'dropdown') {
      const options = fieldData.options || [];

      if (options.length === 0) {
        return (
          <div className="text-gray-500">
            <Select disabled>
              <SelectTrigger className="min-h-[44px] text-base">
                <SelectValue placeholder="No options available" />
              </SelectTrigger>
            </Select>
          </div>
        );
      }

      return (
        <Select
          value={value || ''}
          onValueChange={onChange}
          disabled={locked}
        >
          <SelectTrigger
            className="min-h-[44px] text-base"
            onBlur={onBlur}
            data-testid={`field-${fieldKey}`}
          >
            <SelectValue placeholder={`Select ${name}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem
                key={option.value || option}
                value={option.value || option}
              >
                {option.label || option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Handle checkbox
    if (dataType === 'checkbox') {
      const options = fieldData.options || [];

      if (options.length > 0) {
        // Multiple checkbox group
        const checkedValues = value || [];
        return (
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value || option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${fieldKey}-${option.value || option}`}
                  checked={checkedValues.includes(option.value || option)}
                  onCheckedChange={(checked) => {
                    let newValues = [...checkedValues];
                    if (checked) {
                      newValues.push(option.value || option);
                    } else {
                      newValues = newValues.filter(v => v !== (option.value || option));
                    }
                    onChange(newValues);
                    onBlur?.();
                  }}
                  disabled={locked}
                  className="min-w-[44px] min-h-[44px]"
                />
                <Label
                  htmlFor={`${fieldKey}-${option.value || option}`}
                  className="cursor-pointer"
                >
                  {option.label || option}
                </Label>
              </div>
            ))}
          </div>
        );
      } else {
        // Single checkbox
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`field-${fieldKey}`}
              checked={value || false}
              onCheckedChange={(checked) => {
                onChange(checked);
                onBlur?.();
              }}
              disabled={locked}
              className="min-w-[44px] min-h-[44px]"
            />
            <Label htmlFor={`field-${fieldKey}`} className="cursor-pointer">
              {name}
            </Label>
          </div>
        );
      }
    }

    // Handle radio buttons
    if (dataType === 'radio') {
      const options = fieldData.options || [];

      return (
        <RadioGroup
          value={value || ''}
          onValueChange={(newValue) => {
            onChange(newValue);
            onBlur?.();
          }}
          disabled={locked}
        >
          {options.map((option) => (
            <div key={option.value || option} className="flex items-center space-x-2">
              <Radio
                value={option.value || option}
                id={`${fieldKey}-${option.value || option}`}
                className="min-w-[44px] min-h-[44px]"
              />
              <Label
                htmlFor={`${fieldKey}-${option.value || option}`}
                className="cursor-pointer"
              >
                {option.label || option}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    }

    // Default: render as input field
    return (
      <Input
        id={`field-${fieldKey}`}
        type={getInputType(dataType)}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={locked}
        readOnly={locked}
        className={`min-h-[44px] text-base ${locked ? 'bg-gray-100' : ''}`}
        placeholder={locked ? '' : `Enter ${name}`}
        data-testid={`field-${fieldKey}`}
        name={fieldKey}
      />
    );
  };

  return (
    <div className="space-y-2">
      {/* Label with required indicator */}
      {dataType !== 'checkbox' && (
        <Label htmlFor={`field-${fieldKey}`} className="block">
          {name}
          {isRequired && (
            <span className="text-red-500 ml-1 required-indicator">*</span>
          )}
        </Label>
      )}

      {/* Instructions/help text */}
      {instructions && (
        <p className="text-sm text-gray-600 field-help-text">{instructions}</p>
      )}

      {/* Field */}
      {renderField()}

      {/* Error message (for Phase 7 validation) */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}