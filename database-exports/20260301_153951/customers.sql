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

