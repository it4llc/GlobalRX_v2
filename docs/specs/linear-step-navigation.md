# Feature Specification: Linear Step Navigation

**Spec file:** `docs/specs/linear-step-navigation.md`
**Date:** May 13, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

This task reorders the candidate application into a new 9-step flow and adds Next/Back navigation buttons so candidates can move through the application step by step. Today, the only way to navigate is by clicking sections in the sidebar. After this change, candidates will also see Next and Back buttons at the bottom of each step, making the experience feel like a guided walkthrough. The sidebar still works for anyone who wants to jump around. No database changes are needed — this is purely a front-end ordering change and button addition.

## Who Uses This

**Candidates** — people filling out a background screening application after receiving an invite link. They see the reordered steps and use the new Next/Back buttons (or the existing sidebar) to move through the application. Many candidates access this on their phones via SMS links.

## Business Rules

1. The structure endpoint must return sections in this new order:
   - Step 1: Before-service workflow sections (e.g., Welcome page)
   - Step 2: IDV (identity verification) — only if the package includes an IDV service
   - Step 3: Address History — entry forms only (no aggregated/record-search fields)
   - Step 4: Education — only if the package includes an education service
   - Step 5: Employment — only if the package includes an employment service
   - Step 6: Personal Info — dynamic fields only (the static name/email/phone fields stay as-is for now; Task 8.3 will remove them later)
   - Step 7: Record Search Requirements — only if applicable (the aggregated fields area stays inside Address History for now; Task 8.4 will split it out later)
   - Step 8: After-service workflow sections (e.g., consent/disclosure forms)
   - Step 9: Review & Submit

2. Next and Back buttons appear at the bottom of every step's content area.

3. The Next button uses a primary/filled style. The Back button uses a secondary/outline style. This visual difference guides the candidate forward through the flow.

4. The first step has no Back button. The last step (Review & Submit) has no Next button — the existing Submit button takes the place of Next.

5. On the Review & Submit step, the Back button appears alongside the Submit button in the same row.

6. Next and Back must skip steps that don't apply to the candidate's package. For example, if the package has no IDV service, pressing Next from Step 1 jumps straight to Step 3 (Address History).

7. The Next/Back buttons must use the same navigation logic that already exists — the `handleSectionClick` function in `portal-layout.tsx`. No new navigation system is created.

8. The sidebar continues to work exactly as it does today. Candidates can still click any section in the sidebar to jump directly to it. Next/Back and sidebar navigation work together, not as replacements for each other.

9. The sidebar shows section names only — no step numbers.

10. The existing progress indicators (green check for complete, red exclamation for incomplete, grey circle for not started) are unchanged and continue to appear in the sidebar next to each section.

11. When a candidate clicks Next or Back, the page scrolls to the top of the new section so they aren't stranded at the bottom of the page.

12. Next/Back buttons must be touch-friendly for mobile use — at least 44px tall (the standard minimum for tap targets on phones).

13. The button labels are "Next" and "Back" (these need translation keys for multilingual support).

14. Before-service workflow sections may include multiple sections (e.g., a Welcome section and a Consent section). Each one is its own step, and Next/Back moves between them individually.

15. The same applies to after-service workflow sections — each is its own step.

## User Flow

The candidate opens their application link on their phone. They land on the first step (the Welcome page, which is a before-service workflow section). At the bottom of the Welcome content, they see a "Next" button with a prominent filled style. They tap Next and the page scrolls up to show the next applicable step — maybe IDV if their package includes it, or Address History if it doesn't.

At the top of each step, they see the step name in the sidebar (which on mobile is a slide-out drawer they can open with the hamburger menu). Each step shows its completion status with the existing colored indicators.

The candidate works through each step. At the bottom of each step they see a subtle "Back" button on the left and a prominent "Next" button on the right. They press Next to advance. If they realize they need to fix something in an earlier step, they press Back (or open the sidebar and tap the section directly).

When they reach the final step — Review & Submit — they see the Back button alongside the Submit button. The Submit button that already exists serves as the final action — there is no separate Next button on this step.

## Data Requirements

No new data fields are stored. This task only changes the order sections are returned by the structure endpoint and adds navigation buttons to the UI. There is no database change.

The only new text strings needed are for the button labels:

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Next | candidate.navigation.next | translation key | Required | — | "Next" |
| Back | candidate.navigation.back | translation key | Required | — | "Back" |

## Edge Cases and Error Scenarios

1. **Package has no optional sections (no IDV, no Education, no Employment):** The flow skips those steps entirely. Next jumps from whatever exists to the next applicable step. The candidate never sees steps that don't apply to them.

2. **Package has no before-service workflow sections:** The first step becomes whatever comes next in the order (IDV, or Address History if no IDV either).

3. **Package has no after-service workflow sections:** Next jumps from Record Search Requirements (or the last applicable step before it) straight to Review & Submit.

4. **Only one step exists (extremely unlikely but possible):** No Next or Back buttons are shown — there's nothing to navigate to.

5. **Candidate uses sidebar and Next/Back interchangeably:** This must work seamlessly. If a candidate clicks a section in the sidebar, the Next/Back buttons should still correctly point to the adjacent applicable steps relative to where they now are.

6. **Candidate is on a step and it becomes inapplicable (edge case for future tasks):** For now, this doesn't happen because the step list is fixed when the structure loads. Tasks 8.3–8.5 will deal with dynamic step changes. This task only handles the static order.

7. **Mobile screen sizes (320px minimum):** Next/Back buttons must be full-width or nearly full-width on small screens so they're easy to tap. They should not be tiny text links.

8. **Multiple before-service or after-service workflow sections:** Each one is treated as its own step. If there are 3 before-service sections, the candidate sees steps 1, 2, 3 before reaching IDV or Address History.

## Impact on Other Modules

**Tasks 8.3, 8.4, and 8.5 all depend on this task.** The new step order established here is the foundation that those later tasks build on. Specifically:

- Task 8.3 (Personal Info relocation) assumes the new step order is in place
- Task 8.4 (Record Search Requirements split) assumes the new step order is in place
- Task 8.5 (Silent recalculation and step skipping) builds on the skip logic established here

No other modules outside the candidate workflow are affected.

## Definition of Done

1. The structure endpoint returns sections in the new 9-step order described in Business Rule 1.
2. Next and Back buttons appear at the bottom of each step's content area.
3. Next button uses primary/filled style; Back button uses secondary/outline style.
4. The first step shows only a Next button (no Back).
5. The last step (Review & Submit) shows only a Back button alongside the existing Submit button (no Next).
6. Next and Back correctly skip steps that don't apply to the candidate's package.
7. Pressing Next or Back scrolls the page to the top of the new section.
8. The sidebar continues to work as it does today — clicking a section in the sidebar navigates to it.
9. Using the sidebar and then pressing Next/Back correctly navigates relative to the current position.
10. Next/Back buttons are at least 44px tall for mobile touch targets.
11. Next/Back buttons are usable on screens as narrow as 320px.
12. Translation keys exist for "Next" and "Back" button labels.
13. Existing progress indicators (green check, red exclamation, grey circle) still display correctly in the sidebar.
14. The application works the same as before on desktop (sidebar at 768px and wider) — the buttons are an addition, not a replacement.