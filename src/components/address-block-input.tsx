// src/components/address-block-input.tsx
'use client';

import { FC, useState, useEffect } from 'react';
import { AddressBlockConfig } from './modules/global-config/tabs/address-block-configurator';

interface AddressData {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  county?: string;
  postalCode?: string;
}

interface AddressBlockInputProps {
  config: AddressBlockConfig;
  value: AddressData | null;
  onChange: (value: AddressData) => void;
  error?: string;
  locations?: { states: any[]; counties: any[] };
}

export const AddressBlockInput: FC<AddressBlockInputProps> = ({
  config,
  value,
  onChange,
  error,
  locations
}) => {
  const [addressData, setAddressData] = useState<AddressData>(value || {});
  const [loading, setLoading] = useState(false);
  const [stateOptions, setStateOptions] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [countyOptions, setCountyOptions] = useState<{ id: string; name: string }[]>([]);
  const [cityAutocomplete, setCityAutocomplete] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Fetch state options on mount
  useEffect(() => {
    fetchStateOptions();
  }, []);

  // Fetch county options when state changes
  useEffect(() => {
    if (addressData.state && config.county.enabled) {
      fetchCountyOptions(addressData.state);
    }
  }, [addressData.state]);

  // Update parent component when address data changes
  useEffect(() => {
    onChange(addressData);
  }, [addressData]);

  const fetchStateOptions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portal/locations?type=states');
      if (response.ok) {
        const data = await response.json();
        setStateOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch states:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCountyOptions = async (stateId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/locations?parentId=${stateId}&type=counties`);
      if (response.ok) {
        const data = await response.json();
        setCountyOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch counties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCityAutocomplete = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setCityAutocomplete([]);
      return;
    }

    try {
      const response = await fetch(`/api/portal/cities/autocomplete?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const suggestions = await response.json();
        setCityAutocomplete(suggestions);
        setShowCityDropdown(suggestions.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch city suggestions:', error);
    }
  };

  const handleFieldChange = (field: keyof AddressData, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }));

    // If changing state, clear county
    if (field === 'state' && config.county.enabled) {
      setAddressData(prev => ({ ...prev, county: '' }));
      setCountyOptions([]);
    }

    // Handle city autocomplete
    if (field === 'city') {
      fetchCityAutocomplete(value);
    }
  };

  const renderField = (
    field: keyof AddressData,
    componentConfig: { enabled: boolean; label: string; required: boolean }
  ) => {
    if (!componentConfig.enabled) return null;

    const fieldValue = addressData[field] || '';

    // State dropdown
    if (field === 'state') {
      return (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {componentConfig.label}
            {componentConfig.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={fieldValue}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="">Select {componentConfig.label}</option>
            {stateOptions.map(state => (
              <option key={state.id} value={state.id}>
                {state.name} {state.code ? `(${state.code})` : ''}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // County dropdown
    if (field === 'county') {
      return (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {componentConfig.label}
            {componentConfig.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={fieldValue}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!addressData.state || loading}
          >
            <option value="">
              {!addressData.state ? 'Select state first' : `Select ${componentConfig.label}`}
            </option>
            {countyOptions.map(county => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // City with autocomplete
    if (field === 'city') {
      return (
        <div key={field} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {componentConfig.label}
            {componentConfig.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={fieldValue}
            onChange={(e) => handleFieldChange(field, e.target.value)}
            onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Enter ${componentConfig.label.toLowerCase()}`}
          />
          {showCityDropdown && cityAutocomplete.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
              {cityAutocomplete.map((city, index) => (
                <div
                  key={index}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  onMouseDown={() => {
                    handleFieldChange('city', city);
                    setShowCityDropdown(false);
                  }}
                >
                  {city}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Regular text input for other fields
    return (
      <div key={field}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {componentConfig.label}
          {componentConfig.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={fieldValue}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={`Enter ${componentConfig.label.toLowerCase()}`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderField('street1', config.street1)}
        {renderField('street2', config.street2)}
        {renderField('city', config.city)}
        {renderField('state', config.state)}
        {renderField('county', config.county)}
        {renderField('postalCode', config.postalCode)}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
};