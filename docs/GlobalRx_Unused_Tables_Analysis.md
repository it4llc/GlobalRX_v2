# GlobalRx — Unused Database Tables Analysis
**Prepared:** March 2026  
**Status:** Reference Document  

---

## Overview

A database analysis of the GlobalRx platform identified 13 tables with zero rows. This document records what was found for each table, why it is empty, and what action (if any) should be taken.

Tables fall into four categories:
- **Planned** — needed for future features, keep as-is
- **Orphaned** — replaced by a different implementation, candidates for removal
- **Likely Dead Code** — no longer needed, needs verification before removing
- **Placeholder** — never implemented, leave alone for now

---

## Summary Table

| Table | Rows | Has Routes | Has UI | Assessment |
|---|---|---|---|---|
| address_entries | 0 | No | Yes | Placeholder — not needed now |
| city_mappings | 0 | No | No | Placeholder — not implemented |
| customer_users | 0 | Yes | Yes | Likely dead code — users moved to User Admin |
| data_fields | 0 | No | Partial | Orphaned — data stored in dsx_requirements |
| documents | 0 | No | Types only | Orphaned — data stored in dsx_requirements |
| order_documents | 0 | No | No | Placeholder — not implemented yet |
| order_statuses | 0 | Yes | Yes | Orphaned — statuses stored as string in orders.statusCode, history in order_status_history |
| package_services | 0 | No | Yes | Planned — needed when packages feature is built |
| packages | 0 | Yes | Yes | Planned — packages feature not yet complete |
| service_audit_log | 0 | Yes | Yes | Active — logs service changes and vendor assignments. Table empty due to no production data yet. |
| translations | 0 | No | Yes | Implemented differently — app uses JSON files instead |
| workflow_sections | 0 | Yes | Yes | Planned — workflow feature not yet implemented |
| workflows | 0 | Yes | Yes | Planned — workflow feature not yet implemented |

---

## Category 1: Planned — Keep, Will Be Used Later

These tables are empty because the features that use them have not been fully built yet. They should be kept as-is and will be populated when the relevant features are completed.

### packages
- **Prisma Model:** Package
- **API Routes:** Yes — `/api/packages/[id]`, `/api/customers/[id]/packages`
- **UI Components:** Yes — customer package management pages
- **Why Empty:** The packages feature is partially built but not yet complete. No packages have been created.
- **Action:** Keep. Will be populated when the packages feature is finished.

### package_services
- **Prisma Model:** PackageService
- **API Routes:** None directly
- **UI Components:** Yes — `customer-packages.tsx`, `customers-packages-fixed.tsx`
- **Why Empty:** Dependent on the packages feature. No packages exist so no package-service links exist.
- **Action:** Keep. Will be populated when the packages feature is finished.

### workflows
- **Prisma Model:** Workflow
- **API Routes:** Yes — `/api/workflows`, `/api/workflows/[id]`, `/api/customers/[id]/workflows`
- **UI Components:** Yes — multiple workflow management pages
- **Why Empty:** The Candidate Workflow module is not yet implemented. Routes and UI components are scaffolded but the feature is not built.
- **Action:** Keep. Will be used when Candidate Workflow is implemented.

### workflow_sections
- **Prisma Model:** WorkflowSection
- **API Routes:** Yes — `/api/workflows/[id]/sections`, `/api/workflows/[id]/sections/[sectionId]`
- **UI Components:** Yes — `workflow-section-list.tsx`, `workflow-section-dialog.tsx`
- **Why Empty:** Same as workflows — dependent on Candidate Workflow feature.
- **Action:** Keep. Will be used when Candidate Workflow is implemented.

### order_documents
- **Prisma Model:** OrderDocument
- **API Routes:** None
- **UI Components:** None
- **Why Empty:** Document upload for orders is planned but not yet built.
- **Action:** Keep as a placeholder for future document upload functionality.

### city_mappings
- **Prisma Model:** CityMapping
- **API Routes:** None
- **UI Components:** None
- **Why Empty:** No implementation exists. May have been planned for address deduplication.
- **Action:** Keep for now. Revisit when/if address deduplication is needed.

---

## Category 2: Orphaned — Data Stored Elsewhere

These tables exist in the schema but the application was refactored to store the same data in a different table. The old tables are empty and the old Prisma models still exist but are no longer used by any active route.

### data_fields
- **Prisma Model:** DataField
- **Where Data Actually Lives:** `dsx_requirements` table (`type = 'field'`) — 17 records confirmed
- **Active Routes:** `/api/data-rx/fields` reads from `dsx_requirements`, not `data_fields`
- **Orphaned Route:** `/api/available-requirements` was querying `data_fields` — this route has been deleted
- **Why Empty:** The platform was migrated from separate `data_fields` and `documents` tables to a unified `dsx_requirements` table. The old model was not removed.
- **Action:** Candidate for removal in a future cleanup. The Prisma model and table can be dropped safely once confirmed no other references exist.

### documents
- **Prisma Model:** Document
- **Where Data Actually Lives:** `dsx_requirements` table (`type = 'document'`) — 5 records confirmed
- **Active Routes:** `/api/data-rx/documents` reads from `dsx_requirements`, not `documents`
- **Why Empty:** Same migration as `data_fields` — moved to unified `dsx_requirements` table.
- **Action:** Candidate for removal in a future cleanup alongside `data_fields`.

### translations
- **Prisma Model:** Translation
- **Where Data Actually Lives:** JSON files in `src/translations/` (e.g. `en.json`, `es.json`)
- **Active Routes:** None — translations are served from JSON files, not the database
- **Why Empty:** The translation system was implemented using file-based JSON rather than database storage. The DB table was never used.
- **Action:** Candidate for removal in a future cleanup. No impact on current functionality.

### order_statuses
- **Prisma Model:** OrderStatus
- **API Routes:** Yes — `/api/fulfillment/orders/[id]/route.ts`
- **UI Components:** Yes — `OrderStatusDropdown.tsx`, `OrderDetailsSidebar.tsx`, `order-status-progression.service.ts`
- **Why Empty:** The application stores order status as a plain string directly in the `orders.statusCode` column using hardcoded constants from `src/constants/order-status.ts`. Order status history is tracked in the `order_status_history` table and is visible in the sidebar. The `order_statuses` lookup table was never used.
- **Where Data Actually Lives:** `orders.statusCode` (string field) for current status. `order_status_history` table for history — confirmed working and visible in the sidebar.
- **Action:** Candidate for removal in a future cleanup alongside `data_fields` and `documents`. The Prisma model and table can be dropped safely once confirmed no active code references `prisma.orderStatus`.

---

## Category 3: Likely Dead Code — Needs Verification

These tables have API routes and UI components but appear to no longer serve an active purpose based on how the platform currently works.

### customer_users
- **Prisma Model:** CustomerUser
- **API Routes:** Yes — referenced in `/api/fulfillment/route.ts`
- **UI Components:** Yes — `customer-user-form.tsx`, `customer-user-edit-form.tsx`, customer config pages
- **Why Empty:** Users appear to have been moved to the central User Admin module. No customer-specific users have been created.
- **Action:** Needs verification. If customer user management was intentionally moved to User Admin, these routes and UI components may be dead code and should be removed. Confirm with Andy before removing.

---

## Category 3b: Corrected — Active but Empty

These tables were initially assessed as dead code but further investigation confirmed they are actively used. They are empty only because no production data has been created yet.

### service_audit_log
- **Prisma Model:** ServiceAuditLog
- **API Routes:** Yes — `/api/fulfillment/services/[id]/history`
- **Services:** `service-fulfillment.service.ts` (3 active calls), `history/route.ts` (1 active call)
- **Why Empty:** No production orders have been processed yet so no audit entries have been created. The service is wired up and will populate as services are updated and vendor assignments are made.
- **What It Tracks:** Service-level changes — vendor assignments, service updates, bulk operations. This is different from service comments which track status changes. They serve different purposes.
- **Action:** Keep. No changes needed. The table will populate naturally as the platform is used.

---

## Category 4: Placeholder — Not Needed Now

These tables exist in the schema but the functionality they were intended to support is not needed at this time.

### address_entries
- **Prisma Model:** AddressEntry
- **API Routes:** None
- **UI Components:** Referenced in `order.service.ts`, `field-resolver.service.ts`, `address.service.ts`
- **Why Empty:** Was intended for address deduplication — detecting when the same address is entered in multiple places. This feature is not needed now.
- **Action:** Leave as-is. Revisit if address deduplication becomes a requirement.

---

## Recommended Actions

### Immediate — Already Done
- Deleted orphaned `/api/available-requirements` route (was querying `data_fields` and `documents` tables that had no data)

### Future Cleanup Pass
- Remove `data_fields` Prisma model and database table — data lives in `dsx_requirements`
- Remove `documents` Prisma model and database table — data lives in `dsx_requirements`
- Remove `translations` Prisma model and database table — app uses JSON files
- Remove `order_statuses` Prisma model and database table — status stored in `orders.statusCode`, history in `order_status_history`
- Investigate `customer_users` — confirm whether customer user management moved entirely to User Admin, then remove dead code if confirmed

### No Action Needed
- `packages`, `package_services` — keep for packages feature
- `workflows`, `workflow_sections` — keep for Candidate Workflow feature
- `order_documents` — keep as placeholder for document upload
- `city_mappings` — keep as placeholder
- `address_entries` — keep, not needed now but may be useful later
- `service_audit_log` — active, will populate as platform is used

---

## Important Notes

- Before removing any Prisma model or table, always run a full grep search to confirm no remaining code references that model. Removing a model that is still referenced will cause TypeScript compilation errors.
- Table removal should be done through a proper Prisma migration, not by manually editing the schema, to ensure the change is tracked in version control.
- This analysis was conducted in March 2026 as part of a broader test suite cleanup effort.
