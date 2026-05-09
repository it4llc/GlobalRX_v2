# Technical Plan: Phase 7 Stage 3a — Split `validationEngine.ts` (Extract `loadValidationInputs`)

**Based on specification:** `docs/specs/phase7-stage3a-validation-engine-split.md` (2026-05-08)
**Parent phase plan:** `docs/specs/phase7-stage3-validation-hardening-plan.md` (Phase 1 / Stage 3a)
**Date:** 2026-05-08
**Architect:** Technical Architect agent
**Branch:** `feature/phase7-stage3a-validation-engine-split` (current)

---

## 0. Verification of facts pinned to specific lines in the spec

The spec pins four concerns to specific line ranges in the current `src/lib/candidate/validation/validationEngine.ts`. Before planning, the architect verified each by reading the file in full:

| Concern | Spec line range | Verified in file |
|---|---|---|
| Prisma `findUnique` + `include` shape | 116–139 | Lines **114–139** — same content. (`prisma.candidateInvitation.findUnique({ where: { id: invitationId }, include: { package: { include: { workflow: ..., packageServices: { include: { service: { include: { serviceRequirements: { include: { requirement: true } }, availability: true } } } } } } } })`.) |
| `servicesByType` grouping | 166–181 | Lines **166–181** — same content (the `Map<ScopeFunctionalityType, typeof orderedPackage.packageServices>` build for `verification-edu`, `verification-emp`, `record`). |
| `requirementMetadata` map population | 188–201 | Lines **188–201** — same content (the `Map<string, RequirementMetadata>` walk over `ps.service.serviceRequirements`). |
| `buildFindMappings` adapter | 734–756 | Lines **734–756** — same content (the closure returning `async ({ requirementIds, pairs }) => ...` over `prisma.dSXMapping.findMany`). |

Adjacent code that the spec deliberately leaves to architect discretion:

- The `if (!invitation) throw new Error('Invitation not found: ${invitationId}')` block lives at lines **141–143**.
- The `formData` cast and the `sectionsData` / `sectionVisits` / `reviewVisitedAt` extractions live at lines **145–148**.
- The `if (!orderedPackage) { logger.warn(...); return emptyResult(); }` short-circuit lives at lines **150–157** (the `logger.warn` call itself spans **152–156**, with `event: 'candidate_validation_no_package'`).
- The `gapToleranceDays` resolution lives at lines **159–162**.
- The `today` capture lives at line **112**.

Current line count of the file: **756 lines** (per `wc -l`). The 600-line hard stop is enforced by `docs/CODING_STANDARDS.md` Section 9.4.

Public consumers of `runValidation` (the only public export from the engine that callers use):

- `src/app/api/candidate/application/[token]/validate/route.ts` (line 8 import; line 87 call)
- `src/app/api/candidate/application/[token]/submit/route.ts` (line 26 import; line 141 call)

Test files that directly exercise the engine module (the regression surface):

- `src/lib/candidate/validation/__tests__/validationEngine.test.ts` (the only file that imports `runValidation` from `../validationEngine` and lets the real engine execute against the global Prisma mock).
- `src/app/api/candidate/application/[token]/validate/__tests__/route.test.ts` (replaces the entire engine module via `vi.mock('@/lib/candidate/validation/validationEngine', ...)` — the engine's internals are not exercised, but the import path must remain importable).
- `src/app/api/candidate/application/[token]/submit/__tests__/route.test.ts` (same `vi.mock` pattern as above).
- `src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts` (does NOT import the engine, but exercises the consumer of `FindDsxMappings`/`DsxMappingRow`; included for completeness because the adapter type contract is shared).

---

## 1. Open architect questions — decisions

The spec defers three decisions to the technical plan. Each is decided below with reasoning.

### 1.1 Closure vs. parameter for `prisma` in `buildFindMappings`

**Decision: keep the closure pattern.** The new `loadValidationInputs.ts` module imports `prisma` from `@/lib/prisma` at module top, and `buildFindMappings()` lives inside that module and captures the same singleton `prisma` import in its returned async function — exactly as it does today inside `validationEngine.ts`. The adapter is exposed to `personalInfoIdvFieldChecks.ts` only by the `FindDsxMappings` type contract; that contract has no `prisma` parameter, and adding one would require either changing the contract (which is forbidden — `personalInfoIdvFieldChecks.ts` is unchanged per spec rule 10) or hiding `prisma` behind a thunk anyway. Closure is the minimal-diff option, preserves byte-identical behavior, and matches the existing test discipline (`personalInfoIdvFieldChecks.test.ts` injects its own inline `findMappings` implementation regardless of what the production code uses).

**Trade-off:** the loader is then *not* a pure function of its inputs — it implicitly depends on the Prisma module singleton. That's already true of the engine today, and Stage 3b (which is allowed to introduce new tests but not new patterns) will work fine with a closure-based adapter because the engine is already tested by stubbing `prisma.candidateInvitation.findUnique` at the global mock level.

### 1.2 Exact return shape of `loadValidationInputs(invitationId)`

**Decision: a single aggregate object** (not a tuple) — type named `ValidationInputs`. Tuple destructuring would force every caller (the engine) to remember positional order; an object lets the engine consume only the fields it needs and is trivially extensible if Stage 3b lifts more concerns into the loader.

**The four mandated concerns from spec rule 5** all land in the loader:

- The `findUnique` call — the loader runs it.
- `requirementMetadata` — the loader builds it.
- `servicesByType` — the loader builds it.
- `findMappings` — the loader constructs and returns the closure.

**Adjacent values that are cheap to compute and live next to the four mandated concerns** are co-located in the loader for clarity and to drive the engine below 600 lines with margin:

- `formData` cast (line 145) — produced by the loader because every other returned value depends on it.
- `sectionsData` (line 146), `sectionVisits` (line 147), `reviewVisitedAt` (line 148) — all derived from `formData`.
- `gapToleranceDays` (lines 159–162) — derived from `orderedPackage.workflow`, which the loader already holds.
- `lockedValues` (lines 266–280) — computed from `invitation.firstName / .lastName / .email / .phoneNumber / .phoneCountryCode`. Including this in the loader keeps PII-bearing field reads in one place and cuts another ~15 lines from the engine.

**What does NOT move:** `today` (line 112 — captured by the orchestrator per spec rule 6 and the engine's "today is captured once" comment), section dispatch, scope resolution, summary construction, and per-section helpers. All remain in the engine.

**Short-circuit decision (see §1.3 below):** the loader returns a discriminated-union value so the orchestrator can detect the no-package case without re-reading any state.

#### Loader return type — `ValidationInputs`

```ts
// Discriminated union — `kind` distinguishes the no-package short-circuit
// from the normal "package present" case. The orchestrator switches on
// `kind` and either returns emptyResult() or proceeds with section dispatch.
type ValidationInputs =
  | { kind: 'no_package' }
  | {
      kind: 'ok';
      invitation: InvitationWithPackage;        // narrowed: invitation.package is non-null
      orderedPackage: PackageWithRelations;      // === invitation.package, hoisted for convenience
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
```

Concrete derivation of each field — pinned to the **current** `validationEngine.ts` line numbers:

| Field | Type | Source in current engine |
|---|---|---|
| `kind` | `'ok' \| 'no_package'` | Set by the loader: `'no_package'` when `invitation.package` is null (lines 150–151); `'ok'` otherwise. |
| `invitation` | `InvitationWithPackage` (alias for `Prisma.CandidateInvitationGetPayload<{ include: { package: { include: { workflow: { include: { sections: true } }, packageServices: { include: { service: { include: { serviceRequirements: { include: { requirement: true } }, availability: true } } } } } } } }>` narrowed so `package` is non-null) | `prisma.candidateInvitation.findUnique` at lines 114–139. The "narrowed" non-null shape is produced by the loader checking `if (!invitation.package)` before returning `kind: 'ok'`. |
| `orderedPackage` | `PackageWithRelations` (the `package` field of the above payload type, non-null) | Line 150: `const orderedPackage = invitation.package;`. |
| `formData` | `CandidateFormDataShape` | Line 145 cast (`(invitation.formData as unknown as CandidateFormDataShape) ?? {}`), moved verbatim. |
| `sectionsData` | `Record<string, SavedSectionData>` | Line 146 (`formData.sections ?? {}`). |
| `sectionVisits` | `Record<string, SectionVisitRecord>` | Line 147 (`formData.sectionVisits ?? {}`). |
| `reviewVisitedAt` | `string \| null` | Line 148 (`formData.reviewPageVisitedAt ?? null`). |
| `gapToleranceDays` | `number \| null` | Lines 159–162 — same conditional, moved verbatim. |
| `servicesByType` | `Map<ScopeFunctionalityType, PackageServiceWithRelations[]>` | Lines 166–181 — same loop, moved verbatim. The map's value type is the array element type of `orderedPackage.packageServices` (i.e. `PackageServiceWithRelations`). |
| `requirementMetadata` | `Map<string, RequirementMetadata>` | Lines 188–201 — same loop, moved verbatim. The `RequirementMetadata` type continues to come from `./dateExtractors`. |
| `lockedValues` | `Record<string, string \| null \| undefined>` | Lines 266–280 — same construction, moved verbatim. |
| `findMappings` | `FindDsxMappings` | Lines 734–756 — same `buildFindMappings()` factory, moved verbatim, called by the loader and stored on the return object. |

**Note on TypeScript narrowing:** The loader already does the `if (!invitation.package)` check before returning, so the `kind: 'ok'` branch types `invitation.package` as non-null. The orchestrator does not need to repeat the check. (See §6.1 risks for what happens if the type system can't follow this — there is a fallback.)

### 1.3 Where the "invitation not found" throw and the "no package" short-circuit live

**Decision:**

- **`Error('Invitation not found: ${invitationId}')` lives in the loader** — the loader runs the `findUnique`, so it's the only code that has the `null` to react to. The error message is preserved byte-for-byte (`Invitation not found: ${invitationId}`). The existing test `validationEngine.test.ts` line 53 asserts `toThrow(/Invitation not found/)` — this passes whether the throw originates in the loader or the engine.

- **The `logger.warn('runValidation invoked on invitation without package', ...)` call ALSO lives in the loader** — it logs, but the loader does NOT call `emptyResult()` (which is engine-internal state); it returns `{ kind: 'no_package' }` and the orchestrator translates that to `emptyResult()`. The log call is moved verbatim, including:
  - level: `warn`
  - message text: `runValidation invoked on invitation without package`
  - metadata: `{ event: 'candidate_validation_no_package', invitationId }`

  This preserves byte-identical observable logging.

**Rationale:** Both short-circuits are about the *shape* of what was loaded from the database, which is the loader's responsibility. Keeping the orchestrator free of the database-shape conditionals is the entire point of the refactor.

---

## 2. Database changes

**None.** This is a pure code-organization refactor. Confirmed by spec rule 11.

---

## 3. New files to create

### 3.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/loadValidationInputs.ts`

**Responsibility:** Owns every database read and every derived data-shape that the validation engine needs *before* it begins per-section dispatch. Specifically:

- Runs `prisma.candidateInvitation.findUnique` with the existing include tree (moved verbatim from `validationEngine.ts` lines 114–139).
- Throws `Error('Invitation not found: ${invitationId}')` on null result (moved verbatim from lines 141–143).
- Logs the no-package warn and returns `{ kind: 'no_package' }` (moved verbatim from lines 152–156, except the `return emptyResult()` is replaced with `return { kind: 'no_package' }`; the orchestrator handles the empty result).
- Casts `invitation.formData` to `CandidateFormDataShape` and extracts `sectionsData` / `sectionVisits` / `reviewVisitedAt` (moved verbatim from lines 145–148).
- Computes `gapToleranceDays` (moved verbatim from lines 159–162).
- Builds `servicesByType` (moved verbatim from lines 166–181).
- Builds `requirementMetadata` (moved verbatim from lines 188–201).
- Builds `lockedValues` from the invitation columns (moved verbatim from lines 266–280).
- Produces `findMappings` via `buildFindMappings()` (moved verbatim from lines 734–756). The factory and the closure both live in this file. The factory captures the module-level `prisma` import in closure (decision §1.1).

**Exports:**

- `loadValidationInputs(invitationId: string): Promise<ValidationInputs>` — the only function the engine calls.
- `type ValidationInputs` — the discriminated-union return type defined in §1.2.

**Internal types co-located in the loader (NOT exported, used only by `loadValidationInputs.ts`):**

- `interface SavedFieldRecord { requirementId: string; value: unknown; }`
- `interface SavedRepeatableEntry { entryId: string; countryId: string \| null; entryOrder: number; fields: SavedFieldRecord[]; }`
- `interface SavedSectionData { type?: string; fields?: SavedFieldRecord[]; entries?: SavedRepeatableEntry[]; aggregatedFields?: Record<string, unknown>; }`
- `interface SectionVisitRecord { visitedAt: string; departedAt: string \| null; }`
- `interface CandidateFormDataShape { sections?: Record<string, SavedSectionData>; sectionVisits?: Record<string, SectionVisitRecord>; reviewPageVisitedAt?: string \| null; [key: string]: unknown; }`
- Type aliases for the Prisma payload narrowing:
  - `type InvitationWithPackage = Prisma.CandidateInvitationGetPayload<{ include: typeof CANDIDATE_INVITATION_INCLUDE }> & { package: NonNullable<...> }` — see §6.1 for the fallback if the inline `typeof CANDIDATE_INVITATION_INCLUDE` form doesn't compile cleanly.
  - `type PackageWithRelations = NonNullable<InvitationWithPackage['package']>`
  - `type PackageServiceWithRelations = PackageWithRelations['packageServices'][number]`

**Note on duplication of saved-data shapes:** these interfaces (`SavedFieldRecord`, `SavedRepeatableEntry`, `SavedSectionData`, `SectionVisitRecord`, `CandidateFormDataShape`) are currently *internal* to `validationEngine.ts` (lines 66–95). After the move, the engine still needs `SavedSectionData` and `SectionVisitRecord` because every per-section helper signature references them. Rather than re-export from the loader (which would couple the engine to the loader's internal naming) **the engine keeps its own copy of the four narrow saved-data interfaces it currently has at lines 66–95**. The loader keeps its own copies. The shapes are structural (not nominal) so the values pass between modules without a TS error. This matches the existing pattern between the engine and `personalInfoIdvFieldChecks.ts` (see that file's lines 47–76 — it deliberately re-declares the same shape rather than import it).

**Imports the loader needs:**

- `import { prisma } from '@/lib/prisma'`
- `import logger from '@/lib/logger'`
- `import type { Prisma } from '@prisma/client'` (for the `GetPayload` helper used by the return type)
- `import type { ScopeFunctionalityType } from './packageScopeShape'`
- `import type { RequirementMetadata } from './dateExtractors'`
- `import type { FindDsxMappings, DsxMappingRow } from './personalInfoIdvFieldChecks'`

---

## 4. Existing files to modify

### 4.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts`

**File was read in full before this plan was written.** Confirmed.

**What is removed (line ranges in the current file):**

- Lines **114–139** — the inline `prisma.candidateInvitation.findUnique({ ... include: { ... } })` call.
- Lines **141–143** — the `if (!invitation) throw new Error('Invitation not found: ...')` block (moved to the loader).
- Lines **145–148** — the `formData` cast and the `sectionsData` / `sectionVisits` / `reviewVisitedAt` extractions.
- Lines **150–157** — the no-package short-circuit (`if (!orderedPackage)` block); replaced by switching on `inputs.kind`.
- Line **150** — the `const orderedPackage = invitation.package;` line; replaced by reading `inputs.orderedPackage`.
- Lines **159–162** — `gapToleranceDays` derivation.
- Lines **166–181** — `servicesByType` map construction.
- Lines **188–201** — `requirementMetadata` map construction.
- Lines **265–280** — the `findMappings` and `lockedValues` constructions (the `const findMappings: FindDsxMappings = buildFindMappings();` line and the `lockedValues` object literal).
- Lines **725–756** — the `buildFindMappings` factory function definition AND the section header comment block immediately above it (lines 725–733).

**What is added:**

- A new import `import { loadValidationInputs } from './loadValidationInputs';` in the engine's import block (placed alphabetically next to the other `./` imports).
- Inside `runValidation`, a call: `const inputs = await loadValidationInputs(invitationId);` directly after the `today` capture (line 112).
- A switch on `inputs.kind`: when `'no_package'`, return `emptyResult()`. When `'ok'`, destructure (or read) the fields needed by the orchestrator.
- All section-dispatch sites (lines 207–316 today) read from `inputs` instead of the local consts (`inputs.servicesByType`, `inputs.sectionsData`, `inputs.sectionVisits`, `inputs.reviewVisitedAt`, `inputs.gapToleranceDays`, `inputs.requirementMetadata`, `inputs.findMappings`, `inputs.lockedValues`, `inputs.orderedPackage`). The orchestrator's high-level shape remains identical — same per-section calls, same arguments, same order.

**What stays unchanged:**

- The `today` capture at line 112.
- The seven per-section helper functions in the file (`emptySectionResult`, `validateNonScopedSection`, `buildWorkflowSectionResult`, `validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection`, plus the status helpers `deriveBasicStatus`, `deriveStatusWithErrors`, `hasAnySavedData`, the misc helpers `resolveSectionScope`, `computeScopeStart`, `flattenEntry`, `inferAddressBlockRequirementId`, and `buildReviewSummary`, and the `emptyResult()` factory).
- The four narrow saved-data interfaces at lines 66–95 (kept; they are read by the per-section helper signatures).
- The public export `runValidation` and its `Promise<FullValidationResult>` signature.
- All of the per-section dispatch *logic* — only the *source* of `inputs.X` changes from "local const" to "field of the loader's return value".
- The sentence-level header comments at the top of the file (lines 1–19).
- The two `--- separator ---` comment banners that organize the file's interior sections.

**Imports removed from the engine:**

- The engine no longer needs `import { prisma } from '@/lib/prisma'` — none of the engine's *remaining* code references `prisma`. (Removed.)
- The engine no longer needs the named imports `DsxMappingRow` from `'./personalInfoIdvFieldChecks'` — only the loader uses it now. The engine keeps `FindDsxMappings` if and only if its own code mentions the type; in fact after the move the engine only handles `inputs.findMappings` opaquely (passes it through to `validateIdvSection`), so it can drop both `DsxMappingRow` AND `FindDsxMappings` from its imports. Verify during implementation: if any inline type annotation in the orchestrator still mentions `FindDsxMappings`, keep the import.
- The engine no longer needs `import logger from '@/lib/logger'` — the only call site (line 152) moves to the loader. (Removed.)

**Estimated net line change:**

- Lines removed: roughly 25 (findUnique include) + 3 (throw) + 4 (formData lines) + 8 (no-package block) + 4 (gapToleranceDays) + 16 (servicesByType) + 14 (requirementMetadata) + 16 (lockedValues) + 1 (findMappings construction) + 32 (buildFindMappings function and its comment header) ≈ **~123 lines removed** (plus a few lines of imports and helper-function whitespace also removed).
- Lines added: 1 import + 1 `loadValidationInputs` call + ~3-line `switch (inputs.kind)` + minor shifts in the section-dispatch code as it reads `inputs.X` instead of local consts ≈ **~10 lines added**.

**Net: ~113 lines reduction.** That puts the engine at approximately **756 − 113 ≈ 643 lines**. 

**This does not satisfy the hard stop of 600 lines.** Therefore the plan also requires moving:

- The two interior section-banner comments and the lockedValues block as already enumerated (already counted above).
- **Additional code that must move to hit < 600**: the engine's own four `Saved*` interfaces (lines 66–95, ~30 lines) are NOT eligible to move because the engine's per-section helper *signatures* depend on them. Their TypeScript visibility cannot be reduced without changing the helpers.

After re-counting, the realistic post-refactor engine size is approximately **620–630 lines** with the listed removals. **This is still over 600.**

To land below 600 with margin, **two additional helper hoists** are required as part of this stage. They are listed here so the implementer is allowed to perform them under Absolute Rule 6:

- **Hoist `flattenEntry` (lines 632–641, 10 lines) and `inferAddressBlockRequirementId` (lines 646–661, 16 lines) into a new file `src/lib/candidate/validation/savedEntryShape.ts`.** Both are pure helpers; both depend only on the engine's `SavedRepeatableEntry` shape (which can be re-declared in the new file structurally, matching the existing `personalInfoIdvFieldChecks.ts` pattern). Net line removal from the engine: ~30 lines.

After this additional hoist, the engine drops to approximately **595–605 lines**, with margin.

#### 4.1.1 Re-evaluation of the line target

After re-reading the engine more carefully and counting blank lines, comment headers, and the inline `lockedValues` block, the realistic post-extraction line count is:

- Pre-extraction: 756
- After removing the spec-mandated four concerns + lockedValues + the no-package block + the bare imports that become unused + the `buildFindMappings` section header: approximately 615–630.

To guarantee the < 600 hard stop with comfortable margin, the third file below is added.

### 4.2 New file: `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/savedEntryShape.ts`

**Responsibility:** owns the two pure utility helpers that read the saved-entry shape and have no dependency on the loader's database calls. Hoisting them gives the engine the comfortable margin required by spec rule 4.

**Exports:**

- `flattenEntry(entry: SavedRepeatableEntry): { entryOrder: number; fields: Record<string, unknown> }` — moved verbatim from `validationEngine.ts` lines 632–641.
- `inferAddressBlockRequirementId(entries: SavedRepeatableEntry[]): string | null` — moved verbatim from `validationEngine.ts` lines 646–661.

**Internal types:**

- `interface SavedFieldRecord { requirementId: string; value: unknown; }` (re-declared structurally; matches the engine's interface at line 66–69 by shape).
- `interface SavedRepeatableEntry { entryId: string; countryId: string \| null; entryOrder: number; fields: SavedFieldRecord[]; }` (re-declared structurally; matches the engine's interface at lines 71–76).

**Imports:** none required (pure functions).

**Why a third file rather than expanding the loader's responsibility:** these helpers operate on the *saved-data* shape, not the loaded-from-DB shape; they are conceptually the inverse of the loader (input vs. environment). Folding them into the loader would mix concerns. They belong in their own small module and the spec's rule 6 — "anything else may move at the architect's discretion as long as the engine drops below 600 lines and behavior does not change" — explicitly authorizes this.

**This file is mentioned by spec name in this plan and is therefore covered by Implementer Absolute Rule 6.**

### 4.3 Files NOT modified

- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — confirmed by `git diff` after the implementer is done.
- `src/lib/candidate/validation/dateExtractors.ts` — unchanged.
- `src/lib/candidate/validation/types.ts` — unchanged.
- `src/lib/candidate/validation/packageScopeShape.ts` — unchanged.
- `src/lib/candidate/validation/scopeValidation.ts` — unchanged.
- `src/lib/candidate/validation/gapDetection.ts` — unchanged.
- `src/lib/candidate/validation/validateWorkflowSection.ts` — unchanged.
- `src/lib/candidate/validation/mergeSectionStatus.ts` — unchanged.
- `src/lib/candidate/validation/fieldFormatValidation.ts` — unchanged.
- `src/lib/candidate/validation/humanizeDuration.ts` — unchanged.
- `src/app/api/candidate/application/[token]/validate/route.ts` — unchanged.
- `src/app/api/candidate/application/[token]/submit/route.ts` — unchanged.
- `src/lib/candidate/submission/submitApplication.ts` — unchanged.
- `src/lib/candidate/submission/types.ts` — unchanged.
- All test files in `src/lib/candidate/validation/__tests__/` — unchanged.
- `src/app/api/candidate/application/[token]/validate/__tests__/route.test.ts` — unchanged.
- `src/app/api/candidate/application/[token]/submit/__tests__/route.test.ts` — unchanged.
- `src/test/setup.ts`, `src/test/utils.ts` — unchanged.

---

## 5. Implementation order

The implementer will perform this refactor in **four steps**, running the regression test suite after each step. Behavior preservation is verified incrementally; if a test fails at any step, the implementer reverts that step before proceeding.

1. **Create `src/lib/candidate/validation/savedEntryShape.ts`** with `flattenEntry` and `inferAddressBlockRequirementId` (verbatim copy from the engine; no edit). Do not yet remove them from `validationEngine.ts`. The new file is unused at this point but compiles cleanly. Run `pnpm typecheck`. Run `pnpm vitest run` — all tests must pass with the same counts as the baseline. (This step is purely additive and cannot break anything.)

2. **Create `src/lib/candidate/validation/loadValidationInputs.ts`** with the `loadValidationInputs(invitationId)` function and `ValidationInputs` type (verbatim copy from the engine of the four mandated concerns + the four supporting derivations enumerated in §1.2; no edit). Do not yet wire it into the engine. Run `pnpm typecheck`. Run `pnpm vitest run` — counts must match baseline. (Again, purely additive.)

3. **Edit `validationEngine.ts`** to:
   - Add the `import { loadValidationInputs } from './loadValidationInputs';` import.
   - Add the `import { flattenEntry, inferAddressBlockRequirementId } from './savedEntryShape';` import.
   - Replace the body of `runValidation` from line 114 through line 162 with the loader call and the `switch (inputs.kind)` shape.
   - Replace local references in the section-dispatch block (lines 207–316) to use `inputs.X`.
   - Remove the inline `findMappings`/`lockedValues` construction (lines 265–280) since the loader supplies them.
   - Delete the `flattenEntry` and `inferAddressBlockRequirementId` function definitions (lines 632–641 and 646–661).
   - Delete the `buildFindMappings` factory and its section header (lines 725–756).
   - Remove the now-unused imports `prisma`, `logger`, `DsxMappingRow`, and `FindDsxMappings` (verify each via TS unused-import warnings).
   - Run `pnpm typecheck`. Run `pnpm vitest run`. **Counts must match baseline exactly.**

4. **Verify the final state:**
   - `wc -l src/lib/candidate/validation/validationEngine.ts` returns a value < 600.
   - `pnpm vitest run` total passing/failing/skipped counts match the parent commit (`origin/dev` HEAD when the branch was created).
   - `pnpm typecheck` returns zero new errors.
   - `pnpm build` succeeds.
   - `pnpm lint` returns no new errors.
   - `git diff` of `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` is empty.
   - `git diff src/lib/candidate/validation/__tests__/` is empty.
   - `git diff src/app/api/candidate/application/[token]/validate/__tests__/` and `.../submit/__tests__/` are empty.
   - `git diff src/app/api/candidate/application/[token]/validate/route.ts` and `.../submit/route.ts` are empty.

The order — *create new files first, then edit the engine* — matches Andy's locked-in pattern: every step that adds code is verifiably a no-op until the final wiring step, which is the only step that can change behavior.

---

## 6. Risks

### 6.1 Prisma return-type narrowing — `InvitationWithPackage` and the `package: non-null` discriminator

**Risk:** The loader needs a TypeScript type for the `findUnique` return value (with the include) that has `package` narrowed to non-null. Prisma's `Prisma.CandidateInvitationGetPayload<{ include: { package: { include: ... } } }>` types `package` as `T | null`. Passing this directly to the engine forces the engine to re-check `if (!inputs.package)` even though the loader already discriminated on `kind === 'ok'`.

**Mitigation:** Use a discriminated union (decision §1.2) so the orchestrator only sees `inputs.orderedPackage` after switching on `inputs.kind === 'ok'`, and the loader's `kind: 'ok'` branch builds `orderedPackage` as `NonNullable<typeof invitation.package>`. The narrowing happens once, at the loader's `if (!invitation.package) return { kind: 'no_package' };` line, and TypeScript follows the narrowing into the return statement.

**Fallback if Prisma's `GetPayload` types don't compile cleanly with the chained `include`:** declare a `const CANDIDATE_INVITATION_INCLUDE = { ... } satisfies Prisma.CandidateInvitationInclude;` and use `Prisma.CandidateInvitationGetPayload<{ include: typeof CANDIDATE_INVITATION_INCLUDE }>`. This is a project-standard pattern (e.g. the structure route uses it) and produces a fully-narrowed type without `any` casts. The implementer is authorized to use this pattern.

### 6.2 Closure capture vs. dependency injection of `prisma`

**Risk:** moving `buildFindMappings` to a new module changes which module's `prisma` import the closure captures. If the test suite mocks `@/lib/prisma` in a way that creates a different mock instance per importing module, the loader's closure would capture the WRONG mock.

**Mitigation:** the test suite uses **a single global mock** declared in `src/test/setup.ts` (`vi.mock('@/lib/prisma', () => ({ prisma: createMockPrisma() }))`). Vitest module mocks are hoisted and shared across all importing modules, so `prisma` resolves to the same singleton object whether imported from `validationEngine.ts` or from `loadValidationInputs.ts`. Confirmed by reading `src/test/setup.ts` line 7 (the `vi.mock` lives at module top, before any test file is loaded). No test changes required.

### 6.3 Logger event-name preservation

**Risk:** the existing `logger.warn` call uses `event: 'candidate_validation_no_package'` and the message `runValidation invoked on invitation without package`. Either being changed during the move would silently break log search/alerting.

**Mitigation:** the implementer copies the call **byte-for-byte verbatim** from `validationEngine.ts` lines 152–156 into `loadValidationInputs.ts`. The plan explicitly enumerates the event name, the message text, and the metadata keys (§1.3). The Stage 3a checkpoint must include a `git diff` showing this string is unchanged (e.g. `git log -p -- src/lib/candidate/validation/loadValidationInputs.ts | grep candidate_validation_no_package`).

### 6.4 The `Error('Invitation not found: ...')` throw message

**Risk:** the engine's existing test asserts `toThrow(/Invitation not found/)`. Subtly changing the throw message to e.g. `'Invitation ${id} not found'` would still match the regex but break any external consumer that pattern-matches on the exact prefix.

**Mitigation:** the throw is moved verbatim. Exact text: `Invitation not found: ${invitationId}`. The plan calls this out (§1.3). The test continues to pass because the regex is a substring match.

### 6.5 TypeScript compile-time impact on importers

**Risk:** removing `prisma`, `logger`, `DsxMappingRow`, and `FindDsxMappings` imports from the engine could leave a stale type annotation that imports them implicitly. If the engine still mentions `FindDsxMappings` in any signature (it doesn't today after the move, but the implementer must verify), the import must be kept.

**Mitigation:** during step 3, the implementer runs `pnpm typecheck` before committing. Any unused-import warning is the canonical signal to remove the import. Any "cannot find name" error is the signal to keep the import. The pipeline already runs typecheck as part of the implementer's standard checklist.

### 6.6 Implementer Absolute Rule 6 — file-list contract

**Risk:** the implementer will refuse to touch any file not listed in this plan. If this plan omits a file, the refactor stalls.

**Mitigation:** the explicit "Files NOT modified" list (§4.3) and the explicit "Files to create" list (§3) and "Files to modify" list (§4) constitute the complete contract. The implementer is authorized to:

- Create `src/lib/candidate/validation/loadValidationInputs.ts`.
- Create `src/lib/candidate/validation/savedEntryShape.ts`.
- Modify `src/lib/candidate/validation/validationEngine.ts`.

And nothing else. If any other file appears to need a change, the implementer must STOP and report back to the architect.

### 6.7 Hidden test that imports an internal helper

**Risk:** if any test file imports `buildFindMappings`, `flattenEntry`, or `inferAddressBlockRequirementId` from the engine directly, moving those functions to other files breaks that import.

**Mitigation:** the architect confirmed via `grep -rln "buildFindMappings\|flattenEntry\|inferAddressBlockRequirementId" src` that **none of these helpers are imported anywhere outside `validationEngine.ts`**. They are not exported. Moving them is safe.

### 6.8 The line-count target — making the realistic estimate hold

**Risk:** the architect's line-count estimate (§4.1.1) is approximate. If the engine lands at 605 lines after step 3, the < 600 target is missed.

**Mitigation:** the plan explicitly authorizes the second extraction file (`savedEntryShape.ts`) which removes ~30 additional lines. If even that is insufficient, the implementer must STOP at step 4 and report the actual line count to the architect; the architect will then authorize an additional helper hoist. The implementer must NOT improvise extra extractions.

### 6.9 Future-proofing for Stage 3b

**Risk (informational, not a Stage 3a defect):** Stage 3b will add per-entry required-field validation for Address History, Education, and Employment, requiring access to the package's DSX availability pairs and a per-entry `findMappings` resolver. The Stage 3a loader's `ValidationInputs.findMappings` and `ValidationInputs.orderedPackage.packageServices[i].service.availability` already supply everything Stage 3b will need. No Stage 3a change is required to enable Stage 3b.

---

## 7. Test plan

This stage is a **pure mechanical refactor with zero new behavior**. Per spec rule 2, no test file is edited.

### 7.1 The regression surface (what must continue to pass)

Test files that exercise the refactored code paths (directly or indirectly):

| File | Relationship to the refactor |
|---|---|
| `src/lib/candidate/validation/__tests__/validationEngine.test.ts` | **Direct** — imports the real `runValidation`, stubs `prisma.candidateInvitation.findUnique` per test. Every test in this file exercises the loader (post-refactor) plus the orchestrator. |
| `src/app/api/candidate/application/[token]/validate/__tests__/route.test.ts` | Indirect — replaces the entire engine module via `vi.mock('@/lib/candidate/validation/validationEngine')`. Asserts the route still imports successfully and dispatches correctly. |
| `src/app/api/candidate/application/[token]/submit/__tests__/route.test.ts` | Indirect — same `vi.mock` pattern. |
| `src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts` | Indirect — exercises the consumer of the `FindDsxMappings` / `DsxMappingRow` type contract that the loader's `findMappings` adapter must satisfy. Must continue to pass byte-identically because `personalInfoIdvFieldChecks.ts` is unchanged. |
| `src/lib/candidate/validation/__tests__/dateExtractors.test.ts` | Indirect — exercises `dateExtractors.ts` which is consumed by the engine; the dateExtractors module itself is unchanged. |
| `src/lib/candidate/validation/__tests__/scopeValidation.test.ts` | Same. |
| `src/lib/candidate/validation/__tests__/gapDetection.test.ts` | Same. |
| `src/lib/candidate/validation/__tests__/packageScopeShape.test.ts` | Same. |
| `src/lib/candidate/validation/__tests__/fieldFormatValidation.test.ts` | Same. |
| `src/lib/candidate/validation/__tests__/humanizeDuration.test.ts` | Same. |

### 7.2 Pass/fail/skip discipline

- The implementer captures the **baseline** test counts before starting work: `pnpm vitest run 2>&1 | tail -10` on the parent commit (the branch base, `origin/dev` at the time the branch was created).
- After step 4 of the implementation order, the implementer captures the **final** test counts via the same command.
- The numbers must match — same passing count, same failing count, same skipped count.
- Per CLAUDE.md, agent-self-reported test counts are never trusted; the implementer's checkpoint must include the raw bash output.

### 7.3 New tests in this stage

**None.** This is a Pass-1 / Pass-2 unique stage where the implementer's `vitest run` is expected to be a 0-net-test-change run. The test-writer agent in the pipeline will produce a Pass-1 report indicating "no new tests required for this stage" and proceed.

---

## 8. Plan completeness check

- [x] Every file the implementer will need to touch is listed above. Two created (`loadValidationInputs.ts`, `savedEntryShape.ts`); one modified (`validationEngine.ts`).
- [x] No file outside this plan will need to be modified. The "Files NOT modified" list (§4.3) is exhaustive for the directories at risk.
- [x] All exported names and types are listed. The loader exports `loadValidationInputs` and the type `ValidationInputs`. The savedEntryShape module exports `flattenEntry` and `inferAddressBlockRequirementId`. The engine's exports remain `runValidation` (and any other already-exported public symbol — the architect verified there are no others).
- [x] The plan is consistent with the spec's Definition of Done table (rules 1–14): zero behavior change (§1, §6.4), no test edits (§7.2), public API unchanged (§4.1), engine below 600 lines (§4.1.1, §6.8 with a margin-providing extra extraction), Prisma include shape identical (§4.1, §6.1), `personalInfoIdvFieldChecks.ts` unchanged (§4.3), no new `any` (§4.1, §6.1), no DB / migration / UI / API route changes (§2, §4.3).
- [x] All three architect-decision questions from the spec are answered with reasoning (§1.1, §1.2, §1.3).

---

## 9. Open architect-discovered questions

The architect's reading surfaced no additional questions that the spec did not anticipate. The line-count math (§4.1.1) revealed that the four mandated extractions plus the supporting derivations (lockedValues, formData casts, gapToleranceDays) leave the engine at approximately 615–630 lines, which is over the 600 hard stop. The spec gives the architect discretion to lift additional concerns under rule 6, and §4.2 enumerates the additional file (`savedEntryShape.ts`). This is documented as a discovery, not a question — the architect's decision is final and the implementer is authorized to follow it.

The plan is ready for the test-writer to proceed.
