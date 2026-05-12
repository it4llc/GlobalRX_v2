# Test Baseline

## Current Baseline
- **Passing:** 4476
- **Skipped:** 174
- **Failing:** 0
- **Test files:** 294 passed, 4 skipped (298 total)
- **Date:** May 12, 2026
- **Branch:** feature/td-084-required-indicator-per-country (merged to dev)
- **Runner:** Vitest v4.0.18

## How to Check for Regressions

```bash
pnpm vitest run 2>&1 | tail -5
```

- **Zero failing tests required** before merging any branch.
- **Skipped count:** 174. Any decrease is fine; any increase requires explanation.
- **Passing count:** 4476. A delta below this warrants investigation before merging.

## History

| Date | Passing | Skipped | Failing | What Changed |
|------|---------|---------|---------|--------------|
| Pre-April 2026 | 2631 | 167 | 0 | Initial raw log baseline |
| May 12, 2026 | 4476 | 174 | 0 | TD-084: OR-merge implementation + tests (orMergeConsistency, validationEngine TD-084 block, route TD-084 block); accumulated growth from phases 6–7 |
