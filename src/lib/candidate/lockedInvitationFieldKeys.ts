// /GlobalRX_v2/src/lib/candidate/lockedInvitationFieldKeys.ts
//
// Shared source of truth for the fieldKeys that are sourced from the
// candidate invitation columns (firstName, lastName, email, phone,
// phoneNumber). These fields are never editable by the candidate and are
// always pre-filled from the invitation, so the Personal Info form, the
// validator, and the cross-section registry must agree to exclude them.
//
// Spec: docs/specs/cross-section-validation-filtering-bugfix.md
//       (Business Rules 2 and 3 — banner/asterisk/validator consistency)
//
// Consumers:
//   - src/app/api/candidate/application/[token]/personal-info-fields/route.ts
//   - src/lib/candidate/validation/personalInfoIdvFieldChecks.ts
//   - src/lib/candidate/addressHistoryStage4Wiring.ts
//
// The list mirrors Task 8.3 spec Business Rule 6.

export const LOCKED_INVITATION_FIELD_KEYS: ReadonlySet<string> = new Set<string>([
  'firstName',
  'lastName',
  'email',
  'phone',
  'phoneNumber',
]);

export function isLockedInvitationFieldKey(fieldKey: string): boolean {
  return LOCKED_INVITATION_FIELD_KEYS.has(fieldKey);
}

// Wider Personal Info fieldKey set — mirrors the heuristic in
// `personal-info-fields/route.ts:170-171` and `personalInfoIdvFieldChecks.ts`
// `PERSONAL_INFO_FIELD_KEYS`. A requirement whose fieldKey lives in this set
// is treated as collected on Personal Info regardless of whether its
// `fieldData.collectionTab` is also set. Without this set, requirements that
// happen to use a PI-style fieldKey but lack an explicit collectionTab
// (e.g. legacy/imported DSX rows) fall through the validator's
// collectionTab-only filter and get walked as per-entry fields on Address
// History — where they cannot be found because the candidate fills them in
// on Personal Info. That mismatch is the root cause of the Address History
// "stays red even when everything is filled" symptom in
// docs/specs/cross-section-validation-filtering-bugfix.md Bug A.
export const PERSONAL_INFO_FIELD_KEYS: ReadonlySet<string> = new Set<string>([
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

export function isPersonalInfoFieldKey(fieldKey: string): boolean {
  return PERSONAL_INFO_FIELD_KEYS.has(fieldKey);
}
