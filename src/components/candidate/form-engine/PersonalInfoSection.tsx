// /GlobalRX_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { useDebounce } from '@/hooks/useDebounce';

interface PersonalInfoField {
  requirementId: string;
  name: string;
  fieldKey: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: any;
  displayOrder: number;
  locked: boolean;
  prefilledValue?: string | null;
}

interface PersonalInfoSectionProps {
  token: string;
}

/**
 * Personal Information Section
 *
 * A section that appears first in the candidate's application.
 * It collects basic information about the candidate that isn't tied to any specific service.
 */
export function PersonalInfoSection({ token }: PersonalInfoSectionProps) {
  const [fields, setFields] = useState<PersonalInfoField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  // Debounce the pending saves to batch them
  const debouncedPendingSaves = useDebounce(pendingSaves, 300);

  // Load fields and saved data on mount
  useEffect(() => {
    loadFieldsAndData();
  }, [token]);

  const loadFieldsAndData = async () => {
    try {
      // Load field definitions
      const fieldsResponse = await fetch(
        `/api/candidate/application/${token}/personal-info-fields`
      );

      if (!fieldsResponse.ok) {
        throw new Error('Failed to load fields');
      }

      const fieldsData = await fieldsResponse.json();
      setFields(fieldsData.fields || []);

      // Initialize form data with pre-filled values
      const initialData: Record<string, any> = {};
      for (const field of fieldsData.fields || []) {
        if (field.prefilledValue !== null && field.prefilledValue !== undefined) {
          initialData[field.requirementId] = field.prefilledValue;
        }
      }

      // Load saved data
      const savedDataResponse = await fetch(
        `/api/candidate/application/${token}/saved-data`
      );

      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const personalInfoData = savedData.sections?.personal_info?.fields || [];

        // Merge saved data with initial data
        for (const field of personalInfoData) {
          // Don't overwrite locked pre-filled values
          const fieldDef = fieldsData.fields?.find(
            (f: PersonalInfoField) => f.requirementId === field.requirementId
          );
          if (!fieldDef?.locked) {
            initialData[field.requirementId] = field.value;
          }
        }
      }

      setFormData(initialData);
    } catch (error) {
      console.error('Failed to load personal info fields:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle field value change
  const handleFieldChange = useCallback((requirementId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [requirementId]: value
    }));
  }, []);

  // Handle field blur - trigger save
  const handleFieldBlur = useCallback((requirementId: string) => {
    // Don't save locked fields
    const field = fields.find(f => f.requirementId === requirementId);
    if (field?.locked) {
      return;
    }

    // Add to pending saves
    setPendingSaves(prev => new Set(prev).add(requirementId));
  }, [fields]);

  // Save data when debounced pending saves changes
  useEffect(() => {
    if (debouncedPendingSaves.size === 0) {
      return;
    }

    const saveData = async () => {
      setSaveStatus('saving');

      try {
        const fieldsToSave = Array.from(debouncedPendingSaves).map(requirementId => ({
          requirementId,
          value: formData[requirementId]
        }));

        const response = await fetch(
          `/api/candidate/application/${token}/save`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionType: 'personal_info',
              sectionId: 'personal_info',
              fields: fieldsToSave
            })
          }
        );

        if (!response.ok) {
          throw new Error('Save failed');
        }

        setSaveStatus('saved');
        setPendingSaves(new Set());

        // Clear saved indicator after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);

      } catch (error) {
        console.error('Failed to save personal info:', error);
        setSaveStatus('error');

        // Retry after 2 seconds
        setTimeout(() => {
          setPendingSaves(prev => new Set([...prev, ...debouncedPendingSaves]));
        }, 2000);
      }
    };

    saveData();
  }, [debouncedPendingSaves, formData, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading personal information fields...</div>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="p-8 text-center text-gray-600">
        No personal information fields are required for this application.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header with save indicator */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Personal Information</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600">
        Please fill in your personal information below. Fields marked with a red asterisk (*) are required.
        Information from your invitation is already filled in and cannot be changed.
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {fields
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(field => (
            <DynamicFieldRenderer
              key={field.requirementId}
              requirementId={field.requirementId}
              name={field.name}
              fieldKey={field.fieldKey}
              dataType={field.dataType}
              isRequired={field.isRequired}
              instructions={field.instructions}
              fieldData={field.fieldData}
              value={formData[field.requirementId] || ''}
              onChange={(value) => handleFieldChange(field.requirementId, value)}
              onBlur={() => handleFieldBlur(field.requirementId)}
              locked={field.locked}
            />
          ))}
      </div>
    </div>
  );
}