-- /GlobalRX_v2/prisma/migrations/20260512171353_rename_idv_functionality_type/migration.sql
--
-- Business requirement: convert Service.functionalityType 'idv' →
-- 'verification-idv' per docs/specs/verification-idv-conversion.md, and
-- normalize package_services.scope for those services to the
-- count_exact:1 shape.
-- Data integrity goal: align services.functionalityType with the new
-- allow-list (post-this-PR the API rejects 'idv' with 400; the
-- production row MUST be migrated FIRST). Normalize package_services.scope
-- defensively so the new normalizeRawScope branch and the validator agree.
-- Safe to run multiple times (idempotent).

DO $$
BEGIN
  RAISE NOTICE 'Starting rename_idv_functionality_type...';
END $$;

-- Step 1: rename services.functionalityType
DO $$
DECLARE
  services_renamed INT;
BEGIN
  UPDATE services
     SET "functionalityType" = 'verification-idv',
         "updatedAt" = NOW()
   WHERE "functionalityType" = 'idv';
  GET DIAGNOSTICS services_renamed = ROW_COUNT;
  RAISE NOTICE 'Renamed % services rows from idv to verification-idv', services_renamed;
END $$;

-- Step 2: normalize package_services.scope for verification-idv rows.
-- Idempotency guard: only update rows whose scope is not already the
-- correct count_exact:1 shape.
--
-- NOTE: package_services has only `createdAt` (no `updatedAt`) per the
-- live schema — verified via `\d package_services` against the dev
-- database before applying. The architect plan §11.1 specified
-- `"updatedAt" = NOW()` here but that column does not exist; the
-- reference is intentionally omitted.
DO $$
DECLARE
  scopes_normalized INT;
BEGIN
  UPDATE package_services ps
     SET scope = '{"type":"count_exact","quantity":1}'::jsonb
    FROM services s
   WHERE ps."serviceId" = s.id
     AND s."functionalityType" = 'verification-idv'
     AND (ps.scope IS NULL
          OR ps.scope::text <> '{"type":"count_exact","quantity":1}');
  GET DIAGNOSTICS scopes_normalized = ROW_COUNT;
  RAISE NOTICE 'Normalized % package_services.scope rows for verification-idv', scopes_normalized;
END $$;

-- Step 3: verification — abort if any 'idv' rows remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM services WHERE "functionalityType" = 'idv') THEN
    RAISE EXCEPTION 'Migration verification failed: services rows with functionalityType=idv still exist';
  END IF;
  RAISE NOTICE 'Verification passed: zero services rows with functionalityType=idv';
END $$;

DO $$
BEGIN
  RAISE NOTICE 'rename_idv_functionality_type completed successfully';
END $$;
