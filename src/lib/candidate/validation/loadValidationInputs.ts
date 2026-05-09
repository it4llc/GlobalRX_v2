// /GlobalRX_v2/src/lib/candidate/validation/loadValidationInputs.ts
//
// Phase 7 Stage 3a — owns every database read and every derived data-shape
// that the validation engine needs *before* it begins per-section dispatch.
// Hoisted out of `validationEngine.ts` so the engine can stay below the
// 600-line hard stop in CODING_STANDARDS.md Section 9.4.
//
// Spec:           docs/specs/phase7-stage3a-validation-engine-split.md
// Technical plan: docs/specs/phase7-stage3a-validation-engine-split-technical-plan.md §3.1
//
// Behavior is byte-identical to what the engine did pre-extraction:
//   - same Prisma `include` shape
//   - same "Invitation not found: ${invitationId}" throw on null
//   - same `logger.warn` event/message/metadata when invitation has no package
//   - same `formData` cast / `sectionsData` / `sectionVisits` / `reviewVisitedAt`
//     extraction
//   - same `gapToleranceDays` resolution
//   - same `servicesByType` grouping
//   - same `requirementMetadata` map
//   - same `lockedValues` construction (firstName/lastName/email/phone)
//   - same `buildFindMappings` adapter (closure capture of module `prisma`)

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

import type { ScopeFunctionalityType } from './packageScopeShape';
import type { RequirementMetadata } from './dateExtractors';
import type {
  DsxMappingRow,
  FindDsxMappings,
} from './personalInfoIdvFieldChecks';
import type {
  SavedFieldRecord,
  SavedRepeatableEntry,
  SavedSectionData,
  SectionVisitRecord,
} from './savedEntryShape';

// ---------------------------------------------------------------------------
// Internal data shapes (narrow what we read from `formData`)
//
// `CandidateFormDataShape` stays local to this loader — it is the loader's
// view of the raw `invitation.formData` payload and is not consumed by any
// per-section helper. The four shapes it composes (SavedFieldRecord,
// SavedRepeatableEntry, SavedSectionData, SectionVisitRecord) are imported
// from `./savedEntryShape` so the engine and the loader share one definition.
// ---------------------------------------------------------------------------

interface CandidateFormDataShape {
  sections?: Record<string, SavedSectionData>;
  sectionVisits?: Record<string, SectionVisitRecord>;
  reviewPageVisitedAt?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Prisma include shape — declared once with `satisfies` so we can derive the
// fully-narrowed payload type via `Prisma.CandidateInvitationGetPayload`.
// This is the technical-plan §6.1 fallback pattern; it produces a type that
// reflects all of the chained includes without `any` casts.
// ---------------------------------------------------------------------------

const CANDIDATE_INVITATION_INCLUDE = {
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
} satisfies Prisma.CandidateInvitationInclude;

type InvitationWithIncludes = Prisma.CandidateInvitationGetPayload<{
  include: typeof CANDIDATE_INVITATION_INCLUDE;
}>;

type PackageWithRelations = NonNullable<InvitationWithIncludes['package']>;

// Narrowed invitation shape used by the `kind: 'ok'` return branch — `package`
// is non-null because the loader's `if (!invitation.package)` short-circuit
// returned `{ kind: 'no_package' }` before we got here.
type InvitationWithPackage = InvitationWithIncludes & {
  package: PackageWithRelations;
};

type PackageServiceWithRelations = PackageWithRelations['packageServices'][number];

// ---------------------------------------------------------------------------
// ValidationInputs — discriminated union returned by `loadValidationInputs`.
// The orchestrator switches on `kind` and either short-circuits to
// emptyResult() (no_package) or proceeds with section dispatch (ok).
// ---------------------------------------------------------------------------

export type ValidationInputs =
  | { kind: 'no_package' }
  | {
      kind: 'ok';
      invitation: InvitationWithPackage;
      orderedPackage: PackageWithRelations;
      formData: CandidateFormDataShape;
      sectionsData: Record<string, SavedSectionData>;
      sectionVisits: Record<string, SectionVisitRecord>;
      reviewVisitedAt: string | null;
      gapToleranceDays: number | null;
      servicesByType: Map<ScopeFunctionalityType, PackageServiceWithRelations[]>;
      requirementMetadata: Map<string, RequirementMetadata>;
      lockedValues: Record<string, string | null | undefined>;
      findMappings: FindDsxMappings;
    };

// ---------------------------------------------------------------------------
// loadValidationInputs — the engine's database/derivation layer.
// ---------------------------------------------------------------------------

export async function loadValidationInputs(
  invitationId: string,
): Promise<ValidationInputs> {
  const invitation = await prisma.candidateInvitation.findUnique({
    where: { id: invitationId },
    include: CANDIDATE_INVITATION_INCLUDE,
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
    return { kind: 'no_package' };
  }

  const gapToleranceDays =
    typeof orderedPackage.workflow?.gapToleranceDays === 'number'
      ? orderedPackage.workflow.gapToleranceDays
      : null;

  // Group package services by functionality type so each section can pick
  // the most demanding scope (Rule 19).
  const servicesByType = new Map<
    ScopeFunctionalityType,
    PackageServiceWithRelations[]
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

  // Build a requirementId → { fieldKey, name, dataType } map across all
  // package services. The employment / education extractor uses this to
  // identify saved fields by their requirement metadata (Phase 7 Stage 2
  // fix — the previous fieldKey-only approach broke for packages whose
  // requirements use auto-fallback UUID-based fieldKeys, e.g. EDUCATIONV).
  const requirementMetadata = new Map<string, RequirementMetadata>();
  for (const ps of orderedPackage.packageServices) {
    const reqs = ps.service?.serviceRequirements ?? [];
    for (const sr of reqs) {
      const r = sr.requirement;
      if (!r) continue;
      const fieldKey = typeof r.fieldKey === 'string' ? r.fieldKey : '';
      const name = typeof r.name === 'string' ? r.name : '';
      const fieldData = (r.fieldData as { dataType?: unknown } | null) ?? {};
      const dataType =
        typeof fieldData.dataType === 'string' ? fieldData.dataType : '';
      requirementMetadata.set(sr.requirementId, { fieldKey, name, dataType });
    }
  }

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

  return {
    kind: 'ok',
    invitation: invitation as InvitationWithPackage,
    orderedPackage,
    formData,
    sectionsData,
    sectionVisits,
    reviewVisitedAt,
    gapToleranceDays,
    servicesByType,
    requirementMetadata,
    lockedValues,
    findMappings,
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
//
// The closure captures this module's `prisma` import (Stage 3a §1.1). Vitest's
// global `vi.mock('@/lib/prisma', ...)` is module-shared, so test mocks resolve
// to the same singleton whether the engine or the loader holds the reference.
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
