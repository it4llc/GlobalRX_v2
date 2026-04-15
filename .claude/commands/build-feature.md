---
description: Runs the GlobalRx TDD pipeline ONE STAGE AT A TIME. After each stage completes, it commits the work as a checkpoint, stops completely, shows a summary, and waits for Andy to type CONTINUE before starting the next stage. Always describe the feature after the command.
allowed-tools: Task, Read, Write, Edit, Bash, Glob, Grep
---

# GlobalRx TDD Pipeline

## BEFORE DOING ANYTHING ELSE

Check whether a feature description was provided after the command.

If NO description was provided — STOP and respond with only this:

"What feature would you like to build? Please describe it in plain English,
for example: /build-feature I want to add invoice settings to the customer profile"

Do NOT proceed. Do NOT invent a feature. Wait for Andy to re-run with a description.

---

Only continue if $ARGUMENTS contains a real feature description.

The feature to build is: $ARGUMENTS

---

## CRITICAL INSTRUCTION — HOW THIS PIPELINE WORKS

This pipeline runs ONE STAGE AT A TIME.

After each stage completes, you MUST:
1. Commit the stage's work as a checkpoint (instructions in each stage)
2. Show the stage summary (using the exact format below)
3. STOP COMPLETELY
4. Wait for Andy to type CONTINUE
5. Do NOT start the next stage until CONTINUE is received

You are not permitted to start the next stage automatically.
You are not permitted to ask "shall I continue?" and then continue anyway.
You are not permitted to say "moving on to the next stage".
The only thing that unlocks the next stage is Andy typing CONTINUE.

If Andy types anything other than CONTINUE — answer their question or
address their concern, then show the stage summary again and wait again.

---

## CRITICAL INSTRUCTION — AGENT RULES MUST BE RE-INJECTED EVERY STAGE

At the start of EVERY stage below, before invoking the agent, you must remind
the agent of the absolute rules from its agent file. This is a defense against
context degradation in long pipeline runs.

Tell every agent at the start of every stage:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly. Do not skip this step."

If an agent skips the rule restatement, treat its work as untrustworthy and
ask it to start over with the restatement.

---

## CRITICAL INSTRUCTION — DESTRUCTIVE COMMANDS ARE FORBIDDEN

At no point during this pipeline may you (the orchestrator) or any agent run
any of the following commands:

- rm, rm -rf, rmdir, unlink
- git reset (any form, including --hard, --soft, HEAD)
- git clean (any form)
- git checkout -- . or git checkout . (the dot variants)
- git stash drop, git stash clear
- git rebase, git push --force, git push -f
- git branch -D
- Any command containing --force or -f against git history

The only allowed file recovery action is `git checkout HEAD -- <specific-file-path>`
restoring a single specific file. If you encounter a situation where you believe
you need a destructive command to recover, STOP and ask Andy. Andy will run any
recovery command himself.

This rule applies to every stage and every agent. If an agent attempts to run
a destructive command, stop the agent immediately and report it to Andy.

---

## STAGE 1: Business Analysis

Run the business-analyst agent now.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly.

Then, write a full feature specification for: $ARGUMENTS
Check docs/specs/ for any existing spec first.
Ask clarifying questions if anything is unclear before writing.
Use a table for the Data Requirements section with columns:
UI Label | Field Name | Type | Required | Validation | Default
Save the confirmed spec to docs/specs/[kebab-case-name].md when Andy approves it."

When the agent finishes, verify the spec file was saved:
```bash
ls docs/specs/
```

If the spec file is not in docs/specs/ — tell the business-analyst to save
it before this stage can close. Do not show the summary until the file exists.

### Stage 1 checkpoint commit

Once the spec file is confirmed saved, commit the work:

```bash
git add docs/specs/
git status
git commit -m "checkpoint(stage-1): business analysis complete - $ARGUMENTS"
```

If git status shows any files staged that are NOT in docs/specs/, STOP and
report to Andy before committing. Do not include unrelated changes in the
checkpoint commit.

Then show this summary and STOP:

---
STAGE 1 COMPLETE — Business Analysis

Spec file saved: docs/specs/[filename].md
Fields defined: [count]
Business rules defined: [count]
Open questions remaining: [count, or None]
Checkpoint commit: [commit hash]

What was done:
[2-3 sentences describing what the spec covers]

Before you type CONTINUE, please check:
- Do the field names match exactly what you expect?
- Are any fields missing?
- Are all the business rules correct?

If anything needs to change, tell me now and I will update the spec before we proceed.

Type CONTINUE to move to Stage 2 (Technical Planning).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 2: Technical Planning

Only run this stage after Andy has typed CONTINUE.

Run the architect agent.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly.

Then produce a full technical plan based on the specification at docs/specs/[filename].md.
Read that file completely before planning anything.
Read the existing codebase to understand what already exists.
Read docs/CODING_STANDARDS.md before planning.
Identify every file that needs to be created or changed.
List the implementation order clearly.
Save the plan to docs/specs/[filename]-technical-plan.md when complete."

### Stage 2 checkpoint commit

Once the technical plan file is saved, commit:

```bash
git add docs/specs/
git status
git commit -m "checkpoint(stage-2): technical plan complete"
```

If git status shows any files staged that are NOT in docs/specs/, STOP and
report to Andy before committing.

Then show this summary and STOP:

---
STAGE 2 COMPLETE — Technical Planning

Spec file used: docs/specs/[filename].md
Technical plan saved: docs/specs/[filename]-technical-plan.md
Checkpoint commit: [commit hash]

What needs to be built:
- New files: [count]
- Modified files: [count]
- Database changes: Yes / No
- New API routes: [count]
- New UI components: [count]

Implementation order the implementer will follow:
1. [first step]
2. [second step]
[continue]

Risks or open questions from the architect:
[list any, or None]

Before you type CONTINUE, please check:
- Does this plan make sense for what you asked for?
- Are there any concerns about what will be changed?
- Are there any open questions that need answers first?

Type CONTINUE to move to Stage 3 (Test Writing — Pass 1).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 3: Test Writing (Pass 1)

Only run this stage after Andy has typed CONTINUE.

Run the test-writer-1 agent.

Tell the agent:
"Before doing any work, read .claude/agents/test-writer-shared.md in full and output the exact confirmation line required by that file. Then follow the test-writer-1 process to write Pass 1 tests for the feature specified in docs/specs/[filename].md.

Pass 1 writes ONLY:
- Schema and validation tests (for Zod schemas defined in the technical plan)
- End-to-end tests (Playwright)

Pass 1 does NOT write:
- Component tests (deferred to Pass 2 in Stage 5)
- API route tests (deferred to Pass 2 in Stage 5)
- Unit tests for service or utility functions (deferred to Pass 2 in Stage 5)

Run the Phase Test Inventory gate before writing any tests. If the inventory returns 0 test files, produce the Pass 1 summary stating so and stop — that is a valid and complete result for this stage.

Output the Spec Confirmation Block, the Source Files Read Log (Pass 1 version), and the Pattern Match Block as required by the test-writer-1 agent file. Do not write any production code. Pass 1 tests should fail when first run — that is correct."

After the agent finishes, run the tests:
```bash
pnpm vitest run 2>&1
```

If the test-writer did not output a Spec Confirmation Block — send it back
to read the spec file and output the block. Do not accept tests without it.

### Stage 3 checkpoint commit

Once tests are written and confirmed failing for the right reasons (route
files do not exist yet, NOT setup errors), commit them:

```bash
git add .
git status
git commit -m "checkpoint(stage-3): tests written, all initially failing"
```

Review the git status output before committing. Only test files and any
test setup files should be staged. If anything outside of test directories
is staged, STOP and report to Andy.

Then show this summary and STOP:

---
STAGE 3 COMPLETE — Test Writing (Pass 1)

Spec file used: docs/specs/[filename].md
Spec Confirmation Block produced: Yes / No
Checkpoint commit: [commit hash]

Tests written in Pass 1:
- Schema / validation tests: [n]
- End-to-end tests: [n]
- Total Pass 1 tests: [n]

Tests deferred to Pass 2 (will run in Stage 5):
- Component tests: [n expected]
- API route tests: [n expected]
- Unit tests for service / utility functions: [n expected]

Test run result: [n] failing (this is correct — they should all fail before code is written)

Failure mode verification:
- Tests failing because route files don't exist: [count]
- Tests failing for other reasons: [count, must be 0]

If any tests are failing for reasons other than "route file not found",
flag them now before continuing.

Fields with tests (from spec):
[list each field name and whether it has a test]

Business rules with tests (from spec):
[list each rule and whether it has a test]

Gaps (spec items with no test):
[list any, or None]

Before you type CONTINUE, please check:
- Do the test field names match the spec field names exactly?
- Is every business rule covered by a test?
- Are you satisfied that all tests are failing as expected?

Type CONTINUE to move to Stage 4 (Implementation).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 4: Implementation

Only run this stage after Andy has typed CONTINUE.

Run the implementer agent.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under for this run'
section required by your agent file. List Rules 1 through 10 verbatim. Do not
abbreviate. Do not summarize. If you skip this output, your work will be
discarded and you will be asked to start over.

Then implement the feature specified in docs/specs/[filename].md.

You must complete these steps in order before writing any code:
1. Verify test files exist — stop if they do not
2. Read docs/specs/[filename].md and output the Spec Confirmation Block
3. After any database migration, output the Schema Verification table comparing
   every spec field against the actual schema — stop if any mismatches exist.
   If no schema changes are needed in this stage, output a one-line note
   stating that explicitly.
4. Run pnpm vitest run 2>&1 and paste the full output before declaring done

REMINDERS OF YOUR ABSOLUTE RULES (these always apply):
- You may NOT edit, create, delete, move, or rename any test file under any
  circumstance. If a test seems wrong, STOP and report it. Do not fix it.
- You may NOT delete any file or directory under any circumstance. The only
  allowed recovery from a bad edit is `git checkout HEAD -- <specific-file>`.
- You may NOT run rm, git reset, git clean, git checkout -- ., or any other
  destructive command.
- You MUST stop after 3 failed attempts on the same test. No exceptions.
- You MUST stop and report when anything unexpected happens.

If a test is failing and you believe the test itself is wrong, the correct
action is to STOP and produce a Failure Diagnosis Block, then wait for Andy.
The wrong action is to edit the test, delete the test, or run any recovery
command on your own."

After the agent finishes, run the full test suite independently:
```bash
pnpm vitest run 2>&1
```

If the implementer did not output the Absolute Rules restatement — send it back.
If the implementer did not output a Spec Confirmation Block — send it back.
If the implementer did not output a Schema Verification table or note — send it back.
If tests failing is not 0 — send it back with the specific failing test names.
Do not show the summary until all four conditions are met.

### Stage 4 checkpoint commit

Once all tests are passing and the implementer has produced its completion
report, commit the implementation:

```bash
git add .
git status
git commit -m "checkpoint(stage-4): implementation complete, all tests passing"
```

Review the git status output before committing. Source files (route.ts,
component files, schema files, migrations) and test files should be staged.
If any test files were modified during this stage, STOP and report to Andy
immediately — that is a violation of the implementer's absolute rules and
needs investigation before committing.

Then show this summary and STOP:

---
STAGE 4 COMPLETE — Implementation

Spec file used: docs/specs/[filename].md
Absolute Rules restatement produced: Yes / No
Spec Confirmation Block produced by implementer: Yes / No
Schema Verification produced (all fields matched, or N/A): Yes / No
Checkpoint commit: [commit hash]

Test results:
- Total tests: [n]
- Passing: [n]
- Failing: 0
- Previously passing tests broken: 0

Test files modified during this stage: [n, must be 0]

Files created:
[list]

Files modified:
[list]

Database changes:
[migration name, or None]

Before you type CONTINUE, please check:
- Does everything appear to be working?
- Are you satisfied with the test results?
- Were any test files touched during this stage? (should be no)

Type CONTINUE to move to Stage 5 (Test Writing — Pass 2).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 5: Test Writing (Pass 2)

Only run this stage after Andy has typed CONTINUE.

Run the test-writer-2 agent.

Tell the agent:
"Before doing any work, read .claude/agents/test-writer-shared.md in full and output the exact confirmation line required by that file. Then follow the test-writer-2 process to write Pass 2 tests for the feature.

Pass 2 writes:
- Component tests (React Testing Library) for every component the implementer created
- API route tests (Vitest) for every route handler the implementer created
- Unit tests for every service or utility function with real application logic that the implementer created

You MUST read every source file the implementer created before writing any test. You MUST output the Source Files Read Log (Pass 2 version), the Pattern Match Block, and the Mock Reference Table as required by the test-writer-2 agent file.

The Mocking Rules (M1 through M4) in test-writer-2.md are the load-bearing discipline of this pass. Apply them at all times. If you find yourself considering an exception to any mocking rule, STOP and ask rather than rationalizing it.

At the end of Pass 2, the completion summary MUST include the Mock Self-Verification section with every vi.mock() call pasted verbatim from every test file created, plus the four rule compliance confirmations (M1 through M4). Without this section, the work is incomplete."

After the agent finishes, run the tests:
```bash
pnpm vitest run 2>&1
```

If test-writer-2 did not output the confirmation line from test-writer-shared.md — send it back. If it did not output the Mock Reference Table before writing tests — send it back. If the Mock Self-Verification section is missing from the summary — send it back. Do not accept Pass 2 work without these.

Pass 2 tests should PASS on first run (unlike Pass 1, which expects failures). If any Pass 2 test fails, the failure is telling you something — either the mock is wrong, the assertion is wrong, or the implementer's code has a bug. Investigate before proceeding, do not rewrite the test to make it pass.

### Stage 5 checkpoint commit

Once Pass 2 tests are written and passing, commit them:

```bash
git add .
git status
git commit -m "checkpoint(stage-5): Pass 2 tests written and passing"
```

Review the git status output before committing. Only test files should be staged. If anything outside of test directories is staged, STOP and report to Andy — Pass 2 should not modify production code.

Then show this summary and STOP:

---
STAGE 5 COMPLETE — Test Writing (Pass 2)

Shared rules confirmation produced by test-writer-2: Yes / No
Mock Reference Table produced: Yes / No
Mock Self-Verification section included in summary: Yes / No
Rule M1 compliance confirmed (never mock subject of test): Yes / No
Rule M2 compliance confirmed (never mock children whose rendering matters): Yes / No
Rule M3 compliance confirmed (no scripted return values for utility functions): Yes / No
Rule M4 compliance confirmed (no invented exceptions): Yes / No
Checkpoint commit: [commit hash]

Tests written in Pass 2:
- Component tests: [n]
- API route tests: [n]
- Unit tests for service / utility functions: [n]
- Total Pass 2 tests: [n]

Combined test count:
- Pass 1 tests: [n from Stage 3]
- Pass 2 tests: [n]
- Grand total: [n]

Test run result:
- Passing: [n]
- Failing: [n, must be 0]

Before you type CONTINUE, please check:
- Did every vi.mock call appear in the self-verification section?
- Are all four mocking rule compliance answers "Yes"?
- Are all Pass 2 tests passing?

Type CONTINUE to move to Stage 6 (Code Review).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 6: Code Review

Only run this stage after Andy has typed CONTINUE.

Run the code-reviewer agent.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly.

Then review all files changed in this feature.
Read the specification at docs/specs/[filename].md first.
Verify every business rule from the spec is correctly implemented.
Verify every field from the spec Data Requirements table is correctly implemented.
Check for security issues, logic errors, and data integrity risks.

You may NOT modify any file. You may NOT delete any file. You may NOT run any
tests. Your job is to read and report only.

Your report must end with one of these verdicts:
APPROVED / APPROVED WITH CONDITIONS / REQUIRES REWORK"

### Stage 6 checkpoint commit

Code review does not modify files, so there is nothing to commit at this stage
unless the verdict is REQUIRES REWORK and the implementer makes fixes. If the
implementer is sent back to fix issues, run a checkpoint commit AFTER the fixes
are verified passing:

```bash
git add .
git status
git commit -m "checkpoint(stage-6): code review fixes applied"
```

Then show this summary and STOP:

---
STAGE 6 COMPLETE — Code Review

Verdict: [APPROVED / APPROVED WITH CONDITIONS / REQUIRES REWORK]
Checkpoint commit (if fixes applied): [commit hash, or N/A]

Critical issues (must fix before proceeding):
[list, or None]

Warnings (should fix):
[list, or None]

Business rule compliance:
[list each rule and whether it passed]

Security assessment: Pass / Fail
[details if fail]

[If REQUIRES REWORK:]
The implementer must fix the issues above before this stage can close.
Tests must still pass after fixes. Tell me when fixes are done and I will
re-run the code review before showing this summary again.

[If APPROVED or APPROVED WITH CONDITIONS:]
Type CONTINUE to move to Stage 7 (Standards Check).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 7: Standards Check

Only run this stage after Andy has typed CONTINUE.

Run the standards-checker agent.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly.

Then check all files changed in this feature against the standards files in
docs/ — specifically CODING_STANDARDS.md, API_STANDARDS.md, COMPONENT_STANDARDS.md
(if applicable), DATABASE_STANDARDS.md, and TESTING_STANDARDS.md.

Produce a full checklist with every item marked Pass, Fail, or N/A.
List every violation with the exact file path and line number.

You may NOT modify any file. You may NOT delete any file. You may NOT run any
tests. Your job is to produce the checklist and report violations only."

If violations are found — return to the implementer to fix them. When sending
the implementer back, the prompt MUST include:
- The exact file paths and line numbers of the violations
- An instruction to ONLY edit the specific lines flagged
- An instruction to NOT modify any test file
- An instruction to NOT delete any file
- An instruction to NOT run git reset, git clean, or rm
- An instruction to run pnpm vitest run after fixes to confirm 0 failures

After fixes, re-run the standards-checker. Run pnpm vitest run again after fixes
to confirm still 0 failures. Do not show the summary until violations = 0.

### Stage 7 checkpoint commit

Once violations are 0 (whether there were any to fix or not), commit any
fixes that were made:

```bash
git add .
git status
git commit -m "checkpoint(stage-7): standards check passed"
```

If no fixes were needed, you may skip the commit (nothing to stage). The
git status should be clean.

Then show this summary and STOP:

---
STAGE 7 COMPLETE — Standards Check

Violations found: [n, should be 0]
Files checked: [list]
Checkpoint commit (if fixes applied): [commit hash, or N/A — no fixes needed]

Checklist result:
- No inline styles: Pass / Fail
- File path comment at top: Pass / Fail
- Auth check first on all API routes: Pass / Fail
- Zod validation on all inputs: Pass / Fail
- No TypeScript any types: Pass / Fail
- All text through translation system: Pass / Fail
- Correct component usage (ModalDialog, FormTable, etc.): Pass / Fail
[any other items checked]

Test results after any fixes:
- Passing: [n]
- Failing: 0

Type CONTINUE to move to Stage 8 (Documentation).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 8: Documentation

Only run this stage after Andy has typed CONTINUE.

Run the documentation-writer agent.

Tell the agent:
"Before doing any work, output the 'Absolute rules I am operating under' section
required by your agent file. List every rule verbatim. If your agent file does
not contain absolute rules, state that explicitly.

Then update all documentation for this completed feature.
Reference the spec at docs/specs/[filename].md.
Add inline code comments near complex logic explaining WHY decisions were made.
Update technical docs for any new or changed functionality.
Update docs/CODING_STANDARDS.md if new patterns were established.
Note any audit report findings this feature addresses.

You may add inline comments to existing source files but you may NOT change
any logic in those files. You may NOT modify any test file. You may NOT
delete any file. You may NOT run any tests."

### Stage 8 checkpoint commit

Once documentation updates are complete, commit them:

```bash
git add .
git status
git commit -m "checkpoint(stage-8): documentation updated, feature complete"
```

Review git status before committing. Documentation files (docs/, README.md,
inline comments in source files) should be staged. If test files are staged,
STOP and report to Andy.

Then show the final pipeline summary:

---
PIPELINE COMPLETE

Feature: [Feature Name]
Spec file: docs/specs/[filename].md

Stage 1: Business Analysis        COMPLETE — spec saved to docs/specs/         [commit hash]
Stage 2: Technical Planning       COMPLETE — plan confirmed                    [commit hash]
Stage 3: Test Writing (Pass 1)    COMPLETE — [n] tests, all initially failing  [commit hash]
Stage 4: Implementation           COMPLETE — [n] tests passing, 0 failing      [commit hash]
Stage 5: Test Writing (Pass 2)    COMPLETE — [n] tests passing                 [commit hash]
Stage 6: Code Review              COMPLETE — [verdict]                         [commit hash if fixes]
Stage 7: Standards Check          COMPLETE — 0 violations                      [commit hash if fixes]
Stage 8: Documentation            COMPLETE                                     [commit hash]

Files created: [list]
Files modified: [list]
Tests added: [n]

This feature is complete. All stages were committed as checkpoints, so any
stage can be rolled back individually with `git reset --hard <stage-commit>`
if Andy needs to undo work.

Before considering this feature done, Andy should:
1. Confirm the app is running correctly in dev
2. Push the branch to origin
3. Open a PR back to dev
---