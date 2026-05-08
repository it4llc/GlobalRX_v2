// /GlobalRX_v2/src/lib/candidate/submission/buildOrderSubject.ts
//
// Phase 7 Stage 2 — pure helper that translates the candidate's saved
// Personal Info section plus the locked invitation columns into the
// `Order.subject` JSON value.
//
// `Order.subject` is a Json column (see prisma/schema.prisma — the column
// type is `Json`). We return a plain object keyed by DSXRequirement.fieldKey;
// the caller is responsible for handing the value to Prisma as the
// subject's update payload.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §16
//
// Coverage:
//   - Spec Rule 12 / Plan §16:        Personal info fields written to
//                                     Order.subject keyed by fieldKey.
//   - Plan §16 step 1:                Locked fields sourced from the
//                                     invitation columns; phone is
//                                     phoneCountryCode + phoneNumber.
//   - Plan §16 step 1 (defense):      Phone key omitted entirely when
//                                     invitation.phoneNumber is missing.
//   - Plan §16 step 3:                Locked fieldKeys appearing in saved
//                                     personal info do NOT override the
//                                     invitation values (defense in depth).

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Minimal shape of the CandidateInvitation columns the helper reads.
 * Avoids dragging the full Prisma model into the helper's surface so it
 * can be unit-tested with plain objects.
 */
export interface InvitationLockedFields {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
}

/**
 * One saved field on the Personal Info section. Same shape as the validation
 * engine's SavedField (`{ requirementId, value }`).
 */
export interface SavedPersonalInfoField {
  requirementId: string;
  value: unknown;
}

export interface SavedPersonalInfoSection {
  fields: SavedPersonalInfoField[];
}

/**
 * Lookup row used to translate a saved field's `requirementId` to its
 * stable `fieldKey`. Keyed by id; built once at the top of
 * `submitApplication`.
 */
export interface DsxRequirementSubjectLookup {
  id: string;
  fieldKey: string;
}

interface BuildOrderSubjectInput {
  personalInfoSection: SavedPersonalInfoSection;
  invitation: InvitationLockedFields;
  dsxRequirementsLookup: Map<string, DsxRequirementSubjectLookup>;
}

// ---------------------------------------------------------------------------
// Locked-field defense
// ---------------------------------------------------------------------------

// Defense-in-depth (Plan §16 step 3): if a saved Personal Info field's
// fieldKey collides with one of these locked fields, the saved value is
// IGNORED and the invitation value wins. The save endpoint already filters
// these out, but the defensive skip prevents accidental override if a
// future bug regresses that filter.
const LOCKED_FIELD_KEYS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  // `phoneNumber` is also blocked because the locked phone value lives on
  // `phone` only (Plan §16 step 1) — a saved `phoneNumber` field would be
  // a separate, unrelated key that could be confused with the lock.
  'phoneNumber',
]);

// ---------------------------------------------------------------------------
// buildOrderSubject — public entry point
// ---------------------------------------------------------------------------

/**
 * Build the `Order.subject` JSON value.
 *
 * Step 1: Seed with the locked fields from the invitation
 *         (firstName / lastName / email / phone). The phone key is the
 *         concatenation `phoneCountryCode + phoneNumber`. When
 *         phoneCountryCode is null we use phoneNumber alone. When
 *         phoneNumber itself is null/empty, the phone key is OMITTED
 *         entirely (Plan §16 step 1).
 *
 * Step 2: Walk the saved Personal Info fields. For each one whose
 *         requirementId is in the lookup, set `subject[fieldKey] = value`.
 *         Values are stored as-is — `Order.subject` is a JSON column, so
 *         objects and arrays do NOT need to be JSON-stringified.
 *
 * Step 3: Skip any saved field whose fieldKey is in the locked set —
 *         the invitation value wins (defense in depth).
 */
export function buildOrderSubject(
  input: BuildOrderSubjectInput,
): Record<string, unknown> {
  const { personalInfoSection, invitation, dsxRequirementsLookup: lookup } = input;

  const subject: Record<string, unknown> = {
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    email: invitation.email,
  };

  // Phone — only emit the key when we have a number. Country code is
  // optional and concatenated when present.
  if (invitation.phoneNumber !== null && invitation.phoneNumber !== '') {
    const cc = invitation.phoneCountryCode ?? '';
    subject.phone = `${cc}${invitation.phoneNumber}`;
  }

  // Step 2 + Step 3 combined — translate saved fields, dropping any whose
  // fieldKey collides with a locked invitation field.
  for (const field of personalInfoSection.fields) {
    const requirement = lookup.get(field.requirementId);
    if (!requirement) {
      // Saved field has no corresponding DSX requirement in the lookup —
      // skip rather than write a key with no defined name.
      continue;
    }
    if (LOCKED_FIELD_KEYS.has(requirement.fieldKey)) {
      // Defense in depth — invitation value wins for locked fields.
      continue;
    }
    subject[requirement.fieldKey] = field.value;
  }

  return subject;
}
