// /GlobalRX_v2/src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts
//
// TD-084 — Required-Indicator Per-Country Alignment.
//
// Spec:           docs/specs/td-084-required-indicator-per-country-alignment.md
// Technical plan: docs/plans/td-084-technical-plan.md §1.3, §1.5, §3.1.1
//
// Pure OR-fold helper for the /fields route.
//
// What it does, in brief:
//   - Takes the flat result of a batched `prisma.dSXMapping.findMany` query
//     covering every (serviceId, locationId) pair the candidate's package
//     reaches at the requested country/subregion, with the requirement record
//     included.
//   - Takes the displayOrder lookup the route built from `service_requirements`.
//   - Returns a `Map<requirementId, MergedEntry>` where `isRequired` is the
//     OR-fold across every in-scope mapping row (cross-service AND
//     cross-geographic-level dimensions collapse into a single fold).
//
// Why a separate module:
//   The OR-fold is the heart of TD-084 BR 1 + BR 2 (cross-service OR-merge and
//   geographic-hierarchy OR-merge). Keeping it in its own file lets the
//   test-writer exercise it in isolation against representative fixtures
//   without standing up a full route harness, and keeps the route handler
//   below the file-size soft trigger.
//
// TD-077 structural-re-declaration pattern:
//   The Prisma payload shape (`DsxMappingWithRequirement`) and the requirement
//   shape (`DSXRequirementShape`) are re-declared structurally here rather
//   than imported from a hypothetical shared types module. The route file's
//   local type alias (`MergedEntry`) is mirrored exactly so the route can
//   call this helper and consume its result without any narrowing.
//
//   Server-side only. No Prisma import — the route passes the rows in.

// ---------------------------------------------------------------------------
// Structural type re-declarations (TD-077)
// ---------------------------------------------------------------------------

/**
 * Structural copy of the DSX requirement shape carried inside the Prisma
 * `dSXMapping.findMany({ include: { requirement: true } })` result. The route
 * also uses this exact shape locally for its `MergedEntry.requirement` slot.
 * Per TD-077, declaring it here avoids crossing the route/aggregator boundary
 * with a shared types module.
 */
export interface DSXRequirementShape {
  id: string;
  name: string;
  fieldKey: string;
  type: string;
  disabled: boolean;
  fieldData: unknown;
  documentData: unknown;
}

/**
 * Structural copy of one row from the batched `dSXMapping.findMany` call.
 * The route's Prisma query carries `requirementId`, `serviceId`, `locationId`,
 * `isRequired`, plus the included `requirement` record. The aggregator only
 * needs those five — it does not read mapping `id` or `createdAt`/`updatedAt`.
 */
export interface DsxMappingWithRequirement {
  requirementId: string;
  serviceId: string;
  locationId: string;
  isRequired: boolean;
  requirement: DSXRequirementShape;
}

/**
 * Mirrors the route's local `MergedEntry` alias (route.ts:219–223). One entry
 * per requirementId in the returned map. The route consumes this directly in
 * its response builder.
 */
export interface MergedEntry {
  requirement: DSXRequirementShape;
  isRequired: boolean;
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// orMergeMappings — the OR-fold across cross-service × cross-level rows.
// ---------------------------------------------------------------------------

/**
 * OR-merge every mapping row into one entry per requirementId.
 *
 * TD-084 BR 1 (cross-service merge): when two services in the candidate's
 * package both map the same requirement at the same country, the merged
 * `isRequired` is true if ANY row says true.
 *
 * TD-084 BR 2 (geographic-hierarchy merge): when one service maps the same
 * requirement at both the country level and a subregion level, the merged
 * `isRequired` is true if ANY level says true.
 *
 * Both rules collapse into the same fold because the input is a flat row
 * list across the full (serviceIds × levelIds) cartesian — every applicable
 * (serviceId, locationId) pair contributes one row per matching requirement,
 * and the fold ORs them all together by requirementId.
 *
 * Disabled requirements are filtered out defensively (the route already
 * filters at the query level via `requirement: { disabled: false }`, but
 * this helper does not assume that filtering and re-applies the guard).
 *
 * Empty input → empty map (no requirements). Empty array semantics match
 * the validator's `repeatableEntryFieldChecks.buildPerCountryRequiredMap`:
 * absence of any row means the requirement is not in the map at all, which
 * the route's response builder treats as "not in the response."
 *
 * displayOrder comes from the per-requirement lookup the route built from
 * `service_requirements`. When a requirement has no service-level
 * displayOrder, the legacy 999 fallback is preserved (matches the previous
 * route behavior at route.ts:290).
 */
export function orMergeMappings(
  rows: DsxMappingWithRequirement[],
  displayOrderByRequirementId: Map<string, number>,
): Map<string, MergedEntry> {
  const result = new Map<string, MergedEntry>();

  for (const row of rows) {
    if (row.requirement.disabled) continue;

    const resolvedDisplayOrder =
      displayOrderByRequirementId.get(row.requirement.id) ?? 999;

    const existing = result.get(row.requirement.id);
    if (!existing) {
      result.set(row.requirement.id, {
        requirement: row.requirement,
        isRequired: row.isRequired,
        displayOrder: resolvedDisplayOrder,
      });
    } else {
      // OR-fold across every in-scope (serviceId, locationId) pair. The
      // requirement object from the latest row wins for any incidental
      // differences (e.g., fieldData updated after a mapping was created);
      // displayOrder always comes from the service_requirements lookup so
      // the ordering is stable regardless of mapping write order.
      result.set(row.requirement.id, {
        requirement: row.requirement,
        isRequired: existing.isRequired || row.isRequired,
        displayOrder: resolvedDisplayOrder,
      });
    }
  }

  return result;
}
