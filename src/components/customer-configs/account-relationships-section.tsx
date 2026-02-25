import React from 'react';
import { RadioGroup } from '@/components/ui/radio-group';
import { Radio } from '@/components/ui/radio';
import { Label } from '@/components/ui/label';
import { CustomerSelect } from '@/components/modules/customer/customer-select';
import { CustomerDetails } from '@/types/customer';

interface AccountRelationshipsSectionProps {
  customer: CustomerDetails;
  isEditMode: boolean;
  formData: {
    accountType: 'master' | 'subaccount';
    masterAccountId: string;
    billingType: 'independent' | 'through_other';
    billingAccountId: string;
  };
  onInputChange: (field: string, value: string) => void;
  customerId: string;
}

export function AccountRelationshipsSection({
  customer,
  isEditMode,
  formData,
  onInputChange,
  customerId,
}: AccountRelationshipsSectionProps) {
  return (
    <div data-testid="account-relationships-section" className="bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-300">
        <h3 className="text-sm font-semibold text-gray-900">Account Relationships</h3>
      </div>

      <div className="divide-y divide-gray-200">
        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Account Type</span>
          <div className="flex-1">
            {isEditMode ? (
              <RadioGroup
                value={formData.accountType}
                onValueChange={(value) => onInputChange('accountType', value)}
                className="flex space-x-8"
              >
                <div className="flex items-center">
                  <Radio
                    id="account-type-master"
                    value="master"
                    checked={formData.accountType === "master"}
                  />
                  <Label htmlFor="account-type-master" className="ml-2">Master Account</Label>
                </div>
                <div className="flex items-center">
                  <Radio
                    id="account-type-subaccount"
                    value="subaccount"
                    checked={formData.accountType === "subaccount"}
                  />
                  <Label htmlFor="account-type-subaccount" className="ml-2">Subaccount</Label>
                </div>
              </RadioGroup>
            ) : (
              <span className="text-sm text-gray-500">
                {customer.masterAccountId ? 'Subaccount' : 'Master Account'}
              </span>
            )}
          </div>
        </div>

        {(customer.masterAccount || (isEditMode && formData.accountType === 'subaccount')) && (
          <div className="px-6 py-3 flex justify-between">
            <span className="text-sm font-medium text-gray-900 w-48">Master Account</span>
            <div className="flex-1">
              {isEditMode && formData.accountType === 'subaccount' ? (
                <CustomerSelect
                  id="masterAccountId"
                  value={formData.masterAccountId}
                  onChange={(value) => onInputChange('masterAccountId', value)}
                  placeholder="Select master account"
                  excludeIds={[customerId]}
                  className="w-full"
                />
              ) : (
                <span className="text-sm text-gray-500">{customer.masterAccount?.name || ''}</span>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Billing Type</span>
          <div className="flex-1">
            {isEditMode ? (
              <RadioGroup
                value={formData.billingType}
                onValueChange={(value) => onInputChange('billingType', value)}
                className="flex space-x-8"
              >
                <div className="flex items-center">
                  <Radio
                    id="billing-type-independent"
                    value="independent"
                    checked={formData.billingType === "independent"}
                  />
                  <Label htmlFor="billing-type-independent" className="ml-2">Bills Independently</Label>
                </div>
                <div className="flex items-center">
                  <Radio
                    id="billing-type-through-other"
                    value="through_other"
                    checked={formData.billingType === "through_other"}
                  />
                  <Label htmlFor="billing-type-through-other" className="ml-2">Bills Through Another</Label>
                </div>
              </RadioGroup>
            ) : (
              <span className="text-sm text-gray-500">
                {customer.billingAccountId ? 'Bills Through Another Account' : 'Bills Independently'}
              </span>
            )}
          </div>
        </div>

        {(customer.billingAccount || (isEditMode && formData.billingType === 'through_other')) && (
          <div className="px-6 py-3 flex justify-between">
            <span className="text-sm font-medium text-gray-900 w-48">Billing Account</span>
            <div className="flex-1">
              {isEditMode && formData.billingType === 'through_other' ? (
                <CustomerSelect
                  id="billingAccountId"
                  value={formData.billingAccountId}
                  onChange={(value) => onInputChange('billingAccountId', value)}
                  placeholder="Select billing account"
                  excludeIds={[customerId]}
                  className="w-full"
                />
              ) : (
                <span className="text-sm text-gray-500">{customer.billingAccount?.name || ''}</span>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Subaccounts</span>
          <div className="flex-1">
            <span className="text-sm text-gray-500">{customer.subaccountsCount}</span>
          </div>
        </div>

        <div className="px-6 py-3 flex justify-between">
          <span className="text-sm font-medium text-gray-900 w-48">Service Packages</span>
          <div className="flex-1">
            <span className="text-sm text-gray-500">{customer.packagesCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}