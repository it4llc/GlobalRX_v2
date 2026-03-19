-- Remove orphaned tables that have no active code references
-- See docs/GlobalRx_Unused_Tables_Analysis.md for details

DROP TABLE IF EXISTS "data_fields";
DROP TABLE IF EXISTS "documents";
DROP TABLE IF EXISTS "translations";
DROP TABLE IF EXISTS "order_statuses";