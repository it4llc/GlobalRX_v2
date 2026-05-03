// /GlobalRX_v2/src/components/candidate/form-engine/EducationSection.tsx

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { ScopeDisplay } from './ScopeDisplay';
import { EntryCountrySelector } from './EntryCountrySelector';
import { RepeatableEntryManager } from './RepeatableEntryManager';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import type { EntryData, ScopeInfo } from '@/types/candidate-repeatable-form';
import type { FieldMetadata, DocumentMetadata, FieldValue } from '@/types/candidate-portal';

interface DsxField {
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

interface EducationSectionProps {
  token: string;
  serviceIds: string[];
}

/**
 * Education History Section
 *
 * Section component with multiple entry support for education history.
 * Uses RepeatableEntryManager, per-entry country selection, and DSX field rendering.
 */
export function EducationSection({ token, serviceIds }: EducationSectionProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [fieldsByCountry, setFieldsByCountry] = useState<Record<string, DsxField[]>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSave, setPendingSave] = useState(false);

  // Debounce save trigger
  const debouncedPendingSave = useDebounce(pendingSave, 500);

  // Load scope, countries, and saved data on mount
  useEffect(() => {
    loadInitialData();
  }, [token, serviceIds]);

  // Auto-save when entries change
  useEffect(() => {
    if (debouncedPendingSave && entries.length > 0) {
      saveEntries();
    }
  }, [debouncedPendingSave]);

  const loadInitialData = async () => {
    try {
      // Load scope if we have service IDs
      if (serviceIds.length > 0) {
        const scopeResponse = await fetch(
          `/api/candidate/application/${token}/scope?functionalityType=verification-edu`
        );

        if (scopeResponse.ok) {
          const scopeData = await scopeResponse.json();
          setScope(scopeData);
        }
      }

      // Load countries from candidate-specific API
      const countriesResponse = await fetch(
        `/api/candidate/application/${token}/countries`
      );
      if (countriesResponse.ok) {
        const countriesData = await countriesResponse.json();
        const countryList = countriesData.map((country: any) => ({
          id: country.id,
          name: country.name
        }));
        setCountries(countryList);
      } else {
        logger.error('Failed to load countries', {
          event: 'education_countries_load_error',
          token,
          status: countriesResponse.status
        });
        // Fallback to a static list if API fails
        const countryList = [
          { id: 'US', name: 'United States' },
          { id: 'CA', name: 'Canada' },
          { id: 'UK', name: 'United Kingdom' },
          { id: 'AU', name: 'Australia' }
        ];
        setCountries(countryList);
      }

      // Load saved data
      const savedDataResponse = await fetch(
        `/api/candidate/application/${token}/saved-data`
      );

      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const educationData = savedData.sections?.education?.entries || [];

        if (educationData.length > 0) {
          setEntries(educationData);
          // Load fields for saved countries
          for (const entry of educationData) {
            if (entry.countryId) {
              await loadFieldsForCountry(entry.countryId);
            }
          }
        } else {
          // Start with one empty entry on first visit
          setEntries([createEmptyEntry()]);
        }
      } else {
        // Start with one empty entry
        setEntries([createEmptyEntry()]);
      }
    } catch (error) {
      logger.error('Failed to load education section data', {
        event: 'education_section_load_error',
        token,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Start with one empty entry even on error
      setEntries([createEmptyEntry()]);
    } finally {
      setLoading(false);
    }
  };

  const createEmptyEntry = (): EntryData => {
    return {
      entryId: crypto.randomUUID(),
      countryId: null,
      entryOrder: entries.length,
      fields: []
    };
  };

  const loadFieldsForCountry = async (countryId: string) => {
    // Check if we already have fields for this country
    if (fieldsByCountry[countryId]) {
      return;
    }

    try {
      const allFields: DsxField[] = [];
      const fieldMap = new Map<string, DsxField>();

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

          if (!collectionTab.toLowerCase().includes('personal')) {
            // Use fieldKey as deduplication key
            if (!fieldMap.has(field.fieldKey)) {
              fieldMap.set(field.fieldKey, field);
            }
          }
        }
      }

      // Sort by display order
      const uniqueFields = Array.from(fieldMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      setFieldsByCountry(prev => ({
        ...prev,
        [countryId]: uniqueFields
      }));
    } catch (error) {
      logger.error('Failed to load fields for country', {
        event: 'education_fields_load_error',
        countryId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleAddEntry = () => {
    const newEntry = createEmptyEntry();
    setEntries(prev => [...prev, newEntry]);
    setPendingSave(true);
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => e.entryId !== entryId));
    setPendingSave(true);
  };

  const handleEntryChange = (entryId: string, data: Partial<EntryData>) => {
    setEntries(prev => prev.map(entry =>
      entry.entryId === entryId ? { ...entry, ...data } : entry
    ));
  };

  const handleCountryChange = async (entryId: string, countryId: string) => {
    // Update the entry's country
    handleEntryChange(entryId, { countryId });

    // Load fields for this country if not already loaded
    if (countryId && !fieldsByCountry[countryId]) {
      await loadFieldsForCountry(countryId);
    }

    setPendingSave(true);
  };

  const handleFieldChange = (entryId: string, requirementId: string, value: FieldValue) => {
    setEntries(prev => prev.map(entry => {
      if (entry.entryId === entryId) {
        const existingFieldIndex = entry.fields.findIndex(
          f => f.requirementId === requirementId
        );

        const newFields = [...entry.fields];
        if (existingFieldIndex >= 0) {
          newFields[existingFieldIndex] = { requirementId, value };
        } else {
          newFields.push({ requirementId, value });
        }

        return { ...entry, fields: newFields };
      }
      return entry;
    }));
  };

  const handleFieldBlur = () => {
    setPendingSave(true);
  };

  const saveEntries = async () => {
    setSaveStatus('saving');
    setPendingSave(false);

    try {
      const response = await fetch(
        `/api/candidate/application/${token}/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionType: 'education',
            sectionId: 'education',
            entries: entries.map((entry, index) => ({
              ...entry,
              entryOrder: index
            }))
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Failed to save education entries', {
        event: 'education_save_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const renderEntry = (entry: EntryData, index: number) => {
    const fields = entry.countryId ? fieldsByCountry[entry.countryId] || [] : [];

    return (
      <div className="space-y-4">
        {/* Country selector */}
        <EntryCountrySelector
          value={entry.countryId}
          onChange={(countryId) => handleCountryChange(entry.entryId, countryId)}
          countries={countries}
        />

        {/* Fields for selected country */}
        {entry.countryId && fields.length === 0 && (
          <p className="text-gray-500 italic">
            {t('candidate.portal.noFieldsForCountry')}
          </p>
        )}

        {fields.length > 0 && (
          <div className="space-y-4">
            {fields.map(field => {
              const fieldValue = entry.fields.find(
                f => f.requirementId === field.requirementId
              )?.value;

              return (
                <DynamicFieldRenderer
                  key={field.requirementId}
                  requirementId={field.requirementId}
                  name={field.name}
                  fieldKey={field.fieldKey}
                  dataType={field.dataType}
                  isRequired={field.isRequired}
                  instructions={field.instructions}
                  fieldData={field.fieldData}
                  value={fieldValue}
                  onChange={(value) => handleFieldChange(entry.entryId, field.requirementId, value)}
                  onBlur={handleFieldBlur}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">{t('candidate.portal.sections.educationHistory')}</h2>
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('candidate.portal.sections.educationHistory')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {scope && <ScopeDisplay scope={scope} sectionType="education" />}

      <RepeatableEntryManager
        entries={entries}
        onAddEntry={handleAddEntry}
        onRemoveEntry={handleRemoveEntry}
        onEntryChange={handleEntryChange}
        renderEntry={renderEntry}
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    </div>
  );
}