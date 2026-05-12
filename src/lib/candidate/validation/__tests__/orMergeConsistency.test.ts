// /GlobalRX_v2/src/lib/candidate/validation/__tests__/orMergeConsistency.test.ts
//
// TD-084 Pass 1 — DoD 3 + DoD 8 cross-path consistency test.
//
// Spec:           docs/specs/td-084-required-indicator-per-country-alignment.md
//                 (BR 4 + DoD 3, 8 — rendering path and validation path must
//                 compute `isRequired` from the same data with the same
//                 semantics)
// Technical plan: docs/plans/td-084-technical-plan.md
//                 §1.3 ("parallel helpers"), §3.1.1 (new module
//                 `aggregateFieldsRequired.ts`), §6.3 + §6.4 (consistency
//                 test exercising both paths on the same fixture)
//
// What this test asserts:
//   For a fixture where TWO services in a candidate's package both map the
//   same requirement at the same country, with one row isRequired=true and
//   the other isRequired=false, the route's OR-merge aggregator
//   (`orMergeMappings` from the new `aggregateFieldsRequired.ts` sibling
//   module — architect plan §3.1.1) and the validator's per-country required
//   map (`buildPerCountryRequiredMap` inside `repeatableEntryFieldChecks.ts`
//   — architect plan §3.2.2) must BOTH yield `isRequired: true` for that
//   requirement. The two paths are independent implementations of the same
//   OR-fold semantics; this test is the BR 4 contract that proves they agree.
//
// Pass 1 status:
//   - `orMergeMappings` does NOT yet exist. Architect plan §3.1.1 creates it
//     at `src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts`
//     during implementation step 5. On Pass 1 the import below WILL FAIL at
//     module-resolution time — this is the intended RED state for the
//     consistency contract.
//   - `buildPerCountryRequiredMap` exists today inside
//     `src/lib/candidate/validation/repeatableEntryFieldChecks.ts` (line 295)
//     but is NOT currently exported. The architect's plan §3.2.2 calls for a
//     one-line operator flip inside that function; testing it directly here
//     requires the implementer to add an `export` keyword to its declaration
//     (or expose an equivalent narrow surface for tests). This is flagged in
//     the test-writer hand-off as an implementer follow-up; on Pass 1 the
//     import below ALSO fails at module-resolution time.
//   - After the implementer creates the new module and exports
//     `buildPerCountryRequiredMap`, the AND→OR flip lands and both paths
//     produce the same `true` verdict for the cross-service fixture — the
//     consistency contract holds.
//
// Mocking discipline:
//   - No Prisma mocks. The test exercises pure functions against in-memory
//     row fixtures. Each function takes its input rows directly; there is no
//     adapter call. (Per architect plan §3.1.1: `orMergeMappings(rows,
//     displayOrderByRequirementId)` is a pure helper with no Prisma import;
//     `buildPerCountryRequiredMap(rows)` is the validator's pure fold.)
//
// Hard constraint: this Pass 1 test file imports from paths the implementer
// has NOT yet created or exported. The imports below will fail at module
// resolution until implementation step 5 lands. This is the documented
// Pass 1 RED state for DoD 3 / DoD 8.

import { describe, it, expect } from 'vitest';

// IMPORT RESOLVES AFTER ARCHITECT PLAN §3.1.1 (implementation step 5) creates
// the file `src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts`.
// On Pass 1 this import fails — that's the intended RED state.
import {
  orMergeMappings,
  type DsxMappingWithRequirement,
  type MergedEntry,
} from '../../../../app/api/candidate/application/[token]/fields/aggregateFieldsRequired';

// IMPORT RESOLVES AFTER the implementer adds `export` to
// `buildPerCountryRequiredMap` (today an internal function at
// `src/lib/candidate/validation/repeatableEntryFieldChecks.ts:295`). Architect
// plan §3.2.2 flips its inner fold from AND to OR; exposing it for the
// consistency test is the natural follow-up to the parallel-helpers
// resolution at architect plan §1.3. On Pass 1 this import fails.
import {
  buildPerCountryRequiredMap,
  type DsxMappingRow,
} from '../repeatableEntryFieldChecks';

describe('TD-084 — cross-path OR-merge consistency (BR 4, DoD 3, DoD 8)', () => {
  // Shared fixture: same shape used by DoD 1 (validator) and DoD 2 (route).
  // Two services in the package each carry a dsx_mappings row for the same
  // requirement at the same country; one isRequired=true, the other false.
  // After TD-084 the cross-service OR-merge must yield true on both paths.
  const REQ_SHARED = 'req-shared-uuid';
  const SVC_A = 'svc-A';
  const SVC_B = 'svc-B';
  const COUNTRY_US = 'US';

  const validatorRows: DsxMappingRow[] = [
    {
      requirementId: REQ_SHARED,
      serviceId: SVC_A,
      locationId: COUNTRY_US,
      isRequired: true,
    },
    {
      requirementId: REQ_SHARED,
      serviceId: SVC_B,
      locationId: COUNTRY_US,
      isRequired: false,
    },
  ];

  const routeRows: DsxMappingWithRequirement[] = [
    {
      requirementId: REQ_SHARED,
      serviceId: SVC_A,
      locationId: COUNTRY_US,
      isRequired: true,
      requirement: {
        id: REQ_SHARED,
        name: 'Shared Requirement',
        fieldKey: 'sharedReq',
        type: 'field',
        disabled: false,
        fieldData: { dataType: 'text' },
        documentData: null,
      },
    },
    {
      requirementId: REQ_SHARED,
      serviceId: SVC_B,
      locationId: COUNTRY_US,
      isRequired: false,
      requirement: {
        id: REQ_SHARED,
        name: 'Shared Requirement',
        fieldKey: 'sharedReq',
        type: 'field',
        disabled: false,
        fieldData: { dataType: 'text' },
        documentData: null,
      },
    },
  ];

  // displayOrder lookup that the route's aggregator consumes. The route gets
  // this from prisma.serviceRequirement.findMany; here we hand-build it.
  const displayOrderByRequirementId = new Map<string, number>([
    [REQ_SHARED, 1],
  ]);

  it('DoD 3 + DoD 8: route aggregator and validator aggregator both yield isRequired=true for the cross-service fixture (BR 1 / BR 4 consistency). Fails on Pass 1 at import resolution; passes after the implementer creates aggregateFieldsRequired.ts and exports buildPerCountryRequiredMap (architect plan §3.1.1 + §3.2.2).', () => {
    // Route-side path: pass the rows directly to the OR-fold helper.
    const routeMap = orMergeMappings(routeRows, displayOrderByRequirementId);
    const routeEntry: MergedEntry | undefined = routeMap.get(REQ_SHARED);
    expect(routeEntry).toBeDefined();
    expect(routeEntry!.isRequired).toBe(true);

    // Validator-side path: pass the same rows (structurally compatible) to
    // the validator's per-country required map builder.
    const validatorMap = buildPerCountryRequiredMap(validatorRows);
    const perReq = validatorMap.get(COUNTRY_US);
    expect(perReq).toBeDefined();
    expect(perReq!.get(REQ_SHARED)).toBe(true);

    // Consistency contract (BR 4): the two paths agree.
    expect(routeEntry!.isRequired).toBe(perReq!.get(REQ_SHARED));
  });

  it('DoD 8 consistency: both paths agree (false) when every row says isRequired=false. Once the new module and the validator export land, this guards the negative case — both helpers must produce false for an all-false fixture.', () => {
    const falseValidatorRows: DsxMappingRow[] = [
      {
        requirementId: REQ_SHARED,
        serviceId: SVC_A,
        locationId: COUNTRY_US,
        isRequired: false,
      },
      {
        requirementId: REQ_SHARED,
        serviceId: SVC_B,
        locationId: COUNTRY_US,
        isRequired: false,
      },
    ];
    const falseRouteRows: DsxMappingWithRequirement[] = falseValidatorRows.map(
      (r) => ({
        ...r,
        requirement: {
          id: r.requirementId,
          name: 'Shared Requirement',
          fieldKey: 'sharedReq',
          type: 'field',
          disabled: false,
          fieldData: { dataType: 'text' },
          documentData: null,
        },
      }),
    );

    const routeMap = orMergeMappings(falseRouteRows, displayOrderByRequirementId);
    const routeEntry = routeMap.get(REQ_SHARED);
    expect(routeEntry).toBeDefined();
    expect(routeEntry!.isRequired).toBe(false);

    const validatorMap = buildPerCountryRequiredMap(falseValidatorRows);
    const perReq = validatorMap.get(COUNTRY_US);
    expect(perReq).toBeDefined();
    expect(perReq!.get(REQ_SHARED)).toBe(false);

    // Consistency contract: both agree.
    expect(routeEntry!.isRequired).toBe(perReq!.get(REQ_SHARED));
  });
});
