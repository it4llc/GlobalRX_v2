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

