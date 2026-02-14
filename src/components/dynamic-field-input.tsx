// src/components/dynamic-field-input.tsx
'use client';

import { FC } from 'react';
import { AddressBlockInput } from './address-block-input';

interface DynamicFieldInputProps {
  field: {
    id: string;
    name: string;
    shortName: string;
    dataType: string;
    instructions?: string;
    options?: { value: string; label: string }[];
    addressConfig?: any; // Address block configuration
    required?: boolean;
    locationId?: string; // Location ID for this field's context
    serviceId?: string; // Service ID for this field's context
  };
  value: any;
  onChange: (value: any) => void;
  error?: string;
  countryId?: string; // Country context for address fields
}

export const DynamicFieldInput: FC<DynamicFieldInputProps> = ({
  field,
  value,
  onChange,
  error,
  countryId
}) => {
  const renderField = () => {
    switch (field.dataType) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.dataType}
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.instructions || `Enter ${field.name.toLowerCase()}`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.instructions || `Enter ${field.name.toLowerCase()}`}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
        );

      case 'select':
        return (
          <select
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select {field.name.toLowerCase()}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option.value}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...currentValues, option.value]);
                    } else {
                      onChange(currentValues.filter((v) => v !== option.value));
                    }
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option.value} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'address_block':
        console.log('DynamicFieldInput - Rendering address block:', {
          fieldId: field.id,
          fieldName: field.name,
          hasAddressConfig: !!field.addressConfig,
          addressConfig: field.addressConfig,
          countryId: countryId || field.locationId
        });
        if (field.addressConfig) {
          return (
            <AddressBlockInput
              config={field.addressConfig}
              value={value}
              onChange={onChange}
              error={error}
              countryId={countryId || field.locationId}
            />
          );
        }
        return <div className="text-red-500">Address block configuration missing (field: {field.name})</div>;

      default:
        return (
          <input
            type="text"
            id={field.id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={field.instructions || `Enter ${field.name.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="mb-4">
      <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
        {field.name}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderField()}
      {field.instructions && !['text', 'email', 'phone', 'number'].includes(field.dataType) && field.dataType !== 'address_block' && (
        <p className="mt-1 text-xs text-gray-500">{field.instructions}</p>
      )}
      {error && field.dataType !== 'address_block' && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};