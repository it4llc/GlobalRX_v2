// /GlobalRX_v2/src/lib/candidate/submission/types.ts
//
// Phase 7 Stage 2 — internal TypeScript shapes shared across the submission
// helpers. Not exported publicly.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §6

// ---------------------------------------------------------------------------
// OrderItemKey — the description of one OrderItem to be created.
//
// `serviceId` + `locationId` are the dedup key. `source` is provenance — used
// to (a) drive OrderData population (which formData section the item came
// from), and (b) surface useful context for future audit comments. Each
// concrete `kind` carries the entry/country information the OrderData
// translator needs to find the right saved fields.
// ---------------------------------------------------------------------------

export type OrderItemSource =
  | { kind: 'address'; addressEntryId: string }
  | { kind: 'education'; entryId: string; countryId: string }
  | { kind: 'employment'; entryId: string; countryId: string }
  | { kind: 'idv'; countryId: string };

export interface OrderItemKey {
  serviceId: string;
  locationId: string;
  source: OrderItemSource;
}

// ---------------------------------------------------------------------------
// JurisdictionResolutionResult — output of the per-address jurisdiction walk.
// `resolvedLocationId === null` means "no DSX availability at any level for
// this service+address" → caller skips emitting an OrderItemKey (Edge 5 of
// the spec; plan §13.3 step 5).
// ---------------------------------------------------------------------------

export interface JurisdictionResolutionResult {
  resolvedLocationId: string | null;
}

// ---------------------------------------------------------------------------
// Scope shape used by selectAddressesInScope. A subset of the validation
// engine's ResolvedScope that the submission code actually consumes — the
// degree-style scopes are not relevant to address-history selection.
// ---------------------------------------------------------------------------

export interface SubmissionAddressScope {
  scopeType: 'count_exact' | 'count_specific' | 'time_based' | 'all';
  scopeValue: number | null;
}

// ---------------------------------------------------------------------------
// Saved-data shapes
//
// These mirror the read-side shapes used by the validation engine
// (validationEngine.ts SavedRepeatableEntry / SavedSectionData), restated
// here so the submission helpers can be unit-tested without dragging the
// engine's types into the test surface.
// ---------------------------------------------------------------------------

export interface SavedField {
  requirementId: string;
  value: unknown;
}

export interface SavedRepeatableEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: SavedField[];
}

export interface SavedAddressHistorySection {
  entries: SavedRepeatableEntry[];
  // Aggregated fields apply to every record-type item produced from
  // address_history (Plan §15.1 — per-section data, not per-entry).
  aggregatedFields?: Record<string, unknown>;
}

export interface SavedEduEmpSection {
  entries: SavedRepeatableEntry[];
}

export interface SavedIdvSection {
  fields: SavedField[];
}

// Minimal shape consumed by buildEduEmpOrderItemKeys. Only the entryId and
// the country are needed to emit per-entry-per-service keys.
export interface EduEmpEntryForKeys {
  entryId: string;
  countryId: string | null;
}
