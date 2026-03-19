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

Work through each stage in strict order. Each stage ends with a hard stop.
You MUST NOT begin the next stage until Andy types CONTINUE.
Pass the full output from each stage to the next so no context is lost.

---

## STAGE 1: Bug Investigation

Use the **bug-investigator** agent to find the root cause before any code is touched.

Tell the agent: "Investigate this bug: $ARGUMENTS

Find the root cause — not just the symptom. Read all relevant files, check
recent git history, assess the impact, and produce a full investigation report
with a proposed fix approach. Do not modify any files."

When the agent completes, present the full investigation report to Andy.

Then display this message exactly and STOP — do not run Stage 2, do not
take any further action, do not continue for any reason:

---
## ⏸ STAGE 1 COMPLETE — REVIEW REQUIRED

Please review the investigation report above and consider:
- Does the root cause analysis look correct?
- Is the proposed fix approach the right one?
- Are there any other related areas that should be checked?

If the root cause seems wrong, tell me what is missing and I will return
to the bug-investigator with your additional context.

**Type CONTINUE to proceed to Stage 2 (Test Writing), or give feedback to re-investigate.**
---

Do not proceed until Andy types CONTINUE. Typing anything other than CONTINUE
means Andy has feedback — address it before moving on.

---

## STAGE 2: Test Writing (Prove the Bug First)

Use the **test-writer** agent to write tests before any fix is written.

Pass the full investigation report to the test-writer.
Tell the agent: "Write tests for this bug fix based on the investigation report.

The most important test is a REGRESSION TEST that proves the bug exists. It must:
- Be labeled at the top with: // REGRESSION TEST: proves bug fix for [short bug name]
- Currently FAIL before the fix is applied
- PASS after the fix is applied
- Never be deleted — its permanent job is to prevent this bug from coming back

Also write tests for the correct happy path behavior and any edge cases
identified in the investigation.

Do not write any fix code. Tests only."

After the agent completes, run the tests to confirm the regression test is currently failing:
```bash
pnpm test
```

Present the test results to Andy. Note the exact name of the regression test
so it can be tracked through the remaining stages.

Then display this message exactly and STOP — do not run Stage 3, do not
take any further action, do not continue for any reason:

---
## ⏸ STAGE 2 COMPLETE — REVIEW REQUIRED

Please review the test results above and confirm:
- The regression test (labeled // REGRESSION TEST:) is currently FAILING — this is expected and correct, it proves the bug exists
- The tests cover the scenarios described in the investigation report

Regression test name being tracked: **[insert exact test name here]**

**Type CONTINUE to proceed to Stage 3 (Implementation), or give feedback to revise the tests.**
---

Do not proceed until Andy types CONTINUE.

---

## STAGE 3: Implementation

Use the **implementer** agent to write the fix.

Pass the full investigation report and all test files to the implementer.
Tell the agent: "Fix this bug based on the investigation report.

Important rules for this bug fix:
- Fix the ROOT CAUSE identified in the investigation report — not the symptom
- Make ONLY the changes described in the proposed fix — nothing more
- Do not refactor, clean up, or improve unrelated code
- Do not modify any test files
- Do not delete any test files — especially the regression test labeled // REGRESSION TEST:
- The regression test must pass naturally as a result of the fix — if it is still
  failing after your changes, the fix is incomplete
- Fix any TypeScript type errors in files you are already touching — but do not
  go looking for type errors in files you are not changing. If fixing a type error
  requires a change in one other file (such as a shared type definition), that is
  acceptable — note it in your completion report
- Run tests after the fix to confirm the regression test now passes
- Run the full test suite to confirm nothing else broke

Read docs/standards/CODING_STANDARDS.md before making any changes."

After the agent completes, run the full test suite:
```bash
pnpm test
```

Present the full test results to Andy. If any previously passing tests are
now failing, return to the implementer before presenting results — the fix
may have broken something.

Then display this message exactly and STOP — do not run Stage 4, do not
take any further action, do not continue for any reason:

---
## ⏸ STAGE 3 COMPLETE — REVIEW REQUIRED

Please review the results above and confirm:
- The regression test (labeled // REGRESSION TEST:) is now PASSING ✅
- The regression test was NOT deleted or modified — it passes because the code was fixed
- All previously passing tests are still passing
- No new test failures were introduced

**Type CONTINUE to proceed to Stage 4 (Code Review), or give feedback to revise the fix.**
---

Do not proceed until Andy types CONTINUE.

---

## STAGE 4: Code Review

Use the **code-reviewer** agent to review the fix.

Tell the agent: "Review this bug fix. Focus on:
- Does the fix address the root cause from the investigation report?
- Is the fix surgical — does it change only what was needed?
- Are there any security implications to the fix?
- Could this fix have introduced any regressions?
- Are there any other places in the codebase with the same bug pattern that were missed?
- Confirm the regression test labeled // REGRESSION TEST: is present and passing —
  flag it as a critical issue if it was deleted or modified

Reference the full bug investigation report when reviewing."

Present the full code review report to Andy.

Then display this message exactly and STOP — do not run Stage 5, do not
take any further action, do not continue for any reason:

---
## ⏸ STAGE 4 COMPLETE — REVIEW REQUIRED

Please review the code review report above.

- If the verdict is ❌ Requires rework — tell me what needs to change and I will return to the implementer.
- If the verdict is ✅ Approved or ⚠️ Approved with conditions — type CONTINUE to proceed.

**Type CONTINUE to proceed to Stage 5 (Standards Check), or give feedback to revise the fix.**
---

Do not proceed until Andy types CONTINUE.

---

## STAGE 5: Standards Check

Use the **standards-checker** agent to verify the fix follows coding standards.

Tell the agent: "Check all files changed in this bug fix against
docs/standards/CODING_STANDARDS.md. Produce a full checklist report."

Present the full standards report to Andy.

Then display this message exactly and STOP — do not run Stage 6, do not
take any further action, do not continue for any reason:

---
## ⏸ STAGE 5 COMPLETE — REVIEW REQUIRED

Please review the standards report above.

- If violations were found — tell me what needs to change and I will return to the implementer, then re-run the standards check before proceeding.
- If all standards are met — type CONTINUE to proceed.

**Type CONTINUE to proceed to Stage 6 (Documentation), or give feedback to fix standards violations.**
---

Do not proceed until Andy types CONTINUE.

---

## STAGE 6: Documentation

Use the **documentation-writer** agent to document the fix.

Tell the agent: "Document this bug fix:
- Add a code comment near the fix explaining what was broken and why,
  so future developers understand the decision
- If this bug reveals a gap in the coding standards that could prevent
  similar bugs in future, add a rule to docs/standards/CODING_STANDARDS.md
- Update any technical documentation affected by the fix"

---

## Pipeline Complete

When all 6 stages are done, produce this final summary:

```
# Bug Fix Complete: [Bug Name]

✅ Stage 1: Investigation — root cause identified and confirmed
✅ Stage 2: Tests Written — regression test confirmed FAILING before fix
✅ Stage 3: Implementation — fix applied, all tests now passing
✅ Stage 4: Code Review — approved
✅ Stage 5: Standards Check — all standards met
✅ Stage 6: Documentation — fix documented

Root cause: [one sentence summary]
Files changed: [list]
Tests added: [n]
Regression test: [exact test name] — retained and PASSING ✅
Previously passing tests broken by fix: None
Type errors fixed: [list files where type errors were cleaned up, or "None"]
```
