# Feature Specification: Personal Info — 100% Dynamic

**Spec file:** `docs/specs/personal-info-dynamic.md`
**Date:** May 14, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

This task removes the three static/locked fields (name, email, phone) from the Personal Info section and makes it entirely driven by the cross-section registry. Those static fields are now redundant because the Welcome workflow section (built in Task 8.1) already shows them to the candidate via template variables. After this change, Personal Info only shows dynamic subject-targeted fields — things like "Mother's Maiden Name" or "National ID Number" that depend on which countries the candidate selected in their address, education, and employment entries. If no countries in the candidate's entries require subject-targeted fields, the Personal Info section shows a message saying there's nothing to fill in, and the section is considered complete. Task 8.2 already moved Personal Info to Step 6 in the flow, so no position change is needed.

## Who Uses This

**Candidates** — they see fewer redundant fields. Their name, email, and phone are shown on the Welcome page instead of being repeated on Personal Info.

## Business Rules

1. The three static/locked fields — candidate name, candidate email, and candidate phone — are removed from `PersonalInfoSection.tsx`. The code that renders them is deleted, not just hidden.

2. Personal Info becomes 100% driven by the cross-section subject-targeted field registry. The only fields shown are ones pushed to the registry by the candidate's country selections in address, education, and employment entries.

3. The existing save and auto-save behavior for dynamic fields continues to work exactly as it does today. No changes to how field values are saved or loaded.

4. If the cross-section registry has no subject-targeted fields for the candidate's entries (meaning no country they selected requires any), Personal Info displays a short message like "No additional information is required" and the section is considered complete (green check in the sidebar).

5. Previously saved data for the static fields (name, email, phone) is left alone in the database. It is not deleted or migrated. The fields simply stop being rendered.

6. The validation logic for Personal Info must be updated to only validate the dynamic registry fields. It should no longer expect or check for the static fields.

7. The Review & Submit section's summary for Personal Info must also reflect the removal — it should not show name, email, or phone in the review, and should not flag them as incomplete.

8. If a candidate had previously filled in dynamic fields on Personal Info, then goes back and changes their country selections so those fields are no longer needed, the saved data for those fields is preserved in the database but the fields are hidden. If the candidate adds that country back, the previously entered data reappears. (This is the data preservation behavior — Task 8.5 will handle the navigation-level skipping and recalculation triggers.)

## User Flow

The candidate works through the application. After completing their address, education, and employment entries (Steps 3–5), they arrive at Personal Info (Step 6).

If their country selections triggered subject-targeted fields (for example, they entered a Brazilian address and Brazil requires "Mother's Maiden Name"), they see those fields and fill them in. Auto-save works on field blur as usual.

If none of their country selections require subject-targeted fields, they see a short message saying no additional information is needed. The section shows a green check and they can press Next to continue.

At no point do they see their name, email, or phone on Personal Info — that information is on the Welcome page.

## Data Requirements

No new data fields are stored. No database changes. This task only removes rendered fields from the component and updates validation.

No new translation keys are needed beyond one for the empty-state message:

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| No additional information required | candidate.personalInfo.noFieldsRequired | translation key | Required | — | "No additional information is required." |

## Edge Cases and Error Scenarios

1. **No subject-targeted fields exist for any country the candidate selected:** Personal Info shows the "no additional information" message and is marked complete. The candidate presses Next and moves on.

2. **Candidate previously saved data in the static fields:** The data stays in the database untouched. It just stops being shown. No migration needed.

3. **Candidate changes countries after filling in Personal Info fields:** The cross-section registry updates. Fields that no longer apply are hidden but their data is preserved. New fields that appear are empty and the candidate must fill them in. (The navigation-level handling of this — like automatically skipping Personal Info if it becomes empty — is Task 8.5.)

4. **All dynamic fields are optional and the candidate leaves them blank:** The section is complete as long as all required fields are filled. If all fields happen to be optional, the section is complete even if left blank.

5. **Existing candidates who started their application before this change:** They will see the updated Personal Info (no static fields) the next time they open their application. Their previously saved dynamic field data loads normally. No disruption.

## Impact on Other Modules

**Review & Submit** — must stop showing name, email, and phone in its Personal Info summary.

**Task 8.5 (Silent Recalculation)** — depends on this task being complete. Once Personal Info is 100% dynamic, Task 8.5 adds the logic to skip it in navigation when there are no fields.

No other modules are affected.

## Definition of Done

1. The static fields (name, email, phone) no longer appear on the Personal Info section.
2. Personal Info renders only dynamic subject-targeted fields from the cross-section registry.
3. When no subject-targeted fields exist, Personal Info shows a "no additional information required" message.
4. When no subject-targeted fields exist, Personal Info's status is "complete" (green check in sidebar).
5. Auto-save continues to work for dynamic fields on field blur.
6. Validation only checks dynamic registry fields — no longer expects static fields.
7. Review & Submit no longer shows name, email, or phone in the Personal Info summary.
8. Previously saved static field data is left untouched in the database.
9. Previously saved dynamic field data for hidden fields (due to country changes) is preserved but not displayed.
10. The empty-state translation key exists in all 5 language files (en-US, en-GB, es-ES, es, ja-JP).
11. The section works correctly on mobile (320px minimum width).