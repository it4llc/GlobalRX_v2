// /GlobalRX_v2/src/lib/candidate/useDynamicStepVisibility.ts
// Portal layout extraction — Hook 1 (VIS). See
// docs/plans/portal-layout-extraction-technical-plan.md §2.1.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { clientLogger as logger } from '@/lib/client-logger';
import {
  buildEntryFieldsBuckets,
  computeAddressHistoryAggregatedItems,
} from '@/lib/candidate/addressHistoryStage4Wiring';
import {
  computeDynamicStepVisibility,
  type StepVisibilityResult,
} from '@/lib/candidate/stepVisibility';

import type { EntryDsxField } from '@/components/candidate/form-engine/useEntryFieldsLoader';
import type { EntryData } from '@/types/candidate-repeatable-form';
import type {
  CandidatePortalSection,
  PersonalInfoField,
} from '@/types/candidate-portal';
import type { CrossSectionRequirementEntry } from '@/types/candidate-stage4';
import type { AggregatedRequirementItem } from '@/types/candidate-address';

interface UseDynamicStepVisibilityInput {
  /** Auth token used in /personal-info-fields and /fields fetches. */
  token: string;
  /** Full structure-endpoint section list. */
  sections: CandidatePortalSection[];
  /** Initial address-history entries from /saved-data, written by the
   *  shell's hydration effect. `null` until hydration completes; the hook
   *  adopts it once on transition from `null` → non-`null`. */
  hydratedAddressHistoryEntries: EntryData[] | null;
  /** Whether /saved-data has settled (drives the loading-guard branch of
   *  `stepVisibility`). */
  savedDataHydrated: boolean;
  /** `subject`-target slice of the cross-section registry (orchestrator-
   *  level memo). Feeds the visibility OR-rule for Personal Info. */
  subjectCrossSectionRequirements: CrossSectionRequirementEntry[];
}

interface UseDynamicStepVisibilityOutput {
  /** /personal-info-fields response, exposed so portal-layout can pass
   *  it to PersonalInfoSection (TD-059 — section does NOT fetch its own). */
  personalInfoFields: PersonalInfoField[];
  /** True once the /personal-info-fields fetch has settled. */
  personalInfoFieldsLoaded: boolean;
  /** True once every entry-with-country has a sentinel in
   *  `fetchedEntryCountryPairs` (or trivially when no such entries exist). */
  addressHistoryFieldsLoaded: boolean;
  /** Final boolean visibility decision for the two dynamic steps. */
  stepVisibility: StepVisibilityResult;
  /** Pre-filter aggregated items. */
  recordSearchAggregatedItems: AggregatedRequirementItem[];
  /** Re-hydrates `addressHistoryEntries` from /saved-data and invalidates
   *  the per-entry fields cache for entries whose country changed. */
  refreshAddressHistoryEntries: () => Promise<void>;
  /** Wraps `refreshValidation()` + `refreshAddressHistoryEntries()` so
   *  AddressHistorySection's `onSaveSuccess` triggers both. */
  handleAddressHistorySaveSuccess: () => void;
  /** Current address-history entries cache. */
  addressHistoryEntries: EntryData[];
}

export function useDynamicStepVisibility(
  input: UseDynamicStepVisibilityInput,
  refreshValidation: () => Promise<void>,
): UseDynamicStepVisibilityOutput {
  const {
    token,
    sections,
    hydratedAddressHistoryEntries,
    savedDataHydrated,
    subjectCrossSectionRequirements,
  } = input;

  // TD-059 — Personal Info field definitions, fetched once at the shell
  // level so the lifted progress effect (in useSectionStatusMerge) can
  // recompute status whenever the cross-section registry changes, even
  // while PersonalInfoSection is unmounted. The section receives this
  // array as a prop instead of fetching /personal-info-fields itself.
  const [personalInfoFields, setPersonalInfoFields] = useState<PersonalInfoField[]>([]);

  // Task 8.5 — gate for the dynamic-step visibility filter. The shell
  // starts with `personalInfoFields=[]` and an empty cross-section
  // registry; before /personal-info-fields has resolved we cannot
  // distinguish "no fields exist" from "we haven't loaded them yet". This
  // flag flips to `true` once the fetch settles (even with an empty
  // response). Until then the visibility memo defaults Personal Info to
  // visible so the sidebar does not flicker through a "skipped" state on
  // first render.
  const [personalInfoFieldsLoaded, setPersonalInfoFieldsLoaded] = useState(false);

  // Task 8.5 — shell-level address-history state used to decide whether
  // Record Search Requirements (Step 8) should be visible. We need to know
  // both the entries the candidate has saved (for entryId/countryId pairs)
  // and the per-entry DSX field definitions (so the aggregated-items
  // computation can run). RecordSearchSection still loads its own copy
  // when mounted — these are a parallel cache used solely for visibility.
  const [addressHistoryEntries, setAddressHistoryEntries] = useState<EntryData[]>([]);
  const [addressHistoryFieldsByEntry, setAddressHistoryFieldsByEntry] = useState<
    Record<string, EntryDsxField[]>
  >({});

  // Task 8.5 (Code Review W1) — sentinel set of `${entryId}::${countryId}`
  // pairs the per-entry /fields effect has already requested, regardless of
  // whether the response was empty. The previous cache check used
  // `fieldsByEntry[id].length > 0`, which meant a country that legitimately
  // produces zero DSX requirements was refetched on every render. This Set
  // records the FETCH itself, so empty responses are remembered too.
  // `refreshAddressHistoryEntries` invalidates the relevant keys when an
  // entry's country changes (or the entry is removed).
  const [fetchedEntryCountryPairs, setFetchedEntryCountryPairs] = useState<Set<string>>(
    () => new Set(),
  );

  // Adoption effect — copy the shell-orchestrator's hydrated entries
  // payload into the hook's state on the null → non-null transition.
  // This replaces the inline `setAddressHistoryEntries(...)` call that
  // used to live inside the shell's saved-data hydration effect.
  useEffect(() => {
    if (hydratedAddressHistoryEntries === null) return;
    setAddressHistoryEntries(hydratedAddressHistoryEntries);
  }, [hydratedAddressHistoryEntries]);

  // TD-059 — One-time fetch of Personal Info field definitions. Owned by the
  // shell so the lifted progress effect below can run computePersonalInfoStatus
  // whenever the cross-section registry changes — independent of which tab
  // is currently mounted. PersonalInfoSection receives this array as a prop
  // and does NOT make its own fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/candidate/application/${encodeURIComponent(token)}/personal-info-fields`,
        );
        if (cancelled) return;
        if (!response.ok) {
          // Task 8.5 — still mark loaded on failure so the visibility
          // filter applies (a failed fetch is treated the same as "no
          // fields" — the conservative skip behavior).
          setPersonalInfoFieldsLoaded(true);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setPersonalInfoFields(data?.fields ?? []);
          setPersonalInfoFieldsLoaded(true);
        }
      } catch (error) {
        logger.error('Failed to load personal info fields in shell', {
          event: 'shell_personal_info_fields_load_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (!cancelled) {
          setPersonalInfoFieldsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Task 8.5 — per-entry DSX field fetch driven by the candidate's saved
  // address-history entries. Lifted from RecordSearchSection so the
  // visibility decision is possible even when that section is unmounted.
  // The cache is keyed by `${entryId}::${countryId}`; once an entry+country
  // pair has been loaded we never refetch unless the entry changes country.
  // Failures are non-fatal — logged via logger.warn and the bucket is left
  // missing, which the visibility helper sees as fewer aggregated items
  // (conservative skip; the candidate can revisit later to retry).
  useEffect(() => {
    let cancelled = false;
    const addressHistorySection = sections.find((s) => s.type === 'address_history');
    if (!addressHistorySection) return;
    const serviceIds = addressHistorySection.serviceIds ?? [];
    if (serviceIds.length === 0) return;
    if (addressHistoryEntries.length === 0) return;

    (async () => {
      const updates: Record<string, EntryDsxField[]> = {};
      const fetchedKeys: string[] = [];
      for (const entry of addressHistoryEntries) {
        if (cancelled) return;
        if (!entry.countryId) continue;
        const cacheKey = `${entry.entryId}::${entry.countryId}`;
        // W1 fix — sentinel set records the fetch attempt itself, so a
        // country that legitimately produces zero DSX fields is NOT
        // refetched on every render. The Set is invalidated by
        // `refreshAddressHistoryEntries` when an entry's country changes.
        if (fetchedEntryCountryPairs.has(cacheKey)) continue;
        try {
          const serviceIdsQuery = serviceIds
            .map((id) => `serviceIds=${encodeURIComponent(id)}`)
            .join('&');
          const url = `/api/candidate/application/${encodeURIComponent(token)}/fields?${serviceIdsQuery}&countryId=${encodeURIComponent(entry.countryId)}`;
          const response = await fetch(url);
          if (!response.ok) {
            logger.warn('Shell-level address-history fields fetch failed', {
              event: 'shell_address_history_fields_load_error',
              cacheKey,
              status: response.status,
            });
            // Mark as fetched even on failure. Re-running the same failing
            // request on every render is wasted I/O; if the underlying
            // cause is transient, the candidate's next save will produce a
            // fresh entries reference and `refreshAddressHistoryEntries`
            // gives the Set a clean slate for the new state.
            fetchedKeys.push(cacheKey);
            continue;
          }
          const data = await response.json();
          const fields: EntryDsxField[] = (data?.fields ?? []) as EntryDsxField[];
          updates[entry.entryId] = fields;
          fetchedKeys.push(cacheKey);
        } catch (error) {
          logger.warn('Shell-level address-history fields fetch threw', {
            event: 'shell_address_history_fields_load_error',
            cacheKey,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          fetchedKeys.push(cacheKey);
        }
      }
      if (cancelled) return;
      if (Object.keys(updates).length > 0) {
        setAddressHistoryFieldsByEntry((prev) => ({ ...prev, ...updates }));
      }
      if (fetchedKeys.length > 0) {
        setFetchedEntryCountryPairs((prev) => {
          const next = new Set(prev);
          for (const key of fetchedKeys) next.add(key);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `fetchedEntryCountryPairs` is read via closure but intentionally NOT
    // in the dep array — adding it would re-run the effect after every
    // successful fetch (which writes the same key it just consumed) and
    // create an infinite loop. The closure captures the latest value at
    // render time, which is sufficient: the only writer is this effect
    // and `refreshAddressHistoryEntries`, and both produce a new
    // `addressHistoryEntries` reference that does re-trigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sections, addressHistoryEntries]);

  // Task 8.5 — shell-level aggregated items derivation. Mirrors the
  // computation inside RecordSearchSection so the shell can decide whether
  // Record Search Requirements (Step 8) should be visible even when the
  // section itself isn't mounted. Address History only loads record-type
  // services per the structure endpoint, so every aggregated field gets
  // the same bucket index (matches the SERVICE_TYPE_ORDER_RECORD constant
  // in RecordSearchSection).
  const recordSearchAggregatedItems = useMemo(() => {
    const buckets = buildEntryFieldsBuckets(
      addressHistoryEntries,
      addressHistoryFieldsByEntry,
    );
    const personalInfoIds = new Set<string>(
      personalInfoFields.map((f) => f.requirementId),
    );
    return computeAddressHistoryAggregatedItems({
      buckets,
      personalInfoRequirementIds: personalInfoIds,
      resolveServiceTypeOrder: () => 1,
    });
  }, [addressHistoryEntries, addressHistoryFieldsByEntry, personalInfoFields]);

  // Task 8.5 (Code Review W2) — second-stage loading gate. After
  // `savedDataHydrated` flips, the shell knows the candidate's address
  // entries but hasn't yet fetched their per-entry DSX fields. During
  // that brief window `recordSearchAggregatedItems` is empty, which the
  // pure helper would interpret as "skip Record Search" — producing a
  // visible flicker in the sidebar. This memo flips to `true` once every
  // entry with a non-null `countryId` has a fetch sentinel in
  // `fetchedEntryCountryPairs` (or trivially when there are no such
  // entries). Until then, the visibility memo below defaults Record
  // Search to visible.
  const addressHistoryFieldsLoaded = useMemo(() => {
    if (!savedDataHydrated) return false;
    const entriesNeedingFields = addressHistoryEntries.filter(
      (e) => !!e.countryId,
    );
    if (entriesNeedingFields.length === 0) return true;
    return entriesNeedingFields.every((e) =>
      fetchedEntryCountryPairs.has(`${e.entryId}::${e.countryId}`),
    );
  }, [savedDataHydrated, addressHistoryEntries, fetchedEntryCountryPairs]);

  // Task 8.5 — dynamic step visibility. OR-merged for Personal Info
  // (either local DSX fields OR cross-section subject requirements keep
  // the step visible — see plan §4.1 and stepVisibility.ts). Single-source
  // for Record Search (aggregated items length).
  //
  // Loading guard: until /personal-info-fields, /saved-data, AND the
  // per-entry /fields fetches have all settled, we cannot tell "no
  // content" from "not yet loaded." During that window both dynamic
  // steps default to visible so the sidebar does not flicker through a
  // "skipped" state on first render. Once the fetches settle the real
  // pure-function rule applies.
  const stepVisibility = useMemo(() => {
    const computed = computeDynamicStepVisibility({
      personalInfoFields,
      subjectCrossSectionRequirements,
      recordSearchAggregatedItems,
    });
    const dataLoaded =
      personalInfoFieldsLoaded &&
      savedDataHydrated &&
      addressHistoryFieldsLoaded;
    if (!dataLoaded) {
      return {
        personalInfoVisible: true,
        recordSearchVisible: true,
      };
    }
    return computed;
  }, [
    personalInfoFields,
    subjectCrossSectionRequirements,
    recordSearchAggregatedItems,
    personalInfoFieldsLoaded,
    savedDataHydrated,
    addressHistoryFieldsLoaded,
  ]);

  // Task 8.5 — mid-session refresh of `addressHistoryEntries`. The initial
  // /saved-data hydration only fires once on mount, so when the candidate
  // adds, removes, or country-changes an Address History entry the shell's
  // copy goes stale and the `recordSearchAggregatedItems` memo decides
  // visibility from out-of-date inputs (Bug: "I add a new address with
  // search-level fields and Step 8 never appears"). We call this from the
  // AddressHistorySection `onSaveSuccess` wrapper below so every save
  // round-trip refreshes the shell state alongside /validate.
  //
  // The function also INVALIDATES the per-entry fields cache for any
  // entry whose country has changed since the previous render (or that
  // disappeared entirely). The per-entry fields effect treats a missing
  // cache entry as "needs to be fetched", so clearing the stale rows
  // forces it to load the correct DSX requirements for the new country.
  const refreshAddressHistoryEntries = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/candidate/application/${encodeURIComponent(token)}/saved-data`,
      );
      if (!response.ok) return;
      const data = await response.json();
      const savedSections = (data?.sections ?? {}) as Record<string, unknown>;
      const bucket = savedSections['address_history'] as
        | { entries?: EntryData[] }
        | undefined
        | null;
      const nextEntries: EntryData[] =
        bucket && Array.isArray(bucket.entries) ? bucket.entries : [];

      setAddressHistoryEntries((prev) => {
        // Detect country changes and removals so the per-entry fields
        // cache (and W1 sentinel set) can be invalidated for those
        // entries. Adds (new entryId) are NOT in `prev` and have no
        // cache row to clear — the per-entry fields effect will fetch
        // them on its own.
        const prevById = new Map(prev.map((e) => [e.entryId, e.countryId]));
        const nextIds = new Set(nextEntries.map((e) => e.entryId));
        const idsToInvalidate: string[] = [];
        const pairsToInvalidate: string[] = [];
        for (const next of nextEntries) {
          const prevCountry = prevById.get(next.entryId);
          if (prevCountry !== undefined && prevCountry !== next.countryId) {
            idsToInvalidate.push(next.entryId);
            if (prevCountry !== null) {
              pairsToInvalidate.push(`${next.entryId}::${prevCountry}`);
            }
          }
        }
        for (const [prevId, prevCountry] of prevById.entries()) {
          if (!nextIds.has(prevId)) {
            idsToInvalidate.push(prevId);
            if (prevCountry !== null) {
              pairsToInvalidate.push(`${prevId}::${prevCountry}`);
            }
          }
        }
        if (idsToInvalidate.length > 0) {
          setAddressHistoryFieldsByEntry((cache) => {
            let changed = false;
            const next = { ...cache };
            for (const id of idsToInvalidate) {
              if (id in next) {
                delete next[id];
                changed = true;
              }
            }
            return changed ? next : cache;
          });
        }
        if (pairsToInvalidate.length > 0) {
          setFetchedEntryCountryPairs((cache) => {
            let changed = false;
            const next = new Set(cache);
            for (const key of pairsToInvalidate) {
              if (next.has(key)) {
                next.delete(key);
                changed = true;
              }
            }
            return changed ? next : cache;
          });
        }
        return nextEntries;
      });
    } catch (error) {
      logger.warn('Failed to refresh address history entries', {
        event: 'shell_address_history_refresh_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [token]);

  // Task 8.5 — wrapper passed as AddressHistorySection's `onSaveSuccess`.
  // Fires both the normal validation refresh and the Task 8.5 saved-data
  // refresh so the shell's `addressHistoryEntries` (and therefore the
  // Record Search visibility decision) stays in sync with the candidate's
  // current entries after every save.
  const handleAddressHistorySaveSuccess = useCallback(() => {
    void refreshValidation();
    void refreshAddressHistoryEntries();
  }, [refreshValidation, refreshAddressHistoryEntries]);

  return {
    personalInfoFields,
    personalInfoFieldsLoaded,
    addressHistoryFieldsLoaded,
    stepVisibility,
    recordSearchAggregatedItems,
    refreshAddressHistoryEntries,
    handleAddressHistorySaveSuccess,
    addressHistoryEntries,
  };
}
