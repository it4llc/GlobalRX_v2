// /GlobalRX_v2/src/__tests__/integration/verification-idv-migration.test.ts
//
// Pass 1 integration test for the verification-idv data migration.
//
// What this test asserts:
//   The implementer's data migration file (per technical plan §11.1)
//   exists at prisma/migrations/<TS>_rename_idv_functionality_type/
//   migration.sql, and its SQL contents cover exactly the operations the
//   spec mandates:
//     - UPDATE services SET functionalityType='verification-idv'
//       WHERE functionalityType='idv'
//     - UPDATE package_services normalizing the scope JSON for IDV rows
//       to {"type":"count_exact","quantity":1}
//     - Verification step that aborts if any services row with
//       functionalityType='idv' still exists
//
// Why a file-contents test instead of an SQL-execution test:
//   This project has no integration-test database harness today. The
//   global Prisma mock in src/test/setup.ts intercepts every `@/lib/prisma`
//   import, so executing real SQL is not possible from a vitest run
//   without violating Absolute Rule 2 (no `new PrismaClient()` in tests).
//   The Pass 1 contract is therefore: "the implementer must commit a
//   migration file whose text matches the spec's SQL." If the SQL itself
//   is wrong, Andy will catch it at the staging-verification step
//   documented in technical plan §11.3 (running the SQL against the
//   staging DB and asserting on row state). That step is operator-driven,
//   not vitest-driven.
//
// These tests will FAIL when first run because the migration directory
// does not exist yet. That is the correct RED state for Pass 1.
//
// Spec:           docs/specs/verification-idv-conversion.md
//                 (BR 5, BR 11, Decision 1, Decision 2; DoD 6)
// Technical plan: docs/plans/verification-idv-conversion-plan.md §11

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// The production services row id pinned in spec Decision 1. The migration
// must rewrite this exact row from 'idv' to 'verification-idv'.
const PRODUCTION_IDV_SERVICE_ID = '8388bb60-48e4-4781-a867-7c86b51be776';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'prisma',
  'migrations',
);

/**
 * Find the verification-idv migration directory. The spec / plan does not
 * pin the exact timestamp prefix — the implementer picks it at commit
 * time. We match by suffix ("rename_idv_functionality_type") which is
 * the descriptive snake_case the technical plan §11.1 mandates.
 */
function findMigrationDir(): string | null {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return null;
  }

  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith('_rename_idv_functionality_type')) {
      return path.join(MIGRATIONS_DIR, entry.name);
    }
  }

  return null;
}

describe('verification-idv data migration (BR 11 / DoD 6)', () => {
  let migrationDir: string | null = null;
  let migrationSql: string = '';

  beforeAll(() => {
    migrationDir = findMigrationDir();
    if (migrationDir) {
      const sqlPath = path.join(migrationDir, 'migration.sql');
      if (fs.existsSync(sqlPath)) {
        migrationSql = fs.readFileSync(sqlPath, 'utf-8');
      }
    }
  });

  it('migration directory exists with descriptive _rename_idv_functionality_type suffix', () => {
    // Technical plan §11.1 — "descriptive snake_case after the timestamp.
    // Per DATABASE_STANDARDS §3.2."
    expect(migrationDir).not.toBeNull();
  });

  it('migration directory contains a non-empty migration.sql file', () => {
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  describe('Step 1: rename services.functionalityType from idv to verification-idv', () => {
    it('contains an UPDATE on the services table', () => {
      // BR 11 / DoD 6 — the spec's Migration Concerns section pins the
      // SQL: UPDATE services SET functionalityType='verification-idv'
      // WHERE functionalityType='idv'.
      expect(migrationSql).toMatch(/UPDATE\s+services/i);
    });

    it('sets functionalityType to verification-idv', () => {
      expect(migrationSql).toMatch(/['"]?functionalityType['"]?\s*=\s*'verification-idv'/);
    });

    it('targets rows WHERE functionalityType is the legacy "idv"', () => {
      expect(migrationSql).toMatch(/WHERE\s+['"]?functionalityType['"]?\s*=\s*'idv'/i);
    });
  });

  describe('Step 2: normalize package_services.scope for verification-idv rows (BR 5)', () => {
    it('contains an UPDATE on the package_services table', () => {
      expect(migrationSql).toMatch(/UPDATE\s+package_services/i);
    });

    it('writes scope as {"type":"count_exact","quantity":1}', () => {
      // BR 5 / Decision 2: the explicit, non-null shape.
      expect(migrationSql).toMatch(
        /['"]?type['"]?\s*:\s*['"]?count_exact['"]?/,
      );
      expect(migrationSql).toMatch(/['"]?quantity['"]?\s*:\s*1/);
    });

    it('joins package_services to services on serviceId/id to target IDV rows', () => {
      // The migration must scope its UPDATE to only IDV services. Per
      // plan §11.1: "FROM services s WHERE ps.serviceId = s.id AND
      // s.functionalityType = 'verification-idv'".
      expect(migrationSql).toMatch(/services\s+s/i);
      expect(migrationSql).toMatch(
        /['"]?serviceId['"]?\s*=\s*s\.['"]?id['"]?/,
      );
    });

    it('scopes the UPDATE to rows whose service has functionalityType verification-idv', () => {
      // After Step 1 runs, the production row's functionalityType is
      // already 'verification-idv', so the package_services normalize
      // step keys off the NEW value (not the legacy 'idv').
      expect(migrationSql).toMatch(
        /s\.['"]?functionalityType['"]?\s*=\s*'verification-idv'/,
      );
    });

    it('is idempotent — only updates rows whose scope is not already correct', () => {
      // Technical plan §11.1: "Idempotency guard: only update rows whose
      // scope is not already the correct count_exact:1 shape."
      // The guard looks like:
      //   AND (ps.scope IS NULL
      //        OR ps.scope::text <> '{"type":"count_exact","quantity":1}')
      // We assert on the presence of an idempotency guard without
      // being prescriptive about exact whitespace.
      expect(migrationSql).toMatch(/scope\s+IS\s+NULL/i);
      expect(migrationSql).toMatch(/<>|!=/);
    });
  });

  describe('Step 3: verification that zero idv rows remain', () => {
    it('aborts the migration if any services row with functionalityType=idv survives', () => {
      // BR 11 / DoD 6: "Migration verification failed: services rows
      // with functionalityType=idv still exist". The verification step
      // is what makes the migration safe to deploy strictly before the
      // API rejection takes effect (BR 3 / Decision 3).
      expect(migrationSql).toMatch(/RAISE\s+EXCEPTION/i);
      expect(migrationSql).toMatch(/['"]?functionalityType['"]?\s*=\s*'idv'/);
    });
  });

  describe('Idempotency and safety properties (DATABASE_STANDARDS §4)', () => {
    it('uses RAISE NOTICE (not RAISE EXCEPTION) for progress logging so re-runs do not abort', () => {
      // Per plan §11.1, the migration emits NOTICE messages with row
      // counts. NOTICE is informational; EXCEPTION is for the verification
      // failure only.
      expect(migrationSql).toMatch(/RAISE\s+NOTICE/i);
    });

    it('does NOT mention the legacy bare-string "idv" as a target value (only as a WHERE filter)', () => {
      // Defensive: the only place 'idv' should appear in the SQL is in
      // WHERE clauses and the verification EXCEPTION message. It must
      // never appear as a value being SET on a column.
      expect(migrationSql).not.toMatch(/SET\s+['"]?functionalityType['"]?\s*=\s*'idv'/i);
    });

    it('references the services table (not "Service") — matches @@map("services") in schema.prisma', () => {
      // prisma/schema.prisma model Service line 112: @@map("services").
      // The migration writes raw SQL and must target the mapped name.
      // The capitalized "Service" model name is a Prisma-client concept,
      // not a SQL table name.
      // Allow case-insensitive match because Postgres unquoted identifiers
      // fold to lowercase anyway.
      expect(migrationSql.toLowerCase()).toContain('services');
    });

    it('references the package_services table — matches @@map("package_services") in schema.prisma', () => {
      // prisma/schema.prisma model PackageService line 259:
      // @@map("package_services").
      expect(migrationSql.toLowerCase()).toContain('package_services');
    });
  });

  describe('Production row coverage (Decision 1)', () => {
    it('the rename UPDATE will catch the pinned production row id', () => {
      // Decision 1: exactly one production row exists with
      // functionalityType='idv', id='8388bb60-48e4-4781-a867-7c86b51be776'.
      // The migration is written as a blanket WHERE functionalityType='idv'
      // UPDATE — it does NOT name the id, because matching by type is
      // more robust than matching by id (catches dev/staging copies too).
      //
      // We assert here that the migration does NOT accidentally narrow
      // its WHERE clause to skip the production row. A WHERE that
      // restricts by id would leave behind any other 'idv' rows in
      // staging. Per spec: the WHERE is functionalityType='idv', full stop.
      //
      // Equivalent assertion: the migration body should not contain the
      // production row id as a WHERE restriction. (It may appear in
      // comments — fine. We test for "WHERE ... id = '<uuid>'" patterns
      // that would over-restrict the migration.)
      const overlyRestrictiveIdFilter = new RegExp(
        `WHERE[^;]*['"]?id['"]?\\s*=\\s*'${PRODUCTION_IDV_SERVICE_ID}'`,
        'i',
      );
      expect(migrationSql).not.toMatch(overlyRestrictiveIdFilter);
    });
  });
});
