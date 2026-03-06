-- GlobalRx Development Data Export
-- Generated: Sun Mar  1 15:39:52 EST 2026
--
-- This file contains data from the development environment
-- Import this into staging or production after migrations are complete

BEGIN;

-- Disable foreign key checks during import
SET session_replication_role = 'replica';


-- Table: users
TRUNCATE TABLE users CASCADE;
--
-- PostgreSQL database dump
--

\restrict 8gogRmSDG6hy3ea9KuI4Dmc2umkXzryjNISMge9hE9tjS2hzLim44esmZYBM0JF

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

\unrestrict 8gogRmSDG6hy3ea9KuI4Dmc2umkXzryjNISMge9hE9tjS2hzLim44esmZYBM0JF


-- Table: vendor_organizations
TRUNCATE TABLE vendor_organizations CASCADE;
--
-- PostgreSQL database dump
--

\restrict 063qzNkbbcS2fkXkhcqXfXSCizfG8L4cbfw4C5X57hZTPr2ah3WUed44aI9dx7P

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
-- Data for Name: vendor_organizations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.vendor_organizations (id, name, "isActive", "isPrimary", "contactEmail", "contactPhone", address, notes, "createdAt", "updatedAt") VALUES ('f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8', 'ESG Internal', true, false, 'andy@esg.com', '1234', '', '', '2026-02-28 21:02:10.869', '2026-02-28 21:02:10.869');


--
-- PostgreSQL database dump complete
--

\unrestrict 063qzNkbbcS2fkXkhcqXfXSCizfG8L4cbfw4C5X57hZTPr2ah3WUed44aI9dx7P


-- Table: customers
TRUNCATE TABLE customers CASCADE;
--
-- PostgreSQL database dump
--

\restrict hM0uwUCXZClfD9LqEq4aAfE05BqobnIRWaDzucHAGxuhbH07Nrho4NT3io4C2aP

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
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customers (id, name, address, "contactName", "contactEmail", "contactPhone", "invoiceTerms", "invoiceContact", "invoiceMethod", disabled, "allowedServices", "masterAccountId", "billingAccountId", "createdAt", "updatedAt") VALUES ('020b3051-2e2e-4006-975c-41b7f77c5f4e', 'Global Enterprises', '123 Main St, San Francisco, CA 94105', 'John Smith', 'john.smith@globalenterprises.com', '415-555-1234', 'Net 30', 'Accounts Payable', 'Email', false, NULL, NULL, NULL, '2025-03-29 21:05:11.325-04', '2026-02-14 12:41:45.927-05');
INSERT INTO public.customers (id, name, address, "contactName", "contactEmail", "contactPhone", "invoiceTerms", "invoiceContact", "invoiceMethod", disabled, "allowedServices", "masterAccountId", "billingAccountId", "createdAt", "updatedAt") VALUES ('f6a48306-cc9c-4cf7-87c2-7768eacc908b', 'ABC Company', '', 'Andy Hellman', 'andythellman@gmail.com', '', '', '', '', false, NULL, NULL, NULL, '2026-02-25 14:22:57.442-05', '2026-02-25 14:22:57.442-05');
INSERT INTO public.customers (id, name, address, "contactName", "contactEmail", "contactPhone", "invoiceTerms", "invoiceContact", "invoiceMethod", disabled, "allowedServices", "masterAccountId", "billingAccountId", "createdAt", "updatedAt") VALUES ('bfd1d2fe-6915-4e2c-a704-54ff349ff197', '1-Test Customer', '', 'Andy Hellman', 'andythellman@gmail.com', '7037410710', '', '', '', false, NULL, NULL, NULL, '2025-05-30 15:32:17.959-04', '2025-05-30 15:50:06.406-04');


--
-- PostgreSQL database dump complete
--

\unrestrict hM0uwUCXZClfD9LqEq4aAfE05BqobnIRWaDzucHAGxuhbH07Nrho4NT3io4C2aP


-- Table: orders
TRUNCATE TABLE orders CASCADE;
--
-- PostgreSQL database dump
--

\restrict Nbohf2zwFkYd4Ck9ubFeWcGMLMpD2wTLpZAAv9HAtvzWU2NsYobSlvYHJ0ZaoHA

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
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('55e39c40-b4f7-4290-8130-9d4717570d95', 'TEST-1769435600889-001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'completed', '{"email": "john.smith@example.com", "lastName": "Smith", "firstName": "John", "dateOfBirth": "1985-03-15"}', NULL, 'Background check completed successfully', '2026-01-19 13:53:20.889', '2026-01-24 13:53:20.889', '2026-01-26 13:53:20.89', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('d39e3b67-282e-4d87-87d9-4b11372ea5af', 'TEST-1769435600889-002', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'processing', '{"email": "jane.doe@example.com", "lastName": "Doe", "firstName": "Jane", "dateOfBirth": "1990-07-22"}', NULL, 'Currently processing background verification', '2026-01-23 13:53:20.889', NULL, '2026-01-26 13:53:20.901', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('167b7ce6-af7e-4311-b5e2-a0924c28613c', 'TEST-1769435600889-003', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "bob.johnson@example.com", "lastName": "Johnson", "firstName": "Bob", "dateOfBirth": "1978-11-05"}', NULL, 'New order submitted for processing', '2026-01-25 13:53:20.889', NULL, '2026-01-26 13:53:20.903', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('ee5ea754-754a-4325-87df-a893a67eb69e', 'TEST-1769435600889-004', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'draft', '{"lastName": "Williams", "firstName": "Alice"}', NULL, 'Draft order - not yet submitted', NULL, NULL, '2026-01-26 13:53:20.904', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('94be26c0-4b7c-4df0-a356-14decb980156', '20260126-CLM-0005', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'draft', '{"email": "test.format@example.com", "lastName": "Format", "firstName": "Test"}', NULL, 'Testing new order number format', NULL, NULL, '2026-01-26 13:58:56.493', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('9724e644-d51d-41a5-8f48-3bd70bf89cea', '20260214-CLM-0001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'draft', '{"email": "", "phone": "", "address": "", "lastName": "", "firstName": "", "middleName": "", "dateOfBirth": ""}', NULL, '', NULL, NULL, '2026-02-14 17:08:28.935', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('dd87808a-8035-495a-b293-9ebf7ef48ead', '20260214-CLM-0002', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": ""}', NULL, '', NULL, NULL, '2026-02-14 17:16:17.152', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('e2a0883b-c099-4aa5-b49b-2b0943491e0e', '20260214-CLM-0003', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": ""}', NULL, '', NULL, NULL, '2026-02-14 17:19:16.402', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('c97c78ce-65ea-4ee9-85e5-53ec399138ac', '20260214-CLM-0004', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": ""}', NULL, '', NULL, NULL, '2026-02-14 17:20:31.517', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('6e285c82-d5c2-480c-b6f3-f195d7e7d3eb', '20260214-CLM-0005', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": "", "739b2b3f-db5c-4010-b96c-5238a3a26298": "sdasd", "8cc249d5-d320-442f-b2fe-88380569770c": "asdfasdf"}', NULL, '', NULL, NULL, '2026-02-14 17:22:27.087', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('ca5d84de-32ab-4c65-a7e4-a767b4abc417', '20260214-CLM-0006', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": "", "739b2b3f-db5c-4010-b96c-5238a3a26298": "4", "8cc249d5-d320-442f-b2fe-88380569770c": "4"}', NULL, '', NULL, NULL, '2026-02-14 17:23:30.177', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('eb92e7a1-8b20-44f5-bdfc-542e18bcf5ed', '20260214-CLM-0007', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "middleName": "", "dateOfBirth": "", "739b2b3f-db5c-4010-b96c-5238a3a26298": "5", "8cc249d5-d320-442f-b2fe-88380569770c": "5"}', NULL, '', NULL, NULL, '2026-02-14 17:28:02.031', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('2af19580-a4a0-4740-b9e7-e24f0bd39d7d', '20260214-CLM-0008', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "lastName": "6", "firstName": "6", "First Name": "6", "middleName": "", "dateOfBirth": "", "Surname/Last Name": "6"}', NULL, '', NULL, NULL, '2026-02-14 17:29:59.733', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('67da30db-561b-4239-819e-da39786afdcf', '20260214-CLM-0009', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "lastName": "Subject", "firstName": "Test", "First Name": "Test", "middleName": "", "dateOfBirth": "", "Surname/Last Name": "Subject"}', NULL, '', NULL, NULL, '2026-02-14 17:36:19.067', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('4660deeb-85e3-4146-b9e6-8d05a9f5e697', '20260214-CLM-0010', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"email": "", "phone": "", "address": "", "lastName": "ertgsrt", "firstName": "are", "First Name": "are", "middleName": "", "dateOfBirth": "", "Residence Address": {"city": "twertw", "state": "be12d2a6-5412-488d-a0ce-0ec5f8f60b8b", "street1": "ertwer", "postalCode": "werte"}, "Surname/Last Name": "ertgsrt"}', NULL, '', NULL, NULL, '2026-02-14 18:12:53.006', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('cef7eda6-fbb4-4fd9-8b06-2fad78d2fddb', '20260220-CLM-0001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"lastName": "Test", "firstName": "John"}', NULL, '', NULL, NULL, '2026-02-20 13:53:13.958', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('ed233990-04ee-4b76-ab7a-2b53f000b64b', '20260220-CLM-0002', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": "123 Main Stw, Sydney, New South Wales, 1231", "lastName": "Test", "firstName": "John"}', NULL, '', NULL, NULL, '2026-02-20 13:54:11.587', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('897444b7-4d0c-49b2-a130-f61f8e088929', '20260220-CLM-0003', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": "456 Maple Rd, Melbourne, New South Wales, 1231", "lastName": "Test", "firstName": "Jane"}', NULL, '', NULL, NULL, '2026-02-20 13:58:27.458', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('c48809f1-2fee-472b-9c2c-4fa5dff3c617', '20260220-CLM-0004', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"lastName": "Testy", "firstName": "Jack"}', NULL, '', NULL, NULL, '2026-02-20 14:03:38.168', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('e01d4a83-8863-441c-8b4c-17a889b799a8', '20260220-CLM-0006', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": "123 Auburn St, Sydney", "lastName": "Test", "firstName": "Jason"}', NULL, '', NULL, NULL, '2026-02-20 14:38:48.714', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('25d65be3-fcc1-4ad1-bef8-867d958ab7e9', '20260220-CLM-0007', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'draft', '{"address": {}, "lastName": "Test", "firstName": "Joe"}', NULL, '', NULL, NULL, '2026-02-20 16:42:58.417', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('0de4e353-a932-430c-a359-bd2fc5243000', '20260220-CLM-0008', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'draft', '{"address": {}, "lastName": "Test", "firstName": "Joe"}', NULL, '', NULL, NULL, '2026-02-20 16:43:07.276', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('670383f1-0977-4863-a4a3-56e79a913b37', '20260220-CLM-0009', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}, "lastName": "joe", "firstName": "test"}', NULL, '', NULL, NULL, '2026-02-20 18:56:36.515', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('7268a580-1fde-4d02-944c-51886f08b6bd', '20260220-CLM-0010', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}, "lastName": "McTest", "firstName": "Jack"}', NULL, '', NULL, NULL, '2026-02-20 19:21:26.115', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('ae93fc69-c639-45a3-a36c-87ced59f38e0', '20260220-CLM-0011', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}, "lastName": "Testa", "firstName": "Josephina"}', NULL, '', NULL, NULL, '2026-02-20 19:58:26.963', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('c6bcd5d4-875e-4bbc-8bf1-537a5362a7f2', '20260222-CLM-0001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}}', NULL, '', NULL, NULL, '2026-02-22 17:02:12.469', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('fda9ea55-54f0-4e99-93fb-15fa8d5259de', '20260222-CLM-0002', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}}', NULL, '', NULL, NULL, '2026-02-22 20:10:33.159', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('12fb8bca-f963-47db-b5a3-5ad9abe0c19c', '20260224-CLM-0001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": {}, "lastName": "Test", "firstName": "Jay"}', NULL, '', NULL, NULL, '2026-02-24 22:52:55.444', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');
INSERT INTO public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") VALUES ('544abc19-d99c-4797-b930-ea0efd884e00', '20260225-CLM-0001', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'submitted', '{"address": "{}", "lastName": "Exam", "firstName": "Jane"}', NULL, '', NULL, NULL, '2026-02-25 19:24:12.023', '2026-03-01 14:27:41.352', 'f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8');


--
-- PostgreSQL database dump complete
--

\unrestrict Nbohf2zwFkYd4Ck9ubFeWcGMLMpD2wTLpZAAv9HAtvzWU2NsYobSlvYHJ0ZaoHA


-- Table: order_status_history
TRUNCATE TABLE order_status_history CASCADE;
--
-- PostgreSQL database dump
--

\restrict ZGk2Fd3MpzQE98YsNiNlMW0NNnwvky0BEODTFAb5lwaACStYgF2ndT2Ifomr6gR

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
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.order_status_history (id, "orderId", "fromStatus", "toStatus", "changedBy", reason, "createdAt") VALUES ('535b219b-c5e8-4bae-802c-50d366d6cf9a', '55e39c40-b4f7-4290-8130-9d4717570d95', 'draft', 'completed', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'Order completed', '2026-01-26 13:53:20.898');
INSERT INTO public.order_status_history (id, "orderId", "fromStatus", "toStatus", "changedBy", reason, "createdAt") VALUES ('218e0238-d5a8-4453-aafc-ec0a8c972083', 'd39e3b67-282e-4d87-87d9-4b11372ea5af', 'draft', 'processing', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'Order processing', '2026-01-26 13:53:20.902');
INSERT INTO public.order_status_history (id, "orderId", "fromStatus", "toStatus", "changedBy", reason, "createdAt") VALUES ('5d8ff0a4-0fa2-4b26-95fa-18ad6a89fd3d', '167b7ce6-af7e-4311-b5e2-a0924c28613c', 'draft', 'submitted', 'f7b3085b-f119-4dfe-8116-43ca962c6eb0', 'Order submitted', '2026-01-26 13:53:20.903');


--
-- PostgreSQL database dump complete
--

\unrestrict ZGk2Fd3MpzQE98YsNiNlMW0NNnwvky0BEODTFAb5lwaACStYgF2ndT2Ifomr6gR


-- Table: services
TRUNCATE TABLE services CASCADE;
--
-- PostgreSQL database dump
--

\restrict dERieOfoh8iwtM34S3QDIxedvfhOUwm4GU2JZUzjdaAbLPvZ9S8gfNzB59tfmTS

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
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('383f3f2f-3194-4396-9a63-297f80e151f9', 'County Criminal', 'US Criminal', NULL, false, '2025-03-22 14:04:35.856', '2025-03-22 14:04:35.856', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record');
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('8388bb60-48e4-4781-a867-7c86b51be776', 'ID Verification', 'IDV', 'Review of ID doc', false, '2025-03-22 14:05:12.786', '2025-03-22 14:05:12.786', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'other');
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('935f2544-5727-47a9-a758-bd24afea5994', 'Education Verification', 'Verifications', NULL, false, '2026-01-28 19:44:09.857', '2026-01-28 19:44:09.857', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'verification-edu');
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('4b9d6a10-6861-426a-ad7f-60eb94312d0d', 'Employment Verification', 'Verifications', NULL, false, '2025-03-22 00:51:35.968', '2026-02-14 16:04:04.313', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'verification-emp');
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('be37003d-1016-463a-b536-c00cf9f3234b', 'Global Criminal', 'Records', 'Standard global criminal offering', false, '2026-02-14 17:39:19.99', '2026-02-14 17:39:19.99', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record');
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES ('a49223f8-3cdd-4415-9038-4454680b6c75', 'Bankruptcy Check', 'Records', NULL, false, '2026-02-25 03:18:33.944', '2026-02-25 03:18:33.944', '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record');


--
-- PostgreSQL database dump complete
--

\unrestrict dERieOfoh8iwtM34S3QDIxedvfhOUwm4GU2JZUzjdaAbLPvZ9S8gfNzB59tfmTS


-- Table: customer_services
TRUNCATE TABLE customer_services CASCADE;
--
-- PostgreSQL database dump
--

\restrict LEp6uzD6VFdbAWSrpbkH9fxPeh9aVTPGKXpxtsWhLTuUbnLmmd9oJzxLFXk77dR

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
-- Data for Name: customer_services; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('bcf8c564-d5ae-4986-a0c3-5d89352c6271', 'f6a48306-cc9c-4cf7-87c2-7768eacc908b', '935f2544-5727-47a9-a758-bd24afea5994', '2026-02-25 14:22:57.449-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('eb7e2d16-18e4-46e7-93a8-1e8d81730c76', 'f6a48306-cc9c-4cf7-87c2-7768eacc908b', '4b9d6a10-6861-426a-ad7f-60eb94312d0d', '2026-02-25 14:22:57.449-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('812e624d-5933-46d3-bf82-631c69cd9c30', 'f6a48306-cc9c-4cf7-87c2-7768eacc908b', 'be37003d-1016-463a-b536-c00cf9f3234b', '2026-02-25 14:22:57.449-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('79214619-fc56-49eb-a285-4b565abefd86', '020b3051-2e2e-4006-975c-41b7f77c5f4e', '383f3f2f-3194-4396-9a63-297f80e151f9', '2026-02-14 12:41:45.932-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('88a508dc-f251-498c-bbbf-cbe00f9a4245', '020b3051-2e2e-4006-975c-41b7f77c5f4e', '4b9d6a10-6861-426a-ad7f-60eb94312d0d', '2026-02-14 12:41:45.932-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('e078fbdf-f6c7-4b58-bbce-ef274dbdbd76', 'bfd1d2fe-6915-4e2c-a704-54ff349ff197', '383f3f2f-3194-4396-9a63-297f80e151f9', '2025-05-30 15:50:06.416-04');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('6f887f58-26b1-4135-b929-6deb5e8825f9', 'bfd1d2fe-6915-4e2c-a704-54ff349ff197', '4b9d6a10-6861-426a-ad7f-60eb94312d0d', '2025-05-30 15:50:06.416-04');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('73eb51db-809f-4822-87a3-d05340461a2d', 'bfd1d2fe-6915-4e2c-a704-54ff349ff197', '8388bb60-48e4-4781-a867-7c86b51be776', '2025-05-30 15:50:06.416-04');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('2dae45eb-8be5-47f3-9661-393ea09556f5', '020b3051-2e2e-4006-975c-41b7f77c5f4e', '8388bb60-48e4-4781-a867-7c86b51be776', '2026-02-14 12:41:45.932-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('a46796ad-09c2-4e8d-8a2f-ce0ff9bf610d', '020b3051-2e2e-4006-975c-41b7f77c5f4e', '935f2544-5727-47a9-a758-bd24afea5994', '2026-02-14 12:41:45.932-05');
INSERT INTO public.customer_services (id, "customerId", "serviceId", "createdAt") VALUES ('c3343ef3-2ce6-4180-97bb-2e1501890bdd', '020b3051-2e2e-4006-975c-41b7f77c5f4e', 'be37003d-1016-463a-b536-c00cf9f3234b', '2026-02-14 12:41:45.932-05');


--
-- PostgreSQL database dump complete
--

\unrestrict LEp6uzD6VFdbAWSrpbkH9fxPeh9aVTPGKXpxtsWhLTuUbnLmmd9oJzxLFXk77dR


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
