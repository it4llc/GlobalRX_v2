--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Homebrew)
-- Dumped by pg_dump version 16.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: address_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.address_entries (
    id text NOT NULL,
    "orderId" text,
    "customerId" text,
    street1 text,
    street2 text,
    city text NOT NULL,
    "stateId" text,
    "countyId" text,
    "postalCode" text,
    "countryId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: city_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.city_mappings (
    id text NOT NULL,
    "cityName" text NOT NULL,
    "stateId" text,
    "locationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id text NOT NULL,
    name text NOT NULL,
    code2 text NOT NULL,
    code3 text NOT NULL,
    "numeric" text,
    subregion1 text,
    subregion2 text,
    subregion3 text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "parentId" text,
    disabled boolean
);


--
-- Name: customer_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_services (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "serviceId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: customer_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_users (
    id text NOT NULL,
    "userId" text NOT NULL,
    "customerId" text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id text NOT NULL,
    name text NOT NULL,
    address text,
    "contactName" text,
    "contactEmail" text,
    "contactPhone" text,
    "invoiceTerms" text,
    "invoiceContact" text,
    "invoiceMethod" text,
    disabled boolean DEFAULT false NOT NULL,
    "allowedServices" jsonb,
    "masterAccountId" text,
    "billingAccountId" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: data_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_fields (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    label text NOT NULL,
    "shortName" text NOT NULL,
    "dataType" text NOT NULL,
    instructions text
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    name text NOT NULL,
    instructions text,
    scope text NOT NULL,
    "filePath" text
);


--
-- Name: dsx_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsx_availability (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "locationId" text NOT NULL,
    "isAvailable" boolean DEFAULT true NOT NULL,
    "unavailableReason" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: dsx_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsx_mappings (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "locationId" text NOT NULL,
    "requirementId" text NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: dsx_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dsx_requirements (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    "fieldData" jsonb,
    "documentData" jsonb,
    "formData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    disabled boolean DEFAULT false NOT NULL
);


--
-- Name: order_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_data (
    id text NOT NULL,
    "orderItemId" text NOT NULL,
    "fieldName" text NOT NULL,
    "fieldValue" text NOT NULL,
    "fieldType" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_documents (
    id text NOT NULL,
    "orderItemId" text NOT NULL,
    "documentType" text NOT NULL,
    "fileName" text NOT NULL,
    "filePath" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "serviceId" text NOT NULL,
    "locationId" text NOT NULL,
    status text NOT NULL,
    price numeric(10,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "fromStatus" text,
    "toStatus" text NOT NULL,
    "changedBy" text NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: order_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_statuses (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    color text,
    sequence integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "allowedNextStatuses" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "customerId" text NOT NULL,
    "userId" text NOT NULL,
    "statusCode" text NOT NULL,
    subject jsonb NOT NULL,
    "totalPrice" numeric(10,2),
    notes text,
    "submittedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: package_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_services (
    id text NOT NULL,
    "packageId" text NOT NULL,
    "serviceId" text NOT NULL,
    scope jsonb,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id text NOT NULL,
    "customerId" text NOT NULL,
    name text NOT NULL,
    description text
);


--
-- Name: service_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_requirements (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "requirementId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id text NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    disabled boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdById" text,
    "updatedById" text,
    "functionalityType" text DEFAULT 'other'::text NOT NULL
);


--
-- Name: translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translations (
    id text NOT NULL,
    "labelKey" text NOT NULL,
    language text NOT NULL,
    value text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "firstName" text,
    "lastName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    permissions jsonb,
    "customerId" text,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "lastPasswordChange" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    "userType" text DEFAULT 'admin'::text NOT NULL
);


--
-- Name: workflow_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_sections (
    id text NOT NULL,
    "workflowId" text NOT NULL,
    name text NOT NULL,
    "displayOrder" integer NOT NULL,
    "isRequired" boolean DEFAULT true NOT NULL,
    "dependsOnSection" text,
    "dependencyLogic" text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    "defaultLanguage" text DEFAULT 'en-US'::text NOT NULL,
    "expirationDays" integer DEFAULT 15 NOT NULL,
    "autoCloseEnabled" boolean DEFAULT true NOT NULL,
    "extensionAllowed" boolean DEFAULT false NOT NULL,
    "extensionDays" integer,
    disabled boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "packageId" text NOT NULL,
    "createdById" text,
    "updatedById" text,
    "reminderEnabled" boolean DEFAULT false NOT NULL,
    "reminderFrequency" integer DEFAULT 7 NOT NULL,
    "maxReminders" integer DEFAULT 3 NOT NULL
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
584c9095-6fbb-4512-8c47-7870c0495b86	5f7066722a08291586030bd842d90031117feed61a89d82c0001d10e362b50f2	2026-01-25 20:48:03.529516-05	20250125_initial		\N	2026-01-25 20:48:03.529516-05	0
85a4db3a-a46c-40af-8613-b5c5d56d7dfe	b3a8d91598fdbb57ce582bf5b88ef56ccf971099950df06917740b9aaec217e1	2026-01-25 20:49:42.466534-05	20260126014942_add_customer_portal_models	\N	\N	2026-01-25 20:49:42.444254-05	1
f9f6d3c2-3947-4c3e-bda3-4aaa10698254	eb2c14ecb7cc480637309c4102dda4a14fd577dc8a42f224234a4279b303d2cb	2026-01-28 20:16:32.93518-05	20260129011632_add_address_block_models	\N	\N	2026-01-28 20:16:32.918766-05	1
\.


--
-- Data for Name: address_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.address_entries (id, "orderId", "customerId", street1, street2, city, "stateId", "countyId", "postalCode", "countryId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, "userId", action, "entityType", "entityId", "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: city_mappings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.city_mappings (id, "cityName", "stateId", "locationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.countries (id, name, code2, code3, "numeric", subregion1, subregion2, subregion3, "createdAt", "updatedAt", "parentId", disabled) FROM stdin;
e6fffac1-4aad-4ce4-9981-3983dde344d3	United States of America (the)	US	USA	840	\N	\N	\N	2025-03-13 14:21:43.259372-04	2025-03-13 14:21:43.259372-04	\N	\N
32c804e1-e904-45b0-b150-cdc70be9679c	Afghanistan	AF	AFG	4	\N	\N	\N	2025-03-14 10:53:23.340969-04	2025-03-14 10:53:23.340969-04	\N	\N
16d101ea-c92f-44b0-b7dc-11cd3680215c	Albania	AL	ALB	8	\N	\N	\N	2025-03-14 10:53:23.37798-04	2025-03-14 10:53:23.37798-04	\N	\N
dce7c8e3-fc4f-4edc-b9e4-66410334ed17	Algeria	DZ	DZA	12	\N	\N	\N	2025-03-14 10:53:23.39475-04	2025-03-14 10:53:23.39475-04	\N	\N
778ec216-a84f-41c7-a341-9d04269f0dc6	American Samoa	AS	ASM	16	\N	\N	\N	2025-03-14 10:53:23.396168-04	2025-03-14 10:53:23.396168-04	\N	\N
ed459bf2-7e56-4eca-bc6b-cee6655c644a	Andorra	AD	AND	20	\N	\N	\N	2025-03-14 10:53:23.398172-04	2025-03-14 10:53:23.398172-04	\N	\N
9f38de93-8d44-4760-9152-372666596d56	Angola	AO	AGO	24	\N	\N	\N	2025-03-14 10:53:23.41451-04	2025-03-14 10:53:23.41451-04	\N	\N
eadf502a-97e3-44fc-b07c-0f7015cb598a	Anguilla	AI	AIA	660	\N	\N	\N	2025-03-14 10:53:23.416154-04	2025-03-14 10:53:23.416154-04	\N	\N
c21d204c-4660-41e7-93c8-d895ddbaab26	Antarctica	AQ	ATA	10	\N	\N	\N	2025-03-14 10:53:23.432476-04	2025-03-14 10:53:23.432476-04	\N	\N
31dec1f6-7abb-4742-ade1-42b89ad7766a	Antigua and Barbuda	AG	ATG	28	\N	\N	\N	2025-03-14 10:53:23.434177-04	2025-03-14 10:53:23.434177-04	\N	\N
b182931c-6229-4be3-bde7-ef6126032f52	Argentina	AR	ARG	32	\N	\N	\N	2025-03-14 10:53:23.435718-04	2025-03-14 10:53:23.435718-04	\N	\N
93421fdb-364d-418e-898a-a1f62dd8020a	Armenia	AM	ARM	51	\N	\N	\N	2025-03-14 10:53:23.459434-04	2025-03-14 10:53:23.459434-04	\N	\N
5bc1c4d2-6371-4992-8ce0-23c01e065bbe	Aruba	AW	ABW	533	\N	\N	\N	2025-03-14 10:53:23.472752-04	2025-03-14 10:53:23.472752-04	\N	\N
071a36ac-c2e2-4462-b10d-3175b101bd06	Australia	AU	AUS	36	\N	\N	\N	2025-03-14 10:53:23.476851-04	2025-03-14 10:53:23.476851-04	\N	\N
734f6aa9-6ade-4187-b3b3-2cba78068a34	Austria	AT	AUT	40	\N	\N	\N	2025-03-14 10:53:23.50777-04	2025-03-14 10:53:23.50777-04	\N	\N
bd8e819d-9179-4fba-b0f9-cec4d26efe4a	Azerbaijan	AZ	AZE	31	\N	\N	\N	2025-03-14 10:53:23.512201-04	2025-03-14 10:53:23.512201-04	\N	\N
e634ed46-7f56-46ad-bf89-af3b7f75dc0f	Bahamas (the)	BS	BHS	44	\N	\N	\N	2025-03-14 10:53:23.516027-04	2025-03-14 10:53:23.516027-04	\N	\N
32898e2d-148e-4483-9e74-6fca3a3eed62	Bahrain	BH	BHR	48	\N	\N	\N	2025-03-14 10:53:23.529615-04	2025-03-14 10:53:23.529615-04	\N	\N
3e324e0d-ae2e-4957-a5ca-51a7f20e6350	Bangladesh	BD	BGD	50	\N	\N	\N	2025-03-14 10:53:23.535653-04	2025-03-14 10:53:23.535653-04	\N	\N
ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	Barbados	BB	BRB	52	\N	\N	\N	2025-03-14 10:53:23.53983-04	2025-03-14 10:53:23.53983-04	\N	\N
7a27fe64-579c-4653-a395-4ead4e3860df	Belarus	BY	BLR	112	\N	\N	\N	2025-03-14 10:53:23.543302-04	2025-03-14 10:53:23.543302-04	\N	\N
8504d304-1734-41d3-8e1c-8e6765cbf3d9	Belgium	BE	BEL	56	\N	\N	\N	2025-03-14 10:53:23.560093-04	2025-03-14 10:53:23.560093-04	\N	\N
d8234d20-bcb4-45ba-bcfc-0e4b133b8898	Belize	BZ	BLZ	84	\N	\N	\N	2025-03-14 10:53:23.594736-04	2025-03-14 10:53:23.594736-04	\N	\N
5663e510-84a4-4116-86dd-dfaf709165e2	Benin	BJ	BEN	204	\N	\N	\N	2025-03-14 10:53:23.616618-04	2025-03-14 10:53:23.616618-04	\N	\N
12663a56-2460-435d-97b2-b36c631dd62f	Bermuda	BM	BMU	60	\N	\N	\N	2025-03-14 10:53:23.644608-04	2025-03-14 10:53:23.644608-04	\N	\N
11b13f4a-d287-4401-bd76-82a3b21bbbb6	Bhutan	BT	BTN	64	\N	\N	\N	2025-03-14 10:53:23.6595-04	2025-03-14 10:53:23.6595-04	\N	\N
dd0f65c6-2276-4624-b96f-6c0d2dbf5416	Bolivia (Plurinational State of)	BO	BOL	68	\N	\N	\N	2025-03-14 10:53:23.667068-04	2025-03-14 10:53:23.667068-04	\N	\N
47abcbe8-9bac-4fb1-845e-09c4efbe35c8	Bonaire, Sint Eustatius and Saba	BQ	BES	535	\N	\N	\N	2025-03-14 10:53:23.687243-04	2025-03-14 10:53:23.687243-04	\N	\N
4220515f-01f8-40d5-846d-b4a7f5aa460b	Bosnia and Herzegovina	BA	BIH	70	\N	\N	\N	2025-03-14 10:53:23.691965-04	2025-03-14 10:53:23.691965-04	\N	\N
7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	Botswana	BW	BWA	72	\N	\N	\N	2025-03-14 10:53:23.694738-04	2025-03-14 10:53:23.694738-04	\N	\N
c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	Bouvet Island	BV	BVT	74	\N	\N	\N	2025-03-14 10:53:23.698016-04	2025-03-14 10:53:23.698016-04	\N	\N
cd47199a-6751-4135-a27a-3d4719b9ef1a	Brazil	BR	BRA	76	\N	\N	\N	2025-03-14 10:53:23.728432-04	2025-03-14 10:53:23.728432-04	\N	\N
51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	British Indian Ocean Territory (the)	IO	IOT	86	\N	\N	\N	2025-03-14 10:53:23.734007-04	2025-03-14 10:53:23.734007-04	\N	\N
c86565cd-7ab2-4c4a-9152-f911e8eae236	Brunei Darussalam	BN	BRN	96	\N	\N	\N	2025-03-14 10:53:23.746473-04	2025-03-14 10:53:23.746473-04	\N	\N
71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	Bulgaria	BG	BGR	100	\N	\N	\N	2025-03-14 10:53:23.77252-04	2025-03-14 10:53:23.77252-04	\N	\N
f43eb3e8-8708-4656-aae2-d21e33812610	Burkina Faso	BF	BFA	854	\N	\N	\N	2025-03-14 10:53:23.799682-04	2025-03-14 10:53:23.799682-04	\N	\N
28748534-0496-4c62-8647-6af5f01fc608	Burundi	BI	BDI	108	\N	\N	\N	2025-03-14 10:53:23.804314-04	2025-03-14 10:53:23.804314-04	\N	\N
4c239c57-b3c6-4988-a698-6908b26d0e19	Cabo Verde	CV	CPV	132	\N	\N	\N	2025-03-14 10:53:23.807414-04	2025-03-14 10:53:23.807414-04	\N	\N
493436bd-ca41-4359-8d8a-0d690ee7fc29	Cambodia	KH	KHM	116	\N	\N	\N	2025-03-14 10:53:23.809511-04	2025-03-14 10:53:23.809511-04	\N	\N
fe3d87aa-c40a-468d-8e3f-239029a5919d	Cameroon	CM	CMR	120	\N	\N	\N	2025-03-14 10:53:23.811562-04	2025-03-14 10:53:23.811562-04	\N	\N
b52c3226-dc94-4289-a051-b7227fd77ae8	Canada	CA	CAN	124	\N	\N	\N	2025-03-14 10:53:23.813494-04	2025-03-14 10:53:23.813494-04	\N	\N
7050c97c-b57f-490f-90a9-d8601fcb3852	Cayman Islands (the)	KY	CYM	136	\N	\N	\N	2025-03-14 10:53:23.814796-04	2025-03-14 10:53:23.814796-04	\N	\N
60fc24d8-ef72-4107-8519-429969f3a05b	Central African Republic (the)	CF	CAF	140	\N	\N	\N	2025-03-14 10:53:23.815865-04	2025-03-14 10:53:23.815865-04	\N	\N
db419a02-b502-47b6-bf78-ca8e5cc0db52	Chad	TD	TCD	148	\N	\N	\N	2025-03-14 10:53:23.817605-04	2025-03-14 10:53:23.817605-04	\N	\N
913edefa-4e9b-4792-bddf-5739e52946f3	Chile	CL	CHL	152	\N	\N	\N	2025-03-14 10:53:23.820668-04	2025-03-14 10:53:23.820668-04	\N	\N
ee14f2cd-9823-4e38-9202-0d3f88fd82d6	China	CN	CHN	156	\N	\N	\N	2025-03-14 10:53:23.827271-04	2025-03-14 10:53:23.827271-04	\N	\N
3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	Christmas Island	CX	CXR	162	\N	\N	\N	2025-03-14 10:53:23.831005-04	2025-03-14 10:53:23.831005-04	\N	\N
81aabfd3-329b-4346-848b-5bea91a93fc1	Cocos (Keeling) Islands (the)	CC	CCK	166	\N	\N	\N	2025-03-14 10:53:23.833155-04	2025-03-14 10:53:23.833155-04	\N	\N
fea93ffa-2056-42bd-984d-d35e5d8999a3	Colombia	CO	COL	170	\N	\N	\N	2025-03-14 10:53:23.837133-04	2025-03-14 10:53:23.837133-04	\N	\N
9354e37c-87a6-4aa8-a7a0-92ed57549ea2	Comoros (the)	KM	COM	174	\N	\N	\N	2025-03-14 10:53:23.84501-04	2025-03-14 10:53:23.84501-04	\N	\N
56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	Congo (the Democratic Republic of the)	CD	COD	180	\N	\N	\N	2025-03-14 10:53:23.855057-04	2025-03-14 10:53:23.855057-04	\N	\N
e76be943-41ac-4c14-980c-603a3652643f	Congo (the)	CG	COG	178	\N	\N	\N	2025-03-14 10:53:23.862265-04	2025-03-14 10:53:23.862265-04	\N	\N
3ce0f539-13c5-412d-8301-2ba191ea3328	Cook Islands (the)	CK	COK	184	\N	\N	\N	2025-03-14 10:53:23.872326-04	2025-03-14 10:53:23.872326-04	\N	\N
b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	Costa Rica	CR	CRI	188	\N	\N	\N	2025-03-14 10:53:23.878445-04	2025-03-14 10:53:23.878445-04	\N	\N
623da6ff-cb25-4a58-bafa-da9088cfb606	Croatia	HR	HRV	191	\N	\N	\N	2025-03-14 10:53:23.888667-04	2025-03-14 10:53:23.888667-04	\N	\N
9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	Cuba	CU	CUB	192	\N	\N	\N	2025-03-14 10:53:23.896775-04	2025-03-14 10:53:23.896775-04	\N	\N
b0ca323f-43b7-4020-b9f0-307751da0b74	Curaçao	CW	CUW	531	\N	\N	\N	2025-03-14 10:53:23.921053-04	2025-03-14 10:53:23.921053-04	\N	\N
1c02ee54-327e-464f-b249-54a5b9f07a95	Cyprus	CY	CYP	196	\N	\N	\N	2025-03-14 10:53:23.9731-04	2025-03-14 10:53:23.9731-04	\N	\N
1a8acd2c-9221-47e0-92f6-35f89fa37812	Czechia	CZ	CZE	203	\N	\N	\N	2025-03-14 10:53:23.978532-04	2025-03-14 10:53:23.978532-04	\N	\N
8432f245-2bb6-4186-a3fd-607dee8bfbb3	Côte d'Ivoire	CI	CIV	384	\N	\N	\N	2025-03-14 10:53:23.983653-04	2025-03-14 10:53:23.983653-04	\N	\N
9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	Denmark	DK	DNK	208	\N	\N	\N	2025-03-14 10:53:23.988494-04	2025-03-14 10:53:23.988494-04	\N	\N
9d0c0a31-5443-434e-ade3-843f653b13a5	Djibouti	DJ	DJI	262	\N	\N	\N	2025-03-14 10:53:23.991102-04	2025-03-14 10:53:23.991102-04	\N	\N
15adee7a-c86c-4451-a862-6664e4a72332	Dominica	DM	DMA	212	\N	\N	\N	2025-03-14 10:53:23.993898-04	2025-03-14 10:53:23.993898-04	\N	\N
9871b276-3844-46c3-8564-243c81bfc26e	Dominican Republic (the)	DO	DOM	214	\N	\N	\N	2025-03-14 10:53:23.999496-04	2025-03-14 10:53:23.999496-04	\N	\N
65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	Ecuador	EC	ECU	218	\N	\N	\N	2025-03-14 10:53:24.016365-04	2025-03-14 10:53:24.016365-04	\N	\N
441dc9df-8866-4dcf-8f81-c8957513ddaa	Egypt	EG	EGY	818	\N	\N	\N	2025-03-14 10:53:24.022549-04	2025-03-14 10:53:24.022549-04	\N	\N
6f57f96c-4e83-4188-95b1-4a58af42d368	El Salvador	SV	SLV	222	\N	\N	\N	2025-03-14 10:53:24.024993-04	2025-03-14 10:53:24.024993-04	\N	\N
2e568ea8-6aab-4e76-b578-8fc44b566d00	Equatorial Guinea	GQ	GNQ	226	\N	\N	\N	2025-03-14 10:53:24.027234-04	2025-03-14 10:53:24.027234-04	\N	\N
92ddb36f-34ee-4f99-8da8-f52d78752b40	Eritrea	ER	ERI	232	\N	\N	\N	2025-03-14 10:53:24.029168-04	2025-03-14 10:53:24.029168-04	\N	\N
d2a87d3c-d4f5-4728-a702-d520d52f8efc	Estonia	EE	EST	233	\N	\N	\N	2025-03-14 10:53:24.031295-04	2025-03-14 10:53:24.031295-04	\N	\N
7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	Eswatini	SZ	SWZ	748	\N	\N	\N	2025-03-14 10:53:24.033046-04	2025-03-14 10:53:24.033046-04	\N	\N
6f00304d-9dd1-4a86-b25e-96ffc4c96245	Ethiopia	ET	ETH	231	\N	\N	\N	2025-03-14 10:53:24.041708-04	2025-03-14 10:53:24.041708-04	\N	\N
29535a71-4da7-4d9e-8a1a-088498c25104	Falkland Islands (the) [Malvinas]	FK	FLK	238	\N	\N	\N	2025-03-14 10:53:24.047549-04	2025-03-14 10:53:24.047549-04	\N	\N
ae102e8b-bccb-4edb-8c92-bdb1225dfd15	Faroe Islands (the)	FO	FRO	234	\N	\N	\N	2025-03-14 10:53:24.050959-04	2025-03-14 10:53:24.050959-04	\N	\N
53179e6b-42df-45fb-808e-06635445f0a3	Fiji	FJ	FJI	242	\N	\N	\N	2025-03-14 10:53:24.060096-04	2025-03-14 10:53:24.060096-04	\N	\N
01bfbc25-4974-4e1d-a039-afc1ab9350a0	Finland	FI	FIN	246	\N	\N	\N	2025-03-14 10:53:24.064814-04	2025-03-14 10:53:24.064814-04	\N	\N
1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	France	FR	FRA	250	\N	\N	\N	2025-03-14 10:53:24.072605-04	2025-03-14 10:53:24.072605-04	\N	\N
a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	French Guiana	GF	GUF	254	\N	\N	\N	2025-03-14 10:53:24.109741-04	2025-03-14 10:53:24.109741-04	\N	\N
49845113-2ada-42b3-b60e-a10d47724be3	French Polynesia	PF	PYF	258	\N	\N	\N	2025-03-14 10:53:24.14427-04	2025-03-14 10:53:24.14427-04	\N	\N
c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	French Southern Territories (the)	TF	ATF	260	\N	\N	\N	2025-03-14 10:53:24.161874-04	2025-03-14 10:53:24.161874-04	\N	\N
23525539-5160-4174-bf39-938badb0bb75	Gabon	GA	GAB	266	\N	\N	\N	2025-03-14 10:53:24.164862-04	2025-03-14 10:53:24.164862-04	\N	\N
45b02588-26f2-4553-bb6e-c773bbe1cd45	Gambia (the)	GM	GMB	270	\N	\N	\N	2025-03-14 10:53:24.166378-04	2025-03-14 10:53:24.166378-04	\N	\N
18bed42b-5400-452c-91db-4fb4147f355f	Georgia	GE	GEO	268	\N	\N	\N	2025-03-14 10:53:24.169571-04	2025-03-14 10:53:24.169571-04	\N	\N
5849ff0b-a440-4ab2-a389-b4acc0bf552e	Germany	DE	DEU	276	\N	\N	\N	2025-03-14 10:53:24.177302-04	2025-03-14 10:53:24.177302-04	\N	\N
aba9bce3-2155-4621-b4b0-3cf669cad3b2	Ghana	GH	GHA	288	\N	\N	\N	2025-03-14 10:53:24.179408-04	2025-03-14 10:53:24.179408-04	\N	\N
2dd84bba-57aa-4137-b532-5e40df1f9818	Gibraltar	GI	GIB	292	\N	\N	\N	2025-03-14 10:53:24.192794-04	2025-03-14 10:53:24.192794-04	\N	\N
02bf47ac-626f-45f7-910b-344eab76bc24	Greece	GR	GRC	300	\N	\N	\N	2025-03-14 10:53:24.198863-04	2025-03-14 10:53:24.198863-04	\N	\N
c022b4da-2739-428a-8169-4522791ac94e	Greenland	GL	GRL	304	\N	\N	\N	2025-03-14 10:53:24.210436-04	2025-03-14 10:53:24.210436-04	\N	\N
1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	Grenada	GD	GRD	308	\N	\N	\N	2025-03-14 10:53:24.223316-04	2025-03-14 10:53:24.223316-04	\N	\N
8d49f450-e103-4b29-8e22-2e14306ae829	Guadeloupe	GP	GLP	312	\N	\N	\N	2025-03-14 10:53:24.228172-04	2025-03-14 10:53:24.228172-04	\N	\N
e483cd63-2bcc-41d8-bb4e-692c4d20afc0	Guam	GU	GUM	316	\N	\N	\N	2025-03-14 10:53:24.244146-04	2025-03-14 10:53:24.244146-04	\N	\N
6b142850-4553-451e-a6cb-3cb9fe612458	Guatemala	GT	GTM	320	\N	\N	\N	2025-03-14 10:53:24.246608-04	2025-03-14 10:53:24.246608-04	\N	\N
5029f19f-04e8-4c22-baaa-abc4410face3	Guernsey	GG	GGY	831	\N	\N	\N	2025-03-14 10:53:24.262487-04	2025-03-14 10:53:24.262487-04	\N	\N
d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	Guinea	GN	GIN	324	\N	\N	\N	2025-03-14 10:53:24.277946-04	2025-03-14 10:53:24.277946-04	\N	\N
ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	Guinea-Bissau	GW	GNB	624	\N	\N	\N	2025-03-14 10:53:24.288837-04	2025-03-14 10:53:24.288837-04	\N	\N
3a237a3a-4394-48e9-87c4-334c87d1b6a1	Guyana	GY	GUY	328	\N	\N	\N	2025-03-14 10:53:24.296846-04	2025-03-14 10:53:24.296846-04	\N	\N
7ef05e26-cf68-4e16-a18d-c925d29e7d0a	Haiti	HT	HTI	332	\N	\N	\N	2025-03-14 10:53:24.304676-04	2025-03-14 10:53:24.304676-04	\N	\N
00160b54-fdf1-48d1-9b52-52842dc8df4e	Heard Island and McDonald Islands	HM	HMD	334	\N	\N	\N	2025-03-14 10:53:24.30966-04	2025-03-14 10:53:24.30966-04	\N	\N
29e9b502-fde8-4a8f-91b6-ff44f8d41479	Holy See (the)	VA	VAT	336	\N	\N	\N	2025-03-14 10:53:24.326936-04	2025-03-14 10:53:24.326936-04	\N	\N
ca6e0150-9d34-403c-9fea-bb1e35d0e894	Honduras	HN	HND	340	\N	\N	\N	2025-03-14 10:53:24.330228-04	2025-03-14 10:53:24.330228-04	\N	\N
16743e3d-672d-4584-9a3c-5d76ae079569	Hong Kong	HK	HKG	344	\N	\N	\N	2025-03-14 10:53:24.341746-04	2025-03-14 10:53:24.341746-04	\N	\N
e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	Hungary	HU	HUN	348	\N	\N	\N	2025-03-14 10:53:24.345584-04	2025-03-14 10:53:24.345584-04	\N	\N
372b482c-fcb8-405d-a88a-5d2ee5686e30	Iceland	IS	ISL	352	\N	\N	\N	2025-03-14 10:53:24.357979-04	2025-03-14 10:53:24.357979-04	\N	\N
c47cf3e0-e149-4834-b454-5fd4d583a1a7	India	IN	IND	356	\N	\N	\N	2025-03-14 10:53:24.365561-04	2025-03-14 10:53:24.365561-04	\N	\N
d7b7595d-a831-48ec-84d4-39476bc3e44a	Indonesia	ID	IDN	360	\N	\N	\N	2025-03-14 10:53:24.381804-04	2025-03-14 10:53:24.381804-04	\N	\N
0690e264-ed8b-48b3-8930-5651eebe2e2e	Iran (Islamic Republic of)	IR	IRN	364	\N	\N	\N	2025-03-14 10:53:24.393712-04	2025-03-14 10:53:24.393712-04	\N	\N
b969a964-3765-4744-8080-3e2c88ab688e	Iraq	IQ	IRQ	368	\N	\N	\N	2025-03-14 10:53:24.407826-04	2025-03-14 10:53:24.407826-04	\N	\N
6750bd19-7115-4966-b7db-0d8e2add036a	Ireland	IE	IRL	372	\N	\N	\N	2025-03-14 10:53:24.412399-04	2025-03-14 10:53:24.412399-04	\N	\N
e2b4450f-4d07-4171-9a2b-8e2ba98a390d	Isle of Man	IM	IMN	833	\N	\N	\N	2025-03-14 10:53:24.424426-04	2025-03-14 10:53:24.424426-04	\N	\N
2afa78a2-892a-4dfb-9098-7926491b648f	Israel	IL	ISR	376	\N	\N	\N	2025-03-14 10:53:24.428544-04	2025-03-14 10:53:24.428544-04	\N	\N
374edfb0-e4ae-4625-af63-a14d4cb48f9b	Italy	IT	ITA	380	\N	\N	\N	2025-03-14 10:53:24.43444-04	2025-03-14 10:53:24.43444-04	\N	\N
d9f8f427-d02c-4a3a-9091-0a442685cf72	Jamaica	JM	JAM	388	\N	\N	\N	2025-03-14 10:53:24.448962-04	2025-03-14 10:53:24.448962-04	\N	\N
9b28e1e2-badb-4a9d-88d4-84f5612934e5	Japan	JP	JPN	392	\N	\N	\N	2025-03-14 10:53:24.451423-04	2025-03-14 10:53:24.451423-04	\N	\N
d4b1799f-245c-44e7-bc89-1eec59a28c9c	Jersey	JE	JEY	832	\N	\N	\N	2025-03-14 10:53:24.453104-04	2025-03-14 10:53:24.453104-04	\N	\N
6038e2ae-cb47-4eb1-be2e-067e48ba9c83	Jordan	JO	JOR	400	\N	\N	\N	2025-03-14 10:53:24.455181-04	2025-03-14 10:53:24.455181-04	\N	\N
1a810543-4218-41a4-90ba-9e3743f077fa	Kazakhstan	KZ	KAZ	398	\N	\N	\N	2025-03-14 10:53:24.456644-04	2025-03-14 10:53:24.456644-04	\N	\N
09827071-8a30-42ac-898c-59a6fe9f0c75	Kenya	KE	KEN	404	\N	\N	\N	2025-03-14 10:53:24.458331-04	2025-03-14 10:53:24.458331-04	\N	\N
59996c9e-0bc9-4120-bee1-3f0455f81725	Kiribati	KI	KIR	296	\N	\N	\N	2025-03-14 10:53:24.463045-04	2025-03-14 10:53:24.463045-04	\N	\N
d36af823-920c-47ab-965e-4ab698621052	Korea (the Democratic People's Republic of)	KP	PRK	408	\N	\N	\N	2025-03-14 10:53:24.464918-04	2025-03-14 10:53:24.464918-04	\N	\N
fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	Korea (the Republic of)	KR	KOR	410	\N	\N	\N	2025-03-14 10:53:24.469369-04	2025-03-14 10:53:24.469369-04	\N	\N
2d3e7958-5f64-4312-abe6-0af811e901c3	Kuwait	KW	KWT	414	\N	\N	\N	2025-03-14 10:53:24.489815-04	2025-03-14 10:53:24.489815-04	\N	\N
92b916e1-6a0b-4498-9048-3901b27bec39	Kyrgyzstan	KG	KGZ	417	\N	\N	\N	2025-03-14 10:53:24.502787-04	2025-03-14 10:53:24.502787-04	\N	\N
7f87bc22-635b-416a-8722-53c1ee704f0c	Lao People's Democratic Republic (the)	LA	LAO	418	\N	\N	\N	2025-03-14 10:53:24.529699-04	2025-03-14 10:53:24.529699-04	\N	\N
d65b2853-a79d-401a-8f05-adf2743b9162	Latvia	LV	LVA	428	\N	\N	\N	2025-03-14 10:53:24.536995-04	2025-03-14 10:53:24.536995-04	\N	\N
5f946046-e498-403d-a64a-6933c7bd6896	Lebanon	LB	LBN	422	\N	\N	\N	2025-03-14 10:53:24.540781-04	2025-03-14 10:53:24.540781-04	\N	\N
f3aa333e-caa8-4933-b05c-e98a52d0fd1c	Lesotho	LS	LSO	426	\N	\N	\N	2025-03-14 10:53:24.545027-04	2025-03-14 10:53:24.545027-04	\N	\N
c6db06ec-612a-4dc3-bbc6-7c153e90994c	Liberia	LR	LBR	430	\N	\N	\N	2025-03-14 10:53:24.557993-04	2025-03-14 10:53:24.557993-04	\N	\N
f410965b-b444-4df5-bfd6-e138109567a0	Libya	LY	LBY	434	\N	\N	\N	2025-03-14 10:53:24.562023-04	2025-03-14 10:53:24.562023-04	\N	\N
77e171bc-3fa1-4ecb-8a5a-95029ca1f242	Liechtenstein	LI	LIE	438	\N	\N	\N	2025-03-14 10:53:24.581548-04	2025-03-14 10:53:24.581548-04	\N	\N
edccde66-49d6-459e-94e7-02b99477d24c	Lithuania	LT	LTU	440	\N	\N	\N	2025-03-14 10:53:24.587703-04	2025-03-14 10:53:24.587703-04	\N	\N
a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	Luxembourg	LU	LUX	442	\N	\N	\N	2025-03-14 10:53:24.593051-04	2025-03-14 10:53:24.593051-04	\N	\N
f3da6061-0490-40ac-bdec-10e862ef1296	Macao	MO	MAC	446	\N	\N	\N	2025-03-14 10:53:24.595156-04	2025-03-14 10:53:24.595156-04	\N	\N
8e9ff64e-0787-4e03-9835-e833ca96ed46	Madagascar	MG	MDG	450	\N	\N	\N	2025-03-14 10:53:24.610271-04	2025-03-14 10:53:24.610271-04	\N	\N
b54125c1-a96c-4137-9e7a-c197421d99b3	Malawi	MW	MWI	454	\N	\N	\N	2025-03-14 10:53:24.628845-04	2025-03-14 10:53:24.628845-04	\N	\N
bebb0636-e19e-40a8-8733-18aa11ba1e13	Malaysia	MY	MYS	458	\N	\N	\N	2025-03-14 10:53:24.64033-04	2025-03-14 10:53:24.64033-04	\N	\N
6432d484-b4a5-427f-a12a-59303f1e50ee	Maldives	MV	MDV	462	\N	\N	\N	2025-03-14 10:53:24.644909-04	2025-03-14 10:53:24.644909-04	\N	\N
4f96dd8e-6915-481e-aebb-672f83b45aa1	Mali	ML	MLI	466	\N	\N	\N	2025-03-14 10:53:24.657797-04	2025-03-14 10:53:24.657797-04	\N	\N
88f85444-56fd-4596-a6f3-84e3dde28513	Malta	MT	MLT	470	\N	\N	\N	2025-03-14 10:53:24.67338-04	2025-03-14 10:53:24.67338-04	\N	\N
0953b49f-6af7-4347-a249-24c34997bf1d	Marshall Islands (the)	MH	MHL	584	\N	\N	\N	2025-03-14 10:53:24.676937-04	2025-03-14 10:53:24.676937-04	\N	\N
0d33577d-027b-4a5d-b055-d766d2627542	Martinique	MQ	MTQ	474	\N	\N	\N	2025-03-14 10:53:24.678617-04	2025-03-14 10:53:24.678617-04	\N	\N
8e2f3b14-4bb8-48fd-88c4-54a573635bc4	Mauritania	MR	MRT	478	\N	\N	\N	2025-03-14 10:53:24.679978-04	2025-03-14 10:53:24.679978-04	\N	\N
02932d66-2813-47b0-ae40-30564049a5ef	Mauritius	MU	MUS	480	\N	\N	\N	2025-03-14 10:53:24.7116-04	2025-03-14 10:53:24.7116-04	\N	\N
a4ccc274-2686-4677-b826-95e0616f156d	Mayotte	YT	MYT	175	\N	\N	\N	2025-03-14 10:53:24.728396-04	2025-03-14 10:53:24.728396-04	\N	\N
a04fc678-94ae-42bb-b43b-38ce17d30faf	Mexico	MX	MEX	484	\N	\N	\N	2025-03-14 10:53:24.744561-04	2025-03-14 10:53:24.744561-04	\N	\N
1a8f1b99-a206-48d9-8170-23814b72c4cc	Micronesia (Federated States of)	FM	FSM	583	\N	\N	\N	2025-03-14 10:53:24.748574-04	2025-03-14 10:53:24.748574-04	\N	\N
295fd56c-315c-4c82-9e20-fb571f376ddd	Moldova (the Republic of)	MD	MDA	498	\N	\N	\N	2025-03-14 10:53:24.770311-04	2025-03-14 10:53:24.770311-04	\N	\N
a0099cf4-5479-4475-a86b-2f3d67995db8	Monaco	MC	MCO	492	\N	\N	\N	2025-03-14 10:53:24.777624-04	2025-03-14 10:53:24.777624-04	\N	\N
dfbc0a35-28c7-4077-b9e6-08f3413ad130	Mongolia	MN	MNG	496	\N	\N	\N	2025-03-14 10:53:24.792541-04	2025-03-14 10:53:24.792541-04	\N	\N
47dcd774-7cbf-4a87-94df-369d0abf9232	Montenegro	ME	MNE	499	\N	\N	\N	2025-03-14 10:53:24.796324-04	2025-03-14 10:53:24.796324-04	\N	\N
d2d84e05-c829-4c67-acec-3632e5f6515a	Montserrat	MS	MSR	500	\N	\N	\N	2025-03-14 10:53:24.800496-04	2025-03-14 10:53:24.800496-04	\N	\N
0a421a5e-ad04-43ab-a539-2644d3ddabb0	Morocco	MA	MAR	504	\N	\N	\N	2025-03-14 10:53:24.803575-04	2025-03-14 10:53:24.803575-04	\N	\N
f8705655-8e50-4159-b738-efdb7c92de1f	Mozambique	MZ	MOZ	508	\N	\N	\N	2025-03-14 10:53:24.805925-04	2025-03-14 10:53:24.805925-04	\N	\N
0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	Myanmar	MM	MMR	104	\N	\N	\N	2025-03-14 10:53:24.813302-04	2025-03-14 10:53:24.813302-04	\N	\N
81e51f8b-500d-4366-9360-3450dfa5ee4d	Namibia	NA	NAM	516	\N	\N	\N	2025-03-14 10:53:24.819467-04	2025-03-14 10:53:24.819467-04	\N	\N
a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	Nauru	NR	NRU	520	\N	\N	\N	2025-03-14 10:53:24.825044-04	2025-03-14 10:53:24.825044-04	\N	\N
9297daf6-1431-4b62-9039-2ee22dcbba29	Nepal	NP	NPL	524	\N	\N	\N	2025-03-14 10:53:24.829174-04	2025-03-14 10:53:24.829174-04	\N	\N
eb4b669b-ccb1-4be4-bbad-5e1717b36d79	Netherlands (Kingdom of the)	NL	NLD	528	\N	\N	\N	2025-03-14 10:53:24.84512-04	2025-03-14 10:53:24.84512-04	\N	\N
f34e06ee-82cc-4a62-bd17-947c58f42116	New Caledonia	NC	NCL	540	\N	\N	\N	2025-03-14 10:53:24.860825-04	2025-03-14 10:53:24.860825-04	\N	\N
38ccc597-1f09-4de4-ad38-b9cddd2256c3	New Zealand	NZ	NZL	554	\N	\N	\N	2025-03-14 10:53:24.862685-04	2025-03-14 10:53:24.862685-04	\N	\N
70e897f5-c029-4382-9778-de9aa02b85d7	Nicaragua	NI	NIC	558	\N	\N	\N	2025-03-14 10:53:24.864128-04	2025-03-14 10:53:24.864128-04	\N	\N
5f42e8ac-7ec4-4192-9df8-2b18467c12e9	Niger (the)	NE	NER	562	\N	\N	\N	2025-03-14 10:53:24.865375-04	2025-03-14 10:53:24.865375-04	\N	\N
834f193e-7023-48a7-bc8e-58a910845d6b	Nigeria	NG	NGA	566	\N	\N	\N	2025-03-14 10:53:24.873157-04	2025-03-14 10:53:24.873157-04	\N	\N
e90ca965-4a55-433d-83c8-9de44b168b9c	Niue	NU	NIU	570	\N	\N	\N	2025-03-14 10:53:24.877519-04	2025-03-14 10:53:24.877519-04	\N	\N
e8d65387-e415-4e52-bf95-4cf7134e2235	Norfolk Island	NF	NFK	574	\N	\N	\N	2025-03-14 10:53:24.882084-04	2025-03-14 10:53:24.882084-04	\N	\N
6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	North Macedonia	MK	MKD	807	\N	\N	\N	2025-03-14 10:53:24.896094-04	2025-03-14 10:53:24.896094-04	\N	\N
66177523-edef-4bb4-9e47-1db421e14257	Northern Mariana Islands (the)	MP	MNP	580	\N	\N	\N	2025-03-14 10:53:24.899499-04	2025-03-14 10:53:24.899499-04	\N	\N
fcd820ab-6f42-4794-8e6a-217faa6017ac	Norway	NO	NOR	578	\N	\N	\N	2025-03-14 10:53:24.904709-04	2025-03-14 10:53:24.904709-04	\N	\N
172fe5c4-06a1-435e-86e1-50a717ff1505	Oman	OM	OMN	512	\N	\N	\N	2025-03-14 10:53:24.907264-04	2025-03-14 10:53:24.907264-04	\N	\N
52fa7c54-7266-459b-b679-a4a0966dcca2	Pakistan	PK	PAK	586	\N	\N	\N	2025-03-14 10:53:24.911627-04	2025-03-14 10:53:24.911627-04	\N	\N
ad04836f-3c39-4de5-ba1d-171dded4420b	Palau	PW	PLW	585	\N	\N	\N	2025-03-14 10:53:24.923129-04	2025-03-14 10:53:24.923129-04	\N	\N
5c6ae2e3-4332-4f90-b002-8dedcae3ba24	Palestine, State of	PS	PSE	275	\N	\N	\N	2025-03-14 10:53:24.927897-04	2025-03-14 10:53:24.927897-04	\N	\N
9fab0497-b7b0-43af-8c94-ac59cf2d504a	Panama	PA	PAN	591	\N	\N	\N	2025-03-14 10:53:24.930406-04	2025-03-14 10:53:24.930406-04	\N	\N
9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	Papua New Guinea	PG	PNG	598	\N	\N	\N	2025-03-14 10:53:24.939409-04	2025-03-14 10:53:24.939409-04	\N	\N
e0b720ab-8f2e-4914-b9f1-3dbec41eef21	Paraguay	PY	PRY	600	\N	\N	\N	2025-03-14 10:53:24.943386-04	2025-03-14 10:53:24.943386-04	\N	\N
2069bcb9-4a3d-4462-8860-e39fe7327d4f	Peru	PE	PER	604	\N	\N	\N	2025-03-14 10:53:24.945942-04	2025-03-14 10:53:24.945942-04	\N	\N
4b0170c2-6403-45f2-a9be-25e61595b48e	Philippines (the)	PH	PHL	608	\N	\N	\N	2025-03-14 10:53:24.954883-04	2025-03-14 10:53:24.954883-04	\N	\N
db94e4b5-77ae-4459-8494-e31443458d7a	Pitcairn	PN	PCN	612	\N	\N	\N	2025-03-14 10:53:24.978423-04	2025-03-14 10:53:24.978423-04	\N	\N
fb7e9280-2b6f-429c-be0c-e4fa204755f8	Poland	PL	POL	616	\N	\N	\N	2025-03-14 10:53:24.987208-04	2025-03-14 10:53:24.987208-04	\N	\N
9c06ea4c-d311-4249-a91e-09c14c66786a	Portugal	PT	PRT	620	\N	\N	\N	2025-03-14 10:53:24.990172-04	2025-03-14 10:53:24.990172-04	\N	\N
38c264c0-26f6-4929-a52c-2277e2aaccce	Puerto Rico	PR	PRI	630	\N	\N	\N	2025-03-14 10:53:24.993455-04	2025-03-14 10:53:24.993455-04	\N	\N
d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	Qatar	QA	QAT	634	\N	\N	\N	2025-03-14 10:53:24.996574-04	2025-03-14 10:53:24.996574-04	\N	\N
1042f63e-2ebf-492c-87e8-2b7bdc69150d	Romania	RO	ROU	642	\N	\N	\N	2025-03-14 10:53:24.999228-04	2025-03-14 10:53:24.999228-04	\N	\N
7c469d95-9f01-4295-ab59-fd3698ed7a36	Russian Federation (the)	RU	RUS	643	\N	\N	\N	2025-03-14 10:53:25.002547-04	2025-03-14 10:53:25.002547-04	\N	\N
8d3556d9-f508-4a55-9f48-5c1aebc59de9	Rwanda	RW	RWA	646	\N	\N	\N	2025-03-14 10:53:25.005324-04	2025-03-14 10:53:25.005324-04	\N	\N
04c59caf-4541-4e15-8c6e-d4a435967ef4	Réunion	RE	REU	638	\N	\N	\N	2025-03-14 10:53:25.008038-04	2025-03-14 10:53:25.008038-04	\N	\N
ade77569-3a72-4030-b2b4-11814fdd6b0a	Saint Barthélemy	BL	BLM	652	\N	\N	\N	2025-03-14 10:53:25.010558-04	2025-03-14 10:53:25.010558-04	\N	\N
8bd68779-d3a5-4372-b932-598273b735ef	Saint Helena, Ascension and Tristan da Cunha	SH	SHN	654	\N	\N	\N	2025-03-14 10:53:25.012907-04	2025-03-14 10:53:25.012907-04	\N	\N
251ebe60-b752-4467-aa22-0d46d5ae4953	Saint Kitts and Nevis	KN	KNA	659	\N	\N	\N	2025-03-14 10:53:25.016219-04	2025-03-14 10:53:25.016219-04	\N	\N
411c3f03-3466-4fb1-a4ff-a9f71f7432ba	Saint Lucia	LC	LCA	662	\N	\N	\N	2025-03-14 10:53:25.033112-04	2025-03-14 10:53:25.033112-04	\N	\N
9b0f7458-981e-4a78-9cc1-969130cfb358	Saint Martin (French part)	MF	MAF	663	\N	\N	\N	2025-03-14 10:53:25.039534-04	2025-03-14 10:53:25.039534-04	\N	\N
36ea8942-d4e1-44ed-a36c-33fb6e715560	Saint Pierre and Miquelon	PM	SPM	666	\N	\N	\N	2025-03-14 10:53:25.043691-04	2025-03-14 10:53:25.043691-04	\N	\N
c4944fca-068f-4ab5-8b9d-3b2493d785f2	Saint Vincent and the Grenadines	VC	VCT	670	\N	\N	\N	2025-03-14 10:53:25.046366-04	2025-03-14 10:53:25.046366-04	\N	\N
e997b7ee-7a74-41b3-8089-1f8b84fa6b24	Samoa	WS	WSM	882	\N	\N	\N	2025-03-14 10:53:25.052006-04	2025-03-14 10:53:25.052006-04	\N	\N
c2066743-efa9-40b6-94b9-5b2b6e0942f3	San Marino	SM	SMR	674	\N	\N	\N	2025-03-14 10:53:25.057288-04	2025-03-14 10:53:25.057288-04	\N	\N
5def1949-7a28-4715-8427-6cb028048712	Sao Tome and Principe	ST	STP	678	\N	\N	\N	2025-03-14 10:53:25.062681-04	2025-03-14 10:53:25.062681-04	\N	\N
add83dad-b55a-4e07-ab2f-9c1828f310e6	Saudi Arabia	SA	SAU	682	\N	\N	\N	2025-03-14 10:53:25.068807-04	2025-03-14 10:53:25.068807-04	\N	\N
b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	Senegal	SN	SEN	686	\N	\N	\N	2025-03-14 10:53:25.072864-04	2025-03-14 10:53:25.072864-04	\N	\N
1a73dfdb-7333-4239-a6a6-7863010a6953	Serbia	RS	SRB	688	\N	\N	\N	2025-03-14 10:53:25.076977-04	2025-03-14 10:53:25.076977-04	\N	\N
635f7357-f443-4723-994f-7a81dd5d165f	Seychelles	SC	SYC	690	\N	\N	\N	2025-03-14 10:53:25.079726-04	2025-03-14 10:53:25.079726-04	\N	\N
1a291f0f-1525-4815-ba48-67acaf27dd7a	Sierra Leone	SL	SLE	694	\N	\N	\N	2025-03-14 10:53:25.085184-04	2025-03-14 10:53:25.085184-04	\N	\N
d2f92a82-754c-4dbf-9297-8222e71b7573	Singapore	SG	SGP	702	\N	\N	\N	2025-03-14 10:53:25.090103-04	2025-03-14 10:53:25.090103-04	\N	\N
aec1a837-c291-452c-9ac6-425d9f9dca36	Sint Maarten (Dutch part)	SX	SXM	534	\N	\N	\N	2025-03-14 10:53:25.095694-04	2025-03-14 10:53:25.095694-04	\N	\N
409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	Slovakia	SK	SVK	703	\N	\N	\N	2025-03-14 10:53:25.099237-04	2025-03-14 10:53:25.099237-04	\N	\N
81cf9d60-063d-4054-8277-0fc6eaa042ee	Slovenia	SI	SVN	705	\N	\N	\N	2025-03-14 10:53:25.115229-04	2025-03-14 10:53:25.115229-04	\N	\N
11859bb3-3249-4b3b-bc93-2236f608ff1e	Solomon Islands	SB	SLB	90	\N	\N	\N	2025-03-14 10:53:25.129269-04	2025-03-14 10:53:25.129269-04	\N	\N
4e6637ef-7d36-459a-9cf9-bd485e521443	Somalia	SO	SOM	706	\N	\N	\N	2025-03-14 10:53:25.141969-04	2025-03-14 10:53:25.141969-04	\N	\N
1e00e441-4e0a-4c95-a147-d5ba83dc7883	South Africa	ZA	ZAF	710	\N	\N	\N	2025-03-14 10:53:25.149683-04	2025-03-14 10:53:25.149683-04	\N	\N
2af622c9-671a-4992-8b66-085781d11864	South Georgia and the South Sandwich Islands	GS	SGS	239	\N	\N	\N	2025-03-14 10:53:25.165323-04	2025-03-14 10:53:25.165323-04	\N	\N
fda4281b-edb1-4bc4-8b80-86653209240b	South Sudan	SS	SSD	728	\N	\N	\N	2025-03-14 10:53:25.189514-04	2025-03-14 10:53:25.189514-04	\N	\N
1ad39315-d1f4-4655-84f0-db922eac7e1f	Spain	ES	ESP	724	\N	\N	\N	2025-03-14 10:53:25.193787-04	2025-03-14 10:53:25.193787-04	\N	\N
6bda2acd-5f00-4100-b31a-0de28d40a7c0	Sri Lanka	LK	LKA	144	\N	\N	\N	2025-03-14 10:53:25.197717-04	2025-03-14 10:53:25.197717-04	\N	\N
29569e45-ea36-4138-83a3-80b85ba9ba1a	Sudan (the)	SD	SDN	729	\N	\N	\N	2025-03-14 10:53:25.208952-04	2025-03-14 10:53:25.208952-04	\N	\N
37afad6a-c579-4b34-8042-c3aa708227b9	Suriname	SR	SUR	740	\N	\N	\N	2025-03-14 10:53:25.212931-04	2025-03-14 10:53:25.212931-04	\N	\N
d61520ca-a0b6-4df5-aaec-9abda8fc55d5	Svalbard and Jan Mayen	SJ	SJM	744	\N	\N	\N	2025-03-14 10:53:25.235961-04	2025-03-14 10:53:25.235961-04	\N	\N
c4233e6e-d7a3-4018-aff0-5415b06ef15b	Sweden	SE	SWE	752	\N	\N	\N	2025-03-14 10:53:25.243489-04	2025-03-14 10:53:25.243489-04	\N	\N
c93e39fe-759b-4db1-bd9a-230c1f930a7a	Switzerland	CH	CHE	756	\N	\N	\N	2025-03-14 10:53:25.246762-04	2025-03-14 10:53:25.246762-04	\N	\N
8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	Syrian Arab Republic (the)	SY	SYR	760	\N	\N	\N	2025-03-14 10:53:25.257621-04	2025-03-14 10:53:25.257621-04	\N	\N
583c470c-9284-4b66-a009-81ffab8bda1a	Taiwan (Province of China)	TW	TWN	158	\N	\N	\N	2025-03-14 10:53:25.261934-04	2025-03-14 10:53:25.261934-04	\N	\N
6c387ed5-533e-4d6c-915f-72a85bc28c14	Tajikistan	TJ	TJK	762	\N	\N	\N	2025-03-14 10:53:25.277273-04	2025-03-14 10:53:25.277273-04	\N	\N
0abf95b2-7e48-4d1f-bc17-4d5c384783a2	Tanzania, the United Republic of	TZ	TZA	834	\N	\N	\N	2025-03-14 10:53:25.281813-04	2025-03-14 10:53:25.281813-04	\N	\N
90a8f117-bde3-4070-8165-95116ddb6c78	Thailand	TH	THA	764	\N	\N	\N	2025-03-14 10:53:25.289245-04	2025-03-14 10:53:25.289245-04	\N	\N
78331efc-59a3-49c6-a4da-cd971800b07b	Timor-Leste	TL	TLS	626	\N	\N	\N	2025-03-14 10:53:25.292988-04	2025-03-14 10:53:25.292988-04	\N	\N
10cd0a5a-934b-4541-900f-61c5400cb33e	Togo	TG	TGO	768	\N	\N	\N	2025-03-14 10:53:25.295719-04	2025-03-14 10:53:25.295719-04	\N	\N
3db7e945-42c5-4ca5-88c0-1ae75751d3cd	Tokelau	TK	TKL	772	\N	\N	\N	2025-03-14 10:53:25.311821-04	2025-03-14 10:53:25.311821-04	\N	\N
9c6b3dbf-9144-4d72-9c8c-c9984731beec	Tonga	TO	TON	776	\N	\N	\N	2025-03-14 10:53:25.32262-04	2025-03-14 10:53:25.32262-04	\N	\N
5e585603-a76d-425f-a0e9-1e62f5f7e9e8	Trinidad and Tobago	TT	TTO	780	\N	\N	\N	2025-03-14 10:53:25.326421-04	2025-03-14 10:53:25.326421-04	\N	\N
d9295f16-be88-4756-8f6e-1cf4764be20a	Tunisia	TN	TUN	788	\N	\N	\N	2025-03-14 10:53:25.328839-04	2025-03-14 10:53:25.328839-04	\N	\N
bfb05d2f-9712-4a49-9db5-c7fc6db9e876	Turkmenistan	TM	TKM	795	\N	\N	\N	2025-03-14 10:53:25.344414-04	2025-03-14 10:53:25.344414-04	\N	\N
e67b4538-7412-45c0-a0cf-e27bff88caab	Turks and Caicos Islands (the)	TC	TCA	796	\N	\N	\N	2025-03-14 10:53:25.365367-04	2025-03-14 10:53:25.365367-04	\N	\N
b24c16bb-ff27-4814-b9d7-523fd69d9b41	Tuvalu	TV	TUV	798	\N	\N	\N	2025-03-14 10:53:25.372383-04	2025-03-14 10:53:25.372383-04	\N	\N
1cb61161-23ca-4336-806e-61086d967a67	Türkiye	TR	TUR	792	\N	\N	\N	2025-03-14 10:53:25.376719-04	2025-03-14 10:53:25.376719-04	\N	\N
1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	Uganda	UG	UGA	800	\N	\N	\N	2025-03-14 10:53:25.381905-04	2025-03-14 10:53:25.381905-04	\N	\N
278cade5-e251-4520-9394-cdd42c9212e6	Ukraine	UA	UKR	804	\N	\N	\N	2025-03-14 10:53:25.390328-04	2025-03-14 10:53:25.390328-04	\N	\N
b5966924-f09e-4024-8942-8f2e00949567	United Arab Emirates (the)	AE	ARE	784	\N	\N	\N	2025-03-14 10:53:25.394818-04	2025-03-14 10:53:25.394818-04	\N	\N
d1627009-fe55-469a-baf7-1a8b4979d654	United Kingdom of Great Britain and Northern Ireland (the)	GB	GBR	826	\N	\N	\N	2025-03-14 10:53:25.415377-04	2025-03-14 10:53:25.415377-04	\N	\N
f5804675-69c7-4b68-9dc6-22dea1f5201a	United States Minor Outlying Islands (the)	UM	UMI	581	\N	\N	\N	2025-03-14 10:53:25.421631-04	2025-03-14 10:53:25.421631-04	\N	\N
4a7446ad-a670-4e50-82dd-e71d2013d520	Uruguay	UY	URY	858	\N	\N	\N	2025-03-14 10:53:25.42718-04	2025-03-14 10:53:25.42718-04	\N	\N
3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	Uzbekistan	UZ	UZB	860	\N	\N	\N	2025-03-14 10:53:25.432006-04	2025-03-14 10:53:25.432006-04	\N	\N
6915f34b-6468-4e75-a1d9-dbeee0529cb8	Vanuatu	VU	VUT	548	\N	\N	\N	2025-03-14 10:53:25.442507-04	2025-03-14 10:53:25.442507-04	\N	\N
e4778ab5-7678-46d9-baea-0368e4f812f0	Venezuela (Bolivarian Republic of)	VE	VEN	862	\N	\N	\N	2025-03-14 10:53:25.44543-04	2025-03-14 10:53:25.44543-04	\N	\N
cf4be8bf-0906-4925-8291-6c8c785dcef4	Viet Nam	VN	VNM	704	\N	\N	\N	2025-03-14 10:53:25.458576-04	2025-03-14 10:53:25.458576-04	\N	\N
0b038769-9d16-464d-85e6-fed33a40579a	Virgin Islands (British)	VG	VGB	92	\N	\N	\N	2025-03-14 10:53:25.461722-04	2025-03-14 10:53:25.461722-04	\N	\N
da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	Virgin Islands (U.S.)	VI	VIR	850	\N	\N	\N	2025-03-14 10:53:25.475717-04	2025-03-14 10:53:25.475717-04	\N	\N
027e9c43-d25b-4cb5-b4c9-916084271623	Wallis and Futuna	WF	WLF	876	\N	\N	\N	2025-03-14 10:53:25.478793-04	2025-03-14 10:53:25.478793-04	\N	\N
8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	Western Sahara*	EH	ESH	732	\N	\N	\N	2025-03-14 10:53:25.48921-04	2025-03-14 10:53:25.48921-04	\N	\N
7d0f9dbd-4909-491d-9440-5f87bca5a254	Yemen	YE	YEM	887	\N	\N	\N	2025-03-14 10:53:25.496611-04	2025-03-14 10:53:25.496611-04	\N	\N
aa0a06e7-d580-47b2-bc2e-cddd466186cb	Zambia	ZM	ZMB	894	\N	\N	\N	2025-03-14 10:53:25.507594-04	2025-03-14 10:53:25.507594-04	\N	\N
7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	Zimbabwe	ZW	ZWE	716	\N	\N	\N	2025-03-14 10:53:25.511113-04	2025-03-14 10:53:25.511113-04	\N	\N
fa0dcd21-865b-4de3-a315-83af78061b4a	Åland Islands	AX	ALA	248	\N	\N	\N	2025-03-14 10:53:25.516047-04	2025-03-14 10:53:25.516047-04	\N	\N
69b81a70-6fa3-4533-9d00-c252f0f6245f	Ontario	CA_ONT	CAN_ONT	124	Ontario	\N	\N	2025-03-28 16:59:00.703-04	2025-03-28 16:59:00.703-04	b52c3226-dc94-4289-a051-b7227fd77ae8	f
360b9bee-d159-4e20-ba1f-9681d17cf9bc	Toronto	CA_ONT_ONT	CAN_ONT_ONT	124	Ontario	Toronto	\N	2025-03-28 17:00:09.105-04	2025-03-28 17:00:09.105-04	69b81a70-6fa3-4533-9d00-c252f0f6245f	f
6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	Illinois	US_ILL	USA_ILL	840	Illinois	\N	\N	2025-03-28 17:12:17.915-04	2025-03-28 17:12:17.915-04	e6fffac1-4aad-4ce4-9981-3983dde344d3	f
c9d94069-3e55-43c7-bca2-bbb5cabedc9a	Cook County	US_ILL_ILL	USA_ILL_ILL	840	Illinois	Cook County	\N	2025-03-28 17:12:34.908-04	2025-03-28 17:12:34.908-04	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	f
b19145e9-2513-41c3-b2a7-719588692eed	Chicago	US_ILL_ILL_ILL	USA_ILL_ILL_ILL	840	Illinois	Cook County	Chicago	2025-03-28 17:12:48.947-04	2025-03-28 17:12:48.947-04	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	f
0edca2a6-84ed-4258-828a-688d9bae549d	VIctoria	AU_VIC_2902	AUS_VIC_2902	\N	VIctoria	\N	\N	2026-02-11 16:24:52.903-05	2026-02-11 16:24:52.903-05	071a36ac-c2e2-4462-b10d-3175b101bd06	f
\.


--
-- Data for Name: customer_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_services (id, "customerId", "serviceId", "createdAt") FROM stdin;
7bfb42db-887c-4335-ac21-299aa89f1491	020b3051-2e2e-4006-975c-41b7f77c5f4e	383f3f2f-3194-4396-9a63-297f80e151f9	2026-01-28 14:46:09.743-05
5b99e5f7-e1cc-4ee4-94e4-c6480e787026	020b3051-2e2e-4006-975c-41b7f77c5f4e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2026-01-28 14:46:09.743-05
93de4fd6-606e-401d-bb67-060e254c41f4	020b3051-2e2e-4006-975c-41b7f77c5f4e	8388bb60-48e4-4781-a867-7c86b51be776	2026-01-28 14:46:09.743-05
3d364c9f-5c24-43dc-94c5-a9cf9df95aa1	020b3051-2e2e-4006-975c-41b7f77c5f4e	935f2544-5727-47a9-a758-bd24afea5994	2026-01-28 14:46:09.743-05
e078fbdf-f6c7-4b58-bbce-ef274dbdbd76	bfd1d2fe-6915-4e2c-a704-54ff349ff197	383f3f2f-3194-4396-9a63-297f80e151f9	2025-05-30 15:50:06.416-04
6f887f58-26b1-4135-b929-6deb5e8825f9	bfd1d2fe-6915-4e2c-a704-54ff349ff197	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-05-30 15:50:06.416-04
73eb51db-809f-4822-87a3-d05340461a2d	bfd1d2fe-6915-4e2c-a704-54ff349ff197	8388bb60-48e4-4781-a867-7c86b51be776	2025-05-30 15:50:06.416-04
\.


--
-- Data for Name: customer_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_users (id, "userId", "customerId", role, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, name, address, "contactName", "contactEmail", "contactPhone", "invoiceTerms", "invoiceContact", "invoiceMethod", disabled, "allowedServices", "masterAccountId", "billingAccountId", "createdAt", "updatedAt") FROM stdin;
020b3051-2e2e-4006-975c-41b7f77c5f4e	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:05:11.325-04	2026-01-28 14:46:09.738-05
bfd1d2fe-6915-4e2c-a704-54ff349ff197	1-Test Customer		Andy Hellman	andythellman@gmail.com	7037410710				f	\N	\N	\N	2025-05-30 15:32:17.959-04	2025-05-30 15:50:06.406-04
\.


--
-- Data for Name: data_fields; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.data_fields (id, "serviceId", label, "shortName", "dataType", instructions) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, "serviceId", name, instructions, scope, "filePath") FROM stdin;
\.


--
-- Data for Name: dsx_availability; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dsx_availability (id, "serviceId", "locationId", "isAvailable", "unavailableReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dsx_mappings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dsx_mappings (id, "serviceId", "locationId", "requirementId", "isRequired", "createdAt", "updatedAt") FROM stdin;
2bbba97c-b303-4c8d-9894-f90393af681f	935f2544-5727-47a9-a758-bd24afea5994	e6fffac1-4aad-4ce4-9981-3983dde344d3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c51d8048-6042-47ab-a3d1-17485a4fb924	935f2544-5727-47a9-a758-bd24afea5994	32c804e1-e904-45b0-b150-cdc70be9679c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c1a104cb-f8f9-4637-8ad5-626142f2c2ac	935f2544-5727-47a9-a758-bd24afea5994	16d101ea-c92f-44b0-b7dc-11cd3680215c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
0861c4d1-3286-4055-bdc0-1885f15c8746	935f2544-5727-47a9-a758-bd24afea5994	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
15400801-646f-4f8c-b05e-69334f846ba4	935f2544-5727-47a9-a758-bd24afea5994	778ec216-a84f-41c7-a341-9d04269f0dc6	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
b45f651c-3e29-4480-a3f8-ba6acc02ad6b	935f2544-5727-47a9-a758-bd24afea5994	ed459bf2-7e56-4eca-bc6b-cee6655c644a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
b87a684f-b8b2-4d1a-865a-35705dd5c616	935f2544-5727-47a9-a758-bd24afea5994	9f38de93-8d44-4760-9152-372666596d56	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
326a9949-e195-46da-b32f-e9d1a968c343	935f2544-5727-47a9-a758-bd24afea5994	eadf502a-97e3-44fc-b07c-0f7015cb598a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
1f827ade-acb8-4873-894f-d4adcbe44fb9	935f2544-5727-47a9-a758-bd24afea5994	c21d204c-4660-41e7-93c8-d895ddbaab26	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
8846d656-0740-4fcf-9dd8-89328b1babae	935f2544-5727-47a9-a758-bd24afea5994	31dec1f6-7abb-4742-ade1-42b89ad7766a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
cdf42893-2236-4c06-9686-3c28d3735195	935f2544-5727-47a9-a758-bd24afea5994	b182931c-6229-4be3-bde7-ef6126032f52	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c95a08d8-57df-4b1a-b4d8-a16b59a7867d	935f2544-5727-47a9-a758-bd24afea5994	93421fdb-364d-418e-898a-a1f62dd8020a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
933e626f-02e0-4e80-9d66-c2e56717f550	935f2544-5727-47a9-a758-bd24afea5994	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
d0a792d2-4e94-4516-b3de-fcac70717aa0	935f2544-5727-47a9-a758-bd24afea5994	071a36ac-c2e2-4462-b10d-3175b101bd06	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
9098bf4e-dd84-40b8-9cf3-541aa4f596b4	935f2544-5727-47a9-a758-bd24afea5994	734f6aa9-6ade-4187-b3b3-2cba78068a34	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ed7f0355-c1c6-463a-8fec-936c5a328f93	935f2544-5727-47a9-a758-bd24afea5994	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
5facd9d0-df4c-4507-916e-97b7cb783ae6	935f2544-5727-47a9-a758-bd24afea5994	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
6212c518-0cec-4ccc-b4c9-2fd78a38aff2	935f2544-5727-47a9-a758-bd24afea5994	32898e2d-148e-4483-9e74-6fca3a3eed62	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
75fe407f-848d-4968-b3f8-ce30a462e3a1	935f2544-5727-47a9-a758-bd24afea5994	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
04abf379-3ee7-4bfb-b065-a06be0458e8b	935f2544-5727-47a9-a758-bd24afea5994	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
45e96b5b-dba5-4fd3-b7ab-03a4fa67e0da	935f2544-5727-47a9-a758-bd24afea5994	7a27fe64-579c-4653-a395-4ead4e3860df	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
891939e5-1973-48dd-8bd7-74cc5b50866c	935f2544-5727-47a9-a758-bd24afea5994	8504d304-1734-41d3-8e1c-8e6765cbf3d9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
a06ee8de-fe8e-4993-8808-f5a9b4878dc0	935f2544-5727-47a9-a758-bd24afea5994	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
29425509-d495-4466-8364-a395eee95538	935f2544-5727-47a9-a758-bd24afea5994	5663e510-84a4-4116-86dd-dfaf709165e2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ead8d942-c19a-4775-a486-9cb69e8d71a6	935f2544-5727-47a9-a758-bd24afea5994	12663a56-2460-435d-97b2-b36c631dd62f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
08226d41-e69b-4304-a336-3a1f4c510f23	935f2544-5727-47a9-a758-bd24afea5994	11b13f4a-d287-4401-bd76-82a3b21bbbb6	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
623abe10-ce51-4af5-a9a8-3a836e890bd6	935f2544-5727-47a9-a758-bd24afea5994	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
37764218-2fc7-4296-9d0f-0045ce57dda8	935f2544-5727-47a9-a758-bd24afea5994	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
412494ff-3210-4d09-b64c-1f2829539ba3	935f2544-5727-47a9-a758-bd24afea5994	4220515f-01f8-40d5-846d-b4a7f5aa460b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
51273be6-fbb4-46b0-b381-c57fa55ac671	935f2544-5727-47a9-a758-bd24afea5994	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
62fa551e-3ce0-458a-a96c-7fc12687493a	935f2544-5727-47a9-a758-bd24afea5994	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
fc1aae1a-4643-4075-9ddf-5fe47c9e460c	935f2544-5727-47a9-a758-bd24afea5994	cd47199a-6751-4135-a27a-3d4719b9ef1a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ebff329d-85ae-42f2-8a1a-0071e8fc03c2	935f2544-5727-47a9-a758-bd24afea5994	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
1e97e397-ba65-4d0c-8223-186d225f3c81	935f2544-5727-47a9-a758-bd24afea5994	c86565cd-7ab2-4c4a-9152-f911e8eae236	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
621e9f9f-af42-4262-8733-6ade57f6614a	935f2544-5727-47a9-a758-bd24afea5994	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
8d12b6ff-6cca-479e-b59d-937592382d1e	935f2544-5727-47a9-a758-bd24afea5994	f43eb3e8-8708-4656-aae2-d21e33812610	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
1f4d833f-0568-41ca-900c-37d8e9c136fa	935f2544-5727-47a9-a758-bd24afea5994	28748534-0496-4c62-8647-6af5f01fc608	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
03448ba3-33f0-47cb-8d2a-e53d102a098f	935f2544-5727-47a9-a758-bd24afea5994	4c239c57-b3c6-4988-a698-6908b26d0e19	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
832676c9-f317-499e-92bd-40d7a60a8294	935f2544-5727-47a9-a758-bd24afea5994	493436bd-ca41-4359-8d8a-0d690ee7fc29	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
70b9e201-8f24-4437-a1c7-6a33f221e3f4	935f2544-5727-47a9-a758-bd24afea5994	fe3d87aa-c40a-468d-8e3f-239029a5919d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
12386953-e961-45f7-b5e3-8d3aa366e186	935f2544-5727-47a9-a758-bd24afea5994	b52c3226-dc94-4289-a051-b7227fd77ae8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
77e8abf9-b84c-4702-b55a-43a421810d0e	935f2544-5727-47a9-a758-bd24afea5994	7050c97c-b57f-490f-90a9-d8601fcb3852	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
21784082-5799-4b92-b456-0a4b452e2c17	935f2544-5727-47a9-a758-bd24afea5994	60fc24d8-ef72-4107-8519-429969f3a05b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
a816ad2b-a1da-4b8a-ab13-6034ba3f1b90	935f2544-5727-47a9-a758-bd24afea5994	db419a02-b502-47b6-bf78-ca8e5cc0db52	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
d48a8077-61c0-4eb7-a982-67a2ca15311a	935f2544-5727-47a9-a758-bd24afea5994	913edefa-4e9b-4792-bddf-5739e52946f3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
11c8f05c-1d16-4d78-ba71-54269d6f8c08	935f2544-5727-47a9-a758-bd24afea5994	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c37b67b0-4211-4281-984d-6d01cb45fd75	935f2544-5727-47a9-a758-bd24afea5994	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
e881909a-1cf4-4568-9b96-c131e911f47c	935f2544-5727-47a9-a758-bd24afea5994	81aabfd3-329b-4346-848b-5bea91a93fc1	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
165a3493-ab2e-46a4-93b0-8cbe263bbc63	935f2544-5727-47a9-a758-bd24afea5994	fea93ffa-2056-42bd-984d-d35e5d8999a3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
b6576aae-f558-470f-846a-9e0fa6b8dbd7	935f2544-5727-47a9-a758-bd24afea5994	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ed47c196-12de-4805-96cc-d615888f129d	935f2544-5727-47a9-a758-bd24afea5994	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c75bdb78-fa46-41b2-90cc-d688166c73aa	935f2544-5727-47a9-a758-bd24afea5994	e76be943-41ac-4c14-980c-603a3652643f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
9f67051b-fd17-4a8d-9160-c360cdaa4f5d	935f2544-5727-47a9-a758-bd24afea5994	3ce0f539-13c5-412d-8301-2ba191ea3328	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
31434bef-b4c1-4aca-bd57-5f4a4cf22628	935f2544-5727-47a9-a758-bd24afea5994	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
cd8aef48-eed2-431c-82a0-cbdcfcc40b3c	935f2544-5727-47a9-a758-bd24afea5994	623da6ff-cb25-4a58-bafa-da9088cfb606	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
f5b11c44-773c-4dc4-ac1d-c8a5cc287f19	935f2544-5727-47a9-a758-bd24afea5994	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
8a3d8898-dad8-4efc-8412-42b0939ad9fc	935f2544-5727-47a9-a758-bd24afea5994	b0ca323f-43b7-4020-b9f0-307751da0b74	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
bae38be3-19aa-48b7-ab6d-9980a0e52471	935f2544-5727-47a9-a758-bd24afea5994	1c02ee54-327e-464f-b249-54a5b9f07a95	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
f59064fe-6435-4263-8130-684a9b365730	935f2544-5727-47a9-a758-bd24afea5994	1a8acd2c-9221-47e0-92f6-35f89fa37812	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c61ebc4f-77dd-4446-8cd2-0bc71fc3436a	935f2544-5727-47a9-a758-bd24afea5994	8432f245-2bb6-4186-a3fd-607dee8bfbb3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
8efecbd6-ce70-4958-a2f3-3370cbaff26d	935f2544-5727-47a9-a758-bd24afea5994	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
b08676ac-b38e-4f59-b36b-de432b8bd05d	935f2544-5727-47a9-a758-bd24afea5994	9d0c0a31-5443-434e-ade3-843f653b13a5	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
f7550ad5-55df-40f4-8f3d-88121e7d8c8f	935f2544-5727-47a9-a758-bd24afea5994	15adee7a-c86c-4451-a862-6664e4a72332	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
d7137cc4-2d05-4f0f-92f6-d40687fb04da	935f2544-5727-47a9-a758-bd24afea5994	9871b276-3844-46c3-8564-243c81bfc26e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
cd40df5a-8e6d-46ed-b718-6063a0682c5d	935f2544-5727-47a9-a758-bd24afea5994	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
2b798ee4-35c2-41da-af85-cab6f424b105	935f2544-5727-47a9-a758-bd24afea5994	441dc9df-8866-4dcf-8f81-c8957513ddaa	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
13e8f1f5-388c-4ee4-aacb-7630b3fbd337	935f2544-5727-47a9-a758-bd24afea5994	6f57f96c-4e83-4188-95b1-4a58af42d368	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
12d4a271-98d9-451d-b85c-b5399349ebb8	935f2544-5727-47a9-a758-bd24afea5994	2e568ea8-6aab-4e76-b578-8fc44b566d00	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ab146e1f-5556-4c51-8e00-4e8c52adfd1c	935f2544-5727-47a9-a758-bd24afea5994	92ddb36f-34ee-4f99-8da8-f52d78752b40	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
72476e12-1ad4-47ad-b882-8b873899a492	935f2544-5727-47a9-a758-bd24afea5994	d2a87d3c-d4f5-4728-a702-d520d52f8efc	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
39fb0526-f836-413c-9c69-ce85ee855feb	935f2544-5727-47a9-a758-bd24afea5994	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
d15a053b-28df-45f3-a28d-de214a247d97	935f2544-5727-47a9-a758-bd24afea5994	6f00304d-9dd1-4a86-b25e-96ffc4c96245	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c5c40f83-2e91-414d-8271-dd89de9e1e3d	935f2544-5727-47a9-a758-bd24afea5994	29535a71-4da7-4d9e-8a1a-088498c25104	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
445ab10b-973a-4f5b-9ba8-627b2be92319	935f2544-5727-47a9-a758-bd24afea5994	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
1f019067-efb1-4745-b324-9f6ac49a4953	935f2544-5727-47a9-a758-bd24afea5994	53179e6b-42df-45fb-808e-06635445f0a3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
887a4270-d28c-4990-ae34-8a917140cce4	935f2544-5727-47a9-a758-bd24afea5994	01bfbc25-4974-4e1d-a039-afc1ab9350a0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
f79c52ca-f4c3-4685-8e6d-5d5a74851862	935f2544-5727-47a9-a758-bd24afea5994	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
2ca007de-27a4-4776-ba6a-38932b20c425	935f2544-5727-47a9-a758-bd24afea5994	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
ab258a32-8d59-4e06-8533-4543fa6e37e9	935f2544-5727-47a9-a758-bd24afea5994	49845113-2ada-42b3-b60e-a10d47724be3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
d04c50a8-8c1a-4a70-a00d-e9d272d8214a	935f2544-5727-47a9-a758-bd24afea5994	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
844af7ca-1727-4868-918c-9d0c27ff8fd9	935f2544-5727-47a9-a758-bd24afea5994	23525539-5160-4174-bf39-938badb0bb75	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
cd1636e9-c014-4fe8-9467-be37b88b6e0d	935f2544-5727-47a9-a758-bd24afea5994	45b02588-26f2-4553-bb6e-c773bbe1cd45	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
316f8591-4ce7-412e-8249-be9a615be2e7	935f2544-5727-47a9-a758-bd24afea5994	18bed42b-5400-452c-91db-4fb4147f355f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
3ebe4aaf-b907-48bc-bb46-98a56fd96a30	935f2544-5727-47a9-a758-bd24afea5994	5849ff0b-a440-4ab2-a389-b4acc0bf552e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
c9bda914-854a-4f60-ae02-8a8cba6a5513	935f2544-5727-47a9-a758-bd24afea5994	aba9bce3-2155-4621-b4b0-3cf669cad3b2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
7053398d-0e7a-4697-8f18-294723d7d721	935f2544-5727-47a9-a758-bd24afea5994	2dd84bba-57aa-4137-b532-5e40df1f9818	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
57cf2891-0b2c-435d-993d-11df2f2dd975	935f2544-5727-47a9-a758-bd24afea5994	02bf47ac-626f-45f7-910b-344eab76bc24	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
45ca8a94-225b-48fa-b40c-c5b97adae7f8	935f2544-5727-47a9-a758-bd24afea5994	c022b4da-2739-428a-8169-4522791ac94e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
aad872a5-7c7e-4542-94b7-9fc8c8208416	935f2544-5727-47a9-a758-bd24afea5994	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
b325f1ad-ed65-45d2-a3df-20f2705d0c4d	935f2544-5727-47a9-a758-bd24afea5994	8d49f450-e103-4b29-8e22-2e14306ae829	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
fafb7752-78a9-43bd-9fa6-28957e161700	935f2544-5727-47a9-a758-bd24afea5994	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
43bafab8-efe6-4da8-b286-be38458bd45d	935f2544-5727-47a9-a758-bd24afea5994	6b142850-4553-451e-a6cb-3cb9fe612458	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
49f1f960-0aad-444b-8fc0-06144c1ca097	935f2544-5727-47a9-a758-bd24afea5994	5029f19f-04e8-4c22-baaa-abc4410face3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
3111a3b5-25e0-4290-9883-4c058859db68	935f2544-5727-47a9-a758-bd24afea5994	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
23806e01-b4d3-45ac-a7c7-c44da52b615f	935f2544-5727-47a9-a758-bd24afea5994	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
509623fc-ff16-4320-b22b-6e6d3a1342c0	935f2544-5727-47a9-a758-bd24afea5994	3a237a3a-4394-48e9-87c4-334c87d1b6a1	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
a0888c55-5acd-47c5-b08f-29de29987d5c	935f2544-5727-47a9-a758-bd24afea5994	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
2842fe02-0472-4d86-b987-1ceec8ac8ab2	935f2544-5727-47a9-a758-bd24afea5994	00160b54-fdf1-48d1-9b52-52842dc8df4e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
5eceeb6a-4b1a-4bcb-a831-69fef97d8be8	935f2544-5727-47a9-a758-bd24afea5994	29e9b502-fde8-4a8f-91b6-ff44f8d41479	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
75117851-5728-4355-abb8-1be0222833fb	935f2544-5727-47a9-a758-bd24afea5994	ca6e0150-9d34-403c-9fea-bb1e35d0e894	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.471	2026-01-28 19:46:36.471
8729deb7-7000-40a8-810f-22e7eb9f13e3	935f2544-5727-47a9-a758-bd24afea5994	16743e3d-672d-4584-9a3c-5d76ae079569	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
c8dea87d-76d3-4b82-b509-45c8539e10ed	935f2544-5727-47a9-a758-bd24afea5994	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
e833e183-7fed-4f8e-a749-713ddead8e6b	935f2544-5727-47a9-a758-bd24afea5994	372b482c-fcb8-405d-a88a-5d2ee5686e30	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
cb661087-4fb4-4728-96cc-a19701719582	935f2544-5727-47a9-a758-bd24afea5994	c47cf3e0-e149-4834-b454-5fd4d583a1a7	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
85615f2f-aeb1-419f-a352-83ec228a5da1	935f2544-5727-47a9-a758-bd24afea5994	d7b7595d-a831-48ec-84d4-39476bc3e44a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
a8b9a3d7-2c17-4a49-9d88-3a3ec9fe2ff5	935f2544-5727-47a9-a758-bd24afea5994	0690e264-ed8b-48b3-8930-5651eebe2e2e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
864370b7-fcc9-476d-8445-3955daef122d	935f2544-5727-47a9-a758-bd24afea5994	b969a964-3765-4744-8080-3e2c88ab688e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
9baf935d-2974-4bc3-8a40-99d5c22c39d6	935f2544-5727-47a9-a758-bd24afea5994	6750bd19-7115-4966-b7db-0d8e2add036a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
56420971-9d1a-462f-bfde-6a45e3e6e910	935f2544-5727-47a9-a758-bd24afea5994	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
2608afa2-fdc2-4502-9009-4bf12f1e4112	935f2544-5727-47a9-a758-bd24afea5994	2afa78a2-892a-4dfb-9098-7926491b648f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
0eacf847-cbb1-4018-8621-1ac0550ecd22	935f2544-5727-47a9-a758-bd24afea5994	374edfb0-e4ae-4625-af63-a14d4cb48f9b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
bb29018f-a66d-4a9e-9277-44b585e63b0c	935f2544-5727-47a9-a758-bd24afea5994	d9f8f427-d02c-4a3a-9091-0a442685cf72	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
fb10a8d2-9e9a-4c2e-8e5b-442d936b79f9	935f2544-5727-47a9-a758-bd24afea5994	9b28e1e2-badb-4a9d-88d4-84f5612934e5	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
5fdd93a8-240a-41a3-ab81-f956fad90d8f	935f2544-5727-47a9-a758-bd24afea5994	d4b1799f-245c-44e7-bc89-1eec59a28c9c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
fcb158a2-792a-4477-bcdc-0c54cd35ced9	935f2544-5727-47a9-a758-bd24afea5994	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
1ae32676-da63-4d6b-a149-16974138e116	935f2544-5727-47a9-a758-bd24afea5994	1a810543-4218-41a4-90ba-9e3743f077fa	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
bd97e7a3-b0ee-4f2f-9df8-3004bffac890	935f2544-5727-47a9-a758-bd24afea5994	09827071-8a30-42ac-898c-59a6fe9f0c75	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
2bd61ad5-6534-4e0b-86e7-cce279bbc955	935f2544-5727-47a9-a758-bd24afea5994	59996c9e-0bc9-4120-bee1-3f0455f81725	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
cb9b0cc8-d0e7-406f-9aee-bc2694768e14	935f2544-5727-47a9-a758-bd24afea5994	d36af823-920c-47ab-965e-4ab698621052	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
7c36289c-be5c-4b65-9855-220f7855af5c	935f2544-5727-47a9-a758-bd24afea5994	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
eab86ea2-3d8e-43d0-ab0d-559e91b260b4	935f2544-5727-47a9-a758-bd24afea5994	2d3e7958-5f64-4312-abe6-0af811e901c3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
6bdddb4c-6700-4b8c-91bd-929fb697b82a	935f2544-5727-47a9-a758-bd24afea5994	92b916e1-6a0b-4498-9048-3901b27bec39	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
ddc9c1c8-8ea6-447b-845b-8c4a534e793a	935f2544-5727-47a9-a758-bd24afea5994	7f87bc22-635b-416a-8722-53c1ee704f0c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
f92ae1c4-85d9-46c6-8fc8-73efffb1b304	935f2544-5727-47a9-a758-bd24afea5994	d65b2853-a79d-401a-8f05-adf2743b9162	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
85cbb822-c63f-462f-8a00-7d76fb75ca7e	935f2544-5727-47a9-a758-bd24afea5994	5f946046-e498-403d-a64a-6933c7bd6896	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
015f2306-5e2b-4f13-b005-c2f517d8dbf3	935f2544-5727-47a9-a758-bd24afea5994	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
6e85cb91-0a12-4ea8-89d1-b4612bd0a113	935f2544-5727-47a9-a758-bd24afea5994	c6db06ec-612a-4dc3-bbc6-7c153e90994c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
b874b461-c0e6-42f2-b675-8d86833c297f	935f2544-5727-47a9-a758-bd24afea5994	f410965b-b444-4df5-bfd6-e138109567a0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
c4986f2d-9420-4739-9d34-7842b6f8344a	935f2544-5727-47a9-a758-bd24afea5994	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
f69552db-11af-4f01-b5f1-98f1e10732ad	935f2544-5727-47a9-a758-bd24afea5994	edccde66-49d6-459e-94e7-02b99477d24c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
e174e79b-e720-4da5-a360-8d12b508b9db	935f2544-5727-47a9-a758-bd24afea5994	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
af3cc1c4-d480-4507-b81c-0d8cb985f457	935f2544-5727-47a9-a758-bd24afea5994	f3da6061-0490-40ac-bdec-10e862ef1296	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
f4873c57-c343-414d-b303-4853d9b08c2c	935f2544-5727-47a9-a758-bd24afea5994	8e9ff64e-0787-4e03-9835-e833ca96ed46	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
45a5cd3e-29ee-4f92-a178-53cf0fedd189	935f2544-5727-47a9-a758-bd24afea5994	b54125c1-a96c-4137-9e7a-c197421d99b3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
3b332cc9-c300-4548-9ef8-1b77e13e5313	935f2544-5727-47a9-a758-bd24afea5994	bebb0636-e19e-40a8-8733-18aa11ba1e13	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
14cd4892-74a9-4432-827a-c3a3c114cd58	935f2544-5727-47a9-a758-bd24afea5994	6432d484-b4a5-427f-a12a-59303f1e50ee	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
65742bf0-c2c1-4a74-b23e-a8ba5e83e19e	935f2544-5727-47a9-a758-bd24afea5994	4f96dd8e-6915-481e-aebb-672f83b45aa1	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
ab51f74b-e392-4ffc-8e6c-0c0a24565d02	935f2544-5727-47a9-a758-bd24afea5994	88f85444-56fd-4596-a6f3-84e3dde28513	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
db5fbd17-c3ea-4bff-9a88-8a75f4eb8763	935f2544-5727-47a9-a758-bd24afea5994	0953b49f-6af7-4347-a249-24c34997bf1d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
5bcca9c1-9e0d-4b4b-abe8-9fcc3faf1dab	935f2544-5727-47a9-a758-bd24afea5994	0d33577d-027b-4a5d-b055-d766d2627542	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
ef1d11b7-8214-4afa-9fd7-20de1753bb1a	935f2544-5727-47a9-a758-bd24afea5994	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
c2d3a35d-3a03-4258-a0f9-8878be61575e	935f2544-5727-47a9-a758-bd24afea5994	02932d66-2813-47b0-ae40-30564049a5ef	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
efa035b7-da10-4a76-9a81-ac882ec5744b	935f2544-5727-47a9-a758-bd24afea5994	a4ccc274-2686-4677-b826-95e0616f156d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
1bd6900b-53ce-45c3-8efc-906a72a83d1d	935f2544-5727-47a9-a758-bd24afea5994	a04fc678-94ae-42bb-b43b-38ce17d30faf	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
147f4f18-4f85-43e0-b840-e57a28be14f9	935f2544-5727-47a9-a758-bd24afea5994	1a8f1b99-a206-48d9-8170-23814b72c4cc	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
a7884fab-e671-48be-815a-c930c6d24143	935f2544-5727-47a9-a758-bd24afea5994	295fd56c-315c-4c82-9e20-fb571f376ddd	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
a0a6fae4-d7f2-4159-8aa6-71d2269373c6	935f2544-5727-47a9-a758-bd24afea5994	a0099cf4-5479-4475-a86b-2f3d67995db8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d24e68f7-e59c-4867-830c-0f64481d2899	935f2544-5727-47a9-a758-bd24afea5994	dfbc0a35-28c7-4077-b9e6-08f3413ad130	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
328044b2-266c-4481-b604-1b63d451f15e	935f2544-5727-47a9-a758-bd24afea5994	47dcd774-7cbf-4a87-94df-369d0abf9232	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d784f898-4764-4e57-92aa-5da7a318cf01	935f2544-5727-47a9-a758-bd24afea5994	d2d84e05-c829-4c67-acec-3632e5f6515a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
1335cf19-6f04-44f1-8149-4b965c11d7fc	935f2544-5727-47a9-a758-bd24afea5994	0a421a5e-ad04-43ab-a539-2644d3ddabb0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
b6b6120d-8d67-4085-baea-31da623b2948	935f2544-5727-47a9-a758-bd24afea5994	f8705655-8e50-4159-b738-efdb7c92de1f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
aeec59ff-b065-471e-8101-4da54523c6cd	935f2544-5727-47a9-a758-bd24afea5994	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
8c06b75a-c541-4470-8454-bc5d9f7a3149	935f2544-5727-47a9-a758-bd24afea5994	81e51f8b-500d-4366-9360-3450dfa5ee4d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
91c6e040-0057-4875-af99-ba922d0f2260	935f2544-5727-47a9-a758-bd24afea5994	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
68654686-a2b7-4023-881d-3c864271123b	935f2544-5727-47a9-a758-bd24afea5994	9297daf6-1431-4b62-9039-2ee22dcbba29	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
3ec1c31e-9f87-4465-ac29-7e9d21858f4b	935f2544-5727-47a9-a758-bd24afea5994	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
dddb9eef-ad1f-45bf-ab0a-d0c8602d05d0	935f2544-5727-47a9-a758-bd24afea5994	f34e06ee-82cc-4a62-bd17-947c58f42116	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
b0f6dc00-acde-4c5c-b69d-7668a4805873	935f2544-5727-47a9-a758-bd24afea5994	38ccc597-1f09-4de4-ad38-b9cddd2256c3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
11a70e38-1180-42ad-bfca-b3e2ca6bcec9	935f2544-5727-47a9-a758-bd24afea5994	70e897f5-c029-4382-9778-de9aa02b85d7	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
b65e01fa-a3c8-47e2-b579-892cf5f758f2	935f2544-5727-47a9-a758-bd24afea5994	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
471d1590-eb33-402f-a43c-0ea3104e4bdf	935f2544-5727-47a9-a758-bd24afea5994	834f193e-7023-48a7-bc8e-58a910845d6b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
0e2ff509-a099-488d-98a7-537f0482a261	935f2544-5727-47a9-a758-bd24afea5994	e90ca965-4a55-433d-83c8-9de44b168b9c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
bde151d0-278f-4372-9091-30dcd8b29796	935f2544-5727-47a9-a758-bd24afea5994	e8d65387-e415-4e52-bf95-4cf7134e2235	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
88fbfbad-d1cb-4dc3-8e88-074dd22bc00c	935f2544-5727-47a9-a758-bd24afea5994	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
0f4a91f6-c8aa-4cdc-82f9-44c4e935978c	935f2544-5727-47a9-a758-bd24afea5994	66177523-edef-4bb4-9e47-1db421e14257	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
e5f58f1c-fde5-45e4-af0a-2c7f30e2fb36	935f2544-5727-47a9-a758-bd24afea5994	fcd820ab-6f42-4794-8e6a-217faa6017ac	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
92cce0d2-7eeb-4e48-b8a9-8ffd9d823c51	935f2544-5727-47a9-a758-bd24afea5994	172fe5c4-06a1-435e-86e1-50a717ff1505	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
8bae002f-367f-4abc-b21b-9d8237f0522f	935f2544-5727-47a9-a758-bd24afea5994	52fa7c54-7266-459b-b679-a4a0966dcca2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d5aaf773-d200-4444-9b62-d0f8464dfb04	935f2544-5727-47a9-a758-bd24afea5994	ad04836f-3c39-4de5-ba1d-171dded4420b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
21a058f4-5e75-41ba-94de-6c31d01d8211	935f2544-5727-47a9-a758-bd24afea5994	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
ee11d355-e528-418b-b7ca-2ff7d96fae08	935f2544-5727-47a9-a758-bd24afea5994	9fab0497-b7b0-43af-8c94-ac59cf2d504a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
048b9333-4047-4d32-a7bd-c0a01d2e0ff5	935f2544-5727-47a9-a758-bd24afea5994	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
cb783c17-3e8b-4077-87fb-a0aaf29144b6	935f2544-5727-47a9-a758-bd24afea5994	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
fdba0696-2285-4433-986e-be28e8f9b231	935f2544-5727-47a9-a758-bd24afea5994	2069bcb9-4a3d-4462-8860-e39fe7327d4f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
eb972361-4838-4ff0-869c-e39709656246	935f2544-5727-47a9-a758-bd24afea5994	4b0170c2-6403-45f2-a9be-25e61595b48e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
04730eed-9350-4995-b737-708a32d5689b	935f2544-5727-47a9-a758-bd24afea5994	db94e4b5-77ae-4459-8494-e31443458d7a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
6f60b238-b3d7-4210-9061-8166ae698b53	935f2544-5727-47a9-a758-bd24afea5994	fb7e9280-2b6f-429c-be0c-e4fa204755f8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
2bcc6c08-4108-4ae6-8955-5cbd1ee2bdc9	935f2544-5727-47a9-a758-bd24afea5994	9c06ea4c-d311-4249-a91e-09c14c66786a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
ff0773a5-0a01-4711-b596-6822b8faa362	935f2544-5727-47a9-a758-bd24afea5994	38c264c0-26f6-4929-a52c-2277e2aaccce	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
7f8f07ee-c830-4927-bdf1-5458660b1911	935f2544-5727-47a9-a758-bd24afea5994	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
653b4096-ea09-4d35-bcac-a8326e70e10e	935f2544-5727-47a9-a758-bd24afea5994	1042f63e-2ebf-492c-87e8-2b7bdc69150d	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
f24567f5-dbad-4c53-abec-14308db82c05	935f2544-5727-47a9-a758-bd24afea5994	7c469d95-9f01-4295-ab59-fd3698ed7a36	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d12ccbb5-0023-440e-b82c-8cfa43f26ad5	935f2544-5727-47a9-a758-bd24afea5994	8d3556d9-f508-4a55-9f48-5c1aebc59de9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
93b2a344-5427-41d8-a269-55a5f800adf5	935f2544-5727-47a9-a758-bd24afea5994	04c59caf-4541-4e15-8c6e-d4a435967ef4	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
447182c8-9a9e-4154-b839-50d0984425d4	935f2544-5727-47a9-a758-bd24afea5994	ade77569-3a72-4030-b2b4-11814fdd6b0a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
cb24144e-fe88-441a-9fef-f97553963044	935f2544-5727-47a9-a758-bd24afea5994	8bd68779-d3a5-4372-b932-598273b735ef	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
fef2f749-ddba-41dd-a241-7950116d4c44	935f2544-5727-47a9-a758-bd24afea5994	251ebe60-b752-4467-aa22-0d46d5ae4953	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
e2e1726a-71a0-45c6-89ae-0c1fcdef3276	935f2544-5727-47a9-a758-bd24afea5994	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
c0ad639f-c8d9-40ce-8887-df9aa0caf3b6	935f2544-5727-47a9-a758-bd24afea5994	9b0f7458-981e-4a78-9cc1-969130cfb358	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
132c42e1-2e68-4ef8-80b9-79c1a15e501c	935f2544-5727-47a9-a758-bd24afea5994	36ea8942-d4e1-44ed-a36c-33fb6e715560	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
8bd263a3-ed01-4aa4-8633-6ff7743c8ea4	935f2544-5727-47a9-a758-bd24afea5994	c4944fca-068f-4ab5-8b9d-3b2493d785f2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
9f25f8b7-9594-46c6-ad7c-498477dfd462	935f2544-5727-47a9-a758-bd24afea5994	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
543eb72e-37b6-43a3-b628-da497f005452	935f2544-5727-47a9-a758-bd24afea5994	c2066743-efa9-40b6-94b9-5b2b6e0942f3	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
aaecb521-5ebb-455b-8edb-ceb86d184041	935f2544-5727-47a9-a758-bd24afea5994	5def1949-7a28-4715-8427-6cb028048712	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
15b27fa5-9eac-456a-9967-2bf39bfda76f	935f2544-5727-47a9-a758-bd24afea5994	add83dad-b55a-4e07-ab2f-9c1828f310e6	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
84177ca1-87ad-4888-8215-f833e589adc3	935f2544-5727-47a9-a758-bd24afea5994	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
908861b9-75bb-45b2-9179-90f4f3144518	935f2544-5727-47a9-a758-bd24afea5994	1a73dfdb-7333-4239-a6a6-7863010a6953	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d704bcc5-845a-4b12-b783-057b83cae83b	935f2544-5727-47a9-a758-bd24afea5994	635f7357-f443-4723-994f-7a81dd5d165f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
cabb5af6-a09f-4d32-8a07-becdc89d51c4	935f2544-5727-47a9-a758-bd24afea5994	1a291f0f-1525-4815-ba48-67acaf27dd7a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.482	2026-01-28 19:46:36.482
d877aa70-3106-4f78-ac68-8c137af0f5c5	935f2544-5727-47a9-a758-bd24afea5994	d2f92a82-754c-4dbf-9297-8222e71b7573	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
e7917bcb-e623-4216-9db6-e92ac5d3d76d	935f2544-5727-47a9-a758-bd24afea5994	aec1a837-c291-452c-9ac6-425d9f9dca36	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
4f1be59f-34d7-4947-8816-15131fdbc3c3	935f2544-5727-47a9-a758-bd24afea5994	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
fd9fd3aa-d15c-463d-8d52-aa39f5bce160	935f2544-5727-47a9-a758-bd24afea5994	81cf9d60-063d-4054-8277-0fc6eaa042ee	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
8400b451-29b0-47db-b65f-4da46da4c279	935f2544-5727-47a9-a758-bd24afea5994	11859bb3-3249-4b3b-bc93-2236f608ff1e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
491b4b66-2aef-4112-ba91-4d77af722cec	935f2544-5727-47a9-a758-bd24afea5994	4e6637ef-7d36-459a-9cf9-bd485e521443	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
6d4f09d3-7d99-4ca5-aa52-a875d30f55f0	935f2544-5727-47a9-a758-bd24afea5994	1e00e441-4e0a-4c95-a147-d5ba83dc7883	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c87d56fc-fed2-418e-8c99-3daac3de2a3f	935f2544-5727-47a9-a758-bd24afea5994	2af622c9-671a-4992-8b66-085781d11864	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
63af5229-3fe4-4f88-8a6c-4cf40e86dd16	935f2544-5727-47a9-a758-bd24afea5994	fda4281b-edb1-4bc4-8b80-86653209240b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
17d0308f-6a45-4f1f-b4fc-9e5d4550488e	935f2544-5727-47a9-a758-bd24afea5994	1ad39315-d1f4-4655-84f0-db922eac7e1f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
060230c7-8f42-464c-8130-ff73cd52b5da	935f2544-5727-47a9-a758-bd24afea5994	6bda2acd-5f00-4100-b31a-0de28d40a7c0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
32c9c7c9-7d61-4eb3-9d2b-9ab3c5fea5fb	935f2544-5727-47a9-a758-bd24afea5994	29569e45-ea36-4138-83a3-80b85ba9ba1a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
b76197d8-eabb-46d9-9662-acb133cc5bb5	935f2544-5727-47a9-a758-bd24afea5994	37afad6a-c579-4b34-8042-c3aa708227b9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
1f1b92b5-fc5e-4231-893f-e1342e93c425	935f2544-5727-47a9-a758-bd24afea5994	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
86e28fa5-acd7-42b9-8432-5516628b63d6	935f2544-5727-47a9-a758-bd24afea5994	c4233e6e-d7a3-4018-aff0-5415b06ef15b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
59c07ef5-aab2-4a4f-b1dc-6c35515e836f	935f2544-5727-47a9-a758-bd24afea5994	c93e39fe-759b-4db1-bd9a-230c1f930a7a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
72ba7cb7-7911-4e4e-9082-09536729761c	935f2544-5727-47a9-a758-bd24afea5994	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
1fd0764e-98bb-4406-9f97-cff0af794ce9	935f2544-5727-47a9-a758-bd24afea5994	583c470c-9284-4b66-a009-81ffab8bda1a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
86a4ad22-46c9-49be-91d9-3bc7443fceb8	935f2544-5727-47a9-a758-bd24afea5994	6c387ed5-533e-4d6c-915f-72a85bc28c14	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
1b2390fe-19fe-4633-8acd-3c304a75433a	935f2544-5727-47a9-a758-bd24afea5994	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
f32e1798-dc6a-4e45-a748-8d244479517c	935f2544-5727-47a9-a758-bd24afea5994	90a8f117-bde3-4070-8165-95116ddb6c78	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
50ae27f7-0b71-422c-b960-fc0e561e22ed	935f2544-5727-47a9-a758-bd24afea5994	78331efc-59a3-49c6-a4da-cd971800b07b	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
f3f41449-3c0b-431b-84aa-c7030533f4d1	935f2544-5727-47a9-a758-bd24afea5994	10cd0a5a-934b-4541-900f-61c5400cb33e	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
93dd48b6-e211-486c-a83c-98925dfe645a	935f2544-5727-47a9-a758-bd24afea5994	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
df25fe39-c56f-45a5-b212-634690a269f2	935f2544-5727-47a9-a758-bd24afea5994	9c6b3dbf-9144-4d72-9c8c-c9984731beec	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
9d742fcb-d43d-4418-8c01-5afe4f3caba6	935f2544-5727-47a9-a758-bd24afea5994	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
a8220f28-d84e-4ffb-8f86-555c82014a42	935f2544-5727-47a9-a758-bd24afea5994	d9295f16-be88-4756-8f6e-1cf4764be20a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
8df1dcaa-1f71-40aa-858f-4b4ee6a2f665	935f2544-5727-47a9-a758-bd24afea5994	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
5da985de-4d10-416d-a2e8-bbee3f10d653	935f2544-5727-47a9-a758-bd24afea5994	e67b4538-7412-45c0-a0cf-e27bff88caab	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
1a265b9d-aaad-4294-b097-82f60499be4a	935f2544-5727-47a9-a758-bd24afea5994	b24c16bb-ff27-4814-b9d7-523fd69d9b41	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
67b0e926-e401-41fe-aebf-e1c2816b6086	935f2544-5727-47a9-a758-bd24afea5994	1cb61161-23ca-4336-806e-61086d967a67	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
a4b47880-0322-46d5-99d6-20a052435f23	935f2544-5727-47a9-a758-bd24afea5994	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
787899fe-9a18-4e4a-96e0-978813fbff8c	935f2544-5727-47a9-a758-bd24afea5994	278cade5-e251-4520-9394-cdd42c9212e6	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c95b634a-d1e6-46cb-bf5a-68378f190268	935f2544-5727-47a9-a758-bd24afea5994	b5966924-f09e-4024-8942-8f2e00949567	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ee55cc12-66ed-4c33-904e-9d05901182ab	935f2544-5727-47a9-a758-bd24afea5994	d1627009-fe55-469a-baf7-1a8b4979d654	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
0b63c33c-8af5-408d-9517-2be4836601ed	935f2544-5727-47a9-a758-bd24afea5994	f5804675-69c7-4b68-9dc6-22dea1f5201a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
5bc3c044-088e-459b-a116-c63c9e07b304	935f2544-5727-47a9-a758-bd24afea5994	4a7446ad-a670-4e50-82dd-e71d2013d520	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c3c34a02-5987-4f45-9d53-47efbb1932b4	935f2544-5727-47a9-a758-bd24afea5994	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ff13142d-8194-4b20-9fda-83d5366b1729	935f2544-5727-47a9-a758-bd24afea5994	6915f34b-6468-4e75-a1d9-dbeee0529cb8	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
25488237-a05c-4f3f-a609-9c58937991fe	935f2544-5727-47a9-a758-bd24afea5994	e4778ab5-7678-46d9-baea-0368e4f812f0	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
9fc25fe5-e286-4b58-bac2-054667293a31	935f2544-5727-47a9-a758-bd24afea5994	cf4be8bf-0906-4925-8291-6c8c785dcef4	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
72d5ed1c-ea70-44a3-8293-1752b10c4237	935f2544-5727-47a9-a758-bd24afea5994	0b038769-9d16-464d-85e6-fed33a40579a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
8df49e6b-158b-47c7-8946-fe88b53c1c7f	935f2544-5727-47a9-a758-bd24afea5994	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
bc11245b-fa47-414e-899e-bd13a89d9236	935f2544-5727-47a9-a758-bd24afea5994	027e9c43-d25b-4cb5-b4c9-916084271623	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
56de52d0-4325-48e0-ad60-f1d1ed1c02f6	935f2544-5727-47a9-a758-bd24afea5994	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
4e979fc7-4277-4962-b634-f0a9e7d5a2ea	935f2544-5727-47a9-a758-bd24afea5994	7d0f9dbd-4909-491d-9440-5f87bca5a254	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
24c85e7f-cbde-4ad0-899c-61d841e37554	935f2544-5727-47a9-a758-bd24afea5994	aa0a06e7-d580-47b2-bc2e-cddd466186cb	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
47dc01b2-e17f-4265-a437-d478a08b5101	935f2544-5727-47a9-a758-bd24afea5994	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
59ca5772-d44f-464a-8923-bf8bae7ee3d0	935f2544-5727-47a9-a758-bd24afea5994	fa0dcd21-865b-4de3-a315-83af78061b4a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
f85ca09c-657c-4396-9d9c-5505fb9e9046	935f2544-5727-47a9-a758-bd24afea5994	69b81a70-6fa3-4533-9d00-c252f0f6245f	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
2bbada1f-1a34-4a6c-bb2b-2ac72d9ef37b	935f2544-5727-47a9-a758-bd24afea5994	360b9bee-d159-4e20-ba1f-9681d17cf9bc	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
d4ab998c-3cb1-48db-86cd-52991903feba	935f2544-5727-47a9-a758-bd24afea5994	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c652d8cf-9833-4ed8-a4b2-5ccbcb31a12c	935f2544-5727-47a9-a758-bd24afea5994	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
4ea2a4df-3959-4d90-a80b-546809197ba2	935f2544-5727-47a9-a758-bd24afea5994	b19145e9-2513-41c3-b2a7-719588692eed	5ea29387-6d88-43e4-aaa8-481937d22b9c	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
e82ac7a9-3b1a-420d-92da-09aead35affa	935f2544-5727-47a9-a758-bd24afea5994	e6fffac1-4aad-4ce4-9981-3983dde344d3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
337825f5-eb37-4556-8c05-14817d5b137d	935f2544-5727-47a9-a758-bd24afea5994	32c804e1-e904-45b0-b150-cdc70be9679c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c8d057b8-406d-47ff-8413-cc88aca50573	935f2544-5727-47a9-a758-bd24afea5994	16d101ea-c92f-44b0-b7dc-11cd3680215c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ff0fc4e2-3410-41af-ad5f-1b080751adac	935f2544-5727-47a9-a758-bd24afea5994	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
9c1ffa53-d9cb-4c6f-985d-1e0d114493b2	935f2544-5727-47a9-a758-bd24afea5994	778ec216-a84f-41c7-a341-9d04269f0dc6	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
f6cbc5b8-e7fa-4b37-bf15-469438e477f2	935f2544-5727-47a9-a758-bd24afea5994	ed459bf2-7e56-4eca-bc6b-cee6655c644a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
d3e42180-9cf3-482c-91f4-5b49df5c9734	935f2544-5727-47a9-a758-bd24afea5994	9f38de93-8d44-4760-9152-372666596d56	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
61b54406-391b-4694-b2af-8e229a5757ad	935f2544-5727-47a9-a758-bd24afea5994	eadf502a-97e3-44fc-b07c-0f7015cb598a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
dd8867dd-0991-4429-a690-ca9e883dadb6	935f2544-5727-47a9-a758-bd24afea5994	c21d204c-4660-41e7-93c8-d895ddbaab26	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
fe7dfcac-0e6c-483d-9c8d-26fbbbb7a6fe	935f2544-5727-47a9-a758-bd24afea5994	31dec1f6-7abb-4742-ade1-42b89ad7766a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
16773133-d1d4-4be4-9b04-e1f857d480d0	935f2544-5727-47a9-a758-bd24afea5994	b182931c-6229-4be3-bde7-ef6126032f52	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
4775896b-aad6-42f4-a6f3-acf3e7d8d0f2	935f2544-5727-47a9-a758-bd24afea5994	93421fdb-364d-418e-898a-a1f62dd8020a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
da102473-bd7a-4463-939b-1c8b16775a86	935f2544-5727-47a9-a758-bd24afea5994	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
35949e0b-a94d-423c-9b9b-252389b42b9c	935f2544-5727-47a9-a758-bd24afea5994	071a36ac-c2e2-4462-b10d-3175b101bd06	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
3852430c-72a6-4800-81c8-676eac8bea09	935f2544-5727-47a9-a758-bd24afea5994	734f6aa9-6ade-4187-b3b3-2cba78068a34	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
41642cf0-0781-4402-a68f-e0eb99823a92	935f2544-5727-47a9-a758-bd24afea5994	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
d5a5b273-9584-435d-825e-5796fe3c9661	935f2544-5727-47a9-a758-bd24afea5994	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
db68e806-40a4-43a1-9b47-9fabbbedcb60	935f2544-5727-47a9-a758-bd24afea5994	32898e2d-148e-4483-9e74-6fca3a3eed62	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
8129ca7b-4723-433f-90c4-0bf2adbb0118	935f2544-5727-47a9-a758-bd24afea5994	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
15f9c289-11ca-4f05-88a3-83c7b3c983ef	935f2544-5727-47a9-a758-bd24afea5994	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
6aa605a5-b942-41a2-a7b2-c7cbecdf05bb	935f2544-5727-47a9-a758-bd24afea5994	7a27fe64-579c-4653-a395-4ead4e3860df	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
5028e585-6c12-4810-a273-5f8b31d3079c	935f2544-5727-47a9-a758-bd24afea5994	8504d304-1734-41d3-8e1c-8e6765cbf3d9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
5b2e5e61-4665-4550-9303-f6147e50a96f	935f2544-5727-47a9-a758-bd24afea5994	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
9ce6d552-670d-40c4-955a-c4924496c6f5	935f2544-5727-47a9-a758-bd24afea5994	5663e510-84a4-4116-86dd-dfaf709165e2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
87eb768b-2b74-44f8-a60b-39e7d2ce9f0d	935f2544-5727-47a9-a758-bd24afea5994	12663a56-2460-435d-97b2-b36c631dd62f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
981dc7a9-24d1-4e10-9d3f-3336aa893f74	935f2544-5727-47a9-a758-bd24afea5994	11b13f4a-d287-4401-bd76-82a3b21bbbb6	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
4fdfd170-56c1-48b1-98d0-23b1d208dec1	935f2544-5727-47a9-a758-bd24afea5994	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
02528efb-6222-4f4d-900e-f16ef727c388	935f2544-5727-47a9-a758-bd24afea5994	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ab61f361-cff6-40d8-b3c3-58a465813c3a	935f2544-5727-47a9-a758-bd24afea5994	4220515f-01f8-40d5-846d-b4a7f5aa460b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
13b0c811-4c9e-49f5-b177-9bbaedaea4e9	935f2544-5727-47a9-a758-bd24afea5994	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
de5d029d-27b8-40ae-a948-5b0024a4ddaa	935f2544-5727-47a9-a758-bd24afea5994	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
8de7480f-30cc-4969-818a-7b89b66d4c68	935f2544-5727-47a9-a758-bd24afea5994	cd47199a-6751-4135-a27a-3d4719b9ef1a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c810e763-a883-42ce-8dfb-1073d6167ee2	935f2544-5727-47a9-a758-bd24afea5994	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
3f140c4b-bcf8-4eea-9505-ac33d4a6e18d	935f2544-5727-47a9-a758-bd24afea5994	c86565cd-7ab2-4c4a-9152-f911e8eae236	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
c3e50768-5a3e-4ee4-8045-d89ac2c7bb4a	935f2544-5727-47a9-a758-bd24afea5994	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
d7d0f91d-ebec-4375-9708-98c8e77bf9c7	935f2544-5727-47a9-a758-bd24afea5994	f43eb3e8-8708-4656-aae2-d21e33812610	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
6031a020-e1fb-4692-9712-dd0e97219239	935f2544-5727-47a9-a758-bd24afea5994	28748534-0496-4c62-8647-6af5f01fc608	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ebe0be18-0787-4634-81f3-28c1d165d990	935f2544-5727-47a9-a758-bd24afea5994	4c239c57-b3c6-4988-a698-6908b26d0e19	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
634b7a59-734d-4641-be3d-7759343adce5	935f2544-5727-47a9-a758-bd24afea5994	493436bd-ca41-4359-8d8a-0d690ee7fc29	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
cd4da33b-e69b-4bac-b367-a848b9b7f5f0	935f2544-5727-47a9-a758-bd24afea5994	fe3d87aa-c40a-468d-8e3f-239029a5919d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
ec2d43c9-cd7a-4e7e-8956-5fc402d6ab08	935f2544-5727-47a9-a758-bd24afea5994	b52c3226-dc94-4289-a051-b7227fd77ae8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
a7fd3bdc-3c5e-417e-9482-8c7d4ee0b26f	935f2544-5727-47a9-a758-bd24afea5994	7050c97c-b57f-490f-90a9-d8601fcb3852	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
920a4b8c-adc5-4165-ab18-f457fbd608d9	935f2544-5727-47a9-a758-bd24afea5994	60fc24d8-ef72-4107-8519-429969f3a05b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
42f67239-8f57-425d-aaf2-f6b3a6c40d56	935f2544-5727-47a9-a758-bd24afea5994	db419a02-b502-47b6-bf78-ca8e5cc0db52	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
59d70efd-efb9-4ddb-8f4b-6197bc7ca692	935f2544-5727-47a9-a758-bd24afea5994	913edefa-4e9b-4792-bddf-5739e52946f3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
3a2d385d-ab37-4278-943f-ed1d536a39ab	935f2544-5727-47a9-a758-bd24afea5994	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.49	2026-01-28 19:46:36.49
a989933f-811d-44ef-afeb-a9b9e29e6508	935f2544-5727-47a9-a758-bd24afea5994	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
6e461aef-617d-4d6a-b5c5-6d50ace9d3af	935f2544-5727-47a9-a758-bd24afea5994	81aabfd3-329b-4346-848b-5bea91a93fc1	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
6c5bfaff-1f16-4834-a20e-cabb34263e0e	935f2544-5727-47a9-a758-bd24afea5994	fea93ffa-2056-42bd-984d-d35e5d8999a3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
9f290af4-6f90-4543-84e1-59722f01ed71	935f2544-5727-47a9-a758-bd24afea5994	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
c0771360-60a5-4f33-a70e-f24299eef794	935f2544-5727-47a9-a758-bd24afea5994	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
22943ba0-7e30-4721-8718-ffd81dc7a210	935f2544-5727-47a9-a758-bd24afea5994	e76be943-41ac-4c14-980c-603a3652643f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
2c1865ee-0f93-47b2-9ce5-e76ee2862861	935f2544-5727-47a9-a758-bd24afea5994	3ce0f539-13c5-412d-8301-2ba191ea3328	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
a70d7350-64da-4a3a-a460-eca3d100c9a2	935f2544-5727-47a9-a758-bd24afea5994	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
52c8ca65-a3d3-404a-bfbb-ff6c220dedfc	935f2544-5727-47a9-a758-bd24afea5994	623da6ff-cb25-4a58-bafa-da9088cfb606	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
40056181-b87f-491a-b22c-e5596bcddf6e	935f2544-5727-47a9-a758-bd24afea5994	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
4be3a083-4e23-4d06-be49-983f2c51c047	935f2544-5727-47a9-a758-bd24afea5994	b0ca323f-43b7-4020-b9f0-307751da0b74	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
68f922be-7801-4f12-8a6a-ea0af81247b9	935f2544-5727-47a9-a758-bd24afea5994	1c02ee54-327e-464f-b249-54a5b9f07a95	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8fc977c4-7515-47b0-90ce-b2f0393286cd	935f2544-5727-47a9-a758-bd24afea5994	1a8acd2c-9221-47e0-92f6-35f89fa37812	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8988e107-f836-4612-878b-a453a45e9c67	935f2544-5727-47a9-a758-bd24afea5994	8432f245-2bb6-4186-a3fd-607dee8bfbb3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
d1a3f82f-cfb1-47a8-b7e1-2910989af885	935f2544-5727-47a9-a758-bd24afea5994	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
cf0bb669-6f07-42a1-b1a3-b10a9e0db6c0	935f2544-5727-47a9-a758-bd24afea5994	9d0c0a31-5443-434e-ade3-843f653b13a5	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ef903cb7-d138-4245-bfde-204aa46feebf	935f2544-5727-47a9-a758-bd24afea5994	15adee7a-c86c-4451-a862-6664e4a72332	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
3f84d6cc-5ac7-401a-9393-15a097410275	935f2544-5727-47a9-a758-bd24afea5994	9871b276-3844-46c3-8564-243c81bfc26e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
30c18847-3a40-450f-9908-29212245ac01	935f2544-5727-47a9-a758-bd24afea5994	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
7c2748aa-d381-46e7-8d10-b6a824740443	935f2544-5727-47a9-a758-bd24afea5994	441dc9df-8866-4dcf-8f81-c8957513ddaa	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
bb2ba2b6-0289-41f2-a222-2eee9c7acc8f	935f2544-5727-47a9-a758-bd24afea5994	6f57f96c-4e83-4188-95b1-4a58af42d368	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
afb68192-571e-4f34-a1d5-d22f0210b0f8	935f2544-5727-47a9-a758-bd24afea5994	2e568ea8-6aab-4e76-b578-8fc44b566d00	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
9c124de6-fd66-4aa5-bc55-ebc5575ebbb7	935f2544-5727-47a9-a758-bd24afea5994	92ddb36f-34ee-4f99-8da8-f52d78752b40	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8aa56003-7e25-4916-8467-ae1e7075ec23	935f2544-5727-47a9-a758-bd24afea5994	d2a87d3c-d4f5-4728-a702-d520d52f8efc	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
08241f8c-e593-48c1-b236-b97b2b11ccb6	935f2544-5727-47a9-a758-bd24afea5994	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
d6022921-fa2a-403d-9d28-b76b3e48601e	935f2544-5727-47a9-a758-bd24afea5994	6f00304d-9dd1-4a86-b25e-96ffc4c96245	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
21c8d515-c27b-4e01-afed-a8cb4eda0e26	935f2544-5727-47a9-a758-bd24afea5994	29535a71-4da7-4d9e-8a1a-088498c25104	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
81ee1ba9-ca75-4690-880f-d5a9615e9af3	935f2544-5727-47a9-a758-bd24afea5994	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
900cca09-17d3-48a4-ad5a-8eac38f49e34	935f2544-5727-47a9-a758-bd24afea5994	53179e6b-42df-45fb-808e-06635445f0a3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
02e55d62-a4b6-44c9-b076-5c281f8b8b95	935f2544-5727-47a9-a758-bd24afea5994	01bfbc25-4974-4e1d-a039-afc1ab9350a0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
88845ba5-659c-4e21-94d1-5f60c40559fd	935f2544-5727-47a9-a758-bd24afea5994	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
def9792c-cd32-4594-a2cb-a23bad01fa77	935f2544-5727-47a9-a758-bd24afea5994	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
2e064b35-dc64-4f63-8875-c8a3f305cabb	935f2544-5727-47a9-a758-bd24afea5994	49845113-2ada-42b3-b60e-a10d47724be3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
009dbf1f-c684-4cb0-97ab-1119fcbb39bb	935f2544-5727-47a9-a758-bd24afea5994	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
05c35bb0-c9e1-47da-9ea3-9b1af219bd05	935f2544-5727-47a9-a758-bd24afea5994	23525539-5160-4174-bf39-938badb0bb75	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
4771b8eb-a000-4807-91db-1f49167245e6	935f2544-5727-47a9-a758-bd24afea5994	45b02588-26f2-4553-bb6e-c773bbe1cd45	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
6845f0d3-74e8-4fe8-92a2-8d29eeb0a62b	935f2544-5727-47a9-a758-bd24afea5994	18bed42b-5400-452c-91db-4fb4147f355f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
303edd6b-753b-4c59-b9b2-3d6a05894185	935f2544-5727-47a9-a758-bd24afea5994	5849ff0b-a440-4ab2-a389-b4acc0bf552e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1e362ee0-a3d5-46de-b554-a13448328935	935f2544-5727-47a9-a758-bd24afea5994	aba9bce3-2155-4621-b4b0-3cf669cad3b2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
391c06ee-b964-47db-ad5f-b1629e0fd4fa	935f2544-5727-47a9-a758-bd24afea5994	2dd84bba-57aa-4137-b532-5e40df1f9818	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
83433e8c-3e9c-4ee8-aa29-8b56878a8a82	935f2544-5727-47a9-a758-bd24afea5994	02bf47ac-626f-45f7-910b-344eab76bc24	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
60b3b35c-cef0-4239-8f56-9fa5fba3ff5e	935f2544-5727-47a9-a758-bd24afea5994	c022b4da-2739-428a-8169-4522791ac94e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
4fc74b27-a069-4ee5-ba02-ab4595489273	935f2544-5727-47a9-a758-bd24afea5994	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
3f13f369-6aed-4769-bf65-9b5606043194	935f2544-5727-47a9-a758-bd24afea5994	8d49f450-e103-4b29-8e22-2e14306ae829	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
035c3b9b-6787-470e-810d-f570bc996509	935f2544-5727-47a9-a758-bd24afea5994	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ccd6cc11-e688-45e0-a908-f8f227fd5ad9	935f2544-5727-47a9-a758-bd24afea5994	6b142850-4553-451e-a6cb-3cb9fe612458	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
a38b6160-2245-419e-87e7-c4b63030cb99	935f2544-5727-47a9-a758-bd24afea5994	5029f19f-04e8-4c22-baaa-abc4410face3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
7452c787-aba8-41f4-ad6f-cfd53cf259aa	935f2544-5727-47a9-a758-bd24afea5994	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
a337ff8e-222c-4d50-ac38-396e32e1944f	935f2544-5727-47a9-a758-bd24afea5994	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
3f21a986-3541-4406-ac1b-6a0a21b2de3b	935f2544-5727-47a9-a758-bd24afea5994	3a237a3a-4394-48e9-87c4-334c87d1b6a1	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
c2192ee9-5444-418c-ad1d-e1e35e3fa94f	935f2544-5727-47a9-a758-bd24afea5994	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
5c38d8e2-6ae0-4007-935e-c897df2ad901	935f2544-5727-47a9-a758-bd24afea5994	00160b54-fdf1-48d1-9b52-52842dc8df4e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ecf13873-e997-4408-8b01-6cbce316fe3e	935f2544-5727-47a9-a758-bd24afea5994	29e9b502-fde8-4a8f-91b6-ff44f8d41479	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ebd324ec-4ea1-4bd0-a5a1-6f6a64a499a3	935f2544-5727-47a9-a758-bd24afea5994	ca6e0150-9d34-403c-9fea-bb1e35d0e894	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8a26edfb-6dd9-47f5-85c1-a12154f78283	935f2544-5727-47a9-a758-bd24afea5994	16743e3d-672d-4584-9a3c-5d76ae079569	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1b53fea4-c623-4a4a-adfc-50e5e5a331a2	935f2544-5727-47a9-a758-bd24afea5994	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
45f9707d-be98-4c3c-9c68-c25499391449	935f2544-5727-47a9-a758-bd24afea5994	372b482c-fcb8-405d-a88a-5d2ee5686e30	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
af3a76ac-134a-4281-b4f0-b8dfa82f0a95	935f2544-5727-47a9-a758-bd24afea5994	c47cf3e0-e149-4834-b454-5fd4d583a1a7	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
f3806dc3-728f-4ea2-8ba4-561259d14a14	935f2544-5727-47a9-a758-bd24afea5994	d7b7595d-a831-48ec-84d4-39476bc3e44a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
b278463b-5901-4438-a976-258fa5d55ff3	935f2544-5727-47a9-a758-bd24afea5994	0690e264-ed8b-48b3-8930-5651eebe2e2e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
c4ac7256-9cb7-4f51-8f36-0a130db18730	935f2544-5727-47a9-a758-bd24afea5994	b969a964-3765-4744-8080-3e2c88ab688e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
e830ae7f-3f57-4ce3-810b-e6aee8a4c67c	935f2544-5727-47a9-a758-bd24afea5994	6750bd19-7115-4966-b7db-0d8e2add036a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
4a413065-bc6e-4e2d-8af4-a01a850b9551	935f2544-5727-47a9-a758-bd24afea5994	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
2a63140e-f5d3-4bb7-9cc6-ae4a45257108	935f2544-5727-47a9-a758-bd24afea5994	2afa78a2-892a-4dfb-9098-7926491b648f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
72d254bc-5104-471b-a489-14fbe2d68ba2	935f2544-5727-47a9-a758-bd24afea5994	374edfb0-e4ae-4625-af63-a14d4cb48f9b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8b05d45a-fb5e-44d8-aa56-80a193f9f566	935f2544-5727-47a9-a758-bd24afea5994	d9f8f427-d02c-4a3a-9091-0a442685cf72	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
5019acc9-1012-4e2b-9106-8250852c7ec0	935f2544-5727-47a9-a758-bd24afea5994	9b28e1e2-badb-4a9d-88d4-84f5612934e5	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
61e11c51-4a22-4620-8f20-b3fd581b2972	935f2544-5727-47a9-a758-bd24afea5994	d4b1799f-245c-44e7-bc89-1eec59a28c9c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
7e86bd2c-faa4-4caf-bfab-8b784949738c	935f2544-5727-47a9-a758-bd24afea5994	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
8d056f76-5418-40f7-aff9-88331b510f24	935f2544-5727-47a9-a758-bd24afea5994	1a810543-4218-41a4-90ba-9e3743f077fa	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
412fea6f-79e8-4244-b144-79b5baa3e759	935f2544-5727-47a9-a758-bd24afea5994	09827071-8a30-42ac-898c-59a6fe9f0c75	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
df9acfd5-73e9-4957-9ce9-dabfe4828d56	935f2544-5727-47a9-a758-bd24afea5994	59996c9e-0bc9-4120-bee1-3f0455f81725	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
dd308900-066c-4695-8edd-bc140a892dd0	935f2544-5727-47a9-a758-bd24afea5994	d36af823-920c-47ab-965e-4ab698621052	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
3e2ec118-99a6-4ccd-ba03-cdd89b8fba3c	935f2544-5727-47a9-a758-bd24afea5994	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
adc4fb1a-b06b-45eb-accf-0a924aa69811	935f2544-5727-47a9-a758-bd24afea5994	2d3e7958-5f64-4312-abe6-0af811e901c3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
5a08a128-222f-4a89-ac86-3cd2023b1010	935f2544-5727-47a9-a758-bd24afea5994	92b916e1-6a0b-4498-9048-3901b27bec39	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
9a847e49-271e-4fd1-a858-448a307dde30	935f2544-5727-47a9-a758-bd24afea5994	7f87bc22-635b-416a-8722-53c1ee704f0c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1748c2b7-b8a4-4663-8620-d36786beee6a	935f2544-5727-47a9-a758-bd24afea5994	d65b2853-a79d-401a-8f05-adf2743b9162	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
aebe7361-af4b-40ff-9fa5-3350596f7c5d	935f2544-5727-47a9-a758-bd24afea5994	5f946046-e498-403d-a64a-6933c7bd6896	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
2ca2ab31-2aea-4cfa-a094-a328c7ad1179	935f2544-5727-47a9-a758-bd24afea5994	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1a0ad03e-020c-4be7-9ee5-5f0d7f159509	935f2544-5727-47a9-a758-bd24afea5994	c6db06ec-612a-4dc3-bbc6-7c153e90994c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
52c56bc5-6c94-4ea9-974d-5c1a7b5d8bf4	935f2544-5727-47a9-a758-bd24afea5994	f410965b-b444-4df5-bfd6-e138109567a0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
f134dcf7-e284-4dc6-8a9e-c1ade75a8584	935f2544-5727-47a9-a758-bd24afea5994	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
413430e2-7023-4874-8760-9581b21741a9	935f2544-5727-47a9-a758-bd24afea5994	edccde66-49d6-459e-94e7-02b99477d24c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
26d4bc5f-b94a-4156-8466-a764fa25ad62	935f2544-5727-47a9-a758-bd24afea5994	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
5a11ea6d-35c3-4604-8730-4ab3c5bb5b6c	935f2544-5727-47a9-a758-bd24afea5994	f3da6061-0490-40ac-bdec-10e862ef1296	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
332f4cda-9712-4111-8865-d49e77964323	935f2544-5727-47a9-a758-bd24afea5994	8e9ff64e-0787-4e03-9835-e833ca96ed46	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ee11a91a-2c87-4bf2-b7e8-eea2491d916a	935f2544-5727-47a9-a758-bd24afea5994	b54125c1-a96c-4137-9e7a-c197421d99b3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
fb07890e-a8bb-403c-865c-663bdbed14e5	935f2544-5727-47a9-a758-bd24afea5994	bebb0636-e19e-40a8-8733-18aa11ba1e13	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
46519e81-f96e-4554-ba99-e4522ce49dd5	935f2544-5727-47a9-a758-bd24afea5994	6432d484-b4a5-427f-a12a-59303f1e50ee	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
2e63245c-a2b7-4c2b-912a-e2a9af5e63d7	935f2544-5727-47a9-a758-bd24afea5994	4f96dd8e-6915-481e-aebb-672f83b45aa1	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
28220cfe-12c3-4c65-9620-4d963010415f	935f2544-5727-47a9-a758-bd24afea5994	88f85444-56fd-4596-a6f3-84e3dde28513	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
3e2876e9-b192-4dfb-90a5-f636532333d4	935f2544-5727-47a9-a758-bd24afea5994	0953b49f-6af7-4347-a249-24c34997bf1d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
9e847877-8b53-4cb3-a2ce-d6931a59eb1e	935f2544-5727-47a9-a758-bd24afea5994	0d33577d-027b-4a5d-b055-d766d2627542	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
75925cf7-c94f-4b54-9ea5-cc711c185f8e	935f2544-5727-47a9-a758-bd24afea5994	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1f1ee6fa-3e27-4739-abc9-2c98f22b30c3	935f2544-5727-47a9-a758-bd24afea5994	02932d66-2813-47b0-ae40-30564049a5ef	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
1004c909-3e5a-4196-828f-0a6b8e253f27	935f2544-5727-47a9-a758-bd24afea5994	a4ccc274-2686-4677-b826-95e0616f156d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
ddf3938b-732d-4b00-92d1-f518517a2bbf	935f2544-5727-47a9-a758-bd24afea5994	a04fc678-94ae-42bb-b43b-38ce17d30faf	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
09837f3f-055e-4f37-b214-2a1d2851c092	935f2544-5727-47a9-a758-bd24afea5994	1a8f1b99-a206-48d9-8170-23814b72c4cc	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
9e25680e-f1ca-4c14-b980-cc59f7b98b44	935f2544-5727-47a9-a758-bd24afea5994	295fd56c-315c-4c82-9e20-fb571f376ddd	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.5	2026-01-28 19:46:36.5
20aa132c-7433-44eb-8066-825e49a151b9	935f2544-5727-47a9-a758-bd24afea5994	a0099cf4-5479-4475-a86b-2f3d67995db8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
42458bc6-a57f-43fe-8e93-2c4afda34acd	935f2544-5727-47a9-a758-bd24afea5994	dfbc0a35-28c7-4077-b9e6-08f3413ad130	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b16a4bd5-5714-4b25-8b2a-8b9056a5e125	935f2544-5727-47a9-a758-bd24afea5994	47dcd774-7cbf-4a87-94df-369d0abf9232	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
1bd3d42f-98da-4043-90fc-fb9c93bafe98	935f2544-5727-47a9-a758-bd24afea5994	d2d84e05-c829-4c67-acec-3632e5f6515a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
3697f591-e924-417b-a464-86044758566c	935f2544-5727-47a9-a758-bd24afea5994	0a421a5e-ad04-43ab-a539-2644d3ddabb0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
e7a6e100-ca2f-43da-bd5c-6c7b8869cc0a	935f2544-5727-47a9-a758-bd24afea5994	f8705655-8e50-4159-b738-efdb7c92de1f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6688e9ee-51be-407d-8063-eb4c4c68f50d	935f2544-5727-47a9-a758-bd24afea5994	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a69d6dca-0470-4cc7-9a1f-cf660668fcb3	935f2544-5727-47a9-a758-bd24afea5994	81e51f8b-500d-4366-9360-3450dfa5ee4d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
35487fb3-66c4-4d6f-bcbe-8861c7490829	935f2544-5727-47a9-a758-bd24afea5994	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
d4e26e38-9dc3-4352-a9cf-0f5d91fa504f	935f2544-5727-47a9-a758-bd24afea5994	9297daf6-1431-4b62-9039-2ee22dcbba29	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
4f863e87-33a5-4f9e-a134-679bc8ad1d3f	935f2544-5727-47a9-a758-bd24afea5994	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
53a5c85b-5b2d-4631-affe-3a215dc83696	935f2544-5727-47a9-a758-bd24afea5994	f34e06ee-82cc-4a62-bd17-947c58f42116	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
402d7013-d304-4d72-8c61-c5c6db353bd7	935f2544-5727-47a9-a758-bd24afea5994	38ccc597-1f09-4de4-ad38-b9cddd2256c3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
bab35b34-fcd8-4868-ac4b-f518820a6adc	935f2544-5727-47a9-a758-bd24afea5994	70e897f5-c029-4382-9778-de9aa02b85d7	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a0fe2cc9-9182-484a-8e1d-9cdaae5788a8	935f2544-5727-47a9-a758-bd24afea5994	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
e4febad6-d7d3-48ac-b381-465459eab2eb	935f2544-5727-47a9-a758-bd24afea5994	834f193e-7023-48a7-bc8e-58a910845d6b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
20212372-cc8b-4a32-870a-be4265e5374a	935f2544-5727-47a9-a758-bd24afea5994	e90ca965-4a55-433d-83c8-9de44b168b9c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
dc564088-e9e1-4f16-b842-e4052c8fde93	935f2544-5727-47a9-a758-bd24afea5994	e8d65387-e415-4e52-bf95-4cf7134e2235	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
0fca76e8-503d-41f7-83d6-d1b977e45734	935f2544-5727-47a9-a758-bd24afea5994	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
f358afd1-cb5f-41cc-8601-e30ec010f429	935f2544-5727-47a9-a758-bd24afea5994	66177523-edef-4bb4-9e47-1db421e14257	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
4225f466-4186-4b08-ad91-03f4a47cd311	935f2544-5727-47a9-a758-bd24afea5994	fcd820ab-6f42-4794-8e6a-217faa6017ac	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
752de0fd-21ee-4182-a374-71bd50a91a25	935f2544-5727-47a9-a758-bd24afea5994	172fe5c4-06a1-435e-86e1-50a717ff1505	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
97e1ebde-9ce6-451a-8b34-5a252b0e8a12	935f2544-5727-47a9-a758-bd24afea5994	52fa7c54-7266-459b-b679-a4a0966dcca2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
3abae164-d3c2-48e6-89d4-f0c4395a0b06	935f2544-5727-47a9-a758-bd24afea5994	ad04836f-3c39-4de5-ba1d-171dded4420b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
c3bc7aae-860c-4761-a651-e324d9c43cd5	935f2544-5727-47a9-a758-bd24afea5994	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
5da4ab79-385f-478a-a151-dc4cfb3b5c2c	935f2544-5727-47a9-a758-bd24afea5994	9fab0497-b7b0-43af-8c94-ac59cf2d504a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
610f16ec-b470-4709-b31c-3b5ca54e8c99	935f2544-5727-47a9-a758-bd24afea5994	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
cf6a3fe9-2264-41da-934d-0cbf2755a48e	935f2544-5727-47a9-a758-bd24afea5994	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
bfab9558-1b82-4e5c-ba52-d6b9b6957adf	935f2544-5727-47a9-a758-bd24afea5994	2069bcb9-4a3d-4462-8860-e39fe7327d4f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a355eddf-b7df-4184-97c0-6d44e05c933c	935f2544-5727-47a9-a758-bd24afea5994	4b0170c2-6403-45f2-a9be-25e61595b48e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
0a8f75a3-8369-4aa4-8822-da0d249c0a1f	935f2544-5727-47a9-a758-bd24afea5994	db94e4b5-77ae-4459-8494-e31443458d7a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
88587f55-ece1-43a5-ac45-8832779fd058	935f2544-5727-47a9-a758-bd24afea5994	fb7e9280-2b6f-429c-be0c-e4fa204755f8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b2e0d2b4-614c-452c-a39e-e584da1087cc	935f2544-5727-47a9-a758-bd24afea5994	9c06ea4c-d311-4249-a91e-09c14c66786a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
5636404c-0cc7-4907-94f6-bb96bcf6e030	935f2544-5727-47a9-a758-bd24afea5994	38c264c0-26f6-4929-a52c-2277e2aaccce	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b1d48c2f-584f-4b3b-b4c6-72f3dba5e01e	935f2544-5727-47a9-a758-bd24afea5994	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6e45bb8c-a7b2-41c8-8f3b-4eeee1dc606f	935f2544-5727-47a9-a758-bd24afea5994	1042f63e-2ebf-492c-87e8-2b7bdc69150d	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
67e44d32-eaf2-423b-a882-47562fc930f3	935f2544-5727-47a9-a758-bd24afea5994	7c469d95-9f01-4295-ab59-fd3698ed7a36	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6acc335f-4ee9-4223-bcbc-02dde8d4bd31	935f2544-5727-47a9-a758-bd24afea5994	8d3556d9-f508-4a55-9f48-5c1aebc59de9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
aa07990c-93ab-416d-a9e7-1b168c72a89c	935f2544-5727-47a9-a758-bd24afea5994	04c59caf-4541-4e15-8c6e-d4a435967ef4	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
9ec1396e-0c66-4fae-b3ea-a28287854a06	935f2544-5727-47a9-a758-bd24afea5994	ade77569-3a72-4030-b2b4-11814fdd6b0a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
857a7d7c-e6d3-48e7-9d94-13950826b0a6	935f2544-5727-47a9-a758-bd24afea5994	8bd68779-d3a5-4372-b932-598273b735ef	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
fceb27c7-3042-4a22-aa26-c17b377add9f	935f2544-5727-47a9-a758-bd24afea5994	251ebe60-b752-4467-aa22-0d46d5ae4953	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
cc0f5063-d6b2-420d-a7d6-935ba143ce0b	935f2544-5727-47a9-a758-bd24afea5994	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a27a145f-ccfc-47e5-9c98-9cfe3df8aed9	935f2544-5727-47a9-a758-bd24afea5994	9b0f7458-981e-4a78-9cc1-969130cfb358	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
54bbfb0f-9882-4152-86d4-7e5a755433a8	935f2544-5727-47a9-a758-bd24afea5994	36ea8942-d4e1-44ed-a36c-33fb6e715560	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
5b614761-3535-4ed2-ad15-bee06e4cb833	935f2544-5727-47a9-a758-bd24afea5994	c4944fca-068f-4ab5-8b9d-3b2493d785f2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a39046ac-83e4-43e5-9991-6888baf43408	935f2544-5727-47a9-a758-bd24afea5994	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
2494346d-53df-4e49-a3f0-a4f8446b80b3	935f2544-5727-47a9-a758-bd24afea5994	c2066743-efa9-40b6-94b9-5b2b6e0942f3	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
9c7a1023-b708-4097-b6aa-3682a52cec46	935f2544-5727-47a9-a758-bd24afea5994	5def1949-7a28-4715-8427-6cb028048712	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
01030cc7-1046-4822-924a-6b112d5db200	935f2544-5727-47a9-a758-bd24afea5994	add83dad-b55a-4e07-ab2f-9c1828f310e6	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
034a62d3-9ed1-4497-af71-f3a35c1cd263	935f2544-5727-47a9-a758-bd24afea5994	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
532f1d37-6baf-46d6-82c5-837258df3ff4	935f2544-5727-47a9-a758-bd24afea5994	1a73dfdb-7333-4239-a6a6-7863010a6953	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
70e55d3a-b3ed-4d72-8e6c-33448b07faba	935f2544-5727-47a9-a758-bd24afea5994	635f7357-f443-4723-994f-7a81dd5d165f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
aa8105fa-99b8-4251-aac6-88dfd98a9e62	935f2544-5727-47a9-a758-bd24afea5994	1a291f0f-1525-4815-ba48-67acaf27dd7a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b23119eb-c4a7-4ada-96ef-064c9b6e47cc	935f2544-5727-47a9-a758-bd24afea5994	d2f92a82-754c-4dbf-9297-8222e71b7573	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
a1b619ed-02cf-4ade-bead-587b51e917c8	935f2544-5727-47a9-a758-bd24afea5994	aec1a837-c291-452c-9ac6-425d9f9dca36	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
99aabc24-82d6-4805-b364-5403ead5852a	935f2544-5727-47a9-a758-bd24afea5994	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
02d673f9-82b1-4060-96a8-9bf963eb470c	935f2544-5727-47a9-a758-bd24afea5994	81cf9d60-063d-4054-8277-0fc6eaa042ee	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
392c70bd-51cd-4ced-8ac5-5be4f3813973	935f2544-5727-47a9-a758-bd24afea5994	11859bb3-3249-4b3b-bc93-2236f608ff1e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
f9de5685-f2d5-4819-bd8d-9e759fb64c51	935f2544-5727-47a9-a758-bd24afea5994	4e6637ef-7d36-459a-9cf9-bd485e521443	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
22424edb-331f-4d83-8d79-874910434596	935f2544-5727-47a9-a758-bd24afea5994	1e00e441-4e0a-4c95-a147-d5ba83dc7883	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
d53aa1ef-7297-4464-b792-4ba345e2e696	935f2544-5727-47a9-a758-bd24afea5994	2af622c9-671a-4992-8b66-085781d11864	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
1b266a3a-2c25-4574-acb7-0ab69d2f166f	935f2544-5727-47a9-a758-bd24afea5994	fda4281b-edb1-4bc4-8b80-86653209240b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b38d7f0c-8ede-40a3-9fd5-cc0506fe4745	935f2544-5727-47a9-a758-bd24afea5994	1ad39315-d1f4-4655-84f0-db922eac7e1f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
1b55b286-2407-45c2-9a6a-0741ce4e468e	935f2544-5727-47a9-a758-bd24afea5994	6bda2acd-5f00-4100-b31a-0de28d40a7c0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
00641b9e-419a-4248-9843-8812cd5f2043	935f2544-5727-47a9-a758-bd24afea5994	29569e45-ea36-4138-83a3-80b85ba9ba1a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
94745cea-b3a5-45a8-a42e-cb8b2c7f59a8	935f2544-5727-47a9-a758-bd24afea5994	37afad6a-c579-4b34-8042-c3aa708227b9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
e52fa1a6-f83c-4866-90c9-0002a949115c	935f2544-5727-47a9-a758-bd24afea5994	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
0cae2419-7e1f-46cd-83be-363d0cca048c	935f2544-5727-47a9-a758-bd24afea5994	c4233e6e-d7a3-4018-aff0-5415b06ef15b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
5231bd48-3522-48ea-a3c8-136b225a8d81	935f2544-5727-47a9-a758-bd24afea5994	c93e39fe-759b-4db1-bd9a-230c1f930a7a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6d8aa488-eddc-4791-b54f-93e441a9bd77	935f2544-5727-47a9-a758-bd24afea5994	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
9d753eed-e86d-4ac2-b823-44653e33065e	935f2544-5727-47a9-a758-bd24afea5994	583c470c-9284-4b66-a009-81ffab8bda1a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
eae2dd63-0655-4236-94a7-12610764d90b	935f2544-5727-47a9-a758-bd24afea5994	6c387ed5-533e-4d6c-915f-72a85bc28c14	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
8b3e2a14-412f-4891-bce4-39c562a77f3f	935f2544-5727-47a9-a758-bd24afea5994	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
24c539d7-fb77-4e56-8808-277d86b7f497	935f2544-5727-47a9-a758-bd24afea5994	90a8f117-bde3-4070-8165-95116ddb6c78	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
339d43d7-0ca4-4e7b-86c1-68a2f4126adc	935f2544-5727-47a9-a758-bd24afea5994	78331efc-59a3-49c6-a4da-cd971800b07b	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
7b7f2b16-ac22-43da-be23-bfc27afe5656	935f2544-5727-47a9-a758-bd24afea5994	10cd0a5a-934b-4541-900f-61c5400cb33e	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
996f9db3-ed18-4a04-9369-4700fd3b3bac	935f2544-5727-47a9-a758-bd24afea5994	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
8680ff2d-7125-49a2-936e-ff10713ed907	935f2544-5727-47a9-a758-bd24afea5994	9c6b3dbf-9144-4d72-9c8c-c9984731beec	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6c23311a-0e0c-4304-8f44-f97d08ed790c	935f2544-5727-47a9-a758-bd24afea5994	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b8c6e409-40a4-4c95-b644-7e53d2c05c6e	935f2544-5727-47a9-a758-bd24afea5994	d9295f16-be88-4756-8f6e-1cf4764be20a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
74958376-e05b-4c3c-8340-1b250e8d8077	935f2544-5727-47a9-a758-bd24afea5994	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
6b0e239d-c223-4548-9edf-435a240c1982	935f2544-5727-47a9-a758-bd24afea5994	e67b4538-7412-45c0-a0cf-e27bff88caab	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
0cbc4b74-3ade-4a97-9857-8103afdb70e3	935f2544-5727-47a9-a758-bd24afea5994	b24c16bb-ff27-4814-b9d7-523fd69d9b41	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
f37f12ec-1da3-4360-9f3a-7335b5ec8641	935f2544-5727-47a9-a758-bd24afea5994	1cb61161-23ca-4336-806e-61086d967a67	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
dddd421d-edd5-4d39-b120-7b2c4c46fa5b	935f2544-5727-47a9-a758-bd24afea5994	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
0c4afe6a-af47-4b4e-9daa-abdff9d99f40	935f2544-5727-47a9-a758-bd24afea5994	278cade5-e251-4520-9394-cdd42c9212e6	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
f088a976-2718-4c8b-983c-56e1b3cd9e0c	935f2544-5727-47a9-a758-bd24afea5994	b5966924-f09e-4024-8942-8f2e00949567	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
aaae0a48-8dae-4eb3-9317-e87d80cf9b89	935f2544-5727-47a9-a758-bd24afea5994	d1627009-fe55-469a-baf7-1a8b4979d654	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
4505c365-8aac-439c-8799-b52600034573	935f2544-5727-47a9-a758-bd24afea5994	f5804675-69c7-4b68-9dc6-22dea1f5201a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
f63ee404-2fcb-479e-8761-7589bc3e6441	935f2544-5727-47a9-a758-bd24afea5994	4a7446ad-a670-4e50-82dd-e71d2013d520	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
b16ccf2a-5e52-45a3-904a-2ad076d206e8	935f2544-5727-47a9-a758-bd24afea5994	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
98661c6f-a277-49de-904c-f6f9312c8835	935f2544-5727-47a9-a758-bd24afea5994	6915f34b-6468-4e75-a1d9-dbeee0529cb8	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
8bccbdae-7dde-41f3-86b8-1432adf0e139	935f2544-5727-47a9-a758-bd24afea5994	e4778ab5-7678-46d9-baea-0368e4f812f0	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
3056733a-a2f9-446c-baa7-b70f59216431	935f2544-5727-47a9-a758-bd24afea5994	cf4be8bf-0906-4925-8291-6c8c785dcef4	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
846acd09-39f2-486e-ba47-0961ebd5ca61	935f2544-5727-47a9-a758-bd24afea5994	0b038769-9d16-464d-85e6-fed33a40579a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
2ad69a0a-92c5-417b-969e-03bcb5427938	935f2544-5727-47a9-a758-bd24afea5994	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
aba72602-ff6e-44ce-aabf-63434b0bc756	935f2544-5727-47a9-a758-bd24afea5994	027e9c43-d25b-4cb5-b4c9-916084271623	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
71948d25-9b95-4dde-9afc-91930c18f3a2	935f2544-5727-47a9-a758-bd24afea5994	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
184e7088-4f37-4eff-9870-190943c985f0	935f2544-5727-47a9-a758-bd24afea5994	7d0f9dbd-4909-491d-9440-5f87bca5a254	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.51	2026-01-28 19:46:36.51
7990afae-9f2c-4808-8df6-89cc59d453eb	935f2544-5727-47a9-a758-bd24afea5994	aa0a06e7-d580-47b2-bc2e-cddd466186cb	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ce896d8a-70d2-427b-9a5d-c5a4fa2eb5e8	935f2544-5727-47a9-a758-bd24afea5994	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ad09c825-b46f-4007-a1c7-29a96e509702	935f2544-5727-47a9-a758-bd24afea5994	fa0dcd21-865b-4de3-a315-83af78061b4a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
11d11f65-b519-449c-a596-d6aa0d9b5b55	935f2544-5727-47a9-a758-bd24afea5994	69b81a70-6fa3-4533-9d00-c252f0f6245f	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
80483a57-3441-4707-9160-26ef077c931f	935f2544-5727-47a9-a758-bd24afea5994	360b9bee-d159-4e20-ba1f-9681d17cf9bc	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
dcc0da30-9652-499e-9042-caf13ffd4d3c	935f2544-5727-47a9-a758-bd24afea5994	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
4995d240-16ba-4709-8e53-2571d089eac8	935f2544-5727-47a9-a758-bd24afea5994	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ff9327ea-c9bb-4dbd-b873-3097af4a2687	935f2544-5727-47a9-a758-bd24afea5994	b19145e9-2513-41c3-b2a7-719588692eed	5132a5a2-6bbc-4fe6-b242-8eee1e761c86	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
1850ce8d-e610-4942-beb4-9f99efda4810	383f3f2f-3194-4396-9a63-297f80e151f9	e6fffac1-4aad-4ce4-9981-3983dde344d3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
4043306e-a993-41fa-998b-4560ebf16f71	383f3f2f-3194-4396-9a63-297f80e151f9	32c804e1-e904-45b0-b150-cdc70be9679c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
3dfdcfce-c8ca-409a-bd7b-427ec39d062a	383f3f2f-3194-4396-9a63-297f80e151f9	16d101ea-c92f-44b0-b7dc-11cd3680215c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
04116cda-0414-4b6b-abe8-b8226143d443	383f3f2f-3194-4396-9a63-297f80e151f9	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
33bd7ae9-d35d-4936-bd6f-1218487183c9	383f3f2f-3194-4396-9a63-297f80e151f9	778ec216-a84f-41c7-a341-9d04269f0dc6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
afecb8b9-0640-47c8-8f8b-fe37d691b689	383f3f2f-3194-4396-9a63-297f80e151f9	ed459bf2-7e56-4eca-bc6b-cee6655c644a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
3a8bdc48-a405-4371-819d-74d9d30a10ad	383f3f2f-3194-4396-9a63-297f80e151f9	9f38de93-8d44-4760-9152-372666596d56	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
c31a21d0-d5be-48bf-b87f-35f4ab3e4ae1	383f3f2f-3194-4396-9a63-297f80e151f9	eadf502a-97e3-44fc-b07c-0f7015cb598a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
16011572-db9b-4e57-a2ae-c52bb55e4076	383f3f2f-3194-4396-9a63-297f80e151f9	c21d204c-4660-41e7-93c8-d895ddbaab26	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
971a3692-def0-46ab-ad9c-e17b9be54381	383f3f2f-3194-4396-9a63-297f80e151f9	31dec1f6-7abb-4742-ade1-42b89ad7766a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
1b7dd981-5990-4938-bd52-f233fa41a2d7	383f3f2f-3194-4396-9a63-297f80e151f9	b182931c-6229-4be3-bde7-ef6126032f52	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
fa98bd9a-5939-4d99-b4fd-db443f773bbb	383f3f2f-3194-4396-9a63-297f80e151f9	93421fdb-364d-418e-898a-a1f62dd8020a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6534309f-f8ca-47a5-9548-6ae5e81e6f8a	383f3f2f-3194-4396-9a63-297f80e151f9	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
fc97a7cc-5478-465c-8a5b-ab0e704f751f	383f3f2f-3194-4396-9a63-297f80e151f9	071a36ac-c2e2-4462-b10d-3175b101bd06	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
65acd4fd-176f-421f-8798-c24c748f6bc0	383f3f2f-3194-4396-9a63-297f80e151f9	734f6aa9-6ade-4187-b3b3-2cba78068a34	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
e8cddf0f-d665-48a6-9054-cec22cb024cd	383f3f2f-3194-4396-9a63-297f80e151f9	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
79330c05-3244-47da-b053-77cf196c0373	383f3f2f-3194-4396-9a63-297f80e151f9	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
2b63e63e-bef2-4d3f-b746-69721868b6cf	383f3f2f-3194-4396-9a63-297f80e151f9	32898e2d-148e-4483-9e74-6fca3a3eed62	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a38745a1-0c0d-4838-a2a5-3d0d9b6b934b	383f3f2f-3194-4396-9a63-297f80e151f9	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a4ce35b9-f2ad-4b48-89cd-b61faf3666b5	383f3f2f-3194-4396-9a63-297f80e151f9	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a732fa12-6247-45dd-b3be-43f31eb01b94	383f3f2f-3194-4396-9a63-297f80e151f9	7a27fe64-579c-4653-a395-4ead4e3860df	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
ecc92a10-b7ca-432c-a1e8-207a3b2d2aa6	383f3f2f-3194-4396-9a63-297f80e151f9	8504d304-1734-41d3-8e1c-8e6765cbf3d9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
70a75356-c325-4592-9665-97d233be18fa	383f3f2f-3194-4396-9a63-297f80e151f9	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
02d8ae87-b7fe-4755-8624-db5808a0d3f6	383f3f2f-3194-4396-9a63-297f80e151f9	5663e510-84a4-4116-86dd-dfaf709165e2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
135e8af5-a8aa-46bc-a6e8-13d9118c9874	383f3f2f-3194-4396-9a63-297f80e151f9	12663a56-2460-435d-97b2-b36c631dd62f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
040de250-a375-4af5-b46a-4e5efcf0337f	383f3f2f-3194-4396-9a63-297f80e151f9	11b13f4a-d287-4401-bd76-82a3b21bbbb6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
9c298bbb-b4ae-42fe-a5a1-789d4ebd591d	383f3f2f-3194-4396-9a63-297f80e151f9	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
49eff97d-2c87-4d78-859c-819568daf148	383f3f2f-3194-4396-9a63-297f80e151f9	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
8a30659d-5baf-484f-89dd-feba31b91e1e	383f3f2f-3194-4396-9a63-297f80e151f9	4220515f-01f8-40d5-846d-b4a7f5aa460b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
d56e6ce0-6e7a-4479-abbe-9cff9ac0d016	383f3f2f-3194-4396-9a63-297f80e151f9	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
4f4928a4-c44e-4bad-904e-925e2117b7b7	383f3f2f-3194-4396-9a63-297f80e151f9	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a40fc7cb-723b-4a15-a5ba-f1aed89647d9	383f3f2f-3194-4396-9a63-297f80e151f9	cd47199a-6751-4135-a27a-3d4719b9ef1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
ec1ecbdc-3306-450d-8ee8-9910e669c492	383f3f2f-3194-4396-9a63-297f80e151f9	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6bcec729-027f-4ec5-9903-8c1352b64467	383f3f2f-3194-4396-9a63-297f80e151f9	c86565cd-7ab2-4c4a-9152-f911e8eae236	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
12fc84f0-6d31-4c3d-88d6-25de67f494ca	383f3f2f-3194-4396-9a63-297f80e151f9	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
8b1dabce-b578-457d-bd5e-70349c1e41ac	383f3f2f-3194-4396-9a63-297f80e151f9	f43eb3e8-8708-4656-aae2-d21e33812610	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
06dce2dc-e61f-4dcc-b5dd-a7e49d8f68c9	383f3f2f-3194-4396-9a63-297f80e151f9	28748534-0496-4c62-8647-6af5f01fc608	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
65316217-29f1-4f24-b311-575079d0e04d	383f3f2f-3194-4396-9a63-297f80e151f9	4c239c57-b3c6-4988-a698-6908b26d0e19	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
7f8048d9-cde5-4ef8-925f-d9f4f59ef824	383f3f2f-3194-4396-9a63-297f80e151f9	493436bd-ca41-4359-8d8a-0d690ee7fc29	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
df43d4b8-b3a4-4d8a-8098-57a3ff20b7c5	383f3f2f-3194-4396-9a63-297f80e151f9	fe3d87aa-c40a-468d-8e3f-239029a5919d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
35d78a06-dda1-4775-b41e-482c01d733bb	383f3f2f-3194-4396-9a63-297f80e151f9	b52c3226-dc94-4289-a051-b7227fd77ae8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
d5d8589d-5d4a-4ddb-9fea-5d9eec8f9b1c	383f3f2f-3194-4396-9a63-297f80e151f9	7050c97c-b57f-490f-90a9-d8601fcb3852	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a4316929-bb10-4934-bc14-3d41a21cb1fe	383f3f2f-3194-4396-9a63-297f80e151f9	60fc24d8-ef72-4107-8519-429969f3a05b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
b13b458b-6834-4b7c-9bc9-b64e65924d20	383f3f2f-3194-4396-9a63-297f80e151f9	db419a02-b502-47b6-bf78-ca8e5cc0db52	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
eb0c3072-3dd5-44c8-9ed8-0331ee5ca11a	383f3f2f-3194-4396-9a63-297f80e151f9	913edefa-4e9b-4792-bddf-5739e52946f3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
d1b04d1f-ad2a-4053-913d-ac3507d6e4d2	383f3f2f-3194-4396-9a63-297f80e151f9	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
5a855739-708f-45f8-b2f6-47f8f5912069	383f3f2f-3194-4396-9a63-297f80e151f9	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
166b949d-ddad-4223-b546-a749c323544d	383f3f2f-3194-4396-9a63-297f80e151f9	81aabfd3-329b-4346-848b-5bea91a93fc1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
eb0f4c6e-9d3e-4cc8-aa65-f4a6feb36c69	383f3f2f-3194-4396-9a63-297f80e151f9	fea93ffa-2056-42bd-984d-d35e5d8999a3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
ba58b1d5-3465-4399-aa0d-04f347b7c589	383f3f2f-3194-4396-9a63-297f80e151f9	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
b4dcc15e-6c84-4de8-9967-561958f326f7	383f3f2f-3194-4396-9a63-297f80e151f9	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
86763104-c52c-49db-9759-a3f9142d7f45	383f3f2f-3194-4396-9a63-297f80e151f9	e76be943-41ac-4c14-980c-603a3652643f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
96d7d85f-7f48-4387-9c44-161ed8fa15b1	383f3f2f-3194-4396-9a63-297f80e151f9	3ce0f539-13c5-412d-8301-2ba191ea3328	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
f0382e39-6aca-4786-9cb3-592942c8cc77	383f3f2f-3194-4396-9a63-297f80e151f9	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
17f42115-a304-45cc-8f69-27ea72e1a654	383f3f2f-3194-4396-9a63-297f80e151f9	623da6ff-cb25-4a58-bafa-da9088cfb606	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
845bf630-efef-4f0b-878b-b36a7415ce11	383f3f2f-3194-4396-9a63-297f80e151f9	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
8af8dde6-df3d-4453-b184-dbc925248f34	383f3f2f-3194-4396-9a63-297f80e151f9	b0ca323f-43b7-4020-b9f0-307751da0b74	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
1f31d960-2be3-4bfb-a775-2374481e7376	383f3f2f-3194-4396-9a63-297f80e151f9	1c02ee54-327e-464f-b249-54a5b9f07a95	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6d0d1c4e-dd69-4464-9fb9-af5255bcb23c	383f3f2f-3194-4396-9a63-297f80e151f9	1a8acd2c-9221-47e0-92f6-35f89fa37812	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
f8e7975b-7555-4e6e-b87a-f3ca8b3dce69	383f3f2f-3194-4396-9a63-297f80e151f9	8432f245-2bb6-4186-a3fd-607dee8bfbb3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
9b784bd2-0f07-474c-ad9f-f32865318d05	383f3f2f-3194-4396-9a63-297f80e151f9	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
acf9b263-04a6-4d42-acb8-f9cbb8ec11d1	383f3f2f-3194-4396-9a63-297f80e151f9	9d0c0a31-5443-434e-ade3-843f653b13a5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
33ad595c-5a5d-4cba-969f-c98edf7a6963	383f3f2f-3194-4396-9a63-297f80e151f9	15adee7a-c86c-4451-a862-6664e4a72332	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
b296220e-80b3-40f7-9842-7b60c8815eb9	383f3f2f-3194-4396-9a63-297f80e151f9	9871b276-3844-46c3-8564-243c81bfc26e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
801d797f-96a7-4ff7-84a0-c53c9716f199	383f3f2f-3194-4396-9a63-297f80e151f9	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6018530b-13f9-4187-b659-a3d1ed6a15c0	383f3f2f-3194-4396-9a63-297f80e151f9	441dc9df-8866-4dcf-8f81-c8957513ddaa	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
63d7ba5f-fa60-4937-b1d8-05ed2c120669	383f3f2f-3194-4396-9a63-297f80e151f9	6f57f96c-4e83-4188-95b1-4a58af42d368	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
ea8b0e71-1aa1-46c8-a844-c1e51478ab96	383f3f2f-3194-4396-9a63-297f80e151f9	2e568ea8-6aab-4e76-b578-8fc44b566d00	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
2f7c612a-b827-4aa4-bb93-ab4b6e390fe4	383f3f2f-3194-4396-9a63-297f80e151f9	92ddb36f-34ee-4f99-8da8-f52d78752b40	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
2eb1f440-ac82-4e5a-a35a-d0bc9c9c5c4e	383f3f2f-3194-4396-9a63-297f80e151f9	d2a87d3c-d4f5-4728-a702-d520d52f8efc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
f29c0bfc-3706-486d-923b-acb2c170c015	383f3f2f-3194-4396-9a63-297f80e151f9	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
786a28da-c7cc-4408-a0a4-b91404e04415	383f3f2f-3194-4396-9a63-297f80e151f9	6f00304d-9dd1-4a86-b25e-96ffc4c96245	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a27dec5a-dfb6-413e-b58f-8de3717e0996	383f3f2f-3194-4396-9a63-297f80e151f9	29535a71-4da7-4d9e-8a1a-088498c25104	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
2027daad-35e8-4c2c-b142-9379d2fec38b	383f3f2f-3194-4396-9a63-297f80e151f9	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
7842a2e2-632e-4028-929b-8d5fa8025633	383f3f2f-3194-4396-9a63-297f80e151f9	53179e6b-42df-45fb-808e-06635445f0a3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
62b0d71d-e93b-4e01-b957-1e71b8283d9f	383f3f2f-3194-4396-9a63-297f80e151f9	01bfbc25-4974-4e1d-a039-afc1ab9350a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
8941e740-ac6e-428a-9ef9-4465f9591e6b	383f3f2f-3194-4396-9a63-297f80e151f9	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
e3684d00-a006-4ed0-be92-df84c8c24ff8	383f3f2f-3194-4396-9a63-297f80e151f9	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
1b4dcc74-f5a8-42a0-b486-ac96562c0849	383f3f2f-3194-4396-9a63-297f80e151f9	49845113-2ada-42b3-b60e-a10d47724be3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
52905d1f-4c8c-4724-b07e-3a1c4a6ac015	383f3f2f-3194-4396-9a63-297f80e151f9	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
73513ac4-26e4-4b35-adc6-c5fc4acc2108	383f3f2f-3194-4396-9a63-297f80e151f9	23525539-5160-4174-bf39-938badb0bb75	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
38b7714d-8652-43ec-8353-cf313eee5fcf	383f3f2f-3194-4396-9a63-297f80e151f9	45b02588-26f2-4553-bb6e-c773bbe1cd45	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
9ace57ff-2565-4640-9011-70711b36e23f	383f3f2f-3194-4396-9a63-297f80e151f9	18bed42b-5400-452c-91db-4fb4147f355f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
923bdef3-5156-4ead-bfdb-75095edcd0c5	383f3f2f-3194-4396-9a63-297f80e151f9	5849ff0b-a440-4ab2-a389-b4acc0bf552e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
2e1929f1-8e51-4f87-8320-270633f670f2	383f3f2f-3194-4396-9a63-297f80e151f9	aba9bce3-2155-4621-b4b0-3cf669cad3b2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
7f8461e9-b3f6-41ab-ac60-5c0072cc1b8c	383f3f2f-3194-4396-9a63-297f80e151f9	2dd84bba-57aa-4137-b532-5e40df1f9818	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
ab00cb8e-6a11-4145-a1fe-257d0ada4136	383f3f2f-3194-4396-9a63-297f80e151f9	02bf47ac-626f-45f7-910b-344eab76bc24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
9ea00d15-5578-4134-a461-638a35fc4d72	383f3f2f-3194-4396-9a63-297f80e151f9	c022b4da-2739-428a-8169-4522791ac94e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6f32a4be-5477-419c-ac7c-593c4a8106ab	383f3f2f-3194-4396-9a63-297f80e151f9	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
8a061498-e0e0-4b2f-92d7-4f0dc5935f30	383f3f2f-3194-4396-9a63-297f80e151f9	8d49f450-e103-4b29-8e22-2e14306ae829	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
b5f8af6a-2124-4612-9ef7-cf91b5172054	383f3f2f-3194-4396-9a63-297f80e151f9	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
6c76bbc5-b922-43bd-a5cd-c15f6692cf51	383f3f2f-3194-4396-9a63-297f80e151f9	6b142850-4553-451e-a6cb-3cb9fe612458	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a15b4ea5-3adc-439e-9f39-bd4906a123e4	383f3f2f-3194-4396-9a63-297f80e151f9	5029f19f-04e8-4c22-baaa-abc4410face3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
a32049d3-3fa7-472d-8d8c-0911e626530d	383f3f2f-3194-4396-9a63-297f80e151f9	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
d878c912-2c8b-4108-b4b4-6c0babe26de7	383f3f2f-3194-4396-9a63-297f80e151f9	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
45b653b2-aa73-4287-be9c-3730202d6fb7	383f3f2f-3194-4396-9a63-297f80e151f9	3a237a3a-4394-48e9-87c4-334c87d1b6a1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
21d45307-23a6-4966-b341-875cfe9161da	383f3f2f-3194-4396-9a63-297f80e151f9	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
04f49908-6be9-48e8-b154-fcd5135a6f39	383f3f2f-3194-4396-9a63-297f80e151f9	00160b54-fdf1-48d1-9b52-52842dc8df4e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
9c72f8d4-d0a3-4ad4-8a12-e878cf679c12	383f3f2f-3194-4396-9a63-297f80e151f9	29e9b502-fde8-4a8f-91b6-ff44f8d41479	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
42159e7b-d179-4a4c-9396-e64a14b9692c	383f3f2f-3194-4396-9a63-297f80e151f9	ca6e0150-9d34-403c-9fea-bb1e35d0e894	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.573	2026-01-27 19:13:38.573
4c64cd57-cb27-4338-97c0-c50d5cafafe3	383f3f2f-3194-4396-9a63-297f80e151f9	16743e3d-672d-4584-9a3c-5d76ae079569	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
3cbfb789-b8d6-4044-b17d-f890bbf4c14b	383f3f2f-3194-4396-9a63-297f80e151f9	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
fa5b3453-813a-44e4-97cb-9bc7e177891d	383f3f2f-3194-4396-9a63-297f80e151f9	372b482c-fcb8-405d-a88a-5d2ee5686e30	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
5a5ff377-7115-40df-8374-a69065e0f205	383f3f2f-3194-4396-9a63-297f80e151f9	c47cf3e0-e149-4834-b454-5fd4d583a1a7	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
f50832cc-d724-498b-b32c-4f2ccc65841e	383f3f2f-3194-4396-9a63-297f80e151f9	d7b7595d-a831-48ec-84d4-39476bc3e44a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9e578c13-7175-4efb-b9a4-2b92bf431af1	383f3f2f-3194-4396-9a63-297f80e151f9	0690e264-ed8b-48b3-8930-5651eebe2e2e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
38765767-ef22-4c03-a510-52c36c05c775	383f3f2f-3194-4396-9a63-297f80e151f9	b969a964-3765-4744-8080-3e2c88ab688e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
f3bbac47-478c-4474-b1d5-c6b0f340e9db	383f3f2f-3194-4396-9a63-297f80e151f9	6750bd19-7115-4966-b7db-0d8e2add036a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
ef05e4ac-12dc-417f-96b0-4834460a148b	383f3f2f-3194-4396-9a63-297f80e151f9	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
8dae58cf-9383-4004-872f-a647c768bd18	383f3f2f-3194-4396-9a63-297f80e151f9	2afa78a2-892a-4dfb-9098-7926491b648f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
77c4bddc-b557-450a-80d4-d6ca4bdcbbc1	383f3f2f-3194-4396-9a63-297f80e151f9	374edfb0-e4ae-4625-af63-a14d4cb48f9b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
7825fc20-7ebd-4e61-9d7e-925cfc8a4fff	383f3f2f-3194-4396-9a63-297f80e151f9	d9f8f427-d02c-4a3a-9091-0a442685cf72	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a29401fe-1064-463d-90bb-69078cd97d3f	383f3f2f-3194-4396-9a63-297f80e151f9	9b28e1e2-badb-4a9d-88d4-84f5612934e5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
29414b9f-5c01-4cb3-9f2f-43e956b28b78	383f3f2f-3194-4396-9a63-297f80e151f9	d4b1799f-245c-44e7-bc89-1eec59a28c9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
c098f966-dd59-4a39-a069-ba84e08ef0f2	383f3f2f-3194-4396-9a63-297f80e151f9	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
7d9300ac-af87-4e14-a3f6-74044f461a9f	383f3f2f-3194-4396-9a63-297f80e151f9	1a810543-4218-41a4-90ba-9e3743f077fa	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
40f42c7b-f5ac-40ba-b176-961e08dff3d1	383f3f2f-3194-4396-9a63-297f80e151f9	09827071-8a30-42ac-898c-59a6fe9f0c75	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
51243b49-1e03-4130-9fc2-062fa165d5e6	383f3f2f-3194-4396-9a63-297f80e151f9	59996c9e-0bc9-4120-bee1-3f0455f81725	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
1fc14bc2-9c14-47e2-8da5-7c36619c9e33	383f3f2f-3194-4396-9a63-297f80e151f9	d36af823-920c-47ab-965e-4ab698621052	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a553775c-c683-4b6a-9c33-d8eac669bd17	383f3f2f-3194-4396-9a63-297f80e151f9	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
1ca00e52-283e-491d-ad07-03ec47d10a10	383f3f2f-3194-4396-9a63-297f80e151f9	2d3e7958-5f64-4312-abe6-0af811e901c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
bddd3fb7-64e6-4327-aa17-a336d8ca3d00	383f3f2f-3194-4396-9a63-297f80e151f9	92b916e1-6a0b-4498-9048-3901b27bec39	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
2ae4e99c-3f84-45b5-be94-ef84bcc22444	383f3f2f-3194-4396-9a63-297f80e151f9	7f87bc22-635b-416a-8722-53c1ee704f0c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a62b4640-f5fd-496e-a130-ce599d91357c	383f3f2f-3194-4396-9a63-297f80e151f9	d65b2853-a79d-401a-8f05-adf2743b9162	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
5f00b6d8-91bb-4c81-a5f1-12b03d00f7cc	383f3f2f-3194-4396-9a63-297f80e151f9	5f946046-e498-403d-a64a-6933c7bd6896	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
64209b3b-608f-4ed9-a7ee-2af585193cde	383f3f2f-3194-4396-9a63-297f80e151f9	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
5074c56b-3393-4fc9-b696-493c14121848	383f3f2f-3194-4396-9a63-297f80e151f9	c6db06ec-612a-4dc3-bbc6-7c153e90994c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
b9653728-705a-4257-9b20-455c6fa7bb48	383f3f2f-3194-4396-9a63-297f80e151f9	f410965b-b444-4df5-bfd6-e138109567a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
ab7b312b-5528-4d63-9c22-0bf46f73fe49	383f3f2f-3194-4396-9a63-297f80e151f9	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
104a8eba-5ae2-44e8-a445-7a34e5efb9a0	383f3f2f-3194-4396-9a63-297f80e151f9	edccde66-49d6-459e-94e7-02b99477d24c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
6d8396d4-9af5-45ca-a222-6870cc3bbdb7	383f3f2f-3194-4396-9a63-297f80e151f9	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
b252afd1-c776-412e-ab90-7ab3aa83eba7	383f3f2f-3194-4396-9a63-297f80e151f9	f3da6061-0490-40ac-bdec-10e862ef1296	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
59e21cb0-266a-4834-9b59-0e0bd3b6387d	383f3f2f-3194-4396-9a63-297f80e151f9	8e9ff64e-0787-4e03-9835-e833ca96ed46	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
d79061f2-b9a1-49db-8db4-70c4adbb23a6	383f3f2f-3194-4396-9a63-297f80e151f9	b54125c1-a96c-4137-9e7a-c197421d99b3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a51249bb-a7b2-414b-a71d-97b83aaa8b12	383f3f2f-3194-4396-9a63-297f80e151f9	bebb0636-e19e-40a8-8733-18aa11ba1e13	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
753afd71-77a8-49e1-bcdc-a21c45af9270	383f3f2f-3194-4396-9a63-297f80e151f9	6432d484-b4a5-427f-a12a-59303f1e50ee	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9e2b2953-8312-4ff5-9455-43cd5709984c	383f3f2f-3194-4396-9a63-297f80e151f9	4f96dd8e-6915-481e-aebb-672f83b45aa1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
72ff07fd-0126-4ade-8a12-1d68c5ffcc21	383f3f2f-3194-4396-9a63-297f80e151f9	88f85444-56fd-4596-a6f3-84e3dde28513	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
513502fa-c18b-40a0-ac09-40fd46c92043	383f3f2f-3194-4396-9a63-297f80e151f9	0953b49f-6af7-4347-a249-24c34997bf1d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
86cb478b-84f2-4216-99fb-ad0e039cf752	383f3f2f-3194-4396-9a63-297f80e151f9	0d33577d-027b-4a5d-b055-d766d2627542	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
1a63b2a8-4e22-457c-9e32-5e96b17703cd	383f3f2f-3194-4396-9a63-297f80e151f9	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
56ff7ca8-80c8-492d-89bb-fe35079ac3e2	383f3f2f-3194-4396-9a63-297f80e151f9	02932d66-2813-47b0-ae40-30564049a5ef	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
e290b880-8b49-4261-b170-044933d790e9	383f3f2f-3194-4396-9a63-297f80e151f9	a4ccc274-2686-4677-b826-95e0616f156d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
3f5d4425-cff1-475c-aca8-0bcd41a5800f	383f3f2f-3194-4396-9a63-297f80e151f9	a04fc678-94ae-42bb-b43b-38ce17d30faf	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
808fb7d8-3fe5-455a-86c6-0dab051c33ee	383f3f2f-3194-4396-9a63-297f80e151f9	1a8f1b99-a206-48d9-8170-23814b72c4cc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
174fa627-5b99-401e-98bf-68d74d74911c	383f3f2f-3194-4396-9a63-297f80e151f9	295fd56c-315c-4c82-9e20-fb571f376ddd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a6f38bb9-c191-4017-bddd-46766cc75f16	383f3f2f-3194-4396-9a63-297f80e151f9	a0099cf4-5479-4475-a86b-2f3d67995db8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
fb2118d6-b097-401c-93e2-5d78f25817ca	383f3f2f-3194-4396-9a63-297f80e151f9	dfbc0a35-28c7-4077-b9e6-08f3413ad130	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
19005db3-b466-4648-ad1c-189ac37506b0	383f3f2f-3194-4396-9a63-297f80e151f9	47dcd774-7cbf-4a87-94df-369d0abf9232	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
3272cb13-dd26-413d-9e9c-ba7aee6f5a05	383f3f2f-3194-4396-9a63-297f80e151f9	d2d84e05-c829-4c67-acec-3632e5f6515a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
6bf7bc1c-a5aa-48f4-81d4-63c45263116a	383f3f2f-3194-4396-9a63-297f80e151f9	0a421a5e-ad04-43ab-a539-2644d3ddabb0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
90b61140-46f7-42dc-9c05-8b28fe634b89	383f3f2f-3194-4396-9a63-297f80e151f9	f8705655-8e50-4159-b738-efdb7c92de1f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
be9bb8ef-a8fa-4aa7-8619-aae739e867f3	383f3f2f-3194-4396-9a63-297f80e151f9	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
4071fcfc-41d3-49b9-a996-37a5308fbe77	383f3f2f-3194-4396-9a63-297f80e151f9	81e51f8b-500d-4366-9360-3450dfa5ee4d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
59a3e391-55c9-475e-99a2-7deb308d250f	383f3f2f-3194-4396-9a63-297f80e151f9	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
5a1d9b3a-ec5c-4931-b9e2-4dff3ffbaa1d	383f3f2f-3194-4396-9a63-297f80e151f9	9297daf6-1431-4b62-9039-2ee22dcbba29	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
b133bcea-600f-4a72-bfa0-66e86b6c2393	383f3f2f-3194-4396-9a63-297f80e151f9	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9d63619e-787d-47a2-b442-56a541856a21	383f3f2f-3194-4396-9a63-297f80e151f9	f34e06ee-82cc-4a62-bd17-947c58f42116	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
99df5c63-acdb-4451-b921-3f6f07e47110	383f3f2f-3194-4396-9a63-297f80e151f9	38ccc597-1f09-4de4-ad38-b9cddd2256c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
bb7b1a54-d6d7-4f9e-82b0-e40182ce42ea	383f3f2f-3194-4396-9a63-297f80e151f9	70e897f5-c029-4382-9778-de9aa02b85d7	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
340de581-609e-4bac-a38e-869db120c3fb	383f3f2f-3194-4396-9a63-297f80e151f9	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
d156ddfb-48c8-4cee-86de-7744f5a0d79c	383f3f2f-3194-4396-9a63-297f80e151f9	834f193e-7023-48a7-bc8e-58a910845d6b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
fcd7c4fd-f628-4f48-8d7d-6c1437e82fe0	383f3f2f-3194-4396-9a63-297f80e151f9	e90ca965-4a55-433d-83c8-9de44b168b9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
388327ed-fa4c-4c27-b030-c1d62d0b84b6	383f3f2f-3194-4396-9a63-297f80e151f9	e8d65387-e415-4e52-bf95-4cf7134e2235	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
89551c81-e9b5-45f0-8227-d924c47e52e7	383f3f2f-3194-4396-9a63-297f80e151f9	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9b8e6390-33e7-4f92-a2c7-75b975b0e556	383f3f2f-3194-4396-9a63-297f80e151f9	66177523-edef-4bb4-9e47-1db421e14257	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
690f9475-23c3-4c04-a9e2-151113748beb	383f3f2f-3194-4396-9a63-297f80e151f9	fcd820ab-6f42-4794-8e6a-217faa6017ac	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
277cd671-2ffd-4b39-9f5c-1a6e37452fd3	383f3f2f-3194-4396-9a63-297f80e151f9	172fe5c4-06a1-435e-86e1-50a717ff1505	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9d4b4e49-05e5-40d8-b64d-61950270d774	383f3f2f-3194-4396-9a63-297f80e151f9	52fa7c54-7266-459b-b679-a4a0966dcca2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
76d61976-c364-4997-bd08-a4b805007d15	383f3f2f-3194-4396-9a63-297f80e151f9	ad04836f-3c39-4de5-ba1d-171dded4420b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
3ad06f8a-7105-4f15-a975-fa83076d16b7	383f3f2f-3194-4396-9a63-297f80e151f9	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
2aec356a-8052-45cc-9544-d87770b2027c	383f3f2f-3194-4396-9a63-297f80e151f9	9fab0497-b7b0-43af-8c94-ac59cf2d504a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
8f8c2003-5278-4a6b-b849-16f04acb9769	383f3f2f-3194-4396-9a63-297f80e151f9	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
da88d014-c784-4961-988f-ad157f299736	383f3f2f-3194-4396-9a63-297f80e151f9	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
31a717f2-ff50-46fc-9347-08901987aed1	383f3f2f-3194-4396-9a63-297f80e151f9	2069bcb9-4a3d-4462-8860-e39fe7327d4f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
dd5d721d-a414-4187-8348-cf6de287964f	383f3f2f-3194-4396-9a63-297f80e151f9	4b0170c2-6403-45f2-a9be-25e61595b48e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
4ab6239e-1fc9-4a0e-81f0-19f256ce7441	383f3f2f-3194-4396-9a63-297f80e151f9	db94e4b5-77ae-4459-8494-e31443458d7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
d99bfcc9-36d6-4619-b145-e169b80a970f	383f3f2f-3194-4396-9a63-297f80e151f9	fb7e9280-2b6f-429c-be0c-e4fa204755f8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
b94330e4-8531-4624-9f1e-06b123596e56	383f3f2f-3194-4396-9a63-297f80e151f9	9c06ea4c-d311-4249-a91e-09c14c66786a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
11951609-ff7b-484e-8ac0-98199c658f85	383f3f2f-3194-4396-9a63-297f80e151f9	38c264c0-26f6-4929-a52c-2277e2aaccce	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
d34f87a3-4914-46df-a4e0-6b37eb041c8b	383f3f2f-3194-4396-9a63-297f80e151f9	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
4ff966d3-65de-48bd-9316-5ac3175257c3	383f3f2f-3194-4396-9a63-297f80e151f9	1042f63e-2ebf-492c-87e8-2b7bdc69150d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
a92db9ca-600f-4d7a-9ed1-208710ae4937	383f3f2f-3194-4396-9a63-297f80e151f9	7c469d95-9f01-4295-ab59-fd3698ed7a36	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
b42f6c2b-c0a8-405a-95b7-ec9e55cf586f	383f3f2f-3194-4396-9a63-297f80e151f9	8d3556d9-f508-4a55-9f48-5c1aebc59de9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
3066023d-7344-4570-974f-3ee071508541	383f3f2f-3194-4396-9a63-297f80e151f9	04c59caf-4541-4e15-8c6e-d4a435967ef4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
1a696288-5b94-473a-8398-a829f7540d2a	383f3f2f-3194-4396-9a63-297f80e151f9	ade77569-3a72-4030-b2b4-11814fdd6b0a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
f01a3144-7d71-491e-81c9-88aa97438ec4	383f3f2f-3194-4396-9a63-297f80e151f9	8bd68779-d3a5-4372-b932-598273b735ef	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
61eee545-5d85-4fa7-b75a-d454e400709f	383f3f2f-3194-4396-9a63-297f80e151f9	251ebe60-b752-4467-aa22-0d46d5ae4953	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
212dfed5-38f4-46cd-851b-34aaa1d39220	383f3f2f-3194-4396-9a63-297f80e151f9	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
5748c5b7-c9e7-4461-aa16-8db5dc51644e	383f3f2f-3194-4396-9a63-297f80e151f9	9b0f7458-981e-4a78-9cc1-969130cfb358	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
02beb195-25a3-493c-ab18-40ca044fd7e9	383f3f2f-3194-4396-9a63-297f80e151f9	36ea8942-d4e1-44ed-a36c-33fb6e715560	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
be122c17-a68e-4736-9799-f5afb3b5bcaf	383f3f2f-3194-4396-9a63-297f80e151f9	c4944fca-068f-4ab5-8b9d-3b2493d785f2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
904f4be4-b345-4040-bab0-be5fcd2b4aa4	383f3f2f-3194-4396-9a63-297f80e151f9	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
32330596-02fd-4480-872c-e37f3b991f17	383f3f2f-3194-4396-9a63-297f80e151f9	c2066743-efa9-40b6-94b9-5b2b6e0942f3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
778acab7-1589-4890-a934-d1aef6e7878c	383f3f2f-3194-4396-9a63-297f80e151f9	5def1949-7a28-4715-8427-6cb028048712	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
aa0b5fae-53d2-43e2-97f0-1acfd6ba9d7f	383f3f2f-3194-4396-9a63-297f80e151f9	add83dad-b55a-4e07-ab2f-9c1828f310e6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
76118078-cbeb-4d8d-885e-2e6f89700a1c	383f3f2f-3194-4396-9a63-297f80e151f9	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
408c5e55-11b1-4b84-a7fc-34a6bd38ab22	383f3f2f-3194-4396-9a63-297f80e151f9	1a73dfdb-7333-4239-a6a6-7863010a6953	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
e58cdf68-716f-4556-a345-114b7ef4b2f6	383f3f2f-3194-4396-9a63-297f80e151f9	635f7357-f443-4723-994f-7a81dd5d165f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
c79dd161-b041-43d9-bff5-98f585ae3ce3	383f3f2f-3194-4396-9a63-297f80e151f9	1a291f0f-1525-4815-ba48-67acaf27dd7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.584	2026-01-27 19:13:38.584
9c0ddca4-fca7-4a18-ac08-b0c34715683f	383f3f2f-3194-4396-9a63-297f80e151f9	d2f92a82-754c-4dbf-9297-8222e71b7573	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
b519be9f-6ef0-4592-9fc0-b4212e0f36a2	383f3f2f-3194-4396-9a63-297f80e151f9	aec1a837-c291-452c-9ac6-425d9f9dca36	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
45e39f16-87fc-46df-a507-15dd90d7f364	383f3f2f-3194-4396-9a63-297f80e151f9	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
79ecc6d2-7238-490d-97fc-431622cd595c	383f3f2f-3194-4396-9a63-297f80e151f9	81cf9d60-063d-4054-8277-0fc6eaa042ee	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
ae6e3e58-b564-4469-b1c3-1e19deced544	383f3f2f-3194-4396-9a63-297f80e151f9	11859bb3-3249-4b3b-bc93-2236f608ff1e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
2debf6f7-f37a-463f-9ecc-c4f009da4970	383f3f2f-3194-4396-9a63-297f80e151f9	4e6637ef-7d36-459a-9cf9-bd485e521443	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
435f20de-4156-41d7-9fd2-3d06a2271b2f	383f3f2f-3194-4396-9a63-297f80e151f9	1e00e441-4e0a-4c95-a147-d5ba83dc7883	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
9d171aa5-d1d6-4bd4-86a1-78d6820fd1ef	383f3f2f-3194-4396-9a63-297f80e151f9	2af622c9-671a-4992-8b66-085781d11864	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
41fca4ba-e96c-4c48-a412-6ba107e75045	383f3f2f-3194-4396-9a63-297f80e151f9	fda4281b-edb1-4bc4-8b80-86653209240b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
6bcf7661-f60c-4ea0-aa28-f41d7b0aa1d4	383f3f2f-3194-4396-9a63-297f80e151f9	1ad39315-d1f4-4655-84f0-db922eac7e1f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
63c6d3fc-a8d7-42f3-b3b6-90c4407dc0ff	383f3f2f-3194-4396-9a63-297f80e151f9	6bda2acd-5f00-4100-b31a-0de28d40a7c0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
4ba66e4a-2746-4957-ae81-62227ae1260f	383f3f2f-3194-4396-9a63-297f80e151f9	29569e45-ea36-4138-83a3-80b85ba9ba1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
da030dde-4d43-4a7f-87db-341a4cd4957b	383f3f2f-3194-4396-9a63-297f80e151f9	37afad6a-c579-4b34-8042-c3aa708227b9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
05adcc76-03f0-47a4-94e5-2fb25e8c895f	383f3f2f-3194-4396-9a63-297f80e151f9	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
774f87e7-2f5a-45cc-a55b-9307ba3b22d3	383f3f2f-3194-4396-9a63-297f80e151f9	c4233e6e-d7a3-4018-aff0-5415b06ef15b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
74660fe8-b6e6-4e15-a4fe-165a9e8f1da7	383f3f2f-3194-4396-9a63-297f80e151f9	c93e39fe-759b-4db1-bd9a-230c1f930a7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
e0a0377f-179d-4671-b3b9-065099059750	383f3f2f-3194-4396-9a63-297f80e151f9	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
b479dc86-8be9-497e-b5b3-84d3f90bc953	383f3f2f-3194-4396-9a63-297f80e151f9	583c470c-9284-4b66-a009-81ffab8bda1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
50d15d7d-7ef0-46eb-9bce-a937257c1b1e	383f3f2f-3194-4396-9a63-297f80e151f9	6c387ed5-533e-4d6c-915f-72a85bc28c14	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
a3831b64-458d-454a-9ad3-8425b53ef370	383f3f2f-3194-4396-9a63-297f80e151f9	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d1981a64-02e9-4725-9fed-0871608d4e9d	383f3f2f-3194-4396-9a63-297f80e151f9	90a8f117-bde3-4070-8165-95116ddb6c78	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
36d44400-57af-491e-9e20-d299c49ca931	383f3f2f-3194-4396-9a63-297f80e151f9	78331efc-59a3-49c6-a4da-cd971800b07b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f387086b-217b-4030-bded-e5ea5e699083	383f3f2f-3194-4396-9a63-297f80e151f9	10cd0a5a-934b-4541-900f-61c5400cb33e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f9c0968f-e102-4720-b700-b0e23f5348ee	383f3f2f-3194-4396-9a63-297f80e151f9	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d81e1386-fc16-4fd8-83a7-2464d091ea47	383f3f2f-3194-4396-9a63-297f80e151f9	9c6b3dbf-9144-4d72-9c8c-c9984731beec	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
c00c181a-9041-4e97-9186-43669037a698	383f3f2f-3194-4396-9a63-297f80e151f9	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d9b36adc-926e-4aa4-bd25-f8ee97ebcefe	383f3f2f-3194-4396-9a63-297f80e151f9	d9295f16-be88-4756-8f6e-1cf4764be20a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
92d72fe9-42b6-470b-92d2-c9b4549e8988	383f3f2f-3194-4396-9a63-297f80e151f9	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
6cc9a25b-99ca-4a54-8c05-1dea2a3d4ee9	383f3f2f-3194-4396-9a63-297f80e151f9	e67b4538-7412-45c0-a0cf-e27bff88caab	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
c099369a-0d0c-4107-9de9-4078ac6cf70f	383f3f2f-3194-4396-9a63-297f80e151f9	b24c16bb-ff27-4814-b9d7-523fd69d9b41	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
8184dba1-dfef-4905-bce4-1af5311eb300	383f3f2f-3194-4396-9a63-297f80e151f9	1cb61161-23ca-4336-806e-61086d967a67	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
6c62ed05-b5eb-4cbb-a88c-87d9cbf307d7	383f3f2f-3194-4396-9a63-297f80e151f9	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
7dda11ae-cfbf-42b0-a81f-cb2ddaa0ee18	383f3f2f-3194-4396-9a63-297f80e151f9	278cade5-e251-4520-9394-cdd42c9212e6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
69265814-f66c-4bb1-90ca-8c1f742cd2a6	383f3f2f-3194-4396-9a63-297f80e151f9	b5966924-f09e-4024-8942-8f2e00949567	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d8dd6a75-fd7d-4f27-ac47-eb7008c12c9d	383f3f2f-3194-4396-9a63-297f80e151f9	d1627009-fe55-469a-baf7-1a8b4979d654	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f1bb8622-adbd-4a74-8bc6-1b0b8a178284	383f3f2f-3194-4396-9a63-297f80e151f9	f5804675-69c7-4b68-9dc6-22dea1f5201a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
5deec47f-1345-42c2-8fea-772aeea36606	383f3f2f-3194-4396-9a63-297f80e151f9	4a7446ad-a670-4e50-82dd-e71d2013d520	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f652210b-74ff-4950-b390-1c9fc6e8be76	383f3f2f-3194-4396-9a63-297f80e151f9	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
e9d56764-54e4-435b-a989-aa2fb18344ab	383f3f2f-3194-4396-9a63-297f80e151f9	6915f34b-6468-4e75-a1d9-dbeee0529cb8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
b0eb1500-3c82-4846-b102-2fba76348e0a	383f3f2f-3194-4396-9a63-297f80e151f9	e4778ab5-7678-46d9-baea-0368e4f812f0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d4dfe070-b359-4870-8af0-9b56ee9ee6ea	383f3f2f-3194-4396-9a63-297f80e151f9	cf4be8bf-0906-4925-8291-6c8c785dcef4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
1e38a8e3-e12a-4c12-adfd-0ef1821b5292	383f3f2f-3194-4396-9a63-297f80e151f9	0b038769-9d16-464d-85e6-fed33a40579a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f3361fe5-c173-4673-bd63-bb31f98f2851	383f3f2f-3194-4396-9a63-297f80e151f9	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
753527be-4c4f-491a-bb1c-74395c023777	383f3f2f-3194-4396-9a63-297f80e151f9	027e9c43-d25b-4cb5-b4c9-916084271623	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
8c284771-424a-4a1c-b8a5-ee23d67ecd0f	383f3f2f-3194-4396-9a63-297f80e151f9	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f373421a-5f5e-40f8-9b4e-c4661380d414	383f3f2f-3194-4396-9a63-297f80e151f9	7d0f9dbd-4909-491d-9440-5f87bca5a254	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
c5312ac1-01e4-4ea9-9df5-a41b7bfd30d7	383f3f2f-3194-4396-9a63-297f80e151f9	aa0a06e7-d580-47b2-bc2e-cddd466186cb	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
c8891037-b762-496a-bef2-b2b8b1fa9700	383f3f2f-3194-4396-9a63-297f80e151f9	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
8fedd218-b650-4828-a612-49cda80b1aa5	383f3f2f-3194-4396-9a63-297f80e151f9	fa0dcd21-865b-4de3-a315-83af78061b4a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
2f2191e9-e536-451e-909f-2f9c55885cc6	383f3f2f-3194-4396-9a63-297f80e151f9	69b81a70-6fa3-4533-9d00-c252f0f6245f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
66763685-d88c-46b1-a5a5-397f4c8bb558	383f3f2f-3194-4396-9a63-297f80e151f9	360b9bee-d159-4e20-ba1f-9681d17cf9bc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
4c4f00a1-3a2b-49aa-93bd-e6901d157542	383f3f2f-3194-4396-9a63-297f80e151f9	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
823af6ce-c717-4f60-acee-9d07127dddf5	383f3f2f-3194-4396-9a63-297f80e151f9	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
18638c84-aefd-4dae-af82-a7e84d41e984	383f3f2f-3194-4396-9a63-297f80e151f9	b19145e9-2513-41c3-b2a7-719588692eed	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
408b99e1-715c-40c8-a7ae-d3a69eb20b33	383f3f2f-3194-4396-9a63-297f80e151f9	e6fffac1-4aad-4ce4-9981-3983dde344d3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
5c7765f9-bd53-48fc-9c93-d04e2a7fece0	383f3f2f-3194-4396-9a63-297f80e151f9	32c804e1-e904-45b0-b150-cdc70be9679c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
d240fac3-d068-41e8-b77e-7d1e3a036d0d	383f3f2f-3194-4396-9a63-297f80e151f9	16d101ea-c92f-44b0-b7dc-11cd3680215c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
9abc7644-edc3-429b-9118-45d3b39c5bb0	383f3f2f-3194-4396-9a63-297f80e151f9	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
96f9ca2d-faf4-4b32-9297-23996bd3b72c	383f3f2f-3194-4396-9a63-297f80e151f9	778ec216-a84f-41c7-a341-9d04269f0dc6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
25fab8fb-4d8b-4697-8084-a9edfa4eedf2	383f3f2f-3194-4396-9a63-297f80e151f9	ed459bf2-7e56-4eca-bc6b-cee6655c644a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
c34c6fc2-aa83-42dd-ae94-88e1890ad855	383f3f2f-3194-4396-9a63-297f80e151f9	9f38de93-8d44-4760-9152-372666596d56	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
de683893-2426-4ed1-b982-2a21f016871f	383f3f2f-3194-4396-9a63-297f80e151f9	eadf502a-97e3-44fc-b07c-0f7015cb598a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
81fc2335-8b79-43e6-81aa-70fbdebd93a1	383f3f2f-3194-4396-9a63-297f80e151f9	c21d204c-4660-41e7-93c8-d895ddbaab26	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
3779feef-1c80-43dd-8f9a-9794864ade22	383f3f2f-3194-4396-9a63-297f80e151f9	31dec1f6-7abb-4742-ade1-42b89ad7766a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
ea0176e4-6e04-4949-99ba-59462faf3c74	383f3f2f-3194-4396-9a63-297f80e151f9	b182931c-6229-4be3-bde7-ef6126032f52	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f40ff71e-687a-4c51-afa3-36cecd7b1328	383f3f2f-3194-4396-9a63-297f80e151f9	93421fdb-364d-418e-898a-a1f62dd8020a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f6acf6e0-2d11-4308-b7b8-c8acc0997b04	383f3f2f-3194-4396-9a63-297f80e151f9	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
1aa34f09-8997-4911-8360-449814190634	383f3f2f-3194-4396-9a63-297f80e151f9	071a36ac-c2e2-4462-b10d-3175b101bd06	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
1db06cd6-1e07-47cb-bf66-37e6b6809de1	383f3f2f-3194-4396-9a63-297f80e151f9	734f6aa9-6ade-4187-b3b3-2cba78068a34	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
7ea7b89b-9ee8-4975-99eb-dc0f9dde819f	383f3f2f-3194-4396-9a63-297f80e151f9	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
586ae53b-2f11-4818-a73f-9fb203da7f96	383f3f2f-3194-4396-9a63-297f80e151f9	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
1db25392-8f41-49cd-b557-80f5d9508b13	383f3f2f-3194-4396-9a63-297f80e151f9	32898e2d-148e-4483-9e74-6fca3a3eed62	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
91d2cba6-689d-40c5-b4fe-9b2853f67c0c	383f3f2f-3194-4396-9a63-297f80e151f9	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
e58ff30a-d198-484b-8af9-dc8d2565309d	383f3f2f-3194-4396-9a63-297f80e151f9	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
678089d7-558c-4d2c-957a-436414cd590b	383f3f2f-3194-4396-9a63-297f80e151f9	7a27fe64-579c-4653-a395-4ead4e3860df	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
30ab3f14-5251-4fbe-ac6d-564e1fcbd447	383f3f2f-3194-4396-9a63-297f80e151f9	8504d304-1734-41d3-8e1c-8e6765cbf3d9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
4b5d9acf-5009-4992-be93-a10072547835	383f3f2f-3194-4396-9a63-297f80e151f9	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
42f13792-c5be-4c37-9663-ea4c0edeb33e	383f3f2f-3194-4396-9a63-297f80e151f9	5663e510-84a4-4116-86dd-dfaf709165e2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
12820a50-c061-4c59-87fe-dec94ac44b1f	383f3f2f-3194-4396-9a63-297f80e151f9	12663a56-2460-435d-97b2-b36c631dd62f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
42805f43-ef93-43f0-988e-a7e3a9f46615	383f3f2f-3194-4396-9a63-297f80e151f9	11b13f4a-d287-4401-bd76-82a3b21bbbb6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f307754a-5b09-4817-864e-7e19c652eb99	383f3f2f-3194-4396-9a63-297f80e151f9	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
baed6321-c66f-4b1c-92b8-56de8a0b636c	383f3f2f-3194-4396-9a63-297f80e151f9	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
3c154e24-a04d-42c1-92bc-618a1ddc121a	383f3f2f-3194-4396-9a63-297f80e151f9	4220515f-01f8-40d5-846d-b4a7f5aa460b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
28f61f97-e2de-4f51-aae3-2ef20f5dd98a	383f3f2f-3194-4396-9a63-297f80e151f9	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
7d8347c4-f665-4bbb-a2a2-4e085dbd06fe	383f3f2f-3194-4396-9a63-297f80e151f9	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
6b5af4d1-823c-4ff2-82ff-d011dd6aa911	383f3f2f-3194-4396-9a63-297f80e151f9	cd47199a-6751-4135-a27a-3d4719b9ef1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
05cf0d58-9060-4a22-afae-50a6bb1e1225	383f3f2f-3194-4396-9a63-297f80e151f9	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
73d6e067-df53-4b15-b0de-f543a1fe954d	383f3f2f-3194-4396-9a63-297f80e151f9	c86565cd-7ab2-4c4a-9152-f911e8eae236	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
661387d9-dda1-4f42-93da-59c8d0a9adad	383f3f2f-3194-4396-9a63-297f80e151f9	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
83d8a1b9-bb5b-4195-b9f3-0d82a4e792d9	383f3f2f-3194-4396-9a63-297f80e151f9	f43eb3e8-8708-4656-aae2-d21e33812610	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
78d80804-39fa-4695-800c-85f47494e10e	383f3f2f-3194-4396-9a63-297f80e151f9	28748534-0496-4c62-8647-6af5f01fc608	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
de813652-74d8-452d-a05f-00533df958e3	383f3f2f-3194-4396-9a63-297f80e151f9	4c239c57-b3c6-4988-a698-6908b26d0e19	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
49087077-3b38-44ed-afea-a6e8c82420e2	383f3f2f-3194-4396-9a63-297f80e151f9	493436bd-ca41-4359-8d8a-0d690ee7fc29	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
4e570a1a-f38c-427d-9200-c6f712c4a99b	383f3f2f-3194-4396-9a63-297f80e151f9	fe3d87aa-c40a-468d-8e3f-239029a5919d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
31ac5799-6068-439f-a9ed-926322d277a2	383f3f2f-3194-4396-9a63-297f80e151f9	b52c3226-dc94-4289-a051-b7227fd77ae8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
eb36e115-e5d6-4d6e-9578-f93d0198fc1e	383f3f2f-3194-4396-9a63-297f80e151f9	7050c97c-b57f-490f-90a9-d8601fcb3852	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
bab5dcf8-248f-48b3-bdf0-7f55f4f2273e	383f3f2f-3194-4396-9a63-297f80e151f9	60fc24d8-ef72-4107-8519-429969f3a05b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
118ee9d4-e25f-40a8-9246-cc532398981b	383f3f2f-3194-4396-9a63-297f80e151f9	db419a02-b502-47b6-bf78-ca8e5cc0db52	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
9fd0aae7-6887-4d6d-b41d-68da1b727f1a	383f3f2f-3194-4396-9a63-297f80e151f9	913edefa-4e9b-4792-bddf-5739e52946f3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
39dc1f05-118b-4321-8442-6f45112e2c23	383f3f2f-3194-4396-9a63-297f80e151f9	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.592	2026-01-27 19:13:38.592
f4fcf229-e26e-4e33-92aa-0521bed01b50	383f3f2f-3194-4396-9a63-297f80e151f9	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
f708754b-09b4-4ffc-bc91-f95f2effae19	383f3f2f-3194-4396-9a63-297f80e151f9	81aabfd3-329b-4346-848b-5bea91a93fc1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
b9cc2a37-837d-4c32-bca1-056e93c872db	383f3f2f-3194-4396-9a63-297f80e151f9	fea93ffa-2056-42bd-984d-d35e5d8999a3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
1389c046-f498-40ad-9b99-f1d21e64ba2f	383f3f2f-3194-4396-9a63-297f80e151f9	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
beb79cd2-c08b-4c3f-b12b-4da6a7e60680	383f3f2f-3194-4396-9a63-297f80e151f9	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
594451fc-91d7-4a04-9c05-886f6ec33b3a	383f3f2f-3194-4396-9a63-297f80e151f9	e76be943-41ac-4c14-980c-603a3652643f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
4fedd724-87ce-4d59-be52-4a14c49a5f32	383f3f2f-3194-4396-9a63-297f80e151f9	3ce0f539-13c5-412d-8301-2ba191ea3328	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
bc142ecd-2a8c-4219-885d-0fe7ffda69dd	383f3f2f-3194-4396-9a63-297f80e151f9	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
8cd62d2d-fa0f-4944-9e7f-4066ace54f03	383f3f2f-3194-4396-9a63-297f80e151f9	623da6ff-cb25-4a58-bafa-da9088cfb606	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
87aee927-205e-48f5-b222-658639c07010	383f3f2f-3194-4396-9a63-297f80e151f9	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
38c30b9c-9c7c-4939-a353-f641df92b162	383f3f2f-3194-4396-9a63-297f80e151f9	b0ca323f-43b7-4020-b9f0-307751da0b74	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
2825fd30-6908-4efe-b2ff-b2089bd477d5	383f3f2f-3194-4396-9a63-297f80e151f9	1c02ee54-327e-464f-b249-54a5b9f07a95	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
de0a612e-f47b-405a-aa16-d5901fab5ea1	383f3f2f-3194-4396-9a63-297f80e151f9	1a8acd2c-9221-47e0-92f6-35f89fa37812	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
b8f748ee-a77c-49d5-b1cf-7d44dadd9c83	383f3f2f-3194-4396-9a63-297f80e151f9	8432f245-2bb6-4186-a3fd-607dee8bfbb3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
6fe5bc51-ebd1-450b-b57c-e51d76dfcd63	383f3f2f-3194-4396-9a63-297f80e151f9	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
89213d21-c58b-4e0d-9b2f-023e97288357	383f3f2f-3194-4396-9a63-297f80e151f9	9d0c0a31-5443-434e-ade3-843f653b13a5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
d7fafa90-860f-4008-aec3-4ffa182d0fd0	383f3f2f-3194-4396-9a63-297f80e151f9	15adee7a-c86c-4451-a862-6664e4a72332	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e62210b7-82e6-4943-9446-88bb9338f1c3	383f3f2f-3194-4396-9a63-297f80e151f9	9871b276-3844-46c3-8564-243c81bfc26e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9fac0bcd-4ef2-4165-88bb-0c3d6e3776a3	383f3f2f-3194-4396-9a63-297f80e151f9	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
cdc3f46c-7e9e-4a12-9a39-c3a20ae19c2c	383f3f2f-3194-4396-9a63-297f80e151f9	441dc9df-8866-4dcf-8f81-c8957513ddaa	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
28d451f2-c980-4e14-9879-600c1681716b	383f3f2f-3194-4396-9a63-297f80e151f9	6f57f96c-4e83-4188-95b1-4a58af42d368	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
27558ed0-3520-40f1-88be-87eccd35d34a	383f3f2f-3194-4396-9a63-297f80e151f9	2e568ea8-6aab-4e76-b578-8fc44b566d00	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9dd53457-3199-4791-9385-f514d5b8eba0	383f3f2f-3194-4396-9a63-297f80e151f9	92ddb36f-34ee-4f99-8da8-f52d78752b40	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e8a0e9b7-c91a-4bc7-991c-cf21ee343604	383f3f2f-3194-4396-9a63-297f80e151f9	d2a87d3c-d4f5-4728-a702-d520d52f8efc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
4e4ac12c-ca49-44a8-be8e-1a3cc23860e3	383f3f2f-3194-4396-9a63-297f80e151f9	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
8dcd4a9c-6173-45ab-a9b1-88452f419314	383f3f2f-3194-4396-9a63-297f80e151f9	6f00304d-9dd1-4a86-b25e-96ffc4c96245	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
d7c6eab6-dad1-4c18-b2b1-53bf5a678dad	383f3f2f-3194-4396-9a63-297f80e151f9	29535a71-4da7-4d9e-8a1a-088498c25104	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7dde4f2e-18b0-4146-973b-d209167b5b12	383f3f2f-3194-4396-9a63-297f80e151f9	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7370e2bb-2f29-42a0-a153-8fadb37862b7	383f3f2f-3194-4396-9a63-297f80e151f9	53179e6b-42df-45fb-808e-06635445f0a3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
8e7f8069-6da5-4dcf-9920-3ff203311c88	383f3f2f-3194-4396-9a63-297f80e151f9	01bfbc25-4974-4e1d-a039-afc1ab9350a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
8bb3dab8-b176-4a3a-8f79-73de4f262e8c	383f3f2f-3194-4396-9a63-297f80e151f9	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
29c03a6a-8583-4907-b7c5-fe87a44ee17f	383f3f2f-3194-4396-9a63-297f80e151f9	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
baaefa64-dc93-4e70-9859-204348618914	383f3f2f-3194-4396-9a63-297f80e151f9	49845113-2ada-42b3-b60e-a10d47724be3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
b68980a4-9f03-4210-8673-9c64f308abfd	383f3f2f-3194-4396-9a63-297f80e151f9	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
f56d50e3-70d6-449b-a3a7-4ae48509871b	383f3f2f-3194-4396-9a63-297f80e151f9	23525539-5160-4174-bf39-938badb0bb75	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
d673f177-ce16-4c9d-aa15-6ed33685cb77	383f3f2f-3194-4396-9a63-297f80e151f9	45b02588-26f2-4553-bb6e-c773bbe1cd45	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
73fbd169-db6f-4fe9-88c2-770e5b470cc2	383f3f2f-3194-4396-9a63-297f80e151f9	18bed42b-5400-452c-91db-4fb4147f355f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
b11c163c-b856-45e0-a95c-a8f541be7a60	383f3f2f-3194-4396-9a63-297f80e151f9	5849ff0b-a440-4ab2-a389-b4acc0bf552e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
214c9db3-8240-4a21-a8ec-d4c67018d5fd	383f3f2f-3194-4396-9a63-297f80e151f9	aba9bce3-2155-4621-b4b0-3cf669cad3b2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c22aba62-43d9-44a1-9c5b-52dcc5784a4a	383f3f2f-3194-4396-9a63-297f80e151f9	2dd84bba-57aa-4137-b532-5e40df1f9818	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
24e9720d-d58e-46b7-80de-acd254404611	383f3f2f-3194-4396-9a63-297f80e151f9	02bf47ac-626f-45f7-910b-344eab76bc24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7c808a66-8a7b-44c6-8bb0-0f9c5268753f	383f3f2f-3194-4396-9a63-297f80e151f9	c022b4da-2739-428a-8169-4522791ac94e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
188a3e26-d9e6-4b00-8322-fe1711f5552d	383f3f2f-3194-4396-9a63-297f80e151f9	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7c690bd5-fe41-4728-97c6-195e07f3a58a	383f3f2f-3194-4396-9a63-297f80e151f9	8d49f450-e103-4b29-8e22-2e14306ae829	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
85741e76-0823-43dd-99ac-c612c469660e	383f3f2f-3194-4396-9a63-297f80e151f9	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c1314e40-153e-4684-86a5-b6c311bc49a2	383f3f2f-3194-4396-9a63-297f80e151f9	6b142850-4553-451e-a6cb-3cb9fe612458	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
92cd236f-62ea-4177-a770-b6832f65c28e	383f3f2f-3194-4396-9a63-297f80e151f9	5029f19f-04e8-4c22-baaa-abc4410face3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c56cf4d7-c600-449c-948a-350945da97a7	383f3f2f-3194-4396-9a63-297f80e151f9	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
2ab9cb36-416a-41e3-ac12-1b55ce700477	383f3f2f-3194-4396-9a63-297f80e151f9	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
f38743a8-c33a-4139-858c-30476215e6df	383f3f2f-3194-4396-9a63-297f80e151f9	3a237a3a-4394-48e9-87c4-334c87d1b6a1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7d6690e2-94df-4ea6-ab0a-5da6e9b316cc	383f3f2f-3194-4396-9a63-297f80e151f9	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
2f8874bf-902f-42cd-9eaa-4ac5546339ce	383f3f2f-3194-4396-9a63-297f80e151f9	00160b54-fdf1-48d1-9b52-52842dc8df4e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
bba05c51-cf0f-4971-80fc-ba6a72aa83c1	383f3f2f-3194-4396-9a63-297f80e151f9	29e9b502-fde8-4a8f-91b6-ff44f8d41479	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e6d0cbcd-c737-4fda-9f98-268e66590e58	383f3f2f-3194-4396-9a63-297f80e151f9	ca6e0150-9d34-403c-9fea-bb1e35d0e894	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
5de51a75-8764-4dfb-8a56-7f38130116c2	383f3f2f-3194-4396-9a63-297f80e151f9	16743e3d-672d-4584-9a3c-5d76ae079569	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ddfa5ea8-8e9d-43e7-bfc0-94c36e0d45fc	383f3f2f-3194-4396-9a63-297f80e151f9	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
003c23d7-f1e2-4cda-ae5e-00d4f3c5f70a	383f3f2f-3194-4396-9a63-297f80e151f9	372b482c-fcb8-405d-a88a-5d2ee5686e30	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
342c68b8-135b-4d21-b59e-4e184c837815	383f3f2f-3194-4396-9a63-297f80e151f9	c47cf3e0-e149-4834-b454-5fd4d583a1a7	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
a6512793-90b9-4a9b-98f3-a18ef8180a98	383f3f2f-3194-4396-9a63-297f80e151f9	d7b7595d-a831-48ec-84d4-39476bc3e44a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
27d6e634-aa82-42fd-8dd9-7263af37e6f2	383f3f2f-3194-4396-9a63-297f80e151f9	0690e264-ed8b-48b3-8930-5651eebe2e2e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ce8fc6ac-6217-48ea-870b-90fcda5b592f	383f3f2f-3194-4396-9a63-297f80e151f9	b969a964-3765-4744-8080-3e2c88ab688e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
2502e5d1-d644-4bb8-a2b2-bbb8161bc1ef	383f3f2f-3194-4396-9a63-297f80e151f9	6750bd19-7115-4966-b7db-0d8e2add036a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
88ee4fa6-a384-47a0-a5a6-d65a7087643d	383f3f2f-3194-4396-9a63-297f80e151f9	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
1057c465-864b-4a9a-9e4b-b5d50c5e7945	383f3f2f-3194-4396-9a63-297f80e151f9	2afa78a2-892a-4dfb-9098-7926491b648f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ac4480aa-31be-46d3-971f-f1cba1c217fd	383f3f2f-3194-4396-9a63-297f80e151f9	374edfb0-e4ae-4625-af63-a14d4cb48f9b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
0acdc1ab-474b-4731-93cf-b1dcf587f6ba	383f3f2f-3194-4396-9a63-297f80e151f9	d9f8f427-d02c-4a3a-9091-0a442685cf72	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c08b5046-d9d7-4475-9ca3-95ce8af83391	383f3f2f-3194-4396-9a63-297f80e151f9	9b28e1e2-badb-4a9d-88d4-84f5612934e5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
bc0943b9-3f4b-4d62-937d-a365e96303a2	383f3f2f-3194-4396-9a63-297f80e151f9	d4b1799f-245c-44e7-bc89-1eec59a28c9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
55857a7d-20e0-4c2b-96d7-c2a18deedbaa	383f3f2f-3194-4396-9a63-297f80e151f9	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
61b0110f-dcee-43cd-8a96-958b12750b7b	383f3f2f-3194-4396-9a63-297f80e151f9	1a810543-4218-41a4-90ba-9e3743f077fa	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ac3fe4c0-ade6-4403-8581-10b333730f91	383f3f2f-3194-4396-9a63-297f80e151f9	09827071-8a30-42ac-898c-59a6fe9f0c75	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
a61609f8-d9f8-4170-87f2-4a8902669508	383f3f2f-3194-4396-9a63-297f80e151f9	59996c9e-0bc9-4120-bee1-3f0455f81725	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e9e486cb-d798-45bb-90f4-3bdd964f5c4f	383f3f2f-3194-4396-9a63-297f80e151f9	d36af823-920c-47ab-965e-4ab698621052	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9b3314d7-aa0e-4895-9e1e-d27b4971e858	383f3f2f-3194-4396-9a63-297f80e151f9	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c9e4a14d-5e91-4c22-bcab-37affec6b008	383f3f2f-3194-4396-9a63-297f80e151f9	2d3e7958-5f64-4312-abe6-0af811e901c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ea985124-0e7d-4352-8858-f369cecfca33	383f3f2f-3194-4396-9a63-297f80e151f9	92b916e1-6a0b-4498-9048-3901b27bec39	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
97c02d41-eb60-4b0c-8ebc-9f1209ea72d6	383f3f2f-3194-4396-9a63-297f80e151f9	7f87bc22-635b-416a-8722-53c1ee704f0c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e96f17c8-40e9-4fe9-973d-a2163ae5a589	383f3f2f-3194-4396-9a63-297f80e151f9	d65b2853-a79d-401a-8f05-adf2743b9162	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
8e5a9396-6e80-410d-a5ef-4b9926921ad2	383f3f2f-3194-4396-9a63-297f80e151f9	5f946046-e498-403d-a64a-6933c7bd6896	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
359c257b-e9f9-45e4-b8ed-10bb3966a653	383f3f2f-3194-4396-9a63-297f80e151f9	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9d99250c-294e-46ef-8102-c3a3f2aa43b4	383f3f2f-3194-4396-9a63-297f80e151f9	c6db06ec-612a-4dc3-bbc6-7c153e90994c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
ed7f67a0-be52-45e9-8105-5f659a22b192	383f3f2f-3194-4396-9a63-297f80e151f9	f410965b-b444-4df5-bfd6-e138109567a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9a506179-df95-4667-8732-c5417f9d1f98	383f3f2f-3194-4396-9a63-297f80e151f9	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
2a2f39b0-5dca-4ec3-bebc-1ce7fd3b3ef0	383f3f2f-3194-4396-9a63-297f80e151f9	edccde66-49d6-459e-94e7-02b99477d24c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
7c0a1fab-968c-4ed3-835b-73c9857c507d	383f3f2f-3194-4396-9a63-297f80e151f9	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
6027dae6-2c83-4d73-82ec-7398e82286e3	383f3f2f-3194-4396-9a63-297f80e151f9	f3da6061-0490-40ac-bdec-10e862ef1296	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
f4e23e20-60b6-47bd-af08-494781166781	383f3f2f-3194-4396-9a63-297f80e151f9	8e9ff64e-0787-4e03-9835-e833ca96ed46	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
9a100e30-67ee-4e10-8705-b3ee5ebd81a4	383f3f2f-3194-4396-9a63-297f80e151f9	b54125c1-a96c-4137-9e7a-c197421d99b3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
de68489a-006f-4be7-9513-a65a98d35c6f	383f3f2f-3194-4396-9a63-297f80e151f9	bebb0636-e19e-40a8-8733-18aa11ba1e13	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
535ecbfb-14d0-4705-922b-77814da75cfb	383f3f2f-3194-4396-9a63-297f80e151f9	6432d484-b4a5-427f-a12a-59303f1e50ee	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
65327e3c-0e3c-4ea7-82c8-6f291340fadb	383f3f2f-3194-4396-9a63-297f80e151f9	4f96dd8e-6915-481e-aebb-672f83b45aa1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
a2266b89-9402-4c6f-8105-8cc51aa54f31	383f3f2f-3194-4396-9a63-297f80e151f9	88f85444-56fd-4596-a6f3-84e3dde28513	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
bae429b9-40ea-476a-8802-5f032eda998f	383f3f2f-3194-4396-9a63-297f80e151f9	0953b49f-6af7-4347-a249-24c34997bf1d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e19dbe03-c479-4de0-8dcf-3eef718b1e94	383f3f2f-3194-4396-9a63-297f80e151f9	0d33577d-027b-4a5d-b055-d766d2627542	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
4298b63c-1ced-40b6-beb0-b9ce006e5d80	383f3f2f-3194-4396-9a63-297f80e151f9	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
c53f6072-f972-4eab-9d9c-a8bbe9f3e8fc	383f3f2f-3194-4396-9a63-297f80e151f9	02932d66-2813-47b0-ae40-30564049a5ef	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
75aecc03-f17c-4bda-8b42-642baac7ec49	383f3f2f-3194-4396-9a63-297f80e151f9	a4ccc274-2686-4677-b826-95e0616f156d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
62d43c7d-e20c-4f20-83de-b28e23d4b2de	383f3f2f-3194-4396-9a63-297f80e151f9	a04fc678-94ae-42bb-b43b-38ce17d30faf	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
5ea56318-1d27-4eec-92e4-7b4512996f2f	383f3f2f-3194-4396-9a63-297f80e151f9	1a8f1b99-a206-48d9-8170-23814b72c4cc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
748a498d-780f-4cb4-9ccc-32f18b687c34	383f3f2f-3194-4396-9a63-297f80e151f9	295fd56c-315c-4c82-9e20-fb571f376ddd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.599	2026-01-27 19:13:38.599
e2a4ccbb-9361-4f9b-8d36-1f429def8987	383f3f2f-3194-4396-9a63-297f80e151f9	a0099cf4-5479-4475-a86b-2f3d67995db8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
531b996b-cbd5-4e37-8536-ca0970b13a28	383f3f2f-3194-4396-9a63-297f80e151f9	dfbc0a35-28c7-4077-b9e6-08f3413ad130	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
f3a212e4-7331-440f-8991-1fd298c86b40	383f3f2f-3194-4396-9a63-297f80e151f9	47dcd774-7cbf-4a87-94df-369d0abf9232	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
91d62195-21d2-4508-9449-1ee3f96f6ef9	383f3f2f-3194-4396-9a63-297f80e151f9	d2d84e05-c829-4c67-acec-3632e5f6515a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
36a3f25b-8f49-4d23-a54c-0d50b962241c	383f3f2f-3194-4396-9a63-297f80e151f9	0a421a5e-ad04-43ab-a539-2644d3ddabb0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
74b990fd-68df-4e08-b968-ed7cad9ed3a8	383f3f2f-3194-4396-9a63-297f80e151f9	f8705655-8e50-4159-b738-efdb7c92de1f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
97a0bb6a-3449-4465-84e0-23f73e46637c	383f3f2f-3194-4396-9a63-297f80e151f9	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
fb00a693-5d4a-4188-9da1-9dbb65ee5b63	383f3f2f-3194-4396-9a63-297f80e151f9	81e51f8b-500d-4366-9360-3450dfa5ee4d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
6ff105b8-22de-476a-9441-ff25513b24b6	383f3f2f-3194-4396-9a63-297f80e151f9	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
47edaf03-34c8-4505-a8de-cea45ff45f8f	383f3f2f-3194-4396-9a63-297f80e151f9	9297daf6-1431-4b62-9039-2ee22dcbba29	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
46c154a9-7b9d-4a45-a24f-1794ef6787a5	383f3f2f-3194-4396-9a63-297f80e151f9	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
bc38f54f-68d4-4c51-934f-2b32df4ff89e	383f3f2f-3194-4396-9a63-297f80e151f9	f34e06ee-82cc-4a62-bd17-947c58f42116	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b224020d-d680-48c4-a60a-7264ae2e3845	383f3f2f-3194-4396-9a63-297f80e151f9	38ccc597-1f09-4de4-ad38-b9cddd2256c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
55aa77b1-4aca-4d18-b7e5-5ea53cc6d9d0	383f3f2f-3194-4396-9a63-297f80e151f9	70e897f5-c029-4382-9778-de9aa02b85d7	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
fcd016e4-6151-4c92-9e61-f8b1e5a57792	383f3f2f-3194-4396-9a63-297f80e151f9	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b8a5c492-6edd-46c9-b677-8af199628f30	383f3f2f-3194-4396-9a63-297f80e151f9	834f193e-7023-48a7-bc8e-58a910845d6b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
0c26a8aa-d036-4bc8-b72b-e87780bef9e4	383f3f2f-3194-4396-9a63-297f80e151f9	e90ca965-4a55-433d-83c8-9de44b168b9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
620714e2-3ab8-428f-93d6-af6226ca70ff	383f3f2f-3194-4396-9a63-297f80e151f9	e8d65387-e415-4e52-bf95-4cf7134e2235	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
4c84b059-bda9-4eaf-877f-a6286edba109	383f3f2f-3194-4396-9a63-297f80e151f9	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
970bca60-1f8c-4082-9bb2-9a5e2ff45827	383f3f2f-3194-4396-9a63-297f80e151f9	66177523-edef-4bb4-9e47-1db421e14257	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
757ae7d7-366a-4235-a82d-f7aab63393d5	383f3f2f-3194-4396-9a63-297f80e151f9	fcd820ab-6f42-4794-8e6a-217faa6017ac	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
f29f8e9c-9d7a-41b2-85de-17382093ed66	383f3f2f-3194-4396-9a63-297f80e151f9	172fe5c4-06a1-435e-86e1-50a717ff1505	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
298b69c9-9cd5-4949-a892-a413eef4d45d	383f3f2f-3194-4396-9a63-297f80e151f9	52fa7c54-7266-459b-b679-a4a0966dcca2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
6ccc45d8-b155-4564-9a72-b97c5b06364f	383f3f2f-3194-4396-9a63-297f80e151f9	ad04836f-3c39-4de5-ba1d-171dded4420b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b5a57bbb-6b57-4fb4-869d-860191431261	383f3f2f-3194-4396-9a63-297f80e151f9	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
250f80c2-adaf-44df-a442-f9db721fc18b	383f3f2f-3194-4396-9a63-297f80e151f9	9fab0497-b7b0-43af-8c94-ac59cf2d504a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
3bf068a2-f485-4091-bfda-a354e4bfa031	383f3f2f-3194-4396-9a63-297f80e151f9	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
fd8b9ffe-2b39-4118-b992-c9281190631b	383f3f2f-3194-4396-9a63-297f80e151f9	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
eeffdbda-b23d-45b6-a313-d91cc51dc16c	383f3f2f-3194-4396-9a63-297f80e151f9	2069bcb9-4a3d-4462-8860-e39fe7327d4f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
88e42bc0-2996-4f09-8008-cd138024b271	383f3f2f-3194-4396-9a63-297f80e151f9	4b0170c2-6403-45f2-a9be-25e61595b48e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
949ff88c-08a4-4bd8-9a46-dd081e238406	383f3f2f-3194-4396-9a63-297f80e151f9	db94e4b5-77ae-4459-8494-e31443458d7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
344d11ad-5327-40b8-8dcb-b2aadab88df1	383f3f2f-3194-4396-9a63-297f80e151f9	fb7e9280-2b6f-429c-be0c-e4fa204755f8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
18f4596f-0e74-4365-86a1-ca6f2e0a732b	383f3f2f-3194-4396-9a63-297f80e151f9	9c06ea4c-d311-4249-a91e-09c14c66786a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
439a388a-5866-4db3-b0d5-da83a9e578cf	383f3f2f-3194-4396-9a63-297f80e151f9	38c264c0-26f6-4929-a52c-2277e2aaccce	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
d54a9474-7c09-4098-b65f-b7d27fd81ece	383f3f2f-3194-4396-9a63-297f80e151f9	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
793a3f0b-d499-482f-8e8f-19ec60f8e805	383f3f2f-3194-4396-9a63-297f80e151f9	1042f63e-2ebf-492c-87e8-2b7bdc69150d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
339ed5d4-7a1e-424c-bdf1-2bc017ae23e3	383f3f2f-3194-4396-9a63-297f80e151f9	7c469d95-9f01-4295-ab59-fd3698ed7a36	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
2ca7ff2a-96ef-4f06-ac35-9ff192d37806	383f3f2f-3194-4396-9a63-297f80e151f9	8d3556d9-f508-4a55-9f48-5c1aebc59de9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
8e5773e6-1f7d-407d-9819-e7921fea2da6	383f3f2f-3194-4396-9a63-297f80e151f9	04c59caf-4541-4e15-8c6e-d4a435967ef4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
cf39b25b-5301-4ef4-9d25-6696c4eca875	383f3f2f-3194-4396-9a63-297f80e151f9	ade77569-3a72-4030-b2b4-11814fdd6b0a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
ee5840f7-80fa-44cc-816c-04f48db34cc6	383f3f2f-3194-4396-9a63-297f80e151f9	8bd68779-d3a5-4372-b932-598273b735ef	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
2bcdabfd-4ef6-45ee-89c9-40721eaac28b	383f3f2f-3194-4396-9a63-297f80e151f9	251ebe60-b752-4467-aa22-0d46d5ae4953	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
e6bbd31f-6a9b-465a-9936-8abf0714a522	383f3f2f-3194-4396-9a63-297f80e151f9	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
97352822-5adf-4a0e-8d1b-2cb3db33688b	383f3f2f-3194-4396-9a63-297f80e151f9	9b0f7458-981e-4a78-9cc1-969130cfb358	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
6342be88-f16c-4714-bf7d-de6e100eb2af	383f3f2f-3194-4396-9a63-297f80e151f9	36ea8942-d4e1-44ed-a36c-33fb6e715560	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
3117832d-763a-4d5d-bf6e-c38c6324256f	383f3f2f-3194-4396-9a63-297f80e151f9	c4944fca-068f-4ab5-8b9d-3b2493d785f2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
195c2076-2595-43ef-bb63-ddd2b4d12add	383f3f2f-3194-4396-9a63-297f80e151f9	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
8f536035-5feb-4c98-9a7d-90533b7cb036	383f3f2f-3194-4396-9a63-297f80e151f9	c2066743-efa9-40b6-94b9-5b2b6e0942f3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b2c5bd5c-7f12-484b-a1a4-92ac9aa6554b	383f3f2f-3194-4396-9a63-297f80e151f9	5def1949-7a28-4715-8427-6cb028048712	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
22d8722b-4d9f-4c6b-b251-563b8fac6df3	383f3f2f-3194-4396-9a63-297f80e151f9	add83dad-b55a-4e07-ab2f-9c1828f310e6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
a4969b88-118d-46b2-9ba8-bb17d5a74b22	383f3f2f-3194-4396-9a63-297f80e151f9	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
3f72b38c-5953-4f4e-8df4-aa46c4a531c6	383f3f2f-3194-4396-9a63-297f80e151f9	1a73dfdb-7333-4239-a6a6-7863010a6953	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
49088571-618e-4112-be8f-1924cdad3ec9	383f3f2f-3194-4396-9a63-297f80e151f9	635f7357-f443-4723-994f-7a81dd5d165f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
17373dc5-4b2a-4b29-adaa-10346cc5f948	383f3f2f-3194-4396-9a63-297f80e151f9	1a291f0f-1525-4815-ba48-67acaf27dd7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
6aea68a5-0878-4c90-ac84-777b1951ef89	383f3f2f-3194-4396-9a63-297f80e151f9	d2f92a82-754c-4dbf-9297-8222e71b7573	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
6522a152-9d3d-4085-a366-857b0f4b07bd	383f3f2f-3194-4396-9a63-297f80e151f9	aec1a837-c291-452c-9ac6-425d9f9dca36	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
98b22a7d-6f65-47b2-aa34-12ab17c768e5	383f3f2f-3194-4396-9a63-297f80e151f9	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
5a2fd744-7cc2-4785-8bc4-7d4d7f73b0d4	383f3f2f-3194-4396-9a63-297f80e151f9	81cf9d60-063d-4054-8277-0fc6eaa042ee	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
2a0ea6cc-3598-4124-871b-b3be2fb3ceab	383f3f2f-3194-4396-9a63-297f80e151f9	11859bb3-3249-4b3b-bc93-2236f608ff1e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
a9c08cb8-7414-482e-9b81-3295a43f1ce7	383f3f2f-3194-4396-9a63-297f80e151f9	4e6637ef-7d36-459a-9cf9-bd485e521443	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
23e84fc5-699b-455d-84c0-94b8242b9411	383f3f2f-3194-4396-9a63-297f80e151f9	1e00e441-4e0a-4c95-a147-d5ba83dc7883	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b25abdb8-225a-4d93-9de3-cfe80b1b49fb	383f3f2f-3194-4396-9a63-297f80e151f9	2af622c9-671a-4992-8b66-085781d11864	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
96efe8e4-0a09-4f25-b671-292609c7c109	383f3f2f-3194-4396-9a63-297f80e151f9	fda4281b-edb1-4bc4-8b80-86653209240b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
72afc64b-32a4-49f2-8881-8e0e81789061	383f3f2f-3194-4396-9a63-297f80e151f9	1ad39315-d1f4-4655-84f0-db922eac7e1f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
8fb6cf39-13d2-4b14-bea8-17f5accf9f40	383f3f2f-3194-4396-9a63-297f80e151f9	6bda2acd-5f00-4100-b31a-0de28d40a7c0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
dd99ff65-9fd5-46ba-9cf3-7cdb61f6a0d8	383f3f2f-3194-4396-9a63-297f80e151f9	29569e45-ea36-4138-83a3-80b85ba9ba1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
e15d49e7-b33e-4ccf-8596-6f72bf0d3b1b	383f3f2f-3194-4396-9a63-297f80e151f9	37afad6a-c579-4b34-8042-c3aa708227b9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
f1f1402c-4ce3-4f7a-8369-630443683862	383f3f2f-3194-4396-9a63-297f80e151f9	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
fd89433c-fa12-49b6-bb77-854f69f0c630	383f3f2f-3194-4396-9a63-297f80e151f9	c4233e6e-d7a3-4018-aff0-5415b06ef15b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
898160c8-8fb1-4917-9ca2-48c45a59c112	383f3f2f-3194-4396-9a63-297f80e151f9	c93e39fe-759b-4db1-bd9a-230c1f930a7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
db7dc0d9-296a-431f-a3d1-61a162fad47b	383f3f2f-3194-4396-9a63-297f80e151f9	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
a3dc9998-3b8d-47ea-a1d9-f2ae4e3c3d83	383f3f2f-3194-4396-9a63-297f80e151f9	583c470c-9284-4b66-a009-81ffab8bda1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
985c731a-eeda-4844-bcdb-a42ec19bd1d1	383f3f2f-3194-4396-9a63-297f80e151f9	6c387ed5-533e-4d6c-915f-72a85bc28c14	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b6ead0a9-40fa-4362-bbb3-50024a72c1dd	383f3f2f-3194-4396-9a63-297f80e151f9	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
e78aba97-df03-4f00-9927-c7addbe846dc	383f3f2f-3194-4396-9a63-297f80e151f9	90a8f117-bde3-4070-8165-95116ddb6c78	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
ee75f0e0-c3a5-443d-a9bc-bb6598de78dc	383f3f2f-3194-4396-9a63-297f80e151f9	78331efc-59a3-49c6-a4da-cd971800b07b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
98d7ddb0-5611-434e-8ef0-4de038430df4	383f3f2f-3194-4396-9a63-297f80e151f9	10cd0a5a-934b-4541-900f-61c5400cb33e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
2fdaadff-9cd0-42b3-9bf4-44b2b2be2a01	383f3f2f-3194-4396-9a63-297f80e151f9	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
149aae31-c952-44c3-ab7c-e91bbc6879b3	383f3f2f-3194-4396-9a63-297f80e151f9	9c6b3dbf-9144-4d72-9c8c-c9984731beec	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
b9ce7401-a029-4220-a8ec-923aec2c1731	383f3f2f-3194-4396-9a63-297f80e151f9	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
857f997f-9f8b-4f02-838a-ceefa5c5957a	383f3f2f-3194-4396-9a63-297f80e151f9	d9295f16-be88-4756-8f6e-1cf4764be20a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
4ea1e3b9-23ea-4e39-85ee-6e66b348857b	383f3f2f-3194-4396-9a63-297f80e151f9	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
5571c5f4-c6a6-44a2-9b43-58f45c1969c6	383f3f2f-3194-4396-9a63-297f80e151f9	e67b4538-7412-45c0-a0cf-e27bff88caab	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
4b24988c-f0e1-4628-84d4-a236387be78e	383f3f2f-3194-4396-9a63-297f80e151f9	b24c16bb-ff27-4814-b9d7-523fd69d9b41	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
67452c54-8a73-4495-ba5f-20294a589a16	383f3f2f-3194-4396-9a63-297f80e151f9	1cb61161-23ca-4336-806e-61086d967a67	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
7e05bad8-62d5-472d-81ad-89a4d69332ec	383f3f2f-3194-4396-9a63-297f80e151f9	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
5755b1fb-0db6-40a9-9758-e5d9c6c516f7	383f3f2f-3194-4396-9a63-297f80e151f9	278cade5-e251-4520-9394-cdd42c9212e6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
aefea842-0c62-48f7-a3bd-cfa073915e79	383f3f2f-3194-4396-9a63-297f80e151f9	b5966924-f09e-4024-8942-8f2e00949567	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
92d30d58-4dff-4ebb-bfaa-3b89af29d2dc	383f3f2f-3194-4396-9a63-297f80e151f9	d1627009-fe55-469a-baf7-1a8b4979d654	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
c1cc7083-c7e8-4c9c-ae65-eea2f9fb7b6a	383f3f2f-3194-4396-9a63-297f80e151f9	f5804675-69c7-4b68-9dc6-22dea1f5201a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
274fa18d-01a2-42d5-9bf5-94123f193e4b	383f3f2f-3194-4396-9a63-297f80e151f9	4a7446ad-a670-4e50-82dd-e71d2013d520	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
73f925dd-d576-4c0c-9bdf-4e90198fec1d	383f3f2f-3194-4396-9a63-297f80e151f9	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
a5f8af4f-518f-408e-a903-208b0ea3d870	383f3f2f-3194-4396-9a63-297f80e151f9	6915f34b-6468-4e75-a1d9-dbeee0529cb8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
cd81f7ea-ce62-4951-8e3c-47362de3e350	383f3f2f-3194-4396-9a63-297f80e151f9	e4778ab5-7678-46d9-baea-0368e4f812f0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
086e2a5c-a55c-44cf-94be-cc4eec3f5c06	383f3f2f-3194-4396-9a63-297f80e151f9	cf4be8bf-0906-4925-8291-6c8c785dcef4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
a437f0e3-f6cf-4e55-bdfe-82f75645e465	383f3f2f-3194-4396-9a63-297f80e151f9	0b038769-9d16-464d-85e6-fed33a40579a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
4d4f5acc-74a0-4587-a64a-511cf908ff63	383f3f2f-3194-4396-9a63-297f80e151f9	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
3640da9f-7743-49ec-b2fe-0541f926b274	383f3f2f-3194-4396-9a63-297f80e151f9	027e9c43-d25b-4cb5-b4c9-916084271623	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
f09f65bb-10f4-4768-a831-6ca46711c809	383f3f2f-3194-4396-9a63-297f80e151f9	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
ce8bbdce-2723-47e1-882f-324b4c02ffe9	383f3f2f-3194-4396-9a63-297f80e151f9	7d0f9dbd-4909-491d-9440-5f87bca5a254	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.606	2026-01-27 19:13:38.606
ded4fe3b-b950-4269-a8ef-d6cf704701c5	383f3f2f-3194-4396-9a63-297f80e151f9	aa0a06e7-d580-47b2-bc2e-cddd466186cb	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
48d54b4e-a98d-41f8-98d8-42fb19947e96	383f3f2f-3194-4396-9a63-297f80e151f9	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
bcb74b98-90a9-43c0-a28f-85d254ebb240	383f3f2f-3194-4396-9a63-297f80e151f9	fa0dcd21-865b-4de3-a315-83af78061b4a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
4dd251b5-d2e6-4c81-988c-e1ae2632f501	383f3f2f-3194-4396-9a63-297f80e151f9	69b81a70-6fa3-4533-9d00-c252f0f6245f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
719c33b5-4333-4da3-917e-854bd65055cd	383f3f2f-3194-4396-9a63-297f80e151f9	360b9bee-d159-4e20-ba1f-9681d17cf9bc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
3c7a1bb8-b4e0-40e4-bb72-7f9331a3e6a2	383f3f2f-3194-4396-9a63-297f80e151f9	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
a8648bd9-262f-4591-9d9d-53a0f6fca248	383f3f2f-3194-4396-9a63-297f80e151f9	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
4a829fd9-3036-4ef2-ac46-7f1429092ef1	383f3f2f-3194-4396-9a63-297f80e151f9	b19145e9-2513-41c3-b2a7-719588692eed	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
78746fe9-513f-4b72-ac6e-ca33b0ebd16c	383f3f2f-3194-4396-9a63-297f80e151f9	b52c3226-dc94-4289-a051-b7227fd77ae8	7456d517-e212-454d-8d4a-e19ddd077ba7	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
dc76f4b1-20ec-47f0-81e1-2b65f3810b60	383f3f2f-3194-4396-9a63-297f80e151f9	69b81a70-6fa3-4533-9d00-c252f0f6245f	7456d517-e212-454d-8d4a-e19ddd077ba7	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
a6dadf8c-f6e2-44e6-bae8-8d1ed9cce7ec	383f3f2f-3194-4396-9a63-297f80e151f9	360b9bee-d159-4e20-ba1f-9681d17cf9bc	7456d517-e212-454d-8d4a-e19ddd077ba7	t	2026-01-27 19:13:38.614	2026-01-27 19:13:38.614
fa3c3bad-c626-4a0c-9c4f-893a966f4521	935f2544-5727-47a9-a758-bd24afea5994	e6fffac1-4aad-4ce4-9981-3983dde344d3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
46409b04-68fc-4b4d-9234-ad8c2508a8d4	935f2544-5727-47a9-a758-bd24afea5994	32c804e1-e904-45b0-b150-cdc70be9679c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
42ac862a-fe56-4b38-a1fe-0483b9600d87	935f2544-5727-47a9-a758-bd24afea5994	16d101ea-c92f-44b0-b7dc-11cd3680215c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
f7b1000f-d68a-4ce2-a2a7-2baf570ff85e	935f2544-5727-47a9-a758-bd24afea5994	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
f101f87a-f957-4737-9abc-08f9137b11e1	935f2544-5727-47a9-a758-bd24afea5994	778ec216-a84f-41c7-a341-9d04269f0dc6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
87617365-3176-4952-8e40-4caaf4f3ab4d	935f2544-5727-47a9-a758-bd24afea5994	ed459bf2-7e56-4eca-bc6b-cee6655c644a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
a9475dc6-3f52-44aa-9463-70bbdc4bc2ac	935f2544-5727-47a9-a758-bd24afea5994	9f38de93-8d44-4760-9152-372666596d56	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
88d9d260-945c-46a2-b03a-dd84eb3b540b	935f2544-5727-47a9-a758-bd24afea5994	eadf502a-97e3-44fc-b07c-0f7015cb598a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
78c622cc-9e9b-46f8-964b-e2ed43532f6f	935f2544-5727-47a9-a758-bd24afea5994	c21d204c-4660-41e7-93c8-d895ddbaab26	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
5464dfc9-1cb2-4509-9b7a-df0b6e10a841	935f2544-5727-47a9-a758-bd24afea5994	31dec1f6-7abb-4742-ade1-42b89ad7766a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
6597a9a9-fbb6-4e73-bfe8-6a4697ac2b30	935f2544-5727-47a9-a758-bd24afea5994	b182931c-6229-4be3-bde7-ef6126032f52	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
2247ce8b-3d68-4172-ab25-366c043d4d07	935f2544-5727-47a9-a758-bd24afea5994	93421fdb-364d-418e-898a-a1f62dd8020a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
110a78ef-8432-4fb7-ad66-3d1b737ad363	935f2544-5727-47a9-a758-bd24afea5994	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
dd55f443-37da-4855-8163-a461b57e905e	935f2544-5727-47a9-a758-bd24afea5994	071a36ac-c2e2-4462-b10d-3175b101bd06	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
b21c488b-fc91-495a-b91f-fb4bbad86410	935f2544-5727-47a9-a758-bd24afea5994	734f6aa9-6ade-4187-b3b3-2cba78068a34	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
8b0cf944-51bc-49c5-9b7b-ec6775ad938b	935f2544-5727-47a9-a758-bd24afea5994	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
346e6b3c-2c48-430e-91d9-b88f2f73a5d8	935f2544-5727-47a9-a758-bd24afea5994	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
50e8f5bd-73bb-4d2b-9bcd-68d540bc3af8	935f2544-5727-47a9-a758-bd24afea5994	32898e2d-148e-4483-9e74-6fca3a3eed62	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
eda46a28-418d-40b6-81bb-1c8820988716	935f2544-5727-47a9-a758-bd24afea5994	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
74842885-53bb-494c-895c-d460d08cd92d	935f2544-5727-47a9-a758-bd24afea5994	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
6c86f429-9c99-4264-bfb9-f310e1cf9d92	935f2544-5727-47a9-a758-bd24afea5994	7a27fe64-579c-4653-a395-4ead4e3860df	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
49265d8b-4248-4550-8935-d86416b6dba4	935f2544-5727-47a9-a758-bd24afea5994	8504d304-1734-41d3-8e1c-8e6765cbf3d9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
bb07d555-0ad4-4d38-9f3e-e81dfdb6d413	935f2544-5727-47a9-a758-bd24afea5994	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
d057b5f6-ba91-43c0-9517-66c86e34139a	935f2544-5727-47a9-a758-bd24afea5994	5663e510-84a4-4116-86dd-dfaf709165e2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
350af9f1-9ad3-4c42-ba99-cb379f711dcb	935f2544-5727-47a9-a758-bd24afea5994	12663a56-2460-435d-97b2-b36c631dd62f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
88681329-0a69-4405-ab6d-5077c9637fd8	935f2544-5727-47a9-a758-bd24afea5994	11b13f4a-d287-4401-bd76-82a3b21bbbb6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
fdea922b-a57f-4535-b353-d808a7610ee7	935f2544-5727-47a9-a758-bd24afea5994	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
0c25aefa-c693-4e40-a9a3-22a4291b93e1	935f2544-5727-47a9-a758-bd24afea5994	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
a1c8ddd9-b2de-4b02-800a-36fac4d5ee67	935f2544-5727-47a9-a758-bd24afea5994	4220515f-01f8-40d5-846d-b4a7f5aa460b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
da222df1-b12f-45ed-825e-ffcf59038241	935f2544-5727-47a9-a758-bd24afea5994	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
6976444e-9249-40c4-b5ec-86bf3a97ba32	935f2544-5727-47a9-a758-bd24afea5994	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
15c43d84-8167-4e50-9e90-59cfd11516b6	935f2544-5727-47a9-a758-bd24afea5994	cd47199a-6751-4135-a27a-3d4719b9ef1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
7501d299-1923-4a01-9f99-a02e272aa457	935f2544-5727-47a9-a758-bd24afea5994	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
d3b2b4a4-59a1-4706-abc7-75687e79592b	935f2544-5727-47a9-a758-bd24afea5994	c86565cd-7ab2-4c4a-9152-f911e8eae236	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ca803e89-e9b6-4210-be1b-2c9256a6bdcc	935f2544-5727-47a9-a758-bd24afea5994	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
2262d88e-5ed2-4b50-aa11-05702ef42a28	935f2544-5727-47a9-a758-bd24afea5994	f43eb3e8-8708-4656-aae2-d21e33812610	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
bf2b7c8f-ab47-42cc-b828-dd5a6fc989fd	935f2544-5727-47a9-a758-bd24afea5994	28748534-0496-4c62-8647-6af5f01fc608	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
9b532d34-d92f-433b-97b5-3908cc2f78bd	935f2544-5727-47a9-a758-bd24afea5994	4c239c57-b3c6-4988-a698-6908b26d0e19	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
adf4ef22-f8fc-4d0a-b049-cdedff0acdb0	935f2544-5727-47a9-a758-bd24afea5994	493436bd-ca41-4359-8d8a-0d690ee7fc29	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
53668519-8bb7-4952-85e7-d61c985e0db9	935f2544-5727-47a9-a758-bd24afea5994	fe3d87aa-c40a-468d-8e3f-239029a5919d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
dbfd14ba-07fb-4b96-b34b-f5a125d150e0	935f2544-5727-47a9-a758-bd24afea5994	b52c3226-dc94-4289-a051-b7227fd77ae8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
dc43de40-7953-4fe1-a80f-97434e0ff23e	935f2544-5727-47a9-a758-bd24afea5994	7050c97c-b57f-490f-90a9-d8601fcb3852	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
83808e1f-024c-4e00-99f2-7d1bfa09171f	935f2544-5727-47a9-a758-bd24afea5994	60fc24d8-ef72-4107-8519-429969f3a05b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
72d2a40e-7712-4be8-be10-e2dce79342f8	935f2544-5727-47a9-a758-bd24afea5994	db419a02-b502-47b6-bf78-ca8e5cc0db52	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
b118ab62-7f65-4a3c-a2e3-6045752e2fe1	935f2544-5727-47a9-a758-bd24afea5994	913edefa-4e9b-4792-bddf-5739e52946f3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
c6216060-cacc-4f0a-8590-7306a94b2b5f	935f2544-5727-47a9-a758-bd24afea5994	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
852baae6-babc-498a-9d08-8039a205e06d	935f2544-5727-47a9-a758-bd24afea5994	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
af00db46-b338-49be-b0d7-a7970d55a11e	935f2544-5727-47a9-a758-bd24afea5994	81aabfd3-329b-4346-848b-5bea91a93fc1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
81710880-8e8a-44cc-ad4e-8ce4a9fb4b57	935f2544-5727-47a9-a758-bd24afea5994	fea93ffa-2056-42bd-984d-d35e5d8999a3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
413e2748-dbfc-4b40-ad63-4e4abd9e7e81	935f2544-5727-47a9-a758-bd24afea5994	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
9b1c8d3b-0b9b-4ea9-a419-43b97bb78009	935f2544-5727-47a9-a758-bd24afea5994	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
a1a3175d-de6b-4896-8add-3dc2ac0cecf4	935f2544-5727-47a9-a758-bd24afea5994	e76be943-41ac-4c14-980c-603a3652643f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
30b6c1fc-baa5-4a57-9700-ff113b336f9f	935f2544-5727-47a9-a758-bd24afea5994	3ce0f539-13c5-412d-8301-2ba191ea3328	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
84a4c47b-ba8b-4288-8e7b-06bc543b14e4	935f2544-5727-47a9-a758-bd24afea5994	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
31f9f3a9-bae7-4eca-ad73-3c176dd9f2fa	935f2544-5727-47a9-a758-bd24afea5994	623da6ff-cb25-4a58-bafa-da9088cfb606	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
2d8cc988-b430-4804-b9c5-bde185ba5b34	935f2544-5727-47a9-a758-bd24afea5994	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
0d5de4dd-5926-48f0-a811-3738820ca8d3	935f2544-5727-47a9-a758-bd24afea5994	b0ca323f-43b7-4020-b9f0-307751da0b74	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
4b45305a-d6e9-43fe-a031-14255cdeb0c7	935f2544-5727-47a9-a758-bd24afea5994	1c02ee54-327e-464f-b249-54a5b9f07a95	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ec773ba6-d010-404d-83e0-8c70897d03c3	935f2544-5727-47a9-a758-bd24afea5994	1a8acd2c-9221-47e0-92f6-35f89fa37812	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
380893fb-11e3-4a48-b893-6955d88c43ca	935f2544-5727-47a9-a758-bd24afea5994	8432f245-2bb6-4186-a3fd-607dee8bfbb3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
82ecb90e-ae9a-4cd4-8c87-58a54307b631	935f2544-5727-47a9-a758-bd24afea5994	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
752a859b-4ad5-4600-8bda-c674af219a75	935f2544-5727-47a9-a758-bd24afea5994	9d0c0a31-5443-434e-ade3-843f653b13a5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
93a668ba-a45d-4a95-82aa-8111d655c4e1	935f2544-5727-47a9-a758-bd24afea5994	15adee7a-c86c-4451-a862-6664e4a72332	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
4d3ea771-9d48-49f6-8e3d-465212f1c2cc	935f2544-5727-47a9-a758-bd24afea5994	9871b276-3844-46c3-8564-243c81bfc26e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
66390673-8a87-494f-aefd-832dc922a1fd	935f2544-5727-47a9-a758-bd24afea5994	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
5dc3aac7-5802-443a-bef7-2867a7bd5b92	935f2544-5727-47a9-a758-bd24afea5994	441dc9df-8866-4dcf-8f81-c8957513ddaa	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
818e04b3-b5cd-4bf1-9161-3cce77901ad7	935f2544-5727-47a9-a758-bd24afea5994	6f57f96c-4e83-4188-95b1-4a58af42d368	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
9c54acb8-836e-4d67-8f1f-a2d432cfa26a	935f2544-5727-47a9-a758-bd24afea5994	2e568ea8-6aab-4e76-b578-8fc44b566d00	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
6ff59d05-9248-4109-bb34-24c49d890946	935f2544-5727-47a9-a758-bd24afea5994	92ddb36f-34ee-4f99-8da8-f52d78752b40	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
6d972394-7977-4229-8a84-af5624ee9fa8	935f2544-5727-47a9-a758-bd24afea5994	d2a87d3c-d4f5-4728-a702-d520d52f8efc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
719c95d9-2c6f-4a89-a887-ffbee72465cc	935f2544-5727-47a9-a758-bd24afea5994	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
2daca04c-86b7-4955-8a04-a10f247190ea	935f2544-5727-47a9-a758-bd24afea5994	6f00304d-9dd1-4a86-b25e-96ffc4c96245	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
c0246be6-e010-4ed9-b312-6fc02525eddd	935f2544-5727-47a9-a758-bd24afea5994	29535a71-4da7-4d9e-8a1a-088498c25104	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
8e29ff2d-4405-4b01-ae18-a7ead486b7ce	935f2544-5727-47a9-a758-bd24afea5994	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
58126723-ed3d-45ee-88b8-86fcc6710677	935f2544-5727-47a9-a758-bd24afea5994	53179e6b-42df-45fb-808e-06635445f0a3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
9bba3477-565e-4ec8-ad76-2b99e85bd241	935f2544-5727-47a9-a758-bd24afea5994	01bfbc25-4974-4e1d-a039-afc1ab9350a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
d7a2b71b-ce85-4135-8954-0fbed55abe1e	935f2544-5727-47a9-a758-bd24afea5994	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
db714fb7-1ecd-47ae-b6b3-70035ce60c77	935f2544-5727-47a9-a758-bd24afea5994	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
22494fe7-75ae-42e5-9e1d-49f419706275	935f2544-5727-47a9-a758-bd24afea5994	49845113-2ada-42b3-b60e-a10d47724be3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
a59302e0-ac6a-459f-a345-e07ab49e5643	935f2544-5727-47a9-a758-bd24afea5994	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
e158f0a6-4220-41bc-b1b2-f0683ae9bb33	935f2544-5727-47a9-a758-bd24afea5994	23525539-5160-4174-bf39-938badb0bb75	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
5fb9aa56-d785-482f-82b3-0c23b7825caf	935f2544-5727-47a9-a758-bd24afea5994	45b02588-26f2-4553-bb6e-c773bbe1cd45	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ddc07c3f-8a89-4ea7-a1e7-d5bae91b9f89	935f2544-5727-47a9-a758-bd24afea5994	18bed42b-5400-452c-91db-4fb4147f355f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
02a7127a-6113-4749-865d-dea677dbc7cf	935f2544-5727-47a9-a758-bd24afea5994	5849ff0b-a440-4ab2-a389-b4acc0bf552e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
1bab60b2-0bd5-4693-ab34-3ea2132936a2	935f2544-5727-47a9-a758-bd24afea5994	aba9bce3-2155-4621-b4b0-3cf669cad3b2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
fb2a9ea2-80e3-4b98-90e8-b923f1680824	935f2544-5727-47a9-a758-bd24afea5994	2dd84bba-57aa-4137-b532-5e40df1f9818	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
ab22bfa1-ef75-4e7f-a13e-b1430bf48f1e	935f2544-5727-47a9-a758-bd24afea5994	02bf47ac-626f-45f7-910b-344eab76bc24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
fb595748-f991-44af-80fc-83525cba0e64	935f2544-5727-47a9-a758-bd24afea5994	c022b4da-2739-428a-8169-4522791ac94e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
f756802b-5a7a-4992-8fc9-319dc724076f	935f2544-5727-47a9-a758-bd24afea5994	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
9dd8f426-7abb-45b6-a422-d433d894d12a	935f2544-5727-47a9-a758-bd24afea5994	8d49f450-e103-4b29-8e22-2e14306ae829	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
a558f9d3-34ea-4bb5-bd19-81cef4787fcd	935f2544-5727-47a9-a758-bd24afea5994	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
cbac23da-ae57-4699-851c-765615172dd7	935f2544-5727-47a9-a758-bd24afea5994	6b142850-4553-451e-a6cb-3cb9fe612458	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.523	2026-01-28 19:46:36.523
8472ec38-a9c5-4a5e-bb6e-f5f016fda925	935f2544-5727-47a9-a758-bd24afea5994	5029f19f-04e8-4c22-baaa-abc4410face3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
94d9164f-762b-4812-97a6-565d687ee339	935f2544-5727-47a9-a758-bd24afea5994	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
8804826e-2ee0-4e79-b7e0-77dc020fd99f	935f2544-5727-47a9-a758-bd24afea5994	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
4fc1025d-76bc-4413-8d1e-fb2eb607fdda	935f2544-5727-47a9-a758-bd24afea5994	3a237a3a-4394-48e9-87c4-334c87d1b6a1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
2bcbaf91-c784-4ebf-84fc-892f36bb4ccd	935f2544-5727-47a9-a758-bd24afea5994	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
6f3fe107-d79f-4b32-bc7a-3c021f31cf8e	935f2544-5727-47a9-a758-bd24afea5994	00160b54-fdf1-48d1-9b52-52842dc8df4e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
65198a3d-0d95-4927-b594-addf4785c457	935f2544-5727-47a9-a758-bd24afea5994	29e9b502-fde8-4a8f-91b6-ff44f8d41479	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
69154cb7-39bc-4f2e-856f-9c672ca38ecd	935f2544-5727-47a9-a758-bd24afea5994	ca6e0150-9d34-403c-9fea-bb1e35d0e894	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
fe86380d-22ce-474f-a06a-420fe577d4a1	935f2544-5727-47a9-a758-bd24afea5994	16743e3d-672d-4584-9a3c-5d76ae079569	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
d16747a2-d575-4c26-8073-574eb684e0d8	935f2544-5727-47a9-a758-bd24afea5994	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
4a6ba0d8-594f-4da6-baa6-a637aa14c3dc	935f2544-5727-47a9-a758-bd24afea5994	372b482c-fcb8-405d-a88a-5d2ee5686e30	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
162b4c65-a2d0-4252-bb78-30e0d19c1d93	935f2544-5727-47a9-a758-bd24afea5994	c47cf3e0-e149-4834-b454-5fd4d583a1a7	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
6a369c57-3963-4688-b65e-f4c4ee087445	935f2544-5727-47a9-a758-bd24afea5994	d7b7595d-a831-48ec-84d4-39476bc3e44a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
243738bd-aec3-4668-a9e4-7ac7f3967611	935f2544-5727-47a9-a758-bd24afea5994	0690e264-ed8b-48b3-8930-5651eebe2e2e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
c7742cfc-9e10-46a5-a9ec-979f1be7d145	935f2544-5727-47a9-a758-bd24afea5994	b969a964-3765-4744-8080-3e2c88ab688e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
164c71bd-e565-4a4c-bc86-b1848a4f6df3	935f2544-5727-47a9-a758-bd24afea5994	6750bd19-7115-4966-b7db-0d8e2add036a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
3ab6e95f-146b-461f-b378-632bf60994bd	935f2544-5727-47a9-a758-bd24afea5994	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
d99dccd1-d4de-4366-a3ca-d5fe4cb2844e	935f2544-5727-47a9-a758-bd24afea5994	2afa78a2-892a-4dfb-9098-7926491b648f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
cfe7576a-1ef8-427a-ba5e-de3d1dc28945	935f2544-5727-47a9-a758-bd24afea5994	374edfb0-e4ae-4625-af63-a14d4cb48f9b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
5617efa6-ed26-4701-b176-3c2161548a9b	935f2544-5727-47a9-a758-bd24afea5994	d9f8f427-d02c-4a3a-9091-0a442685cf72	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
65f7a2bd-b7d6-4b93-b457-4e6af4dc4e5c	935f2544-5727-47a9-a758-bd24afea5994	9b28e1e2-badb-4a9d-88d4-84f5612934e5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
090c2a4e-816a-4748-8bd2-f8567500edbc	935f2544-5727-47a9-a758-bd24afea5994	d4b1799f-245c-44e7-bc89-1eec59a28c9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
e149f071-bafd-48e7-97b1-e6412a986950	935f2544-5727-47a9-a758-bd24afea5994	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f583755b-af14-4f28-8e5f-45c4797669e4	935f2544-5727-47a9-a758-bd24afea5994	1a810543-4218-41a4-90ba-9e3743f077fa	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
83b53baf-cbf0-453c-a386-b87a073c43e2	935f2544-5727-47a9-a758-bd24afea5994	09827071-8a30-42ac-898c-59a6fe9f0c75	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
0c58980c-cc08-40b4-919f-90a1ce06ccc1	935f2544-5727-47a9-a758-bd24afea5994	59996c9e-0bc9-4120-bee1-3f0455f81725	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
84fa1df7-9cdf-469a-9266-07a534b5f173	935f2544-5727-47a9-a758-bd24afea5994	d36af823-920c-47ab-965e-4ab698621052	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
367f21d8-2e3c-41a2-a225-2919d72ce4f8	935f2544-5727-47a9-a758-bd24afea5994	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
5de3ce43-721c-4739-9bec-04cc81203f25	935f2544-5727-47a9-a758-bd24afea5994	2d3e7958-5f64-4312-abe6-0af811e901c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
802ea7e7-629b-45e6-96e6-6a2756449f9c	935f2544-5727-47a9-a758-bd24afea5994	92b916e1-6a0b-4498-9048-3901b27bec39	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
50a2b419-30e3-4c13-8490-e788c8779182	935f2544-5727-47a9-a758-bd24afea5994	7f87bc22-635b-416a-8722-53c1ee704f0c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
a1cc68bc-9291-46e8-836e-29cd323efb32	935f2544-5727-47a9-a758-bd24afea5994	d65b2853-a79d-401a-8f05-adf2743b9162	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
4b366dfe-366c-42f2-bb57-95871009531a	935f2544-5727-47a9-a758-bd24afea5994	5f946046-e498-403d-a64a-6933c7bd6896	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f80dab30-abec-4239-b80f-81092e67256f	935f2544-5727-47a9-a758-bd24afea5994	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
feba8ac8-636f-4998-9c6d-7774d6bbcae8	935f2544-5727-47a9-a758-bd24afea5994	c6db06ec-612a-4dc3-bbc6-7c153e90994c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
88893a5f-4cef-4c64-b038-1d91c5998fda	935f2544-5727-47a9-a758-bd24afea5994	f410965b-b444-4df5-bfd6-e138109567a0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
2acec1fb-782c-44a2-877f-227ba7699383	935f2544-5727-47a9-a758-bd24afea5994	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
256d572e-47c5-4696-a8ee-4027ef44955a	935f2544-5727-47a9-a758-bd24afea5994	edccde66-49d6-459e-94e7-02b99477d24c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
2353a1a1-7f44-4696-ac78-9b5f080f5ae0	935f2544-5727-47a9-a758-bd24afea5994	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
946631a5-d56c-4824-964b-0d61f53f61d8	935f2544-5727-47a9-a758-bd24afea5994	f3da6061-0490-40ac-bdec-10e862ef1296	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
d3ce3d31-ef9c-4f86-b4a0-68d2b8c8cce2	935f2544-5727-47a9-a758-bd24afea5994	8e9ff64e-0787-4e03-9835-e833ca96ed46	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
27171b3e-060e-4cf1-9e81-ced777ef1880	935f2544-5727-47a9-a758-bd24afea5994	b54125c1-a96c-4137-9e7a-c197421d99b3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
48adc69f-6cc5-4a97-9c48-377f2ca22a56	935f2544-5727-47a9-a758-bd24afea5994	bebb0636-e19e-40a8-8733-18aa11ba1e13	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
02a1e954-761d-4b07-ad1a-1c7a7316b973	935f2544-5727-47a9-a758-bd24afea5994	6432d484-b4a5-427f-a12a-59303f1e50ee	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
3fd6dcc0-f5f5-45c1-9721-27f1399bbbf9	935f2544-5727-47a9-a758-bd24afea5994	4f96dd8e-6915-481e-aebb-672f83b45aa1	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
5977903e-e3ab-4cfa-87ae-33d631631792	935f2544-5727-47a9-a758-bd24afea5994	88f85444-56fd-4596-a6f3-84e3dde28513	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
8aef14f2-6777-4f47-9266-8922dbcd61bb	935f2544-5727-47a9-a758-bd24afea5994	0953b49f-6af7-4347-a249-24c34997bf1d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
16f11d84-2c2a-46c6-9744-9737fbd9c736	935f2544-5727-47a9-a758-bd24afea5994	0d33577d-027b-4a5d-b055-d766d2627542	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
848f75c9-6e2f-4fe5-99ed-a1be9f8a90a9	935f2544-5727-47a9-a758-bd24afea5994	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
727b1bae-a969-4914-af80-f390592a3ca8	935f2544-5727-47a9-a758-bd24afea5994	02932d66-2813-47b0-ae40-30564049a5ef	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
c9952dc4-a3e3-4e78-99c7-dba2e4e46620	935f2544-5727-47a9-a758-bd24afea5994	a4ccc274-2686-4677-b826-95e0616f156d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
dae77b0b-762a-45c6-a4c7-0f4773dc0823	935f2544-5727-47a9-a758-bd24afea5994	a04fc678-94ae-42bb-b43b-38ce17d30faf	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
39d05cac-2656-4906-81a7-406efcf20aa4	935f2544-5727-47a9-a758-bd24afea5994	1a8f1b99-a206-48d9-8170-23814b72c4cc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
310e6196-c511-4ec2-b14c-efb6711e4afe	935f2544-5727-47a9-a758-bd24afea5994	295fd56c-315c-4c82-9e20-fb571f376ddd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
02c9e32b-d0c9-4290-a1c6-c6f3aee47296	935f2544-5727-47a9-a758-bd24afea5994	a0099cf4-5479-4475-a86b-2f3d67995db8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
9c6be4e8-bfb0-4c01-bda2-1a960d31ee62	935f2544-5727-47a9-a758-bd24afea5994	dfbc0a35-28c7-4077-b9e6-08f3413ad130	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
608dbd95-2ea1-4b99-907b-7b391c0193ef	935f2544-5727-47a9-a758-bd24afea5994	47dcd774-7cbf-4a87-94df-369d0abf9232	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
391b8faa-8e02-42fa-a808-0160b19e72e3	935f2544-5727-47a9-a758-bd24afea5994	d2d84e05-c829-4c67-acec-3632e5f6515a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
abf57b22-3413-4f30-a5ba-0dc9e170bdc6	935f2544-5727-47a9-a758-bd24afea5994	0a421a5e-ad04-43ab-a539-2644d3ddabb0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
290baf24-4963-42d3-9744-32cb6732f0f9	935f2544-5727-47a9-a758-bd24afea5994	f8705655-8e50-4159-b738-efdb7c92de1f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
4978c148-2809-48f0-9c5e-53bfc45fe4d7	935f2544-5727-47a9-a758-bd24afea5994	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
e70dba95-ed5e-4f77-97e6-02b4b043087a	935f2544-5727-47a9-a758-bd24afea5994	81e51f8b-500d-4366-9360-3450dfa5ee4d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
e381b597-256c-4af3-ba0a-a69255c4b6cf	935f2544-5727-47a9-a758-bd24afea5994	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
39d3f6d0-08b1-4fc0-89a0-91ecd91ed5b3	935f2544-5727-47a9-a758-bd24afea5994	9297daf6-1431-4b62-9039-2ee22dcbba29	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
44dd3c23-2b8b-4fbe-ae9b-ef99713d6629	935f2544-5727-47a9-a758-bd24afea5994	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
2dec238a-0d32-4859-baa0-5d18be0e690e	935f2544-5727-47a9-a758-bd24afea5994	f34e06ee-82cc-4a62-bd17-947c58f42116	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
7839ea5b-33dc-4e1e-9262-bb3e9cc8ab73	935f2544-5727-47a9-a758-bd24afea5994	38ccc597-1f09-4de4-ad38-b9cddd2256c3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
2bcb65ad-8c07-42ad-9a01-2a4aaadb4101	935f2544-5727-47a9-a758-bd24afea5994	70e897f5-c029-4382-9778-de9aa02b85d7	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
1bdd76a3-663d-47d1-bdcf-1c5ca7566731	935f2544-5727-47a9-a758-bd24afea5994	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
78a2bc4d-40e8-4ceb-ada5-402efa3e0d35	935f2544-5727-47a9-a758-bd24afea5994	834f193e-7023-48a7-bc8e-58a910845d6b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f65a3277-545b-4f9b-bda5-63d9cd958969	935f2544-5727-47a9-a758-bd24afea5994	e90ca965-4a55-433d-83c8-9de44b168b9c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
4831ee66-853e-4c55-aeed-fccd3bbedd18	935f2544-5727-47a9-a758-bd24afea5994	e8d65387-e415-4e52-bf95-4cf7134e2235	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
0ad88022-4753-4ffd-a1f9-0f903312345f	935f2544-5727-47a9-a758-bd24afea5994	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
15f2d7c9-ee64-4817-b671-48ef6040be6d	935f2544-5727-47a9-a758-bd24afea5994	66177523-edef-4bb4-9e47-1db421e14257	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f0375011-352c-43e8-802b-492afaf31c56	935f2544-5727-47a9-a758-bd24afea5994	fcd820ab-6f42-4794-8e6a-217faa6017ac	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
99fb25ef-0da5-478f-8af9-9d81bcafcad3	935f2544-5727-47a9-a758-bd24afea5994	172fe5c4-06a1-435e-86e1-50a717ff1505	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
20f93cb8-b438-4bcc-a3a4-ac3341fa9d79	935f2544-5727-47a9-a758-bd24afea5994	52fa7c54-7266-459b-b679-a4a0966dcca2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
71e98bd5-616c-4083-bafd-ecb0173ca184	935f2544-5727-47a9-a758-bd24afea5994	ad04836f-3c39-4de5-ba1d-171dded4420b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
93e24747-36fe-4392-a7ad-002c8de03b29	935f2544-5727-47a9-a758-bd24afea5994	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
eb09733d-1514-4599-a46a-7b817854178b	935f2544-5727-47a9-a758-bd24afea5994	9fab0497-b7b0-43af-8c94-ac59cf2d504a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
c5681652-81a3-4095-95fe-68daad7e15d4	935f2544-5727-47a9-a758-bd24afea5994	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
a534dd14-5a5d-4cfa-a1e8-83a0458a0319	935f2544-5727-47a9-a758-bd24afea5994	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f833c498-02d0-43c9-94b2-88808d3715ed	935f2544-5727-47a9-a758-bd24afea5994	2069bcb9-4a3d-4462-8860-e39fe7327d4f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
529082fb-de50-4ec7-a8fb-edfbfb8d72a6	935f2544-5727-47a9-a758-bd24afea5994	4b0170c2-6403-45f2-a9be-25e61595b48e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
21031b6a-0e8f-4f10-93ab-36b943e84a7c	935f2544-5727-47a9-a758-bd24afea5994	db94e4b5-77ae-4459-8494-e31443458d7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
b1e530e6-2355-4e87-9e5e-3b8183e8895d	935f2544-5727-47a9-a758-bd24afea5994	fb7e9280-2b6f-429c-be0c-e4fa204755f8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
c6209638-fc34-4bf5-8582-ae24b795688d	935f2544-5727-47a9-a758-bd24afea5994	9c06ea4c-d311-4249-a91e-09c14c66786a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
cb3bfd72-47ed-489d-95fd-7c978d5b85da	935f2544-5727-47a9-a758-bd24afea5994	38c264c0-26f6-4929-a52c-2277e2aaccce	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
0f82e8f3-c67d-4469-b53a-b0b5a419e0b6	935f2544-5727-47a9-a758-bd24afea5994	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f4f19e4a-5c12-4bbb-8337-aaebe621ceb9	935f2544-5727-47a9-a758-bd24afea5994	1042f63e-2ebf-492c-87e8-2b7bdc69150d	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
3fed9e58-b22b-4438-95a2-1f72cce17bce	935f2544-5727-47a9-a758-bd24afea5994	7c469d95-9f01-4295-ab59-fd3698ed7a36	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
e490af78-330f-44bd-aadf-ec83d1b937d9	935f2544-5727-47a9-a758-bd24afea5994	8d3556d9-f508-4a55-9f48-5c1aebc59de9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
dc0edb49-3210-477c-9382-7d7a16607940	935f2544-5727-47a9-a758-bd24afea5994	04c59caf-4541-4e15-8c6e-d4a435967ef4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
c5cd69ed-a2e7-48d6-b466-ea1842fe2e67	935f2544-5727-47a9-a758-bd24afea5994	ade77569-3a72-4030-b2b4-11814fdd6b0a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
b5fa6d0c-9669-4b27-a83d-7bfd109689ee	935f2544-5727-47a9-a758-bd24afea5994	8bd68779-d3a5-4372-b932-598273b735ef	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
f31ccce1-c395-493b-a0e1-8d56f8eb3538	935f2544-5727-47a9-a758-bd24afea5994	251ebe60-b752-4467-aa22-0d46d5ae4953	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
37dbb7d9-e8db-45b6-84a5-1502d5c17cd4	935f2544-5727-47a9-a758-bd24afea5994	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
6dbb8025-6426-4747-a8df-56ee6de00fd5	935f2544-5727-47a9-a758-bd24afea5994	9b0f7458-981e-4a78-9cc1-969130cfb358	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
7c7e74a0-95cc-4196-88c0-754e9e787ed4	935f2544-5727-47a9-a758-bd24afea5994	36ea8942-d4e1-44ed-a36c-33fb6e715560	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
9e6efe0b-2109-4c52-bec1-46568c8565ca	935f2544-5727-47a9-a758-bd24afea5994	c4944fca-068f-4ab5-8b9d-3b2493d785f2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.534	2026-01-28 19:46:36.534
0a864722-a240-42a4-905d-a2db601f7841	935f2544-5727-47a9-a758-bd24afea5994	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ac09dff2-b064-4d75-97fe-6df4f4c23827	935f2544-5727-47a9-a758-bd24afea5994	c2066743-efa9-40b6-94b9-5b2b6e0942f3	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1240b1e1-925c-4891-bca1-c510cad4353c	935f2544-5727-47a9-a758-bd24afea5994	5def1949-7a28-4715-8427-6cb028048712	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
bb882ee3-7f8d-49d3-9f0d-465a89326560	935f2544-5727-47a9-a758-bd24afea5994	add83dad-b55a-4e07-ab2f-9c1828f310e6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
e5c1195a-adf0-4e27-9dd9-c30302ab4006	935f2544-5727-47a9-a758-bd24afea5994	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
bf32ebc8-cb84-4eed-b776-a0bd9d67faeb	935f2544-5727-47a9-a758-bd24afea5994	1a73dfdb-7333-4239-a6a6-7863010a6953	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
aa0d3329-9d1e-4832-8048-d562fddc88f8	935f2544-5727-47a9-a758-bd24afea5994	635f7357-f443-4723-994f-7a81dd5d165f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
d7f0950b-d789-4c45-b634-885cee564519	935f2544-5727-47a9-a758-bd24afea5994	1a291f0f-1525-4815-ba48-67acaf27dd7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
4e9d5775-0c64-47a2-9ea7-c122c57cf445	935f2544-5727-47a9-a758-bd24afea5994	d2f92a82-754c-4dbf-9297-8222e71b7573	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
5d5bf0a9-8e95-4e66-9926-36f190c91023	935f2544-5727-47a9-a758-bd24afea5994	aec1a837-c291-452c-9ac6-425d9f9dca36	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
e2a0e838-b98a-425f-8e34-1067d89d6147	935f2544-5727-47a9-a758-bd24afea5994	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
bf5564d3-5397-43e1-85d6-0c0e421a17ef	935f2544-5727-47a9-a758-bd24afea5994	81cf9d60-063d-4054-8277-0fc6eaa042ee	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
4bd10ad7-26b9-42c5-9883-ccd31463b287	935f2544-5727-47a9-a758-bd24afea5994	11859bb3-3249-4b3b-bc93-2236f608ff1e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
e309828f-5316-4d26-bca9-fb6f9c1ad9fe	935f2544-5727-47a9-a758-bd24afea5994	4e6637ef-7d36-459a-9cf9-bd485e521443	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
6d316c4f-7244-4591-bea4-9b8613de377c	935f2544-5727-47a9-a758-bd24afea5994	1e00e441-4e0a-4c95-a147-d5ba83dc7883	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
0f543051-9de9-4a19-9870-1bb028a9717e	935f2544-5727-47a9-a758-bd24afea5994	2af622c9-671a-4992-8b66-085781d11864	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
02e5d4a0-2dd1-46ae-bc43-469ffe6ba201	935f2544-5727-47a9-a758-bd24afea5994	fda4281b-edb1-4bc4-8b80-86653209240b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
9a203440-a22e-412e-8624-ca32be83ad6a	935f2544-5727-47a9-a758-bd24afea5994	1ad39315-d1f4-4655-84f0-db922eac7e1f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
bf3b4829-2722-4c66-9a92-69c79089de7f	935f2544-5727-47a9-a758-bd24afea5994	6bda2acd-5f00-4100-b31a-0de28d40a7c0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1fe4f818-e258-4a7d-b887-00573bf395d9	935f2544-5727-47a9-a758-bd24afea5994	29569e45-ea36-4138-83a3-80b85ba9ba1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
2df27b9a-8322-43fc-bb02-6e28093c1205	935f2544-5727-47a9-a758-bd24afea5994	37afad6a-c579-4b34-8042-c3aa708227b9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
645736f8-9d11-4412-9fd5-29a25f8c7bae	935f2544-5727-47a9-a758-bd24afea5994	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
69b253b2-01bc-457e-b063-455bb353abfc	935f2544-5727-47a9-a758-bd24afea5994	c4233e6e-d7a3-4018-aff0-5415b06ef15b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
52efa3a7-1b64-402a-a854-a801b7d7931f	935f2544-5727-47a9-a758-bd24afea5994	c93e39fe-759b-4db1-bd9a-230c1f930a7a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
7c6264b8-402a-4af5-bd15-5b6bb139806e	935f2544-5727-47a9-a758-bd24afea5994	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
b936d25b-e2c5-4d6e-85cd-a41c877e2460	935f2544-5727-47a9-a758-bd24afea5994	583c470c-9284-4b66-a009-81ffab8bda1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
7b9b2072-1f49-49e9-99cc-1ddfd669f3ce	935f2544-5727-47a9-a758-bd24afea5994	6c387ed5-533e-4d6c-915f-72a85bc28c14	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
03ed0d65-7360-4487-abb3-7b99986996b8	935f2544-5727-47a9-a758-bd24afea5994	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
383be8df-e1b0-497e-8871-e6c314980fd4	935f2544-5727-47a9-a758-bd24afea5994	90a8f117-bde3-4070-8165-95116ddb6c78	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
9089afc9-dfe7-4a94-be46-3ea027715973	935f2544-5727-47a9-a758-bd24afea5994	78331efc-59a3-49c6-a4da-cd971800b07b	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
af563c16-a6d5-4a5f-803f-06da23363cbd	935f2544-5727-47a9-a758-bd24afea5994	10cd0a5a-934b-4541-900f-61c5400cb33e	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
c5093d13-7985-41b2-a432-b710272fcd82	935f2544-5727-47a9-a758-bd24afea5994	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
f09fa24b-8303-456a-81e8-35b1e8f3b9c0	935f2544-5727-47a9-a758-bd24afea5994	9c6b3dbf-9144-4d72-9c8c-c9984731beec	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
96455696-5066-440b-bee3-e06f59c36afc	935f2544-5727-47a9-a758-bd24afea5994	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
447c4815-e6f4-40c4-b84b-814a4c1758b5	935f2544-5727-47a9-a758-bd24afea5994	d9295f16-be88-4756-8f6e-1cf4764be20a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
be173854-6c6b-471f-85e4-3bff5cdfa1c4	935f2544-5727-47a9-a758-bd24afea5994	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
557e4a51-654e-4011-b3b5-5378e98e08ea	935f2544-5727-47a9-a758-bd24afea5994	e67b4538-7412-45c0-a0cf-e27bff88caab	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1888176c-4570-41e3-8d29-cc8997cb27c3	935f2544-5727-47a9-a758-bd24afea5994	b24c16bb-ff27-4814-b9d7-523fd69d9b41	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
6b2d77c5-da4d-4c8c-ba2c-b031f38b2c8b	935f2544-5727-47a9-a758-bd24afea5994	1cb61161-23ca-4336-806e-61086d967a67	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ec1982be-06d8-430e-94ac-82b49aae9ad1	935f2544-5727-47a9-a758-bd24afea5994	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
b7621d40-54bd-42d6-911b-bf7d0b910272	935f2544-5727-47a9-a758-bd24afea5994	278cade5-e251-4520-9394-cdd42c9212e6	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
2d9d3d12-f46f-4bc1-a354-78dcd00fd6ad	935f2544-5727-47a9-a758-bd24afea5994	b5966924-f09e-4024-8942-8f2e00949567	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
fdad0cd7-5f9b-406d-a6fe-90682f077132	935f2544-5727-47a9-a758-bd24afea5994	d1627009-fe55-469a-baf7-1a8b4979d654	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
726f51f1-e22f-4827-9f33-55ef6abce39e	935f2544-5727-47a9-a758-bd24afea5994	f5804675-69c7-4b68-9dc6-22dea1f5201a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1aaeed68-2a13-4faa-876f-b3e43e8d2ddb	935f2544-5727-47a9-a758-bd24afea5994	4a7446ad-a670-4e50-82dd-e71d2013d520	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
054b695c-2254-449d-9555-818c1e795a1d	935f2544-5727-47a9-a758-bd24afea5994	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
4ded177c-2e2d-4e57-aa13-e46d7f99b636	935f2544-5727-47a9-a758-bd24afea5994	6915f34b-6468-4e75-a1d9-dbeee0529cb8	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
117d61fa-975d-4508-9fff-04e6b87096e0	935f2544-5727-47a9-a758-bd24afea5994	e4778ab5-7678-46d9-baea-0368e4f812f0	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
41b98db3-7b30-49b9-b7b7-1da26fa0aa3e	935f2544-5727-47a9-a758-bd24afea5994	cf4be8bf-0906-4925-8291-6c8c785dcef4	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
3cd5733c-6a7f-43f2-b343-b0694155467c	935f2544-5727-47a9-a758-bd24afea5994	0b038769-9d16-464d-85e6-fed33a40579a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
a41c889f-6891-4916-bf50-205f4ae67747	935f2544-5727-47a9-a758-bd24afea5994	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
14042e60-2a14-49cb-8d01-8b43a14a7d9c	935f2544-5727-47a9-a758-bd24afea5994	027e9c43-d25b-4cb5-b4c9-916084271623	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
81f0e51b-dfb3-4900-8dab-6ce67ad40a99	935f2544-5727-47a9-a758-bd24afea5994	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
bbdadd5b-a582-4a33-a6a0-f2c85ca616d5	935f2544-5727-47a9-a758-bd24afea5994	7d0f9dbd-4909-491d-9440-5f87bca5a254	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
b9661c8a-330a-40b1-9bce-9ca28d9b4a80	935f2544-5727-47a9-a758-bd24afea5994	aa0a06e7-d580-47b2-bc2e-cddd466186cb	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1447dd18-cf1e-4c12-940e-4b7f6a8ef2c8	935f2544-5727-47a9-a758-bd24afea5994	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
6e937dd3-d6df-48a1-8be9-0f4fde18f7c6	935f2544-5727-47a9-a758-bd24afea5994	fa0dcd21-865b-4de3-a315-83af78061b4a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
7c0d66a0-9f80-4c8d-a89e-f77e358fde2e	935f2544-5727-47a9-a758-bd24afea5994	69b81a70-6fa3-4533-9d00-c252f0f6245f	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
22394692-3abe-4799-83c8-3c9269833b4e	935f2544-5727-47a9-a758-bd24afea5994	360b9bee-d159-4e20-ba1f-9681d17cf9bc	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
a769b4c8-2aa2-4a31-a723-88d49ed92169	935f2544-5727-47a9-a758-bd24afea5994	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
47456885-3fd8-4419-a630-86f322b6cd46	935f2544-5727-47a9-a758-bd24afea5994	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ccd329b0-322f-4691-b025-57547a711304	935f2544-5727-47a9-a758-bd24afea5994	b19145e9-2513-41c3-b2a7-719588692eed	739b2b3f-db5c-4010-b96c-5238a3a26298	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
48113d8f-80f3-467c-a8f2-c45bf19f60de	935f2544-5727-47a9-a758-bd24afea5994	e6fffac1-4aad-4ce4-9981-3983dde344d3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
4affd757-db10-4300-8397-c05192109cbf	935f2544-5727-47a9-a758-bd24afea5994	32c804e1-e904-45b0-b150-cdc70be9679c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
b5f3af2a-1b44-4274-a890-0f3170dfcb55	935f2544-5727-47a9-a758-bd24afea5994	16d101ea-c92f-44b0-b7dc-11cd3680215c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1c7cfcc1-cceb-4116-88c3-e7d17c292dcf	935f2544-5727-47a9-a758-bd24afea5994	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
c0529934-2f67-40e6-bf0d-007906658e6a	935f2544-5727-47a9-a758-bd24afea5994	778ec216-a84f-41c7-a341-9d04269f0dc6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
707cd5de-3d0c-44ae-a5b8-7162fbe53cc8	935f2544-5727-47a9-a758-bd24afea5994	ed459bf2-7e56-4eca-bc6b-cee6655c644a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
74aed5bb-9174-4975-9ea7-e28c621828e7	935f2544-5727-47a9-a758-bd24afea5994	9f38de93-8d44-4760-9152-372666596d56	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
c2eacdbc-8ad0-4fb2-9347-8468acd071af	935f2544-5727-47a9-a758-bd24afea5994	eadf502a-97e3-44fc-b07c-0f7015cb598a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ce52836e-80fb-4dc6-a33a-469a89e0056b	935f2544-5727-47a9-a758-bd24afea5994	c21d204c-4660-41e7-93c8-d895ddbaab26	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
d4bc44d7-cba0-474e-be0d-1535e6924526	935f2544-5727-47a9-a758-bd24afea5994	31dec1f6-7abb-4742-ade1-42b89ad7766a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ae64fba5-626b-48be-87d0-6401cb1d70d4	935f2544-5727-47a9-a758-bd24afea5994	b182931c-6229-4be3-bde7-ef6126032f52	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
892a9e15-48b1-4b05-8ea2-ec2629e76d68	935f2544-5727-47a9-a758-bd24afea5994	93421fdb-364d-418e-898a-a1f62dd8020a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
fa0a475b-f085-4190-b6ed-8fbca91d2539	935f2544-5727-47a9-a758-bd24afea5994	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
f59878ca-8668-409c-9c87-2c5d6c689655	935f2544-5727-47a9-a758-bd24afea5994	071a36ac-c2e2-4462-b10d-3175b101bd06	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
a5fbdaa7-332c-4312-81aa-90936c1467a9	935f2544-5727-47a9-a758-bd24afea5994	734f6aa9-6ade-4187-b3b3-2cba78068a34	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
9eebe5de-712f-49c0-b054-1f9b98493f7b	935f2544-5727-47a9-a758-bd24afea5994	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
a7e5135c-d30f-48a9-9808-e94be0f5ca2c	935f2544-5727-47a9-a758-bd24afea5994	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
909b4847-1540-45c9-9d0b-5dab958dad30	935f2544-5727-47a9-a758-bd24afea5994	32898e2d-148e-4483-9e74-6fca3a3eed62	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
c5343229-7669-4bf1-ab53-2e6489da9559	935f2544-5727-47a9-a758-bd24afea5994	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
9d40059f-6e26-4606-a9fe-59f61baededa	935f2544-5727-47a9-a758-bd24afea5994	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1107e015-87ae-4bce-a09c-8be659b1a531	935f2544-5727-47a9-a758-bd24afea5994	7a27fe64-579c-4653-a395-4ead4e3860df	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
1340e614-2a80-4e27-b87d-077c8ccec1af	935f2544-5727-47a9-a758-bd24afea5994	8504d304-1734-41d3-8e1c-8e6765cbf3d9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
3cce3cfd-0207-4788-86ae-da75e510b31b	935f2544-5727-47a9-a758-bd24afea5994	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
280ff7de-31a1-425a-98c0-911a476323b5	935f2544-5727-47a9-a758-bd24afea5994	5663e510-84a4-4116-86dd-dfaf709165e2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
f8169c57-0fb0-45df-9887-fa450d4acacd	935f2544-5727-47a9-a758-bd24afea5994	12663a56-2460-435d-97b2-b36c631dd62f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
7421a4d6-1f26-4658-8e7f-943b76ad67e6	935f2544-5727-47a9-a758-bd24afea5994	11b13f4a-d287-4401-bd76-82a3b21bbbb6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
81061d9a-b272-4ddd-8d68-e1645592699e	935f2544-5727-47a9-a758-bd24afea5994	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
7fa7cbbe-14d8-4b2c-b552-4b82fff52a59	935f2544-5727-47a9-a758-bd24afea5994	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
d73d38e7-85a9-4872-a8df-ffab33510740	935f2544-5727-47a9-a758-bd24afea5994	4220515f-01f8-40d5-846d-b4a7f5aa460b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ffbcaa5d-6b0f-4bef-8bb6-cbf34dcb9d2c	935f2544-5727-47a9-a758-bd24afea5994	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
fe96e582-9ff5-45f0-8d4b-b77e41cd1e96	935f2544-5727-47a9-a758-bd24afea5994	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
b744eb7b-d596-4dff-9647-d5d1cc13aa37	935f2544-5727-47a9-a758-bd24afea5994	cd47199a-6751-4135-a27a-3d4719b9ef1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
39ac6b0c-a843-49b2-a749-c5c653df4e5b	935f2544-5727-47a9-a758-bd24afea5994	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
9b663900-407e-46f8-be80-0831f275c873	935f2544-5727-47a9-a758-bd24afea5994	c86565cd-7ab2-4c4a-9152-f911e8eae236	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
88cbe14d-ed10-4af7-9158-f31e04cf6476	935f2544-5727-47a9-a758-bd24afea5994	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
acf1e2d4-d4fa-435a-aee1-ecf303bcd90f	935f2544-5727-47a9-a758-bd24afea5994	f43eb3e8-8708-4656-aae2-d21e33812610	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
8853f92e-552b-4091-a264-3ea6abd007d6	935f2544-5727-47a9-a758-bd24afea5994	28748534-0496-4c62-8647-6af5f01fc608	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
cc41b354-c60e-42d7-9c24-d25895d67fd4	935f2544-5727-47a9-a758-bd24afea5994	4c239c57-b3c6-4988-a698-6908b26d0e19	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.543	2026-01-28 19:46:36.543
ab2988fc-e655-41f9-aeb4-18ef545ac284	935f2544-5727-47a9-a758-bd24afea5994	493436bd-ca41-4359-8d8a-0d690ee7fc29	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
6900999f-59e7-4996-acf7-d309ad577218	935f2544-5727-47a9-a758-bd24afea5994	fe3d87aa-c40a-468d-8e3f-239029a5919d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f5a3db43-b6aa-428d-aa12-2daeef933b07	935f2544-5727-47a9-a758-bd24afea5994	b52c3226-dc94-4289-a051-b7227fd77ae8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
465ca4f6-3185-4d8d-9f7f-1062cb6cf01a	935f2544-5727-47a9-a758-bd24afea5994	7050c97c-b57f-490f-90a9-d8601fcb3852	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
65077fe1-79d1-406d-b152-e855d24b001a	935f2544-5727-47a9-a758-bd24afea5994	60fc24d8-ef72-4107-8519-429969f3a05b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
fc000c57-75f1-4361-8485-8e1ca823e591	935f2544-5727-47a9-a758-bd24afea5994	db419a02-b502-47b6-bf78-ca8e5cc0db52	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
b4d76dee-dfef-4bb6-8619-027ab74e01bc	935f2544-5727-47a9-a758-bd24afea5994	913edefa-4e9b-4792-bddf-5739e52946f3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a1484d6b-6534-480f-a088-ec7d2031a2d3	935f2544-5727-47a9-a758-bd24afea5994	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
d8f6fbb9-cf51-44a0-af10-d1918d7de685	935f2544-5727-47a9-a758-bd24afea5994	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c67d47cf-6259-472c-9ea7-17ba8a43bf6f	935f2544-5727-47a9-a758-bd24afea5994	81aabfd3-329b-4346-848b-5bea91a93fc1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
709cae88-33a2-479e-b98e-dd7022f30051	935f2544-5727-47a9-a758-bd24afea5994	fea93ffa-2056-42bd-984d-d35e5d8999a3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
72217219-8263-4b3a-a1be-e593b916c6b6	935f2544-5727-47a9-a758-bd24afea5994	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
166a78d6-9d11-4129-ae80-98a67624182d	935f2544-5727-47a9-a758-bd24afea5994	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
63b7e081-2f67-41df-b359-538ef5980345	935f2544-5727-47a9-a758-bd24afea5994	e76be943-41ac-4c14-980c-603a3652643f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c30545bb-bc32-455e-a424-e8a6da389678	935f2544-5727-47a9-a758-bd24afea5994	3ce0f539-13c5-412d-8301-2ba191ea3328	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a1ad35f3-d95b-449c-90ee-7c6f1e8672fb	935f2544-5727-47a9-a758-bd24afea5994	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
5f8a9a9d-b4bd-4372-87f8-0bb362c1ac75	935f2544-5727-47a9-a758-bd24afea5994	623da6ff-cb25-4a58-bafa-da9088cfb606	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ff038d98-4ac8-423d-8dc1-668ec77d174f	935f2544-5727-47a9-a758-bd24afea5994	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
dd988995-e48a-4879-ad3d-c59a14bac4a7	935f2544-5727-47a9-a758-bd24afea5994	b0ca323f-43b7-4020-b9f0-307751da0b74	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
9e112f61-3c2d-48d5-9e4e-e2a4a2a9060d	935f2544-5727-47a9-a758-bd24afea5994	1c02ee54-327e-464f-b249-54a5b9f07a95	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
81dce559-2356-46b5-bfd3-ec74e3a6a428	935f2544-5727-47a9-a758-bd24afea5994	1a8acd2c-9221-47e0-92f6-35f89fa37812	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f4ea1ad6-6d0a-453a-a103-66f85d15786d	935f2544-5727-47a9-a758-bd24afea5994	8432f245-2bb6-4186-a3fd-607dee8bfbb3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
19aa3a71-8942-4cd8-84dc-6ee1d12b00d5	935f2544-5727-47a9-a758-bd24afea5994	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
00a4027b-27cc-497f-a9e6-e1dba303c7f6	935f2544-5727-47a9-a758-bd24afea5994	9d0c0a31-5443-434e-ade3-843f653b13a5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a1150e91-5a30-47e1-9a73-73be0a2faf76	935f2544-5727-47a9-a758-bd24afea5994	15adee7a-c86c-4451-a862-6664e4a72332	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
736420eb-3290-41a2-ab40-c1b2122b8855	935f2544-5727-47a9-a758-bd24afea5994	9871b276-3844-46c3-8564-243c81bfc26e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a1b2777b-a7da-4f8f-a6f2-727e8b5970ac	935f2544-5727-47a9-a758-bd24afea5994	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ba018df0-7c64-42aa-a90b-801a22005266	935f2544-5727-47a9-a758-bd24afea5994	441dc9df-8866-4dcf-8f81-c8957513ddaa	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
dfd05efe-6c9c-4755-be47-0e38ca94f5e7	935f2544-5727-47a9-a758-bd24afea5994	6f57f96c-4e83-4188-95b1-4a58af42d368	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
709644f6-ca31-40a7-a0fc-df725a77e4c8	935f2544-5727-47a9-a758-bd24afea5994	2e568ea8-6aab-4e76-b578-8fc44b566d00	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c9c9e3b7-4bb8-4d85-babb-83fc9d88eb5c	935f2544-5727-47a9-a758-bd24afea5994	92ddb36f-34ee-4f99-8da8-f52d78752b40	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
de6c7a19-b5a5-4e91-80e6-eeb2c60f7c3c	935f2544-5727-47a9-a758-bd24afea5994	d2a87d3c-d4f5-4728-a702-d520d52f8efc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
0d50e74c-7a51-4705-811d-9d39c73bb46b	935f2544-5727-47a9-a758-bd24afea5994	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
df2f2abf-bbf0-48b6-a714-7647c3bff55e	935f2544-5727-47a9-a758-bd24afea5994	6f00304d-9dd1-4a86-b25e-96ffc4c96245	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ad75849c-0bcd-4560-a916-8e2fbed0a09d	935f2544-5727-47a9-a758-bd24afea5994	29535a71-4da7-4d9e-8a1a-088498c25104	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f97dfeda-5a9d-4cc7-98c0-15ede05596a5	935f2544-5727-47a9-a758-bd24afea5994	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f8cabf5f-e068-44eb-b550-876654d16bdd	935f2544-5727-47a9-a758-bd24afea5994	53179e6b-42df-45fb-808e-06635445f0a3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a46e72b0-cf20-45da-add9-fe945e403f57	935f2544-5727-47a9-a758-bd24afea5994	01bfbc25-4974-4e1d-a039-afc1ab9350a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
cfe63a26-19a2-4e48-bac0-73c2534ce2c7	935f2544-5727-47a9-a758-bd24afea5994	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
5f992286-b8bb-4ff4-8b7c-01dd41ed99db	935f2544-5727-47a9-a758-bd24afea5994	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f270609f-8045-406e-93ee-1836772c442a	935f2544-5727-47a9-a758-bd24afea5994	49845113-2ada-42b3-b60e-a10d47724be3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
938d48c5-3329-41da-bb35-5a33a3b8b8c3	935f2544-5727-47a9-a758-bd24afea5994	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f5752773-d78b-4daf-ac44-022bc8fa367f	935f2544-5727-47a9-a758-bd24afea5994	23525539-5160-4174-bf39-938badb0bb75	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c562bd2b-f7a9-4195-a3bf-1a36af6225b5	935f2544-5727-47a9-a758-bd24afea5994	45b02588-26f2-4553-bb6e-c773bbe1cd45	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
61328635-722c-4163-b3e1-523c982b1050	935f2544-5727-47a9-a758-bd24afea5994	18bed42b-5400-452c-91db-4fb4147f355f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
be7edd57-f111-401f-8389-ebe1ba2b904d	935f2544-5727-47a9-a758-bd24afea5994	5849ff0b-a440-4ab2-a389-b4acc0bf552e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
78f873f2-4fa0-4acb-b0aa-dc809aceb8e4	935f2544-5727-47a9-a758-bd24afea5994	aba9bce3-2155-4621-b4b0-3cf669cad3b2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f8c7f309-33ba-4ff4-b68c-83e18f60fbe5	935f2544-5727-47a9-a758-bd24afea5994	2dd84bba-57aa-4137-b532-5e40df1f9818	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a4d5bae6-9a07-4d5d-96c2-1f25aa2b7fee	935f2544-5727-47a9-a758-bd24afea5994	02bf47ac-626f-45f7-910b-344eab76bc24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
3e5b6a7a-57f7-462a-8615-a2243f05ced1	935f2544-5727-47a9-a758-bd24afea5994	c022b4da-2739-428a-8169-4522791ac94e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
4228299c-bac1-402a-a1e7-838479eda3b6	935f2544-5727-47a9-a758-bd24afea5994	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
e5cb1ba0-7686-42ad-b9d6-a04544a3ba7c	935f2544-5727-47a9-a758-bd24afea5994	8d49f450-e103-4b29-8e22-2e14306ae829	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
0055d791-f93d-4fc9-be9e-70ce5be8d5f3	935f2544-5727-47a9-a758-bd24afea5994	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
034c0e1a-0f2a-4eed-bd69-26be43838c97	935f2544-5727-47a9-a758-bd24afea5994	6b142850-4553-451e-a6cb-3cb9fe612458	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f543ec1c-864d-46b7-9805-3c953db02584	935f2544-5727-47a9-a758-bd24afea5994	5029f19f-04e8-4c22-baaa-abc4410face3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f5c55a63-d4b1-4f73-9198-d2e9b0885e4c	935f2544-5727-47a9-a758-bd24afea5994	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c5bd4638-0a2b-4537-8876-97d3156ac162	935f2544-5727-47a9-a758-bd24afea5994	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
d51c4dc4-6595-46be-9ed0-1102a7d08a69	935f2544-5727-47a9-a758-bd24afea5994	3a237a3a-4394-48e9-87c4-334c87d1b6a1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f6de8997-e8cd-4379-90aa-60a6c2ec9dfd	935f2544-5727-47a9-a758-bd24afea5994	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f73e8ba6-5a86-416f-9ace-a572088d6880	935f2544-5727-47a9-a758-bd24afea5994	00160b54-fdf1-48d1-9b52-52842dc8df4e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c9a525d2-72eb-409b-b6a6-0868cd0bce94	935f2544-5727-47a9-a758-bd24afea5994	29e9b502-fde8-4a8f-91b6-ff44f8d41479	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
d5cd7896-4789-45ad-bd2e-260ba28c702d	935f2544-5727-47a9-a758-bd24afea5994	ca6e0150-9d34-403c-9fea-bb1e35d0e894	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
edaf371b-9dde-408e-8022-0bcf9ce14a6b	935f2544-5727-47a9-a758-bd24afea5994	16743e3d-672d-4584-9a3c-5d76ae079569	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
e8ba9de6-d3ff-44f9-b6eb-dc45f04bae50	935f2544-5727-47a9-a758-bd24afea5994	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
d8317a0c-8605-42a6-9969-acb4521486cf	935f2544-5727-47a9-a758-bd24afea5994	372b482c-fcb8-405d-a88a-5d2ee5686e30	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
23305a29-9eff-4ec7-bf5b-c8cc796229db	935f2544-5727-47a9-a758-bd24afea5994	c47cf3e0-e149-4834-b454-5fd4d583a1a7	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
6310fc13-7c92-4f53-9e2a-3e878853f31b	935f2544-5727-47a9-a758-bd24afea5994	d7b7595d-a831-48ec-84d4-39476bc3e44a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
cc083f66-2462-4246-9711-be4bb4f03760	935f2544-5727-47a9-a758-bd24afea5994	0690e264-ed8b-48b3-8930-5651eebe2e2e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
a9430bf7-82a5-4774-b655-50c5a3687350	935f2544-5727-47a9-a758-bd24afea5994	b969a964-3765-4744-8080-3e2c88ab688e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
68d381dc-6aba-4bf8-b50f-42412d946af0	935f2544-5727-47a9-a758-bd24afea5994	6750bd19-7115-4966-b7db-0d8e2add036a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
fd3452f8-c3c4-48bd-bfc5-39d9269734eb	935f2544-5727-47a9-a758-bd24afea5994	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
6bcdfae0-5ec3-466e-ac65-7ec3b59b6cbb	935f2544-5727-47a9-a758-bd24afea5994	2afa78a2-892a-4dfb-9098-7926491b648f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
bcb05227-69c7-4ecc-b848-f296ce4e6861	935f2544-5727-47a9-a758-bd24afea5994	374edfb0-e4ae-4625-af63-a14d4cb48f9b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
b5bf33ce-44bf-476b-8e62-0afee2c407b9	935f2544-5727-47a9-a758-bd24afea5994	d9f8f427-d02c-4a3a-9091-0a442685cf72	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
b94b3540-5d8e-4944-9674-e69a9255233e	935f2544-5727-47a9-a758-bd24afea5994	9b28e1e2-badb-4a9d-88d4-84f5612934e5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
b3560971-7173-48ad-a35b-03a9a0cb597b	935f2544-5727-47a9-a758-bd24afea5994	d4b1799f-245c-44e7-bc89-1eec59a28c9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
067d7a51-b7b3-4193-868e-d2432c835431	935f2544-5727-47a9-a758-bd24afea5994	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
f5ac0c2e-76a4-4ec8-975b-25d69d3ad3a2	935f2544-5727-47a9-a758-bd24afea5994	1a810543-4218-41a4-90ba-9e3743f077fa	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
66d79945-4bd1-4fff-a58d-55dcb398a412	935f2544-5727-47a9-a758-bd24afea5994	09827071-8a30-42ac-898c-59a6fe9f0c75	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
26600fc9-5b3a-41e4-96f1-fb2665f05287	935f2544-5727-47a9-a758-bd24afea5994	59996c9e-0bc9-4120-bee1-3f0455f81725	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
6c19593a-efd6-4304-b0ee-ced67e39d430	935f2544-5727-47a9-a758-bd24afea5994	d36af823-920c-47ab-965e-4ab698621052	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c2d35909-5ecf-41c3-ab62-f0db3cab28cf	935f2544-5727-47a9-a758-bd24afea5994	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
c2161dc8-2b50-42fc-bbe9-49a52d7826a7	935f2544-5727-47a9-a758-bd24afea5994	2d3e7958-5f64-4312-abe6-0af811e901c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
db8ae92a-3ff0-4195-aeff-3818c8d1dd9c	935f2544-5727-47a9-a758-bd24afea5994	92b916e1-6a0b-4498-9048-3901b27bec39	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ada9da49-ebf2-40cb-acd5-6429a8b0598d	935f2544-5727-47a9-a758-bd24afea5994	7f87bc22-635b-416a-8722-53c1ee704f0c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
46e5cf56-0cee-4555-a8c2-f5c7267f1e45	935f2544-5727-47a9-a758-bd24afea5994	d65b2853-a79d-401a-8f05-adf2743b9162	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
cce9b156-2508-458a-82f3-766a1977770a	935f2544-5727-47a9-a758-bd24afea5994	5f946046-e498-403d-a64a-6933c7bd6896	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
b6125acc-532b-4e31-9e26-cbf1555bd38a	935f2544-5727-47a9-a758-bd24afea5994	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
60b6c474-1bce-4748-96d7-d284ce3fc707	935f2544-5727-47a9-a758-bd24afea5994	c6db06ec-612a-4dc3-bbc6-7c153e90994c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ab574210-4a74-494d-b417-3c7ea9fa327a	935f2544-5727-47a9-a758-bd24afea5994	f410965b-b444-4df5-bfd6-e138109567a0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
2e7b2bfd-56d9-455c-86c1-fb5dfb1b8c75	935f2544-5727-47a9-a758-bd24afea5994	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
09b3c41a-1951-4966-bc14-9a10bc6f109e	935f2544-5727-47a9-a758-bd24afea5994	edccde66-49d6-459e-94e7-02b99477d24c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ba765d9f-dab7-4ec4-acc3-826b4978a627	935f2544-5727-47a9-a758-bd24afea5994	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
6a4bde8a-ed31-4467-9d42-6fb5fcc2bda1	935f2544-5727-47a9-a758-bd24afea5994	f3da6061-0490-40ac-bdec-10e862ef1296	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
dfa1b589-6ccf-443e-b580-65a7caa83e4e	935f2544-5727-47a9-a758-bd24afea5994	8e9ff64e-0787-4e03-9835-e833ca96ed46	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
2f35d7e5-d53a-4677-80e0-f16922175941	935f2544-5727-47a9-a758-bd24afea5994	b54125c1-a96c-4137-9e7a-c197421d99b3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
7a6614c5-67aa-4b86-a3e6-112b064d3b3a	935f2544-5727-47a9-a758-bd24afea5994	bebb0636-e19e-40a8-8733-18aa11ba1e13	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
07b53316-8e4d-42ef-bc5c-687326f770f0	935f2544-5727-47a9-a758-bd24afea5994	6432d484-b4a5-427f-a12a-59303f1e50ee	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
d914d32a-444a-4e90-8916-77885f42cf6d	935f2544-5727-47a9-a758-bd24afea5994	4f96dd8e-6915-481e-aebb-672f83b45aa1	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
171d519c-545d-4c13-8bf5-7b6141284fad	935f2544-5727-47a9-a758-bd24afea5994	88f85444-56fd-4596-a6f3-84e3dde28513	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.552	2026-01-28 19:46:36.552
ba0b7176-20f0-491b-bfe9-936fe5c6168c	935f2544-5727-47a9-a758-bd24afea5994	0953b49f-6af7-4347-a249-24c34997bf1d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
bc97a1a7-d74d-499c-a3c6-ecce1e37e9f0	935f2544-5727-47a9-a758-bd24afea5994	0d33577d-027b-4a5d-b055-d766d2627542	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
b9a464c7-79cf-4645-adac-7f63cf88a7fe	935f2544-5727-47a9-a758-bd24afea5994	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
2608a8f4-772e-41b2-8fbe-e6b2b0d7f2ba	935f2544-5727-47a9-a758-bd24afea5994	02932d66-2813-47b0-ae40-30564049a5ef	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
c7f9a056-a270-46c7-a656-f240754835bb	935f2544-5727-47a9-a758-bd24afea5994	a4ccc274-2686-4677-b826-95e0616f156d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
68766232-d0f4-4e19-8011-f0a0b220d2d6	935f2544-5727-47a9-a758-bd24afea5994	a04fc678-94ae-42bb-b43b-38ce17d30faf	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
314e14bf-8315-46f4-9951-952d2ea74b8d	935f2544-5727-47a9-a758-bd24afea5994	1a8f1b99-a206-48d9-8170-23814b72c4cc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
4253b8b8-2b36-4c36-8f25-6feb6a57a0b7	935f2544-5727-47a9-a758-bd24afea5994	295fd56c-315c-4c82-9e20-fb571f376ddd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
18b8f6f5-d8f9-4db3-9d6f-8cedfaa901db	935f2544-5727-47a9-a758-bd24afea5994	a0099cf4-5479-4475-a86b-2f3d67995db8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
63658538-2f43-4904-899d-2a842a07e09d	935f2544-5727-47a9-a758-bd24afea5994	dfbc0a35-28c7-4077-b9e6-08f3413ad130	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
0d7c0000-6c18-4e9e-9cdd-92a69be30880	935f2544-5727-47a9-a758-bd24afea5994	47dcd774-7cbf-4a87-94df-369d0abf9232	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
bc26c249-bfbb-43fd-b50e-d2ed0707bf06	935f2544-5727-47a9-a758-bd24afea5994	d2d84e05-c829-4c67-acec-3632e5f6515a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
2deaa48d-f53c-4562-88a1-3e2fac4f5aa2	935f2544-5727-47a9-a758-bd24afea5994	0a421a5e-ad04-43ab-a539-2644d3ddabb0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
5e404603-b584-4bf1-b6e3-2166935cae90	935f2544-5727-47a9-a758-bd24afea5994	f8705655-8e50-4159-b738-efdb7c92de1f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
95a52f82-ff33-446e-8237-d52f1472637d	935f2544-5727-47a9-a758-bd24afea5994	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
0f24828a-4ae7-4d70-ba3c-36be6689d9c2	935f2544-5727-47a9-a758-bd24afea5994	81e51f8b-500d-4366-9360-3450dfa5ee4d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
edaaed14-43d6-4616-9722-cfcd822c5da0	935f2544-5727-47a9-a758-bd24afea5994	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
c2e46f86-c526-4d2b-8a0f-efb2f291a1e9	935f2544-5727-47a9-a758-bd24afea5994	9297daf6-1431-4b62-9039-2ee22dcbba29	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
1b91c8a4-526f-4a0b-ad13-0d2949ca061f	935f2544-5727-47a9-a758-bd24afea5994	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
610a063a-7a47-4364-b911-ac2d43efc1fd	935f2544-5727-47a9-a758-bd24afea5994	f34e06ee-82cc-4a62-bd17-947c58f42116	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8d8a02e7-955b-4e6d-84e5-2f32a92c9b6d	935f2544-5727-47a9-a758-bd24afea5994	38ccc597-1f09-4de4-ad38-b9cddd2256c3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e15ee9e0-996b-42b3-911e-99ec3c6bf499	935f2544-5727-47a9-a758-bd24afea5994	70e897f5-c029-4382-9778-de9aa02b85d7	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
30020139-08d6-4709-9fe1-e09f5bf91a10	935f2544-5727-47a9-a758-bd24afea5994	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e64e1839-911d-4e46-b4c9-6dba52d1eff1	935f2544-5727-47a9-a758-bd24afea5994	834f193e-7023-48a7-bc8e-58a910845d6b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
87ddd30b-6b8c-4b08-87a7-a4ee24ddc4c6	935f2544-5727-47a9-a758-bd24afea5994	e90ca965-4a55-433d-83c8-9de44b168b9c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
39a09736-abd3-4a2f-97f8-d78186f422ec	935f2544-5727-47a9-a758-bd24afea5994	e8d65387-e415-4e52-bf95-4cf7134e2235	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
407749a6-d0c0-4f0e-beba-2e10fb8b430e	935f2544-5727-47a9-a758-bd24afea5994	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
3c672beb-e631-4289-8103-6632930169db	935f2544-5727-47a9-a758-bd24afea5994	66177523-edef-4bb4-9e47-1db421e14257	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
75adacd6-481a-4440-b0e5-c076ca319ddf	935f2544-5727-47a9-a758-bd24afea5994	fcd820ab-6f42-4794-8e6a-217faa6017ac	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
634fb716-262c-4040-9f03-a9c25777c5dc	935f2544-5727-47a9-a758-bd24afea5994	172fe5c4-06a1-435e-86e1-50a717ff1505	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
db45f859-8801-4dea-8ada-3f4dd998f236	935f2544-5727-47a9-a758-bd24afea5994	52fa7c54-7266-459b-b679-a4a0966dcca2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e1450a9f-e289-45fa-a5ad-2c5bb70339ee	935f2544-5727-47a9-a758-bd24afea5994	ad04836f-3c39-4de5-ba1d-171dded4420b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8a96c2f0-056b-4e0e-b5fb-207412530281	935f2544-5727-47a9-a758-bd24afea5994	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e246aafd-4471-4195-a59f-d7c596801e20	935f2544-5727-47a9-a758-bd24afea5994	9fab0497-b7b0-43af-8c94-ac59cf2d504a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
b7c5608f-a2d8-470c-9c80-3f92478764dc	935f2544-5727-47a9-a758-bd24afea5994	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
79fb06bf-137a-43cb-a313-0e54960778f5	935f2544-5727-47a9-a758-bd24afea5994	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
72e0be28-b291-464c-bba8-6ac377fa3541	935f2544-5727-47a9-a758-bd24afea5994	2069bcb9-4a3d-4462-8860-e39fe7327d4f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8f88656c-59e0-4516-9b52-487436b20c6e	935f2544-5727-47a9-a758-bd24afea5994	4b0170c2-6403-45f2-a9be-25e61595b48e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
172c367c-5913-4934-bbc3-fd4f5754505c	935f2544-5727-47a9-a758-bd24afea5994	db94e4b5-77ae-4459-8494-e31443458d7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
42657db5-5d41-42c5-8dbf-e2006a0df147	935f2544-5727-47a9-a758-bd24afea5994	fb7e9280-2b6f-429c-be0c-e4fa204755f8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
3e63f5c3-f4b1-4d47-9838-c84a15e5f9df	935f2544-5727-47a9-a758-bd24afea5994	9c06ea4c-d311-4249-a91e-09c14c66786a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
bfc99f87-800a-473e-9643-d2a43651c235	935f2544-5727-47a9-a758-bd24afea5994	38c264c0-26f6-4929-a52c-2277e2aaccce	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
5953936a-b3bd-494c-91d3-e6d3ab0e8961	935f2544-5727-47a9-a758-bd24afea5994	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8774cd0c-705b-4b49-a5be-714a764c6e46	935f2544-5727-47a9-a758-bd24afea5994	1042f63e-2ebf-492c-87e8-2b7bdc69150d	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
c5239836-1151-4b58-9b03-71b71c921c6a	935f2544-5727-47a9-a758-bd24afea5994	7c469d95-9f01-4295-ab59-fd3698ed7a36	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
15a7f759-14a2-46ba-8455-437a697d597f	935f2544-5727-47a9-a758-bd24afea5994	8d3556d9-f508-4a55-9f48-5c1aebc59de9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e79ccdac-0614-4c67-8def-381a8207a437	935f2544-5727-47a9-a758-bd24afea5994	04c59caf-4541-4e15-8c6e-d4a435967ef4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
d233034b-1b7e-4b2e-8829-75b4831d47a9	935f2544-5727-47a9-a758-bd24afea5994	ade77569-3a72-4030-b2b4-11814fdd6b0a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
0df5db2f-2b1a-4d5c-941a-3c7bffbae952	935f2544-5727-47a9-a758-bd24afea5994	8bd68779-d3a5-4372-b932-598273b735ef	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e6a9e349-040f-4bea-a21f-68075a468bc7	935f2544-5727-47a9-a758-bd24afea5994	251ebe60-b752-4467-aa22-0d46d5ae4953	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
7b39a933-ece8-46ea-93d2-e7b18d6611d8	935f2544-5727-47a9-a758-bd24afea5994	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
44313eea-972b-4f1b-a133-31f04bc09122	935f2544-5727-47a9-a758-bd24afea5994	9b0f7458-981e-4a78-9cc1-969130cfb358	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e8125fdb-a803-470c-b50e-9e761839e3dd	935f2544-5727-47a9-a758-bd24afea5994	36ea8942-d4e1-44ed-a36c-33fb6e715560	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
aa03eced-ab94-4e15-8056-57c870c7c096	935f2544-5727-47a9-a758-bd24afea5994	c4944fca-068f-4ab5-8b9d-3b2493d785f2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
b9332820-d25a-456d-b931-14c6e3646da1	935f2544-5727-47a9-a758-bd24afea5994	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
eba7d179-f11d-4af4-a7eb-d35cf989cce0	935f2544-5727-47a9-a758-bd24afea5994	c2066743-efa9-40b6-94b9-5b2b6e0942f3	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
31a77c00-ab8f-4950-8679-7f6d03f79b7c	935f2544-5727-47a9-a758-bd24afea5994	5def1949-7a28-4715-8427-6cb028048712	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
24a99743-5899-4b3a-96c4-7b9005581a58	935f2544-5727-47a9-a758-bd24afea5994	add83dad-b55a-4e07-ab2f-9c1828f310e6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
1961a25a-d779-4d26-9423-04cda6a4b127	935f2544-5727-47a9-a758-bd24afea5994	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8f36d753-f622-439e-a987-57a0d16e4f25	935f2544-5727-47a9-a758-bd24afea5994	1a73dfdb-7333-4239-a6a6-7863010a6953	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
0ab4391c-de3d-4a0f-a29f-d897c65246c9	935f2544-5727-47a9-a758-bd24afea5994	635f7357-f443-4723-994f-7a81dd5d165f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
8fd71659-a607-409c-8b3c-4d2665fe01ab	935f2544-5727-47a9-a758-bd24afea5994	1a291f0f-1525-4815-ba48-67acaf27dd7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
edaa0a3f-5389-4514-987d-896aba45d232	935f2544-5727-47a9-a758-bd24afea5994	d2f92a82-754c-4dbf-9297-8222e71b7573	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
035e7a6e-ab97-4f0d-ab6e-35c62cd0e12a	935f2544-5727-47a9-a758-bd24afea5994	aec1a837-c291-452c-9ac6-425d9f9dca36	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
6bccca49-3379-48b2-b47c-a2c0e1d16f33	935f2544-5727-47a9-a758-bd24afea5994	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
952212a8-8d12-498f-87de-4baedb7024a0	935f2544-5727-47a9-a758-bd24afea5994	81cf9d60-063d-4054-8277-0fc6eaa042ee	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
a78f8eda-e7b1-45ef-b3c8-344a9672d34a	935f2544-5727-47a9-a758-bd24afea5994	11859bb3-3249-4b3b-bc93-2236f608ff1e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
ed3bcdfa-8667-4b3a-8f9d-0a04d20c15dc	935f2544-5727-47a9-a758-bd24afea5994	4e6637ef-7d36-459a-9cf9-bd485e521443	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
d6b968d5-f827-4d75-a509-5ffdf0b52f47	935f2544-5727-47a9-a758-bd24afea5994	1e00e441-4e0a-4c95-a147-d5ba83dc7883	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
0dd03e0c-ead2-4a0b-b80b-83401973d402	935f2544-5727-47a9-a758-bd24afea5994	2af622c9-671a-4992-8b66-085781d11864	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
4666df7f-e43d-4f9e-ac66-413e9c6f9225	935f2544-5727-47a9-a758-bd24afea5994	fda4281b-edb1-4bc4-8b80-86653209240b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
2a52d736-42d4-4afa-b136-f1ca2778f2bc	935f2544-5727-47a9-a758-bd24afea5994	1ad39315-d1f4-4655-84f0-db922eac7e1f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
a75235b7-c98e-411d-b91e-97365894e516	935f2544-5727-47a9-a758-bd24afea5994	6bda2acd-5f00-4100-b31a-0de28d40a7c0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
f42cf099-96b3-40df-aa52-ad0cd49f5352	935f2544-5727-47a9-a758-bd24afea5994	29569e45-ea36-4138-83a3-80b85ba9ba1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e826d9cb-d535-4ad8-85f6-13fae826dd68	935f2544-5727-47a9-a758-bd24afea5994	37afad6a-c579-4b34-8042-c3aa708227b9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
53134a1d-855e-4aee-a07d-ec1e40f8d1c9	935f2544-5727-47a9-a758-bd24afea5994	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
f64cf0e2-9b81-4e3d-8fd8-ec9d6cba82e4	935f2544-5727-47a9-a758-bd24afea5994	c4233e6e-d7a3-4018-aff0-5415b06ef15b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
660e2f8e-218a-43ce-982b-1d5f3c13bdc6	935f2544-5727-47a9-a758-bd24afea5994	c93e39fe-759b-4db1-bd9a-230c1f930a7a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
e4dd4344-e040-4721-be0e-fdc72334e337	935f2544-5727-47a9-a758-bd24afea5994	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
46fd1c73-f549-4a4b-b0af-d1e6a83973f7	935f2544-5727-47a9-a758-bd24afea5994	583c470c-9284-4b66-a009-81ffab8bda1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
471d7565-7251-4c48-8ca1-153f701321da	935f2544-5727-47a9-a758-bd24afea5994	6c387ed5-533e-4d6c-915f-72a85bc28c14	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
a97429ad-c1ae-4061-895c-0501327c7617	935f2544-5727-47a9-a758-bd24afea5994	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
7fb0e9df-068a-4f6a-90e9-c1e0148a60f1	935f2544-5727-47a9-a758-bd24afea5994	90a8f117-bde3-4070-8165-95116ddb6c78	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
373876c2-936d-459b-922d-4a6b274e9529	935f2544-5727-47a9-a758-bd24afea5994	78331efc-59a3-49c6-a4da-cd971800b07b	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
2bc88624-c82a-4cd1-9024-f67300a01fce	935f2544-5727-47a9-a758-bd24afea5994	10cd0a5a-934b-4541-900f-61c5400cb33e	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
bf7e0e32-807a-4c33-8094-2101a6d2737a	935f2544-5727-47a9-a758-bd24afea5994	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
97af72e8-d61b-40e2-b18a-50020c7ecf31	935f2544-5727-47a9-a758-bd24afea5994	9c6b3dbf-9144-4d72-9c8c-c9984731beec	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
9d86e6e3-ccb6-4949-940a-a4677faac40e	935f2544-5727-47a9-a758-bd24afea5994	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
81925184-b62e-457a-99f7-963b9c25cf1d	935f2544-5727-47a9-a758-bd24afea5994	d9295f16-be88-4756-8f6e-1cf4764be20a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
b019e11a-17f7-4b32-8358-539e619edd23	935f2544-5727-47a9-a758-bd24afea5994	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
1b283cff-8775-4065-ae19-982176aa8498	935f2544-5727-47a9-a758-bd24afea5994	e67b4538-7412-45c0-a0cf-e27bff88caab	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
01e44a58-8e5b-4540-b7d7-bea3c1ff65c9	935f2544-5727-47a9-a758-bd24afea5994	b24c16bb-ff27-4814-b9d7-523fd69d9b41	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
c7674f76-105b-4d86-aad9-0f7ecb8e8be4	935f2544-5727-47a9-a758-bd24afea5994	1cb61161-23ca-4336-806e-61086d967a67	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
972e9cea-e44d-4e67-9b0b-29353de24678	935f2544-5727-47a9-a758-bd24afea5994	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
9485baee-c2f5-4e2d-9d38-77d7d37e37af	935f2544-5727-47a9-a758-bd24afea5994	278cade5-e251-4520-9394-cdd42c9212e6	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
04a7ff3f-8deb-4004-be15-687b69466eeb	935f2544-5727-47a9-a758-bd24afea5994	b5966924-f09e-4024-8942-8f2e00949567	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
a0a8cdb4-e20d-4d16-a0ab-e1b403bf7b44	935f2544-5727-47a9-a758-bd24afea5994	d1627009-fe55-469a-baf7-1a8b4979d654	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
468fcce0-3efc-4f61-9788-350a122e6e6d	935f2544-5727-47a9-a758-bd24afea5994	f5804675-69c7-4b68-9dc6-22dea1f5201a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
f93c7c39-3fb8-4a04-8977-25b11e7a0ba2	935f2544-5727-47a9-a758-bd24afea5994	4a7446ad-a670-4e50-82dd-e71d2013d520	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
33a81ae3-5401-4589-9280-81f7d2bd1f40	935f2544-5727-47a9-a758-bd24afea5994	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.561	2026-01-28 19:46:36.561
900b1e1f-6e8c-499c-9bcc-69b01b006c78	935f2544-5727-47a9-a758-bd24afea5994	6915f34b-6468-4e75-a1d9-dbeee0529cb8	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
1930ff08-8431-43d9-baec-cde33fd87ace	935f2544-5727-47a9-a758-bd24afea5994	e4778ab5-7678-46d9-baea-0368e4f812f0	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
f7cb4c2c-026d-4b3d-9127-a179b5420d46	935f2544-5727-47a9-a758-bd24afea5994	cf4be8bf-0906-4925-8291-6c8c785dcef4	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
be178011-df03-439b-b9f3-f574bdbd67d2	935f2544-5727-47a9-a758-bd24afea5994	0b038769-9d16-464d-85e6-fed33a40579a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
b537c0a9-6ffa-4af4-a0ab-68908df36f58	935f2544-5727-47a9-a758-bd24afea5994	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
c205af21-bc43-4e07-b9fd-8b5047af0322	935f2544-5727-47a9-a758-bd24afea5994	027e9c43-d25b-4cb5-b4c9-916084271623	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
0408be84-8437-45e1-9293-caefa71276c6	935f2544-5727-47a9-a758-bd24afea5994	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
fba53113-0c16-411d-932b-c473d5f9252f	935f2544-5727-47a9-a758-bd24afea5994	7d0f9dbd-4909-491d-9440-5f87bca5a254	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
d4a7cbc0-a55f-400c-a04a-cd47eca3b9db	935f2544-5727-47a9-a758-bd24afea5994	aa0a06e7-d580-47b2-bc2e-cddd466186cb	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
e545fdae-7747-4652-af72-db8e91861053	935f2544-5727-47a9-a758-bd24afea5994	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
57fa1afd-0d89-485a-b586-30b068b4fac7	935f2544-5727-47a9-a758-bd24afea5994	fa0dcd21-865b-4de3-a315-83af78061b4a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
7b49dbff-e0fa-419b-a875-1ba10c10617d	935f2544-5727-47a9-a758-bd24afea5994	69b81a70-6fa3-4533-9d00-c252f0f6245f	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
58e49790-6109-45e0-b8a7-b3f8d10caed0	935f2544-5727-47a9-a758-bd24afea5994	360b9bee-d159-4e20-ba1f-9681d17cf9bc	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
c3dff5d8-4d0b-40e6-9f12-051daf0e76a2	935f2544-5727-47a9-a758-bd24afea5994	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
8efb70e4-5a12-42f5-a17d-b88364859ce0	935f2544-5727-47a9-a758-bd24afea5994	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
76beb823-8ac7-4776-a057-57deae307f44	935f2544-5727-47a9-a758-bd24afea5994	b19145e9-2513-41c3-b2a7-719588692eed	8cc249d5-d320-442f-b2fe-88380569770c	t	2026-01-28 19:46:36.569	2026-01-28 19:46:36.569
823a02a0-7196-4044-9d5a-39d17c98075b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e6fffac1-4aad-4ce4-9981-3983dde344d3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
8e2abd21-e80b-4cc1-aa25-cd9d2d3e64e9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	32c804e1-e904-45b0-b150-cdc70be9679c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
bf5cc58e-5d6f-4006-84db-8f0db26fb50e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	16d101ea-c92f-44b0-b7dc-11cd3680215c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
6c999a32-28d5-42ed-b50f-49425be126f2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	dce7c8e3-fc4f-4edc-b9e4-66410334ed17	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f5e7c122-58f5-45bc-93e4-3b6ad61894ef	4b9d6a10-6861-426a-ad7f-60eb94312d0d	778ec216-a84f-41c7-a341-9d04269f0dc6	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
5f0df82e-597e-465d-929b-105ab7348dfc	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ed459bf2-7e56-4eca-bc6b-cee6655c644a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
8cb97c18-3880-456f-84ba-e69f4e451e78	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9f38de93-8d44-4760-9152-372666596d56	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
0ba5966e-fe9d-467b-8b93-26ad50fba955	4b9d6a10-6861-426a-ad7f-60eb94312d0d	eadf502a-97e3-44fc-b07c-0f7015cb598a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7e3e94ae-5601-4867-aff7-1da75c7a4a9f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c21d204c-4660-41e7-93c8-d895ddbaab26	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
627a6706-4def-4c0d-bf30-450cad10c945	4b9d6a10-6861-426a-ad7f-60eb94312d0d	31dec1f6-7abb-4742-ade1-42b89ad7766a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
024abe33-b1fc-4fb9-9908-4f27399d1f64	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b182931c-6229-4be3-bde7-ef6126032f52	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
09615cda-33f9-4536-8cd6-357298f9b42a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	93421fdb-364d-418e-898a-a1f62dd8020a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
04e24302-0020-4e59-85f3-d5aeaf235cb2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5bc1c4d2-6371-4992-8ce0-23c01e065bbe	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
580fde54-8169-454c-85fd-1355472e831e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	071a36ac-c2e2-4462-b10d-3175b101bd06	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2f8bd3dd-070b-4f31-a6c4-2649dd79de07	4b9d6a10-6861-426a-ad7f-60eb94312d0d	734f6aa9-6ade-4187-b3b3-2cba78068a34	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
dce31e78-ca03-41b0-9647-2c24b8053460	4b9d6a10-6861-426a-ad7f-60eb94312d0d	bd8e819d-9179-4fba-b0f9-cec4d26efe4a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
1396df95-2def-42c7-9225-6eabf98cf3ab	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e634ed46-7f56-46ad-bf89-af3b7f75dc0f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f7cc7a9c-29d8-4bb2-bd00-b0085dfc4215	4b9d6a10-6861-426a-ad7f-60eb94312d0d	32898e2d-148e-4483-9e74-6fca3a3eed62	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
743a0284-7897-4b2a-9a29-d09dac81363b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3e324e0d-ae2e-4957-a5ca-51a7f20e6350	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
e16b35fa-ec02-47da-9b6f-cc37712b9a19	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
4654e84a-c551-4f3c-b07a-99fb47044ac6	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7a27fe64-579c-4653-a395-4ead4e3860df	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
c2caf608-6ffb-436b-a867-b61094acdc16	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8504d304-1734-41d3-8e1c-8e6765cbf3d9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
26b52a47-6e84-4717-a0ae-4be1de64834f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d8234d20-bcb4-45ba-bcfc-0e4b133b8898	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
5cb3f113-2f95-4b20-9b38-211493a1ad92	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5663e510-84a4-4116-86dd-dfaf709165e2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
dbe67d0d-5d96-4ac4-881f-7b978b549e98	4b9d6a10-6861-426a-ad7f-60eb94312d0d	12663a56-2460-435d-97b2-b36c631dd62f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
a94c2dc3-5670-4bd1-81de-aaaea898845c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	11b13f4a-d287-4401-bd76-82a3b21bbbb6	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
3cacd07c-fbb7-40fc-b969-26f68c7d99b3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	dd0f65c6-2276-4624-b96f-6c0d2dbf5416	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
90d936d5-9e72-46cb-a4de-f547277e4e52	4b9d6a10-6861-426a-ad7f-60eb94312d0d	47abcbe8-9bac-4fb1-845e-09c4efbe35c8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2b918995-9e6c-4ed6-a61b-95c2124d0b35	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4220515f-01f8-40d5-846d-b4a7f5aa460b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
c2fbbbfd-7fcf-417c-9ced-33cede6b1f99	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
8170869d-c7eb-4150-ae9d-e70296769f56	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
b70d37a4-f2af-4440-99b0-05dcdd942905	4b9d6a10-6861-426a-ad7f-60eb94312d0d	cd47199a-6751-4135-a27a-3d4719b9ef1a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2acbee3d-9371-4963-955b-7e23bc6f044e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
41454977-fbc8-4474-ac19-fb83c1bdeb0a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c86565cd-7ab2-4c4a-9152-f911e8eae236	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
88f51268-f8a2-4dc6-aaf9-f75c83f4be8d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7c56a537-fb71-4f89-8602-29e113e90b06	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f43eb3e8-8708-4656-aae2-d21e33812610	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
a83a8581-5249-465c-af1e-081b67a1752b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	28748534-0496-4c62-8647-6af5f01fc608	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f9dc1bea-6fe2-491d-bc93-e55db2718ae5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4c239c57-b3c6-4988-a698-6908b26d0e19	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
881dc4c2-ad32-41fd-8df9-4a7cf9942d34	4b9d6a10-6861-426a-ad7f-60eb94312d0d	493436bd-ca41-4359-8d8a-0d690ee7fc29	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
5bd9ad58-cc3b-4626-92da-1718d2c2fb7b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fe3d87aa-c40a-468d-8e3f-239029a5919d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f25930e3-8e55-4471-a5cb-76d75eb2087e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b52c3226-dc94-4289-a051-b7227fd77ae8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2c7e988b-33c3-4d55-a6f4-27a48cc6283f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7050c97c-b57f-490f-90a9-d8601fcb3852	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
fb8cc363-d56e-4cb1-954b-4c660ddef7d4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	60fc24d8-ef72-4107-8519-429969f3a05b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
3df75e96-d202-4665-8b3f-8c2864a6af6f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	db419a02-b502-47b6-bf78-ca8e5cc0db52	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
df100e24-5f44-4ecb-9be5-07a491f5cfec	4b9d6a10-6861-426a-ad7f-60eb94312d0d	913edefa-4e9b-4792-bddf-5739e52946f3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
ccea73b7-9527-443a-98b8-d3d739c8e07c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ee14f2cd-9823-4e38-9202-0d3f88fd82d6	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
bdbb698c-085e-4226-97d0-84b12911d58b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
c498efb4-77a3-4081-9984-8a6dff22ffd5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	81aabfd3-329b-4346-848b-5bea91a93fc1	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7d15b846-ba3f-4ef2-ae37-90e97d46c665	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fea93ffa-2056-42bd-984d-d35e5d8999a3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
fe350e46-6b90-40fd-8003-f3deb8519de3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9354e37c-87a6-4aa8-a7a0-92ed57549ea2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
b5bac24b-8f20-4b78-947c-3e6b93a1786a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
4887a9b8-2849-4352-b5e3-938b282cb651	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e76be943-41ac-4c14-980c-603a3652643f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
46e181a6-42fa-498d-951c-14c95919737c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3ce0f539-13c5-412d-8301-2ba191ea3328	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
690a5bb8-2476-4b5e-bd28-f099ac59ec03	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f2a1ef04-5d75-4787-9f74-f92b159cd3e1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	623da6ff-cb25-4a58-bafa-da9088cfb606	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
8fd198d0-429f-47bc-add3-740ca449ffa2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
d0a1d869-48b0-4f4a-91f2-b44e590d516d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b0ca323f-43b7-4020-b9f0-307751da0b74	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
15d58e2f-e47f-4589-bf5e-870c5d3bded9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1c02ee54-327e-464f-b249-54a5b9f07a95	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
d728ed25-b343-490c-84f9-8faac96fc71b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1a8acd2c-9221-47e0-92f6-35f89fa37812	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7c9e700a-968e-4123-9212-2371dd40ca4c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8432f245-2bb6-4186-a3fd-607dee8bfbb3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
aa7832cf-f287-4725-85fe-43f6a13580da	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
b266070d-54be-48bc-9425-3ad4347fa5f5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9d0c0a31-5443-434e-ade3-843f653b13a5	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
a6fa4d6a-2962-4ff0-96bf-b33095f67aaa	4b9d6a10-6861-426a-ad7f-60eb94312d0d	15adee7a-c86c-4451-a862-6664e4a72332	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
3c1c3ed6-4666-44b5-8842-d2fa254a7af9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9871b276-3844-46c3-8564-243c81bfc26e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
14fd3d0f-4b5a-46c1-9295-ca1561fee45b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
1bd2e75a-79cd-4846-a163-114c3549ee5d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	441dc9df-8866-4dcf-8f81-c8957513ddaa	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
cec9e0a2-b51c-4531-a024-9c2e98d83125	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6f57f96c-4e83-4188-95b1-4a58af42d368	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f4f8e1d1-661f-47ef-b7e9-0be7d5488625	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2e568ea8-6aab-4e76-b578-8fc44b566d00	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
12837025-fe59-40ec-b5f2-9861b4c8f129	4b9d6a10-6861-426a-ad7f-60eb94312d0d	92ddb36f-34ee-4f99-8da8-f52d78752b40	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7bf776a5-a2b4-49af-a9a4-cdb2cb6932d7	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d2a87d3c-d4f5-4728-a702-d520d52f8efc	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7008c62a-3207-48dc-bde0-945337b2c862	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f0e99a4e-6afb-4a01-b202-3ab650f15e88	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6f00304d-9dd1-4a86-b25e-96ffc4c96245	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
ed18d213-7ba4-4cba-8c60-9966f1b29ff1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	29535a71-4da7-4d9e-8a1a-088498c25104	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
5b7db61d-65a6-4b19-98c0-901f5ec857fd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ae102e8b-bccb-4edb-8c92-bdb1225dfd15	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
307d7482-43a7-4732-8d26-012207970b91	4b9d6a10-6861-426a-ad7f-60eb94312d0d	53179e6b-42df-45fb-808e-06635445f0a3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
7a1a5176-96b9-4c93-96ea-f1d7b61f467c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	01bfbc25-4974-4e1d-a039-afc1ab9350a0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
22c4434d-9367-47c4-8c53-c8b6e26f3df5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
738af62c-348e-4a00-87b5-8c619038ce93	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
12f80f6c-e007-4eb0-98af-a7a0af746694	4b9d6a10-6861-426a-ad7f-60eb94312d0d	49845113-2ada-42b3-b60e-a10d47724be3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
a3c63d48-6c35-48e5-8eaf-b8deaf69cd8b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2ca1d25e-477a-407f-a1de-43d9df1f3d07	4b9d6a10-6861-426a-ad7f-60eb94312d0d	23525539-5160-4174-bf39-938badb0bb75	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
01424cd7-6892-493b-ba44-9e1869e601b3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	45b02588-26f2-4553-bb6e-c773bbe1cd45	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f04a4de8-bce0-415a-a01c-10ca702b241b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	18bed42b-5400-452c-91db-4fb4147f355f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
4a3f7c0c-84cf-4a48-8e47-e0ed2466056c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5849ff0b-a440-4ab2-a389-b4acc0bf552e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
cdc5d33b-5e49-473a-872d-10590b306107	4b9d6a10-6861-426a-ad7f-60eb94312d0d	aba9bce3-2155-4621-b4b0-3cf669cad3b2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
f7e7c917-9e37-4c4c-8f30-a37e45ea2e76	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2dd84bba-57aa-4137-b532-5e40df1f9818	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
ccdf47a3-d35f-4a62-b36b-540273a007e2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	02bf47ac-626f-45f7-910b-344eab76bc24	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
d0602aaf-3799-426b-8107-c40698436262	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c022b4da-2739-428a-8169-4522791ac94e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
fd415c4c-59ee-4688-b318-262a26cad733	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
2b562228-fdb5-4398-a04c-942324c77f6f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8d49f450-e103-4b29-8e22-2e14306ae829	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
a2109763-a5bf-4232-9b73-678a62efac90	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e483cd63-2bcc-41d8-bb4e-692c4d20afc0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
9d301184-3b16-46f8-9f4e-7cdac8692b7c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6b142850-4553-451e-a6cb-3cb9fe612458	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
933b1397-13f4-4440-9334-559de1e6b5dd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5029f19f-04e8-4c22-baaa-abc4410face3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
ee6b4469-e691-43e3-ad85-18703b43fbe9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
e669c819-ea62-4c0e-8072-aa011aef049b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
fcc0beab-7423-4dd6-b490-943fe5a46a37	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3a237a3a-4394-48e9-87c4-334c87d1b6a1	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
dbb4fb46-261b-4260-826d-35c054c95a3e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7ef05e26-cf68-4e16-a18d-c925d29e7d0a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
6246db4f-75b5-45d4-9c74-da713baee383	4b9d6a10-6861-426a-ad7f-60eb94312d0d	00160b54-fdf1-48d1-9b52-52842dc8df4e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
67d1026d-dcd8-46bf-a76c-3d86ddcc4649	4b9d6a10-6861-426a-ad7f-60eb94312d0d	29e9b502-fde8-4a8f-91b6-ff44f8d41479	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
0d9c20c8-6511-4ff7-a0d3-e7086314514f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ca6e0150-9d34-403c-9fea-bb1e35d0e894	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.388	2026-01-29 01:25:07.388
fc7b1f32-b61a-4882-833c-c3946ce9175c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	16743e3d-672d-4584-9a3c-5d76ae079569	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
58af538f-e776-400c-9415-49b81dce6c5d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
fb30ba4e-e918-47c4-b2c7-7511e03ceb39	4b9d6a10-6861-426a-ad7f-60eb94312d0d	372b482c-fcb8-405d-a88a-5d2ee5686e30	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
03f8c0cf-1f2b-4208-9ee2-05a463dad18d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c47cf3e0-e149-4834-b454-5fd4d583a1a7	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
c44ba5e0-0ab7-44a2-b9ba-6fb793681680	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d7b7595d-a831-48ec-84d4-39476bc3e44a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
748fa7ff-e367-4a2b-9540-4ec26279fc84	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0690e264-ed8b-48b3-8930-5651eebe2e2e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
7e0bc32d-90eb-4afd-a0f9-1ccd8fb60a0c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b969a964-3765-4744-8080-3e2c88ab688e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
a701ec72-7b86-435e-812a-8b868baa8df6	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6750bd19-7115-4966-b7db-0d8e2add036a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
020bda46-1555-43f7-ad7b-616973a48095	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e2b4450f-4d07-4171-9a2b-8e2ba98a390d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b1b49a21-add1-4828-b86b-ea78b5663961	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2afa78a2-892a-4dfb-9098-7926491b648f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
2d3f59c8-376b-4c25-9d58-fba26ba4e6ff	4b9d6a10-6861-426a-ad7f-60eb94312d0d	374edfb0-e4ae-4625-af63-a14d4cb48f9b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
060f0703-e07e-48c8-87f8-65b73fdb004d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d9f8f427-d02c-4a3a-9091-0a442685cf72	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
9acef459-f7dd-4f66-8100-931d72bfc3f4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9b28e1e2-badb-4a9d-88d4-84f5612934e5	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
896db5e3-d954-4a07-96d5-84339a1dbb3d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d4b1799f-245c-44e7-bc89-1eec59a28c9c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
a00845f2-abfa-409c-8ee0-3b08f2bb3c31	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6038e2ae-cb47-4eb1-be2e-067e48ba9c83	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
ce5c6937-1a7a-444f-aca4-ecb2e4706cf9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1a810543-4218-41a4-90ba-9e3743f077fa	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
c9b02a2f-fe8e-497d-a7bf-a4ac4b1337e8	4b9d6a10-6861-426a-ad7f-60eb94312d0d	09827071-8a30-42ac-898c-59a6fe9f0c75	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
92f18acf-7234-48b1-a63a-a2c68f1951a7	4b9d6a10-6861-426a-ad7f-60eb94312d0d	59996c9e-0bc9-4120-bee1-3f0455f81725	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f6140456-122b-4c7e-a450-e2676f804c3d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d36af823-920c-47ab-965e-4ab698621052	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
e18333af-72d9-4d53-a5fe-060cd561f810	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
70802b21-b998-4a1d-bd2a-8e4f73ad34b2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2d3e7958-5f64-4312-abe6-0af811e901c3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f23fe0d4-8f2d-4135-ac74-c2dee8288543	4b9d6a10-6861-426a-ad7f-60eb94312d0d	92b916e1-6a0b-4498-9048-3901b27bec39	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
2bb8621a-91b7-4aa8-af28-93f564fb71f1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7f87bc22-635b-416a-8722-53c1ee704f0c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f8a777bb-ee6b-4149-8333-a8b08b14f149	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d65b2853-a79d-401a-8f05-adf2743b9162	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6dc81ea2-b8c2-470c-ba1a-4c2fb8c91e11	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5f946046-e498-403d-a64a-6933c7bd6896	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
1111629f-f90b-410b-b51d-eabfa3d6ee2f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f3aa333e-caa8-4933-b05c-e98a52d0fd1c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
1e9580ec-d074-4f8a-b3bf-c999e47e003f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c6db06ec-612a-4dc3-bbc6-7c153e90994c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b40f5dd2-5c5a-4e1b-9231-01693c24c267	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f410965b-b444-4df5-bfd6-e138109567a0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
fe4efc7b-fa54-441b-9c5d-0a75c6fcfbff	4b9d6a10-6861-426a-ad7f-60eb94312d0d	77e171bc-3fa1-4ecb-8a5a-95029ca1f242	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b491ed37-1745-4244-a7f1-348c07caa695	4b9d6a10-6861-426a-ad7f-60eb94312d0d	edccde66-49d6-459e-94e7-02b99477d24c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
aebebd98-743c-49f4-b13c-5731501194a5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
da18936e-64d5-42fe-8809-7ed2e91de824	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f3da6061-0490-40ac-bdec-10e862ef1296	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
4d17e48f-3bc1-4fc4-9452-497f9ba02949	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8e9ff64e-0787-4e03-9835-e833ca96ed46	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
5a75ed40-ac86-4453-bc76-ba006c990929	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b54125c1-a96c-4137-9e7a-c197421d99b3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
4041349c-241a-4530-8da5-da57158c04e9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	bebb0636-e19e-40a8-8733-18aa11ba1e13	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
56181c02-deec-4774-994d-2de0bfd590f1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6432d484-b4a5-427f-a12a-59303f1e50ee	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
fcf58b83-0b15-465b-94d0-11a45b8e6278	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4f96dd8e-6915-481e-aebb-672f83b45aa1	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6e9d6e1c-8ac4-4459-83a7-4e87feaf576f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	88f85444-56fd-4596-a6f3-84e3dde28513	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
4a6fd2eb-ce21-42d4-a04f-c17b9d1bc6ed	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0953b49f-6af7-4347-a249-24c34997bf1d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
95161123-80ba-447c-8f94-211574a6ceae	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0d33577d-027b-4a5d-b055-d766d2627542	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
840df24d-48da-4715-88d8-6fb6075abf2c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8e2f3b14-4bb8-48fd-88c4-54a573635bc4	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
4f8d281f-89cb-4c9d-aff3-a40acb38cc78	4b9d6a10-6861-426a-ad7f-60eb94312d0d	02932d66-2813-47b0-ae40-30564049a5ef	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
5d34ac6e-5f4f-4b3c-bc4d-6d6d920df09a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a4ccc274-2686-4677-b826-95e0616f156d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
34324146-72b3-42ce-b7e9-c066b2e9ae56	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a04fc678-94ae-42bb-b43b-38ce17d30faf	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
d39cf8ba-7d52-49b0-9838-99e3a88166cb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1a8f1b99-a206-48d9-8170-23814b72c4cc	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
41f4caec-3f68-4023-9671-0bf137beae4f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	295fd56c-315c-4c82-9e20-fb571f376ddd	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
0ee3af60-3f89-48cd-82f9-48edeb0185fd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a0099cf4-5479-4475-a86b-2f3d67995db8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
30cd04a9-7d0a-4d22-ab70-f276497a8d7e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	dfbc0a35-28c7-4077-b9e6-08f3413ad130	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
9eccb5a7-da8c-47ea-bb79-9cf4f91c6423	4b9d6a10-6861-426a-ad7f-60eb94312d0d	47dcd774-7cbf-4a87-94df-369d0abf9232	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
707eb42b-97ec-4682-a3f9-cd89e424e70d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d2d84e05-c829-4c67-acec-3632e5f6515a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b7f8cb89-bb92-41b1-abff-29e6f9bca182	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0a421a5e-ad04-43ab-a539-2644d3ddabb0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
3dc7d13b-8c3f-486b-8d91-0aca4c6a6b03	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f8705655-8e50-4159-b738-efdb7c92de1f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
e7e349c7-7241-4086-9f2f-1a3ae5224856	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
9852ced0-7725-4b1a-bf6d-d7d3f319c981	4b9d6a10-6861-426a-ad7f-60eb94312d0d	81e51f8b-500d-4366-9360-3450dfa5ee4d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6a384165-c503-48f5-8ffe-ca3c6a824a81	4b9d6a10-6861-426a-ad7f-60eb94312d0d	a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
5f1176d8-32d2-431d-b607-640e691b7b0f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9297daf6-1431-4b62-9039-2ee22dcbba29	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
db1b99e7-a390-4370-b071-e010b71ef0ef	4b9d6a10-6861-426a-ad7f-60eb94312d0d	eb4b669b-ccb1-4be4-bbad-5e1717b36d79	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
dd0c15c6-28a9-4fc3-9d43-a6f251eeae3f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f34e06ee-82cc-4a62-bd17-947c58f42116	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f8e78d67-1e4d-40cf-9553-7033147f07eb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	38ccc597-1f09-4de4-ad38-b9cddd2256c3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
9bf50908-4853-4b59-823b-c07f6d69dd0e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	70e897f5-c029-4382-9778-de9aa02b85d7	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
2f9b33ae-bd46-4271-910a-a4c8d2f98cdd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5f42e8ac-7ec4-4192-9df8-2b18467c12e9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b71c95ab-c3c5-4c4d-b19b-d3b0ac2bc66c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	834f193e-7023-48a7-bc8e-58a910845d6b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
580df6a0-c332-4188-9bfb-63a7e50a032f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e90ca965-4a55-433d-83c8-9de44b168b9c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
969c1ef6-1400-465b-8873-efdabf85b006	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e8d65387-e415-4e52-bf95-4cf7134e2235	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
7a531163-589d-423b-a690-4c4b1363f862	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
063c8fdd-853c-41e1-8662-29e642aed35b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	66177523-edef-4bb4-9e47-1db421e14257	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
e4723ad9-4ff4-4912-8fe6-fdb15a292056	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fcd820ab-6f42-4794-8e6a-217faa6017ac	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6bfca1ae-38a8-4118-97b4-e02a6e959be5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	172fe5c4-06a1-435e-86e1-50a717ff1505	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
d250b048-a702-4975-8a18-ed6bf2e5d035	4b9d6a10-6861-426a-ad7f-60eb94312d0d	52fa7c54-7266-459b-b679-a4a0966dcca2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
b36a58eb-c389-4e37-adee-684833578d17	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ad04836f-3c39-4de5-ba1d-171dded4420b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
99dc0417-607b-4548-aea7-d5f550c9ccfe	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5c6ae2e3-4332-4f90-b002-8dedcae3ba24	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
d2b5c043-ca92-4187-aec9-cb7dc0490cc5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9fab0497-b7b0-43af-8c94-ac59cf2d504a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
77910b9f-70c4-4670-b5e1-d41454bd35bb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f84eea12-667d-48eb-965e-36d73db3e9fd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e0b720ab-8f2e-4914-b9f1-3dbec41eef21	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
718dc86d-a776-44b3-a1a9-9ed08945c854	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2069bcb9-4a3d-4462-8860-e39fe7327d4f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
c168010f-3ed5-4ede-9c0b-8431201ece1a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4b0170c2-6403-45f2-a9be-25e61595b48e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
d5a557ae-f0cb-4e24-a615-56b6e5953d91	4b9d6a10-6861-426a-ad7f-60eb94312d0d	db94e4b5-77ae-4459-8494-e31443458d7a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
e8ffaf01-f853-483b-8b3b-4810546aef5b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fb7e9280-2b6f-429c-be0c-e4fa204755f8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
a8e8579c-840e-4d8f-8ead-9c13ab570b0e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9c06ea4c-d311-4249-a91e-09c14c66786a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
2b9be386-75a2-46c3-b8c8-f841c424f4d7	4b9d6a10-6861-426a-ad7f-60eb94312d0d	38c264c0-26f6-4929-a52c-2277e2aaccce	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
4b4dcc79-d4c8-4c52-8316-3b1d72f8f46e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f805fc9a-4c6d-4a5c-be7b-5c5448fd4615	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1042f63e-2ebf-492c-87e8-2b7bdc69150d	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
7f25b2f3-f0fc-4ee2-9ac8-5e7065db83f5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7c469d95-9f01-4295-ab59-fd3698ed7a36	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
86588660-76d9-4004-a97d-56f8d5779324	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8d3556d9-f508-4a55-9f48-5c1aebc59de9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6637a7fc-523d-4595-9672-5eb165648671	4b9d6a10-6861-426a-ad7f-60eb94312d0d	04c59caf-4541-4e15-8c6e-d4a435967ef4	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
a3f6ba0b-3172-4fb3-a1ea-f6035476bb5f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	ade77569-3a72-4030-b2b4-11814fdd6b0a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
6d87de58-4197-42de-bfb4-0bcd4753253c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8bd68779-d3a5-4372-b932-598273b735ef	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f65dbdaf-847f-414b-a9c3-49e7e809e007	4b9d6a10-6861-426a-ad7f-60eb94312d0d	251ebe60-b752-4467-aa22-0d46d5ae4953	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
897580da-40cc-4299-9ef2-97df11d3ecc8	4b9d6a10-6861-426a-ad7f-60eb94312d0d	411c3f03-3466-4fb1-a4ff-a9f71f7432ba	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
beb8d81e-ce5d-4a6d-bcb1-b9d9652797fb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9b0f7458-981e-4a78-9cc1-969130cfb358	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
1e143494-409e-4e28-9ac0-cf6b7e6b2aaa	4b9d6a10-6861-426a-ad7f-60eb94312d0d	36ea8942-d4e1-44ed-a36c-33fb6e715560	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
f786ef9e-ff6d-4cef-8d95-381fa3ef5c82	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c4944fca-068f-4ab5-8b9d-3b2493d785f2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
d3d6d663-602e-4aa1-96a7-34d2644fd01d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e997b7ee-7a74-41b3-8089-1f8b84fa6b24	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
2e1c1bf8-71c9-4e90-bf20-a14cec7e21e8	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c2066743-efa9-40b6-94b9-5b2b6e0942f3	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
33cf87d8-dccf-4365-8ce0-aac95ad140a1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5def1949-7a28-4715-8427-6cb028048712	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
359377eb-af8b-43df-bbb5-0e693620c4b0	4b9d6a10-6861-426a-ad7f-60eb94312d0d	add83dad-b55a-4e07-ab2f-9c1828f310e6	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
a866b934-2887-4907-a30c-80342ed299f1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
77090e6e-cab8-4148-b69e-aace2afbb3c0	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1a73dfdb-7333-4239-a6a6-7863010a6953	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
79b29fd4-f734-478d-8d23-7735763a9ea9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	635f7357-f443-4723-994f-7a81dd5d165f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
77e57af0-4ba5-41e1-8588-6ee200aaee0d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1a291f0f-1525-4815-ba48-67acaf27dd7a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.397	2026-01-29 01:25:07.397
47ea8aee-efbe-4e93-95b5-5dbc8f12521b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d2f92a82-754c-4dbf-9297-8222e71b7573	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
59429c76-fc85-445d-bb0f-d6d5228c5836	4b9d6a10-6861-426a-ad7f-60eb94312d0d	aec1a837-c291-452c-9ac6-425d9f9dca36	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
1897b06a-0f4c-4543-b10f-98fa3069226e	4b9d6a10-6861-426a-ad7f-60eb94312d0d	409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
99b35d85-b1a8-4a6c-a929-3697fb98e691	4b9d6a10-6861-426a-ad7f-60eb94312d0d	81cf9d60-063d-4054-8277-0fc6eaa042ee	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
e7d53bb2-9399-4000-87d2-9bc7a6ebef69	4b9d6a10-6861-426a-ad7f-60eb94312d0d	11859bb3-3249-4b3b-bc93-2236f608ff1e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
e1d73373-ca50-43ae-a546-e53b83b22f98	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4e6637ef-7d36-459a-9cf9-bd485e521443	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
7eab0b27-11ae-40ac-a34f-98d3ed23dd4d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1e00e441-4e0a-4c95-a147-d5ba83dc7883	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
66242668-e164-4cdc-b599-476854676fb8	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2af622c9-671a-4992-8b66-085781d11864	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
e13ca339-df2c-4992-a35f-cf1260259ce2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fda4281b-edb1-4bc4-8b80-86653209240b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
2260329e-cd02-40fe-b1eb-015e2b4e9d7d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1ad39315-d1f4-4655-84f0-db922eac7e1f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f101c32d-6f65-46b9-8815-aa1179fa3e81	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6bda2acd-5f00-4100-b31a-0de28d40a7c0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
d835ad2b-72eb-47b6-b956-64c61f04ba8a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	29569e45-ea36-4138-83a3-80b85ba9ba1a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
7174d949-2a71-406e-b215-99b9d243864a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	37afad6a-c579-4b34-8042-c3aa708227b9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f9ea9a76-2ab8-48d0-bbb2-8f6138362769	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d61520ca-a0b6-4df5-aaec-9abda8fc55d5	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
4c85bad8-5b95-450f-91a0-918d4c48dc54	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c4233e6e-d7a3-4018-aff0-5415b06ef15b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
4b4a5715-68da-41cf-bebb-454882ce440b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c93e39fe-759b-4db1-bd9a-230c1f930a7a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
0d76f22d-7a64-4706-9ce0-057f1515f062	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
3e8c1bef-dedf-4381-887f-a70d3ce2a302	4b9d6a10-6861-426a-ad7f-60eb94312d0d	583c470c-9284-4b66-a009-81ffab8bda1a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
d5b31c98-5222-4dfa-99bb-72d451c699f4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6c387ed5-533e-4d6c-915f-72a85bc28c14	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f41f4ee6-f8ce-4101-92bf-d63c010be3da	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0abf95b2-7e48-4d1f-bc17-4d5c384783a2	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
4284fb38-f624-41a3-8d3e-6ec0f9b02b45	4b9d6a10-6861-426a-ad7f-60eb94312d0d	90a8f117-bde3-4070-8165-95116ddb6c78	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
6e78a213-7dda-4d00-bf92-bcda77081220	4b9d6a10-6861-426a-ad7f-60eb94312d0d	78331efc-59a3-49c6-a4da-cd971800b07b	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
01d95ad2-53bf-4d92-8acd-a02cb26179ac	4b9d6a10-6861-426a-ad7f-60eb94312d0d	10cd0a5a-934b-4541-900f-61c5400cb33e	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
9827b79e-652e-4c55-b0b6-4a5eadfef31f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3db7e945-42c5-4ca5-88c0-1ae75751d3cd	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
20cbb3e4-212f-4eda-9602-26a891883a10	4b9d6a10-6861-426a-ad7f-60eb94312d0d	9c6b3dbf-9144-4d72-9c8c-c9984731beec	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
c8f2c1e7-31e6-4ee4-875f-aca623176192	4b9d6a10-6861-426a-ad7f-60eb94312d0d	5e585603-a76d-425f-a0e9-1e62f5f7e9e8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
55c84ea1-88e6-4094-8c14-898933d2dbc5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d9295f16-be88-4756-8f6e-1cf4764be20a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
a4fad415-5315-4f17-b4a0-391c16d693d7	4b9d6a10-6861-426a-ad7f-60eb94312d0d	bfb05d2f-9712-4a49-9db5-c7fc6db9e876	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
8ca7c1e2-93ce-4d26-abe4-50edcbc21129	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e67b4538-7412-45c0-a0cf-e27bff88caab	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
db5d62e4-71fc-4951-884f-35e7a9723ebf	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b24c16bb-ff27-4814-b9d7-523fd69d9b41	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
eaf5454b-d1f5-4be7-b84c-5034dd596007	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1cb61161-23ca-4336-806e-61086d967a67	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
c0b23d11-b33d-42ba-b9a3-d355ed66939a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
d02e0de2-b365-4235-9665-7265ecce2fe4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	278cade5-e251-4520-9394-cdd42c9212e6	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f26deee3-64e4-4a9b-8d78-0ca1f8053156	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b5966924-f09e-4024-8942-8f2e00949567	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
a131faaa-8e1a-49a6-84d7-06254bb17cdd	4b9d6a10-6861-426a-ad7f-60eb94312d0d	d1627009-fe55-469a-baf7-1a8b4979d654	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
dcc487e8-343f-4b58-b8e8-a64d46abe3ae	4b9d6a10-6861-426a-ad7f-60eb94312d0d	f5804675-69c7-4b68-9dc6-22dea1f5201a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
80a134e6-8012-4f26-9207-8db49881347d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	4a7446ad-a670-4e50-82dd-e71d2013d520	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
86b57690-d5b8-4a62-a07f-9db25179dec2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
69de0fb9-c9e6-4d3a-97f3-b92848cc05ba	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6915f34b-6468-4e75-a1d9-dbeee0529cb8	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
426bfb0b-b106-4d00-9b21-257fd3dad76b	4b9d6a10-6861-426a-ad7f-60eb94312d0d	e4778ab5-7678-46d9-baea-0368e4f812f0	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
1fc4890d-8ee4-4c27-8798-414c16f84b8c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	cf4be8bf-0906-4925-8291-6c8c785dcef4	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
3353da37-845a-488b-9037-8ca2227c95d1	4b9d6a10-6861-426a-ad7f-60eb94312d0d	0b038769-9d16-464d-85e6-fed33a40579a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
abceedbe-929c-41dd-ae6a-5ed71424fa55	4b9d6a10-6861-426a-ad7f-60eb94312d0d	da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
973c9bc6-7917-40c6-a6f2-159b4d24c94d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	027e9c43-d25b-4cb5-b4c9-916084271623	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f812e4a4-7ca9-42fe-83d9-6ebe101aa6ac	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
670e04e7-63bc-4404-bc50-a1ed6fde7226	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7d0f9dbd-4909-491d-9440-5f87bca5a254	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
63f92943-08e2-4183-92c0-b22ce5066dbb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	aa0a06e7-d580-47b2-bc2e-cddd466186cb	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
e7ee753c-a8ef-4f64-a754-a22fc8982515	4b9d6a10-6861-426a-ad7f-60eb94312d0d	7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
0098ff22-8014-4cee-9cb8-a650371dca6d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	fa0dcd21-865b-4de3-a315-83af78061b4a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
8b98e976-3f7c-49ce-b39d-04378ddc414f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	69b81a70-6fa3-4533-9d00-c252f0f6245f	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
f0f90981-e862-485c-a437-89d41d8bf234	4b9d6a10-6861-426a-ad7f-60eb94312d0d	360b9bee-d159-4e20-ba1f-9681d17cf9bc	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
869895c3-6251-4b61-8ac7-5158dd909ec7	4b9d6a10-6861-426a-ad7f-60eb94312d0d	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
3add159f-81a2-435c-b30c-b514fb9d16a3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
9ad553ce-7b90-461f-a374-c12f518af216	4b9d6a10-6861-426a-ad7f-60eb94312d0d	b19145e9-2513-41c3-b2a7-719588692eed	007a7957-92c0-4ec4-9a93-f5cd56260f10	t	2026-01-29 01:25:07.405	2026-01-29 01:25:07.405
\.


--
-- Data for Name: dsx_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dsx_requirements (id, name, type, "fieldData", "documentData", "formData", "createdAt", "updatedAt", disabled) FROM stdin;
7456d517-e212-454d-8d4a-e19ddd077ba7	Company Name	field	{"options": [], "dataType": "text", "versions": [{"changes": {"dataType": {"to": "text"}, "shortName": {"to": "Company Name"}, "instructions": {"to": ""}, "collectionTab": {"to": "search", "from": "subject"}, "retentionHandling": {"to": "no_delete"}}, "timestamp": "2026-01-27T21:18:44.413Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Company Name", "instructions": "", "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2025-04-06 16:07:35.433	2026-01-27 21:18:44.416	f
61588fb6-5a89-4b27-bf6f-1a6d07b48a1f	Company Name	field	{"options": [], "dataType": "text", "shortName": "Company Name", "instructions": "Provide the full company name.", "collectionTab": "subject", "retentionHandling": "no_delete"}	\N	\N	2025-04-06 16:07:26.568	2026-01-27 22:58:54.988	f
739b2b3f-db5c-4010-b96c-5238a3a26298	First Name	field	{"options": [], "dataType": "text", "shortName": "First Name", "instructions": "", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-27 02:54:17.592	2026-01-27 22:58:54.993	f
8cc249d5-d320-442f-b2fe-88380569770c	Surname/Last Name	field	{"options": [], "dataType": "text", "shortName": "Last Name", "instructions": "", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-27 02:54:43.847	2026-01-27 22:58:54.993	f
1f27c8a7-e554-41bc-8750-230e2c3f5018	Residence Street Address	field	{"options": [], "dataType": "text", "shortName": "Street Address", "instructions": "Enter the candidate's street address, including house/building number.", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:42:29.168	2026-01-28 19:42:29.168	f
ba8bb198-a455-4713-b8bf-026f155acda0	Residence City	field	{"options": [], "dataType": "text", "shortName": "City", "instructions": "Enter the city of the residential address.", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:42:56.87	2026-01-28 19:42:56.87	f
5132a5a2-6bbc-4fe6-b242-8eee1e761c86	School Street Address	field	{"options": [], "dataType": "text", "shortName": "Street Address", "instructions": "", "collectionTab": "search", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:43:32.486	2026-01-28 19:43:32.486	f
5ea29387-6d88-43e4-aaa8-481937d22b9c	School Name	field	{"options": [], "dataType": "text", "shortName": "School Name", "instructions": "Enter the full official name of the school attended.", "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2026-01-28 19:44:43.434	2026-01-28 19:44:43.434	f
007a7957-92c0-4ec4-9a93-f5cd56260f10	Company Address	field	{"options": [], "dataType": "address_block", "shortName": "Company Address", "instructions": "", "addressConfig": {"city": {"label": "City", "enabled": true, "required": true}, "state": {"label": "State/Province", "enabled": true, "required": true}, "county": {"label": "County", "enabled": false, "required": false}, "street1": {"label": "Street Address", "enabled": true, "required": true}, "street2": {"label": "Apt/Suite", "enabled": true, "required": false}, "postalCode": {"label": "ZIP/Postal Code", "enabled": true, "required": true}}, "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2026-01-29 01:24:46.435	2026-01-29 02:45:56.574	f
0f73bcea-e704-44da-bbf2-0a4a5e0b679b	School Address	field	{"options": [], "dataType": "address_block", "versions": [{"changes": {"collectionTab": {"to": "search", "from": "subject"}}, "timestamp": "2026-02-14T15:13:38.618Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "School Address", "instructions": "", "addressConfig": {"city": {"label": "City", "enabled": true, "required": true}, "state": {"label": "State/Province", "enabled": true, "required": true}, "county": {"label": "County", "enabled": false, "required": false}, "street1": {"label": "Street Address", "enabled": true, "required": true}, "street2": {"label": "Apt/Suite", "enabled": true, "required": false}, "postalCode": {"label": "ZIP/Postal Code", "enabled": true, "required": true}}, "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2026-02-14 15:01:51.861	2026-02-14 15:13:38.619	f
\.


--
-- Data for Name: order_data; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_data (id, "orderItemId", "fieldName", "fieldValue", "fieldType", "createdAt") FROM stdin;
\.


--
-- Data for Name: order_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_documents (id, "orderItemId", "documentType", "fileName", "filePath", "fileSize", "mimeType", "uploadedAt") FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, "orderId", "serviceId", "locationId", status, price, "createdAt") FROM stdin;
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_status_history (id, "orderId", "fromStatus", "toStatus", "changedBy", reason, "createdAt") FROM stdin;
535b219b-c5e8-4bae-802c-50d366d6cf9a	55e39c40-b4f7-4290-8130-9d4717570d95	draft	completed	f7b3085b-f119-4dfe-8116-43ca962c6eb0	Order completed	2026-01-26 13:53:20.898
218e0238-d5a8-4453-aafc-ec0a8c972083	d39e3b67-282e-4d87-87d9-4b11372ea5af	draft	processing	f7b3085b-f119-4dfe-8116-43ca962c6eb0	Order processing	2026-01-26 13:53:20.902
5d8ff0a4-0fa2-4b26-95fa-18ad6a89fd3d	167b7ce6-af7e-4311-b5e2-a0924c28613c	draft	submitted	f7b3085b-f119-4dfe-8116-43ca962c6eb0	Order submitted	2026-01-26 13:53:20.903
\.


--
-- Data for Name: order_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_statuses (id, code, name, description, color, sequence, "isActive", "allowedNextStatuses", "createdAt") FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
55e39c40-b4f7-4290-8130-9d4717570d95	TEST-1769435600889-001	020b3051-2e2e-4006-975c-41b7f77c5f4e	f7b3085b-f119-4dfe-8116-43ca962c6eb0	completed	{"email": "john.smith@example.com", "lastName": "Smith", "firstName": "John", "dateOfBirth": "1985-03-15"}	\N	Background check completed successfully	2026-01-19 13:53:20.889	2026-01-24 13:53:20.889	2026-01-26 13:53:20.89	2026-01-26 13:53:20.89
d39e3b67-282e-4d87-87d9-4b11372ea5af	TEST-1769435600889-002	020b3051-2e2e-4006-975c-41b7f77c5f4e	f7b3085b-f119-4dfe-8116-43ca962c6eb0	processing	{"email": "jane.doe@example.com", "lastName": "Doe", "firstName": "Jane", "dateOfBirth": "1990-07-22"}	\N	Currently processing background verification	2026-01-23 13:53:20.889	\N	2026-01-26 13:53:20.901	2026-01-26 13:53:20.901
167b7ce6-af7e-4311-b5e2-a0924c28613c	TEST-1769435600889-003	020b3051-2e2e-4006-975c-41b7f77c5f4e	f7b3085b-f119-4dfe-8116-43ca962c6eb0	submitted	{"email": "bob.johnson@example.com", "lastName": "Johnson", "firstName": "Bob", "dateOfBirth": "1978-11-05"}	\N	New order submitted for processing	2026-01-25 13:53:20.889	\N	2026-01-26 13:53:20.903	2026-01-26 13:53:20.903
ee5ea754-754a-4325-87df-a893a67eb69e	TEST-1769435600889-004	020b3051-2e2e-4006-975c-41b7f77c5f4e	f7b3085b-f119-4dfe-8116-43ca962c6eb0	draft	{"lastName": "Williams", "firstName": "Alice"}	\N	Draft order - not yet submitted	\N	\N	2026-01-26 13:53:20.904	2026-01-26 13:53:20.904
94be26c0-4b7c-4df0-a356-14decb980156	20260126-CLM-0005	020b3051-2e2e-4006-975c-41b7f77c5f4e	f7b3085b-f119-4dfe-8116-43ca962c6eb0	draft	{"email": "test.format@example.com", "lastName": "Format", "firstName": "Test"}	\N	Testing new order number format	\N	\N	2026-01-26 13:58:56.493	2026-01-26 13:58:56.493
\.


--
-- Data for Name: package_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.package_services (id, "packageId", "serviceId", scope, "createdAt") FROM stdin;
\.


--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.packages (id, "customerId", name, description) FROM stdin;
\.


--
-- Data for Name: service_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_requirements (id, "serviceId", "requirementId", "createdAt", "updatedAt") FROM stdin;
872d2d6a-9b03-4ea1-88e9-0a998a836317	383f3f2f-3194-4396-9a63-297f80e151f9	7456d517-e212-454d-8d4a-e19ddd077ba7	2026-01-27 02:54:52.291	2026-01-27 02:54:52.291
efc60c3b-be3c-4644-ae49-4c65e6891549	383f3f2f-3194-4396-9a63-297f80e151f9	739b2b3f-db5c-4010-b96c-5238a3a26298	2026-01-27 02:54:52.296	2026-01-27 02:54:52.296
e278a1db-5085-45da-a03e-af4db23d80bf	383f3f2f-3194-4396-9a63-297f80e151f9	8cc249d5-d320-442f-b2fe-88380569770c	2026-01-27 02:54:52.296	2026-01-27 02:54:52.296
431ff1ad-0ea3-4e5d-baa3-796ed36bb87d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	007a7957-92c0-4ec4-9a93-f5cd56260f10	2026-01-29 02:00:56.607	2026-01-29 02:00:56.607
a0a1ee0a-68ee-4a76-9b63-177f6cce669c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	61588fb6-5a89-4b27-bf6f-1a6d07b48a1f	2026-01-29 02:00:56.618	2026-01-29 02:00:56.618
29fdc777-e206-43a9-a4db-241ba7ec9573	4b9d6a10-6861-426a-ad7f-60eb94312d0d	739b2b3f-db5c-4010-b96c-5238a3a26298	2026-01-29 02:00:56.619	2026-01-29 02:00:56.619
6763b5b4-edd0-4cc0-845c-a6a5523764c9	4b9d6a10-6861-426a-ad7f-60eb94312d0d	8cc249d5-d320-442f-b2fe-88380569770c	2026-01-29 02:00:56.619	2026-01-29 02:00:56.619
40300998-53b0-4d15-8179-71fe2c2cd3d0	935f2544-5727-47a9-a758-bd24afea5994	5ea29387-6d88-43e4-aaa8-481937d22b9c	2026-02-14 15:02:10.34	2026-02-14 15:02:10.34
f06a0960-b67e-4b18-aba1-b94e69b9d739	935f2544-5727-47a9-a758-bd24afea5994	739b2b3f-db5c-4010-b96c-5238a3a26298	2026-02-14 15:02:10.343	2026-02-14 15:02:10.343
25081d17-7a17-4cd7-952a-0c18c80d3ea1	935f2544-5727-47a9-a758-bd24afea5994	8cc249d5-d320-442f-b2fe-88380569770c	2026-02-14 15:02:10.344	2026-02-14 15:02:10.344
300fcf60-cbcf-41f0-9c1d-c51eca2ff5e4	935f2544-5727-47a9-a758-bd24afea5994	0f73bcea-e704-44da-bbf2-0a4a5e0b679b	2026-02-14 15:02:10.344	2026-02-14 15:02:10.344
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") FROM stdin;
383f3f2f-3194-4396-9a63-297f80e151f9	County Criminal	US Criminal	\N	f	2025-03-22 14:04:35.856	2025-03-22 14:04:35.856	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	record
8388bb60-48e4-4781-a867-7c86b51be776	ID Verification	IDV	Review of ID doc	f	2025-03-22 14:05:12.786	2025-03-22 14:05:12.786	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	other
4b9d6a10-6861-426a-ad7f-60eb94312d0d	Emp Verif	Verifications	\N	f	2025-03-22 00:51:35.968	2025-03-22 00:51:35.968	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	verification-emp
935f2544-5727-47a9-a758-bd24afea5994	Education Verification	Verifications	\N	f	2026-01-28 19:44:09.857	2026-01-28 19:44:09.857	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	verification-edu
\.


--
-- Data for Name: translations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.translations (id, "labelKey", language, value) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType") FROM stdin;
c2175238-b327-40ac-86c9-3e31dbabaee4	andyh@realidatasolutions.com	$2a$10$F3PNQV1kejotJP7fFpoCwOMu1l3i..qruy3RHHyabTizipcSe8IZ.	Andy	Hellman	2025-03-11 12:53:14.139	2026-02-11 21:20:26.354	{"services": ["*"], "countries": ["*"]}	\N	1	\N	\N	2026-01-25 20:49:42.445	\N	f	\N	admin
f7b3085b-f119-4dfe-8116-43ca962c6eb0	customer@test.com	$2a$10$.gvhCO2O5hp5nDo7t4Wa0O0VSPHGJDT..sgdMKRnjzngFuSzpKc7q	Test	Customer	2026-01-26 12:52:45.701	2026-02-14 14:59:56.149	{"services": [], "countries": [], "customers": ["020b3051-2e2e-4006-975c-41b7f77c5f4e"]}	020b3051-2e2e-4006-975c-41b7f77c5f4e	0	2026-02-14 14:59:56.148	\N	2026-01-26 12:52:45.701	\N	f	\N	customer
0c81952d-f51e-469f-a9ad-074be12b18e4	andythellman@gmail.com	$2a$10$9e1W1xPBRhbynkTCZ73VzOSnBDSKNlFNvKHMYcf8ceXRuPjU52wmm	Admin	User	2025-03-11 02:29:39.361	2026-02-14 15:00:26.393	{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}	\N	0	2026-02-14 15:00:26.392	\N	2026-01-25 20:49:42.445	\N	f	\N	admin
\.


--
-- Data for Name: workflow_sections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflow_sections (id, "workflowId", name, "displayOrder", "isRequired", "dependsOnSection", "dependencyLogic", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workflows (id, name, description, status, "defaultLanguage", "expirationDays", "autoCloseEnabled", "extensionAllowed", "extensionDays", disabled, "createdAt", "updatedAt", "packageId", "createdById", "updatedById", "reminderEnabled", "reminderFrequency", "maxReminders") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: address_entries address_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT address_entries_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: city_mappings city_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_mappings
    ADD CONSTRAINT city_mappings_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: customer_services customer_services_customerId_serviceId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_customerId_serviceId_key" UNIQUE ("customerId", "serviceId");


--
-- Name: customer_services customer_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT customer_services_pkey PRIMARY KEY (id);


--
-- Name: customer_users customer_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_users
    ADD CONSTRAINT customer_users_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: data_fields data_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_fields
    ADD CONSTRAINT data_fields_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: dsx_availability dsx_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT dsx_availability_pkey PRIMARY KEY (id);


--
-- Name: dsx_mappings dsx_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT dsx_mappings_pkey PRIMARY KEY (id);


--
-- Name: dsx_requirements dsx_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_requirements
    ADD CONSTRAINT dsx_requirements_pkey PRIMARY KEY (id);


--
-- Name: order_data order_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_data
    ADD CONSTRAINT order_data_pkey PRIMARY KEY (id);


--
-- Name: order_documents order_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_documents
    ADD CONSTRAINT order_documents_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: order_statuses order_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_statuses
    ADD CONSTRAINT order_statuses_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: package_services package_services_packageId_serviceId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_packageId_serviceId_key" UNIQUE ("packageId", "serviceId");


--
-- Name: package_services package_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT package_services_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: service_requirements service_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT service_requirements_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: translations translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_sections workflow_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sections
    ADD CONSTRAINT workflow_sections_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: address_entries_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX address_entries_city_idx ON public.address_entries USING btree (city);


--
-- Name: address_entries_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "address_entries_customerId_idx" ON public.address_entries USING btree ("customerId");


--
-- Name: address_entries_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "address_entries_orderId_idx" ON public.address_entries USING btree ("orderId");


--
-- Name: audit_logs_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_createdAt_idx" ON public.audit_logs USING btree ("createdAt");


--
-- Name: audit_logs_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_entityType_entityId_idx" ON public.audit_logs USING btree ("entityType", "entityId");


--
-- Name: audit_logs_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "audit_logs_userId_idx" ON public.audit_logs USING btree ("userId");


--
-- Name: city_mappings_cityName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "city_mappings_cityName_idx" ON public.city_mappings USING btree ("cityName");


--
-- Name: city_mappings_cityName_stateId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "city_mappings_cityName_stateId_key" ON public.city_mappings USING btree ("cityName", "stateId");


--
-- Name: city_mappings_stateId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "city_mappings_stateId_idx" ON public.city_mappings USING btree ("stateId");


--
-- Name: countries_code2_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX countries_code2_key ON public.countries USING btree (code2);


--
-- Name: countries_code3_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX countries_code3_key ON public.countries USING btree (code3);


--
-- Name: countries_parentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "countries_parentId_idx" ON public.countries USING btree ("parentId");


--
-- Name: customer_services_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customer_services_customerId_idx" ON public.customer_services USING btree ("customerId");


--
-- Name: customer_services_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customer_services_serviceId_idx" ON public.customer_services USING btree ("serviceId");


--
-- Name: customer_users_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customer_users_customerId_idx" ON public.customer_users USING btree ("customerId");


--
-- Name: customer_users_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "customer_users_userId_key" ON public.customer_users USING btree ("userId");


--
-- Name: customers_billingAccountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customers_billingAccountId_idx" ON public.customers USING btree ("billingAccountId");


--
-- Name: customers_masterAccountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "customers_masterAccountId_idx" ON public.customers USING btree ("masterAccountId");


--
-- Name: dsx_availability_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dsx_availability_locationId_idx" ON public.dsx_availability USING btree ("locationId");


--
-- Name: dsx_availability_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dsx_availability_serviceId_idx" ON public.dsx_availability USING btree ("serviceId");


--
-- Name: dsx_availability_serviceId_locationId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dsx_availability_serviceId_locationId_key" ON public.dsx_availability USING btree ("serviceId", "locationId");


--
-- Name: dsx_mappings_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dsx_mappings_locationId_idx" ON public.dsx_mappings USING btree ("locationId");


--
-- Name: dsx_mappings_requirementId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dsx_mappings_requirementId_idx" ON public.dsx_mappings USING btree ("requirementId");


--
-- Name: dsx_mappings_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "dsx_mappings_serviceId_idx" ON public.dsx_mappings USING btree ("serviceId");


--
-- Name: dsx_mappings_serviceId_locationId_requirementId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "dsx_mappings_serviceId_locationId_requirementId_key" ON public.dsx_mappings USING btree ("serviceId", "locationId", "requirementId");


--
-- Name: dsx_requirements_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dsx_requirements_type_idx ON public.dsx_requirements USING btree (type);


--
-- Name: order_data_orderItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "order_data_orderItemId_idx" ON public.order_data USING btree ("orderItemId");


--
-- Name: order_documents_orderItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "order_documents_orderItemId_idx" ON public.order_documents USING btree ("orderItemId");


--
-- Name: order_items_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "order_items_orderId_idx" ON public.order_items USING btree ("orderId");


--
-- Name: order_status_history_orderId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "order_status_history_orderId_idx" ON public.order_status_history USING btree ("orderId");


--
-- Name: order_statuses_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX order_statuses_code_key ON public.order_statuses USING btree (code);


--
-- Name: orders_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_customerId_idx" ON public.orders USING btree ("customerId");


--
-- Name: orders_orderNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_orderNumber_idx" ON public.orders USING btree ("orderNumber");


--
-- Name: orders_orderNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "orders_orderNumber_key" ON public.orders USING btree ("orderNumber");


--
-- Name: orders_statusCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_statusCode_idx" ON public.orders USING btree ("statusCode");


--
-- Name: package_services_packageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_services_packageId_idx" ON public.package_services USING btree ("packageId");


--
-- Name: package_services_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "package_services_serviceId_idx" ON public.package_services USING btree ("serviceId");


--
-- Name: service_requirements_requirementId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "service_requirements_requirementId_idx" ON public.service_requirements USING btree ("requirementId");


--
-- Name: service_requirements_serviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "service_requirements_serviceId_idx" ON public.service_requirements USING btree ("serviceId");


--
-- Name: service_requirements_serviceId_requirementId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "service_requirements_serviceId_requirementId_key" ON public.service_requirements USING btree ("serviceId", "requirementId");


--
-- Name: services_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "services_createdById_idx" ON public.services USING btree ("createdById");


--
-- Name: services_updatedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "services_updatedById_idx" ON public.services USING btree ("updatedById");


--
-- Name: translations_labelKey_language_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "translations_labelKey_language_key" ON public.translations USING btree ("labelKey", language);


--
-- Name: users_customerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_customerId_idx" ON public.users USING btree ("customerId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: workflow_sections_workflowId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflow_sections_workflowId_idx" ON public.workflow_sections USING btree ("workflowId");


--
-- Name: workflows_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_createdById_idx" ON public.workflows USING btree ("createdById");


--
-- Name: workflows_packageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_packageId_idx" ON public.workflows USING btree ("packageId");


--
-- Name: workflows_updatedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "workflows_updatedById_idx" ON public.workflows USING btree ("updatedById");


--
-- Name: address_entries address_entries_countryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT "address_entries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: address_entries address_entries_countyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT "address_entries_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: address_entries address_entries_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT "address_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: address_entries address_entries_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT "address_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: address_entries address_entries_stateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.address_entries
    ADD CONSTRAINT "address_entries_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: city_mappings city_mappings_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_mappings
    ADD CONSTRAINT "city_mappings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: city_mappings city_mappings_stateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.city_mappings
    ADD CONSTRAINT "city_mappings_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: countries countries_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT "countries_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_services customer_services_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_services customer_services_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: customer_users customer_users_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_users
    ADD CONSTRAINT "customer_users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_users customer_users_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_users
    ADD CONSTRAINT "customer_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customers customers_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customers customers_masterAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dsx_availability dsx_availability_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT "dsx_availability_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_availability dsx_availability_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT "dsx_availability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_requirementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES public.dsx_requirements(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_data order_data_orderItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_data
    ADD CONSTRAINT "order_data_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES public.order_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_documents order_documents_orderItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_documents
    ADD CONSTRAINT "order_documents_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES public.order_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_changedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT "order_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: package_services package_services_packageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES public.packages(id) ON DELETE CASCADE;


--
-- Name: package_services package_services_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: packages packages_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT "packages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: service_requirements service_requirements_requirementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT "service_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES public.dsx_requirements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_requirements service_requirements_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT "service_requirements_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: services services_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: services services_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: users users_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_sections workflow_sections_workflowId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_sections
    ADD CONSTRAINT "workflow_sections_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workflows workflows_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflows workflows_packageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES public.packages(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflows workflows_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

