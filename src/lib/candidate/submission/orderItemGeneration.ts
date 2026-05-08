// /GlobalRX_v2/src/lib/candidate/submission/orderItemGeneration.ts
//
// Phase 7 Stage 2 — pure helpers for translating the candidate's saved form
// data into a list of OrderItem keys (`{ serviceId, locationId, source }`).
//
// This module performs NO Prisma access, NO network calls, and NO filesystem
// access. The resolved DSX-availability index is built by the caller and
// passed in as a Map. The selected scope shape is the same `ResolvedScope`
// emitted by the validation engine's packageScopeShape helper.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §13–§14
//
// Coverage:
//   - Spec Rule 5  / Plan §13.2:    scope filtering
//   - Spec Rule 5  / Plan §13.3:    jurisdiction walk (county → state → country)
//   - Spec Rule 6  / Plan §13.4:    record-key deduplication (first-source-wins)
//   - Spec Rule 7  / Plan §14.1:    edu — per-entry-per-service
//   - Spec Rule 8  / Plan §14.2:    emp — per-entry-per-service
//   - Spec Rule 9  / Plan §14.3:    IDV — one key per service

import type {
  EduEmpEntryForKeys,
  JurisdictionResolutionResult,
  OrderItemKey,
  SavedRepeatableEntry,
  SubmissionAddressScope,
} from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

// ---------------------------------------------------------------------------
// Internal date / address-block parsers
// ---------------------------------------------------------------------------

// Parse an ISO date string into a Date. Returns null for non-strings or
// strings that don't parse to a finite epoch. Identical posture to
// validation/dateExtractors.ts so the two engines agree on what counts as
// "no date here".
function parseDateValue(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
  return false;
}

interface AddressBlockShape {
  fromDate?: unknown;
  toDate?: unknown;
  isCurrent?: unknown;
  // Test-fixture shape: explicit *Id keys. Real data uses `state` / `county`
  // and stores the country at the entry top-level.
  countryId?: unknown;
  stateId?: unknown;
  countyId?: unknown;
  state?: unknown;
  county?: unknown;
}

// Find the address_block field's value within an entry. Returns null when
// the entry does not carry the expected requirement.
function readAddressBlock(
  entry: SavedRepeatableEntry,
  addressBlockRequirementId: string,
): AddressBlockShape | null {
  const field = entry.fields.find(
    (f) => f.requirementId === addressBlockRequirementId,
  );
  if (!field) return null;
  const v = field.value;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as AddressBlockShape;
}

// Pull { start, end, isCurrent } out of an address entry. `end` is null
// while isCurrent === true; the caller decides whether "no end" should be
// treated as "ending today" for overlap purposes.
function extractEntryDates(
  entry: SavedRepeatableEntry,
  addressBlockRequirementId: string,
): { start: Date | null; end: Date | null; isCurrent: boolean } {
  const block = readAddressBlock(entry, addressBlockRequirementId);
  if (!block) return { start: null, end: null, isCurrent: false };

  const isCurrent = parseBooleanValue(block.isCurrent);
  const start = parseDateValue(block.fromDate);
  const end = isCurrent ? null : parseDateValue(block.toDate);
  return { start, end, isCurrent };
}

// Extract the country / state / county identifiers used to walk DSX
// availability. The test fixtures put these inside the address_block value
// as `countryId / stateId / countyId`. Real saved data stores `country` on
// the entry top-level and uses `state` / `county` (UUID or free-text) inside
// the address_block value. We accept both shapes so the same helper works
// for tests and production data.
function readJurisdictionIds(
  entry: SavedRepeatableEntry,
  addressBlockRequirementId: string,
): { countryId: string | null; stateId: string | null; countyId: string | null } {
  const block = readAddressBlock(entry, addressBlockRequirementId);

  // Country: prefer the explicit *Id from the address-block (test fixture
  // shape); fall back to the entry's top-level `countryId` (real data).
  const blockCountryId =
    block && typeof block.countryId === 'string' && block.countryId.length > 0
      ? block.countryId
      : null;
  const countryId = blockCountryId ?? entry.countryId ?? null;

  const stateId =
    block && typeof block.stateId === 'string' && block.stateId.length > 0
      ? block.stateId
      : block && typeof block.state === 'string' && block.state.length > 0
        ? block.state
        : null;

  const countyId =
    block && typeof block.countyId === 'string' && block.countyId.length > 0
      ? block.countyId
      : block && typeof block.county === 'string' && block.county.length > 0
        ? block.county
        : null;

  return { countryId, stateId, countyId };
}

// ---------------------------------------------------------------------------
// selectAddressesInScope — Plan §13.2
// ---------------------------------------------------------------------------

/**
 * Filter a candidate's saved address-history entries down to the subset that
 * is "in scope" for a single record-type service.
 *
 * Sort posture:
 *   - The function sorts entries by start date DESCENDING (most-recent
 *     first) before applying count-based scopes. Current entries (isCurrent
 *     === true OR end date null while start date present) are placed at the
 *     top of the order — they are by definition the most recent.
 *   - When two entries have the same start date, the entry that appears
 *     earlier in the input array wins (first-source-wins; matches the
 *     deduplication posture in Plan §13.4).
 *
 * Scope semantics:
 *   - count_exact (k): take the first k entries after sort.
 *   - count_specific (n): take the first n entries after sort.
 *   - time_based (years): keep entries whose [start, end-or-today] range
 *     overlaps [today − years, today]. Entries with no parseable start
 *     date are excluded — they cannot prove they overlap.
 *   - all: return every input entry untouched.
 */
export function selectAddressesInScope(
  entries: SavedRepeatableEntry[],
  scope: SubmissionAddressScope,
  today: Date,
  addressBlockRequirementId: string,
): SavedRepeatableEntry[] {
  if (entries.length === 0) return [];

  // `all` short-circuits before any sorting — the spec doesn't constrain
  // ordering for `all` and we preserve the caller's input order so the
  // first-source-wins dedup downstream is deterministic.
  if (scope.scopeType === 'all') {
    return entries.slice();
  }

  // Pre-compute dates for each entry once — every scope branch below needs
  // them.
  const withDates = entries.map((entry, originalIndex) => {
    const { start, end, isCurrent } = extractEntryDates(
      entry,
      addressBlockRequirementId,
    );
    return { entry, start, end, isCurrent, originalIndex };
  });

  // Sort by most-recent first. Current entries float to the top. Within
  // the same "tier", later start dates come first; ties broken by original
  // input order (stable sort property of Array.prototype.sort isn't
  // guaranteed across all engines, so we encode the tie-break explicitly).
  const sorted = withDates.slice().sort((a, b) => {
    // Current entries always come first.
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;

    // Both current or both not — compare start dates (later first).
    const aStart = a.start?.getTime() ?? -Infinity;
    const bStart = b.start?.getTime() ?? -Infinity;
    if (aStart !== bStart) return bStart - aStart;

    // Tie — preserve original input order.
    return a.originalIndex - b.originalIndex;
  });

  if (scope.scopeType === 'count_exact' || scope.scopeType === 'count_specific') {
    const count = scope.scopeValue ?? 0;
    return sorted.slice(0, count).map((x) => x.entry);
  }

  if (scope.scopeType === 'time_based') {
    const years = scope.scopeValue ?? 0;
    const windowStart = new Date(
      today.getTime() - years * DAYS_PER_YEAR * MS_PER_DAY,
    );
    // Overlap rule: entry is "in window" if (end or today) >= windowStart.
    // I.e., the entry is not entirely before the window. We require a
    // parseable start to avoid including unbound entries.
    return sorted
      .filter((x) => {
        if (x.start === null) return false;
        // Treat current entries as ending on `today`. (Spec Rule 23 / Plan
        // §13.2 — current address ends "today" for overlap purposes.)
        const effectiveEnd = x.isCurrent
          ? today
          : (x.end ?? today);
        return effectiveEnd.getTime() >= windowStart.getTime();
      })
      .map((x) => x.entry);
  }

  // Defensive: unknown scopeType — return empty rather than the whole list.
  // The validation engine should already have rejected this before we run.
  return [];
}

// ---------------------------------------------------------------------------
// resolveJurisdictionForAddress — Plan §13.3
// ---------------------------------------------------------------------------

/**
 * Walk DSX availability county → state → country for a single
 * (serviceId, address) pair. Returns the resolved locationId at the
 * first level that has availability, or null when no level matches
 * (Edge 5 — service skipped for this address).
 *
 * The availability map's key shape is `${serviceId}:${locationId}` so the
 * caller can do a single bulk query across all (service, location) pairs
 * without index overhead.
 */
export function resolveJurisdictionForAddress(
  serviceId: string,
  address: SavedRepeatableEntry,
  availability: Map<string, true>,
  addressBlockRequirementId: string,
): JurisdictionResolutionResult {
  const { countryId, stateId, countyId } = readJurisdictionIds(
    address,
    addressBlockRequirementId,
  );

  // County wins when present and available. (Plan §13.3 step 2.)
  if (countyId && availability.has(`${serviceId}:${countyId}`)) {
    return { resolvedLocationId: countyId };
  }

  // State next. (Plan §13.3 step 3.)
  if (stateId && availability.has(`${serviceId}:${stateId}`)) {
    return { resolvedLocationId: stateId };
  }

  // Country last. (Plan §13.3 step 4.)
  if (countryId && availability.has(`${serviceId}:${countryId}`)) {
    return { resolvedLocationId: countryId };
  }

  // No level matched — caller skips this (service, address) pair.
  return { resolvedLocationId: null };
}

// ---------------------------------------------------------------------------
// dedupeOrderItemKeys — Plan §13.4 / Spec Rule 6
// ---------------------------------------------------------------------------

/**
 * Collapse OrderItemKeys that share the same (serviceId, locationId).
 *
 * Merge strategy: FIRST-SOURCE-WINS (Plan §13.4). Two addresses that
 * resolve to the same jurisdiction for the same service produce
 * structurally identical order items — the choice of source provenance
 * is arbitrary, but preserving the first occurrence keeps the dedup
 * deterministic and matches the most-recent-first ordering produced by
 * selectAddressesInScope.
 *
 * Note: This dedup is intended for the RECORD subset only. Edu/emp keys
 * are intentionally per-entry-per-service and IDV is one-per-service, so
 * passing those through is a no-op (the (serviceId, locationId) pairs
 * differ by entry or are unique by construction).
 */
export function dedupeOrderItemKeys(keys: OrderItemKey[]): OrderItemKey[] {
  const seen = new Map<string, OrderItemKey>();
  for (const key of keys) {
    const k = `${key.serviceId}:${key.locationId}`;
    if (!seen.has(k)) {
      seen.set(k, key);
    }
    // else: first-source-wins — drop this duplicate.
  }
  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// buildRecordOrderItemKeys — Plan §13 (combined pipeline)
// ---------------------------------------------------------------------------

interface RecordPackageServiceLike {
  serviceId: string;
  scope: SubmissionAddressScope;
}

/**
 * Build the deduplicated list of record-type OrderItemKeys for the entire
 * package. Pipeline:
 *
 *   for each record service:
 *     selectAddressesInScope(addresses, service.scope) → in-scope addresses
 *     for each in-scope address:
 *       resolveJurisdictionForAddress(service, address) → locationId or null
 *       if locationId !== null: emit { serviceId, locationId, source: address }
 *   dedupeOrderItemKeys(all emitted keys)
 *
 * Per Plan §13.4 the dedup is applied to the FULL list across all services.
 * The first-source-wins rule preserves the most-recent address as the
 * surviving provenance because selectAddressesInScope sorts most-recent
 * first.
 */
export function buildRecordOrderItemKeys(
  recordPackageServices: RecordPackageServiceLike[],
  addresses: SavedRepeatableEntry[],
  availability: Map<string, true>,
  today: Date,
  addressBlockRequirementId: string,
): OrderItemKey[] {
  if (recordPackageServices.length === 0 || addresses.length === 0) {
    return [];
  }

  const keys: OrderItemKey[] = [];

  for (const ps of recordPackageServices) {
    const inScope = selectAddressesInScope(
      addresses,
      ps.scope,
      today,
      addressBlockRequirementId,
    );
    for (const address of inScope) {
      const { resolvedLocationId } = resolveJurisdictionForAddress(
        ps.serviceId,
        address,
        availability,
        addressBlockRequirementId,
      );
      if (resolvedLocationId === null) {
        // Edge 5 — service unavailable at every level for this address.
        continue;
      }
      keys.push({
        serviceId: ps.serviceId,
        locationId: resolvedLocationId,
        source: { kind: 'address', addressEntryId: address.entryId },
      });
    }
  }

  return dedupeOrderItemKeys(keys);
}

// ---------------------------------------------------------------------------
// buildEduEmpOrderItemKeys — Plan §14.1 (edu) / §14.2 (emp)
// ---------------------------------------------------------------------------

/**
 * Build OrderItemKeys for verification-edu or verification-emp services.
 *
 * Posture (Spec Rule 7 / 8):
 *   - One key per (entry × service). No deduplication — two education
 *     entries in the same country produce two keys per edu service.
 *     Verifications target schools/employers, not jurisdictions.
 *   - locationId = entry.countryId.
 *   - Safety belt: skip entries with null countryId (Plan §14.1). The
 *     server-side validation engine should have caught this; we drop the
 *     entry rather than crash so a bad row doesn't poison the whole
 *     submission.
 */
export function buildEduEmpOrderItemKeys(
  serviceIds: string[],
  entries: EduEmpEntryForKeys[],
  kind: 'education' | 'employment',
): OrderItemKey[] {
  if (serviceIds.length === 0 || entries.length === 0) return [];

  const keys: OrderItemKey[] = [];
  for (const entry of entries) {
    if (!entry.countryId) {
      // Safety belt — entry has no country. Validation should have flagged
      // this; skip rather than crash.
      continue;
    }
    for (const serviceId of serviceIds) {
      keys.push({
        serviceId,
        locationId: entry.countryId,
        source:
          kind === 'education'
            ? { kind: 'education', entryId: entry.entryId, countryId: entry.countryId }
            : { kind: 'employment', entryId: entry.entryId, countryId: entry.countryId },
      });
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// buildIdvOrderItemKeys — Plan §14.3 / Spec Rule 9
// ---------------------------------------------------------------------------

/**
 * Build OrderItemKeys for IDV services. Exactly one key per IDV service
 * with locationId set to the candidate's selected IDV country.
 *
 * Returns an empty array when the candidate hasn't selected a country —
 * the validation engine's TD-062 fix surfaces this as a "country required"
 * field error before the submit handler ever calls this helper, but the
 * empty-return is a safety belt for transitional state.
 */
export function buildIdvOrderItemKeys(
  serviceIds: string[],
  idvCountryId: string | null,
): OrderItemKey[] {
  if (!idvCountryId) return [];
  if (serviceIds.length === 0) return [];

  return serviceIds.map((serviceId) => ({
    serviceId,
    locationId: idvCountryId,
    source: { kind: 'idv', countryId: idvCountryId },
  }));
}
