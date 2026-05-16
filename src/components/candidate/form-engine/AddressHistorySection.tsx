// /GlobalRX_v2/src/components/candidate/form-engine/AddressHistorySection.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AutoSaveIndicator, SaveStatus } from '@/components/candidate/form-engine/AutoSaveIndicator';
import { ScopeDisplay } from '@/components/candidate/form-engine/ScopeDisplay';
import { EntryCountrySelector } from '@/components/candidate/form-engine/EntryCountrySelector';
import { RepeatableEntryManager } from '@/components/candidate/form-engine/RepeatableEntryManager';
import { AddressBlockInput } from '@/components/candidate/form-engine/AddressBlockInput';
import CandidateDocumentUpload from '@/components/candidate/CandidateDocumentUpload';
import { useEntryFieldsLoader, type EntryDsxField as DsxField } from '@/components/candidate/form-engine/useEntryFieldsLoader';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
// Task 8.4 — AggregatedRequirements (the deduplicated additional fields and
// aggregated documents) moved out of Address History to its own
// RecordSearchSection. Address History is now entries-only.
import {
  ADDRESS_HISTORY_CROSS_SECTION_SOURCE,
  buildAddressHistorySubjectRequirements,
  buildEntryFieldsBuckets,
  readEntryUploadedDocument,
  selectPerEntryDocumentFields,
  splitFieldsByCollectionTab,
} from '@/lib/candidate/addressHistoryStage4Wiring';
import {
  buildRepeatableProgressInputs,
  useRepeatableSectionStage4Wiring,
} from '@/lib/candidate/useRepeatableSectionStage4Wiring';
import type {
  EntryData,
  RepeatableFieldValue,
  ScopeInfo,
} from '@/types/candidate-repeatable-form';
import type {
  FieldValue,
} from '@/types/candidate-portal';
import type {
  AddressBlockValue,
  AddressConfig,
} from '@/types/candidate-address';
import type {
  CrossSectionRequirementEntry,
  CrossSectionTarget,
  SectionStatus,
} from '@/types/candidate-stage4';

interface CountryApiResponse {
  id: string;
  name: string;
  code2?: string;
}

interface AddressHistorySectionProps {
  token: string;
  serviceIds: string[];
  // Phase 6 Stage 4 — section-progress reporting + cross-section registry
  // wiring. Same shape as Education / Employment. The section computes the
  // shapes via helpers in `lib/candidate/addressHistoryStage4Wiring` and
  // forwards them through `useRepeatableSectionStage4Wiring`.
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

/**
 * AddressHistorySection — Phase 6 Stage 3 + Stage 4 wiring. See spec docs.
 *
 * Task 8.4 split: aggregated additional fields and aggregated documents now
 * live in RecordSearchSection. Address History is entries-only and posts an
 * entries-only payload (no `aggregatedFields` key) to /save.
 */
export function AddressHistorySection({
  token,
  serviceIds,
  onProgressUpdate,
  onCrossSectionRequirementsChanged,
  onCrossSectionRequirementsRemovedForEntry,
  onCrossSectionRequirementsRemovedForSource,
  onSaveSuccess,
}: AddressHistorySectionProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [countriesError, setCountriesError] = useState(false);
  // Per-entry field-loading state lives in useEntryFieldsLoader.
  // TD-084 — the loader now returns `fieldsByEntry` (flat per-entry keying)
  // because the /fields route OR-merges across services server-side.
  const {
    fieldsByEntry,
    loadFieldsForEntry,
    invalidateEntry,
    clearEntry,
  } = useEntryFieldsLoader(token, serviceIds);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [pendingSave, setPendingSave] = useState(false);

  const debouncedPendingSave = useDebounce(pendingSave, 500);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, serviceIds]);

  useEffect(() => {
    if (debouncedPendingSave) {
      saveEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPendingSave]);

  const loadInitialData = async () => {
    try {
      // Scope (record functionality, Phase 6 Stage 3)
      if (serviceIds.length > 0) {
        const scopeResponse = await fetch(
          `/api/candidate/application/${token}/scope?functionalityType=record`
        );
        if (scopeResponse.ok) {
          const scopeData = await scopeResponse.json();
          setScope(scopeData);
        }
      }

      // Task 8.4: personal-info-fields fetch moved to RecordSearchSection (it
      // is the section that needs the dedup source). Address History no
      // longer renders aggregated fields, so it no longer needs the dedup
      // requirement IDs.

      const countriesResponse = await fetch(`/api/candidate/application/${token}/countries`);
      if (countriesResponse.ok) {
        const countriesData: CountryApiResponse[] = await countriesResponse.json();
        setCountries(countriesData.map((c) => ({ id: c.id, name: c.name })));
        setCountriesError(false);
      } else {
        logger.error('Failed to load countries for address history', {
          event: 'address_history_countries_load_error',
          status: countriesResponse.status
        });
        setCountriesError(true);
      }

      // Saved data — server may return no section; client still shows one entry.
      // Task 8.4: only entries are read here. The legacy aggregatedFields
      // key on address_history is intentionally ignored (plan §11.1).
      const savedDataResponse = await fetch(`/api/candidate/application/${token}/saved-data`);
      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const section = savedData.sections?.address_history;
        const savedEntries: EntryData[] = section?.entries ?? [];

        if (savedEntries.length > 0) {
          setEntries(savedEntries);
          // Pre-load fields for any entry that already has a country
          for (const entry of savedEntries) {
            if (entry.countryId) {
              await loadFieldsForEntry(entry.entryId, entry.countryId, null);
            }
          }
        } else {
          setEntries([createEmptyEntry(0)]);
        }
      } else {
        setEntries([createEmptyEntry(0)]);
      }
    } catch (error) {
      logger.error('Failed to load address history section data', {
        event: 'address_history_section_load_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setEntries([createEmptyEntry(0)]);
    } finally {
      setLoading(false);
    }
  };

  const createEmptyEntry = (order: number): EntryData => ({
    entryId: crypto.randomUUID(),
    countryId: null,
    entryOrder: order,
    fields: []
  });

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry(prev.length)]);
    setPendingSave(true);
  };

  const handleRemoveEntry = (entryId: string) => {
    // Stage 4: clear registry entries for this entry's index BEFORE removal (BR 19).
    const removed = entries.find((e) => e.entryId === entryId);
    if (removed && onCrossSectionRequirementsRemovedForEntry) {
      onCrossSectionRequirementsRemovedForEntry(ADDRESS_HISTORY_CROSS_SECTION_SOURCE, removed.entryOrder);
    }
    // Defensive: never fall below one entry (RepeatableEntryManager also enforces this).
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.entryId !== entryId)));
    clearEntry(entryId);
    setPendingSave(true);
  };

  const handleEntryChange = (entryId: string, data: Partial<EntryData>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.entryId === entryId ? { ...entry, ...data } : entry))
    );
  };

  const handleCountryChange = async (entryId: string, countryId: string) => {
    // Stage 4: drop the entry's prior subject contributions; the wiring hook
    // republishes once new country fields land.
    const target = entries.find((e) => e.entryId === entryId);
    if (target && onCrossSectionRequirementsRemovedForEntry) {
      onCrossSectionRequirementsRemovedForEntry(ADDRESS_HISTORY_CROSS_SECTION_SOURCE, target.entryOrder);
    }
    setEntries((prev) =>
      prev.map((entry) => (entry.entryId === entryId ? { ...entry, countryId, fields: [] } : entry))
    );
    // Wipe the per-entry field cache (not just the request counter) so the next
    // render's wiring hook does not re-publish the previous country's
    // subject-targeted fields under the new countryId before the new load lands.
    clearEntry(entryId);
    if (countryId) {
      // Country-level load first; subregion reload happens via onAddressComplete (DoD #24).
      await loadFieldsForEntry(entryId, countryId, null);
    }
    setPendingSave(true);
  };

  // Subregion-aware reload after the candidate finalizes their geographic pick.
  // Counter bump discards any in-flight earlier load (DoD #25).
  const handleAddressComplete = (entryId: string, countryId: string | null, subregionId: string | null) => {
    if (!countryId) return;
    invalidateEntry(entryId);
    void loadFieldsForEntry(entryId, countryId, subregionId);
  };

  const handleAddressBlockChange = (
    entryId: string,
    requirementId: string,
    nextValue: AddressBlockValue
  ) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.entryId !== entryId) {
          // Spec BR 7: only one entry may have isCurrent. Clear elsewhere when set.
          if (nextValue.isCurrent === true) {
            const updatedFields = entry.fields.map((f) => {
              if (
                typeof f.value === 'object' &&
                f.value !== null &&
                !Array.isArray(f.value) &&
                'isCurrent' in f.value &&
                (f.value as AddressBlockValue).isCurrent === true
              ) {
                return {
                  ...f,
                  value: { ...(f.value as AddressBlockValue), isCurrent: false }
                };
              }
              return f;
            });
            return { ...entry, fields: updatedFields };
          }
          return entry;
        }
        const existingIndex = entry.fields.findIndex((f) => f.requirementId === requirementId);
        const newFields = [...entry.fields];
        const valueRecord = nextValue as RepeatableFieldValue;
        if (existingIndex >= 0) {
          newFields[existingIndex] = { requirementId, value: valueRecord };
        } else {
          newFields.push({ requirementId, value: valueRecord });
        }
        return { ...entry, fields: newFields };
      })
    );
  };

  const handleNonAddressFieldChange = (
    entryId: string,
    requirementId: string,
    value: FieldValue
  ) => {
    const normalized: RepeatableFieldValue =
      value instanceof Date ? value.toISOString() : (value as RepeatableFieldValue);
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.entryId !== entryId) return entry;
        const existingIndex = entry.fields.findIndex((f) => f.requirementId === requirementId);
        const newFields = [...entry.fields];
        if (existingIndex >= 0) {
          newFields[existingIndex] = { requirementId, value: normalized };
        } else {
          newFields.push({ requirementId, value: normalized });
        }
        return { ...entry, fields: newFields };
      })
    );
  };

  const handleFieldBlur = () => {
    setPendingSave(true);
  };

  const saveEntries = async () => {
    setSaveStatus('saving');
    setPendingSave(false);
    try {
      const response = await fetch(`/api/candidate/application/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Task 8.4: payload is entries-only. aggregatedFields are now owned
        // by RecordSearchSection and posted via the separate
        // `sectionType: 'record_search'` save body.
        body: JSON.stringify({
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: entries.map((entry, index) => ({
            ...entry,
            entryOrder: index
          })),
        })
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      setSaveStatus('saved');
      // Phase 7 Stage 1 — re-fetch /validate after the save lands so the
      // shell-rendered SectionErrorBanner reflects the updated scope/gap state.
      onSaveSuccess?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Failed to save address history entries', {
        event: 'address_history_save_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Stage 4 derivations — pure helpers in addressHistoryStage4Wiring own the
  // transforms; memoizing keeps the wiring hook's effect deps stable.
  const entryFieldBuckets = useMemo(
    () => buildEntryFieldsBuckets(entries, fieldsByEntry),
    [entries, fieldsByEntry],
  );
  const fieldsSplit = useMemo(() => splitFieldsByCollectionTab(entryFieldBuckets), [entryFieldBuckets]);
  const subjectRequirements = useMemo(
    () => buildAddressHistorySubjectRequirements(entries, fieldsSplit.subjectFieldsByCountry),
    [entries, fieldsSplit.subjectFieldsByCountry],
  );
  // Task 8.4: aggregated documents and their requirements moved to
  // RecordSearchSection. Address History's progress now reflects entries-
  // only completeness — empty aggregated buckets satisfy the progress
  // helper's "no aggregated docs required here" contract.
  const progressInputs = useMemo(
    () =>
      buildRepeatableProgressInputs({
        entries,
        fieldsByCountry: fieldsSplit.localFieldsByCountry,
        loading,
        aggregatedDocuments: {},
        aggregatedDocumentRequirements: [],
      }),
    [entries, fieldsSplit.localFieldsByCountry, loading],
  );
  useRepeatableSectionStage4Wiring({
    triggeredBy: ADDRESS_HISTORY_CROSS_SECTION_SOURCE,
    subjectRequirements,
    progressInputs,
    onCrossSectionRequirementsChanged,
    onCrossSectionRequirementsRemovedForSource,
    onProgressUpdate,
  });

  // Task 8.4: aggregated-area document upload handlers moved to
  // RecordSearchSection. Address History only handles per_entry document
  // uploads inline within each entry.

  const renderEntry = (entry: EntryData) => {
    // The deduped per-entry field list is already computed by
    // buildEntryFieldsBuckets above; reuse the bucket instead of rebuilding.
    const dedupedFields: DsxField[] =
      entryFieldBuckets.find((b) => b.entryId === entry.entryId)?.fields ?? [];
    const addressBlockField = dedupedFields.find((f) => f.dataType === 'address_block');

    const addressBlockStored = addressBlockField
      ? entry.fields.find((f) => f.requirementId === addressBlockField.requirementId)
      : undefined;
    const addressBlockValue: AddressBlockValue =
      addressBlockStored && typeof addressBlockStored.value === 'object' && addressBlockStored.value !== null && !Array.isArray(addressBlockStored.value)
        ? (addressBlockStored.value as AddressBlockValue)
        : {};

    return (
      <div className="space-y-4">
        <EntryCountrySelector
          value={entry.countryId}
          onChange={(countryId) => handleCountryChange(entry.entryId, countryId)}
          countries={countries}
        />

        {entry.countryId && addressBlockField && (
          <AddressBlockInput
            requirementId={addressBlockField.requirementId}
            addressConfig={(addressBlockField.fieldData as { addressConfig?: AddressConfig | null } | undefined)?.addressConfig ?? null}
            countryId={entry.countryId}
            value={addressBlockValue}
            onChange={(next) =>
              handleAddressBlockChange(entry.entryId, addressBlockField.requirementId, next)
            }
            onBlur={handleFieldBlur}
            isRequired={addressBlockField.isRequired}
            showDates={true}
            token={token}
            onAddressComplete={(subregionId) =>
              handleAddressComplete(entry.entryId, entry.countryId, subregionId)
            }
            // Task 9.2 — pass entry's 1-indexed number so the date inputs
            // pick up contextual aria-labels ("Start date for address N").
            entryNumber={entry.entryOrder + 1}
            entryTypeKey="address"
          />
        )}

        {/* Phase 6 Stage 4 — per_entry-scoped document requirements render
            inline within the entry (BR 11). Aggregated documents (per_search /
            per_order) live in the AggregatedRequirements area below. */}
        {entry.countryId &&
          selectPerEntryDocumentFields(dedupedFields).map((field) => (
            <CandidateDocumentUpload
              key={field.requirementId}
              requirement={{
                id: field.requirementId,
                name: field.name,
                instructions: field.instructions ?? null,
                isRequired: field.isRequired,
                scope: 'per_entry',
              }}
              uploadedDocument={readEntryUploadedDocument(entry.fields, field.requirementId)}
              onUploadComplete={(metadata) => {
                handleNonAddressFieldChange(entry.entryId, field.requirementId, metadata as unknown as FieldValue);
                setPendingSave(true);
              }}
              onRemove={() => {
                handleNonAddressFieldChange(entry.entryId, field.requirementId, null);
                setPendingSave(true);
              }}
              token={token}
              entryIndex={entry.entryOrder}
            />
          ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">{t('candidate.portal.sections.addressHistory')}</h2>
        <div className="text-gray-600">{t('candidate.portal.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('candidate.portal.sections.addressHistory')}</h2>
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
        entryLabelKey="candidate.a11y.addressEntryN"
        minimumEntries={1}
        maxEntries={deriveMaxEntries(scope)}
        // Task 9.2 — section-specific aria-labels so the Add and Remove
        // buttons read "Add another address entry" / "Remove address N"
        // (the e2e suite asserts both wordings).
        addButtonAriaLabelKey="candidate.a11y.addAnotherAddress"
        removeButtonAriaLabelKey="candidate.a11y.removeAddressN"
      />
    </div>
  );
}

/**
 * Derive the maximum allowed entry count from the loaded scope. Count-based
 * scopes cap the entry count: current-address (count_exact, value 1) and
 * last-x-addresses (count_specific, value x). Time-based and "all" scopes
 * have no maximum, so the Add button stays visible.
 */
function deriveMaxEntries(scope: ScopeInfo | null): number | undefined {
  if (!scope) return undefined;
  if (scope.scopeType === 'count_exact' && typeof scope.scopeValue === 'number') {
    return scope.scopeValue;
  }
  if (scope.scopeType === 'count_specific' && typeof scope.scopeValue === 'number') {
    return scope.scopeValue;
  }
  return undefined;
}
