// /GlobalRX_v2/src/lib/candidate/sectionProgress.ts
//
// Pure-function library for computing per-section progress. Outputs one of
// the three lowercase status values: `not_started`, `incomplete`, `complete`.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 6:   Workflow section is complete only when acknowledged (when
//             isRequired = true). When isRequired = false, always complete.
//   - BR 14:  Three states only: not_started / incomplete / complete.
//   - BR 16:  Repeatable section progress checks only required fields and
//             documents within the entries the candidate has already created.
//             No scope coverage / gap detection.
//   - BR 18:  Personal Info evaluates both local fields and registry entries
//             posted under `subject`.
//   - BR 22:  All status values lowercase strings.
//   - BR 23:  null/missing documentData.scope treated as `per_search`.
//
// All functions are pure: input is plain typed data, output is a typed status
// string. No I/O, no DOM, no time-dependent logic.

import type {
  CrossSectionRequirementEntry,
  SectionStatus,
  UploadedDocumentMetadata,
} from '@/types/candidate-stage4';

// ---------------------------------------------------------------------------
// Local input types
// ---------------------------------------------------------------------------

/** Minimal field shape used by the helpers. */
interface FieldLike {
  id: string;
  fieldKey: string;
  isRequired: boolean;
  type?: string;
}

/** Minimal workflow-section shape used by computeWorkflowSectionStatus. */
interface WorkflowSectionLike {
  id: string;
  isRequired: boolean;
}

/** Minimal saved-acknowledgment shape (per BR 8). */
interface SavedAcknowledgmentLike {
  acknowledged?: boolean;
}

/** Minimal document-requirement shape used by repeatable-section helpers.
 *  `type` is intentionally typed as `string` rather than the literal
 *  `'document'` so callers (e.g., the section components and the Pass 1
 *  tests) can pass plain object literals without `as const` ceremony. The
 *  helpers do not branch on `type` — the requirement is already known to
 *  be a document by virtue of being in the document collection. */
interface DocumentRequirementLike {
  id: string;
  type: string;
  isRequired: boolean;
  documentData?: { scope?: string | null } | null;
}

/** A repeatable entry — `entryOrder` plus its per-entry field values. */
interface RepeatableEntryLike {
  entryOrder: number;
  fields: Record<string, unknown>;
}

/** Inputs to computeRepeatableSectionStatus. Keys are `entryOrder` numbers. */
interface RepeatableSectionProgressInput {
  entries: RepeatableEntryLike[];
  requiredFieldsByEntry: Record<number, FieldLike[]>;
  requiredDocumentsByEntry: Record<number, DocumentRequirementLike[]>;
  uploadedDocumentsByEntry: Record<
    number,
    Record<string, UploadedDocumentMetadata | undefined>
  >;
  /**
   * Aggregated documents (per_search/per_order) keyed by either a composite
   * `${requirementId}::${serviceId}::${jurisdictionId}` (per_search) or by
   * the requirement UUID directly (per_order). Per BR 23 a null/missing
   * scope falls back to per_search.
   */
  aggregatedDocuments: Record<string, UploadedDocumentMetadata | undefined>;
  /** All aggregated-area document requirements that must be present. */
  aggregatedDocumentRequirements: DocumentRequirementLike[];
}

// ---------------------------------------------------------------------------
// computeWorkflowSectionStatus (BR 6)
// ---------------------------------------------------------------------------

/**
 * Workflow sections only have two meaningful states because the candidate has
 * exactly one decision to make (tick or don't tick the acknowledgment). We
 * therefore return only `not_started` (no acknowledgment yet, when required)
 * or `complete` (acknowledged, or not required at all). The `incomplete`
 * middle state never applies to workflow sections — there is no "started but
 * not finished" intermediate state for a single checkbox.
 */
export function computeWorkflowSectionStatus(
  workflowSection: WorkflowSectionLike,
  savedAcknowledgment: SavedAcknowledgmentLike | undefined,
): SectionStatus {
  // Not required → always complete (BR 6).
  if (!workflowSection.isRequired) {
    return 'complete';
  }

  // Required and acknowledged → complete.
  if (savedAcknowledgment?.acknowledged === true) {
    return 'complete';
  }

  // Required but no acknowledgment recorded yet → not_started.
  return 'not_started';
}

// ---------------------------------------------------------------------------
// computePersonalInfoStatus (BR 18)
// ---------------------------------------------------------------------------

/**
 * Compute Personal Info progress. Required fields include both the local DSX
 * fields rendered on the section AND any cross-section requirements posted
 * to it under the `subject` target.
 *
 * Returns:
 *   - `not_started` when no required field has any value at all.
 *   - `complete`    when every required field (local + cross-section) has a
 *                   non-empty value.
 *   - `incomplete`  otherwise (some values present, some required ones empty).
 */
export function computePersonalInfoStatus(
  fields: FieldLike[],
  values: Record<string, unknown>,
  crossSectionRequirements: CrossSectionRequirementEntry[],
): SectionStatus {
  // Build the union of required keys: local required fields + cross-section
  // required entries. Both contribute to whether the section is complete.
  const requiredKeys = new Set<string>();

  for (const field of fields) {
    if (field.isRequired) {
      requiredKeys.add(field.fieldKey);
    }
  }
  for (const cs of crossSectionRequirements) {
    if (cs.isRequired) {
      requiredKeys.add(cs.fieldKey);
    }
  }

  // No required fields at all → trivially complete.
  if (requiredKeys.size === 0) {
    return 'complete';
  }

  let filledCount = 0;
  for (const key of requiredKeys) {
    if (hasValue(values[key])) {
      filledCount += 1;
    }
  }

  if (filledCount === 0) {
    return 'not_started';
  }
  if (filledCount === requiredKeys.size) {
    return 'complete';
  }
  return 'incomplete';
}

// ---------------------------------------------------------------------------
// computeIdvStatus
// ---------------------------------------------------------------------------

/**
 * Compute IDV progress. Same shape as Personal Info but without
 * cross-section requirements (IDV is not a cross-section target in Stage 4
 * per BR 17).
 */
export function computeIdvStatus(
  fields: FieldLike[],
  values: Record<string, unknown>,
): SectionStatus {
  return computePersonalInfoStatus(fields, values, []);
}

// ---------------------------------------------------------------------------
// computeRepeatableSectionStatus (BR 16, BR 23)
// ---------------------------------------------------------------------------

/**
 * Compute progress for repeatable sections (Address History, Education,
 * Employment).
 *
 * Per BR 16, this only checks required fields and required documents WITHIN
 * the entries the candidate has already created plus required aggregated
 * documents that span the section. Stage 4 deliberately does NOT perform
 * scope coverage checks (e.g., "do entries cover 7 years?") or gap detection
 * — both are deferred to Phase 7.
 *
 * Returns:
 *   - `not_started` when there are zero entries.
 *   - `complete`    when every required field in every entry has a value AND
 *                   every required per-entry document has metadata AND every
 *                   required aggregated-area document has metadata.
 *   - `incomplete`  otherwise.
 */
export function computeRepeatableSectionStatus(
  input: RepeatableSectionProgressInput,
): SectionStatus {
  // No entries at all → not started.
  if (input.entries.length === 0) {
    return 'not_started';
  }

  for (const entry of input.entries) {
    const requiredFields = input.requiredFieldsByEntry[entry.entryOrder] ?? [];
    for (const field of requiredFields) {
      if (!field.isRequired) continue;
      if (!hasValue(entry.fields[field.fieldKey])) {
        return 'incomplete';
      }
    }

    const requiredDocs =
      input.requiredDocumentsByEntry[entry.entryOrder] ?? [];
    const uploadedForEntry =
      input.uploadedDocumentsByEntry[entry.entryOrder] ?? {};
    for (const doc of requiredDocs) {
      if (!doc.isRequired) continue;
      if (!uploadedForEntry[doc.id]) {
        return 'incomplete';
      }
    }
  }

  // Aggregated-area required documents (per_search / per_order, plus the
  // null/missing-scope BR 23 default of per_search).
  for (const doc of input.aggregatedDocumentRequirements) {
    if (!doc.isRequired) continue;
    if (!hasAggregatedDocument(doc, input.aggregatedDocuments)) {
      return 'incomplete';
    }
  }

  return 'complete';
}

// ---------------------------------------------------------------------------
// computeRecordSearchStatus (Task 8.4)
// ---------------------------------------------------------------------------

/** Inputs to computeRecordSearchStatus. */
interface RecordSearchProgressInput {
  fieldValues: Record<string, unknown>;
  fieldRequirements: FieldLike[];
  documentRequirements: DocumentRequirementLike[];
  uploadedDocuments: Record<string, UploadedDocumentMetadata | undefined>;
}

/**
 * Compute progress for the Record Search Requirements section (Task 8.4).
 *
 * Rules (mirrors Personal Info logic adapted for the record-search context):
 *   - No required fields AND no required documents → `complete` (the
 *     section's empty-state branch renders the "no fields required" message
 *     and immediately reports `complete`).
 *   - When some required items are satisfied and others are not →
 *     `incomplete`.
 *   - When nothing is satisfied AND nothing has been typed → `not_started`.
 *   - When all required fields have values AND all required documents have
 *     uploaded metadata → `complete`.
 *
 * Field requirements use `id` (the DSXRequirement UUID) as the key into
 * `fieldValues`. Document requirements use the same `hasAggregatedDocument`
 * helper that the repeatable-section progress function uses, so per_search
 * and per_order documents are matched consistently.
 */
export function computeRecordSearchStatus(
  input: RecordSearchProgressInput,
): SectionStatus {
  const requiredFieldIds: string[] = [];
  for (const field of input.fieldRequirements) {
    if (field.isRequired) {
      requiredFieldIds.push(field.id);
    }
  }
  const requiredDocs = input.documentRequirements.filter((d) => d.isRequired);

  // Empty-state: nothing required at all.
  if (requiredFieldIds.length === 0 && requiredDocs.length === 0) {
    return 'complete';
  }

  let satisfied = 0;
  const total = requiredFieldIds.length + requiredDocs.length;

  for (const id of requiredFieldIds) {
    if (hasValue(input.fieldValues[id])) {
      satisfied += 1;
    }
  }
  for (const doc of requiredDocs) {
    if (hasAggregatedDocument(doc, input.uploadedDocuments)) {
      satisfied += 1;
    }
  }

  // Detect "typed but not in required set" so a typed value (e.g., into an
  // optional field) still moves the section past `not_started`.
  const hasAnyTypedValue = Object.values(input.fieldValues).some(hasValue);

  if (satisfied === total) {
    return 'complete';
  }
  if (satisfied === 0 && !hasAnyTypedValue) {
    return 'not_started';
  }
  return 'incomplete';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A value is "present" when it is not null/undefined and not an empty string
 * after trimming. Booleans, numbers, arrays, and objects all count as
 * present. The empty-string treatment matches what the candidate experiences
 * — typing then clearing a field should restore the not_started semantics.
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Check whether the aggregated documents bucket holds metadata satisfying
 * the given requirement. The lookup strategy depends on the requirement's
 * `documentData.scope`:
 *   - `per_order` → keyed directly by `requirementId`.
 *   - `per_search` (or null/missing per BR 23) → keyed by a composite
 *     `${requirementId}::...`. Because the helper does not know the service
 *     or jurisdiction context here, it accepts ANY key in the bucket whose
 *     prefix is `${requirementId}::` as evidence the requirement has been
 *     satisfied at least once.
 *   - `per_entry` → does not belong in the aggregated bucket; the helper
 *     returns false. (per_entry documents are checked in the entries loop
 *     above.)
 */
function hasAggregatedDocument(
  doc: DocumentRequirementLike,
  aggregated: Record<string, UploadedDocumentMetadata | undefined>,
): boolean {
  const rawScope = doc.documentData?.scope ?? null;
  // BR 23: null/missing scope is treated as per_search.
  const scope = rawScope ?? 'per_search';

  if (scope === 'per_order') {
    return Boolean(aggregated[doc.id]);
  }

  if (scope === 'per_search') {
    // A composite key starts with `${requirementId}::`. The helper accepts
    // any matching key as evidence the document has been uploaded for at
    // least one (service, jurisdiction) combination — Phase 7 will refine
    // this to per-(service, jurisdiction) coverage.
    const prefix = `${doc.id}::`;
    for (const key of Object.keys(aggregated)) {
      if (key === doc.id || key.startsWith(prefix)) {
        if (aggregated[key]) {
          return true;
        }
      }
    }
    return false;
  }

  // per_entry documents should not appear in the aggregated bucket — they
  // belong in the entry's `fields` array. Treat as not satisfied here so the
  // entries loop above is the source of truth.
  return false;
}
