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

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

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
} from './dateExtractors';
import { validateWorkflowSection } from './validateWorkflowSection';
import {
  collectPersonalInfoFieldRequirements,
  validateIdvSection,
  validatePersonalInfoSection,
  type DsxMappingRow,
  type FindDsxMappings,
} from './personalInfoIdvFieldChecks';
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
// Internal data shapes (narrow what we read from `formData`)
// ---------------------------------------------------------------------------

interface SavedFieldRecord {
  requirementId: string;
  value: unknown;
}

interface SavedRepeatableEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: SavedFieldRecord[];
}

interface SavedSectionData {
  type?: string;
  fields?: SavedFieldRecord[];
  entries?: SavedRepeatableEntry[];
  aggregatedFields?: Record<string, unknown>;
}

interface SectionVisitRecord {
  visitedAt: string;
  departedAt: string | null;
}

interface CandidateFormDataShape {
  sections?: Record<string, SavedSectionData>;
  sectionVisits?: Record<string, SectionVisitRecord>;
  reviewPageVisitedAt?: string | null;
  [key: string]: unknown;
}

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

  const invitation = await prisma.candidateInvitation.findUnique({
    where: { id: invitationId },
    include: {
      package: {
        include: {
          workflow: { include: { sections: true } },
          // Phase 7 Stage 2 / TD-062 — extended include so the engine can
          // resolve Personal Info / IDV field-level required-state without
          // a second round-trip. The personalInfoIdvFieldChecks helpers
          // walk service.serviceRequirements (limited to type='field' at
          // read time) and service.availability for the (service,
          // location) pair list.
          packageServices: {
            include: {
              service: {
                include: {
                  serviceRequirements: { include: { requirement: true } },
                  availability: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error(`Invitation not found: ${invitationId}`);
  }

  const formData = (invitation.formData as unknown as CandidateFormDataShape) ?? {};
  const sectionsData = formData.sections ?? {};
  const sectionVisits = formData.sectionVisits ?? {};
  const reviewVisitedAt = formData.reviewPageVisitedAt ?? null;

  const orderedPackage = invitation.package;
  if (!orderedPackage) {
    logger.warn('runValidation invoked on invitation without package', {
      event: 'candidate_validation_no_package',
      invitationId,
    });
    return emptyResult();
  }

  const gapToleranceDays =
    typeof orderedPackage.workflow?.gapToleranceDays === 'number'
      ? orderedPackage.workflow.gapToleranceDays
      : null;

  // Group package services by functionality type so each section can pick
  // the most demanding scope (Rule 19).
  const servicesByType = new Map<
    ScopeFunctionalityType,
    typeof orderedPackage.packageServices
  >();
  for (const ps of orderedPackage.packageServices) {
    const ft = ps.service?.functionalityType;
    if (
      ft === 'verification-edu' ||
      ft === 'verification-emp' ||
      ft === 'record'
    ) {
      const list = servicesByType.get(ft) ?? [];
      list.push(ps);
      servicesByType.set(ft, list);
    }
  }

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
      }),
    );
  }

  // Personal Info — TD-062 fix. Walks the package's DSX field requirements
  // and emits a FieldError for every required field that's empty. Locked
  // fields (firstName/lastName/email/phone) are sourced from the invitation
  // columns and pass the check whenever the column is non-empty.
  const findMappings: FindDsxMappings = buildFindMappings();
  const lockedValues: Record<string, string | null | undefined> = {
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    email: invitation.email,
    // The portal API also recognizes `phone` and `phoneNumber` as locked
    // when the invitation has a phone number; we feed the concatenated
    // value (country code + number) into both keys so either fieldKey
    // shape passes the locked check.
    phone: invitation.phoneNumber
      ? `${invitation.phoneCountryCode ?? ''}${invitation.phoneNumber}`
      : null,
    phoneNumber: invitation.phoneNumber
      ? `${invitation.phoneCountryCode ?? ''}${invitation.phoneNumber}`
      : null,
  };

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
      extractEmploymentEntryDates(flattenEntry(e), {}),
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
    extractEmploymentEntryDates(flattenEntry(e), {}),
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

// Translate the saved-data per-entry shape (fields: SavedFieldRecord[]) into
// the date-extractor shape (fields: Record<requirementId|fieldKey, value>).
function flattenEntry(entry: SavedRepeatableEntry): {
  entryOrder: number;
  fields: Record<string, unknown>;
} {
  const flat: Record<string, unknown> = {};
  for (const field of entry.fields) {
    flat[field.requirementId] = field.value;
  }
  return { entryOrder: entry.entryOrder, fields: flat };
}

// Heuristic: an "address_block" field is a saved field whose value is a JSON
// object containing fromDate / toDate / isCurrent keys. We sniff the first
// entry's fields so the validator doesn't need a separate metadata fetch.
function inferAddressBlockRequirementId(
  entries: SavedRepeatableEntry[],
): string | null {
  for (const entry of entries) {
    for (const field of entry.fields) {
      const v = field.value;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const obj = v as object;
        if ('fromDate' in obj || 'toDate' in obj || 'isCurrent' in obj) {
          return field.requirementId;
        }
      }
    }
  }
  return null;
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

// ---------------------------------------------------------------------------
// findMappings adapter — TD-062 fix
//
// Wraps prisma.dSXMapping.findMany so the personalInfoIdvFieldChecks helpers
// don't need to import prisma themselves (keeps them unit-testable). When
// `requirementIds` is empty we omit the IN filter — the IDV collector uses
// this to fetch every mapping at the (service, country) pairs and infer
// the requirement set from the rows that come back (Plan §10.4 step 2).
// ---------------------------------------------------------------------------
function buildFindMappings(): FindDsxMappings {
  return async ({ requirementIds, pairs }): Promise<DsxMappingRow[]> => {
    if (pairs.length === 0) return [];
    const rows = await prisma.dSXMapping.findMany({
      where: {
        ...(requirementIds.length > 0
          ? { requirementId: { in: requirementIds } }
          : {}),
        OR: pairs.map((p) => ({
          serviceId: p.serviceId,
          locationId: p.locationId,
        })),
      },
      select: {
        requirementId: true,
        serviceId: true,
        locationId: true,
        isRequired: true,
      },
    });
    return rows;
  };
}
