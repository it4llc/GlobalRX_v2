---
description: Runs the full GlobalRx TDD pipeline for a new feature. Chains all agents in sequence: business-analyst → architect → test-writer → implementer → code-reviewer → standards-checker → documentation-writer
allowed-tools: Task, Read, Write, Edit, Bash, Glob, Grep
---

# GlobalRx TDD Pipeline

You are orchestrating the full TDD development pipeline for GlobalRx.
The feature request is: **$ARGUMENTS**

Work through each stage below in strict order. Do not move to the next stage until
the current one is fully complete and confirmed. At each handoff, pass the full
output from the previous stage to the next agent so no context is lost.

---

## STAGE 1: Business Analysis

Use the **business-analyst** agent to turn the feature request into a written specification.

Tell the agent: "Write a full feature specification for: $ARGUMENTS. Ask any
clarifying questions needed before writing the spec."

⏸ PAUSE after this stage and show the completed specification to Andy.
Wait for Andy to confirm the spec is correct before proceeding to Stage 2.
Do not continue until confirmation is received.

---

## STAGE 2: Technical Planning

Use the **architect** agent to produce a technical plan.

Pass the complete specification from Stage 1 to the architect.
Tell the agent: "Produce a full technical plan based on this specification.
Read the existing codebase and docs/standards/CODING_STANDARDS.md before planning."

⏸ PAUSE after this stage and show Andy the technical plan.
Highlight any decisions that need Andy's input (look for "Open Questions" or
"Risks" sections in the plan). Wait for confirmation before proceeding.

---

## STAGE 3: Test Writing (TDD — Tests First)

Use the **test-writer** agent to write all tests before any code is written.

Pass the specification and technical plan to the test-writer.
Tell the agent: "Write all unit tests, API route tests, and end-to-end tests
for this feature. All tests should fail when first run — that is correct.
Do not write any production code."

After the agent completes, run the tests to confirm they are all failing:
```bash
pnpm test
```

⏸ PAUSE and show Andy the test summary. Confirm that tests are failing as expected.
Do not proceed until confirmed.

---

## STAGE 4: Implementation

Use the **implementer** agent to write production code.

Pass the specification, technical plan, and all test files to the implementer.
Tell the agent: "Implement this feature by writing code to make the failing tests
pass one at a time. Follow the technical plan and read
docs/standards/CODING_STANDARDS.md first. Do not modify any tests."

After the agent completes, run the full test suite:
```bash
pnpm test
```

⏸ PAUSE and show Andy the implementation completion report and test results.
If any tests are still failing, return to the implementer before proceeding.

---

## STAGE 5: Code Review

Use the **code-reviewer** agent to review the completed implementation.

Tell the agent: "Review all files changed in this feature. Check for business
logic correctness, security gaps, and data integrity issues. Reference the
original specification to verify all business rules are implemented."

⏸ PAUSE and show Andy the code review report.
If the verdict is ❌ Requires rework, return to the implementer with the specific
issues before continuing. If ✅ Approved or ⚠️ Approved with conditions, proceed.

---

## STAGE 6: Standards Check

Use the **standards-checker** agent to verify coding standards compliance.

Tell the agent: "Check all files changed in this feature against
docs/standards/CODING_STANDARDS.md. Produce a full checklist report."

⏸ PAUSE and show Andy the standards report.
If violations are found, return to the implementer with the specific line numbers
and rules violated. Re-run the standards-checker after fixes before proceeding.

---

## STAGE 7: Documentation

Use the **documentation-writer** agent to complete the documentation.

Tell the agent: "Update all relevant documentation for this completed feature.
Add inline code comments where needed, update the technical docs, update
CODING_STANDARDS.md if new patterns were established, and note any impact
on the audit report findings."

---

## Pipeline Complete

When all 7 stages are done, produce a final summary:

```
# Feature Complete: [Feature Name]

✅ Stage 1: Business Analysis — specification written and approved
✅ Stage 2: Technical Planning — plan written and approved  
✅ Stage 3: Tests Written — [n] tests written, all confirmed failing initially
✅ Stage 4: Implementation — all [n] tests now passing
✅ Stage 5: Code Review — approved
✅ Stage 6: Standards Check — all standards met
✅ Stage 7: Documentation — docs updated

Files created: [list]
Files modified: [list]
Tests added: [n]
```
