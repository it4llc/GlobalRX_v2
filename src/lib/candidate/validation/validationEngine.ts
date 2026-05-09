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
  ReviewError,
  ReviewPageSummary,
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
    lockedValues,
    findMappings,
  } = inputs;

  const sectionResults: SectionValidationResult[] = [];

  // Address History (record functionality)
  if (servicesByType.has('record')) {
    const scope = resolveSectionScope(servicesByType.get('record') ?? [], 'record');
    sectionResults.push(
      validateAddressHistorySection({
        sectionId: 'address_history',
        sectionData: sectionsData['address_history'],
        scope,
        gapToleranceDays,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
      }),
    );
  }

  // Education (verification-edu)
  if (servicesByType.has('verification-edu')) {
    const scope = resolveSectionScope(
      servicesByType.get('verification-edu') ?? [],
      'verification-edu',
    );
    sectionResults.push(
      validateEducationSection({
        sectionId: 'service_verification-edu',
        sectionData: sectionsData['education'],
        scope,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
      }),
    );
  }

  // Employment (verification-emp)
  if (servicesByType.has('verification-emp')) {
    const scope = resolveSectionScope(
      servicesByType.get('verification-emp') ?? [],
      'verification-emp',
    );
    sectionResults.push(
      validateEmploymentSection({
        sectionId: 'service_verification-emp',
        sectionData: sectionsData['employment'],
        scope,
        gapToleranceDays,
        today,
        sectionVisits,
        reviewVisitedAt,
        requirementMetadata,
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

  // IDV — TD-062 fix. Section bucket is keyed `idv` in saved-data (the IDV
  // section saves with sectionId: 'idv' — see IdvSection.tsx); we keep the
  // SectionValidationResult.sectionId as `service_idv` so the rest of the
  // engine and the Review page don't need a sectionId rename.
  const hasIdv = orderedPackage.packageServices.some(
    (ps) => ps.service?.functionalityType === 'idv',
  );
  if (hasIdv) {
    const idvResult = await validateIdvSection({
      sectionId: 'service_idv',
      idvSectionData: sectionsData['idv'],
      packageServices: orderedPackage.packageServices,
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
}

function validateAddressHistorySection(
  input: ScopedSectionInput,
): SectionValidationResult {
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

  countResult.status = deriveStatusWithErrors(
    input.sectionId,
    input.sectionData,
    countResult,
    input.sectionVisits,
    input.reviewVisitedAt,
  );

  return countResult;
}

function validateEducationSection(
  input: Omit<ScopedSectionInput, 'gapToleranceDays'>,
): SectionValidationResult {
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

  result.status = deriveStatusWithErrors(
    input.sectionId,
    input.sectionData,
    result,
    input.sectionVisits,
    input.reviewVisitedAt,
  );
  return result;
}

function validateEmploymentSection(
  input: ScopedSectionInput,
): SectionValidationResult {
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

function buildReviewSummary(
  sectionResults: SectionValidationResult[],
): ReviewPageSummary {
  let totalErrors = 0;
  const sections = sectionResults.map((sr) => {
    const errors: ReviewError[] = [];
    for (const fe of sr.fieldErrors) {
      errors.push({
        kind: 'field',
        fieldName: fe.fieldName,
        messageKey: fe.messageKey,
        placeholders: fe.placeholders,
      });
    }
    for (const se of sr.scopeErrors) {
      errors.push({
        kind: 'scope',
        messageKey: se.messageKey,
        placeholders: se.placeholders,
      });
    }
    for (const ge of sr.gapErrors) {
      errors.push({
        kind: 'gap',
        messageKey: ge.messageKey,
        placeholders: ge.placeholders,
        gapStart: ge.gapStart,
        gapEnd: ge.gapEnd,
      });
    }
    for (const de of sr.documentErrors) {
      errors.push({
        kind: 'document',
        requirementId: de.requirementId,
        documentNameKey: de.documentNameKey,
      });
    }
    totalErrors += errors.length;
    return {
      sectionId: sr.sectionId,
      // sectionName is filled in by the API route layer, which has access
      // to the section title strings. The engine itself only knows IDs.
      sectionName: sr.sectionId,
      status: sr.status,
      errors,
    };
  });

  return {
    sections,
    allComplete: sectionResults.every((sr) => sr.status === 'complete'),
    totalErrors,
  };
}

function emptyResult(): FullValidationResult {
  return {
    sections: [],
    summary: { sections: [], allComplete: true, totalErrors: 0 },
  };
}
