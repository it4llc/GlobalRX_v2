---
description: Evaluates the scope of a feature request and breaks it into logical, manageable phases before any building begins. Always run this BEFORE /build-feature for any non-trivial request. Produces a phased implementation plan for Andy's approval — does not write any code or tests.
allowed-tools: Task, Read, Glob, Grep
---

# GlobalRx Feature Planning

## BEFORE DOING ANYTHING ELSE

Check whether a feature description was provided after the command.

If NO description was provided — meaning $ARGUMENTS is blank or missing — STOP
immediately and respond with only this:

"What feature would you like to plan? Describe it in plain English and I'll
break it into manageable phases before we start building, for example:
`/plan-feature I want to add a full invoicing system to the customer module`"

Do NOT proceed. Do NOT invent a feature. Wait for Andy to re-run the command
with a description.

---

Only continue below if $ARGUMENTS contains a real feature description.

The feature to plan is: **$ARGUMENTS**

---

## Planning Stage

Use the **project-manager** agent to evaluate scope and produce a phased plan.

Tell the agent: "Evaluate the scope of this feature request and produce a
phased implementation plan: $ARGUMENTS

Read the relevant parts of the existing codebase before assessing scope.
Push back clearly if the request is too large for a single build cycle.
Break it into the smallest logical phases that each deliver something
real and independently testable.

Produce a written phase plan with a recommended /build-feature command
for each phase."

---

## After the Plan is Produced

⏸ PAUSE and present the full phase plan to Andy.

Ask Andy to confirm:
1. Does the breakdown make sense?
2. Are you happy with where the phase boundaries are?
3. Are there any open questions that need answering before Phase 1 starts?
4. Shall we begin with Phase 1?

---

## When Andy Approves

Once Andy confirms the plan, respond with:

"Great. To start Phase 1, run:
`/build-feature [Phase 1 description from the plan]`

Keep this plan handy — once Phase 1 is complete and confirmed working,
we'll run `/build-feature` again with the Phase 2 description."

Do NOT automatically start /build-feature. Andy runs it separately and
deliberately for each phase.
