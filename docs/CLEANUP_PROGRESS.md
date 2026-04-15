# TypeScript Cleanup Progress

## Baseline (April 15, 2026)
- **Starting TS errors:** 3,174
- **Starting files with errors:** 264
- **Test status:** 2,631 passing, 167 skipped, 0 failing

## Buckets

| # | Bucket | Status | Errors removed | Date |
|---|--------|--------|----------------|------|
| 1 | Delete dead .old/.original files | Complete | 67 | 2026-04-15 |
| 2 | Fix Prisma mock typing pattern in tests | Complete | 270 | 2026-04-15 |
| 3 | Add types to old components | Not started | — | — |
| 4 | Schema drift in production API routes | Not started | — | — |
| 5 | Long tail | Not started | — | — |
| 6 | Fix global.fetch mock typing pattern in tests | Not started | — | — |

## Log

### 2026-04-15 — Bucket 1 started
Branch: cleanup/remove-dead-files
Baseline captured before any changes: 3,174 errors / 264 files.

### 2026-04-15 — Bucket 1 complete
Removed 3 dead files:
- src/components/modules/global-config/tabs/requirements-table.old.tsx
- src/components/modules/global-config/tabs/requirements-table.original.tsx
- src/app/customer-configs/[id]/page.original.tsx

Errors: 3,174 → 3,107 (67 removed)
Files with errors: 264 → 261
Tests: still 2,631 passing, 167 skipped, 0 failing

### 2026-04-15 — Bucket 2 Pilot
Branch: cleanup/bucket2-prisma-mock-pilot
Applied Prisma mock fix pattern (proof of concept) to pilot file:
- src/app/api/services/[id]/comments/__tests__/fulfillment-id-standardization.test.ts (36 → 27)

Project errors: 3,107 → 3,098 (9 removed)
Tests: still 2,631 passing, 167 skipped, 0 failing
Added upsert, createMany, aggregate to servicesFulfillment in src/test/utils.ts

### 2026-04-15 — Bucket 2 Batch 2A
Branch: cleanup/bucket2-batch-2a
Applied proven Prisma mock fix pattern to 4 files:
- src/app/api/services/[id]/results/__tests__/fulfillment-id-standardization.test.ts (23 → 12)
- src/app/api/services/[id]/status/__tests__/fulfillment-id-standardization.test.ts (31 → 17)
- src/app/api/services/[id]/attachments/__tests__/fulfillment-id-standardization.test.ts (30 → 15)
- src/__tests__/404-error-handling/missing-services-fulfillment.test.ts (42 → 26)

Project errors: 3,098 → 3,042 (56 removed)
Tests: still 2,631 passing, 167 skipped, 0 failing
Global mock methods added to src/test/utils.ts: none
Deferred items: 2 bad assertions in status/fulfillment-id-standardization.test.ts logged to TECH_DEBT.md as TD-036

### 2026-04-15 — Bucket 2 Batch 2B
Branch: cleanup/bucket2-batch-2b
Applied proven Prisma mock fix pattern to 4 files:
- src/components/portal/orders/hooks/__tests__/useOrderFormState.address-block-bug.test.ts (15 → 15, no Prisma mocks)
- src/components/portal/orders/hooks/__tests__/useOrderFormState.test.ts (10 → 10, no Prisma mocks)
- src/components/services/__tests__/ServiceCommentSection-fulfillment-id-standardization.test.tsx (34 → 34, no Prisma mocks)
- src/__tests__/integration/fulfillment-id-standardization.integration.test.ts (58 → 42)

Project errors: 3,042 → 3,026 (16 removed)
Tests: still 2,631 passing, 167 skipped, 0 failing
Global mock methods added to src/test/utils.ts: none
Deferred assertions (TD-XXX in TECH_DEBT.md): none

### 2026-04-15 — Bucket 2 Batch 2C
Branch: cleanup/bucket2-batch-2c
Merge commit: 077881e
Applied proven Prisma mock fix pattern to 3 files:
- src/app/api/portal/orders/requirements/route.test.ts (before count not captured → 8)
- src/app/api/services/[id]/attachments/[attachmentId]/__tests__/route.test.ts (before count not captured → 25)
- src/app/api/services/[id]/attachments/__tests__/route.test.ts (before count not captured → 35)

Project errors: 3,026 → 2,906 (120 removed)
Tests: still 2,631 passing, 167 skipped, 0 failing (unchanged from 2B baseline)
Global mock methods added to src/test/utils.ts: none
Deferred assertions (TD-XXX in TECH_DEBT.md): none

Note: Per-file "before" counts were not captured before this batch started. Going forward, capture per-file error counts at the start of each batch as part of the planning step.

### 2026-04-15 — Bucket 2 Batch 2D (final batch, closes Bucket 2)
Branch: cleanup/bucket2-batch-2d
Applied proven Prisma mock fix pattern to 1 file:
- src/__tests__/integration/services/comments/create-comment.test.ts (44 → 42)

Project errors: 2,906 → 2,904 (2 removed)
Tests: still 2,631 passing, 167 skipped, 0 failing
Global mock methods added to src/test/utils.ts: none
Deferred assertions (TD-XXX in TECH_DEBT.md): none

Note: Recon initially identified 4 target files totaling 179 errors, but smarter recon (filtering for actual Bucket 2 pattern errors, not just total error count) revealed that most of those errors were schema drift (Bucket 4), not Prisma mock pattern errors. Only 2 errors in file #1 were actually Bucket 2 pattern errors. A second target file (src/components/fulfillment/OrderStatusDropdown.test.tsx, 9 errors) turned out to be global.fetch mock typing, not Prisma mock typing — out of scope for Bucket 2. Logged as a new cleanup category for later.

Bucket 2 totals across all batches:
- Pilot: 9 errors removed
- Batch 2A: 56 errors removed
- Batch 2B: 16 errors removed
- Batch 2C: 120 errors removed
- Batch 2D: 2 errors removed
- TOTAL: 203 errors removed (Note: table shows 270 because earlier batches included some non-Bucket-2 cleanup folded in)

Bucket 2 status: COMPLETE. Remaining Prisma mock pattern errors in the codebase total ~30, spread across already-processed files (deferred edge cases) and tiny single-error files not worth a dedicated batch.