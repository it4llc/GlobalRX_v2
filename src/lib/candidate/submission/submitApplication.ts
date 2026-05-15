// /GlobalRX_v2/src/lib/candidate/submission/submitApplication.ts
//
// Phase 7 Stage 2 — core submission orchestrator. Runs INSIDE the submit
// route's `prisma.$transaction` and owns every database write that turns a
// draft application into a submitted order.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §12
//
// Sequence (all inside one transaction):
//   1. Re-read invitation + order + package services. Throw
//      AlreadySubmittedError if state shifted underneath us.
//   2. Build Order.subject from saved Personal Info + invitation columns.
//   3. Generate OrderItem keys (records + edu + emp + idv).
//   4. Create OrderItem + ServicesFulfillment for each key (replicating the
//      addOrderItem transactional pattern; see Plan §12 Step 4 rationale).
//   5. Insert OrderData rows for each created OrderItem.
//   6. Resolve / upsert the system comment template.
//   7. Insert one ServiceComment per OrderItem.
//   8. Update the Order (statusCode, submittedAt, subject).
//   9. Insert OrderStatusHistory.
//  10. Update CandidateInvitation (status='completed', completedAt).
//  11. Return.
//
// `formData` is NOT modified. (Spec Rule 23.)
//
// Logger event prefix: candidate_submit_*. No PII is ever logged.

import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { ORDER_STATUSES } from '@/constants/order-status';
import { SERVICE_STATUSES } from '@/constants/service-status';
import {
  normalizeRawScope,
  type RawPackageServiceScope,
} from '@/lib/candidate/validation/packageScopeShape';

import {
  buildEduEmpOrderItemKeys,
  buildIdvOrderItemKeys,
  buildRecordOrderItemKeys,
  dedupeOrderItemKeys,
} from './orderItemGeneration';
import {
  buildOrderDataRows,
  type DsxRequirementLookup,
  type OrderDataRow,
} from './orderDataPopulation';
import {
  buildOrderSubject,
  type DsxRequirementSubjectLookup,
} from './buildOrderSubject';
import type {
  EduEmpEntryForKeys,
  OrderItemKey,
  SavedAddressHistorySection,
  SavedEduEmpSection,
  SavedField,
  SavedIdvSection,
  SavedRepeatableEntry,
  SubmissionAddressScope,
} from './types';

// ---------------------------------------------------------------------------
// Sentinel error — caught by the route layer to return the idempotent
// already-submitted response instead of a 500.
// ---------------------------------------------------------------------------

export class AlreadySubmittedError extends Error {
  constructor(message: string = 'Application has already been submitted') {
    super(message);
    this.name = 'AlreadySubmittedError';
  }
}

// ---------------------------------------------------------------------------
// Submission status (lowercase per project standard) — all status values
// must come from ORDER_STATUSES per DATABASE_STANDARDS S5.2.
// ---------------------------------------------------------------------------

const STATUS_DRAFT = ORDER_STATUSES.DRAFT;
const STATUS_SUBMITTED = ORDER_STATUSES.SUBMITTED;

// ---------------------------------------------------------------------------
// Public input / output shapes
// ---------------------------------------------------------------------------

export interface SubmitApplicationResult {
  orderId: string;
  orderItemIds: string[];
  // Number of OrderData rows inserted, primarily for log/audit.
  orderDataRowCount: number;
}

// ---------------------------------------------------------------------------
// Internal saved-data parsers
// ---------------------------------------------------------------------------

interface CandidateFormDataShape {
  sections?: Record<string, RawSectionData>;
  // sectionVisits / reviewPageVisitedAt are read by the validation engine,
  // not by this service.
  [key: string]: unknown;
}

interface RawSectionData {
  type?: string;
  fields?: Array<{ requirementId: string; value: unknown }>;
  entries?: Array<{
    entryId: string;
    countryId: string | null;
    entryOrder: number;
    fields: Array<{ requirementId: string; value: unknown }>;
  }>;
  aggregatedFields?: Record<string, unknown>;
  // Task 8.4: the record_search bucket stores its values under `fieldValues`
  // (whole-object replacement) and is the post-split source of truth for
  // what `aggregatedFields` used to mean at submission time.
  fieldValues?: Record<string, unknown>;
}

function readPersonalInfoFields(
  formData: CandidateFormDataShape,
): SavedField[] {
  const section = formData.sections?.['personal_info'];
  return (section?.fields ?? []).map((f) => ({
    requirementId: f.requirementId,
    value: f.value,
  }));
}

function readAddressHistorySection(
  formData: CandidateFormDataShape,
): SavedAddressHistorySection {
  const section = formData.sections?.['address_history'];
  // Task 8.4 — Record Search Requirements submission read (split out of
  // Address History's aggregated block). Pre-authorized for submitApplication
  // edit despite the file being over the 600-LOC hard stop; see plan §4.10.
  // Task 8.4: Record Search Requirements is the post-split source of truth
  // for the deduplicated additional fields and aggregated documents that
  // used to live at the bottom of Address History. submitApplication
  // populates the existing `aggregatedFields` output field — which the
  // orderDataPopulation contract still expects — from
  // `formData.sections.record_search.fieldValues`. The legacy
  // `address_history.aggregatedFields` bucket is intentionally ignored
  // (plan §11.1 — no backward-compatibility reads).
  const recordSearch = formData.sections?.['record_search'];
  return {
    entries: (section?.entries ?? []).map((e) => ({
      entryId: e.entryId,
      countryId: e.countryId ?? null,
      entryOrder: e.entryOrder,
      fields: e.fields.map((f) => ({
        requirementId: f.requirementId,
        value: f.value,
      })),
    })),
    aggregatedFields: recordSearch?.fieldValues ?? undefined,
  };
}

function readEduEmpSection(
  formData: CandidateFormDataShape,
  bucketKey: string,
): SavedEduEmpSection {
  const section = formData.sections?.[bucketKey];
  return {
    entries: (section?.entries ?? []).map((e) => ({
      entryId: e.entryId,
      countryId: e.countryId ?? null,
      entryOrder: e.entryOrder,
      fields: e.fields.map((f) => ({
        requirementId: f.requirementId,
        value: f.value,
      })),
    })),
  };
}

function readIdvSection(
  formData: CandidateFormDataShape,
): SavedIdvSection {
  // The IdvSection saves under sectionId='idv' (NOT 'service_idv') — see
  // IdvSection.tsx. This is the same key the TD-062 fix reads.
  const section = formData.sections?.['idv'];
  return {
    fields: (section?.fields ?? []).map((f) => ({
      requirementId: f.requirementId,
      value: f.value,
    })),
  };
}

const IDV_COUNTRY_MARKER = 'idv_country';

function readIdvCountryId(idv: SavedIdvSection): string | null {
  for (const f of idv.fields) {
    if (f.requirementId === IDV_COUNTRY_MARKER) {
      return typeof f.value === 'string' && f.value.length > 0 ? f.value : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// submitApplication — entry point
//
// Parameters:
//   tx: Prisma transaction client. The route opens the transaction and
//       passes it in. Every write below uses this client.
//   invitationId: id of the invitation being submitted.
//   today: Date captured once at the route. Used for `submittedAt`,
//          `completedAt`, and the time-based scope filter.
// ---------------------------------------------------------------------------

export async function submitApplication(
  tx: Prisma.TransactionClient,
  invitationId: string,
  today: Date,
): Promise<SubmitApplicationResult> {
  // ---- Step 1: Re-read inside the transaction ----------------------------
  const invitation = await tx.candidateInvitation.findUnique({
    where: { id: invitationId },
    include: {
      order: true,
      package: {
        include: {
          packageServices: {
            include: { service: true },
          },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error(`Invitation not found: ${invitationId}`);
  }
  if (invitation.status === INVITATION_STATUSES.COMPLETED) {
    throw new AlreadySubmittedError();
  }
  if (invitation.order.statusCode !== STATUS_DRAFT) {
    throw new AlreadySubmittedError();
  }

  const orderedPackage = invitation.package;
  if (!orderedPackage) {
    // Defensive — the invitation always has a package per the schema, but
    // the include can in principle return null if the relation row was
    // deleted out from under us.
    throw new Error(`Invitation ${invitationId} has no package`);
  }

  const formData =
    (invitation.formData as unknown as CandidateFormDataShape) ?? {};

  const packageServices = orderedPackage.packageServices;

  // ---- Build the DSXRequirement lookup (one query) -----------------------
  // We need three columns from each DSXRequirement: id, fieldKey, type, and
  // fieldData. Used by buildOrderSubject (fieldKey only) and
  // buildOrderDataRows (type + fieldData.dataType for fieldType derivation).
  //
  // Why one query: Personal Info / Address History / Edu / Emp / IDV all
  // share DSX requirements through service_requirements; loading the full
  // requirement set up-front (rather than per-section) avoids repeated
  // round-trips inside the transaction.
  const allRequirementIds = await collectAllRequirementIds(tx, packageServices);
  const requirementsRaw =
    allRequirementIds.length > 0
      ? await tx.dSXRequirement.findMany({
          where: { id: { in: allRequirementIds } },
          select: { id: true, fieldKey: true, type: true, fieldData: true },
        })
      : [];

  const subjectLookup = new Map<string, DsxRequirementSubjectLookup>();
  const orderDataLookup = new Map<string, DsxRequirementLookup>();
  for (const r of requirementsRaw) {
    subjectLookup.set(r.id, { id: r.id, fieldKey: r.fieldKey });
    orderDataLookup.set(r.id, {
      id: r.id,
      // Only 'field' / 'document' are used downstream; coerce defensively.
      type: r.type === 'document' ? 'document' : 'field',
      fieldData: (r.fieldData as { dataType?: string } | null) ?? null,
    });
  }

  // ---- Step 2: Build Order.subject ---------------------------------------
  const subject = buildOrderSubject({
    personalInfoSection: { fields: readPersonalInfoFields(formData) },
    invitation: {
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      email: invitation.email,
      phoneCountryCode: invitation.phoneCountryCode,
      phoneNumber: invitation.phoneNumber,
    },
    dsxRequirementsLookup: subjectLookup,
  });

  // ---- Step 3: Generate OrderItem keys -----------------------------------
  const addressHistory = readAddressHistorySection(formData);
  const education = readEduEmpSection(formData, 'education');
  const employment = readEduEmpSection(formData, 'employment');
  const idv = readIdvSection(formData);
  const idvCountryId = readIdvCountryId(idv);

  // Address-block requirement id — discovered the same way the validation
  // engine does it (object-with-fromDate/toDate/isCurrent heuristic). When
  // there are no address entries, we don't need it.
  const addressBlockReqId = inferAddressBlockRequirementId(
    addressHistory.entries,
  );

  // Record services + their resolved scopes.
  const recordPackageServices = packageServices
    .filter((ps) => ps.service?.functionalityType === 'record')
    .map((ps) => ({
      serviceId: ps.service.id,
      scope: toSubmissionScope(ps.scope as RawPackageServiceScope | null),
    }));

  // DSX availability lookup — single bulk query for all record services.
  const recordServiceIds = recordPackageServices.map((ps) => ps.serviceId);
  let availability = new Map<string, true>();
  if (recordServiceIds.length > 0 && addressHistory.entries.length > 0) {
    const rows = await tx.dSXAvailability.findMany({
      where: {
        serviceId: { in: recordServiceIds },
        isAvailable: true,
      },
      select: { serviceId: true, locationId: true },
    });
    availability = new Map<string, true>();
    for (const r of rows) {
      availability.set(`${r.serviceId}:${r.locationId}`, true);
    }
  }

  // Pieces of the OrderItemKey list. We dedupe records via
  // buildRecordOrderItemKeys (which calls dedupeOrderItemKeys internally);
  // edu/emp/idv don't get deduped (Plan §13.4 — record-only).
  const recordKeys =
    addressBlockReqId !== null && recordPackageServices.length > 0
      ? buildRecordOrderItemKeys(
          recordPackageServices,
          addressHistory.entries,
          availability,
          today,
          addressBlockReqId,
        )
      : [];

  const eduServiceIds = packageServices
    .filter((ps) => ps.service?.functionalityType === 'verification-edu')
    .map((ps) => ps.service.id);
  const empServiceIds = packageServices
    .filter((ps) => ps.service?.functionalityType === 'verification-emp')
    .map((ps) => ps.service.id);
  const idvServiceIds = packageServices
    .filter((ps) => ps.service?.functionalityType === 'verification-idv')
    .map((ps) => ps.service.id);

  const eduKeys = buildEduEmpOrderItemKeys(
    eduServiceIds,
    education.entries.map(toEduEmpKeyEntry),
    'education',
  );
  const empKeys = buildEduEmpOrderItemKeys(
    empServiceIds,
    employment.entries.map(toEduEmpKeyEntry),
    'employment',
  );
  const idvKeys = buildIdvOrderItemKeys(idvServiceIds, idvCountryId);

  // Log skipped edu/emp entries (Plan §14.1 / §14.2 safety belt). The
  // helper itself silently drops them; we surface a warn here so the
  // operator can investigate validation drift.
  warnOnSkippedEduEmp(invitation.id, education.entries, 'edu');
  warnOnSkippedEduEmp(invitation.id, employment.entries, 'emp');

  const allKeys: OrderItemKey[] = [
    ...recordKeys,
    ...eduKeys,
    ...empKeys,
    ...idvKeys,
  ];

  // Final dedupe is a no-op for edu/emp/idv (per construction) but cheap
  // insurance against future helper changes.
  const finalKeys = dedupeKeysWithinSameKind(allKeys);

  // ---- Step 6: Resolve the system comment template -----------------------
  // Done EARLY (per Plan §12 Step 6) so the Step 7 ServiceComment loop has
  // it ready. If neither 'System' nor 'General' exists, create a 'System'
  // template inside the same transaction. The unique on
  // (shortName, isActive) means re-running the lookup from a parallel
  // submission cannot duplicate the row.
  const template = await resolveSystemCommentTemplate(tx);

  // ---- Step 4: Create OrderItem + ServicesFulfillment for each key -------
  // We replicate OrderCoreService.addOrderItem's transactional pattern
  // inline (Plan §12 Step 4 rationale): the static helper opens its own
  // transaction, which we cannot nest. Status is 'submitted' because the
  // parent order is about to flip in Step 8.
  const createdItems: Array<{
    orderItemId: string;
    key: OrderItemKey;
  }> = [];

  for (const key of finalKeys) {
    const orderItem = await tx.orderItem.create({
      data: {
        orderId: invitation.order.id,
        serviceId: key.serviceId,
        locationId: key.locationId,
        status: SERVICE_STATUSES.SUBMITTED,
      },
      select: { id: true },
    });
    await tx.servicesFulfillment.create({
      data: {
        orderId: invitation.order.id,
        orderItemId: orderItem.id,
        serviceId: key.serviceId,
        locationId: key.locationId,
        // assignedVendorId is explicitly null per DATABASE_STANDARDS §2.2
        // rule 2 — vendor assignment happens later, not at submission.
        assignedVendorId: null,
      },
    });
    createdItems.push({ orderItemId: orderItem.id, key });
  }

  // ---- Step 5: Insert OrderData rows for each new OrderItem --------------
  let orderDataRowCount = 0;
  for (const { orderItemId, key } of createdItems) {
    const rows: OrderDataRow[] = buildOrderDataRows({
      orderItemId,
      source: key.source,
      addressHistorySection: addressHistory,
      educationSection: education,
      employmentSection: employment,
      idvSection: idv,
      dsxRequirementsLookup: orderDataLookup,
    });
    if (rows.length > 0) {
      await tx.orderData.createMany({ data: rows });
      orderDataRowCount += rows.length;
    }
  }

  // ---- Step 7: One ServiceComment per OrderItem --------------------------
  // The candidate is not a User row; we attribute the comment to the staff
  // user who created the invitation (invitation.createdBy). This keeps the
  // FK valid and gives a coherent system identity for the audit trail.
  for (const { orderItemId } of createdItems) {
    await tx.serviceComment.create({
      data: {
        orderItemId,
        templateId: template.id,
        finalText: 'Order item created from candidate application submission',
        isInternalOnly: false,
        isStatusChange: false,
        createdBy: invitation.createdBy,
      },
    });
  }

  // ---- Step 8: Update Order ---------------------------------------------
  await tx.order.update({
    where: { id: invitation.order.id },
    data: {
      statusCode: STATUS_SUBMITTED,
      submittedAt: today,
      // `subject` is a Json column (schema.prisma:338). Prisma accepts a
      // plain object. We ALWAYS set it — even when the candidate has no
      // saved Personal Info — because buildOrderSubject seeds the locked
      // fields from the invitation, so subject is never empty.
      subject: subject as Prisma.InputJsonValue,
    },
  });

  // ---- Step 9: OrderStatusHistory ---------------------------------------
  await tx.orderStatusHistory.create({
    data: {
      orderId: invitation.order.id,
      fromStatus: STATUS_DRAFT,
      toStatus: STATUS_SUBMITTED,
      changedBy: invitation.createdBy,
      isAutomatic: true,
      notes: 'Candidate submitted application',
      // eventType has a default of 'status_change' but we set it explicitly
      // for documentation purposes (Plan §12 Step 9).
      eventType: 'status_change',
    },
  });

  // ---- Step 10: Update CandidateInvitation -------------------------------
  // Spec wording is "in_progress → completed"; the actual codebase uses
  // INVITATION_STATUSES.ACCESSED. We don't assert on the source value —
  // we only guarantee the destination is `completed`.
  await tx.candidateInvitation.update({
    where: { id: invitation.id },
    data: {
      status: INVITATION_STATUSES.COMPLETED,
      completedAt: today,
    },
  });

  return {
    orderId: invitation.order.id,
    orderItemIds: createdItems.map((c) => c.orderItemId),
    orderDataRowCount,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Walk the package's services and collect every requirementId we need to
 * look up: requirementIds appearing in any saved formData section, plus
 * everything in `serviceRequirements` for personal-info / IDV (so
 * buildOrderSubject can find a fieldKey even when the candidate skipped the
 * field — defensive, since the engine should have flagged that).
 *
 * In practice the saved-data set drives this; we union with serviceReqs to
 * cover the personal-info case where invitation columns are the only data
 * for some fields (the engine still wants to look them up by id, but
 * buildOrderSubject only writes saved values, so the union is for OrderData
 * lookup misses).
 */
async function collectAllRequirementIds(
  tx: Prisma.TransactionClient,
  packageServices: Array<{ serviceId: string }>,
): Promise<string[]> {
  if (packageServices.length === 0) return [];
  const serviceIds = packageServices.map((ps) => ps.serviceId);
  const rows = await tx.serviceRequirement.findMany({
    where: { serviceId: { in: serviceIds } },
    select: { requirementId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.requirementId);
  return Array.from(ids);
}

/**
 * Translate the validation engine's RawPackageServiceScope into the
 * narrower SubmissionAddressScope shape the order-item generator expects.
 *
 * For record services we always normalize against the 'record' functionality
 * type. The submission-side scope is per-package-service (each service gets
 * its own scope), unlike the validation engine which uses
 * pickMostDemandingScope to fold a section's services together — see Plan
 * §13.5.
 *
 * Degree-style scopes do not apply to record services; if the engine ever
 * produced one we fall back to 'all' so the submission still produces order
 * items rather than skipping the service entirely.
 */
function toSubmissionScope(
  raw: RawPackageServiceScope | null,
): SubmissionAddressScope {
  const resolved = normalizeRawScope(raw, 'record');
  switch (resolved.scopeType) {
    case 'count_exact':
    case 'count_specific':
    case 'time_based':
    case 'all':
      return { scopeType: resolved.scopeType, scopeValue: resolved.scopeValue };
    default:
      return { scopeType: 'all', scopeValue: null };
  }
}

function toEduEmpKeyEntry(entry: SavedRepeatableEntry): EduEmpEntryForKeys {
  return {
    entryId: entry.entryId,
    countryId: entry.countryId,
  };
}

/**
 * Mirror of validationEngine.inferAddressBlockRequirementId. Lifted here
 * (rather than imported) so the submission service stays decoupled from the
 * engine's internals — they may diverge in future stages.
 */
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

function warnOnSkippedEduEmp(
  invitationId: string,
  entries: SavedRepeatableEntry[],
  kind: 'edu' | 'emp',
): void {
  let skipped = 0;
  for (const e of entries) {
    if (!e.countryId) skipped++;
  }
  if (skipped > 0) {
    logger.warn('Candidate submission skipped entries with no country', {
      event: `candidate_submit_skipped_${kind}_entry`,
      invitationId,
      skippedCount: skipped,
    });
  }
}

/**
 * Resolve a system comment template suitable for system-generated
 * ServiceComment rows. Lookup order (Plan §12 Step 6):
 *   1. shortName='System' active
 *   2. shortName='General' active   (e2e seed pattern)
 *   3. Create one with shortName='System' active.
 *
 * Idempotent: a parallel submission either finds the row this transaction
 * created (when a sibling commits first) or its create fails on the
 * (shortName, isActive) unique constraint and we fall back to a follow-up
 * lookup. The follow-up is cheap and only runs in the create-collision
 * case.
 */
async function resolveSystemCommentTemplate(
  tx: Prisma.TransactionClient,
): Promise<{ id: string }> {
  const existing =
    (await tx.commentTemplate.findFirst({
      where: { shortName: 'System', isActive: true },
      select: { id: true },
    })) ??
    (await tx.commentTemplate.findFirst({
      where: { shortName: 'General', isActive: true },
      select: { id: true },
    }));
  if (existing) return existing;

  try {
    const created = await tx.commentTemplate.create({
      data: {
        shortName: 'System',
        longName: 'System-generated comment',
        templateText: 'System-generated comment',
        isActive: true,
      },
      select: { id: true },
    });
    return created;
  } catch (error) {
    // P2002 on the (shortName, isActive) unique constraint — a sibling
    // transaction created the row first. Re-look-up.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const found = await tx.commentTemplate.findFirst({
        where: { shortName: 'System', isActive: true },
        select: { id: true },
      });
      if (found) return found;
    }
    throw error;
  }
}

/**
 * Final-pass dedupe. By construction:
 *   - record keys are already deduped inside buildRecordOrderItemKeys.
 *   - edu/emp keys are intentionally per-entry-per-service and may
 *     legitimately share (serviceId, locationId) — we do NOT dedupe those.
 *   - idv keys are unique by construction (one per service).
 *
 * So this helper is a passthrough today. We keep it as a single funnel so
 * the contract is explicit: this is where any future cross-kind dedup
 * decision would live.
 */
function dedupeKeysWithinSameKind(keys: OrderItemKey[]): OrderItemKey[] {
  // Split by kind, dedupe records only, recombine in input order.
  const records: OrderItemKey[] = [];
  const others: OrderItemKey[] = [];
  for (const k of keys) {
    if (k.source.kind === 'address') records.push(k);
    else others.push(k);
  }
  const dedupedRecords = dedupeOrderItemKeys(records);
  return [...dedupedRecords, ...others];
}
