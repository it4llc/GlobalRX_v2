'use client';

import { DynamicFieldInput } from '@/components/dynamic-field-input';

interface SubjectInfoStepProps {
  requirements: any;
  subjectFieldValues: Record<string, any>;
  errors: Record<string, string>;
  serviceItems: any[];
  onFieldChange: (fieldId: string, value: any) => void;
  onFieldError: (fieldId: string) => void;
}

export function SubjectInfoStep({
  requirements,
  subjectFieldValues,
  errors,
  serviceItems,
  onFieldChange,
  onFieldError
}: SubjectInfoStepProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Subject Information
      </h3>
      <p className="text-gray-600 mb-4">
        Enter information about the person this order is for. This information will be collected once for the entire order.
      </p>
      {requirements.subjectFields.some((f: any) => f.required) && (
        <p className="text-sm text-gray-500 mb-6">
          <span className="text-red-500">*</span> Required fields must be completed before submission
        </p>
      )}

      {requirements.subjectFields.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No subject information fields required for this order.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requirements.subjectFields
            // Fields are pre-sorted by displayOrder from the API
            .map((field: any) => {
            // Get the first country from the service items for subject-level fields
            const firstCountryId = serviceItems.length > 0 ? serviceItems[0].locationId : undefined;

            return (
              <div key={field.id} className={field.dataType === 'textarea' ? 'md:col-span-2' : ''}>
                <DynamicFieldInput
                  field={field}
                  value={subjectFieldValues[field.id]}
                  onChange={(value) => {
                    onFieldChange(field.id, value);
                    // Clear error when user updates field
                    if (errors[field.id]) {
                      onFieldError(field.id);
                    }
                  }}
                  error={errors[field.id]}
                  countryId={firstCountryId}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}