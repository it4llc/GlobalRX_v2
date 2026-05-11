// /GlobalRX_v2/src/lib/candidate/validation/repeatableEntryFieldChecks.ts
//
// Phase 7 Stage 3b — TD-069 fix. Owns the per-entry required-field walk for
// the three repeatable sections (Address History, Education, Employment).
//
// Spec:           docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md
// Technical plan: docs/plans/phase7-stage3b-technical-plan.md §1.1, §1.2, §1.3, §2.2.1, §3
//
// Sibling to `personalInfoIdvFieldChecks.ts`. Follows the same TD-077
// structural-re-declaration pattern: every cross-module shape this file
// needs is re-declared here rather than imported from a hypothetical
// shared types module. The PackageServiceWithRequirements alias mirrors
// `personalInfoIdvFieldChecks.ts:85–94` exactly because that file does not
// export it (per Implementation Gate G1, the implementer is forbidden from
// adding an export there in this stage).
//
// What the walk does, in brief (architect's plan §1.2):
//   1. Collect every distinct (serviceId, countryId) pair across the
//      section's entries.
//   2. Issue ONE batched dsx_mappings.findMany via the loader-supplied
//      `findMappings` adapter.
//   3. AND-aggregate the mapping rows into a Map<countryId, Map<reqId, bool>>.
//   4. Walk each entry. Null country → emit `entryCountryRequired`. Otherwise
//      iterate the requirements perReq says are required, and for each one
//      either descend into address_block pieces or apply the scalar empty-
//      check.

import type { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

import type { FieldError } from './types';
import type {
  DsxMappingRow,
  FindDsxMappings,
} from './personalInfoIdvFieldChecks';
import type { SavedRepeatableEntry } from './savedEntryShape';
import type {
  AddressConfig,
  AddressPieceKey,
} from '@/types/candidate-address';

// ---------------------------------------------------------------------------
// RequirementRecord — re-declared structurally per TD-077.
//
// The loader (`loadValidationInputs.ts`) declares the same shape and exports
// it; we re-declare here so this module can be unit-tested without importing
// the loader (which carries a Prisma dependency). The two declarations are
// structurally compatible — TypeScript is structural, so a value typed as
// the loader's `RequirementRecord` flows into a slot typed as ours and vice
// versa.
// ---------------------------------------------------------------------------

export interface RequirementRecord {
  id: string;
  name: string;
  fieldKey: string;
  type: string;
  disabled: boolean;
  fieldData: { dataType?: string; addressConfig?: unknown } | null;
}

// ---------------------------------------------------------------------------
// PackageServiceWithRequirements — structural re-declaration of the same
// alias `personalInfoIdvFieldChecks.ts:85–94` carries module-internally.
// Per Implementation Gate G1, this stage MUST NOT add an `export` keyword
// to that file; the duplication is intentional and tracked as TD-081.
// ---------------------------------------------------------------------------

// Exported so the engine can thread `packageServicesForSection` through
// `ScopedSectionInput` without re-declaring a third structural copy.
export type PackageServiceWithRequirements = Prisma.PackageServiceGetPayload<{
  include: {
    service: {
      include: {
        serviceRequirements: { include: { requirement: true } };
        availability: true;
      };
    };
  };
}>;

// ---------------------------------------------------------------------------
// Module constants
// ---------------------------------------------------------------------------

// Iteration order for the six address pieces. Mirrors
// `src/types/candidate-address.ts:21–27`. Local constant rather than an
// import because the type declaration there is a string-literal union, not
// an array value.
const ADDRESS_PIECE_KEYS: readonly AddressPieceKey[] = [
  'street1',
  'street2',
  'city',
  'state',
  'county',
  'postalCode',
];

// Validator-side mirror of `AddressBlockInput.tsx:30–37`. Applied when a
// requirement's `fieldData.addressConfig` is missing or malformed. Server
// code cannot import the UI component file (Coding Standards: server vs.
// client boundary), so the default is duplicated. Any change to the UI's
// default must be mirrored here. Tracked as TD-080 for future centralization.
const DEFAULT_ADDRESS_CONFIG: AddressConfig = {
  street1: { enabled: true, label: 'Street Address', required: true },
  street2: { enabled: true, label: 'Apt/Suite', required: false },
  city: { enabled: true, label: 'City', required: true },
  state: { enabled: true, label: 'State/Province', required: true },
  county: { enabled: false, label: 'County', required: false },
  postalCode: { enabled: true, label: 'ZIP/Postal Code', required: true },
};

// ---------------------------------------------------------------------------
// Shared input type
// ---------------------------------------------------------------------------

export interface ValidateRepeatableEntriesInput {
  sectionId: string;
  entries: SavedRepeatableEntry[];
  packageServicesForSection: PackageServiceWithRequirements[];
  findMappings: FindDsxMappings;
  requirementById: Map<string, RequirementRecord>;
}

// ---------------------------------------------------------------------------
// Public section entrypoints
//
// All three sections share the same per-entry walk. The exported names exist
// so the engine can read like:
//   await validateAddressHistoryEntries({ ... })
//   await validateEducationEntries({ ... })
//   await validateEmploymentEntries({ ... })
// per the architect's plan §2.3.2 — symmetric with the existing
// `validatePersonalInfoSection` / `validateIdvSection` shape.
// ---------------------------------------------------------------------------

export async function validateAddressHistoryEntries(
  input: ValidateRepeatableEntriesInput,
): Promise<FieldError[]> {
  return walkSection(input);
}

export async function validateEducationEntries(
  input: ValidateRepeatableEntriesInput,
): Promise<FieldError[]> {
  return walkSection(input);
}

export async function validateEmploymentEntries(
  input: ValidateRepeatableEntriesInput,
): Promise<FieldError[]> {
  return walkSection(input);
}

// ---------------------------------------------------------------------------
// walkSection — the shared per-entry walk used by all three section
// validators. Architect's plan §1.2 pseudocode.
// ---------------------------------------------------------------------------

async function walkSection(
  input: ValidateRepeatableEntriesInput,
): Promise<FieldError[]> {
  const { entries, packageServicesForSection, findMappings, requirementById } =
    input;

  const errors: FieldError[] = [];

  // Zero-entries short-circuit: the per-entry walk emits nothing for an
  // empty section. Existing scope/gap logic on the engine side still fires
  // (Spec Rule 7 / DoD 6).
  if (entries.length === 0) {
    return errors;
  }

  // Collect distinct (serviceId, countryId) pairs from this section's
  // entries. Entries with null country contribute nothing here — they're
  // handled by the entryCountryRequired branch below.
  const pairs = collectSectionPairs(packageServicesForSection, entries);

  // ONE batched query per section (architect's plan §1.2). Empty pairs
  // means no entry has a country yet — every entry will either short-
  // circuit on entryCountryRequired (null) or have no perReq map (no rows).
  let rows: DsxMappingRow[] = [];
  if (pairs.length > 0) {
    rows = await findMappings({ requirementIds: [], pairs });
  }

  const perCountryReq = buildPerCountryRequiredMap(rows);

  // Walk each entry.
  for (const entry of entries) {
    if (entry.countryId === null) {
      // Spec Rule 4 — entry without a country is treated as incomplete
      // for required-field purposes. One distinguishing field error and
      // continue (no per-requirement walk possible without a country).
      errors.push({
        fieldName: `Entry ${entry.entryOrder}`,
        messageKey: 'candidate.validation.entryCountryRequired',
        placeholders: { entryOrder: entry.entryOrder },
      });
      continue;
    }

    const perReq = perCountryReq.get(entry.countryId) ?? new Map<string, boolean>();
    const applicable = findApplicableRequirements(
      perReq,
      requirementById,
      packageServicesForSection,
    );

    // Build a quick lookup of saved values for this entry, keyed by
    // requirementId.
    const savedByRequirementId = new Map<string, unknown>();
    for (const f of entry.fields) {
      savedByRequirementId.set(f.requirementId, f.value);
    }

    for (const requirement of applicable) {
      // Skip disabled requirements defensively (the loader does not filter
      // them out — the personal-info collector applies the same defensive
      // skip).
      if (requirement.disabled) continue;

      // Per-requirement isRequired comes from the AND-aggregated map.
      // findApplicableRequirements only returned this requirement because
      // perReq has an entry for it; we still re-check the boolean.
      const isRequired = perReq.get(requirement.id);
      if (isRequired !== true) continue;

      const saved = savedByRequirementId.get(requirement.id);
      const dataType = requirement.fieldData?.dataType ?? '';

      if (dataType === 'address_block') {
        errors.push(
          ...walkAddressBlockPieces(
            requirement,
            saved,
            entry.entryOrder,
            entry.entryId,
          ),
        );
      } else {
        errors.push(...walkScalarRequirement(requirement, saved, entry.entryOrder));
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Collect the distinct (serviceId, locationId) pair list for a section.
 * Cartesian product of the section's package-service IDs (one per service
 * with the right functionalityType) and every distinct non-null entry
 * country in that section. Entries with null countryId are skipped — the
 * per-entry walk handles them via the entryCountryRequired branch.
 */
function collectSectionPairs(
  packageServicesForSection: PackageServiceWithRequirements[],
  entries: SavedRepeatableEntry[],
): Array<{ serviceId: string; locationId: string }> {
  const distinctCountries = new Set<string>();
  for (const e of entries) {
    if (e.countryId !== null) {
      distinctCountries.add(e.countryId);
    }
  }
  if (distinctCountries.size === 0) return [];

  const seen = new Set<string>();
  const pairs: Array<{ serviceId: string; locationId: string }> = [];
  for (const ps of packageServicesForSection) {
    const serviceId = ps.service?.id;
    if (!serviceId) continue;
    for (const locationId of distinctCountries) {
      const key = `${serviceId}:${locationId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ serviceId, locationId });
    }
  }
  return pairs;
}

/**
 * AND-aggregate the mapping rows into Map<countryId, Map<reqId, isRequired>>.
 * Empty groups (no rows for a (country, requirement) combo) are simply
 * absent from the map; callers must treat absence as "not required" (Spec
 * Edge Case 4).
 */
function buildPerCountryRequiredMap(
  rows: DsxMappingRow[],
): Map<string, Map<string, boolean>> {
  // Two-level intermediate: countryId → requirementId → flags[].
  const flagsByCountryReq = new Map<string, Map<string, boolean[]>>();
  for (const row of rows) {
    let perReq = flagsByCountryReq.get(row.locationId);
    if (!perReq) {
      perReq = new Map<string, boolean[]>();
      flagsByCountryReq.set(row.locationId, perReq);
    }
    const flags = perReq.get(row.requirementId) ?? [];
    flags.push(row.isRequired);
    perReq.set(row.requirementId, flags);
  }

  const result = new Map<string, Map<string, boolean>>();
  for (const [countryId, perReq] of flagsByCountryReq.entries()) {
    const aggregated = new Map<string, boolean>();
    for (const [requirementId, flags] of perReq.entries()) {
      // AND semantics matching `personalInfoIdvFieldChecks.aggregateIsRequired`
      // — empty arrays are explicitly false (defensive guard).
      aggregated.set(requirementId, flags.length > 0 && flags.every(Boolean));
    }
    result.set(countryId, aggregated);
  }
  return result;
}

/**
 * For one entry, return the list of requirements applicable to its country.
 * Today this is simply the requirements that perReq has an entry for —
 * `requirementById` is consulted only to look up the requirement record.
 *
 * The architect's plan §1.3 carve-out for service-level address_block
 * requirements is implicitly satisfied by the loader's existing include:
 * service-level address_block requirements appear in `serviceRequirements`
 * and therefore in `requirementById`; their dsx_mappings rows (one per
 * available country at that service) drive perReq, so the carve-out is
 * present whenever the service has at least one mapping at the entry's
 * country.
 */
function findApplicableRequirements(
  perReq: Map<string, boolean>,
  requirementById: Map<string, RequirementRecord>,
  _packageServicesForSection: PackageServiceWithRequirements[],
): RequirementRecord[] {
  const out: RequirementRecord[] = [];
  for (const requirementId of perReq.keys()) {
    const record = requirementById.get(requirementId);
    if (record) out.push(record);
  }
  return out;
}

/**
 * Predicate: true when the saved address_block value is null/undefined or
 * not a non-array object (string, number, array, etc.). Architect's plan
 * §1.3 / Spec Edge Case 6 — when this returns true the walk emits a single
 * error on the address_block requirement and skips the per-piece walk.
 */
function isMalformedAddressBlockValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'object') return true;
  if (Array.isArray(value)) return true;
  return false;
}

/**
 * Walk an address_block requirement for one entry. Emits one field error
 * per (enabled && required && empty) piece. Falls back to
 * DEFAULT_ADDRESS_CONFIG when the requirement's fieldData.addressConfig is
 * missing or not a non-array object.
 */
function walkAddressBlockPieces(
  requirement: RequirementRecord,
  value: unknown,
  entryOrder: number,
  entryId: string,
): FieldError[] {
  const errors: FieldError[] = [];

  if (isMalformedAddressBlockValue(value)) {
    // Architect's plan §1.3 — log once with no PII (no saved values). The
    // candidate sees a single field error on the address_block requirement
    // and the walk does NOT descend into pieces.
    if (value !== undefined && value !== null) {
      logger.warn('Candidate validation: address_block value is malformed', {
        event: 'candidate_validation_address_block_malformed',
        requirementId: requirement.id,
        entryId,
      });
    }
    errors.push({
      fieldName: requirement.name,
      messageKey: 'candidate.validation.fieldRequired',
      placeholders: { entryOrder },
    });
    return errors;
  }

  const cfgRaw = requirement.fieldData?.addressConfig;
  const addressConfig = isUsableAddressConfig(cfgRaw)
    ? (cfgRaw as AddressConfig)
    : DEFAULT_ADDRESS_CONFIG;

  // value is narrowed by isMalformedAddressBlockValue(false) to a non-null
  // non-array object; safe to index by string keys.
  const valueObj = value as Record<string, unknown>;

  for (const piece of ADDRESS_PIECE_KEYS) {
    const cfg = addressConfig[piece];
    if (!cfg || cfg.enabled !== true || cfg.required !== true) continue;
    if (isEmptyValue(valueObj[piece])) {
      errors.push({
        fieldName: `${requirement.name}.${piece}`,
        messageKey: 'candidate.validation.fieldRequired',
        placeholders: { entryOrder, piece },
      });
    }
  }

  return errors;
}

/**
 * Walk a non-address_block scalar requirement for one entry. Emits a single
 * field error when the value is empty.
 */
function walkScalarRequirement(
  requirement: RequirementRecord,
  value: unknown,
  entryOrder: number,
): FieldError[] {
  if (!isEmptyValue(value)) return [];
  return [
    {
      fieldName: requirement.name,
      messageKey: 'candidate.validation.fieldRequired',
      placeholders: { entryOrder },
    },
  ];
}

/**
 * Re-declared verbatim from `personalInfoIdvFieldChecks.ts:424–429` per
 * TD-077. Returns true for undefined, null, empty string, and empty array.
 * Whitespace-only strings are NOT considered empty (the candidate typed
 * something — same rule as the personal-info path).
 */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Defensive predicate: true when a candidate addressConfig blob is at least
 * a non-null non-array object. The validator falls back to
 * DEFAULT_ADDRESS_CONFIG when this returns false. Per-piece shape
 * validation happens inside the walk via the `enabled` / `required`
 * boolean guards.
 */
function isUsableAddressConfig(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  return true;
}
