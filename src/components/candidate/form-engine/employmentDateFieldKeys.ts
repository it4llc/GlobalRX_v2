// /GlobalRX_v2/src/components/candidate/form-engine/employmentDateFieldKeys.ts
//
// Shared fieldKey alias sets for employment date detection. Extracted from
// EmploymentSection.tsx so the validation engine (dateExtractors.ts) and the
// section component stay in lockstep — a single source of truth for
// "which fieldKey identifies a start date / end date / currentlyEmployed flag."
//
// Why these alias sets exist:
//   The DSXRequirement.fieldKey is an immutable camelCase identifier, but
//   different package configurations have used different camelCase / snake_case
//   spellings historically. We accept the documented aliases here so any
//   correctly-configured package — past or present — works without code changes.
//
// Display labels are localized, so name-based matching breaks for non-English
// configurations. Substring matching also risks unrelated fields like
// "noncurrentlyemployed" — these helpers use exact fieldKey matches.

export const CURRENTLY_EMPLOYED_FIELD_KEYS: ReadonlySet<string> = new Set([
  'currentlyEmployed',
  'isCurrent',
  'isCurrentlyEmployed',
  'currentEmployment',
  'current_employment',
  'currently_employed',
  'is_current',
  'is_currently_employed',
]);

export const END_DATE_FIELD_KEYS: ReadonlySet<string> = new Set([
  'endDate',
  'toDate',
  'end_date',
  'to_date',
  'dateTo',
  'date_to',
]);

export const START_DATE_FIELD_KEYS: ReadonlySet<string> = new Set([
  'startDate',
  'fromDate',
  'start_date',
  'from_date',
  'dateFrom',
  'date_from',
]);
