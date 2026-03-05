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


