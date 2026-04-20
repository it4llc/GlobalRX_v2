# Feature Specification: Candidate Invite Phase 1 — Database Infrastructure

**Spec file:** `docs/specs/candidate-invite-phase1-db-infrastructure.md`
**Date:** April 18, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

Phase 1 restructures the database foundation so workflows and packages relate to each other the right way, adds a new service type for identity verification, and fixes two existing permission bugs in the package API. No new tables are created. The only UI changes are removing the package selector from the workflow dialog and adding a workflow selector to the package dialog.

---

## Who Uses This

- **Internal admin users** — manage packages and workflows in Customer Configurations. They will see a small UI change: the package selector moves from the workflow dialog to become a workflow selector on the package dialog.
- **No customer or candidate users are affected** — this phase has no customer-facing or candidate-facing changes.

---

## Business Rules

1. A **workflow** can be shared by many packages. (Example: an "EU Workflow" can serve both "EU Basic" and "EU Premium" packages.)
2. A **package** can have at most **one** workflow assigned to it.
3. A package does **not require** a workflow — `workflowId` is optional (nullable). Packages created before workflows are configured will simply have no workflow assigned.
4. A **workflow cannot be deleted** while any packages are assigned to it. The user must first reassign or remove the workflow from all packages before the workflow can be deleted. The API returns an error message explaining how many packages still reference the workflow.
5. When a package is deleted, its `workflowId` reference is simply removed along with the package. No effect on the workflow.
6. The current `packageId` column on the `workflows` table must be removed after migrating any existing relationship data to the new structure.
7. The `"idv"` functionality type is added as a valid value for `Service.functionalityType`. Existing services are not changed — `"idv"` is only used when creating new services going forward.
8. Package API `PUT /api/packages/[id]` must return **403** (not 500) when a view-only user tries to edit a package.
9. Package API `DELETE /api/packages/[id]` must return **403** (not 200) when a view-only user tries to delete a package.
10. All existing package and workflow functionality must continue to work after these changes — no regressions.

---

## User Flow

### Assigning a workflow to a package (changed)

**Before:** Admin creates a workflow and selects a package from a radio button list inside the workflow dialog.

**After:** Admin creates or edits a package and selects a workflow from a dropdown inside the package dialog. The dropdown shows all available workflows. Selecting "None" (or leaving it blank) means the package has no workflow.

### Creating a workflow (changed)

**Before:** Admin creates a workflow and must select a package.

**After:** Admin creates a workflow without selecting a package. Packages are assigned to the workflow from the package side.

### Deleting a workflow (changed)

**Before:** Admin could delete a workflow freely.

**After:** Admin tries to delete a workflow. If any packages are assigned to it, the system shows an error: *"This workflow cannot be deleted because it is assigned to X package(s). Please reassign or remove the workflow from those packages first."* Admin must go to each package, change or remove the workflow assignment, then try deleting again.

### Everything else (unchanged)

Creating packages, editing packages, editing workflows, viewing the package list, viewing the workflow list — all remain the same from the user's perspective.

---

## Data Requirements

### Modified Table: `packages`

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Workflow | workflowId | text (UUID) | Optional | Must reference an existing workflow ID if provided | null |

### Modified Table: `workflows`

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| *(removed)* | packageId | *(to be dropped)* | — | — | — |

### Modified Table: `services` (no schema change — new allowed value only)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Functionality Type | functionalityType | text | Required | One of: `record`, `verification-edu`, `verification-emp`, `other`, `idv` | — |

### No New Tables

Phase 1 does not create any new database tables.

---

## Database Migration Details

Because there is existing data in the `workflows` and `packages` tables, the migration must be done carefully in this order:

**Step 1 — Add the new column:**
Add `workflowId` (nullable, UUID, foreign key to `workflows.id`, ON DELETE RESTRICT) to the `packages` table.

**Step 2 — Migrate existing relationships:**
For every workflow that currently has a `packageId`, copy that relationship over: set `packages.workflowId = workflow.id` for the package that workflow points to. This preserves any existing connections.

**Step 3 — Verify the migration:**
Confirm that every `workflows.packageId` value has a corresponding `packages.workflowId` value. Log the count of relationships migrated.

**Step 4 — Remove the old column:**
Drop the `packageId` column from the `workflows` table.

**Step 5 — Add "idv" functionality type:**
No schema change needed — `functionalityType` is already a plain text column. But any Zod validation schemas, TypeScript types, constants files, or UI dropdowns that list the valid functionality types must be updated to include `"idv"`.

---

## UI Changes

### Workflow Dialog — Remove package selector
- Remove the radio button list that currently allows selecting a package when creating or editing a workflow.
- The workflow dialog should no longer reference packages at all.

### Package Dialog — Add workflow selector
- Add a dropdown to the package create/edit dialog labeled "Workflow".
- The dropdown lists all active (non-disabled) workflows by name.
- The first option should be empty/blank (meaning "no workflow assigned").
- Selecting a workflow sets `workflowId` on the package.
- Selecting the blank option sets `workflowId` to null.

### Services UI — Add "idv" option
- Wherever the functionality type dropdown appears (service creation/edit), add "IDV" as a selectable option.
- Display label: "IDV" — stored value: `"idv"`.

---

## Edge Cases and Error Scenarios

1. **What if a workflow's `packageId` points to a package that no longer exists?**
   Log a warning during migration but skip the relationship — don't fail the migration. The orphaned reference is simply dropped.

2. **What if multiple workflows point to the same package?**
   This shouldn't happen with the current one-to-one model, but if it does: only the most recently updated workflow's relationship is migrated (the package gets that workflow's ID). Log a warning for any skipped duplicates.

3. **What if the `packages` or `workflows` tables are empty?**
   The migration runs cleanly — Step 2 simply processes zero rows.

4. **What if a view-only user tries to PUT or DELETE a package?**
   The API returns 403 with a clear error message. No data is modified.

5. **What if someone tries to assign a non-existent workflowId to a package?**
   The foreign key constraint rejects the operation. The API returns 400 with a validation error.

6. **What if a user tries to delete a workflow that has packages assigned to it?**
   The API checks for assigned packages first. If any exist, it returns 400 with a message listing how many packages reference this workflow. The workflow is NOT deleted.

7. **What if a user removes the workflow assignment from a package?**
   The package's `workflowId` is set to null. This is a normal operation and the package continues to function — it just doesn't have a workflow.

8. **What if the same workflow is assigned to many packages and then edited?**
   All packages sharing that workflow pick up the changes automatically — they all reference the same workflow record. This is the intended behavior of the one-to-many relationship. **Note:** Once the CandidateInvitation system is live (Phase 3+), edits will be blocked while active invitations exist — see "Forward-Looking Design Decisions" below.

---

## Forward-Looking Design Decisions

These decisions do NOT need to be implemented in Phase 1, but are documented here so that future phases build on them correctly.

### Blocking edits to workflows and packages during active candidate invitations

**Decision:** Option A — Block edits while in use.

**Rule:** If any `CandidateInvitation` with status `pending` or `in_progress` references a package (directly) or a workflow (via the package's `workflowId`), then:
- The **package** cannot be edited or deleted
- The **workflow** cannot be edited or deleted

The API returns a clear error message, e.g.: *"This package has 3 active candidate invitations. Edits are blocked until all candidates complete or expire."*

**Why:** If a workflow or package is changed while a candidate is mid-application, the candidate could lose progress, see new sections appear, or have validation rules change underneath them. Blocking edits prevents this entirely.

**When to enforce:** Phase 3 (when `CandidateInvitation` table and APIs are built). The package and workflow PUT/DELETE endpoints must add a check for active invitations at that point.

**Future upgrade path:** If blocking becomes too restrictive in practice (e.g., a popular workflow always has active invitations), this can be upgraded to a "snapshot at invite creation" approach where the system freezes a copy of the configuration when the invite is created. Option A's design does not prevent this upgrade.

---

## Impact on Other Modules

### Customer Configurations — Packages

**API routes** (`/api/customer/packages` or `/api/packages`):
- Accept `workflowId` in POST and PUT requests
- Return `workflowId` (and optionally workflow name) in GET responses
- Fix PUT to return 403 for view-only users
- Fix DELETE to return 403 for view-only users
- *(Phase 3 addition: block PUT/DELETE when active candidate invitations exist)*

**UI** (package creation/edit dialog):
- Add workflow dropdown selector

### Customer Configurations — Workflows

**API routes** (`/api/workflows`):
- Stop accepting `packageId` in create/update requests
- Stop returning `packageId` in responses
- DELETE endpoint must check for assigned packages before allowing deletion
- Optionally return a count of packages using this workflow (for display)
- *(Phase 3 addition: block PUT/DELETE when active candidate invitations exist)*

**UI** (workflow creation/edit dialog):
- Remove the package radio button selector

### Global Configurations — Services

**UI** (service creation/edit form):
- Add `"idv"` / `"IDV"` to the functionality type dropdown

**Validation** (Zod schemas, TypeScript types, constants):
- Include `"idv"` as a valid functionality type value

---

## Definition of Done

1. ✅ `workflowId` column exists on `packages` table (nullable, FK to `workflows.id`, ON DELETE RESTRICT)
2. ✅ `packageId` column has been removed from `workflows` table
3. ✅ All existing workflow-to-package relationships have been migrated to the new structure
4. ✅ Migration includes verification logging (row counts before and after)
5. ✅ `"idv"` is a valid functionality type throughout the system (schema, types, validation, UI)
6. ✅ `PUT /api/packages/[id]` returns 403 for view-only users (not 500)
7. ✅ `DELETE /api/packages/[id]` returns 403 for view-only users (not 200)
8. ✅ Existing package list page continues to load and display correctly
9. ✅ Existing workflow list page continues to load and display correctly
10. ✅ Package dialog has a workflow dropdown selector
11. ✅ Workflow dialog no longer has a package selector
12. ✅ Can create a new package with a workflow assigned
13. ✅ Can create a new package with no workflow assigned
14. ✅ Can assign/change a workflow on an existing package
15. ✅ Multiple packages can reference the same workflow
16. ✅ Deleting a workflow that has assigned packages is blocked with a clear error message
17. ✅ Deleting a workflow with no assigned packages succeeds
18. ✅ Can create a new service with functionality type "idv"
19. ✅ All existing tests pass — zero regressions
20. ✅ DATA_DICTIONARY.md updated with the new column and removed column

---

## Open Questions

None — all questions resolved during spec review.