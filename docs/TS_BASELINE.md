# TypeScript Error Baseline

## Current Baseline
- **Count:** 2853
- **Date:** April 15, 2026
- **Branch:** dev

## How to Check for Regressions

Run this one-liner to compare current errors against baseline:

```bash
EXPECTED=2853; ACTUAL=$(pnpm tsc --noEmit 2>&1 | grep -cE "error TS[0-9]+"); echo "Baseline: $EXPECTED | Current: $ACTUAL | Delta: $((ACTUAL - EXPECTED))"
```

- **Delta 0:** Clean — no new errors introduced.
- **Delta negative:** You accidentally fixed something. Nice. Update this file.
- **Delta positive:** Something added errors. Investigate before merging.

## Known Error Populations (not yet fixed)

| Category | Errors | Tracking | Notes |
|----------|--------|----------|-------|
| `permissions.fulfillment` missing from type | 73 | TD-038 | Needs design decision on canonical shape |
| `permissions.admin` missing from type | ~4 | TD-038 | Same root cause as fulfillment |
| `service.order.subject` field access | 2 | TD-040 | Needs investigation — may be missing Prisma select or dead code |
| Schema drift in remaining route files | ~170 | Bucket 4 backlog | Playbook proven, paused for feature work |
| Other (test files, components, etc.) | ~2600 | Future buckets | Not yet triaged |

## History

| Date | Count | Delta | What Changed |
|------|-------|-------|--------------|
| March 2026 | 3174 | — | Initial baseline |
| April 2026 | 2904 | -270 | Bucket 2: Prisma mock typing in tests |
| April 2026 | 2865 | -39 | Bucket 4-pre: Centralized User type in auth-utils |
| April 15, 2026 | 2860 | -5 | Bucket 4 pilot: services/[id]/status/route.ts |
| April 15, 2026 | 2853 | -7 | Bucket 4 batch 2: fulfillment/services/[id]/route.ts |