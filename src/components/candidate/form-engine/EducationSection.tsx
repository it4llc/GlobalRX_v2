// /GlobalRX_v2/src/components/candidate/form-engine/EducationSection.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { ScopeDisplay } from './ScopeDisplay';
import { EntryCountrySelector } from './EntryCountrySelector';
import { RepeatableEntryManager } from './RepeatableEntryManager';
import CandidateDocumentUpload from '../CandidateDocumentUpload';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import {
  buildRepeatableProgressInputs,
  buildSubjectRequirementsForEntries,
  useRepeatableSectionStage4Wiring,
} from '@/lib/candidate/useRepeatableSectionStage4Wiring';
import type {
  EntryData,
  RepeatableFieldValue,
  ScopeInfo,
} from '@/types/candidate-repeatable-form';
import type { FieldMetadata, DocumentMetadata, FieldValue } from '@/types/candidate-portal';
import type {
  CrossSectionRequirementEntry,
  CrossSectionTarget,
  SectionStatus,
  UploadedDocumentMetadata,
} from '@/types/candidate-stage4';

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

interface EducationSectionProps {
  token: string;
  serviceIds: string[];
  // Phase 6 Stage 4 — section-progress reporting and cross-section registry
  // wiring. The section computes its own status after each save and forwards
  // it to the shell via onProgressUpdate. Subject-targeted DSX requirements
  // are pushed into the registry so Personal Information's progress check can
  // include them (BR 17 / 18); they are cleared on entry removal (BR 19) and
  // when a country selection changes for an entry.
  onProgressUpdate?: (status: SectionStatus) => void;
  onCrossSectionRequirementsChanged?: (
    target: CrossSectionTarget,
    triggeredBy: string,
    entries: CrossSectionRequirementEntry[],
  ) => void;
  onCrossSectionRequirementsRemovedForEntry?: (
    triggeredBy: string,
    entryIndex: number,
  ) => void;
  onCrossSectionRequirementsRemovedForSource?: (triggeredBy: string) => void;
  // Phase 7 Stage 1 — invoked after a successful auto-save so the shell can
  // re-fetch /validate. Matches the prop in PersonalInfoSection / IdvSection.
  onSaveSuccess?: () => void;
}

// Triggered-by source identifier used for every cross-section registry entry
// contributed by this section. Stable across countries / entries; the
// registry stores entryOrder separately so per-entry cleanup works.
const CROSS_SECTION_SOURCE = 'education_history';

/**
 * Education History Section
 *
 * Section component with multiple entry support for education history.
 * Uses RepeatableEntryManager, per-entry country selection, and DSX field rendering.
 */
export function EducationSection({
  token,
  serviceIds,
  onProgressUpdate,
  onCrossSectionRequirementsChanged,
  onCrossSectionRequirementsRemovedForEntry,
  onCrossSectionRequirementsRemovedForSource,
  onSaveSuccess,
}: EducationSectionProps) {
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

  // Auto-save when entries change. We do NOT gate on entries.length > 0:
  // when the candidate removes the last entry, the server still needs to
  // receive the empty array so it can clear the section. Per spec,
  // "Removing an entry removes its data."
  useEffect(() => {
    if (debouncedPendingSave) {
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
          event: 'education_countries_load_error',
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

  // Phase 6 Stage 4 — keep subject-targeted fields per country alongside the
  // local fields so the cross-section registry can be (re)populated whenever
  // an entry's country changes. Cached by countryId because the underlying
  // DSX requirements only vary by country, not by entry index.
  const [subjectFieldsByCountry, setSubjectFieldsByCountry] = useState<Record<string, DsxField[]>>({});

  const loadFieldsForCountry = async (countryId: string) => {
    // Check if we already have fields for this country
    if (fieldsByCountry[countryId]) {
      return;
    }

    try {
      const localFieldMap = new Map<string, DsxField>();
      // Phase 6 Stage 4 — collect subject-targeted fields separately so we
      // can push them into the cross-section registry under the `subject`
      // target. Subject fields are still filtered OUT of the local render
      // path (they belong on Personal Information), but the registry needs to
      // know about them so Personal Info's progress check evaluates them.
      const subjectFieldMap = new Map<string, DsxField>();

      for (const serviceId of serviceIds) {
        const response = await fetch(
          `/api/candidate/application/${token}/fields?serviceId=${serviceId}&countryId=${countryId}`
        );

        if (!response.ok) {
          throw new Error('Failed to load fields');
        }

        const data = await response.json();

        // Split fields by collectionTab. The database value used to mark a
        // field as belonging to the Personal Information section is "subject"
        // (BR 17). Fields without a collectionTab (empty string) are kept
        // and shown in this section locally.
        for (const field of data.fields || []) {
          const fieldData = field.fieldData || {};
          const collectionTab = fieldData.collectionTab || fieldData.collection_tab || '';

          if (collectionTab.toLowerCase().includes('subject')) {
            if (!subjectFieldMap.has(field.fieldKey)) {
              subjectFieldMap.set(field.fieldKey, field);
            }
          } else {
            if (!localFieldMap.has(field.fieldKey)) {
              localFieldMap.set(field.fieldKey, field);
            }
          }
        }
      }

      // Sort by display order
      const uniqueFields = Array.from(localFieldMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );
      const uniqueSubjectFields = Array.from(subjectFieldMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      setFieldsByCountry(prev => ({
        ...prev,
        [countryId]: uniqueFields
      }));
      setSubjectFieldsByCountry(prev => ({
        ...prev,
        [countryId]: uniqueSubjectFields
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
    // Phase 6 Stage 4 — clear cross-section requirements contributed by this
    // entry before removing it (BR 19). The registry keys by triggeredBy +
    // triggeredByEntryIndex so the removal is precise; sibling entries with
    // the same fieldKey but different entryOrder remain in the registry.
    const entry = entries.find(e => e.entryId === entryId);
    if (entry && onCrossSectionRequirementsRemovedForEntry) {
      onCrossSectionRequirementsRemovedForEntry(CROSS_SECTION_SOURCE, entry.entryOrder);
    }
    setEntries(prev => prev.filter(e => e.entryId !== entryId));
    setPendingSave(true);
  };

  const handleEntryChange = (entryId: string, data: Partial<EntryData>) => {
    setEntries(prev => prev.map(entry =>
      entry.entryId === entryId ? { ...entry, ...data } : entry
    ));
  };

  const handleCountryChange = async (entryId: string, countryId: string) => {
    // Phase 6 Stage 4 — when the entry's country changes, the previous
    // country's subject-targeted fields no longer apply to this entry. Clear
    // any registry contributions tagged with this entryOrder so stale fields
    // don't linger; the cross-section "rebuild" useEffect below will re-push
    // the new country's subject fields once they load.
    const entry = entries.find(e => e.entryId === entryId);
    if (entry && onCrossSectionRequirementsRemovedForEntry) {
      onCrossSectionRequirementsRemovedForEntry(CROSS_SECTION_SOURCE, entry.entryOrder);
    }

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
      // Phase 7 Stage 1 — re-fetch /validate after the save lands so the
      // shell-rendered SectionErrorBanner reflects the updated scope/gap state.
      onSaveSuccess?.();
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

  // Phase 6 Stage 4 — store and persist document metadata for per_entry-scoped
  // requirements. Metadata is keyed by `${entryId}::${requirementId}` so
  // multiple entries can each carry their own document for the same
  // requirement. Reading the persisted value out of the saved entry's fields
  // covers hydration; writing back into the entry's fields persists via the
  // standard auto-save (Stage 3 already widened the value union to accept
  // JSON objects, so no save-shape change is required).
  const handleDocumentUpload = (
    entryId: string,
    requirementId: string,
    metadata: UploadedDocumentMetadata,
  ) => {
    handleFieldChange(entryId, requirementId, metadata as unknown as FieldValue);
    setPendingSave(true);
  };

  const handleDocumentRemove = (entryId: string, requirementId: string) => {
    handleFieldChange(entryId, requirementId, null);
    setPendingSave(true);
  };

  const renderEntry = (entry: EntryData, index: number) => {
    const fields = entry.countryId ? fieldsByCountry[entry.countryId] || [] : [];
    // Split into data fields and document requirements. Documents render via
    // CandidateDocumentUpload (per_entry-scope per BR 11), data fields render
    // via DynamicFieldRenderer as before.
    const dataFields = fields.filter(f => f.type !== 'document');
    const documentFields = fields.filter(f => f.type === 'document');

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

        {dataFields.length > 0 && (
          <div className="space-y-4">
            {dataFields.map(field => {
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
                  fieldData={field.fieldData ?? undefined}
                  value={fieldValue}
                  onChange={(value) => handleFieldChange(entry.entryId, field.requirementId, value)}
                  onBlur={handleFieldBlur}
                  // Phase 6 Stage 3: pass the entry's country and token so
                  // the embedded AddressBlockInput (rendered by the
                  // DynamicFieldRenderer for address_block fields) can
                  // populate its state/province dropdown.
                  countryId={entry.countryId ?? null}
                  token={token}
                />
              );
            })}
          </div>
        )}

        {documentFields.length > 0 && (
          <div className="space-y-3">
            {documentFields.map(field => {
              // Find any previously-saved metadata for this document inside
              // the entry's persisted fields. Saved values are stored as raw
              // JSON objects (per Stage 3 widening); we coerce only when the
              // value looks like an UploadedDocumentMetadata record.
              const stored = entry.fields.find(
                f => f.requirementId === field.requirementId
              );
              const uploaded =
                stored &&
                stored.value &&
                typeof stored.value === 'object' &&
                !Array.isArray(stored.value) &&
                (stored.value as { documentId?: unknown }).documentId
                  ? (stored.value as unknown as UploadedDocumentMetadata)
                  : null;
              return (
                <CandidateDocumentUpload
                  key={field.requirementId}
                  requirement={{
                    id: field.requirementId,
                    name: field.name,
                    instructions: field.instructions ?? null,
                    isRequired: field.isRequired,
                    // Per BR 11, documents inside an entry are per_entry-scoped.
                    scope: 'per_entry',
                  }}
                  uploadedDocument={uploaded}
                  onUploadComplete={(metadata) =>
                    handleDocumentUpload(entry.entryId, field.requirementId, metadata)
                  }
                  onRemove={() =>
                    handleDocumentRemove(entry.entryId, field.requirementId)
                  }
                  token={token}
                  entryIndex={entry.entryOrder}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Phase 6 Stage 4 — feed the shared helpers + wiring hook. The pure
  // helpers in useRepeatableSectionStage4Wiring own the shape transforms
  // (subject-requirements flatten, progress-inputs build) so each section
  // contributes only the per-section identity (CROSS_SECTION_SOURCE) and the
  // already-shaped state (entries, subject fields per country, local fields
  // per country). Memoizing the helper outputs keeps the hook's effect deps
  // stable across renders.
  const subjectRequirements = useMemo(
    () =>
      buildSubjectRequirementsForEntries(
        entries,
        subjectFieldsByCountry,
        CROSS_SECTION_SOURCE,
      ),
    [entries, subjectFieldsByCountry],
  );

  const progressInputs = useMemo(
    () =>
      buildRepeatableProgressInputs({
        entries,
        fieldsByCountry,
        loading,
      }),
    [entries, fieldsByCountry, loading],
  );

  useRepeatableSectionStage4Wiring({
    triggeredBy: CROSS_SECTION_SOURCE,
    subjectRequirements,
    progressInputs,
    onCrossSectionRequirementsChanged,
    onCrossSectionRequirementsRemovedForSource,
    onProgressUpdate,
  });

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">{t('candidate.portal.sections.educationHistory')}</h2>
        <div className="text-gray-600">{t('candidate.portal.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('candidate.portal.sections.educationHistory')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {scope && <ScopeDisplay scope={scope} />}

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
        entryLabelKey="candidate.portal.educationEntryLabel"
      />
    </div>
  );
}

