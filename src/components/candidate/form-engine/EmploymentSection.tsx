// /GlobalRX_v2/src/components/candidate/form-engine/EmploymentSection.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { ScopeDisplay } from './ScopeDisplay';
import { EntryCountrySelector } from './EntryCountrySelector';
import { RepeatableEntryManager } from './RepeatableEntryManager';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import type {
  EntryData,
  RepeatableFieldValue,
  ScopeInfo,
} from '@/types/candidate-repeatable-form';
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

// Shape of an entry returned by /api/candidate/application/[token]/countries.
// The API returns id (UUID), name, and code2; we only need id and name here,
// but allow code2 to be present so this matches the API contract.
interface CountryApiResponse {
  id: string;
  name: string;
  code2?: string;
}

interface EmploymentSectionProps {
  token: string;
  serviceIds: string[];
}

/**
 * Employment History Section
 *
 * Section component with multiple entry support for employment history.
 * Similar to EducationSection but includes "currently employed" field logic.
 */
export function EmploymentSection({ token, serviceIds }: EmploymentSectionProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [countriesError, setCountriesError] = useState(false);
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
          `/api/candidate/application/${token}/scope?functionalityType=verification-emp`
        );

        if (scopeResponse.ok) {
          const scopeData = await scopeResponse.json();
          setScope(scopeData);
        }
      }

      // Load countries from candidate-specific API.
      // We do NOT fall back to a hardcoded list here: the database stores Country.id
      // as a UUID, so any non-UUID stand-in (e.g. "US") would be rejected by the
      // save endpoint's Zod schema and prevent the candidate from saving any entry.
      // If the API call fails we surface a clear error to the candidate instead.
      const countriesResponse = await fetch(
        `/api/candidate/application/${token}/countries`
      );
      if (countriesResponse.ok) {
        const countriesData: CountryApiResponse[] = await countriesResponse.json();
        const countryList = countriesData.map((country) => ({
          id: country.id,
          name: country.name
        }));
        setCountries(countryList);
        setCountriesError(false);
      } else {
        logger.error('Failed to load countries', {
          event: 'employment_countries_load_error',
          token,
          status: countriesResponse.status
        });
        setCountries([]);
        setCountriesError(true);
      }

      // Load saved data
      const savedDataResponse = await fetch(
        `/api/candidate/application/${token}/saved-data`
      );

      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const employmentData = savedData.sections?.employment?.entries || [];

        if (employmentData.length > 0) {
          setEntries(employmentData);
          // Load fields for saved countries
          for (const entry of employmentData) {
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
      logger.error('Failed to load employment section data', {
        event: 'employment_section_load_error',
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

        // Filter out personal info fields. The collectionTab value used by
        // the database to mark a field as belonging to the Personal Information
        // section is "subject" (not "personal"), so we exclude fields whose
        // collectionTab matches "subject" case-insensitively. Fields without a
        // collectionTab (empty string) are kept and shown in this section.
        for (const field of data.fields || []) {
          const fieldData = field.fieldData || {};
          const collectionTab = fieldData.collectionTab || fieldData.collection_tab || '';

          if (!collectionTab.toLowerCase().includes('subject')) {
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
        event: 'employment_fields_load_error',
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
    // DynamicFieldRenderer types its onChange callback as FieldValue, which
    // includes Date for historical reasons. The repeatable-entry save schema
    // does not accept Date values, so we coerce a Date to its ISO string
    // before storing it on the entry. This keeps the saved data shape aligned
    // with the Zod schema in /save and avoids needing `as any` casts.
    const normalizedValue: RepeatableFieldValue =
      value instanceof Date ? value.toISOString() : value;

    setEntries(prev => prev.map(entry => {
      if (entry.entryId === entryId) {
        const existingFieldIndex = entry.fields.findIndex(
          f => f.requirementId === requirementId
        );

        const newFields = [...entry.fields];
        if (existingFieldIndex >= 0) {
          newFields[existingFieldIndex] = { requirementId, value: normalizedValue };
        } else {
          newFields.push({ requirementId, value: normalizedValue });
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
            sectionType: 'employment',
            sectionId: 'employment',
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
      logger.error('Failed to save employment entries', {
        event: 'employment_save_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Helper to check if a field is the "currently employed" field
  const isCurrentlyEmployedField = (field: DsxField): boolean => {
    const fieldKey = field.fieldKey.toLowerCase();
    return fieldKey.includes('currentlyemployed') ||
           fieldKey.includes('iscurrent') ||
           fieldKey.includes('current_employment') ||
           fieldKey.includes('currently_employed');
  };

  // Helper to check if a field is the end date field
  const isEndDateField = (field: DsxField): boolean => {
    const fieldKey = field.fieldKey.toLowerCase();
    const fieldName = field.name.toLowerCase();
    return (fieldKey.includes('enddate') || fieldKey.includes('end_date') ||
            fieldKey.includes('dateto') || fieldKey.includes('date_to')) ||
           (fieldName.includes('end date') || fieldName.includes('to date'));
  };

  // Check if currently employed is true for an entry
  const isCurrentlyEmployed = (entry: EntryData, fields: DsxField[]): boolean => {
    const currentlyEmployedField = fields.find(isCurrentlyEmployedField);
    if (!currentlyEmployedField) return false;

    const fieldValue = entry.fields.find(
      f => f.requirementId === currentlyEmployedField.requirementId
    )?.value;

    return fieldValue === true || fieldValue === 'true' || fieldValue === '1';
  };

  const renderEntry = (entry: EntryData, index: number) => {
    const fields = entry.countryId ? fieldsByCountry[entry.countryId] || [] : [];
    const currentlyEmployed = isCurrentlyEmployed(entry, fields);

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
              // Hide end date field if currently employed
              if (currentlyEmployed && isEndDateField(field)) {
                return null;
              }

              const stored = entry.fields.find(
                f => f.requirementId === field.requirementId
              );
              // DynamicFieldRenderer types value as FieldValue (no undefined),
              // so coalesce a missing entry to null which renders as empty.
              const fieldValue: FieldValue = stored ? stored.value : null;

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
        <h2 className="text-2xl font-bold mb-4">{t('candidate.portal.sections.employmentHistory')}</h2>
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('candidate.portal.sections.employmentHistory')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {scope && <ScopeDisplay scope={scope} sectionType="employment" />}

      {countriesError && (
        <div
          role="alert"
          className="mb-4 p-3 border border-red-300 bg-red-50 text-red-800 rounded-md text-sm"
        >
          {t('candidate.portal.countriesLoadError')}
        </div>
      )}

      <RepeatableEntryManager
        entries={entries}
        onAddEntry={handleAddEntry}
        onRemoveEntry={handleRemoveEntry}
        onEntryChange={handleEntryChange}
        renderEntry={renderEntry}
        entryLabelKey="candidate.portal.employmentEntryLabel"
      />
    </div>
  );
}