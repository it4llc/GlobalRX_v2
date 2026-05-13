// /GlobalRX_v2/src/lib/candidate/validation/packageScopeShape.ts
//
// Phase 7 Stage 1 — single source of truth for the PackageService.scope JSON
// shape and its mapping to the normalized scope-type strings already emitted
// by /api/candidate/application/[token]/scope/route.ts.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 13, Rule 19, DoD 16)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.6
//
// Why this file exists:
//   The existing /scope endpoint already inlines a mapping from the raw
//   package_services.scope JSON to a normalized scopeType. The Phase 7
//   validation engine needs the SAME mapping. Duplicating it would create a
//   drift hazard. So both the route and the engine import from here.
//
// IMPORTANT: this file does NOT do any I/O. It is a pure helper module.

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

// The shape stored in package_services.scope (Prisma `Json?` column). Phase 6
// already accepts these `type` values; Phase 7 must not invent new ones.
export interface RawPackageServiceScope {
  type?: string;
  quantity?: number;
  years?: number;
}

// The normalized scope-type strings already returned by the /scope endpoint.
// `count_exact`              — exactly 1 entry (e.g., "current address",
//                              "most recent")
// `count_specific`           — exactly N entries (e.g., "last 3 addresses",
//                              "most recent 2 jobs")
// `time_based`               — entries must collectively cover the past N
//                              years
// `highest_degree`           — single highest degree post-HS
// `highest_degree_inc_hs`    — single highest degree including HS
// `all_degrees`              — every degree post-HS
// `all`                      — at least one entry, no upper limit
export type NormalizedScopeType =
  | 'count_exact'
  | 'count_specific'
  | 'time_based'
  | 'highest_degree'
  | 'highest_degree_inc_hs'
  | 'all_degrees'
  | 'all';

export interface ResolvedScope {
  scopeType: NormalizedScopeType;
  scopeValue: number | null;
}

// The functionality types the candidate portal cares about. Education and
// employment use degree-style scopes; record (address history) uses
// count/time-based scopes only. Identity verification (verification-idv)
// joins the union as a fourth member after the verification-idv-conversion
// (docs/specs/verification-idv-conversion.md BR 15 / Decision 4) — it has
// no user-facing scope picker; scope is fixed at count_exact 1.
export type ScopeFunctionalityType =
  | 'verification-edu'
  | 'verification-emp'
  | 'verification-idv'
  | 'record';

// ---------------------------------------------------------------------------
// normalizeRawScope
// ---------------------------------------------------------------------------

/**
 * Convert a raw package_services.scope JSON value into the normalized
 * { scopeType, scopeValue } shape used by validation and by the /scope
 * endpoint.
 *
 * Defaults:
 *   - verification-idv (any scope) → count_exact 1 (BR 15 — IDV always
 *                                    means "exactly one entry,"
 *                                    regardless of stored shape).
 *   - record + null scope         → count_exact 1 (current address)
 *   - non-record + null scope     → all
 *
 * Rationale (record default):
 *   Phase 6 Stage 3 ships a default scope-selector UI showing "Current
 *   address only" as the unsaved default. We mirror that effective default
 *   here so the candidate sees the same scope the customer admin saw.
 *
 * Rationale (verification-idv early-return):
 *   IDV has no scope picker. The package builder UI auto-sets scope to
 *   {type:'count_exact',quantity:1}, the data migration normalizes any
 *   pre-existing rows to the same shape, and this defensive early-return
 *   guarantees that even a migration-missed row resolves correctly. See
 *   docs/specs/verification-idv-conversion.md BR 15 / Edge Case 2.
 */
export function normalizeRawScope(
  raw: RawPackageServiceScope | null,
  functionalityType: ScopeFunctionalityType,
): ResolvedScope {
  // Verification-idv always resolves to count_exact 1, regardless of the
  // stored raw scope. This early-return is defensive (BR 15): even if a
  // stale row somehow held an edu/emp/time-based shape, IDV must always
  // mean "exactly one entry."
  if (functionalityType === 'verification-idv') {
    return { scopeType: 'count_exact', scopeValue: 1 };
  }

  const isRecord = functionalityType === 'record';

  // Degree-specific scope types are only meaningful for verification-edu.
  // For record / verification-emp, treat them as if no scope were set.
  const isDegreeScope =
    raw &&
    (raw.type === 'highest-degree' ||
      raw.type === 'highest-degree-inc-highschool' ||
      raw.type === 'all-degrees');
  const isDegreeOnNonEdu = isDegreeScope && functionalityType !== 'verification-edu';

  if (!raw || isDegreeOnNonEdu) {
    return isRecord
      ? { scopeType: 'count_exact', scopeValue: 1 }
      : { scopeType: 'all', scopeValue: null };
  }

  switch (raw.type) {
    case 'current-address':
      return { scopeType: 'count_exact', scopeValue: 1 };

    case 'last-x-addresses':
      // quantity is required for this shape; if missing fall through to `all`.
      if (typeof raw.quantity === 'number') {
        return { scopeType: 'count_specific', scopeValue: raw.quantity };
      }
      return { scopeType: 'all', scopeValue: null };

    case 'most-recent':
      return { scopeType: 'count_exact', scopeValue: 1 };

    case 'most-recent-x':
      if (typeof raw.quantity === 'number') {
        return { scopeType: 'count_specific', scopeValue: raw.quantity };
      }
      return { scopeType: 'all', scopeValue: null };

    case 'past-x-years':
      if (typeof raw.years === 'number') {
        return { scopeType: 'time_based', scopeValue: raw.years };
      }
      return { scopeType: 'all', scopeValue: null };

    case 'highest-degree':
      return { scopeType: 'highest_degree', scopeValue: 1 };

    case 'highest-degree-inc-highschool':
      return { scopeType: 'highest_degree_inc_hs', scopeValue: 1 };

    case 'all-degrees':
      return { scopeType: 'all_degrees', scopeValue: null };

    default:
      // Unknown shape — fall back to `all` to avoid blocking the candidate.
      return isRecord
        ? { scopeType: 'count_exact', scopeValue: 1 }
        : { scopeType: 'all', scopeValue: null };
  }
}

// ---------------------------------------------------------------------------
// pickMostDemandingScope (Rule 19 / DoD 16)
// ---------------------------------------------------------------------------

// Numeric "demand" rank used purely to compare scope types. Higher = more
// demanding. Among same-type scopes the larger scopeValue wins. For mixed
// types: time-based always beats count-based (Rule 19); count-based beats
// `all`; degree-style scopes are not compared head-to-head with count/time
// scopes (they live on different functionality types).
const TYPE_DEMAND_RANK: Record<NormalizedScopeType, number> = {
  // `all` is the least demanding — only requires at least one entry.
  all: 0,
  // Degree scopes are degree-only and shouldn't appear alongside count/time.
  // Place them at the same low rank as `all` so any comparison that does
  // accidentally reach them prefers a real count/time scope.
  all_degrees: 1,
  highest_degree: 1,
  highest_degree_inc_hs: 1,
  // Count-based: more demanding than `all`, less demanding than time-based.
  count_exact: 2,
  count_specific: 2,
  // Time-based always wins (Rule 19): "If the scopes are different types,
  // always use the time-based scope since it is more comprehensive."
  time_based: 3,
};

/**
 * Pick the most demanding scope from an array of resolved scopes.
 *
 * - If the array is empty, returns a default `{ scopeType: 'all', scopeValue: null }`.
 * - If two scopes share the same type, the one with the larger scopeValue
 *   wins (e.g., 7 years beats 5 years; 5 entries beats 3 entries).
 * - If types differ, the type with the higher demand rank wins (time-based >
 *   count > all).
 */
export function pickMostDemandingScope(scopes: ResolvedScope[]): ResolvedScope {
  if (scopes.length === 0) {
    return { scopeType: 'all', scopeValue: null };
  }

  // Seed the reducer with the first element so TypeScript can infer the
  // accumulator type without an explicit initial value (which would conflict
  // with the strict-mode reduce overload selection).
  return scopes.slice(1).reduce<ResolvedScope>((winner, candidate) => {
    const winnerRank = TYPE_DEMAND_RANK[winner.scopeType];
    const candidateRank = TYPE_DEMAND_RANK[candidate.scopeType];

    if (candidateRank > winnerRank) {
      return candidate;
    }
    if (candidateRank < winnerRank) {
      return winner;
    }

    // Same rank — pick the larger scopeValue. Treat null as 0 so a numeric
    // value always beats null (e.g., count_specific 3 beats count_exact 1
    // would not happen since they share rank 2; but null-vs-number safety
    // matters when an `all` scope ever gets compared against another `all`).
    const winnerValue = winner.scopeValue ?? 0;
    const candidateValue = candidate.scopeValue ?? 0;
    return candidateValue > winnerValue ? candidate : winner;
  }, scopes[0]);
}
