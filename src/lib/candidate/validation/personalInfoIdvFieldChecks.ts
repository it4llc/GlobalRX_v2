// /GlobalRX_v2/src/lib/candidate/validation/personalInfoIdvFieldChecks.ts
//
// Phase 7 Stage 2 — TD-062 fix. Sibling helper module for validationEngine.ts
// that owns the Personal Info / IDV field-requirement collection and
// "required field has a value" checking. Pulled into its own file so the
// engine itself stays minimally edited and below its file-size soft trigger.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
//                 (Rule 3, TD-062)
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md
//                 §3.1 (Andy's Option 1 — sibling-file path), §10
//
// What lives here:
//   - collectPersonalInfoFieldRequirements: walk the package's serviceRequirements,
//     filter to personal-info collectionTab, AND-aggregate isRequired across
//     applicable (serviceId, locationId) mapping rows.
//   - collectIdvFieldRequirements: same idea but scoped to IDV-functionality
//     services and a single selected country.
//   - checkRequiredFields: emit a FieldError for every required requirement
//     whose saved value is missing/empty.
//   - validatePersonalInfoSection / validateIdvSection: the section-level
//     replacements that the engine calls in place of the old
//     validateNonScopedSection invocations.
//
// What does NOT live here:
//   - Status derivation. The validators delegate to the existing
//     deriveStatusWithErrors helper, which the engine still owns. Re-defining
//     it would cause a divergence the next time the engine's status semantics
//     change. To avoid that, the engine passes a status-derivation callback
//     into the section validators.
//
// Rule 1 — every status string is lowercase (project standard).

import type { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

import type {
  FieldError,
  SectionValidationResult,
  ValidationStatus,
} from './types';

// ---------------------------------------------------------------------------
// Saved-data shapes (mirrors the engine's internal SavedSectionData)
// ---------------------------------------------------------------------------

interface SavedField {
  requirementId: string;
  value: unknown;
}

interface SavedRepeatableEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: SavedField[];
}

// Mirror the engine's internal SavedSectionData EXACTLY (same set of keys,
// same optionality). Sharing the shape by structure rather than via a
// re-export keeps this helper unit-testable without dragging the engine's
// imports into the test surface, but the structural match means the engine
// can pass its `SavedSectionData` to our helpers without a TS2719
// compatibility error.
interface SavedSectionData {
  type?: string;
  fields?: SavedField[];
  entries?: SavedRepeatableEntry[];
  aggregatedFields?: Record<string, unknown>;
}

interface SectionVisitRecord {
  visitedAt: string;
  departedAt: string | null;
}

// ---------------------------------------------------------------------------
// Package-services Prisma payload shape
//
// We type this loosely against the Prisma payload helpers so the helper
// module compiles whether the engine's findUnique passes a richer or
// narrower include set. The fields actually read are documented inline.
// ---------------------------------------------------------------------------

type PackageServiceWithRequirements = Prisma.PackageServiceGetPayload<{
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
// FieldData / heuristic — mirrors personal-info-fields/route.ts:144–152
// ---------------------------------------------------------------------------

interface FieldDataShape {
  collectionTab?: unknown;
  collection_tab?: unknown;
  // dataType / instructions also live here but aren't read in this module.
}

const PERSONAL_INFO_FIELD_KEYS = new Set([
  'firstName',
  'lastName',
  'middleName',
  'email',
  'phone',
  'phoneNumber',
  'dateOfBirth',
  'birthDate',
  'dob',
  'ssn',
  'socialSecurityNumber',
]);

// IDV synthetic marker — the IDV section saves the candidate's selected
// country at this requirementId. It is NOT a DSX requirement, so it is
// excluded from the requirement walk and read separately.
export const IDV_COUNTRY_MARKER = 'idv_country';

function isPersonalInfoField(
  fieldKey: string,
  fieldData: FieldDataShape | null,
): boolean {
  const tabRaw =
    fieldData?.collectionTab ??
    fieldData?.collection_tab ??
    '';
  const tab = typeof tabRaw === 'string' ? tabRaw.toLowerCase() : '';
  if (tab.includes('personal') || tab.includes('subject')) return true;
  return PERSONAL_INFO_FIELD_KEYS.has(fieldKey);
}

// ---------------------------------------------------------------------------
// Public output shape — one entry per applicable DSX requirement
// ---------------------------------------------------------------------------

export interface RequiredFieldDescriptor {
  requirementId: string;
  fieldKey: string;
  // Display label for the FieldError. Sourced from `requirement.name`.
  fieldName: string;
  isRequired: boolean;
}

// ---------------------------------------------------------------------------
// AND-aggregation helper — shared by both Personal Info and IDV
//
// Walks dsx_mappings for (requirementId IN [...]) AND (serviceId,
// locationId) pairs, groups by requirementId, ANDs the isRequired flags.
// Empty groups (no applicable mappings) → isRequired=false (matches
// personal-info-fields/route.ts:227–243).
//
// `findMappings` is injected so the helpers can be tested without a Prisma
// client, AND so the validation engine can pass either the global prisma
// client or a transaction client.
// ---------------------------------------------------------------------------

export interface DsxMappingRow {
  requirementId: string;
  serviceId: string;
  locationId: string;
  isRequired: boolean;
}

export type FindDsxMappings = (args: {
  requirementIds: string[];
  pairs: Array<{ serviceId: string; locationId: string }>;
}) => Promise<DsxMappingRow[]>;

async function aggregateIsRequired(
  requirementIds: string[],
  pairs: Array<{ serviceId: string; locationId: string }>,
  findMappings: FindDsxMappings,
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (requirementIds.length === 0 || pairs.length === 0) {
    return result;
  }
  const rows = await findMappings({ requirementIds, pairs });
  const flagsByRequirement = new Map<string, boolean[]>();
  for (const row of rows) {
    const list = flagsByRequirement.get(row.requirementId) ?? [];
    list.push(row.isRequired);
    flagsByRequirement.set(row.requirementId, list);
  }
  for (const [requirementId, flags] of flagsByRequirement.entries()) {
    // AND semantics — empty arrays must NOT be true. Guard explicitly so
    // a future regression that leaves a key with no flags doesn't flip a
    // field to required by accident.
    const aggregated = flags.length > 0 && flags.every(Boolean);
    result.set(requirementId, aggregated);
  }
  return result;
}

// ---------------------------------------------------------------------------
// collectPersonalInfoFieldRequirements
//
// Plan §10.3 — walk every package service's serviceRequirements, filter to
// requirement.type==='field' AND requirement.disabled===false AND the
// personal-info collectionTab heuristic, then resolve isRequired against
// the candidate's available (service, location) pairs using the same
// AND-aggregation logic as personal-info-fields/route.ts.
// ---------------------------------------------------------------------------

export async function collectPersonalInfoFieldRequirements(
  packageServices: PackageServiceWithRequirements[],
  findMappings: FindDsxMappings,
): Promise<RequiredFieldDescriptor[]> {
  // Step 1 — pull every personal-info-tab field requirement out of the
  // package services. Dedupe by requirement id (one DSX requirement may be
  // mapped to multiple services in the same package).
  const candidates = new Map<string, RequiredFieldDescriptor>();
  const serviceIdsInPackage = new Set<string>();

  for (const ps of packageServices) {
    if (!ps.service) continue;
    serviceIdsInPackage.add(ps.service.id);

    for (const sr of ps.service.serviceRequirements ?? []) {
      const req = sr.requirement;
      if (!req) continue;
      if (req.disabled === true) continue;
      if (req.type !== 'field') continue;

      const fieldData = (req.fieldData as unknown as FieldDataShape | null) ?? null;
      if (!isPersonalInfoField(req.fieldKey, fieldData)) continue;

      if (!candidates.has(req.id)) {
        candidates.set(req.id, {
          requirementId: req.id,
          fieldKey: req.fieldKey,
          fieldName: req.name,
          isRequired: false, // resolved in Step 2
        });
      }
    }
  }

  if (candidates.size === 0) return [];

  // Step 2 — build the (serviceId, locationId) pair list for "available,
  // non-disabled" combinations across the package. Mirrors
  // personal-info-fields/route.ts:187–196 — `country.disabled IS NOT TRUE`
  // catches both `false` and SQL NULL.
  const pairs: Array<{ serviceId: string; locationId: string }> = [];
  for (const ps of packageServices) {
    if (!ps.service) continue;
    for (const av of ps.service.availability ?? []) {
      if (av.isAvailable !== true) continue;
      pairs.push({ serviceId: av.serviceId, locationId: av.locationId });
    }
  }

  if (pairs.length === 0) {
    // No available (service, location) pairs — every field falls back to
    // not-required. Spec Edge Case 3 / Business Rule 3.
    return Array.from(candidates.values());
  }

  // Step 3 — AND-aggregate isRequired per requirement.
  const requiredByRequirement = await aggregateIsRequired(
    Array.from(candidates.keys()),
    pairs,
    findMappings,
  );

  // Step 4 — fold into the descriptor list.
  const result: RequiredFieldDescriptor[] = [];
  for (const descriptor of candidates.values()) {
    result.push({
      ...descriptor,
      isRequired: requiredByRequirement.get(descriptor.requirementId) ?? false,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// collectIdvFieldRequirements
//
// Plan §10.4 — collect every IDV-functionality service's field
// requirements that are mapped at the candidate's selected country, AND
// resolve isRequired across that single (service, country) per-service set.
//
// "Mapped at this country" is the same condition as
// `dsx_mappings.serviceId === ps.service.id AND dsx_mappings.locationId ===
// selectedCountryId`. Only requirements that appear in such a mapping row
// are considered IDV requirements for this country (i.e., the requirement
// is configured to be collected at this jurisdiction).
// ---------------------------------------------------------------------------

export async function collectIdvFieldRequirements(
  packageServices: PackageServiceWithRequirements[],
  selectedCountryId: string,
  findMappings: FindDsxMappings,
): Promise<RequiredFieldDescriptor[]> {
  if (!selectedCountryId) return [];

  // Step 1 — find IDV-functionality services in the package.
  const idvServiceIds: string[] = [];
  // Build a fast lookup from requirementId → DSXRequirement record so we
  // can read `name` and `fieldKey` without re-querying. We walk every
  // service's serviceRequirements (regardless of functionality) once
  // because requirements are shared across services.
  const requirementById = new Map<
    string,
    {
      id: string;
      name: string;
      fieldKey: string;
      type: string;
      disabled: boolean;
      fieldData: FieldDataShape | null;
    }
  >();

  for (const ps of packageServices) {
    if (!ps.service) continue;
    if (ps.service.functionalityType === 'verification-idv') {
      idvServiceIds.push(ps.service.id);
    }
    for (const sr of ps.service.serviceRequirements ?? []) {
      const req = sr.requirement;
      if (!req) continue;
      requirementById.set(req.id, {
        id: req.id,
        name: req.name,
        fieldKey: req.fieldKey,
        type: req.type,
        disabled: req.disabled === true,
        fieldData: (req.fieldData as unknown as FieldDataShape | null) ?? null,
      });
    }
  }

  if (idvServiceIds.length === 0) return [];

  // Step 2 — query dsx_mappings for the (idvServiceIds × selectedCountryId)
  // pairs to discover which requirements apply at this country. We pass an
  // empty requirementIds whitelist — the inner findMappings implementation
  // is expected to fetch ALL requirements when the whitelist is empty.
  // (See `dsxMappingsFetcher` below — it uses Prisma's `IN` filter only
  // when the array is non-empty.)
  const pairs = idvServiceIds.map((sid) => ({
    serviceId: sid,
    locationId: selectedCountryId,
  }));

  // We fetch with no requirementId whitelist — the caller's implementation
  // returns every mapping row for the (service, location) pairs. The
  // requirements we accept are the field-type, non-disabled subset.
  const allRows = await findMappings({ requirementIds: [], pairs });

  // Step 3 — collect candidates: any requirement that has at least one
  // mapping row at the selected country, restricted to field/non-disabled.
  const candidates = new Map<string, RequiredFieldDescriptor>();
  const flagsByRequirement = new Map<string, boolean[]>();

  for (const row of allRows) {
    const req = requirementById.get(row.requirementId);
    if (!req) continue; // requirement not in our package's services
    if (req.disabled) continue;
    if (req.type !== 'field') continue;
    // Exclude requirements claimed by the Personal Info collector. Same
    // heuristic as collectPersonalInfoFieldRequirements / IdvSection's UI
    // filter — without this exclusion, IDV-mapped DSX fields with
    // collectionTab='subject' (e.g. firstName/lastName) get reported as
    // unfilled IDV requirements even though the candidate satisfies them
    // via Personal Info / locked invitation columns.
    if (isPersonalInfoField(req.fieldKey, req.fieldData)) continue;

    if (!candidates.has(req.id)) {
      candidates.set(req.id, {
        requirementId: req.id,
        fieldKey: req.fieldKey,
        fieldName: req.name,
        isRequired: false,
      });
    }
    const list = flagsByRequirement.get(req.id) ?? [];
    list.push(row.isRequired);
    flagsByRequirement.set(req.id, list);
  }

  // Step 4 — OR-aggregate isRequired per requirement (TD-084 BR 1). A
  // requirement is required if ANY in-scope (serviceId, countryId) mapping
  // row says required; empty arrays are explicitly false (defensive guard
  // preserved from the original AND form). Note: this changes IDV-side
  // semantics ONLY — the module-internal `aggregateIsRequired` helper at the
  // top of the file (used by `collectPersonalInfoFieldRequirements`) stays
  // on AND per TD-060 / TD-052; Personal Info is out of scope for TD-084.
  const result: RequiredFieldDescriptor[] = [];
  for (const descriptor of candidates.values()) {
    const flags = flagsByRequirement.get(descriptor.requirementId) ?? [];
    const isRequired = flags.length > 0 && flags.some(Boolean);
    result.push({ ...descriptor, isRequired });
  }
  return result;
}

// ---------------------------------------------------------------------------
// checkRequiredFields — Plan §10.3 step 4 / §10.4 step 4
//
// For each required requirement, look up the saved value. Emit a FieldError
// when missing or empty.
//
// "Empty" mirrors the spec text: null, undefined, empty string, or empty
// array. Whitespace-only strings ARE counted as values (the candidate
// typed something) — if that needs tightening, the cleaner home is the
// /save endpoint's normalization, not the validator.
// ---------------------------------------------------------------------------

export interface CheckRequiredFieldsInput {
  requirements: RequiredFieldDescriptor[];
  savedFields: SavedField[];
  // Locked-fields override (Plan §10.3 step 3). When a required requirement's
  // fieldKey is in `lockedValues` AND the locked value is non-empty, treat
  // the requirement as filled even if `savedFields` has no entry for it.
  // The Personal Info save endpoint already filters locked fields out of
  // the saved payload, so this is the only way the engine sees them.
  lockedValues?: Record<string, string | null | undefined>;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function checkRequiredFields(
  input: CheckRequiredFieldsInput,
): FieldError[] {
  const { requirements, savedFields, lockedValues } = input;

  // Build a quick lookup once.
  const savedByRequirementId = new Map<string, unknown>();
  for (const f of savedFields) {
    savedByRequirementId.set(f.requirementId, f.value);
  }

  const errors: FieldError[] = [];
  for (const req of requirements) {
    if (!req.isRequired) continue;

    // Locked-field defense-in-depth: if the candidate's locked value (from
    // the invitation columns) is non-empty for this fieldKey, the field is
    // satisfied even when the saved-data bucket has no entry for it.
    if (lockedValues) {
      const locked = lockedValues[req.fieldKey];
      if (typeof locked === 'string' && locked.length > 0) {
        continue;
      }
    }

    const saved = savedByRequirementId.get(req.requirementId);
    if (isEmptyValue(saved)) {
      errors.push({
        fieldName: req.fieldName,
        messageKey: 'candidate.validation.fieldRequired',
      });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// validatePersonalInfoSection
//
// Drop-in replacement for the engine's old `validateNonScopedSection` call
// for `personal_info`. The engine builds the inputs (saved data, required
// field list, locked-value lookup) and passes a status-derivation callback
// so we don't need to import the engine's helper directly.
// ---------------------------------------------------------------------------

export interface ValidatePersonalInfoInput {
  sectionId: string;
  sectionData: SavedSectionData | undefined;
  requiredFields: RequiredFieldDescriptor[];
  lockedValues: Record<string, string | null | undefined>;
  sectionVisits: Record<string, SectionVisitRecord>;
  reviewVisitedAt: string | null;
  /**
   * Engine-owned status derivation. Wrapping it as a callback keeps the
   * engine's `deriveStatusWithErrors` semantics authoritative without
   * exporting that helper. The shape mirrors that helper exactly.
   */
  deriveStatus: (
    sectionId: string,
    sectionData: SavedSectionData | undefined,
    result: SectionValidationResult,
    sectionVisits: Record<string, SectionVisitRecord>,
    reviewVisitedAt: string | null,
  ) => ValidationStatus;
}

export function validatePersonalInfoSection(
  input: ValidatePersonalInfoInput,
): SectionValidationResult {
  const result: SectionValidationResult = {
    sectionId: input.sectionId,
    status: 'not_started',
    fieldErrors: [],
    scopeErrors: [],
    gapErrors: [],
    documentErrors: [],
  };

  result.fieldErrors = checkRequiredFields({
    requirements: input.requiredFields,
    savedFields: input.sectionData?.fields ?? [],
    lockedValues: input.lockedValues,
  });

  result.status = input.deriveStatus(
    input.sectionId,
    input.sectionData,
    result,
    input.sectionVisits,
    input.reviewVisitedAt,
  );

  return result;
}

// ---------------------------------------------------------------------------
// validateIdvSection
//
// Drop-in replacement for the engine's old `validateNonScopedSection` call
// for IDV. Reads from `sectionsData['idv']` (NOT `service_verification-idv`
// — BR 8: save-route bucket key is a separate namespace from the
// functionality-type rename). When the country is missing, emits a single
// `candidate.validation.idvCountryRequired` field error and skips the
// per-field check entirely.
//
// `findMappings` is the same callback used by collectIdvFieldRequirements —
// passed in here so the engine doesn't have to call the collector itself
// when the country isn't selected (saves a Prisma round-trip in the empty
// case).
// ---------------------------------------------------------------------------

export interface ValidateIdvInput {
  // The engine refers to the IDV section as `service_verification-idv` for
  // SectionValidationResult.sectionId, matching the structure endpoint's
  // emitted section id post verification-idv-conversion. The DATA, however,
  // is read from `sectionsData['idv']` (BR 8 — save-bucket key unchanged).
  sectionId: string;
  // The saved IDV data lives at `sectionsData['idv']`. Pass it in directly
  // — the engine knows the right key.
  idvSectionData: SavedSectionData | undefined;
  packageServices: PackageServiceWithRequirements[];
  findMappings: FindDsxMappings;
  sectionVisits: Record<string, SectionVisitRecord>;
  reviewVisitedAt: string | null;
  deriveStatus: ValidatePersonalInfoInput['deriveStatus'];
}

/** Read the saved IDV country (the `idv_country` synthetic marker). */
function readIdvCountryId(section: SavedSectionData | undefined): string | null {
  if (!section) return null;
  const fields = section.fields ?? [];
  for (const f of fields) {
    if (f.requirementId === IDV_COUNTRY_MARKER) {
      const v = f.value;
      if (typeof v === 'string' && v.length > 0) return v;
      return null;
    }
  }
  return null;
}

export async function validateIdvSection(
  input: ValidateIdvInput,
): Promise<SectionValidationResult> {
  const result: SectionValidationResult = {
    sectionId: input.sectionId,
    status: 'not_started',
    fieldErrors: [],
    scopeErrors: [],
    gapErrors: [],
    documentErrors: [],
  };

  const countryId = readIdvCountryId(input.idvSectionData);

  if (!countryId) {
    // Plan §10.4 step 2 — country not selected. One distinguishing field
    // error and we're done; per-field checks make no sense without a
    // country.
    result.fieldErrors = [
      {
        fieldName: 'country',
        messageKey: 'candidate.validation.idvCountryRequired',
      },
    ];
  } else {
    let requiredFields: RequiredFieldDescriptor[] = [];
    try {
      requiredFields = await collectIdvFieldRequirements(
        input.packageServices,
        countryId,
        input.findMappings,
      );
    } catch (error) {
      logger.error('Failed to collect IDV field requirements', {
        event: 'candidate_validation_idv_collect_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Soft-fail to "no required IDV fields known" — the engine returns
      // whatever errors are present (none) and the section status falls
      // out of deriveStatus. The candidate is not blocked; the operator
      // can investigate via logs.
      requiredFields = [];
    }

    result.fieldErrors = checkRequiredFields({
      requirements: requiredFields,
      savedFields: input.idvSectionData?.fields ?? [],
    });
  }

  result.status = input.deriveStatus(
    input.sectionId,
    // Status derivation reads `sectionData` for hasAnySavedData; for IDV
    // that's the `idv` bucket, so we pass it through unchanged.
    input.idvSectionData,
    result,
    input.sectionVisits,
    input.reviewVisitedAt,
  );

  return result;
}
