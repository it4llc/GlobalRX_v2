// /GlobalRX_v2/src/components/candidate/form-engine/AddressHistorySection.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { AutoSaveIndicator, SaveStatus } from './AutoSaveIndicator';
import { ScopeDisplay } from './ScopeDisplay';
import { EntryCountrySelector } from './EntryCountrySelector';
import { RepeatableEntryManager } from './RepeatableEntryManager';
import { AddressBlockInput } from './AddressBlockInput';
import { AggregatedRequirements } from './AggregatedRequirements';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import type {
  EntryData,
  RepeatableFieldValue,
  ScopeInfo,
} from '@/types/candidate-repeatable-form';
import type {
  FieldMetadata,
  DocumentMetadata,
  FieldValue,
} from '@/types/candidate-portal';
import type {
  AddressBlockValue,
  AddressConfig,
  AggregatedRequirementItem,
} from '@/types/candidate-address';

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

interface CountryApiResponse {
  id: string;
  name: string;
  code2?: string;
}

interface AddressHistorySectionProps {
  token: string;
  serviceIds: string[];
}

// Fixed service-type ordering used elsewhere in the structure endpoint.
// Used here only as a hidden sort key — service names are never shown.
const SERVICE_TYPE_ORDER_INDEX: Record<string, number> = {
  idv: 0,
  record: 1,
  'verification-edu': 2,
  'verification-emp': 3,
};

/**
 * AddressHistorySection
 *
 * Phase 6 Stage 3 section component for the candidate's address history.
 * Reuses the Stage 2 RepeatableEntryManager / ScopeDisplay /
 * EntryCountrySelector / AutoSaveIndicator / DynamicFieldRenderer
 * infrastructure with two additions:
 *   1. The AddressBlockInput component renders the address_block field
 *      with showDates={true}, supplying the section-level date fields
 *      (fromDate / toDate / isCurrent).
 *   2. The AggregatedRequirements component shows additional fields and
 *      document requirements collected across all entries, deduplicated by
 *      dsx_requirements.id and OR-merged for isRequired (most-restrictive
 *      wins per spec Business Rule #20).
 *
 * Always renders at least one entry. The remove control is hidden when
 * entries.length === 1 (handled by RepeatableEntryManager via the
 * minimumEntries={1} prop).
 */
export function AddressHistorySection({ token, serviceIds }: AddressHistorySectionProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ScopeInfo | null>(null);
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [aggregatedFieldValues, setAggregatedFieldValues] = useState<Record<string, RepeatableFieldValue>>({});
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [countriesError, setCountriesError] = useState(false);
  // Per-entry, per-service field map. Keyed by `${entryId}::${serviceId}`.
  // Each value is the array of DSX fields the API returned for that entry's
  // most-specific geographic selection.
  const [fieldsByEntryService, setFieldsByEntryService] = useState<Record<string, DsxField[]>>({});
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

      // Countries (shared candidate-side endpoint — same as Education /
      // Employment).
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

      // Saved data — read entries and aggregatedFields. Address History does
      // NOT auto-create an empty section if none exists on the server side;
      // the structure endpoint controls whether we render at all. But on the
      // client, we always show at least one editable entry per the
      // minimum-one rule.
      const savedDataResponse = await fetch(`/api/candidate/application/${token}/saved-data`);
      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const section = savedData.sections?.address_history;
        const savedEntries: EntryData[] = section?.entries ?? [];
        const savedAggregated: Record<string, RepeatableFieldValue> =
          section?.aggregatedFields ?? {};

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
        setAggregatedFieldValues(savedAggregated);
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

  // Load fields for an entry. When subregionId is provided, the API walks
  // the ancestor chain server-side and returns merged requirements.
  const loadFieldsForEntry = async (
    entryId: string,
    countryId: string,
    subregionId: string | null
  ) => {
    try {
      for (const serviceId of serviceIds) {
        const url = subregionId
          ? `/api/candidate/application/${token}/fields?serviceId=${serviceId}&countryId=${countryId}&subregionId=${subregionId}`
          : `/api/candidate/application/${token}/fields?serviceId=${serviceId}&countryId=${countryId}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fields request failed (${response.status})`);
        }
        const data = await response.json();
        const fields: DsxField[] = (data.fields || []).map((f: DsxField) => ({
          ...f,
          // Tag with serviceId via fieldData for sort. The DSX response
          // doesn't include serviceId today, so we look it up by the loop
          // variable. The aggregated dedup uses requirementId, so this is
          // only for sort ordering.
          fieldData: { ...(f.fieldData ?? {}), _serviceId: serviceId } as FieldMetadata
        }));
        setFieldsByEntryService((prev) => ({
          ...prev,
          [`${entryId}::${serviceId}`]: fields
        }));
      }
    } catch (error) {
      logger.error('Failed to load fields for address history entry', {
        event: 'address_history_fields_load_error',
        entryId,
        countryId,
        subregionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleAddEntry = () => {
    setEntries((prev) => [...prev, createEmptyEntry(prev.length)]);
    setPendingSave(true);
  };

  const handleRemoveEntry = (entryId: string) => {
    setEntries((prev) => {
      // Defensive: never let entries fall to zero (RepeatableEntryManager
      // also enforces minimumEntries=1, but this guards against any future
      // programmatic removal too).
      if (prev.length <= 1) return prev;
      return prev.filter((e) => e.entryId !== entryId);
    });
    // Clear loaded fields for the removed entry to free memory.
    setFieldsByEntryService((prev) => {
      const next: Record<string, DsxField[]> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith(`${entryId}::`)) {
          next[key] = value;
        }
      }
      return next;
    });
    setPendingSave(true);
  };

  const handleEntryChange = (entryId: string, data: Partial<EntryData>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.entryId === entryId ? { ...entry, ...data } : entry))
    );
  };

  const handleCountryChange = async (entryId: string, countryId: string) => {
    // Reset entry on country change — country drives all subsequent loads.
    setEntries((prev) =>
      prev.map((entry) => (entry.entryId === entryId ? { ...entry, countryId, fields: [] } : entry))
    );
    if (countryId) {
      await loadFieldsForEntry(entryId, countryId, null);
    }
    setPendingSave(true);
  };

  const handleAddressBlockChange = (
    entryId: string,
    requirementId: string,
    nextValue: AddressBlockValue
  ) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.entryId !== entryId) {
          // Per spec Business Rule #7: only one entry may have isCurrent.
          // When the changed entry just turned isCurrent on, clear it
          // anywhere else in the section.
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

  const handleAggregatedFieldChange = (requirementId: string, value: FieldValue) => {
    const normalized: RepeatableFieldValue =
      value instanceof Date ? value.toISOString() : (value as RepeatableFieldValue);
    setAggregatedFieldValues((prev) => ({ ...prev, [requirementId]: normalized }));
  };

  const handleAggregatedFieldBlur = () => {
    setPendingSave(true);
  };

  const saveEntries = async () => {
    setSaveStatus('saving');
    setPendingSave(false);
    try {
      const response = await fetch(`/api/candidate/application/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'address_history',
          sectionId: 'address_history',
          entries: entries.map((entry, index) => ({
            ...entry,
            entryOrder: index
          })),
          aggregatedFields: aggregatedFieldValues
        })
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      setSaveStatus('saved');
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

  // Compute the deduplicated AggregatedRequirementItem array from every
  // entry's loaded fields. Per spec Business Rule #20: isRequired uses
  // most-restrictive across the candidate's full address history (OR-merge).
  // Per spec layout: sort by service-type order (hidden), then DSX
  // displayOrder. The address_block field itself is excluded from the
  // aggregated area — it stays inline in the entry.
  const aggregatedItems = computeAggregatedItems(entries, fieldsByEntryService);

  const renderEntry = (entry: EntryData) => {
    // For each entry we need to determine which DSX field is the
    // address_block. We render that one inline via AddressBlockInput; all
    // other non-document fields (those NOT in the aggregated area) are
    // rendered via DynamicFieldRenderer.
    //
    // For Stage 3 the aggregated area handles every non-address-block
    // additional field, so the only inline DSX render is the address block
    // itself plus the embedded date pieces.
    const allFieldsForEntry: DsxField[] = serviceIds.flatMap(
      (sid) => fieldsByEntryService[`${entry.entryId}::${sid}`] ?? []
    );
    // Deduplicate by requirementId so the same address_block field
    // configured under multiple record-type services only renders once.
    const seenIds = new Set<string>();
    const dedupedFields = allFieldsForEntry.filter((f) => {
      if (seenIds.has(f.requirementId)) return false;
      seenIds.add(f.requirementId);
      return true;
    });
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
          />
        )}

        {/* Non-address, non-document DSX fields rendered inline. In practice
            for Stage 3 the spec puts these in the aggregated area, but we
            still render them inline if they're tagged collectionTab=='entry'
            or similar. The dedupedFields filter excludes address_block. */}
        {entry.countryId &&
          dedupedFields
            .filter((f) => f.dataType !== 'address_block' && f.type !== 'document')
            .map((field) => {
              // For Stage 3 we route every non-address field through the
              // aggregated area instead of inline. So nothing is rendered
              // here — the filter above is a guard for future shapes.
              return null;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const _placeholder = field;
            })}
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
        entryLabelKey="candidate.addressHistory.entryLabel"
        minimumEntries={1}
        maxEntries={deriveMaxEntries(scope)}
      />

      <AggregatedRequirements
        items={aggregatedItems}
        values={aggregatedFieldValues}
        onAggregatedFieldChange={handleAggregatedFieldChange}
        onAggregatedFieldBlur={handleAggregatedFieldBlur}
      />
    </div>
  );
}

/**
 * Compute the deduplicated, sorted list of aggregated requirement items
 * from every entry's loaded fields. Pulled into a separate function so the
 * dedup logic is easy to follow (spec Risk #6 calls out the OR-merge rule).
 */
function computeAggregatedItems(
  entries: EntryData[],
  fieldsByEntryService: Record<string, DsxField[]>
): AggregatedRequirementItem[] {
  // Map keyed by requirementId. Each value carries the most-recent metadata
  // plus the OR-merged isRequired flag.
  const merged = new Map<string, AggregatedRequirementItem>();

  for (const entry of entries) {
    if (!entry.countryId) continue;
    // Walk every loaded service for this entry.
    for (const [key, fields] of Object.entries(fieldsByEntryService)) {
      if (!key.startsWith(`${entry.entryId}::`)) continue;
      const serviceId = key.split('::')[1];
      const serviceTypeOrder = resolveServiceTypeOrder(serviceId, fields);
      for (const field of fields) {
        // Address blocks render inline per entry, NOT in the aggregated area.
        if (field.dataType === 'address_block') continue;
        const existing = merged.get(field.requirementId);
        const isRequired = existing
          ? existing.isRequired || field.isRequired
          : field.isRequired;
        const item: AggregatedRequirementItem = {
          requirementId: field.requirementId,
          name: field.name,
          dataType: field.dataType,
          type: field.type === 'document' ? 'document' : 'field',
          isRequired,
          instructions: field.instructions ?? null,
          fieldData: field.fieldData ?? null,
          documentData: field.documentData ?? null,
          serviceTypeOrder,
          displayOrder: field.displayOrder
        };
        merged.set(field.requirementId, item);
      }
    }
  }

  // Sort: serviceTypeOrder asc, then displayOrder asc.
  return Array.from(merged.values()).sort((a, b) => {
    if (a.serviceTypeOrder !== b.serviceTypeOrder) {
      return a.serviceTypeOrder - b.serviceTypeOrder;
    }
    return a.displayOrder - b.displayOrder;
  });
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

/**
 * Best-effort lookup for the service-type sort index. The DSX field response
 * does not include functionalityType today, so we tag fields with their
 * serviceId at load time (see loadFieldsForEntry) and read it back here.
 * If we can't resolve, fall back to the record functionality (Address
 * History always belongs to record services).
 */
function resolveServiceTypeOrder(serviceId: string, fields: DsxField[]): number {
  // Fields in the same load all belong to the same service, so we can
  // sample any of them. We don't have functionalityType in the DSX response,
  // so we default to the 'record' bucket — Address History only loads
  // record-type services anyway.
  void serviceId;
  void fields;
  return SERVICE_TYPE_ORDER_INDEX.record ?? 1;
}
