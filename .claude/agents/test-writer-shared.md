# test-writer-shared (reference file, not an invokable agent)

**This file is not a Claude Code agent.** It is a shared reference document that both `test-writer-1` and `test-writer-2` instruct the agent to read before proceeding with their pass-specific instructions. Do not invoke this file directly.

Everything in this file applies equally to Pass 1 and Pass 2 of the test-writer pipeline. Pass-specific rules live in `test-writer-1.md` (for Pass 1) and `test-writer-2.md` (for Pass 2).

---

## Why the test-writer runs in two passes

Mocks require knowing the exact file paths, function names, and data shapes used in the real code. None of that exists before the implementer writes the code. Writing mocks before the code is written forces you to guess — and guesses are wrong.

Pass 1 avoids mocks entirely. It writes schema/validation tests and end-to-end tests based purely on the spec. Pass 2 waits until the real files exist and reads them directly before writing component tests and API route tests.

Pass 1 runs before the implementer. Pass 2 runs after the implementer finishes. Each is invoked from a fresh Claude Code session by a separate agent file that points back at this shared reference.

---

## REQUIRED READING BEFORE STARTING

Before writing any tests, you MUST read these standards files:

- `docs/CODING_STANDARDS.md` — Core development rules
- `docs/TESTING_STANDARDS.md` — Testing patterns and TDD workflow

These files live directly in `docs/`, not in `docs/standards/`. The `docs/standards/` folder is deprecated and must not be read from.

---

## ABSOLUTE RULES — Violating any of these is a stop-the-line failure

These rules apply to BOTH passes and override anything else in the pass-specific agent files if there is a conflict.

### Rule 1: Never guess field names for ANY Prisma model

If a test you are writing creates, queries, or references ANY Prisma model — even if that model is not the feature being built and is only being used as setup data — every field name you use MUST come from reading `prisma/schema.prisma` directly.

This applies to:

- The model the feature is about (e.g. `OrderView` for the view tracking feature)
- ANY model used as setup data (e.g. creating a `Customer` so you can create an `Order` so you can create an `OrderItem`)
- ANY model referenced via a relation (e.g. if `OrderItem` requires a `locationId`, you must read what `Country` looks like)

You MUST output a Source Files Read Log (defined in the pass-specific agent file) before writing any test that touches a Prisma model. If the log is missing, the test is invalid and must be discarded.

### Rule 2: Never import a real PrismaClient in a test

The project has a global Prisma mock at `src/test/setup.ts`. EVERY test that touches Prisma must use this global mock by importing from `@/lib/prisma`, never by importing `PrismaClient` from `@prisma/client` and creating a new instance.

If you find yourself writing `new PrismaClient()` in a test file, STOP. That test will bypass the global mock, hit the real database, and break in ways that look like application bugs but are actually just wrong test setup.

If the existing project has no Prisma-touching tests yet and you cannot determine the mocking pattern from existing tests, STOP and ask before writing.

### Rule 3: Never test database-enforced behaviors

The following behaviors are enforced by Postgres and Prisma, NOT by application code, and must NEVER be the subject of a test:

- Cascade deletes (`onDelete: Cascade`)
- Unique constraints (`@@unique`)
- Foreign key relationships
- Default values (`@default(...)`)
- Database-level timestamps (`@default(now())`, `@updatedAt`)
- NOT NULL constraints
- Index existence or index performance
- Upsert atomicity
- Transaction isolation

These are guaranteed by the schema and the database engine. Writing tests for them is meaningless: with a mocked Prisma you are only testing your own mock; with a real Prisma you are only testing Postgres. Neither tests YOUR code.

If the only behaviors a phase introduces are database-enforced behaviors, that phase has nothing to test (see Rule 4).

### Rule 4: Skip your pass entirely when there is no application logic

A phase that consists ONLY of pure database changes (Prisma model additions, column additions, migrations, indexes) has no application logic to test. In that case, your pass produces ZERO test files. You output a summary stating "No application logic to test in this phase. This pass produces no test files." and stop.

The Phase Test Inventory gate (defined in each pass-specific agent file) enforces this. Do not skip the gate.

### Rule 5: Match the project's existing test patterns

Before writing a new test file, you MUST read at least 2 existing test files in the same area of the codebase and copy their import style, mocking style, and test data setup style. You output a Pattern Match Block (defined in the pass-specific agent file) before writing the new test. If the new test would deviate from the existing patterns, STOP and explain why before proceeding.

---

## HARD STOP — Prove you have read the spec before writing anything

Before writing a single test in either pass, you must find and read the specification file. These steps are numbered with an "S" prefix (S1, S2) to distinguish them from the pass-specific numbered steps in `test-writer-1.md` and `test-writer-2.md`.

### Step S1: Find the spec file

```bash
ls docs/specs/
```

Read the spec file for this feature. It will be in `docs/specs/` with a name matching the feature (e.g. `docs/specs/customer-invoice-settings.md`).

If no spec file exists in `docs/specs/` — STOP COMPLETELY and respond with:

"Cannot proceed — no specification file found in docs/specs/.

The spec file is the source of truth for all field names, business rules, and data requirements. Tests cannot be written without it because they would be based on assumptions rather than confirmed requirements.

Please run the business-analyst agent first to create and save the spec."

Do NOT proceed. Do NOT invent field names. Do NOT assume requirements.

### Step S2: Output the Spec Confirmation Block

After reading the spec file, you MUST output this block before writing any tests. This proves you are working from the confirmed spec, not from memory or assumptions.

```
---
SPEC CONFIRMATION
Spec file read: docs/specs/[filename].md
Feature name: [from spec]
Status: [from spec — must say Confirmed, not Draft]

Fields I will write tests for (copied exactly from the spec Data Requirements table):
| UI Label | Field Name | Type | Required |
|---|---|---|---|
| [copy each row from the spec] | ... | ... | ... |

Business rules I will write tests for (copied from the spec):
1. [rule 1 copied exactly]
2. [rule 2 copied exactly]
[continue for all rules]

Definition of Done items I will write tests for:
1. [item 1 copied exactly]
2. [item 2 copied exactly]
[continue for all items]
---
```

If the spec status is still "Draft" — STOP and respond with:

"The specification is still in Draft status. Tests cannot be written against a draft spec because the requirements may still change, which would make the tests wrong.

Please confirm the spec with the business-analyst agent first, then re-run the test-writer."

Do not write tests against a draft spec under any circumstances.

---

## Critical TDD rule

All tests you write in Pass 1 will FAIL when first created. This is correct and expected. Do not try to make them pass. The implementer's job is to make them pass. Your job is to write tests that are precise, complete, and based entirely on the spec file — not on assumptions.

In Pass 2, tests are written after the implementer has finished, so tests you write in Pass 2 should pass immediately when they are written correctly. If a Pass 2 test fails, the failure is telling you something — either your mock is wrong, your assertion is wrong, or the implementer's code has a bug. Do not try to "make the test pass" by changing the test. Investigate the failure and report it.

---

## Bug Fix Regression Tests — CRITICAL RULES

When writing tests for a bug fix (via `/fix-bug` or any bug fix pipeline), regression tests follow different rules than new feature tests. Get this wrong and the test is useless.

### The One Rule

**A regression test ALWAYS asserts the CORRECT behavior — the behavior that should exist AFTER the fix is applied.**

This means:

- The test FAILS before the fix (proving the bug exists)
- The test PASSES after the fix (proving the bug is resolved)
- The test requires ZERO modifications between those two states

### What "proves the bug exists" actually means

- **CORRECT:** Write a test that expects correct output → test fails now because the bug produces wrong output → implementer fixes the code → test passes. The failing test IS the proof the bug exists.
- **WRONG:** Write a test that expects buggy output → test passes now → have to rewrite the test after the fix. This is backwards and defeats the purpose.

### Verify the actual output, not the function calls

Regression tests must check the **end result**, not whether intermediate functions were called:

- **CORRECT:** Assert that the final state/output matches expected values
- **WRONG:** Assert that `setSearchFieldValues` was called with certain arguments
- **WRONG:** Assert that a mock function was invoked N times

If the test would still pass when the bug is reintroduced, the test is useless. The litmus test: delete the fix code → does the test fail? If not, rewrite it.

### Example — correct regression test

```typescript
// Bug: field values stored by name but looked up by ID, so fields appear blank
// This test asserts CORRECT behavior — it will FAIL before the fix

it('REGRESSION TEST: draft order search fields are keyed by field ID not field name', () => {
  // Setup: API returns data with fieldName: "School Name"
  // Setup: Requirements return field with id: "uuid-123", name: "School Name"

  // Act: load the order for editing

  // Assert CORRECT behavior (will fail before fix, pass after):
  expect(searchFieldValues[itemId]["uuid-123"]).toBe("U of W");

  // Do NOT assert buggy behavior like:
  // expect(searchFieldValues[itemId]["School Name"]).toBe("U of W");  // WRONG
});
```

### Self-check before submitting regression tests

Before reporting tests as complete, answer these three questions:

1. Does each regression test assert the CORRECT (post-fix) behavior? If it asserts the buggy behavior, rewrite it.
2. Will each regression test FAIL right now without the fix applied? If it passes before the fix, it cannot prove the bug exists. Rewrite it.
3. Will each regression test PASS after the fix WITHOUT any modifications to the test? If the test needs to be changed after the fix, it was written wrong. Rewrite it.

If the answer to all three is yes, the regression test is correct.

---

## Platform reference

**Tech stack:** Next.js 14, TypeScript (strict mode), Prisma, PostgreSQL, NextAuth.js, Zod, React Hook Form

**Testing tools available:**

- Vitest — for unit tests and API route tests
- React Testing Library — for component tests
- Playwright — for end-to-end user flow tests

**Standards:** Always read `docs/CODING_STANDARDS.md` and `docs/TESTING_STANDARDS.md` before writing tests.

**Test file locations:**

- Unit tests: place alongside the file being tested, e.g. `src/lib/orderUtils.test.ts`
- API route tests: `src/app/api/[resource]/__tests__/route.test.ts`
- Component tests: alongside the component, e.g. `src/components/customers/CustomerForm.test.tsx`
- End-to-end tests: `tests/e2e/[feature].spec.ts`

---

## What comes next

After reading this shared file in full, return to your pass-specific agent file (`test-writer-1.md` or `test-writer-2.md`) and continue from where that file tells you to go. The pass-specific file will define its own numbered steps, its Phase Test Inventory gate, its Source Files Read Log template, its Pattern Match Block template, and its completion report format.