# Documentation Report: Requirements API Deduplication Logic Bug Fix
**Date:** 2026-03-20

## Code Comments Added

### File: `/src/app/api/portal/orders/requirements/route.ts`
**Comments added:**
- **Lines 205-216:** Added comprehensive bug fix explanation for subject field deduplication
  - Documented the previous "first-wins" logic problem that caused missing red asterisks
  - Explained how multiple services with different requirement statuses for the same field would only use the first service's status
  - Detailed the solution: OR logic where a field is required if ANY service requires it

- **Lines 255-259:** Added bug fix explanation for document deduplication
  - Documented the same OR logic fix for documents with 'per_case' scope
  - Explained that shared documents should use the most restrictive requirement status

- **Root cause documented:** The deduplication logic didn't consider that multiple services might have different requirement statuses for the same field/document. The fix ensures that the most restrictive requirement (required=true) takes precedence.

## Technical Documentation Updated

### Document: `docs/CODING_STANDARDS.md`
**Section:** Documentation Standards (Section 14)
**Change:** Added new "Business Logic Documentation" subsection (14.4) with comprehensive guidelines for deduplication and data merging logic
- **OR logic** - Use when the most restrictive rule should win (e.g., required fields)
- **AND logic** - Use when all conditions must be met
- **First-wins** - Only use when order matters and later entries should be ignored
- **Last-wins** - Only use when the most recent value should override
- Added code example showing proper OR logic for requirements deduplication
- Included bug prevention guidance with wrong vs. right patterns

## API Documentation
**No new API endpoints created** - this was a bug fix to existing POST /api/portal/orders/requirements endpoint behavior. The API contract remains unchanged, only the internal logic was corrected.

## Coding Standards Updated
**Added new standards section:** Business Logic Documentation guidelines to prevent similar deduplication logic bugs in the future.

The new standards establish clear patterns for documenting merge strategies and choosing appropriate logic (OR vs. AND vs. first-wins vs. last-wins) based on business requirements.

## Audit Report Impact
**Addresses Code Structure and Organization findings:** This bug fix improves business logic reliability and reduces the risk of UI inconsistencies that could impact user experience. While not directly called out in the audit findings, fixing deduplication logic bugs contributes to:
- More reliable UI behavior (red asterisks appear when they should)
- Better business rule enforcement (most restrictive requirements win)
- Improved code maintainability through clear documentation of merge strategies

## Documentation Gaps Identified
**No significant documentation gaps identified for this specific bug fix** - the issue was primarily related to undocumented business logic assumptions rather than missing API or feature documentation.

## TDD Cycle Complete
This bug fix has passed through all stages:
✅ Business Analyst — User reported missing red asterisks when multiple services had different requirement statuses
✅ Architect — Root cause analysis identified deduplication logic using "first-wins" instead of OR logic
✅ Test Writer — Regression tests written to prove the bug existed and verify the fix
✅ Implementer — Fixed deduplication logic to use OR logic for both subject fields and documents
✅ Code Reviewer — Logic and security approved
✅ Standards Checker — Coding standards updated with deduplication guidelines
✅ Documentation Writer — Comprehensive documentation and code comments added

**Feature "Requirements Deduplication Logic Fix" is complete.**

## Key Learning for Future Development

**Critical Pattern Identified:** When merging data from multiple sources where fields can have different requirement statuses:

1. **Identify the business rule first**: Should the most restrictive rule win, or least restrictive?
2. **Document the merge strategy clearly**: OR logic, AND logic, first-wins, or last-wins
3. **Add regression tests**: Verify the edge cases where the bug would manifest
4. **Comment the fix**: Explain both what was broken and why the solution works

This bug could have been prevented by:
- Clear documentation of the intended deduplication strategy
- Tests covering the specific edge case (multiple services, different requirement statuses)
- Code comments explaining why OR logic is needed for requirement merging

## Files Modified Summary
1. `src/app/api/portal/orders/requirements/route.ts` - Fixed deduplication logic to use OR logic for both subject fields and documents with comprehensive explanatory comments
2. `docs/CODING_STANDARDS.md` - Added business logic documentation standards to prevent similar issues

This fix resolves the user experience issue where required fields would appear optional (missing red asterisks) when the deduplication logic incorrectly used "first-wins" instead of OR logic for merging requirement statuses from multiple services.