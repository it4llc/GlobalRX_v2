// /GlobalRX_v2/src/components/candidate/form-engine/RecordSearchSection.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';

import { AutoSaveIndicator, SaveStatus } from '@/components/candidate/form-engine/AutoSaveIndicator';
import { AggregatedRequirements } from '@/components/candidate/form-engine/AggregatedRequirements';
import { useEntryFieldsLoader } from '@/components/candidate/form-engine/useEntryFieldsLoader';
import { useDebounce } from '@/hooks/useDebounce';
import { useTranslation } from '@/contexts/TranslationContext';
import { clientLogger as logger } from '@/lib/client-logger';
import {
  buildAggregatedDocumentRequirementsForProgress,
  buildEntryFieldsBuckets,
  computeAddressHistoryAggregatedItems,
  extractAggregatedUploadedDocuments,
  readAggregatedItemScope,
  routeAddressHistoryDocumentScope,
} from '@/lib/candidate/addressHistoryStage4Wiring';
import { computeRecordSearchStatus } from '@/lib/candidate/sectionProgress';

import type {
  EntryData,
  RepeatableFieldValue,
} from '@/types/candidate-repeatable-form';
import type { FieldValue } from '@/types/candidate-portal';
import type { RecordSearchSectionProps } from '@/types/candidate-record-search';
import type { UploadedDocumentMetadata } from '@/types/candidate-stage4';

// Address History only loads record-type services per the structure endpoint,
// so every aggregated field gets the record bucket index (matches the
// pre-split AddressHistorySection constant).
const SERVICE_TYPE_ORDER_RECORD = 1;

/**
 * RecordSearchSection — Task 8.4
 *
 * Standalone Step 7 in the post-Task-8.2 nine-step flow. Renders the
 * deduplicated additional fields and aggregated documents previously shown at
 * the bottom of AddressHistorySection. The section reads address-history
 * entries on mount to know which country DSX fields contribute aggregated
 * items, but never reads `formData.sections.address_history.aggregatedFields`
 * (plan §11.1 — no backward-compatibility reads). Its own state writes to a
 * brand-new save bucket: `formData.sections.record_search.fieldValues`.
 */
export function RecordSearchSection({
  token,
  serviceIds,
  onProgressUpdate,
  onSaveSuccess,
}: RecordSearchSectionProps) {
  const { t } = useTranslation();

  // Address-history entries snapshot — read-only. We need the country list so
  // useEntryFieldsLoader knows which DSX fields to fetch (country-keyed).
  const [entries, setEntries] = useState<EntryData[]>([]);
  // The section's own saved values map, keyed by dsx_requirements.id.
  const [recordSearchFieldValues, setRecordSearchFieldValues] = useState<
    Record<string, RepeatableFieldValue>
  >({});
  // DSX requirement IDs collected on the Personal Info tab. Used to dedupe
  // the aggregated area so PI fields don't reappear here (same dedup source
  // the pre-split AddressHistorySection used).
  const [personalInfoRequirementIds, setPersonalInfoRequirementIds] = useState<Set<string>>(
    new Set(),
  );

  const { fieldsByEntry, loadFieldsForEntry } = useEntryFieldsLoader(token, serviceIds);

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
      void saveSection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPendingSave]);

  const loadInitialData = async () => {
    try {
      // Saved data — entries (read-only snapshot) and the section's own
      // fieldValues. We deliberately ignore any legacy aggregatedFields key
      // on address_history; the new section has no backward-compat read.
      const savedDataResponse = await fetch(`/api/candidate/application/${token}/saved-data`);
      if (savedDataResponse.ok) {
        const savedData = await savedDataResponse.json();
        const addressHistorySection = savedData.sections?.address_history;
        const savedEntries: EntryData[] = addressHistorySection?.entries ?? [];
        setEntries(savedEntries);

        // Pre-load DSX fields for every entry that already has a country —
        // needed so computeAddressHistoryAggregatedItems can derive the
        // aggregated items for this section.
        for (const entry of savedEntries) {
          if (entry.countryId) {
            await loadFieldsForEntry(entry.entryId, entry.countryId, null);
          }
        }

        const recordSearchSection = savedData.sections?.record_search;
        const savedFieldValues: Record<string, RepeatableFieldValue> =
          recordSearchSection?.fieldValues ?? {};
        setRecordSearchFieldValues(savedFieldValues);
      }

      // Personal info requirement IDs — dedupe source for the aggregated
      // area (so PI fields don't reappear here).
      try {
        const piResponse = await fetch(
          `/api/candidate/application/${token}/personal-info-fields`,
        );
        if (piResponse.ok) {
          const piData = await piResponse.json();
          const ids = new Set<string>(
            (piData.fields ?? []).map((f: { requirementId: string }) => f.requirementId),
          );
          setPersonalInfoRequirementIds(ids);
        }
      } catch (error) {
        logger.warn('Failed to load personal-info-fields for record search dedup', {
          event: 'record_search_personal_info_dedup_fetch_failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } catch (error) {
      logger.error('Failed to load record search section data', {
        event: 'record_search_section_load_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSection = async () => {
    setSaveStatus('saving');
    setPendingSave(false);
    try {
      const response = await fetch(`/api/candidate/application/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'record_search',
          sectionId: 'record_search',
          fieldValues: recordSearchFieldValues,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      setSaveStatus('saved');
      onSaveSuccess?.();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logger.error('Failed to save record search section', {
        event: 'record_search_save_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Derive the aggregated items from the loaded DSX fields. Same helpers as
  // the pre-split AddressHistorySection — kept stable.
  const entryFieldBuckets = useMemo(
    () => buildEntryFieldsBuckets(entries, fieldsByEntry),
    [entries, fieldsByEntry],
  );
  const aggregatedItems = useMemo(
    () =>
      computeAddressHistoryAggregatedItems({
        buckets: entryFieldBuckets,
        personalInfoRequirementIds,
        resolveServiceTypeOrder: () => SERVICE_TYPE_ORDER_RECORD,
      }),
    [entryFieldBuckets, personalInfoRequirementIds],
  );
  const aggregatedDocuments = useMemo(
    () => extractAggregatedUploadedDocuments(recordSearchFieldValues),
    [recordSearchFieldValues],
  );
  const aggregatedDocumentRequirements = useMemo(
    () => buildAggregatedDocumentRequirementsForProgress(aggregatedItems),
    [aggregatedItems],
  );

  // Report progress whenever the inputs change. The helper handles the empty
  // case (no required fields and no required docs → complete) which matches
  // the empty-state UI branch below.
  useEffect(() => {
    if (loading) return;
    const status = computeRecordSearchStatus({
      fieldValues: recordSearchFieldValues,
      fieldRequirements: aggregatedItems
        .filter((item) => item.type !== 'document')
        .map((item) => ({
          id: item.requirementId,
          fieldKey: item.requirementId,
          isRequired: item.isRequired,
        })),
      documentRequirements: aggregatedDocumentRequirements,
      uploadedDocuments: aggregatedDocuments,
    });
    onProgressUpdate?.(status);
  }, [
    loading,
    aggregatedItems,
    aggregatedDocumentRequirements,
    aggregatedDocuments,
    recordSearchFieldValues,
    onProgressUpdate,
  ]);

  const handleAggregatedFieldChange = (requirementId: string, value: FieldValue) => {
    const normalized: RepeatableFieldValue =
      value instanceof Date ? value.toISOString() : (value as RepeatableFieldValue);
    setRecordSearchFieldValues((prev) => ({ ...prev, [requirementId]: normalized }));
  };

  const handleAggregatedFieldBlur = () => {
    setPendingSave(true);
  };

  // Document upload routing (per_search / per_order). The composite-key
  // routing is identical to the pre-split AddressHistorySection so the
  // metadata bucket is consistent across the split.
  const routeAggregatedKey = (requirementId: string) =>
    routeAddressHistoryDocumentScope({
      requirementId,
      scope: readAggregatedItemScope(
        aggregatedItems.find((i) => i.requirementId === requirementId),
      ),
      serviceId: serviceIds[0],
    }).key;

  const handleAggregatedDocumentUpload = (
    requirementId: string,
    metadata: UploadedDocumentMetadata,
  ) => {
    const key = routeAggregatedKey(requirementId);
    setRecordSearchFieldValues((prev) => ({
      ...prev,
      [key]: metadata as unknown as RepeatableFieldValue,
    }));
    setPendingSave(true);
  };

  const handleAggregatedDocumentRemove = (requirementId: string) => {
    const key = routeAggregatedKey(requirementId);
    setRecordSearchFieldValues((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPendingSave(true);
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-4">
          {t('candidate.recordSearch.heading')}
        </h2>
        <div className="text-gray-600">{t('candidate.portal.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">{t('candidate.recordSearch.heading')}</h2>
        <AutoSaveIndicator status={saveStatus} />
      </div>

      {aggregatedItems.length === 0 ? (
        <div className="text-gray-600" data-testid="record-search-empty-state">
          {t('candidate.recordSearch.noFieldsRequired')}
        </div>
      ) : (
        <>
          <p className="text-gray-700 mb-4">{t('candidate.recordSearch.intro')}</p>
          <AggregatedRequirements
            items={aggregatedItems}
            values={recordSearchFieldValues}
            onAggregatedFieldChange={handleAggregatedFieldChange}
            onAggregatedFieldBlur={handleAggregatedFieldBlur}
            uploadedDocuments={aggregatedDocuments}
            onDocumentUploadComplete={handleAggregatedDocumentUpload}
            onDocumentRemove={handleAggregatedDocumentRemove}
            token={token}
          />
        </>
      )}
    </div>
  );
}
