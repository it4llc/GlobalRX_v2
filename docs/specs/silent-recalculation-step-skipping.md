# Feature Specification: Silent Recalculation and Step Skipping (Task 8.5)
**Spec file:** `docs/specs/silent-recalculation-step-skipping.md`
**Date:** May 14, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

When a candidate goes back to an earlier step in the application and changes location information — such as adding or removing an address, or changing the country on an education or employment entry — all later steps that depend on that information must silently recalculate what they show. No warnings, no error messages, no "something changed" alerts. Steps that end up with nothing to show (because the recalculation removed all their content) must be automatically skipped. This is the final task in Phase 8 and brings the full linear 9-step candidate flow to completion.

This task builds on top of two completed tasks:
- **Task 8.3** made Personal Info (Step 7) 100% dynamic — it only shows fields from the cross-section registry, which tracks what countries the candidate has selected across all entry types
- **Task 8.4** split Record Search Requirements (Step 8) out of Address History into its own step — it shows aggregated fields computed from the candidate's address entries

Both of those steps already have the right data sources. What's missing is the explicit recalculation trigger when the candidate navigates between steps, the logic to skip empty steps, and the updates to Review & Submit validation to handle steps that may or may not exist.

## Who Uses This

**Candidate** — the person filling out the background screening application. They navigate between steps using the Next/Back buttons or the sidebar. When they go back and change location information, the rest of the application adjusts automatically without any interruption to their experience.

No internal admin, customer, or vendor users are involved in this feature.

## Business Rules

1. **Silent recalculation on navigation to Personal Info (Step 7):** When the candidate navigates to Step 7, the system recalculates which subject-targeted fields are needed by reading the current state of the cross-section registry. The cross-section registry itself already updates when country selections change in address, education, or employment entries — this rule is about making sure Personal Info reflects those updates when the candidate arrives at the step.

2. **Silent recalculation on navigation to Record Search Requirements (Step 8):** When the candidate navigates to Step 8, the system recalculates which aggregated fields are needed by running the existing `computeAddressHistoryAggregatedItems` logic against the candidate's current address entries.

3. **Data preservation for removed fields:** When recalculation determines that a field is no longer needed (because the candidate removed the country that required it), the previously entered data for that field is kept in saved data — it is NOT deleted. This is so that if the candidate adds that country back later, their previous answers reappear automatically. The field is simply hidden from the candidate's view.

4. **New required fields appear empty:** When recalculation determines that a new field is now needed (because the candidate added a country that requires it), that field appears as empty. The candidate must fill it in before they can submit. There is no pre-population of new fields.

5. **Step skipping — Personal Info:** If the cross-section registry contains zero subject-targeted fields for this candidate's entries, Step 7 (Personal Info) is skipped entirely. The Next button from Step 6 (after-service workflow sections) goes directly to Step 8 (Record Search Requirements) or Step 9 (Review & Submit) — whichever is the next applicable step. The sidebar also skips this step (it does not appear in the list). The Back button from the step after it goes back to Step 6.

6. **Step skipping — Record Search Requirements:** If there are zero aggregated fields to collect (either because the package has no record-type services, or because the candidate's addresses don't trigger any aggregated requirements), Step 8 is skipped entirely. Same skip behavior as Rule 5 — navigation jumps over it, sidebar hides it.

7. **Step skipping is dynamic:** A step can go from skipped to visible (or visible to skipped) as the candidate changes their entries. For example: a candidate starts with only US addresses (no aggregated fields, Step 8 is skipped), then goes back and adds a UK address that triggers aggregated fields — Step 8 now appears. The reverse also applies: removing the last entry that triggered a step's content causes that step to become skipped.

8. **No warnings or alerts:** Recalculation and step skipping happen completely silently. The candidate never sees messages like "Your information has changed" or "Some fields have been removed." The application simply shows the correct current state.

9. **Review & Submit accounts for dynamic steps:** The Review & Submit step (Step 9) must handle the fact that Steps 7 and 8 may or may not exist. Specifically:
   - If Step 7 is skipped, it does not appear in the review summary and is not included in the "all sections must be complete" validation
   - If Step 8 is skipped, same treatment
   - If a step was previously visible and complete but is now skipped (because recalculation removed all its content), it does not block submission
   - If a step was previously skipped but is now visible (because recalculation added new content), it appears as incomplete in the review and the candidate must go back and fill it in before submitting

10. **Recalculation does not trigger auto-save:** The act of recalculating which fields are visible does not itself trigger a save. Auto-save continues to work as normal — on field blur — but simply recalculating the visible field set on step navigation is not a save event.

11. **Performance:** Recalculation (determining which fields to show or hide on Steps 7 and 8) must complete in under 1 second. The candidate should not see any loading spinner or delay when navigating to these steps.

12. **Rapid navigation:** If a candidate quickly clicks through steps using the sidebar or Next/Back buttons, recalculation must still produce correct results. There is no debounce or delay — each navigation to Step 7 or Step 8 recalculates based on the current state at that moment.

## User Flow

### Flow 1: Candidate changes an address and navigates forward

The candidate is on Step 3 (Address History). They already had two US addresses entered and had previously completed Steps 7 and 8. They add a third address in Brazil.

They click Next through Steps 4, 5, and 6. When they arrive at Step 7 (Personal Info), the system recalculates: Brazil's DSX requirements include a subject-targeted field (say, "Mother's Maiden Name"). That field now appears on Personal Info as empty. Any fields that were already filled in from the previous visit are still there with their values. The candidate fills in the new field.

They click Next to Step 8 (Record Search Requirements). The system recalculates: Brazil triggers an additional aggregated requirement. That new field appears as empty alongside the existing fields (which still have their values). The candidate fills it in, then proceeds to Review & Submit.

### Flow 2: Candidate removes an address that was the only trigger for dynamic content

The candidate is on Step 3 (Address History). They originally had a UK address that caused subject-targeted fields on Step 7 and aggregated fields on Step 8. They delete the UK address. Now all remaining addresses are in the US, which has no subject-targeted fields and (in this scenario) no aggregated fields.

They click Next through the steps. Step 7 (Personal Info) is now skipped — the Next button from Step 6 goes directly to Step 9 (Review & Submit) since Step 8 is also skipped. The sidebar no longer shows Steps 7 or 8. The data the candidate previously entered for the UK-specific fields is preserved in saved data but hidden.

If the candidate later goes back and adds a UK address again, Steps 7 and 8 reappear with the previously entered data pre-filled.

### Flow 3: Step was complete, now it's skipped — submission still works

The candidate had completed all 9 steps including Step 7 (Personal Info) and Step 8 (Record Search Requirements). They go back to Step 3 and remove the address that triggered all the dynamic content. Now Steps 7 and 8 are skipped.

They navigate to Review & Submit. The review summary does not show Steps 7 or 8. The validation does not require them. The candidate can submit successfully.

### Flow 4: Step was skipped, now it has content — blocks submission

The candidate's initial entries only had US addresses, so Steps 7 and 8 were skipped. They completed all visible steps and reached Review & Submit. Then they go back to Step 4 (Education) and change a school's country to Brazil, which triggers a subject-targeted field.

Step 7 (Personal Info) now appears in the sidebar and in the review summary. It shows as incomplete. The candidate must navigate to Step 7, fill in the new field, then return to Review & Submit. The submission validation will not allow submission until the newly visible step is complete.

### Flow 5: Rapid back-and-forth navigation

The candidate is going back and forth between Step 3 (Address History) and Step 7 (Personal Info), adding and removing addresses each time. Each time they arrive at Step 7, the field list reflects the current state of their entries. There are no stale fields, no ghost fields from a previous calculation, and no errors.

## Data Requirements

This task does not introduce any new data fields. It changes the behavior of existing navigation, recalculation, and validation logic. The data structures for Personal Info fields and Record Search Requirements fields already exist from Tasks 8.3 and 8.4.

No database changes are needed — all data lives within the existing `order_data` JSON structure and in-memory state.

## Edge Cases and Error Scenarios

1. **All dynamic steps are skipped from the start:** If the candidate's package and entries never produce any subject-targeted fields or aggregated fields, Steps 7 and 8 never appear at all. The flow goes straight from Step 6 to Step 9. This is not an error — it's a valid and expected scenario.

2. **A step cannot become empty while the candidate is viewing it:** Recalculation only runs when the candidate navigates to a step, not while they are on it. A step's content can only change based on actions taken in a different step (adding/removing addresses, changing countries on education or employment entries). So the candidate will never be "on" a step that suddenly loses all its content. By the time they navigate away and come back, the recalculation on arrival handles the updated state.

3. **Auto-save data exists for a now-hidden field:** The candidate filled in a field, auto-save stored it, then they went back and removed the country that required that field. The auto-saved data stays in storage. It is not deleted. If the field becomes visible again later, the auto-saved value is loaded back.

4. **Both Steps 7 and 8 are skipped:** Navigation goes from Step 6 directly to Step 9. The Back button on Step 9 goes back to Step 6 (or the last visible step before 9).

5. **Step 7 is skipped but Step 8 is not (or vice versa):** Navigation correctly skips only the empty step. For example, if Step 7 is skipped but Step 8 has content: Next from Step 6 goes to Step 8. Back from Step 8 goes to Step 6.

6. **Network failure during auto-save of recalculated step:** Auto-save behavior is unchanged from existing implementation. If auto-save fails, the existing retry/error behavior applies. Recalculation itself doesn't involve network calls — it's computed from in-memory state.

7. **Candidate submits while a previously-skipped step now has content:** The Review & Submit validation catches this. If a step is now visible and has required unfilled fields, submission is blocked and the candidate is shown which step needs attention.

## Impact on Other Modules

This task only affects the **Candidate Workflow** module — specifically the candidate-facing portal. No changes to:
- User Admin
- Global Configurations
- Customer Configurations
- Internal admin views
- API routes used by internal users or customers

The changes are confined to:
- The portal layout's navigation logic (Next/Back button targets and sidebar visibility)
- The recalculation triggers when navigating to Steps 7 and 8
- The Review & Submit section's validation and summary rendering

## Definition of Done

1. When a candidate navigates to Step 7 (Personal Info), the visible fields match the current state of the cross-section registry — no stale or missing fields
2. When a candidate navigates to Step 8 (Record Search Requirements), the visible fields match the current output of the aggregated fields computation — no stale or missing fields
3. Previously entered data for fields that are no longer visible is preserved in saved data (not deleted)
4. New fields added by recalculation appear empty and are required before submission
5. Step 7 is skipped (hidden from sidebar, excluded from Next/Back navigation) when it has no subject-targeted fields
6. Step 8 is skipped (hidden from sidebar, excluded from Next/Back navigation) when it has no aggregated fields
7. Step skipping is dynamic — steps appear and disappear as the candidate's entries change
8. No warnings, alerts, or "data has changed" messages are shown to the candidate during recalculation
9. Review & Submit does not show skipped steps in its summary
10. Review & Submit does not require skipped steps to be complete for submission
11. Review & Submit does require newly-visible steps (that were previously skipped) to be complete for submission
12. Recalculation completes in under 1 second with no visible loading state
13. Rapid navigation between steps produces correct results every time
14. All existing auto-save behavior continues to work correctly
15. Mobile layout (320px minimum) works correctly with step skipping — sidebar drawer, progress indicators, and Next/Back buttons all handle dynamic steps

## Resolved Questions

1. **What happens if a step becomes empty while the candidate is viewing it?** This cannot happen. Recalculation only runs when the candidate navigates *to* a step. A step's content only changes based on actions in a different step (adding/removing addresses, changing countries). The candidate will always navigate away before the step could become empty, and the recalculation on their next arrival handles the updated state.

2. **Should the sidebar show a step count (e.g., "Step 5 of 9")?** No. The sidebar shows step names only, no numbering or total count. This avoids confusion when the total number of visible steps changes dynamically.

3. **Should the progress indicator for a skipped-then-returned step show old status?** Yes. If Step 7 was previously marked complete, then got skipped, then came back with new fields, it retains its previous completion status (which will now show as incomplete because of the new empty required fields). It does not reset to "not started."