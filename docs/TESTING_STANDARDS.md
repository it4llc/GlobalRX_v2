# /GlobalRX_v2/docs/TESTING_STANDARDS.md
# GlobalRx Platform — Testing Standards & TDD Workflow

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the testing rules and Test-Driven Development (TDD) workflow that MUST be followed when writing tests or implementing features in the GlobalRx platform. These standards are not suggestions — they are requirements.

For general coding rules, see `CODING_STANDARDS.md`.
For API-specific rules referenced by API tests, see `API_STANDARDS.md`.
For database invariants that tests must respect, see `DATABASE_STANDARDS.md`.

---

## SECTION 1: Test-Driven Development

### 1.1 The Workflow — In Order

#### Phase 1: Confirm Requirements

Before writing any tests, confirm the business requirements with the user. Document them clearly. Get explicit confirmation that the requirements are correct. Never assume — ask.

Examples of when to ask:
- "Should orders in `pending` status be editable?"
- "What happens when a customer is deactivated but has active orders?"
- "Should admin users bypass this validation rule?"
- "Is this field required for all customer types or only specific ones?"

This phase replaces guesswork. The cost of one clarifying question is small; the cost of writing tests against the wrong understanding is the entire feature.

#### Phase 2: RED — Tests First

Write all tests before any implementation. Run them. Confirm they all fail. If any test passes before implementation, the test is wrong — it's either testing something that already exists or it's not actually testing the new behavior.

Document what each test is testing and why it should fail at this stage.

#### Phase 3: GREEN — Minimal Implementation

Write only enough code to make one test pass at a time. Run the tests after each small change. Do not write the full implementation in one pass — incremental change is what makes the workflow work. Commit after each test goes green if you find that helpful.

#### Phase 4: REFACTOR

Refactor only after all tests are green. Keep running the tests as you refactor. Improve the code without changing behavior. If a refactor breaks a test, the refactor is wrong, not the test.

### 1.2 Common TDD Mistakes to Avoid

- ❌ Writing implementation and tests at the same time
- ❌ Writing all the implementation before running any tests
- ❌ Assuming business requirements without confirmation
- ❌ Skipping the RED phase (tests must fail before implementation)
- ❌ Treating a passing test count as proof of correctness without manually verifying the feature works in the browser

---

## SECTION 2: Pre-Implementation Discovery

Before writing tests or code, verify what the actual user flow looks like. Code that targets the wrong file is worse than no code — it produces "passing tests" that prove nothing.

### 2.1 The Five-Minute Rule

Test the actual user flow within five minutes of starting work. If the current behavior doesn't match your assumptions, stop and investigate before going further.

### 2.2 The Discovery Checklist

For any user-facing change:

1. **Manually walk the actual flow.** Log in as the target user type. Navigate through the flow as a real user would. Document the starting URL, each click, the URLs that result, and which components render.
2. **Find the right files.** Don't assume — verify with multiple search patterns:
   ```bash
   grep -r "ComponentName\|buttonText\|onClick" --include="*.tsx"
   git grep -l "OrderDetails\|ViewOrder"
   grep -r "<ComponentName" --include="*.tsx"
   ```
   Find every instance, not just the first one.
3. **Verify every assumption.** Can you answer:
   - What page does the user actually start from?
   - What button do they actually click?
   - Which file handles that interaction?
   - Did I test this by clicking it myself, or am I reading code and guessing?
   - Are there multiple paths to the same feature?

### 2.3 Common Discovery Failures

- Updating `/portal/orders` when users actually use `/portal/dashboard`
- Modifying a component that isn't actually rendered on the page in question
- Assuming the navigation flow without walking it
- Writing 80 tests against a file that turns out to be the wrong file

### 2.4 Discovery Is Done When You Can Say...

- "I clicked X button on Y page and it did Z."
- "The code for this is in file A at line B."
- "I verified this by actually doing it, not by reading code."

---

## SECTION 3: Test-Writer Two-Pass Discipline

This project uses a two-pass test-writing pattern to keep test-writer responsibilities separated by what's known when. The pattern exists because mixing "what should the contract be" tests with "what does the implementation actually expose" tests in the same pass produces brittle tests, fabricated mocks, and tests that pass against nothing real.

### 3.1 Pass 1 — Contract Tests Before Implementation

**When:** before the implementer runs.
**Scope:** schema validation, Zod schemas, end-to-end (e2e) browser tests, and any tests that exercise behavior that can be defined purely from the architect's plan.

Pass 1 tests describe the contract — what the feature is supposed to do — not the internal mechanics of how the implementer will achieve it.

**Pass 1 must not:**
- Mock components, services, or API routes that don't exist yet
- Invent function signatures the implementer hasn't written
- Use `throw new Error('EXPECTED PASS 1 FAILURE')` or similar early-exit stubs to "make the test fail"
- Add tests beyond the count and scope the architect's plan specified

If a Pass 1 test cannot be written without inventing implementation details, it is not a Pass 1 test. Defer it to Pass 2.

### 3.2 Pass 2 — Mock-Backed Tests After Implementation

**When:** after the implementer has produced the production code and the agent can read the actual function signatures, exports, and module structures.
**Scope:** component tests, API route tests, service tests — anything that needs mocks of real, existing modules.

Pass 2 mocks must be derived from reading the actual source files the implementer wrote. **Never write mocks based on what the architect's plan said the function should look like.** The plan is intent; the source is reality. When they diverge, the source wins.

### 3.3 Why This Discipline Exists

Mixing Pass 1 and Pass 2 in a single test-writer run produces a recurring failure pattern: the test-writer needs mocks for an API route that doesn't exist yet, fabricates the route's shape, and writes "passing" tests against the fabrication. The implementer then writes the real route with a different shape, and the tests still pass — against the wrong mock — until the feature ships and breaks in production.

Splitting the passes makes each pass writable from real information: Pass 1 from the plan, Pass 2 from the source.

---

## SECTION 4: Business Logic Clarification

Never assume business requirements or business logic. When the rules are unclear:

1. **Ask for clarification** rather than guessing
2. **Confirm assumptions** before writing implementation
3. **Document complex business decisions** in code comments
4. **Validate edge cases** with explicit user confirmation

This is the same principle as Phase 1 of the TDD workflow (Section 1.1). It applies any time business behavior is in question — not only at the start of a feature.

---

## SECTION 5: Refactoring Existing Code

When refactoring code that is already shipped:

1. **Understand the current behavior first** — read the existing tests, ask about behavior that isn't documented
2. **Maintain backward compatibility** unless explicitly told otherwise
3. **Extract business logic** into testable services or hooks
4. **Ask before changing any business behavior**, even if the existing behavior looks like a bug — it may be load-bearing somewhere you can't see

---

## SECTION 6: Testing Stack and Coverage

### 6.1 The Stack

- **Unit tests** — Vitest for utilities and services
- **Component tests** — React Testing Library for UI components
- **Integration tests** — API route testing with a test database
- **End-to-end tests** — Playwright for critical user workflows

### 6.2 Coverage Targets

- **New code** — 100% test coverage required
- **Legacy code** — add tests when modifying existing code, even if no tests existed before
- **Critical paths** — authentication, permissions, and order processing must always have tests

### 6.3 Test Organization

```
src/
├── __tests__/                  # Unit tests
├── components/
│   └── __tests__/              # Component tests
└── app/api/
    └── __tests__/              # API route tests
```

Regression tests must be labeled with a `// REGRESSION TEST:` comment naming the bug or PR they came from. Regression tests must be confirmed failing before the fix and passing after, and must never be deleted.

---

## SECTION 7: Mocking Discipline

### 7.1 Never Import the Real Prisma Client in Tests

This project mocks Prisma globally via `src/test/setup.ts`. Test files must use the global mock — never import or instantiate `PrismaClient` directly.

```typescript
// ❌ WRONG — bypasses the global mock, hits the real database
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ✅ CORRECT — use the project's mocked prisma instance
import { prisma } from '@/lib/prisma';
```

**Why this matters:** a test that hits a real database is not a unit test, can fail nondeterministically based on data state, and silently pollutes the database between test runs. Even worse, a test that *almost* hits a real database (because of a typo in the import path that bypasses the mock) will pass for the wrong reason in CI and fail mysteriously in another environment.

### 7.2 Mocking Node.js Built-In Modules (Vitest ESM)

When testing code that uses Node.js built-in modules (`fs`, `fs/promises`, `path`, `crypto`, etc.), special care is required because of how Vitest's ESM mocks interact with Node module bindings.

**Implementation files must:**
- Use **default imports**: `import fs from 'fs'`
- Call through the module object: `fs.existsSync()`, NOT `existsSync()`
- Named imports like `import { existsSync } from 'fs'` will NOT work — the binding gets locked at import time and the mock cannot intercept it.

**Test mock factories must:**
- Provide each mocked function on **both** the `default` object **and** as a named export
- This makes the mock work with both implementation patterns and any test utilities that use named imports

**Reference pattern:**
```typescript
// For the fs module
vi.mock('fs', () => {
  const existsSyncFn = vi.fn().mockReturnValue(false);
  return {
    default: { existsSync: existsSyncFn },
    existsSync: existsSyncFn,
  };
});

// For the fs/promises module
vi.mock('fs/promises', () => {
  const writeFileFn = vi.fn();
  const mkdirFn = vi.fn();
  return {
    default: { writeFile: writeFileFn, mkdir: mkdirFn },
    writeFile: writeFileFn,
    mkdir: mkdirFn,
  };
});
```

**Why this is required:** Vitest in ESM mode cannot reliably override named export bindings from Node.js built-in modules. The production import creates a direct binding that cannot be mocked after import. Using default imports with object-property access allows the mock to intercept the call.

### 7.3 Mocking Application Modules (Pass 2 Only)

When mocking application modules — services, API routes, components — the mock must be derived from reading the actual source file the implementer wrote. **Do not write mocks based on the architect's plan.** Read the file. Match the real exports, the real function signatures, and the real return shapes.

If the test needs a mock for a module that doesn't exist yet, the test belongs in Pass 2, not Pass 1 (see Section 3).

---

## SECTION 8: API Route Test Verification

Before writing any test for an API route, verify that the route actually exists in the codebase. Do not assume a route exists based on what the feature requires or what would make logical sense.

### 8.1 The Required Check

```bash
# Verify the route file exists before writing tests for it
find src/app/api -name "route.ts" | grep "the-path-you-expect"
```

### 8.2 The Rules

- **Tests target the actual route path the application uses** — not a path you created to make tests pass
- **For portal/customer features**, routes live under `/api/portal/`
- **For fulfillment features**, routes live under `/api/fulfillment/`
- **For admin features**, routes live under `/api/admin/`
- **Never create a new route file just to have something to write tests against.** If your test fails because the route doesn't exist, the answer is to either (a) write the route as production code, with the architect's approval, or (b) change the test to target the route that does exist.

### 8.3 Why This Matters

A test that targets `/api/orders/` when the application actually uses `/api/portal/orders/` proves nothing. The real code path is never exercised, real bugs are never caught, and the implementer may end up creating a duplicate route just to satisfy the test — introducing dead code and a false sense of security.

This is the same root rule as Coding Standards Section 1.5: **never create files just to make tests pass.**

### 8.4 When the Route Doesn't Exist Yet (TDD Pass 1)

If you're writing tests before the route exists (Pass 1, see Section 3), make sure the test targets the path specified in the architect's plan — not a path you invented. Check `docs/specs/` for the planned route before writing the test.

---

## SECTION 9: Trustworthy Test Reporting

The pipeline depends on accurate test results. Self-reported counts are not test results — actual command output is.

### 9.1 The Required Discipline

- **Always run the full test suite** before marking any implementer stage complete: `pnpm vitest run` with no path argument. A change to a shared component can break tests in unrelated files; a scoped run will miss it.
- **Paste the raw command output**, not a summary. "All tests pass" is not evidence; the actual output of `pnpm vitest run` is.
- **A net regression is never acceptable progress.** If the failing test count increases compared to before your change, the change is wrong. Stop. Do not "make progress" through new failures.
- **Browser verification after passing tests is mandatory** for any user-facing change. Passing tests do not prove the feature works — they prove the tests pass. Click through the actual flow.

### 9.2 Self-Reports Are Not Acceptable

Phrases like "all 87 tests passing" or "zero violations found" without raw command output are not acceptable evidence. The pipeline has a long history of fabricated test counts and false "verified" reports — the discipline of pasting raw output exists because it's the only thing that catches the failure mode.

---

## SECTION 10: Test Quality

A test should be:

- **Independent** — runs correctly in any order, with no dependency on the order tests ran in or on global state from previous tests
- **Deterministic** — produces the same result every time it's run, with no reliance on real time, real network, or real randomness
- **Targeted** — tests one thing, named so the failure message tells you what broke
- **Honest** — fails when the behavior is wrong; doesn't pass for accidental reasons (mocked-away assertions, returns that aren't checked, etc.)

Test data should use factory patterns or fixtures rather than inline literals scattered through the file. A test that uses `createOrderFixture({ status: 'submitted' })` is much easier to update when the order schema changes than fifteen tests that each construct their own order object.

---

## TESTING STANDARDS CHECKLIST

### TDD process:
- [ ] Business requirements confirmed with user before writing tests
- [ ] Discovery completed — actual user flow walked, not assumed
- [ ] Tests written BEFORE implementation
- [ ] All tests failing initially (RED phase confirmed)
- [ ] Implementation done incrementally — one test green at a time
- [ ] Refactoring only after all tests green
- [ ] Feature manually tested in the browser after implementation

### Two-pass discipline:
- [ ] Pass 1 tests cover only schema, Zod, and e2e — no mocks of unwritten modules
- [ ] No early-exit stubs (`throw new Error('EXPECTED PASS 1 FAILURE')` or similar) in Pass 1 tests
- [ ] Pass 1 test count and scope match the architect's plan exactly
- [ ] Pass 2 mocks derived from reading the actual source files, not from the plan

### Mocking:
- [ ] No direct `import { PrismaClient } from '@prisma/client'` in test files
- [ ] Prisma access uses the project's mocked `prisma` instance
- [ ] Node.js built-ins use default imports in production code (`import fs from 'fs'`) and module-object access (`fs.existsSync()`)
- [ ] Built-in module mocks expose functions on both `default` and as named exports
- [ ] Application module mocks match the real exports of the file being mocked

### API route tests:
- [ ] Route file existence verified before writing tests for it
- [ ] Tests target the actual route path the app uses (`/api/portal/...`, `/api/fulfillment/...`, `/api/admin/...`)
- [ ] No new route files created just to satisfy a test
- [ ] Pass 1 tests for routes that don't exist yet target the path from `docs/specs/`

### Reporting and verification:
- [ ] Full test suite run (`pnpm vitest run`) before declaring any stage complete
- [ ] Raw command output pasted, not summarized
- [ ] No net regressions (failing test count did not increase)
- [ ] Browser verification done for any user-facing change

### Test quality:
- [ ] Tests are independent and run correctly in any order
- [ ] Tests are deterministic (no real time, network, or randomness)
- [ ] Test data uses factories or fixtures, not inline literals
- [ ] Regression tests are labeled `// REGRESSION TEST:` and never deleted