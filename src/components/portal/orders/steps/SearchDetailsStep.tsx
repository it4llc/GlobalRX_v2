'use client';

import { DynamicFieldInput } from '@/components/dynamic-field-input';

interface SearchDetailsStepProps {
  requirements: any;
  serviceItems: any[];
  searchFieldValues: Record<string, Record<string, any>>;
  errors: Record<string, string>;
  onFieldChange: (itemId: string, fieldId: string, value: any) => void;
  onFieldError: (itemId: string, fieldId: string) => void;
}

export function SearchDetailsStep({
  requirements,
  serviceItems,
  searchFieldValues,
  errors,
  onFieldChange,
  onFieldError
}: SearchDetailsStepProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Search Details
      </h3>
      <p className="text-gray-600 mb-4">
        Provide details for each service in your order.
      </p>
      {requirements.searchFields.some((f: any) => f.required) && (
        <p className="text-sm text-gray-500 mb-6">
          <span className="text-red-500">*</span> Required fields must be completed before submission
        </p>
      )}

      <div className="space-y-6">
        {serviceItems.map((item: any) => {
          const itemFields = requirements.searchFields
            // Fields are pre-sorted by displayOrder from the API
            .filter((field: any) => field.serviceId === item.serviceId && field.locationId === item.locationId);

          return (
            <div key={item.itemId} className="border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                {item.serviceName}: <span className="text-blue-700">{item.locationName}</span>
              </h4>

              {/* Service-specific Fields */}
              <div>
                <h5 className="text-md font-medium text-gray-700 mb-3">Search Parameters</h5>
                {itemFields.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No additional search parameters required for this service.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {itemFields.map((field: any) => (
                      <div key={field.id} className={field.dataType === 'textarea' ? 'md:col-span-2' : ''}>
                        <DynamicFieldInput
                          field={field}
                          value={searchFieldValues[item.itemId]?.[field.id]}
                          onChange={(value) => {
                            onFieldChange(item.itemId, field.id, value);
                            // Clear error when user updates field
                            const errorKey = `${item.itemId}_${field.id}`;
                            if (errors[errorKey]) {
                              onFieldError(item.itemId, field.id);
                            }
                          }}
                          error={errors[`${item.itemId}_${field.id}`]}
                          countryId={item.locationId}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}