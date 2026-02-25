import React from 'react';
import { Input } from '@/components/ui/input';
import { CustomerDetails } from '@/types/customer';

interface BasicInformationSectionProps {
  customer: CustomerDetails;
  isEditMode: boolean;
  formData: {
    name: string;
    address: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  onInputChange: (field: string, value: string) => void;
}

export function BasicInformationSection({
  customer,
  isEditMode,
  formData,
  onInputChange,
}: BasicInformationSectionProps) {
  return (
    <div data-testid="basic-information-section" className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
        <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
      </div>

      <div className="divide-y divide-gray-200">
        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Name</span>
          <div className="flex-1">
            {isEditMode ? (
              <Input
                value={formData.name}
                onChange={(e) => onInputChange('name', e.target.value)}
                placeholder="Enter customer name"
                className="w-full"
              />
            ) : (
              <span className="text-sm text-gray-500">{customer.name}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Address</span>
          <div className="flex-1">
            {isEditMode ? (
              <Input
                value={formData.address}
                onChange={(e) => onInputChange('address', e.target.value)}
                placeholder="Enter address"
                className="w-full"
              />
            ) : (
              <span className="text-sm text-gray-500">{customer.address || 'Not specified'}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Contact Name</span>
          <div className="flex-1">
            {isEditMode ? (
              <Input
                value={formData.contactName}
                onChange={(e) => onInputChange('contactName', e.target.value)}
                placeholder="Enter contact person's name"
                className="w-full"
              />
            ) : (
              <span className="text-sm text-gray-500">{customer.contactName || 'Not specified'}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Contact Email</span>
          <div className="flex-1">
            {isEditMode ? (
              <Input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => onInputChange('contactEmail', e.target.value)}
                placeholder="Enter contact email"
                className="w-full"
              />
            ) : (
              <span className="text-sm text-gray-500">{customer.contactEmail || 'Not specified'}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Contact Phone</span>
          <div className="flex-1">
            {isEditMode ? (
              <Input
                value={formData.contactPhone}
                onChange={(e) => onInputChange('contactPhone', e.target.value)}
                placeholder="Enter contact phone number"
                className="w-full"
              />
            ) : (
              <span className="text-sm text-gray-500">{customer.contactPhone || 'Not specified'}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Status</span>
          <div className="flex-1">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              customer.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}>
              {customer.disabled ? 'Disabled' : 'Active'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}