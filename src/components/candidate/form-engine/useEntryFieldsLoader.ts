// /GlobalRX_v2/src/components/candidate/form-engine/useEntryFieldsLoader.ts

import { useCallback, useRef, useState } from 'react';
import { clientLogger as logger } from '@/lib/client-logger';
import type { FieldMetadata, DocumentMetadata } from '@/types/candidate-portal';

/**
 * The DSX field shape returned by the candidate fields endpoint and consumed
 * by AddressHistorySection. Mirrors the local `DsxField` type defined in
 * AddressHistorySection so the hook is a drop-in replacement for the inline
 * `fieldsByEntry` state it used to own.
 */
export interface EntryDsxField {
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

export interface UseEntryFieldsLoaderResult {
  /**
   * Per-entry field map keyed by `${entryId}`.
   *
   * TD-084 — the keying collapsed from `${entryId}::${serviceId}` to a flat
   * per-entry shape because the `/fields` route now OR-merges across all
   * package services in one response (per plan §3.2.5).
   */
  fieldsByEntry: Record<string, EntryDsxField[]>;
  /**
   * Trigger a fields load for one entry. Issues a single fetch to the
   * package-aware `/fields` route with all `serviceIds` packed as repeated
   * query parameters. Walks the hierarchy server-side when `subregionId` is
   * provided. Only writes the result to state if the entry's request counter
   * has not been bumped while the request was in flight (per spec DoD #25
   * stale-response invalidation).
   */
  loadFieldsForEntry: (
    entryId: string,
    countryId: string,
    subregionId: string | null
  ) => Promise<void>;
  /**
   * Invalidate any in-flight or already-applied fields load for one entry.
   * Bumps the per-entry counter so any request fired earlier is discarded
   * when its response arrives. Called when the candidate changes the entry's
   * country or any subdivision selection (per spec DoD #23).
   */
  invalidateEntry: (entryId: string) => void;
  /**
   * Clear ALL stored fields for one entry. Used when the entry is removed
   * by the candidate. Frees memory and prevents stale data from re-appearing
   * if the entry id is later reused.
   */
  clearEntry: (entryId: string) => void;
}

/**
 * useEntryFieldsLoader
 *
 * Owns the orchestration of "load DSX requirement fields per entry" for the
 * AddressHistorySection. Extracted into its own hook in the Phase 6 Stage 3
 * narrow-rework pass because:
 *   1. AddressHistorySection.tsx was already over the 600-line hard-stop
 *      threshold (Coding Standards Section 9, Implementer Rule 10) and
 *      Critical #1 needed to add stale-response invalidation logic.
 *   2. The fetch + counter-based invalidation pattern is self-contained and
 *      reads cleanly as its own hook.
 *
 * Behavior contract (post-TD-084):
 *   - `loadFieldsForEntry(entryId, countryId, subregionId)` issues a SINGLE
 *     `/api/candidate/application/{token}/fields` request packing every
 *     package service id into repeated `serviceIds` query params. The route
 *     OR-merges across services so the per-service de-dup the hook used to
 *     perform is no longer needed at this layer. The hook captures the
 *     entry's request counter at fire time; if that counter is bumped
 *     before the response arrives (e.g., the candidate changes the country
 *     or selects a different subregion), the response is discarded.
 *   - `invalidateEntry(entryId)` bumps the counter. Any in-flight requests
 *     for that entry will be discarded on arrival. The currently-stored
 *     fields are NOT cleared automatically — the caller decides whether to
 *     also clear (typically yes on country change, no on subdivision change
 *     where the next load will overwrite).
 *   - `clearEntry(entryId)` removes every stored entry-keyed value. Used
 *     when the entry is removed from the section.
 *
 * The hook is parameterized by `token` and `serviceIds`. `subregionId`
 * is the most-specific UUID-shaped subregion the candidate has selected
 * (city > county > state > null). Free-text values (when no subdivisions
 * exist for the level) are passed as null so the API falls back to
 * country-level requirements only.
 */
export function useEntryFieldsLoader(
  token: string,
  serviceIds: string[]
): UseEntryFieldsLoaderResult {
  const [fieldsByEntry, setFieldsByEntry] = useState<
    Record<string, EntryDsxField[]>
  >({});

  // Per-entry request counter. Each entry starts at 0 (implicit). Each call
  // to `invalidateEntry` increments it by one; each call to `loadFieldsForEntry`
  // captures the current value and validates against it on response arrival.
  const requestCounters = useRef<Map<string, number>>(new Map());

  const getCounter = (entryId: string): number =>
    requestCounters.current.get(entryId) ?? 0;

  const invalidateEntry = useCallback((entryId: string): void => {
    requestCounters.current.set(entryId, getCounter(entryId) + 1);
  }, []);

  const clearEntry = useCallback((entryId: string): void => {
    setFieldsByEntry((prev) => {
      // TD-084 — the keying is flat per-entry now, so a single-key delete
      // suffices (previously the keys included `::${serviceId}` and we
      // walked every key in the map).
      if (!(entryId in prev)) return prev;
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    // Bump the counter too so any in-flight loads for the removed entry
    // are discarded when they return.
    invalidateEntry(entryId);
  }, [invalidateEntry]);

  const loadFieldsForEntry = useCallback(
    async (entryId: string, countryId: string, subregionId: string | null): Promise<void> => {
      // Capture the counter at fire time. If the counter changes before the
      // response arrives, that response is discarded (DoD #25).
      const fireCounter = getCounter(entryId);

      // Defensive: if the section has no package services configured for
      // this entry, there's nothing to fetch. Write an empty list so the
      // downstream components can render a "no fields" state without
      // racing a no-op fetch.
      if (serviceIds.length === 0) {
        setFieldsByEntry((prev) => ({ ...prev, [entryId]: [] }));
        return;
      }

      try {
        // TD-084 — single fetch per entry. The package-aware /fields route
        // OR-merges across all services and (when subregionId is provided)
        // across every geographic level.
        const serviceIdsQuery = serviceIds
          .map((id) => `serviceIds=${encodeURIComponent(id)}`)
          .join('&');
        const url = subregionId
          ? `/api/candidate/application/${token}/fields?${serviceIdsQuery}&countryId=${countryId}&subregionId=${subregionId}`
          : `/api/candidate/application/${token}/fields?${serviceIdsQuery}&countryId=${countryId}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Fields request failed (${response.status})`);
        }
        const data = await response.json();
        // Discard responses fired before the latest invalidation.
        if (getCounter(entryId) !== fireCounter) {
          return;
        }
        const fields: EntryDsxField[] = (data.fields || []) as EntryDsxField[];
        setFieldsByEntry((prev) => ({
          ...prev,
          [entryId]: fields,
        }));
      } catch (error) {
        // Swallow only after the counter check — if the candidate has moved
        // on, the failed request is irrelevant and should not be logged as
        // a real error.
        if (getCounter(entryId) !== fireCounter) {
          return;
        }
        logger.error('Failed to load fields for address history entry', {
          event: 'address_history_fields_load_error',
          entryId,
          countryId,
          subregionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [token, serviceIds]
  );

  return {
    fieldsByEntry,
    loadFieldsForEntry,
    invalidateEntry,
    clearEntry,
  };
}
