// /GlobalRX_v2/src/lib/candidate/validation/validationEngine.ts
//
// Phase 7 Stage 1 — top-level validation orchestrator. Loads the candidate's
// saved data, the package scope configuration, and the workflow's
// gapToleranceDays setting, then delegates to the pure helpers in this
// directory and assembles a FullValidationResult.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.8
//
// Phase 7 Stage 2 — TD-062 fix: Personal Info / IDV now validate required
// DSX field requirements rather than just relying on visit state. The
// per-section logic lives in `personalInfoIdvFieldChecks.ts` (Andy's
// Option 1 — sibling-file path). This file's edits are intentionally
// minimal: an extended Prisma include, two replaced call sites, and one
// shared findMappings adapter.
//
// Single rule about "today": Rule 14 / Tech Plan §11.3 — capture once at the
// top of runValidation(), thread it through every helper.

import {
  normalizeRawScope,
  pickMostDemandingScope,
  type RawPackageServiceScope,
  type ResolvedScope,
  type ScopeFunctionalityType,
} from './packageScopeShape';
import {
  evaluateCountScope,
  evaluateTimeBasedScope,
} from './scopeValidation';
import { detectGaps } from './gapDetection';
import {
  extractAddressEntryDates,
  extractEmploymentEntryDates,
  type RequirementMetadata,
} from './dateExtractors';
import { validateWorkflowSection } from './validateWorkflowSection';
import {
  collectPersonalInfoFieldRequirements,
  validateIdvSection,
  validatePersonalInfoSection,
} from './personalInfoIdvFieldChecks';
import { loadValidationInputs } from './loadValidationInputs';
import type { RequirementRecord } from './loadValidationInputs';
import {
  validateAddressHistoryEntries,
  validateEducationEntries,
  validateEmploymentEntries,
} from './repeatableEntryFieldChecks';
import type { PackageServiceWithRequirements } from './repeatableEntryFieldChecks';
import type { FindDsxMappings } from './personalInfoIdvFieldChecks';
import { buildReviewSummary } from './buildReviewSummary';
import {
  flattenEntry,
  inferAddressBlockRequirementId,
} from './savedEntryShape';
import type {
  SavedFieldRecord,
  SavedRepeatableEntry,
  SavedSectionData,
  SectionVisitRecord,
} from './savedEntryShape';
import type {
  DatedEntryLike,
  EntryLike,
  FullValidationResult,
  SectionValidationResult,
  ValidationStatus,
} from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

// ---------------------------------------------------------------------------
// runValidation — public entry point
// ---------------------------------------------------------------------------

/**
 * Run the full validation engine for the given candidate invitation.
 *
 * Loads the invitation, its package + workflow + package services, builds
 * the per-section validation results, and assembles the review-page summary.
 */
export async function runValidation(
  invitationId: string,
): Promise<FullValidationResult> {
  // Capture "today" exactly once. Every per-section helper uses the same
  // Date so a long-running call cannot see two different "todays".
  const today = new Date();

  // All database reads and pre-section derivations live in the loader
  // (Phase 7 Stage 3a). The orchestrator only sees a discriminated union:
  // `kind: 'no_package'` short-circuits to emptyResult(); `kind: 'ok'`
  // hands us the invitation, package, formData, scope groupings, the
  // requirement metadata map, the locked-values record, and the DSX
  // findMappings adapter — all of which used to be built inline here.
  const inputs = await loadValidationInputs(invitationId);
  if (inputs.kind === 'no_package') {
    return emptyResult();
  }

  const {
    orderedPackage,
    sectionsData,
    sectionVisits,
    reviewVisitedAt,
    gapToleranceDays,
    servicesByType,
    requirementMetadata,
    requirementById,
    lockedValues,
    findMappings,
  } = inputs;

  const sectionResults: SectionValidationResult[] = [];

  // Address History (record functionality)
  if (servicesByType.has('record')) {
    const recordServices = servicesByType.get('record') ?? [];
    const scope = resolveSectionScope(recordServices, 'record');
    sectionResults.push(
      await validateAddressHistorySection({
        sectionId: 'address_history',
        sectionData: sectionsData['address_history'],
        scope,
        gapToleranceDays,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
        packageServicesForSection: recordServices,
        findMappings,
        requirementById,
      }),
    );
  }

  // Education (verification-edu)
  if (servicesByType.has('verification-edu')) {
    const eduServices = servicesByType.get('verification-edu') ?? [];
    const scope = resolveSectionScope(eduServices, 'verification-edu');
    sectionResults.push(
      await validateEducationSection({
        sectionId: 'service_verification-edu',
        sectionData: sectionsData['education'],
        scope,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
        packageServicesForSection: eduServices,
        findMappings,
        requirementById,
      }),
    );
  }

  // Employment (verification-emp)
  if (servicesByType.has('verification-emp')) {
    const empServices = servicesByType.get('verification-emp') ?? [];
    const scope = resolveSectionScope(empServices, 'verification-emp');
    sectionResults.push(
      await validateEmploymentSection({
        sectionId: 'service_verification-emp',
        sectionData: sectionsData['employment'],
        scope,
        gapToleranceDays,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
        packageServicesForSection: empServices,
        findMappings,
        requirementById,
      }),
    );
  }

  // Personal Info — TD-062 fix. Walks the package's DSX field requirements
  // and emits a FieldError for every required field that's empty. Locked
  // fields (firstName/lastName/email/phone) come from the invitation
  // columns via the loader; they pass the check whenever the column is
  // non-empty. `findMappings` is the shared DSX mapping adapter (also
  // built by the loader, closed over module `prisma`).
  const personalInfoRequirements = await collectPersonalInfoFieldRequirements(
    orderedPackage.packageServices,
    findMappings,
  );
  sectionResults.push(
    validatePersonalInfoSection({
      sectionId: 'personal_info',
      sectionData: sectionsData['personal_info'],
      requiredFields: personalInfoRequirements,
      lockedValues,
      sectionVisits,
      reviewVisitedAt,
      deriveStatus: deriveStatusWithErrors,
    }),
  );

  // IDV (verification-idv) — symmetric with verification-edu / verification-emp
  // dispatch above. Scope is fixed at count_exact:1 (see packageScopeShape —
  // BR 15). After verification-idv-conversion, IDV flows through the same
  // servicesByType grouping as edu/emp/record. The save-route bucket key
  // stays `'idv'` (BR 8) — the Service.functionalityType rename does NOT
  // touch save-route bucket keys, so `sectionsData['idv']` is unchanged.
  // The SectionValidationResult.sectionId is `service_verification-idv` to
  // match the structure endpoint's emitted section id post-rename.
  if (servicesByType.has('verification-idv')) {
    const idvServices = servicesByType.get('verification-idv') ?? [];
    const idvResult = await validateIdvSection({
      sectionId: 'service_verification-idv',
      idvSectionData: sectionsData['idv'], // BR 8 — save-bucket key unchanged
      packageServices: idvServices,
      findMappings,
      sectionVisits,
      reviewVisitedAt,
      deriveStatus: deriveStatusWithErrors,
    });
    sectionResults.push(idvResult);
  }

  // Workflow sections — emit a per-section result so the Review page can
  // render their status. Acknowledgment-style sections only have a single
  // boolean acknowledgment, evaluated by validateWorkflowSection against
  // the workflow author's `isRequired` flag (Rule 27).
  if (orderedPackage.workflow?.sections) {
    for (const ws of orderedPackage.workflow.sections) {
      sectionResults.push(
        buildWorkflowSectionResult({
          sectionId: ws.id,
          isRequired: ws.isRequired,
          sectionData: sectionsData[ws.id],
          sectionVisits,
          reviewVisitedAt,
        }),
      );
    }
  }

  const summary = buildReviewSummary(sectionResults);

  return { sections: sectionResults, summary };
}

// ---------------------------------------------------------------------------
// Per-section helpers
// ---------------------------------------------------------------------------

// Shared empty SectionValidationResult — every per-section helper starts
// with this shape and overwrites the error arrays it actually computes.
function emptySectionResult(
  sectionId: string,
  status: ValidationStatus,
): SectionValidationResult {
  return { sectionId, status, fieldErrors: [], scopeErrors: [], gapErrors: [], documentErrors: [] };
}

interface NonScopedInput {
  sectionId: string;
  sectionData: SavedSectionData | undefined;
  sectionVisits: Record<string, SectionVisitRecord>;
  reviewVisitedAt: string | null;
}

function validateNonScopedSection(
  input: NonScopedInput,
): SectionValidationResult {
  return emptySectionResult(
    input.sectionId,
    deriveBasicStatus(input.sectionId, input.sectionData, input.sectionVisits),
  );
}

interface WorkflowSectionInput {
  sectionId: string;
  isRequired: boolean;
  sectionData: SavedSectionData | undefined;
  sectionVisits: Record<string, SectionVisitRecord>;
  reviewVisitedAt: string | null;
}

// Workflow sections live entirely in formData.sections[sectionId].fields[0].
// We pull `acknowledged` out and delegate to the pure helper.
function buildWorkflowSectionResult(
  input: WorkflowSectionInput,
): SectionValidationResult {
  const value = input.sectionData?.fields?.[0]?.value;
  const acknowledged =
    value !== null && typeof value === 'object' && 'acknowledged' in value
      ? Boolean((value as { acknowledged: unknown }).acknowledged)
      : undefined;
  const visit = input.sectionVisits[input.sectionId];
  return emptySectionResult(
    input.sectionId,
    validateWorkflowSection({
      isRequired: input.isRequired,
      acknowledged,
      hasVisit: Boolean(visit),
      hasDeparted: Boolean(visit?.departedAt),
      reviewVisited: input.reviewVisitedAt !== null,
    }),
  );
}

interface ScopedSectionInput {
  sectionId: string;
  sectionData: SavedSectionData | undefined;
  scope: ResolvedScope;
  gapToleranceDays: number | null;
  today: Date;
  sectionVisits: Record<string, SectionVisitRecord>;
  reviewVisitedAt: string | null;
  // Map of saved-field requirementId → { fieldKey, name, dataType }, supplied
  // to `extractEmploymentEntryDates` so it can identify start/end/current
  // fields by requirement metadata. Address-history and personal-info paths
  // ignore this; only employment and education time-based scope use it.
  requirementMetadata: Map<string, RequirementMetadata>;
  // Phase 7 Stage 3b — TD-069. Threaded through to the per-entry walk in
  // `repeatableEntryFieldChecks.ts`. The packageServicesForSection slice is
  // pre-filtered to the section's functionalityType (e.g. 'record',
  // 'verification-edu', 'verification-emp') by the orchestrator.
  packageServicesForSection: PackageServiceWithRequirements[];
  findMappings: FindDsxMappings;
  requirementById: Map<string, RequirementRecord>;
}

async function validateAddressHistorySection(
  input: ScopedSectionInput,
): Promise<SectionValidationResult> {
  const entries = input.sectionData?.entries ?? [];
  const countResult = emptySectionResult(input.sectionId, 'not_started');

  // Address-block requirement ID — read from the first entry's first field
  // whose value is an object containing fromDate / toDate / isCurrent.
  const addressBlockReqId = inferAddressBlockRequirementId(entries);

  const datedEntries: DatedEntryLike[] = entries.map((entry) => {
    const flat = flattenEntry(entry);
    if (addressBlockReqId === null) {
      return { start: null, end: null, isCurrent: false };
    }
    return extractAddressEntryDates(flat, addressBlockReqId);
  });

  const entryLikes: EntryLike[] = entries.map((e) => ({
    entryOrder: e.entryOrder,
  }));

  if (input.scope.scopeType === 'time_based') {
    const tb = evaluateTimeBasedScope(input.scope, datedEntries, input.today);
    countResult.scopeErrors = tb.errors;
    const scopeStart = computeScopeStart(input.scope, input.today);
    countResult.gapErrors = detectGaps(
      datedEntries,
      input.gapToleranceDays,
      input.today,
      scopeStart,
    );
  } else {
    countResult.scopeErrors = evaluateCountScope(input.scope, entryLikes);
    countResult.gapErrors = detectGaps(
      datedEntries,
      input.gapToleranceDays,
      input.today,
      null,
    );
  }

  // Phase 7 Stage 3b — TD-069 per-entry required-field walk.
  countResult.fieldErrors = await validateAddressHistoryEntries({
    sectionId: input.sectionId,
    entries,
    packageServicesForSection: input.packageServicesForSection,
    findMappings: input.findMappings,
    requirementById: input.requirementById,
  });

  countResult.status = deriveStatusWithErrors(
    input.sectionId,
    input.sectionData,
    countResult,
    input.sectionVisits,
    input.reviewVisitedAt,
  );

  return countResult;
}

async function validateEducationSection(
  input: Omit<ScopedSectionInput, 'gapToleranceDays'>,
): Promise<SectionValidationResult> {
  // Education has scope but no gap detection (Rule 20).
  const entries = input.sectionData?.entries ?? [];
  const result = emptySectionResult(input.sectionId, 'not_started');

  const entryLikes: EntryLike[] = entries.map((e) => ({
    entryOrder: e.entryOrder,
  }));

  if (input.scope.scopeType === 'time_based') {
    const datedEntries: DatedEntryLike[] = entries.map((e) =>
      extractEmploymentEntryDates(
        flattenEntry(e),
        {},
        input.requirementMetadata,
      ),
    );
    const tb = evaluateTimeBasedScope(input.scope, datedEntries, input.today);
    result.scopeErrors = tb.errors;
  } else {
    result.scopeErrors = evaluateCountScope(input.scope, entryLikes);
  }

  // Phase 7 Stage 3b — TD-069 per-entry required-field walk.
  result.fieldErrors = await validateEducationEntries({
    sectionId: input.sectionId,
    entries,
    packageServicesForSection: input.packageServicesForSection,
    findMappings: input.findMappings,
    requirementById: input.requirementById,
  });

  result.status = deriveStatusWithErrors(
    input.sectionId,
    input.sectionData,
    result,
    input.sectionVisits,
    input.reviewVisitedAt,
  );
  return result;
}

async function validateEmploymentSection(
  input: ScopedSectionInput,
): Promise<SectionValidationResult> {
  const entries = input.sectionData?.entries ?? [];
  const result = emptySectionResult(input.sectionId, 'not_started');

  const datedEntries: DatedEntryLike[] = entries.map((e) =>
    extractEmploymentEntryDates(
      flattenEntry(e),
      {},
      input.requirementMetadata,
    ),
  );

  const entryLikes: EntryLike[] = entries.map((e) => ({
    entryOrder: e.entryOrder,
  }));

  if (input.scope.scopeType === 'time_based') {
    const tb = evaluateTimeBasedScope(input.scope, datedEntries, input.today);
    result.scopeErrors = tb.errors;
    const scopeStart = computeScopeStart(input.scope, input.today);
    result.gapErrors = detectGaps(
      datedEntries,
      input.gapToleranceDays,
      input.today,
      scopeStart,
    );
  } else {
    result.scopeErrors = evaluateCountScope(input.scope, entryLikes);
    result.gapErrors = detectGaps(
      datedEntries,
      input.gapToleranceDays,
      input.today,
      null,
    );
  }

  // Phase 7 Stage 3b — TD-069 per-entry required-field walk.
  result.fieldErrors = await validateEmploymentEntries({
    sectionId: input.sectionId,
    entries,
    packageServicesForSection: input.packageServicesForSection,
    findMappings: input.findMappings,
    requirementById: input.requirementById,
  });

  result.status = deriveStatusWithErrors(
    input.sectionId,
    input.sectionData,
    result,
    input.sectionVisits,
    input.reviewVisitedAt,
  );
  return result;
}

// ---------------------------------------------------------------------------
// Status derivation helpers
// ---------------------------------------------------------------------------

function deriveBasicStatus(
  sectionId: string,
  sectionData: SavedSectionData | undefined,
  sectionVisits: Record<string, SectionVisitRecord>,
): ValidationStatus {
  // Rule 27 — `not_started` only when never visited AND no saved data.
  // Sections with error signals (scoped) use deriveStatusWithErrors instead.
  if (!sectionVisits[sectionId] && !hasAnySavedData(sectionData)) {
    return 'not_started';
  }
  return 'complete';
}

function deriveStatusWithErrors(
  sectionId: string,
  sectionData: SavedSectionData | undefined,
  result: SectionValidationResult,
  sectionVisits: Record<string, SectionVisitRecord>,
  reviewVisitedAt: string | null,
): ValidationStatus {
  const visit = sectionVisits[sectionId];
  const hasSavedData = hasAnySavedData(sectionData);
  const hasErrors =
    result.scopeErrors.length > 0 ||
    result.gapErrors.length > 0 ||
    result.fieldErrors.length > 0 ||
    result.documentErrors.length > 0;

  if (!visit && !hasSavedData && reviewVisitedAt === null) {
    return 'not_started';
  }
  if (hasErrors) {
    return 'incomplete';
  }
  return 'complete';
}

function hasAnySavedData(sectionData: SavedSectionData | undefined): boolean {
  if (!sectionData) return false;
  return (
    (sectionData.entries?.length ?? 0) > 0 ||
    (sectionData.fields?.length ?? 0) > 0 ||
    Object.keys(sectionData.aggregatedFields ?? {}).length > 0
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function resolveSectionScope(
  packageServices: Array<{ scope: unknown }>,
  functionalityType: ScopeFunctionalityType,
): ResolvedScope {
  if (packageServices.length === 0) {
    return { scopeType: 'all', scopeValue: null };
  }
  const resolved = packageServices.map((ps) =>
    normalizeRawScope(
      (ps.scope as RawPackageServiceScope | null) ?? null,
      functionalityType,
    ),
  );
  return pickMostDemandingScope(resolved);
}

function computeScopeStart(scope: ResolvedScope, today: Date): Date | null {
  if (scope.scopeType !== 'time_based' || scope.scopeValue == null) {
    return null;
  }
  const days = scope.scopeValue * DAYS_PER_YEAR;
  return new Date(today.getTime() - days * MS_PER_DAY);
}

function emptyResult(): FullValidationResult {
  return {
    sections: [],
    summary: { sections: [], allComplete: true, totalErrors: 0 },
  };
}
