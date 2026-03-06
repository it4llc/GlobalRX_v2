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

