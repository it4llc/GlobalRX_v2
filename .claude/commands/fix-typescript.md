# .claude/commands/fix-typescript.md

# /fix-typescript

Use this command to work through TypeScript errors in organized batches. It cleans up type safety issues — it does not add new features or change how the application behaves. Each stage requires your explicit CONTINUE before anything proceeds.

---

## How to use this command

```
/fix-typescript
```

No arguments needed. The pipeline discovers and categorizes all errors automatically.

---

## Why this pipeline exists

TypeScript errors are dangerous to fix carelessly. A "fix" that simply silences an error (by writing `any` or adding `// @ts-ignore`) makes the problem invisible without actually solving it. This pipeline ensures every fix is real, every batch is verified, and nothing that was working gets broken in the process.

---

## Before starting — git setup

Before Stage 1 begins, the file-explorer must confirm the correct branch is in place:

```bash
# Confirm you are on dev
git branch --show-current

# Create a fix branch from dev
git checkout -b fix/typescript-cleanup
```

All work in this pipeline happens on the `fix/typescript-cleanup` branch. The implementer must commit after every batch is complete and verified:

```bash
git add -A
git commit -m "fix(types): resolve [Category Name] errors"
```

This means if a batch introduces unexpected problems, there is always a clean commit to roll back to. Do not let multiple batches accumulate without committing.

When the pipeline is complete and Stage 3 passes, merge back to dev:

```bash
git checkout dev
git merge fix/typescript-cleanup
```

---

## Stage 1 — Categorize all errors

**Agent: file-explorer**

The file-explorer will:

1. Run the TypeScript checker and capture the full output:
   ```bash
   pnpm typecheck 2>&1 | tee ts-errors-raw.txt
   ```

2. Count the total errors:
   ```bash
   pnpm typecheck 2>&1 | tail -5
   ```

3. Group errors into named categories. Examples of common categories:
   - **Implicit `any` types** — variables or parameters with no type declared at all
   - **Missing type imports** — types used but not imported from the correct location
   - **Null/undefined not handled** — code that assumes a value exists when it might not
   - **Wrong prop types** — components receiving props that don't match their defined types
   - **Missing return types** — functions that don't declare what type they return
   - **Prisma type mismatches** — database query results used as the wrong type
   - **`any` used explicitly** — someone wrote `: any` or `as any` as a shortcut

4. For each category, report:
   - Category name
   - Number of errors in that category
   - Example error message (real, from the output)
   - Which files are most affected
   - Estimated fix complexity (Low / Medium / High)
   - Risk of the fix breaking something (Low / Medium / High)

5. Produce an **Error Category Report:**

---

```
# TypeScript Error Category Report
Date: [today's date]

## Total errors: [exact number from pnpm typecheck output]
## Target: fewer than 100 documented suppressions with strict mode enabled

## Categories (recommended fix order)

### 1. [Category Name] — [n] errors
Example error:
  [paste one real error message including file path and line number]
Files most affected: [list]
Fix complexity: Low / Medium / High
Fix risk: Low / Medium / High
Reason for this fix order: [why this should be fixed first]

### 2. [Category Name] — [n] errors
[same structure]

[continue for all categories]

## Recommended fix order
Fix in this sequence to prevent fixes from introducing new errors:
1. [Category] — [n] errors — [one sentence on why first]
2. [Category] — [n] errors
...

## Errors that may need a documented suppression (not a code fix)
[List any errors where the correct answer is a justified @ts-ignore with explanation.
These must be documented — not just added silently.]

## Total errors expected to be fixable by code changes: [n]
## Total errors expected to need documented suppressions: [n]
```

---

After the report is presented, Andy must review the category plan.

**→ Andy types CONTINUE to approve the plan and begin Stage 2.**

---

## Stage 2 — Fix one category at a time

**Agent: implementer**

The implementer fixes one category per batch. It does not move to the next category until Andy types CONTINUE.

### Before starting each batch, the implementer must:

1. State clearly which category is being fixed
2. Get the exact current error count:
   ```bash
   pnpm typecheck 2>&1 | tail -3
   ```
3. List every file that will be changed
4. Describe the fix approach in plain English before touching anything

### Rules for fixing TypeScript errors

- **Never use `any` to silence an error.** Using `any` is not a fix — it is hiding the problem. The standards-checker will flag every `any` in Stage 3.
- **Never add `// @ts-ignore` without a written justification.** If a suppression is truly necessary, it must be accompanied by a comment explaining exactly why, and it must be added to `docs/standards/ts-suppressions.md`. Maximum 100 suppressions total across the whole project.
- **Fix the type, not the check.** If TypeScript says a value might be null, handle the null case in the code — do not cast the value to a non-null type just to stop the error.
- **Use Prisma's generated types.** Do not create manual types for database results — use the types Prisma generates automatically.
- **Shared types belong in `/src/types/`.** If a type is used in more than one file, it must be defined there — not redefined in each file that uses it.
- **Run `pnpm test` after every batch.** TypeScript fixes can silently change behavior. Tests must still pass after every batch — not just at the end.

### After completing each batch, the implementer must:

1. Run the TypeScript checker:
   ```bash
   pnpm typecheck 2>&1 | tail -5
   ```

2. Run the full test suite:
   ```bash
   pnpm test 2>&1 | grep -E "Tests:|Test Suites:"
   ```

3. Produce a **Batch Completion Block** — this is mandatory and cannot be skipped:

```
# Batch Completion Block — [Category Name]

## TypeScript errors
- Before this batch: [exact number from terminal output]
- After this batch: [exact number from terminal output]
- Errors eliminated: [n]

## Test results after this batch
- Passing: [exact number from terminal output]
- Failing: [exact number from terminal output]
- Tests broken by this batch: [Yes / No]
If yes — list them. This is a critical problem and must be resolved before continuing.

## Files changed
- [file path] — [what type problem was fixed and how]

## Suppressions added this batch: [n]
If any — list each one with its justification and confirm it was added to docs/standards/ts-suppressions.md

## Next recommended category: [name]
```

The implementer pastes the **actual terminal output** for both the TypeScript check and the test run. No estimated or remembered numbers. If terminal output is not pasted, the batch is not considered complete.

**→ Andy reviews the Batch Completion Block and types CONTINUE to move to the next category.**

---

### Failure Loop Protocol — when a batch cannot be fixed

If the implementer attempts a fix and errors remain or new errors appear, the following protocol applies.

**After the first failed attempt:**
Continue trying. Try a different approach and document what was attempted.

**After the second failed attempt on the same category:**
Stop and produce a **Diagnostic Block** before trying again:

```
# Diagnostic Block — [Category Name]

## Attempts made
1. [What was tried] — Result: [what happened]
2. [What was tried] — Result: [what happened]

## Why these attempts failed
[Plain English explanation of what is blocking the fix]

## What more investigation is needed
[Specific questions or unknowns that are preventing a fix]

## Recommended next step
[One of: try approach X / escalate to file-explorer for deeper investigation / flag for Andy]
```

**After the third failed attempt on the same category:**
Full stop. Do not attempt a fourth fix. Produce a **Category Escalation Report** and wait for Andy:

```
# Category Escalation Report — [Category Name]

## This category cannot be fixed without further investigation.

## Attempts made: 3
1. [What was tried] — Result: [what happened]
2. [What was tried] — Result: [what happened]
3. [What was tried] — Result: [what happened]

## Current state
- Errors in this category after 3 attempts: [n]
- Errors eliminated so far: [n]

## What is blocking the fix
[Plain English — what is the implementer stuck on]

## Options for Andy
A) Ask the file-explorer to do deeper investigation on this category before retrying
B) Skip this category for now and move to the next one — come back later
C) Escalate to a developer for manual investigation outside this pipeline

Andy must choose A, B, or C before the pipeline continues.
```

---

## Stage 3 — Standards verification

After all batches are complete, Andy types **CONTINUE** one final time to trigger Stage 3.

**Agent: standards-checker**

After all batches are complete, the standards-checker runs a TypeScript-specific compliance check before this work is considered done.

The standards-checker will:

1. Read the Stage 1 baseline number from the file saved at the start:
   ```bash
   tail -5 ts-errors-raw.txt
   ```
   This is the source of truth for how many errors existed when `/fix-typescript` was run. Use this number in the report — do not rely on memory.

2. Run the final TypeScript check:
   ```bash
   pnpm typecheck 2>&1 | tail -5
   ```

2. Count any suppressions added:
   ```bash
   grep -r "@ts-ignore\|@ts-expect-error" src/ --include="*.ts" --include="*.tsx" | wc -l
   ```

3. Check for `any` usage:
   ```bash
   grep -rn ": any\|as any\|<any>" src/ --include="*.ts" --include="*.tsx"
   ```

4. Verify suppressions file exists and is documented:
   ```bash
   cat docs/standards/ts-suppressions.md
   ```

5. Run a final test suite check:
   ```bash
   pnpm test 2>&1 | grep -E "Tests:|Test Suites:"
   ```

6. Produce the **TypeScript Cleanup Verification Report:**

```
# TypeScript Cleanup Verification Report
Date: [today's date]

## Error count
- Errors at start of /fix-typescript: [n — read from ts-errors-raw.txt, not from memory]
- Errors now: [exact number from terminal output]
- Errors eliminated: [n]

## Suppression audit
- Total @ts-ignore / @ts-expect-error in codebase: [n]
- Maximum allowed: 100
- Each suppression has a written justification: Yes / No
- Suppressions are logged in docs/standards/ts-suppressions.md: Yes / No

## `any` type audit
Files still using `: any` or `as any`:
- [list each file and line, or "None found"]

Each of the above is a violation and must be resolved before this work is complete.

## Test suite
- Passing: [n]
- Failing: [n]
- Tests broken during TypeScript cleanup: [Yes / No]

## Strict mode status
- Is `"strict": true` enabled in tsconfig.json? [Yes / No]
- If No — what is still blocking strict mode? [explain]

## Verdict
[ ] ✅ Cleanup complete — error count reduced, no any types, suppressions documented, all tests passing
[ ] ⚠️  Mostly complete — minor issues listed above, recommend resolving before merging
[ ] ❌ Violations found — `any` types or undocumented suppressions present, must fix before done
```

---

## Important rules for this entire pipeline

- Every stage transition requires Andy to type **CONTINUE**
- No agent may self-report error counts — all numbers must come from actual terminal output
- No agent may mark a batch complete without pasting both TypeScript and test terminal output
- Using `any` or `// @ts-ignore` without documentation is a violation — the standards-checker will catch it
- If a fix causes previously passing tests to fail, the pipeline **stops** and must be resolved before Andy types CONTINUE
- The implementer must not fix more than one category per CONTINUE — one batch, one gate
