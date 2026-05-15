// /GlobalRX_v2/src/lib/candidate/addressHistoryStage4Wiring.ts
//
// Phase 6 Stage 4 — pure-helper module specific to AddressHistorySection.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Why this module exists:
//   AddressHistorySection uses a different field-storage shape from
//   Education / Employment. Instead of caching DSX fields by `countryId`, it
//   caches them per-entry via `useEntryFieldsLoader`'s `fieldsByEntry` map
//   (keyed `${entryId}`). The shared wiring helpers in
//   `useRepeatableSectionStage4Wiring.ts` consume a country-keyed map;
//   without an adapter, the section would have to inline ~150 lines of
//   transform logic, pushing it past the 600-LOC hard stop.
//
//   This file owns the adaptation: walk the loaded fields for an entry,
//   dedupe by requirementId (defensively — the route already de-dupes under
//   TD-084), split by `fieldData.collectionTab` into subject-targeted vs
//   local fields, and produce the country-keyed shapes the shared helpers
//   consume. It also owns the document-scope routing helpers (per_entry /
//   per_search / per_order key construction) called by the section's
//   upload-complete / remove handlers per BR 11 + BR 23.
//
// TD-084 — the helper used to walk every service id for an entry and merge
//   fields across services. The route now OR-merges across services in one
//   response, so the helper takes a per-entry map and iterates the entry's
//   single field list instead. The defensive dedup-by-requirementId stays
//   so the helper remains correct if the input ever carries duplicates
//   (e.g., from a future change to the route's response composition).
//
//   Pure: no React hooks, no module-level state. Every helper accepts inputs
//   and returns a transformed value. This is what lets the section file
//   import the helpers, derive shapes once per render, and feed them into
//   `useRepeatableSectionStage4Wiring(...)` at the call site.

import type { EntryDsxField } from '@/components/candidate/form-engine/useEntryFieldsLoader';
import {
  isLockedInvitationFieldKey,
  isPersonalInfoFieldKey,
} from '@/lib/candidate/lockedInvitationFieldKeys';
import type {
  RepeatableWiringEntry,
  RepeatableWiringField,
} from '@/lib/candidate/useRepeatableSectionStage4Wiring';
import type { AggregatedRequirementItem } from '@/types/candidate-address';
import type {
  CrossSectionRequirementEntry,
  UploadedDocumentMetadata,
} from '@/types/candidate-stage4';

/**
 * Stable string identifier for AddressHistory's contributions to the
 * cross-section registry. Used as the `triggeredBy` value on every entry it
 * pushes and as the deletion key on unmount / source clear.
 */
export const ADDRESS_HISTORY_CROSS_SECTION_SOURCE = 'address_history';

/**
 * Default document scope used when `documentData.scope` is missing or null.
 * Per Business Rule 23 the missing case is treated as `per_search`.
 */
export const DEFAULT_DOCUMENT_SCOPE = 'per_search';

/**
 * Literal used as the jurisdiction component of a `per_search` composite key
 * when the candidate has no entry / country context (e.g., the upload comes
 * from the aggregated area before any entry has a country). Documented in the
 * technical plan, Risk #2 ruling.
 */
export const GLOBAL_JURISDICTION_PLACEHOLDER = 'global';

/**
 * One bucket of fields belonging to a single entry, after the fields
 * returned by useEntryFieldsLoader have been deduplicated by requirementId.
 * The buckets carry the entry's `countryId` because the shared wiring
 * helpers key by country, but AddressHistory's source state is keyed by
 * entryId — this struct sits in between.
 */
export interface AddressHistoryEntryFieldsBucket {
  entryId: string;
  countryId: string | null;
  /** Deduped fields for this entry. */
  fields: EntryDsxField[];
}

/**
 * The shape `useRepeatableSectionStage4Wiring`'s helpers expect: fields keyed
 * by `countryId`. AddressHistory's source data is keyed by `entryId`, so we
 * need to adapt before calling those helpers.
 *
 * Why this adaptation matters: the shared
 * `buildSubjectRequirementsForEntries` and `buildRepeatableProgressInputs`
 * helpers loop entries → countries to find the relevant fields. Multiple
 * entries with the same country share the same field set (the DSX
 * requirements don't vary by entry index, only by country/subregion), so a
 * country-keyed shape is the natural input.
 */
export interface AddressHistoryFieldsByCountrySplit {
  /** Local fields (collectionTab !== 'subject') used inside this section. */
  localFieldsByCountry: Record<string, RepeatableWiringField[]>;
  /** Subject-targeted fields (collectionTab === 'subject') for the registry. */
  subjectFieldsByCountry: Record<string, RepeatableWiringField[]>;
}

/**
 * Read the `collectionTab` value from a DSX field's `fieldData` blob. Mirrors
 * the snake_case / camelCase fallback used in EducationSection / EmploymentSection.
 *
 * The `fieldData` shape is loosely typed in the upstream FieldMetadata, so we
 * narrow defensively here rather than at every call site.
 */
export function readCollectionTab(field: EntryDsxField): string {
  const fd = (field.fieldData ?? {}) as Record<string, unknown>;
  const camel = fd.collectionTab;
  const snake = fd.collection_tab;
  if (typeof camel === 'string') return camel;
  if (typeof snake === 'string') return snake;
  return '';
}

/**
 * True when a DSX field is targeted at the Personal Information / subject
 * section per BR 17 (`collectionTab === 'subject'`, case-insensitive substring
 * match to mirror the lenient detection used in Education / Employment).
 *
 * Cross-section-validation-filtering bug fix: a field also counts as
 * subject-targeted when its `fieldKey` lives in `PERSONAL_INFO_FIELD_KEYS`
 * (the same heuristic `personal-info-fields/route.ts` uses to surface PI
 * fields without an explicit `collectionTab`). Address History does not
 * render arbitrary inline fields — only the address_block and per_entry
 * documents — so a PI-fieldKey requirement that the UI cannot show would
 * otherwise be funneled into `localFieldsByCountry` and reported as a
 * missing required field by `computeRepeatableSectionStatus`, keeping the
 * sidebar indicator red even after the candidate filled the field in on
 * Personal Info. See Bug A in
 * docs/specs/cross-section-validation-filtering-bugfix.md.
 */
export function isSubjectTargeted(field: EntryDsxField): boolean {
  if (readCollectionTab(field).toLowerCase().includes('subject')) return true;
  return isPersonalInfoFieldKey(field.fieldKey);
}

/**
 * Address-block fields render inline per entry, not in the aggregated area
 * and never on Personal Information. Excluded from both the subject-target
 * push and the country-keyed bucket.
 */
export function isAddressBlockField(field: EntryDsxField): boolean {
  return field.dataType === 'address_block';
}

/**
 * Read the document scope literal from a field's `documentData`. Returns the
 * string when present and a string, otherwise `null`. The missing-default
 * (BR 23) lives at call sites because the helper's contract is a pure read.
 */
export function readDocumentScope(field: EntryDsxField): string | null {
  const dd = field.documentData as Record<string, unknown> | null | undefined;
  if (!dd) return null;
  const raw = dd.scope;
  if (typeof raw === 'string') return raw;
  return null;
}

/**
 * Build per-entry deduped field buckets from useEntryFieldsLoader's
 * `${entryId}`-keyed map.
 *
 * TD-084 — the helper now takes the flat per-entry map directly. The route's
 * /fields endpoint OR-merges across all package services in one response,
 * so the per-service walk this helper used to perform is no longer needed.
 * The dedup-by-requirementId loop stays as a defensive measure: if the
 * route's response ever contains duplicates (e.g., from a future composition
 * change or a hand-crafted test fixture), the helper still produces a
 * deduped output — first wins.
 *
 * Pure: no hooks, no I/O. Stable order: entries are returned in input order;
 * fields are returned in the order they appeared in `fieldsByEntry[entryId]`.
 */
export function buildEntryFieldsBuckets(
  entries: ReadonlyArray<{ entryId: string; countryId: string | null }>,
  fieldsByEntry: Record<string, EntryDsxField[]>,
): AddressHistoryEntryFieldsBucket[] {
  const buckets: AddressHistoryEntryFieldsBucket[] = [];
  for (const entry of entries) {
    const seen = new Set<string>();
    const fields: EntryDsxField[] = [];
    const list = fieldsByEntry[entry.entryId] ?? [];
    for (const field of list) {
      if (seen.has(field.requirementId)) continue;
      seen.add(field.requirementId);
      fields.push(field);
    }
    buckets.push({
      entryId: entry.entryId,
      countryId: entry.countryId,
      fields,
    });
  }
  return buckets;
}

/**
 * Split the per-entry buckets into the country-keyed shape the shared
 * `useRepeatableSectionStage4Wiring` helpers consume. Subject-targeted fields
 * are routed to `subjectFieldsByCountry` for registry push; everything else
 * (excluding address_block fields, which render inline per entry) lands in
 * `localFieldsByCountry` for progress evaluation.
 *
 * Why we exclude address_block from BOTH maps: the inline AddressBlockInput
 * already drives that field's value via its own onChange path; the progress
 * helper does not need to evaluate it, and it must never appear as a
 * subject-targeted requirement (BR 17 only governs simple fields).
 *
 * Why we collapse by countryId: multiple entries sharing the same country
 * see the same DSX requirement set, and the shared helpers expect a
 * country-keyed map. Entries without a country contribute nothing.
 */
export function splitFieldsByCollectionTab(
  buckets: ReadonlyArray<AddressHistoryEntryFieldsBucket>,
): AddressHistoryFieldsByCountrySplit {
  const localFieldsByCountry: Record<string, RepeatableWiringField[]> = {};
  const subjectFieldsByCountry: Record<string, RepeatableWiringField[]> = {};

  for (const bucket of buckets) {
    if (!bucket.countryId) continue;
    const country = bucket.countryId;
    const localList = (localFieldsByCountry[country] ??= []);
    const subjectList = (subjectFieldsByCountry[country] ??= []);
    const seenLocal = new Set<string>(localList.map((f) => f.requirementId));
    const seenSubject = new Set<string>(subjectList.map((f) => f.requirementId));

    for (const field of bucket.fields) {
      // Address blocks render inline; never participate in cross-section or
      // progress field evaluation here.
      if (isAddressBlockField(field)) continue;
      const wireField: RepeatableWiringField = {
        requirementId: field.requirementId,
        fieldKey: field.fieldKey,
        name: field.name,
        type: field.type,
        isRequired: field.isRequired,
        documentData:
          (field.documentData as Record<string, unknown> | null | undefined) ?? null,
      };
      if (isSubjectTargeted(field)) {
        if (!seenSubject.has(field.requirementId)) {
          subjectList.push(wireField);
          seenSubject.add(field.requirementId);
        }
      } else {
        if (!seenLocal.has(field.requirementId)) {
          localList.push(wireField);
          seenLocal.add(field.requirementId);
        }
      }
    }
  }

  return { localFieldsByCountry, subjectFieldsByCountry };
}

/**
 * Build the registry contribution list for AddressHistory. Mirrors the shape
 * of `buildSubjectRequirementsForEntries` in the shared module but uses the
 * AddressHistory-specific bucket walk so each entry contributes the subject
 * fields tied to its current country.
 *
 * Spec User Flow 3 walks exactly this case: a candidate adds a Country X
 * address; Middle Name is configured as a `subject` requirement on Country X;
 * the registry receives one entry tagged with this address's entryOrder so
 * Personal Information's progress check picks it up.
 */
export function buildAddressHistorySubjectRequirements(
  entries: ReadonlyArray<RepeatableWiringEntry>,
  subjectFieldsByCountry: Record<string, RepeatableWiringField[]>,
  triggeredBy: string = ADDRESS_HISTORY_CROSS_SECTION_SOURCE,
): CrossSectionRequirementEntry[] {
  const out: CrossSectionRequirementEntry[] = [];
  for (const entry of entries) {
    if (!entry.countryId) continue;
    const fields = subjectFieldsByCountry[entry.countryId] ?? [];
    for (const field of fields) {
      // Cross-section-validation-filtering bug fix (Bug B): locked invitation
      // fieldKeys (firstName, lastName, email, phone, phoneNumber) are
      // pre-filled from the invitation columns and not editable by the
      // candidate. They must not reach the cross-section registry — otherwise
      // they appear in the Personal Info "now required" banner and drive
      // asterisks on fields the candidate cannot fill in.
      if (isLockedInvitationFieldKey(field.fieldKey)) continue;
      out.push({
        fieldId: field.requirementId,
        fieldKey: field.fieldKey,
        fieldName: field.name,
        isRequired: field.isRequired,
        triggeredBy,
        triggeredByContext: entry.countryId,
        triggeredByEntryIndex: entry.entryOrder,
      });
    }
  }
  return out;
}

/**
 * Document-scope routing inputs. The section knows which entry context the
 * upload originated from (per_entry uploads always do; aggregated-area
 * uploads typically don't). Optional `serviceId` and `jurisdictionId` cover
 * the per_search composite key — the section supplies the candidate's
 * currently-edited entry's most-specific subregion id (or country id, or the
 * global placeholder) per the technical plan's Risk #2 ruling.
 */
export interface DocumentScopeRouteInput {
  requirementId: string;
  scope: string | null;
  /** Optional — required for per_search composite key. */
  serviceId?: string;
  /** Optional — required for per_search composite key. */
  jurisdictionId?: string;
}

/**
 * Routed result of a document-scope decision. Tells the caller WHICH form-state
 * slot to write to and under WHICH key. Pure: the caller does the actual state
 * write so this helper stays test-friendly.
 */
export type DocumentScopeRouteResult =
  | { kind: 'per_entry'; key: string }
  | { kind: 'per_search'; key: string }
  | { kind: 'per_order'; key: string };

/**
 * Decide where an uploaded-document metadata record should be stored, given
 * the requirement's scope per BR 11 (with BR 23 default of per_search). The
 * caller supplies the serviceId and jurisdictionId for per_search so the
 * composite key is constructed in one place.
 *
 * Per technical plan modification #11.5 + Risk #2 ruling:
 *   - per_entry  -> entry.fields keyed by requirementId
 *   - per_search -> aggregatedFields keyed by `${requirementId}::${serviceId}::${jurisdictionId}`
 *   - per_order  -> aggregatedFields keyed by requirementId
 *   - missing/null scope (BR 23) -> per_search
 */
export function routeAddressHistoryDocumentScope(
  input: DocumentScopeRouteInput,
): DocumentScopeRouteResult {
  const scope = input.scope ?? DEFAULT_DOCUMENT_SCOPE;
  if (scope === 'per_entry') {
    return { kind: 'per_entry', key: input.requirementId };
  }
  if (scope === 'per_order') {
    return { kind: 'per_order', key: input.requirementId };
  }
  // Default + per_search: composite key.
  const serviceId = input.serviceId ?? GLOBAL_JURISDICTION_PLACEHOLDER;
  const jurisdictionId = input.jurisdictionId ?? GLOBAL_JURISDICTION_PLACEHOLDER;
  return {
    kind: 'per_search',
    key: `${input.requirementId}::${serviceId}::${jurisdictionId}`,
  };
}

/**
 * Walk the loaded entry buckets and produce the deduped, sorted
 * AggregatedRequirementItem array consumed by AggregatedRequirements. Mirrors
 * the existing in-section `computeAggregatedItems` function — it lives here
 * (alongside the other AddressHistory-specific transforms) so the section
 * file stays under the 600-LOC hard stop.
 *
 * Dedup rule (spec Business Rule 20): one item per requirementId, with
 * `isRequired` OR-merged across entries (most-restrictive wins). Sort:
 * serviceTypeOrder asc, then displayOrder asc. Address blocks NEVER appear
 * here (they render inline). Personal Info requirement IDs are excluded so
 * fields collected on the Personal Info tab don't reappear. Subject-targeted
 * fields are also excluded — they belong on Personal Information via the
 * cross-section registry, not in this section's local UI (BR 17).
 */
export function computeAddressHistoryAggregatedItems(args: {
  buckets: ReadonlyArray<AddressHistoryEntryFieldsBucket>;
  personalInfoRequirementIds: ReadonlySet<string>;
  /** Sort index for serviceType — caller supplies the lookup. */
  resolveServiceTypeOrder: (field: EntryDsxField) => number;
}): AggregatedRequirementItem[] {
  const { buckets, personalInfoRequirementIds, resolveServiceTypeOrder } = args;
  const merged = new Map<string, AggregatedRequirementItem>();

  for (const bucket of buckets) {
    if (!bucket.countryId) continue;
    for (const field of bucket.fields) {
      // Inline-only fields don't appear in the aggregated area.
      if (isAddressBlockField(field)) continue;
      // Excluded by Personal Info dedup (Stage 3 carry-over).
      if (personalInfoRequirementIds.has(field.requirementId)) continue;
      // Subject-targeted fields go to Personal Information via the registry,
      // not into this section's local aggregated area (Stage 4 BR 17).
      if (isSubjectTargeted(field)) continue;

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
        serviceTypeOrder: resolveServiceTypeOrder(field),
        displayOrder: field.displayOrder,
      };
      merged.set(field.requirementId, item);
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.serviceTypeOrder !== b.serviceTypeOrder) {
      return a.serviceTypeOrder - b.serviceTypeOrder;
    }
    return a.displayOrder - b.displayOrder;
  });
}

/**
 * Extract per-entry uploaded document metadata records out of the entry
 * buckets and the section's saved entries. Used by `buildAddressHistoryProgressInputs`
 * (which forwards to the shared `buildRepeatableProgressInputs`) and by the
 * section's render path to hydrate per_entry document upload UI.
 *
 * The metadata is whatever the entry's `fields[i].value` happens to be when
 * it is a JSON object carrying a `documentId`. The Stage 3 widening already
 * accepts JSON-object values in repeatable saves, so persisting and reading
 * back is symmetric.
 */
export function extractPerEntryUploadedDocuments(
  entries: ReadonlyArray<RepeatableWiringEntry>,
): Record<string, Record<string, UploadedDocumentMetadata>> {
  // outer key: entryId; inner key: requirementId; value: metadata
  const out: Record<string, Record<string, UploadedDocumentMetadata>> = {};
  for (const entry of entries) {
    const inner: Record<string, UploadedDocumentMetadata> = {};
    for (const stored of entry.fields) {
      if (
        stored.value &&
        typeof stored.value === 'object' &&
        !Array.isArray(stored.value) &&
        (stored.value as { documentId?: unknown }).documentId
      ) {
        inner[stored.requirementId] = stored.value as unknown as UploadedDocumentMetadata;
      }
    }
    out[entry.entryId] = inner;
  }
  return out;
}

/**
 * Convert the section's `aggregatedFieldValues` map into the
 * `aggregatedDocuments` shape the shared `buildRepeatableProgressInputs`
 * expects. Filters to entries whose value carries a `documentId` (i.e., looks
 * like an UploadedDocumentMetadata record). The key in the result map is the
 * requirementId — the per_search composite key is collapsed back to the
 * underlying requirementId so the progress helper can match documents to
 * requirements regardless of how they were keyed for storage.
 *
 * Why we strip the composite suffix: the progress helper's contract uses
 * requirementId as the key. The composite key (with serviceId / jurisdictionId)
 * was a storage decision (BR 11) that doesn't propagate to progress checks.
 * If the same requirement has multiple per_search uploads, only one will
 * survive the collapse — that's the intended behavior (a requirement is
 * "satisfied" once any matching upload exists).
 */
export function extractAggregatedUploadedDocuments(
  aggregatedFieldValues: Record<string, unknown>,
): Record<string, UploadedDocumentMetadata> {
  const out: Record<string, UploadedDocumentMetadata> = {};
  for (const [storageKey, value] of Object.entries(aggregatedFieldValues)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as { documentId?: unknown }).documentId
    ) {
      const requirementId = storageKey.split('::')[0];
      out[requirementId] = value as UploadedDocumentMetadata;
    }
  }
  return out;
}

/**
 * Read the `scope` literal off an AggregatedRequirementItem's documentData
 * blob. Returns the string when present and a string, otherwise null. The
 * helper exists to keep AddressHistorySection's upload handlers tiny — they
 * call this + routeAddressHistoryDocumentScope and write to state.
 */
export function readAggregatedItemScope(
  item: { documentData?: Record<string, unknown> | null } | undefined,
): string | null {
  const dd = item?.documentData;
  if (!dd) return null;
  const raw = (dd as { scope?: unknown }).scope;
  return typeof raw === 'string' ? raw : null;
}

/**
 * Build the document-requirement list shaped for `buildRepeatableProgressInputs`'s
 * `aggregatedDocumentRequirements` parameter. Pulled out of AddressHistorySection
 * so the section file stays under the 600-LOC hard stop.
 */
export function buildAggregatedDocumentRequirementsForProgress(
  items: ReadonlyArray<AggregatedRequirementItem>,
): Array<{
  id: string;
  type: string;
  isRequired: boolean;
  documentData: { scope?: string | null } | null;
}> {
  return items
    .filter((i) => i.type === 'document')
    .map((i) => ({
      id: i.requirementId,
      type: 'document',
      isRequired: i.isRequired,
      documentData:
        i.documentData && typeof (i.documentData as { scope?: unknown }).scope !== 'undefined'
          ? { scope: (i.documentData as { scope?: string | null }).scope ?? null }
          : null,
    }));
}

/**
 * Filter a deduped per-entry field list down to the per_entry-scoped document
 * requirements that should render inline within the entry. Aggregated-area
 * documents (per_search / per_order) are excluded — they live in
 * AggregatedRequirements. Non-document fields are excluded too.
 */
export function selectPerEntryDocumentFields<
  F extends { type: string; documentData?: Record<string, unknown> | null },
>(fields: ReadonlyArray<F>): F[] {
  return fields.filter((f) => {
    if (f.type !== 'document') return false;
    const dd = f.documentData;
    if (!dd) return false;
    const scope = (dd as { scope?: unknown }).scope;
    return typeof scope === 'string' && scope === 'per_entry';
  });
}

/**
 * Pull the saved upload metadata for one requirement out of an entry's
 * `fields` array, or null when no document has been uploaded yet. The check
 * walks the JSON-object widening introduced by Stage 3 — values that aren't
 * objects with a `documentId` key are not treated as uploads.
 */
export function readEntryUploadedDocument(
  entryFields: ReadonlyArray<{ requirementId: string; value: unknown }>,
  requirementId: string,
): UploadedDocumentMetadata | null {
  const stored = entryFields.find((f) => f.requirementId === requirementId);
  if (
    stored &&
    stored.value &&
    typeof stored.value === 'object' &&
    !Array.isArray(stored.value) &&
    (stored.value as { documentId?: unknown }).documentId
  ) {
    return stored.value as unknown as UploadedDocumentMetadata;
  }
  return null;
}
