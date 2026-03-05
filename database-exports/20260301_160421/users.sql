--
-- PostgreSQL database dump
--


-- Dumped from database version 16.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('c2175238-b327-40ac-86c9-3e31dbabaee4', 'andyh@realidatasolutions.com', '$2a$10$F3PNQV1kejotJP7fFpoCwOMu1l3i..qruy3RHHyabTizipcSe8IZ.', 'Andy', 'Hellman', '2025-03-11 12:53:14.139', '2026-02-25 03:15:03.14', '{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}', NULL, 1, NULL, NULL, '2026-01-25 20:49:42.445', NULL, false, NULL, 'admin', NULL);
INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('9afc7407-afc9-40be-9c18-79141256c69a', 'testuser2@gmail.com', '$2a$10$o4Y.OaLMtpWIpR9PdnRBrueNF1DWJeJh.Ptai/TG6QKSZzfhFeTAy', 'Andy', 'Hellman', '2026-02-20 12:33:22.137', '2026-02-20 13:44:23.656', '{"users": {"manage": true}, "orders": {"edit": true, "view": true, "create": true}}', 'bfd1d2fe-6915-4e2c-a704-54ff349ff197', 0, '2026-02-20 13:44:23.654', NULL, '2026-02-20 12:33:22.137', NULL, false, NULL, 'customer', NULL);
INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('ef32c9ec-ac05-4735-980e-325ae989dac1', 'andy.hellman@employmentscreeninggroup.com', '$2a$10$csg67sC3ZRAPf0Y4o7v.6OvMcIkxmaKe7OzY1fpFMXV6hHC4ezD.e', 'Andy', 'Hellman', '2026-02-25 03:16:01.757', '2026-02-28 14:57:41.322', '{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}', NULL, 0, '2026-02-28 14:57:41.321', NULL, '2026-02-25 03:16:01.757', NULL, false, NULL, 'admin', NULL);
INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'customer@test.com', '$2a$10$.gvhCO2O5hp5nDo7t4Wa0O0VSPHGJDT..sgdMKRnjzngFuSzpKc7q', 'Test', 'Customer', '2026-01-26 12:52:45.701', '2026-03-01 18:02:36.671', '{"services": [], "countries": [], "customers": ["020b3051-2e2e-4006-975c-41b7f77c5f4e"]}', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 0, '2026-03-01 18:02:36.67', NULL, '2026-01-26 12:52:45.701', NULL, false, NULL, 'customer', NULL);
INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('a683ee4e-ea02-4db1-a662-2d100a80867a', 'vendor@vendor.com', '$2a$10$sAmWCj9Cz1cYtzAnUgjiN.eNbpm12b9sIEFn.DPcUzzRommECu8eO', 'Jonny', 'Vendor', '2026-02-28 21:11:13.872', '2026-03-01 18:10:47.312', '{"fulfillment": "*"}', NULL, 0, '2026-03-01 18:10:47.311', NULL, '2026-02-28 21:11:13.872', NULL, false, NULL, 'vendor', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") VALUES ('0c81952d-f51e-469f-a9ad-074be12b18e4', 'andythellman@gmail.com', '$2a$10$53r0G1lUnNhnoMCjMG0DH.N1Bk41UMXZ/sDJ.9gTB1ie638raM6Ze', 'Admin', 'User', '2025-03-11 02:29:39.361', '2026-03-01 20:18:29.891', '{"vendors": "*", "user_admin": "*", "global_config": "*", "customer_config": "*"}', NULL, 0, '2026-03-01 20:18:29.89', NULL, '2026-01-25 20:49:42.445', NULL, false, NULL, 'admin', NULL);


--
-- PostgreSQL database dump complete
--


