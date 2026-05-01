// /GlobalRX_v2/src/components/candidate/form-engine/IdvSection.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import type { FieldMetadata, DocumentMetadata, FieldValue } from '@/types/candidate-portal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IdvField {
  requirementId: string;
  name: string;
  fieldKey: string;
  type: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata | null;
  documentData?: DocumentMetadata | null;
  displayOrder: number;
}

interface IdvSectionProps {
  token: string;
  serviceIds: string[];
}

/**
 * IDV Section Component
 *
 * A self-contained component that replaces the IDV placeholder.
 * Includes country selector and dynamic field loading based on country.
 *
 * This component is intentionally self-contained to allow future replacement
 * with third-party IDV provider integrations (embedded widgets, external redirects, etc.)
 * without affecting the rest of the application. The parent only needs to know
 * whether IDV is started/complete, not the internal field details.
 */
export function IdvSection({ token, serviceIds }: IdvSectionProps) {
  const { t } = useTranslation();
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [fields, setFields] = useState<IdvField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set());

  // Debounce the pending saves to batch them
  const debouncedPendingSaves = useDebounce(pendingSaves, 300);

  // Load countries on mount
  useEffect(() => {
    loadCountries();
    loadSavedData();
  }, [token]);

  const loadCountries = async () => {
    try {
      // For now, use a static list. In production, this would come from the database
      const countryList = [
        { id: 'US', name: 'United States' },
        { id: 'CA', name: 'Canada' },
        { id: 'UK', name: 'United Kingdom' },
        { id: 'AU', name: 'Australia' },
        { id: 'XX', name: 'Other' } // For testing no-fields scenario
      ];
      setCountries(countryList);
    } catch (error) {
      logger.error('Failed to load countries', {
        event: 'countries_load_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const loadSavedData = async () => {
    try {
      const savedDataResponse = await fetch(
        `/api/candidate/application/${token}/saved-data`
      );

      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const idvData = savedData.sections?.idv?.fields || [];

        // Build form data map
        const dataMap: Record<string, any> = {};
        for (const field of idvData) {
          dataMap[field.requirementId] = field.value;
        }

        // Check if there's a saved country
        const savedCountry = savedData.sections?.idv?.country;
        if (savedCountry) {
          setSelectedCountry(savedCountry);
        }

        setFormData(dataMap);
      }
    } catch (error) {
      logger.error('Failed to load saved IDV data', {
        event: 'idv_saved_data_load_error',
        token,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Load fields when country changes
  useEffect(() => {
    if (selectedCountry && serviceIds.length > 0) {
      loadFieldsForCountry(selectedCountry);
    } else if (selectedCountry) {
      setFields([]);
    }
  }, [selectedCountry, serviceIds]);

  const loadFieldsForCountry = async (countryId: string) => {
    setLoading(true);
    try {
      // Load fields for each IDV service
      const allFields: IdvField[] = [];
      const fieldMap = new Map<string, IdvField>();

      for (const serviceId of serviceIds) {
        const response = await fetch(
          `/api/candidate/application/${token}/fields?serviceId=${serviceId}&countryId=${countryId}`
        );

        if (!response.ok) {
          throw new Error('Failed to load fields');
        }

        const data = await response.json();

        // Filter out personal info fields
        for (const field of data.fields || []) {
          const fieldData = field.fieldData || {};
          const collectionTab = fieldData.collectionTab || fieldData.collection_tab || '';

          // Skip fields that belong to personal info tab
          const isPersonalInfoField =
            collectionTab.toLowerCase().includes('personal') ||
            collectionTab.toLowerCase().includes('subject') ||
            ['firstName', 'lastName', 'middleName', 'email', 'phone', 'phoneNumber',
             'dateOfBirth', 'birthDate', 'dob'].includes(field.fieldKey);

          if (!isPersonalInfoField && !fieldMap.has(field.requirementId)) {
            fieldMap.set(field.requirementId, field);
          }
        }
      }

      // Convert map to array and sort
      const uniqueFields = Array.from(fieldMap.values())
        .sort((a, b) => a.displayOrder - b.displayOrder);

      setFields(uniqueFields);

      // Preserve existing form data for this country
      if (formData[`country_${countryId}`]) {
        setFormData(prev => ({
          ...prev,
          ...formData[`country_${countryId}`]
        }));
      }

    } catch (error) {
      logger.error('Failed to load IDV fields', {
        event: 'idv_fields_load_error',
        token,
        countryCode: selectedCountry,
        serviceIds: serviceIds.join(','),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle country change
  const handleCountryChange = useCallback((countryId: string) => {
    // Save current country's data before switching
    if (selectedCountry && fields.length > 0) {
      const currentCountryData: Record<string, any> = {};
      for (const field of fields) {
        if (formData[field.requirementId] !== undefined) {
          currentCountryData[field.requirementId] = formData[field.requirementId];
        }
      }

      setFormData(prev => ({
        ...prev,
        [`country_${selectedCountry}`]: currentCountryData
      }));
    }

    setSelectedCountry(countryId);

    // Save country selection
    setPendingSaves(prev => new Set(prev).add('country'));
  }, [selectedCountry, fields, formData]);

  // Handle field value change
  const handleFieldChange = useCallback((requirementId: string, value: FieldValue) => {
    setFormData(prev => ({
      ...prev,
      [requirementId]: value
    }));
  }, []);

  // Handle field blur - trigger save
  const handleFieldBlur = useCallback((requirementId: string) => {
    setPendingSaves(prev => new Set(prev).add(requirementId));
  }, []);

  // Save data when debounced pending saves changes
  useEffect(() => {
    if (debouncedPendingSaves.size === 0 || !selectedCountry) {
      return;
    }

    const saveData = async () => {
      setSaveStatus('saving');

      try {
        const fieldsToSave = Array.from(debouncedPendingSaves)
          .filter(id => id !== 'country')
          .map(requirementId => ({
            requirementId,
            value: formData[requirementId]
          }));

        // Add country to save data
        if (debouncedPendingSaves.has('country')) {
          fieldsToSave.push({
            requirementId: 'idv_country',
            value: selectedCountry
          });
        }

        const response = await fetch(
          `/api/candidate/application/${token}/save`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sectionType: 'idv',
              sectionId: 'idv',
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
        logger.error('Failed to save IDV data', {
          event: 'idv_save_error',
          token,
          sectionId: 'idv',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        setSaveStatus('error');

        // Retry after 2 seconds
        setTimeout(() => {
          setPendingSaves(prev => new Set([...prev, ...debouncedPendingSaves]));
        }, 2000);
      }
    };

    saveData();
  }, [debouncedPendingSaves, formData, selectedCountry, token]);

  return (
    <div className="space-y-6">
      {/* Section header with save indicator */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">{t('candidate.portal.sections.identityVerification')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {/* Country selector */}
      <div className="space-y-2">
        <label htmlFor="country" className="block text-sm font-medium">
          {t('candidate.portal.idv.selectCountry')}
        </label>
        <Select
          value={selectedCountry}
          onValueChange={handleCountryChange}
        >
          <SelectTrigger
            id="country"
            name="country"
            className="min-h-[44px] text-base"
            data-testid="country-selector"
          >
            <SelectValue placeholder={t('candidate.portal.idv.chooseCountry')} />
          </SelectTrigger>
          <SelectContent>
            {countries.map(country => (
              <SelectItem key={country.id} value={country.id}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fields container */}
      {selectedCountry && (
        <div data-testid="idv-fields-container">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-gray-600">{t('candidate.portal.loadingFields')}</div>
            </div>
          ) : fields.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              {t('candidate.portal.idv.noFieldsRequired')}
            </div>
          ) : (
            <div className="space-y-4">
              {fields
                .filter(field => field.type === 'field') // Only show field types, not documents
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
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}