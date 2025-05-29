// src/components/modules/global-config/dsx/service-selector.tsx
'use client';

import { StandardDropdown } from '@/components/ui/standard-dropdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ServiceOption {
  id: string;
  value: string;
  label: string;
}

interface ServiceSelectorProps {
  services: ServiceOption[];
  selectedService: string;
  onServiceChange: (value: string) => void;
}

export function ServiceSelector({ 
  services, 
  selectedService, 
  onServiceChange 
}: ServiceSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Data & Document Requirements (DSX)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="service-select" className="font-medium">
              Select a Service:
            </label>
            <div className="flex w-full max-w-md">
              <StandardDropdown
                id="service-select"
                options={services}
                value={selectedService}
                onChange={onServiceChange}
                placeholder="Select a service to configure requirements"
              />
            </div>
          </div>

          {selectedService && (
            <p className="text-sm text-gray-500">
              Configure the data fields and documents required for{' '}
              <span className="font-medium">
                {services.find(s => s.value === selectedService)?.label}
              </span>
              .
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}