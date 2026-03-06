-- GlobalRx Development Data Export
-- Generated: Sun Mar  1 15:38:01 EST 2026
--
-- This file contains data from the development environment
-- Import this into staging or production after migrations are complete

BEGIN;

-- Disable foreign key checks during import
SET session_replication_role = 'replica';


-- Re-enable foreign key checks
SET session_replication_role = 'origin';

COMMIT;

-- Update sequences to max values
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('vendor_organizations', 'id'), COALESCE(MAX(id), 1)) FROM vendor_organizations;
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE(MAX(id), 1)) FROM customers;
SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE(MAX(id), 1)) FROM orders;
SELECT setval(pg_get_serial_sequence('order_status_history', 'id'), COALESCE(MAX(id), 1)) FROM order_status_history;
SELECT setval(pg_get_serial_sequence('locations', 'id'), COALESCE(MAX(id), 1)) FROM locations;
SELECT setval(pg_get_serial_sequence('services', 'id'), COALESCE(MAX(id), 1)) FROM services;
SELECT setval(pg_get_serial_sequence('dsx_field_mappings', 'id'), COALESCE(MAX(id), 1)) FROM dsx_field_mappings;
SELECT setval(pg_get_serial_sequence('customer_locations', 'id'), COALESCE(MAX(id), 1)) FROM customer_locations;
SELECT setval(pg_get_serial_sequence('customer_services', 'id'), COALESCE(MAX(id), 1)) FROM customer_services;
SELECT setval(pg_get_serial_sequence('customer_packages', 'id'), COALESCE(MAX(id), 1)) FROM customer_packages;
