# /GlobalRX_v2/docs/TESTING_STANDARDS.md
# GlobalRx Platform — Testing Standards & TDD Workflow

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the testing standards and Test-Driven Development (TDD) workflow
that MUST be followed when writing tests or implementing features in the GlobalRx platform.
These standards are not suggestions — they are requirements.

---

## SECTION 1: Test-Driven Development (TDD)

**ALWAYS follow TDD principles for new features and refactoring:**

### 1.1 TDD Workflow - MUST FOLLOW IN ORDER

#### Phase 1: REQUIREMENTS (Ask First!)
- **ALWAYS confirm business requirements with user BEFORE writing tests**
- Document the requirements clearly
- Get explicit confirmation that requirements are correct

#### Phase 2: RED (Tests First)
- Write ALL tests before ANY implementation
- Run tests to confirm they ALL fail (should see RED in test output)
- If any test passes before implementation, the test is likely wrong
- Document what each test is testing and why it should fail
- **⚠️ CRITICAL: Fix or remove failing tests before proceeding to GREEN phase**

#### Phase 3: GREEN (Minimal Implementation)
- Write ONLY enough code to make one test pass at a time
- Run tests after each small change
- Do NOT write the full implementation at once
- Commit after each test goes green (optional but recommended)

#### Phase 4: REFACTOR
- Only refactor AFTER all tests are green
- Keep running tests to ensure nothing breaks
- Improve code quality without changing behavior

### 1.2 TDD Checklist (MUST complete in order)
- [ ] Pre-implementation discovery completed?
- [ ] Requirements confirmed with user?
- [ ] Business logic clarified (no assumptions)?
- [ ] Tests written first?
- [ ] ALL tests failing initially (RED)?
- [ ] ALL tests passing before moving to implementation?
- [ ] Implementation done incrementally (one test at a time)?
- [ ] Each test made green one at a time?
- [ ] Feature manually tested before declaring complete?
- [ ] Refactoring done only after all green?

### 1.3 Common TDD Mistakes to Avoid
- ❌ Writing implementation and tests at the same time
- ❌ Writing all implementation before running tests
- ❌ Assuming business requirements without confirmation
- ❌ Skipping the RED phase (tests should fail first)

---

## SECTION 2: Pre-Implementation Discovery

### 2.1 CRITICAL: Complete Discovery BEFORE Writing Tests

**⚠️ MANDATORY: Complete discovery BEFORE writing any code or tests**

#### The 5-Minute Rule
**"Test the actual user flow within 5 minutes of starting work"**

If the current behavior doesn't match your assumptions, STOP and investigate.

### 2.2 Discovery Checklist (Required for ALL user-facing changes)

1. **Manual Testing First**
   ```bash
   # Log in as the target user type
   # Navigate through the ACTUAL flow
   # Document:
   - Starting URL
   - Each click/action taken
   - Resulting URL changes
   - Which components render
   ```

2. **Find the RIGHT Files**
   ```bash
   # Don't assume - VERIFY with multiple search patterns
   grep -r "ComponentName\|buttonText\|onClick" --include="*.tsx"

   # Find ALL instances, not just the first one
   git grep -l "OrderDetails\|ViewOrder"

   # Check component usage
   grep -r "<ComponentName" --include="*.tsx"
   ```

3. **Verify Every Assumption**
   - [ ] What page does the user ACTUALLY start from?
   - [ ] What button/link do they ACTUALLY click?
   - [ ] What file handles that interaction?
   - [ ] Did I test this by clicking through it myself?
   - [ ] Are there multiple paths to the same feature?

### 2.3 Common Discovery Failures to Avoid
- ❌ Updating `/portal/orders` when users actually use `/portal/dashboard`
- ❌ Modifying a component that isn't actually rendered
- ❌ Assuming navigation flow without testing it
- ❌ Writing 80 tests before verifying you're in the right file

### 2.4 When Discovery is Complete
You should be able to answer:
- "I clicked X button on Y page and it did Z"
- "The code for this is in file A at line B"
- "I verified this by actually doing it, not by reading code"

---

## SECTION 3: Business Logic Clarification

**NEVER assume business requirements or logic. Always:**

1. **Ask for clarification** when business rules are unclear
2. **Confirm assumptions** before implementing business logic
3. **Document business decisions** in code comments when complex
4. **Validate edge cases** with explicit user confirmation

Examples of when to ask:
- "Should orders in 'pending' status be editable?"
- "What happens when a customer is deactivated but has active orders?"
- "Should admin users bypass this validation rule?"
- "Is this field required for all customer types or only specific ones?"

---

## SECTION 4: Refactoring Guidelines

When refactoring existing code:
1. **Understand current behavior first** - Read tests, ask about undocumented behavior
2. **Maintain backward compatibility** unless explicitly told otherwise
3. **Extract business logic** into testable services/hooks
4. **Ask before changing** any business behavior, even if it seems like a bug

---

## SECTION 5: Testing Requirements

**Current State:** The codebase has zero test coverage, which is a critical enterprise readiness gap.

### 5.1 Testing Requirements

All new code must include appropriate tests. No pull requests will be accepted without tests.

**Testing Stack:**
- **Unit tests:** Vitest for utilities and services
- **Component tests:** React Testing Library for UI components
- **Integration tests:** API route testing with test database
- **E2E tests:** Playwright for critical user workflows

### 5.2 Test Coverage Targets

- **New code:** 100% test coverage required
- **Legacy code:** Add tests when modifying existing code
- **Critical paths:** Authentication, permissions, order processing must have tests

### 5.3 Test Organization

```
src/
├── __tests__/              # Unit tests
├── components/
│   └── __tests__/          # Component tests
└── app/api/
    └── __tests__/          # API route tests
```

---

## SECTION 6: Mocking Node.js Built-in Modules (Vitest ESM Mode)

When testing code that uses Node.js built-in modules (fs, fs/promises, path, crypto, etc.), special care must be taken due to ESM module binding limitations in Vitest:

### 6.1 Implementation Requirements
- Route/implementation files MUST use default imports: `import fs from 'fs'`
- Route code MUST call through the module object: `fs.existsSync()`, NOT `existsSync()`
- Named imports like `import { existsSync } from 'fs'` will NOT work because the binding gets locked at import time

### 6.2 Test Mock Requirements
- Mock factories MUST provide functions on BOTH the default object AND as named exports
- This ensures compatibility with both implementation patterns and test utilities

### 6.3 Example Mock Pattern
```javascript
// For fs module
vi.mock('fs', () => {
  const existsSyncFn = vi.fn().mockReturnValue(false);
  return {
    default: { existsSync: existsSyncFn },
    existsSync: existsSyncFn
  };
});

// For fs/promises module
vi.mock('fs/promises', () => {
  const writeFileFn = vi.fn();
  const mkdirFn = vi.fn();
  return {
    default: { writeFile: writeFileFn, mkdir: mkdirFn },
    writeFile: writeFileFn,
    mkdir: mkdirFn
  };
});
```

### 6.4 Why This Pattern Is Required
- Vitest in ESM mode cannot reliably override named export bindings from Node.js built-in modules
- The production import creates a direct binding that cannot be mocked after import
- Using default imports with object property access allows the mock to intercept calls

---

## SECTION 7: API Route Test Verification

Before writing any test for an API route, verify that the route actually exists
in the codebase. Do not assume a route exists based on what the feature requires
or what would make logical sense.

### 7.1 Required Check Before Writing API Tests
```bash
# Verify the route file exists before writing tests for it
find src/app/api -name "route.ts" | grep "the-path-you-expect"
```

### 7.2 Rules
- Tests must target the actual route path the application uses — not a path
  that you created to make tests pass
- For portal/customer features, routes live under `/api/portal/`
- For fulfillment features, routes live under `/api/fulfillment/`
- For admin features, routes live under `/api/admin/`
- Never create a new route file just to have something to write tests against

### 7.3 Why This Matters
A test that targets `/api/orders/` when the application actually uses
`/api/portal/orders/` proves nothing. The real code path is never exercised,
bugs are never caught, and the implementer may create a duplicate route just
to make the test pass — introducing dead code and a false sense of security.

### 7.4 When the Route Does Not Exist Yet
If you are writing tests before implementation (TDD), make sure the test
targets the path specified in the architect's plan — not a path you invented.
Check `docs/specs/` for the planned route before writing the test.

---

## TESTING CHECKLIST

### TDD Process:
- [ ] Business requirements confirmed with user
- [ ] Discovery completed (verified actual user flow)
- [ ] Tests written BEFORE implementation
- [ ] All tests failing initially (RED phase)
- [ ] Implementation done incrementally (one test at a time)
- [ ] Each test made green before moving to next
- [ ] Refactoring done only after all tests green
- [ ] Feature manually tested after implementation

### Test Quality:
- [ ] Tests cover happy path and edge cases
- [ ] API route exists before writing test for it
- [ ] Mocking follows ESM patterns for Node.js modules
- [ ] Test targets correct route path (portal/fulfillment/admin)
- [ ] Business logic documented in test descriptions
- [ ] No assumptions about business requirements
- [ ] Tests are independent and can run in any order
- [ ] Test data uses factory patterns or fixtures