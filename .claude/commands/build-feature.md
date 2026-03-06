---
description: Runs the GlobalRx TDD pipeline ONE STAGE AT A TIME. After each stage completes, it stops completely, shows a summary, and waits for Andy to type CONTINUE before starting the next stage. Always describe the feature after the command.
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
1. Show the stage summary (using the exact format below)
2. STOP COMPLETELY
3. Wait for Andy to type CONTINUE
4. Do NOT start the next stage until CONTINUE is received

You are not permitted to start the next stage automatically.
You are not permitted to ask "shall I continue?" and then continue anyway.
You are not permitted to say "moving on to the next stage".
The only thing that unlocks the next stage is Andy typing CONTINUE.

If Andy types anything other than CONTINUE — answer their question or
address their concern, then show the stage summary again and wait again.

---

## STAGE 1: Business Analysis

Run the business-analyst agent now.

Tell the agent:
"Write a full feature specification for: $ARGUMENTS
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

Then show this summary and STOP:

---
STAGE 1 COMPLETE — Business Analysis

Spec file saved: docs/specs/[filename].md
Fields defined: [count]
Business rules defined: [count]
Open questions remaining: [count, or None]

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
"Produce a full technical plan based on the specification at docs/specs/[filename].md.
Read that file completely before planning anything.
Read the existing codebase to understand what already exists.
Read docs/CODING_STANDARDS.md before planning.
Identify every file that needs to be created or changed.
List the implementation order clearly."

When the agent finishes, show this summary and STOP:

---
STAGE 2 COMPLETE — Technical Planning

Spec file used: docs/specs/[filename].md

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

Type CONTINUE to move to Stage 3 (Test Writing).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 3: Test Writing

Only run this stage after Andy has typed CONTINUE.

Run the test-writer agent.

Tell the agent:
"Write all tests for the feature specified in docs/specs/[filename].md
Read the spec file and output the Spec Confirmation Block before writing any tests.
Write unit tests, API route tests, and end-to-end tests.
Do not write any production code.
All tests should fail when first run — that is correct."

After the agent finishes, run the tests:
```bash
pnpm test 2>&1
```

If the test-writer did not output a Spec Confirmation Block — send it back
to read the spec file and output the block. Do not accept tests without it.

Then show this summary and STOP:

---
STAGE 3 COMPLETE — Test Writing

Spec file used: docs/specs/[filename].md
Spec Confirmation Block produced: Yes / No

Tests written:
- Unit tests: [n]
- API route tests: [n]
- End-to-end tests: [n]
- Total: [n]

Test run result: [n] failing (this is correct — they should all fail before code is written)

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
"Implement the feature specified in docs/specs/[filename].md.
You must complete these steps in order before writing any code:
1. Verify test files exist — stop if they do not
2. Read docs/specs/[filename].md and output the Spec Confirmation Block
3. After any database migration, output the Schema Verification table comparing
   every spec field against the actual schema — stop if any mismatches exist
4. Run pnpm test 2>&1 and paste the full output before declaring done
Do not modify any test files."

After the agent finishes, run the full test suite independently:
```bash
pnpm test 2>&1
```

If the implementer did not output a Spec Confirmation Block — send it back.
If the implementer did not output a Schema Verification table — send it back.
If tests failing is not 0 — send it back with the specific failing test names.
Do not show the summary until all three conditions are met.

Then show this summary and STOP:

---
STAGE 4 COMPLETE — Implementation

Spec file used: docs/specs/[filename].md
Spec Confirmation Block produced by implementer: Yes / No
Schema Verification produced (all fields matched): Yes / No

Test results:
- Total tests: [n]
- Passing: [n]
- Failing: 0
- Previously passing tests broken: 0

Files created:
[list]

Files modified:
[list]

Database changes:
[migration name, or None]

Before you type CONTINUE, please check:
- Does everything appear to be working?
- Are you satisfied with the test results?

Type CONTINUE to move to Stage 5 (Code Review).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 5: Code Review

Only run this stage after Andy has typed CONTINUE.

Run the code-reviewer agent.

Tell the agent:
"Review all files changed in this feature.
Read the specification at docs/specs/[filename].md first.
Verify every business rule from the spec is correctly implemented.
Verify every field from the spec Data Requirements table is correctly implemented.
Check for security issues, logic errors, and data integrity risks.
Your report must end with one of these verdicts:
APPROVED / APPROVED WITH CONDITIONS / REQUIRES REWORK"

Then show this summary and STOP:

---
STAGE 5 COMPLETE — Code Review

Verdict: [APPROVED / APPROVED WITH CONDITIONS / REQUIRES REWORK]

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
Type CONTINUE to move to Stage 6 (Standards Check).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 6: Standards Check

Only run this stage after Andy has typed CONTINUE.

Run the standards-checker agent.

Tell the agent:
"Check all files changed in this feature against docs/CODING_STANDARDS.md.
Produce a full checklist with every item marked Pass, Fail, or N/A.
List every violation with the exact file path and line number."

If violations are found — return to the implementer to fix them, then
re-run the standards-checker. Run pnpm test again after fixes to confirm
still 0 failures. Do not show the summary until violations = 0.

Then show this summary and STOP:

---
STAGE 6 COMPLETE — Standards Check

Violations found: [n, should be 0]
Files checked: [list]

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

Type CONTINUE to move to Stage 7 (Documentation).
---

STOP. Do not proceed. Wait for Andy to type CONTINUE.

---

## STAGE 7: Documentation

Only run this stage after Andy has typed CONTINUE.

Run the documentation-writer agent.

Tell the agent:
"Update all documentation for this completed feature.
Reference the spec at docs/specs/[filename].md.
Add inline code comments near complex logic explaining WHY decisions were made.
Update technical docs for any new or changed functionality.
Update CODING_STANDARDS.md if new patterns were established.
Note any audit report findings this feature addresses."

Then show the final pipeline summary:

---
PIPELINE COMPLETE

Feature: [Feature Name]
Spec file: docs/specs/[filename].md

Stage 1: Business Analysis      COMPLETE — spec saved to docs/specs/
Stage 2: Technical Planning     COMPLETE — plan confirmed
Stage 3: Test Writing           COMPLETE — [n] tests, all initially failing
Stage 4: Implementation         COMPLETE — [n] tests passing, 0 failing, schema verified
Stage 5: Code Review            COMPLETE — [verdict]
Stage 6: Standards Check        COMPLETE — 0 violations
Stage 7: Documentation          COMPLETE

Files created: [list]
Files modified: [list]
Tests added: [n]

This feature is complete. Before starting the next phase or feature,
confirm the app is running correctly and commit your changes.
---