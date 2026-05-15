// /GlobalRX_v2/src/constants/functionality-types.ts

/**
 * Service.functionalityType allow-list
 *
 * The DB column type is `String @default("other")` — there is no enum at
 * the database level. This module is the application-side single source
 * of truth: every API route that validates `functionalityType`, every UI
 * dropdown that shows it, and every seed that writes it imports from
 * here.
 *
 * Order matters: this is the order used by the admin Services UI dropdown
 * and by the structure endpoint's service-section ordering on the
 * candidate portal. IDV is first (the candidate sees it first in the
 * sidebar), then record (address history), then the two non-idv
 * verifications, then `other`.
 *
 * After verification-idv-conversion (docs/specs/verification-idv-conversion.md)
 * the bare string `'idv'` no longer appears here.
 */
export const FUNCTIONALITY_TYPES = [
  'verification-idv',
  'record',
  'verification-edu',
  'verification-emp',
  'other',
] as const;

// TypeScript union derived from the readonly tuple above. Used by API
// validation, UI dropdowns, and any caller that needs to narrow a string
// to the allow-list at compile time.
export type FunctionalityType = (typeof FUNCTIONALITY_TYPES)[number];

/**
 * Type-guard helper; mirrors `isValidServiceStatus` in service-status.ts.
 *
 * Returning a type predicate (`value is FunctionalityType`) — rather than
 * just `boolean` — lets callers narrow a `string` into the union after a
 * successful check. The API routes rely on this narrowing to avoid a
 * second cast when persisting the value.
 */
export function isValidFunctionalityType(
  value: string,
): value is FunctionalityType {
  return (FUNCTIONALITY_TYPES as readonly string[]).includes(value);
}
