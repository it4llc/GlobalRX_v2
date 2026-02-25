import React from 'react';
import { ServiceSelection } from '@/components/modules/customer/service-selection';
import { CustomerDetails } from '@/types/customer';

interface ServicesSectionProps {
  customer: CustomerDetails;
  isEditMode: boolean;
  formData: {
    serviceIds: string[];
    dataRetentionDays: number;
  };
  onInputChange: (field: string, value: string[] | number) => void;
}

export function ServicesSection({
  customer,
  isEditMode,
  formData,
  onInputChange,
}: ServicesSectionProps) {
  return (
    <div data-testid="services-section" className="space-y-6">
      {/* Data Retention Section */}
      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
          <h3 className="text-sm font-semibold text-gray-900">Data Retention</h3>
        </div>

        <div className="divide-y divide-gray-200">
          <div className="px-6 py-3 flex justify-between">
            <span className="text-sm font-medium text-gray-900 w-48">Retention Period (Days)</span>
            <div className="flex-1">
              {isEditMode ? (
                <input
                  type="number"
                  min="1"
                  value={formData.dataRetentionDays || ''}
                  onChange={(e) => onInputChange('dataRetentionDays', parseInt(e.target.value) || 0)}
                  placeholder="Enter retention period in days"
                  className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <span className="text-sm text-gray-500">
                  {customer.dataRetentionDays ? `${customer.dataRetentionDays} days` : 'Not specified'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Available Services Section */}
      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
          <h3 className="text-sm font-semibold text-gray-900">Available Services</h3>
        </div>

        <div className="p-6">
          {isEditMode ? (
            <ServiceSelection
              value={formData.serviceIds}
              onChange={(selectedIds) => onInputChange('serviceIds', selectedIds)}
            />
          ) : (
            customer.services && customer.services.length > 0 ? (
              <div className="space-y-4">
                {customer.services.map((service) => (
                  <div key={service.id} className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-sm font-medium text-gray-900">{service.name}</span>
                    <span className="text-sm text-gray-500">{service.category}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                No services available
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}