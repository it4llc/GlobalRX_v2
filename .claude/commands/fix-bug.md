---
description: Runs the full GlobalRx bug fix pipeline. Chains agents in sequence: bug-investigator → test-writer → implementer → code-reviewer → standards-checker → documentation-writer. Always describe the bug after the command.
allowed-tools: Task, Read, Write, Edit, Bash, Glob, Grep
---

# GlobalRx Bug Fix Pipeline

## BEFORE DOING ANYTHING ELSE

Check whether a bug description was provided after the command.

If NO description was provided — meaning $ARGUMENTS is blank or missing — STOP
immediately and respond with only this:

"What bug would you like to fix? Please describe what is broken and what you
expected to happen instead, for example:
`/fix-bug When I save a customer the page shows an error but the record saves anyway`"

Do NOT proceed. Do NOT invent a bug. Do NOT assume. Wait for Andy to
re-run the command with a description included.

---

Only continue below if $ARGUMENTS contains a real bug description.

The bug to fix is: **$ARGUMENTS**

Work through each stage in strict order. Do not move to the next stage until
the current one is complete and confirmed. Pass the full output from each
stage to the next so no context is lost.

---

## STAGE 1: Bug Investigation

Use the **bug-investigator** agent to find the root cause before any code is touched.

Tell the agent: "Investigate this bug: $ARGUMENTS

Find the root cause — not just the symptom. Read all relevant files, check
recent git history, assess the impact, and produce a full investigation report
with a proposed fix approach. Do not modify any files."

⏸ PAUSE after this stage and show Andy the investigation report.

Ask Andy:
- Does this root cause analysis look correct?
- Is the proposed fix approach the right one?
- Are there any other related areas that should be checked?

Wait for confirmation before proceeding. If the root cause seems wrong,
return to the bug-investigator with Andy's additional context.

---

## STAGE 2: Test Writing (Prove the Bug First)

Use the **test-writer** agent to write tests before any fix is written.

Pass the investigation report to the test-writer.
Tell the agent: "Write tests for this bug fix based on the investigation report.

The most important test is one that PROVES THE BUG EXISTS — it must fail
before the fix and pass after. Also write tests for the correct happy path
behavior and any edge cases identified in the investigation.

Do not write any fix code. Tests only."

After the agent completes, run the tests to confirm the bug-proving test fails:
```bash
pnpm test
```

⏸ PAUSE and show Andy the test summary.
Confirm the key test is failing (proving the bug exists).
Do not proceed until confirmed.

---

## STAGE 3: Implementation

Use the **implementer** agent to write the fix.

Pass the investigation report and all test files to the implementer.
Tell the agent: "Fix this bug based on the investigation report.

Important rules for bug fixes:
- Fix the ROOT CAUSE identified in the investigation report, not the symptom
- Make ONLY the changes described in the proposed fix — nothing more
- Do not refactor, clean up, or improve unrelated code
- Do not modify any test files
- Run tests after the fix to confirm the bug-proving test now passes
- Run the full test suite to confirm nothing else broke

Read docs/standards/CODING_STANDARDS.md before making any changes."

After the agent completes, run the full test suite:
```bash
pnpm test
```

⏸ PAUSE and show Andy the results.
Confirm:
- The bug-proving test is now passing
- All previously passing tests are still passing
- No new failures were introduced

If any previously passing tests are now failing, return to the implementer
before proceeding — the fix may have broken something.

---

## STAGE 4: Code Review

Use the **code-reviewer** agent to review the fix.

Tell the agent: "Review the bug fix. Focus on:
- Does the fix address the root cause from the investigation report?
- Is the fix surgical — does it change only what was needed?
- Are there any security implications to the fix?
- Could this fix have introduced any regressions?
- Are there any other places in the codebase with the same bug that were missed?

Reference the bug investigation report when reviewing."

⏸ PAUSE and show Andy the code review report.
If the verdict is ❌ Requires rework, return to the implementer.
If ✅ Approved or ⚠️ Approved with conditions, proceed.

---

## STAGE 5: Standards Check

Use the **standards-checker** agent to verify the fix follows coding standards.

Tell the agent: "Check all files changed in this bug fix against
docs/standards/CODING_STANDARDS.md. Produce a full checklist report."

⏸ PAUSE and show Andy the standards report.
If violations are found, return to the implementer with the specific issues.
Re-run the standards-checker after fixes before proceeding.

---

## STAGE 6: Documentation

Use the **documentation-writer** agent to document the fix.

Tell the agent: "Document this bug fix:
- Add a code comment near the fix explaining what was broken and why,
  so future developers understand the decision
- If this bug reveals a gap in the coding standards that could prevent
  similar bugs in future, add it to docs/standards/CODING_STANDARDS.md
- If this bug was identified in the audit report, note that it has been resolved
- Update any technical documentation affected by the fix"

---

## Pipeline Complete

When all 6 stages are done, produce a final summary:

```
# Bug Fix Complete: [Bug Name]

✅ Stage 1: Investigation — root cause identified and confirmed
✅ Stage 2: Tests Written — bug-proving test confirmed failing before fix
✅ Stage 3: Implementation — fix applied, all tests now passing
✅ Stage 4: Code Review — approved
✅ Stage 5: Standards Check — all standards met
✅ Stage 6: Documentation — fix documented

Root cause: [one sentence summary]
Files changed: [list]
Tests added: [n]
Previously passing tests broken by fix: None
```
