// /GlobalRX_v2/src/lib/candidate/submission/orderDataPopulation.ts
//
// Phase 7 Stage 2 — pure helper that translates per-entry formData into
// OrderData rows. No Prisma access. The DSXRequirement metadata (id, type,
// fieldData.dataType) is read from a Map<requirementId, row> built once by
// the caller.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §15
//
// Coverage:
//   - Spec Rule 11 / Plan §15.1, §15.2:    OrderData row shape — orderItemId,
//                                          fieldName=requirementId,
//                                          fieldValue, fieldType
//   - Spec Rule 11 / Plan §15.1:           per-section iteration shape
//   - Plan §15.2:                          fieldValue stringification —
//                                          string passthrough; everything
//                                          else → JSON.stringify
//   - Plan §15.2:                          fieldType derivation —
//                                          requirement.type==='document'
//                                          → 'document'; else
//                                          fieldData.dataType ?? 'text'
//   - Spec Rule 22 / Plan §15.3:           document references survive as
//                                          JSON-stringified metadata
//   - Spec Rule 12 / Plan §15.4:           Personal Info goes to Order.subject
//                                          (NOT here — see buildOrderSubject.ts)

import type {
  OrderItemSource,
  SavedAddressHistorySection,
  SavedEduEmpSection,
  SavedField,
  SavedIdvSection,
} from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * One OrderData row, as it will be inserted by the submission service.
 * The caller wraps this in a `tx.orderData.createMany({ data: rows })` call.
 */
export interface OrderDataRow {
  orderItemId: string;
  fieldName: string;     // The DSX requirement UUID (Spec Data Reqs line 172).
  fieldValue: string;    // Always a string — non-strings are JSON-stringified.
  fieldType: string;     // Either 'document' or the requirement's dataType.
}

/**
 * Minimal shape of a DSXRequirement row consumed by buildOrderDataRows.
 * Documented as a small interface so callers (and tests) know exactly which
 * columns the helper reads, without coupling to the full Prisma model.
 */
export interface DsxRequirementLookup {
  id: string;
  type: 'field' | 'document';
  fieldData?: { dataType?: string } | null;
}

// IDV uses a synthetic, non-DSX marker requirementId to record which country
// the candidate selected. It must be excluded from OrderData population
// (Plan §15.1) — the locationId on each IDV OrderItem already records the
// country, and idv_country has no DSX requirement row to look up against.
const IDV_COUNTRY_MARKER = 'idv_country';

// ---------------------------------------------------------------------------
// Input shape
// ---------------------------------------------------------------------------

interface BuildOrderDataRowsInput {
  orderItemId: string;
  source: OrderItemSource;
  addressHistorySection?: SavedAddressHistorySection;
  educationSection?: SavedEduEmpSection;
  employmentSection?: SavedEduEmpSection;
  idvSection?: SavedIdvSection;
  dsxRequirementsLookup: Map<string, DsxRequirementLookup>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Translate any saved value to the string we'll store in
 * `OrderData.fieldValue`. Strings are passed through unchanged; objects,
 * arrays, numbers, and booleans are JSON-stringified. `undefined` is
 * filtered upstream (Plan §15.2 — "for each saved field with a non-undefined
 * value").
 */
function valueToFieldValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Derive the `fieldType` column value.
 *
 *   requirement.type === 'document' → 'document'
 *   else                            → requirement.fieldData?.dataType ?? 'text'
 *
 * (Plan §15.2 fieldType clarification.)
 */
function deriveFieldType(
  requirement: DsxRequirementLookup | undefined,
): string {
  if (!requirement) return 'text';
  if (requirement.type === 'document') return 'document';
  const dataType = requirement.fieldData?.dataType;
  return typeof dataType === 'string' && dataType.length > 0
    ? dataType
    : 'text';
}

/**
 * Append one OrderData row per saved field, in input order. Skips fields
 * whose value is `undefined` (Plan §15.2). The fieldType is derived from
 * the lookup; rows with no matching DSXRequirement still get a fallback
 * `'text'` so we never write a NULL `fieldType` (the schema forbids it).
 */
function appendRowsForFields(
  rows: OrderDataRow[],
  orderItemId: string,
  fields: SavedField[],
  lookup: Map<string, DsxRequirementLookup>,
): void {
  for (const field of fields) {
    if (field.value === undefined) continue;
    const requirement = lookup.get(field.requirementId);
    rows.push({
      orderItemId,
      fieldName: field.requirementId,
      fieldValue: valueToFieldValue(field.value),
      fieldType: deriveFieldType(requirement),
    });
  }
}

/**
 * Convert the address-history section's `aggregatedFields` (a flat
 * Record<requirementId, value>) into OrderData rows. These apply to every
 * record-type item produced from address_history (Plan §15.1).
 */
function appendRowsForAggregated(
  rows: OrderDataRow[],
  orderItemId: string,
  aggregatedFields: Record<string, unknown> | undefined,
  lookup: Map<string, DsxRequirementLookup>,
): void {
  if (!aggregatedFields) return;
  for (const [requirementId, value] of Object.entries(aggregatedFields)) {
    if (value === undefined) continue;
    const requirement = lookup.get(requirementId);
    rows.push({
      orderItemId,
      fieldName: requirementId,
      fieldValue: valueToFieldValue(value),
      fieldType: deriveFieldType(requirement),
    });
  }
}

// ---------------------------------------------------------------------------
// buildOrderDataRows — public entry point
// ---------------------------------------------------------------------------

/**
 * Translate one OrderItem's worth of formData into OrderData rows. Driven
 * by the OrderItem's source provenance:
 *
 *   address    — entry.fields + section.aggregatedFields
 *   education  — entry.fields (no aggregated fields for edu/emp)
 *   employment — entry.fields (no aggregated fields for edu/emp)
 *   idv        — section.fields, EXCLUDING the idv_country marker
 *
 * If the matching entry cannot be found (e.g., the source's entryId is no
 * longer present in formData), the helper returns an empty array. The
 * caller is responsible for noticing — but the most likely cause is a
 * stale provenance after a save-route bug, and emitting nothing is safer
 * than crashing the submission transaction.
 */
export function buildOrderDataRows(
  input: BuildOrderDataRowsInput,
): OrderDataRow[] {
  const { orderItemId, source, dsxRequirementsLookup: lookup } = input;
  const rows: OrderDataRow[] = [];

  switch (source.kind) {
    case 'address': {
      const section = input.addressHistorySection;
      if (!section) return [];
      const entry = section.entries.find(
        (e) => e.entryId === source.addressEntryId,
      );
      if (!entry) return []; // Provenance no longer present; safe no-op.
      appendRowsForFields(rows, orderItemId, entry.fields, lookup);
      // Aggregated fields apply to every record-type item produced from
      // address_history (Plan §15.1).
      appendRowsForAggregated(rows, orderItemId, section.aggregatedFields, lookup);
      return rows;
    }
    case 'education': {
      const section = input.educationSection;
      if (!section) return [];
      const entry = section.entries.find((e) => e.entryId === source.entryId);
      if (!entry) return [];
      appendRowsForFields(rows, orderItemId, entry.fields, lookup);
      return rows;
    }
    case 'employment': {
      const section = input.employmentSection;
      if (!section) return [];
      const entry = section.entries.find((e) => e.entryId === source.entryId);
      if (!entry) return [];
      appendRowsForFields(rows, orderItemId, entry.fields, lookup);
      return rows;
    }
    case 'idv': {
      const section = input.idvSection;
      if (!section) return [];
      // Exclude the synthetic idv_country marker — it's not a DSX
      // requirement and would write a row with no matching lookup. The
      // selected country is already recorded on the OrderItem.locationId.
      const dsxFields = section.fields.filter(
        (f) => f.requirementId !== IDV_COUNTRY_MARKER,
      );
      appendRowsForFields(rows, orderItemId, dsxFields, lookup);
      return rows;
    }
    default: {
      // Exhaustiveness guard — the discriminated union has no other
      // members today.
      const exhaustive: never = source;
      void exhaustive;
      return rows;
    }
  }
}
