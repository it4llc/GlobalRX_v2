// src/components/modules/global-config/tabs/address-block-configurator.tsx
'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

export interface AddressComponent {
  enabled: boolean;
  label: string;
  required: boolean;
}

export interface AddressBlockConfig {
  street1: AddressComponent;
  street2: AddressComponent;
  city: AddressComponent;
  state: AddressComponent;
  county: AddressComponent;
  postalCode: AddressComponent;
}

interface AddressBlockConfiguratorProps {
  value: AddressBlockConfig | null;
  onChange: (config: AddressBlockConfig) => void;
}

const defaultConfig: AddressBlockConfig = {
  street1: { enabled: true, label: 'Street Address', required: true },
  street2: { enabled: true, label: 'Apt/Suite', required: false },
  city: { enabled: true, label: 'City', required: true },
  state: { enabled: true, label: 'State/Province', required: true },
  county: { enabled: false, label: 'County', required: false },
  postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
};

export function AddressBlockConfigurator({ value, onChange }: AddressBlockConfiguratorProps) {
  const [config, setConfig] = useState<AddressBlockConfig>(value || defaultConfig);

  useEffect(() => {
    onChange(config);
  }, [config]);

  const updateComponent = (
    component: keyof AddressBlockConfig,
    field: keyof AddressComponent,
    fieldValue: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [component]: {
        ...prev[component],
        [field]: fieldValue
      }
    }));
  };

  const componentLabels: Record<keyof AddressBlockConfig, string> = {
    street1: 'Street Address 1',
    street2: 'Street Address 2',
    city: 'City',
    state: 'State/Territory',
    county: 'County',
    postalCode: 'Postal/ZIP Code'
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-2">
        Configure which address components to include and their labels
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Component</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">Include</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">Required</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Custom Label</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(config) as Array<keyof AddressBlockConfig>).map((component, index) => (
              <tr key={component} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-medium text-gray-700">
                  {componentLabels[component]}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={config[component].enabled}
                    onChange={(e) => updateComponent(component, 'enabled', e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                    disabled={component === 'street1'} // Always require at least street address
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={config[component].required}
                    onChange={(e) => updateComponent(component, 'required', e.target.checked)}
                    disabled={!config[component].enabled || component === 'street1'}
                    className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={config[component].label}
                    onChange={(e) => updateComponent(component, 'label', e.target.value)}
                    disabled={!config[component].enabled}
                    className="w-full min-w-[200px] text-sm disabled:opacity-50"
                    placeholder={componentLabels[component]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Location Integration</h4>
        <p className="text-xs text-blue-700">
          • State/Territory will be populated from configured locations (dropdown)
        </p>
        <p className="text-xs text-blue-700">
          • County will be filtered based on selected State (dropdown)
        </p>
        <p className="text-xs text-blue-700">
          • City will allow free-form text entry with optional autocomplete
        </p>
      </div>
    </div>
  );
}