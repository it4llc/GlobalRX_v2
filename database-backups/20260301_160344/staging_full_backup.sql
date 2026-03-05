--
-- PostgreSQL database dump
--

\restrict TLSQ95aNfiEhnhm691WbGAhhKaoS1gDPHX6sV8NcYuXAi3IEOBtI7IZleDts0ia

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
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
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
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
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "assignedVendorId" text
);


--
-- Name: package_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_services (
    id text NOT NULL,
    "packageId" text NOT NULL,
    "serviceId" text NOT NULL,
    scope jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "displayOrder" integer DEFAULT 999 NOT NULL
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
    "userType" text DEFAULT 'admin'::text NOT NULL,
    "vendorId" text
);


--
-- Name: vendor_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_organizations (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "contactEmail" text NOT NULL,
    "contactPhone" text NOT NULL,
    address text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
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
5b70de6e-4e10-45ce-ae3a-a3076ee84973	5f7066722a08291586030bd842d90031117feed61a89d82c0001d10e362b50f2	2026-02-26 17:49:03.296618+00	20250125_initial	\N	\N	2026-02-26 17:49:03.254329+00	1
235954de-ff53-4ca1-b85f-da2e6831ad07	b3a8d91598fdbb57ce582bf5b88ef56ccf971099950df06917740b9aaec217e1	2026-02-26 17:49:03.322675+00	20260126014942_add_customer_portal_models	\N	\N	2026-02-26 17:49:03.299977+00	1
9b584022-9ec2-41d3-a297-bac176063eed	eb2c14ecb7cc480637309c4102dda4a14fd577dc8a42f224234a4279b303d2cb	2026-02-26 17:49:03.340704+00	20260129011632_add_address_block_models	\N	\N	2026-02-26 17:49:03.325833+00	1
1520a77b-eef5-4994-a6e0-b9c93d070b05	2e2ec796f26092eeb5fc474f51dfbfe48d36ef06b487cdcc3314d0a3eb73d49e	2026-02-26 17:49:03.352946+00	20260222011200_add_display_order_to_dsx_mappings	\N	\N	2026-02-26 17:49:03.344072+00	1
2a26e56b-57f7-4948-9012-69d4c060eaf4	b04fb77acb23c5ad4b944433f0275361fa620181a82caf2741b76da198fb342e	2026-02-26 17:49:03.371714+00	20260222_move_display_order	\N	\N	2026-02-26 17:49:03.356962+00	1
e0869657-59c5-4fc8-9555-b561603ec28c	f4a6540eb89a1322a2022b7fa649e09d0c98a0982145d6cafd27932e1032ff23	2026-03-01 20:08:55.332851+00	20260228000000_add_vendor_system	\N	\N	2026-03-01 20:08:55.316018+00	1
f375a6de-6ab6-4499-8230-6382fe87598e	11a5d144f04a52177fe7968cf081c6bb27810318fa8651041d0bfa9ae00edb05	2026-03-01 20:08:55.344014+00	20260228205214_remove_vendor_code_field	\N	\N	2026-03-01 20:08:55.335287+00	1
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
e6fffac1-4aad-4ce4-9981-3983dde344d3	United States of America (the)	US	USA	840	\N	\N	\N	2025-03-13 18:21:43.259372+00	2025-03-13 18:21:43.259372+00	\N	\N
32c804e1-e904-45b0-b150-cdc70be9679c	Afghanistan	AF	AFG	4	\N	\N	\N	2025-03-14 14:53:23.340969+00	2025-03-14 14:53:23.340969+00	\N	\N
16d101ea-c92f-44b0-b7dc-11cd3680215c	Albania	AL	ALB	8	\N	\N	\N	2025-03-14 14:53:23.37798+00	2025-03-14 14:53:23.37798+00	\N	\N
dce7c8e3-fc4f-4edc-b9e4-66410334ed17	Algeria	DZ	DZA	12	\N	\N	\N	2025-03-14 14:53:23.39475+00	2025-03-14 14:53:23.39475+00	\N	\N
778ec216-a84f-41c7-a341-9d04269f0dc6	American Samoa	AS	ASM	16	\N	\N	\N	2025-03-14 14:53:23.396168+00	2025-03-14 14:53:23.396168+00	\N	\N
ed459bf2-7e56-4eca-bc6b-cee6655c644a	Andorra	AD	AND	20	\N	\N	\N	2025-03-14 14:53:23.398172+00	2025-03-14 14:53:23.398172+00	\N	\N
9f38de93-8d44-4760-9152-372666596d56	Angola	AO	AGO	24	\N	\N	\N	2025-03-14 14:53:23.41451+00	2025-03-14 14:53:23.41451+00	\N	\N
eadf502a-97e3-44fc-b07c-0f7015cb598a	Anguilla	AI	AIA	660	\N	\N	\N	2025-03-14 14:53:23.416154+00	2025-03-14 14:53:23.416154+00	\N	\N
c21d204c-4660-41e7-93c8-d895ddbaab26	Antarctica	AQ	ATA	10	\N	\N	\N	2025-03-14 14:53:23.432476+00	2025-03-14 14:53:23.432476+00	\N	\N
31dec1f6-7abb-4742-ade1-42b89ad7766a	Antigua and Barbuda	AG	ATG	28	\N	\N	\N	2025-03-14 14:53:23.434177+00	2025-03-14 14:53:23.434177+00	\N	\N
b182931c-6229-4be3-bde7-ef6126032f52	Argentina	AR	ARG	32	\N	\N	\N	2025-03-14 14:53:23.435718+00	2025-03-14 14:53:23.435718+00	\N	\N
93421fdb-364d-418e-898a-a1f62dd8020a	Armenia	AM	ARM	51	\N	\N	\N	2025-03-14 14:53:23.459434+00	2025-03-14 14:53:23.459434+00	\N	\N
5bc1c4d2-6371-4992-8ce0-23c01e065bbe	Aruba	AW	ABW	533	\N	\N	\N	2025-03-14 14:53:23.472752+00	2025-03-14 14:53:23.472752+00	\N	\N
071a36ac-c2e2-4462-b10d-3175b101bd06	Australia	AU	AUS	36	\N	\N	\N	2025-03-14 14:53:23.476851+00	2025-03-14 14:53:23.476851+00	\N	\N
734f6aa9-6ade-4187-b3b3-2cba78068a34	Austria	AT	AUT	40	\N	\N	\N	2025-03-14 14:53:23.50777+00	2025-03-14 14:53:23.50777+00	\N	\N
bd8e819d-9179-4fba-b0f9-cec4d26efe4a	Azerbaijan	AZ	AZE	31	\N	\N	\N	2025-03-14 14:53:23.512201+00	2025-03-14 14:53:23.512201+00	\N	\N
e634ed46-7f56-46ad-bf89-af3b7f75dc0f	Bahamas (the)	BS	BHS	44	\N	\N	\N	2025-03-14 14:53:23.516027+00	2025-03-14 14:53:23.516027+00	\N	\N
32898e2d-148e-4483-9e74-6fca3a3eed62	Bahrain	BH	BHR	48	\N	\N	\N	2025-03-14 14:53:23.529615+00	2025-03-14 14:53:23.529615+00	\N	\N
3e324e0d-ae2e-4957-a5ca-51a7f20e6350	Bangladesh	BD	BGD	50	\N	\N	\N	2025-03-14 14:53:23.535653+00	2025-03-14 14:53:23.535653+00	\N	\N
ec3b1c13-8dea-49f8-9c6a-adcc38a68b96	Barbados	BB	BRB	52	\N	\N	\N	2025-03-14 14:53:23.53983+00	2025-03-14 14:53:23.53983+00	\N	\N
7a27fe64-579c-4653-a395-4ead4e3860df	Belarus	BY	BLR	112	\N	\N	\N	2025-03-14 14:53:23.543302+00	2025-03-14 14:53:23.543302+00	\N	\N
8504d304-1734-41d3-8e1c-8e6765cbf3d9	Belgium	BE	BEL	56	\N	\N	\N	2025-03-14 14:53:23.560093+00	2025-03-14 14:53:23.560093+00	\N	\N
d8234d20-bcb4-45ba-bcfc-0e4b133b8898	Belize	BZ	BLZ	84	\N	\N	\N	2025-03-14 14:53:23.594736+00	2025-03-14 14:53:23.594736+00	\N	\N
5663e510-84a4-4116-86dd-dfaf709165e2	Benin	BJ	BEN	204	\N	\N	\N	2025-03-14 14:53:23.616618+00	2025-03-14 14:53:23.616618+00	\N	\N
12663a56-2460-435d-97b2-b36c631dd62f	Bermuda	BM	BMU	60	\N	\N	\N	2025-03-14 14:53:23.644608+00	2025-03-14 14:53:23.644608+00	\N	\N
11b13f4a-d287-4401-bd76-82a3b21bbbb6	Bhutan	BT	BTN	64	\N	\N	\N	2025-03-14 14:53:23.6595+00	2025-03-14 14:53:23.6595+00	\N	\N
dd0f65c6-2276-4624-b96f-6c0d2dbf5416	Bolivia (Plurinational State of)	BO	BOL	68	\N	\N	\N	2025-03-14 14:53:23.667068+00	2025-03-14 14:53:23.667068+00	\N	\N
47abcbe8-9bac-4fb1-845e-09c4efbe35c8	Bonaire, Sint Eustatius and Saba	BQ	BES	535	\N	\N	\N	2025-03-14 14:53:23.687243+00	2025-03-14 14:53:23.687243+00	\N	\N
4220515f-01f8-40d5-846d-b4a7f5aa460b	Bosnia and Herzegovina	BA	BIH	70	\N	\N	\N	2025-03-14 14:53:23.691965+00	2025-03-14 14:53:23.691965+00	\N	\N
7b4f99cd-e55e-47d8-b912-09c4b9d1a6b9	Botswana	BW	BWA	72	\N	\N	\N	2025-03-14 14:53:23.694738+00	2025-03-14 14:53:23.694738+00	\N	\N
c2e649dd-c05d-4e60-94be-cc02b5d6a0d3	Bouvet Island	BV	BVT	74	\N	\N	\N	2025-03-14 14:53:23.698016+00	2025-03-14 14:53:23.698016+00	\N	\N
cd47199a-6751-4135-a27a-3d4719b9ef1a	Brazil	BR	BRA	76	\N	\N	\N	2025-03-14 14:53:23.728432+00	2025-03-14 14:53:23.728432+00	\N	\N
51f1d812-aeb4-4349-9ac4-b2a33b1c4a9b	British Indian Ocean Territory (the)	IO	IOT	86	\N	\N	\N	2025-03-14 14:53:23.734007+00	2025-03-14 14:53:23.734007+00	\N	\N
c86565cd-7ab2-4c4a-9152-f911e8eae236	Brunei Darussalam	BN	BRN	96	\N	\N	\N	2025-03-14 14:53:23.746473+00	2025-03-14 14:53:23.746473+00	\N	\N
71a0f3da-b3d4-4d4c-bbdd-5b0077e5b3fc	Bulgaria	BG	BGR	100	\N	\N	\N	2025-03-14 14:53:23.77252+00	2025-03-14 14:53:23.77252+00	\N	\N
f43eb3e8-8708-4656-aae2-d21e33812610	Burkina Faso	BF	BFA	854	\N	\N	\N	2025-03-14 14:53:23.799682+00	2025-03-14 14:53:23.799682+00	\N	\N
28748534-0496-4c62-8647-6af5f01fc608	Burundi	BI	BDI	108	\N	\N	\N	2025-03-14 14:53:23.804314+00	2025-03-14 14:53:23.804314+00	\N	\N
4c239c57-b3c6-4988-a698-6908b26d0e19	Cabo Verde	CV	CPV	132	\N	\N	\N	2025-03-14 14:53:23.807414+00	2025-03-14 14:53:23.807414+00	\N	\N
493436bd-ca41-4359-8d8a-0d690ee7fc29	Cambodia	KH	KHM	116	\N	\N	\N	2025-03-14 14:53:23.809511+00	2025-03-14 14:53:23.809511+00	\N	\N
fe3d87aa-c40a-468d-8e3f-239029a5919d	Cameroon	CM	CMR	120	\N	\N	\N	2025-03-14 14:53:23.811562+00	2025-03-14 14:53:23.811562+00	\N	\N
b52c3226-dc94-4289-a051-b7227fd77ae8	Canada	CA	CAN	124	\N	\N	\N	2025-03-14 14:53:23.813494+00	2025-03-14 14:53:23.813494+00	\N	\N
7050c97c-b57f-490f-90a9-d8601fcb3852	Cayman Islands (the)	KY	CYM	136	\N	\N	\N	2025-03-14 14:53:23.814796+00	2025-03-14 14:53:23.814796+00	\N	\N
60fc24d8-ef72-4107-8519-429969f3a05b	Central African Republic (the)	CF	CAF	140	\N	\N	\N	2025-03-14 14:53:23.815865+00	2025-03-14 14:53:23.815865+00	\N	\N
db419a02-b502-47b6-bf78-ca8e5cc0db52	Chad	TD	TCD	148	\N	\N	\N	2025-03-14 14:53:23.817605+00	2025-03-14 14:53:23.817605+00	\N	\N
913edefa-4e9b-4792-bddf-5739e52946f3	Chile	CL	CHL	152	\N	\N	\N	2025-03-14 14:53:23.820668+00	2025-03-14 14:53:23.820668+00	\N	\N
ee14f2cd-9823-4e38-9202-0d3f88fd82d6	China	CN	CHN	156	\N	\N	\N	2025-03-14 14:53:23.827271+00	2025-03-14 14:53:23.827271+00	\N	\N
3bd6e5e9-b537-4797-b1c9-ab73e5e86c73	Christmas Island	CX	CXR	162	\N	\N	\N	2025-03-14 14:53:23.831005+00	2025-03-14 14:53:23.831005+00	\N	\N
81aabfd3-329b-4346-848b-5bea91a93fc1	Cocos (Keeling) Islands (the)	CC	CCK	166	\N	\N	\N	2025-03-14 14:53:23.833155+00	2025-03-14 14:53:23.833155+00	\N	\N
fea93ffa-2056-42bd-984d-d35e5d8999a3	Colombia	CO	COL	170	\N	\N	\N	2025-03-14 14:53:23.837133+00	2025-03-14 14:53:23.837133+00	\N	\N
9354e37c-87a6-4aa8-a7a0-92ed57549ea2	Comoros (the)	KM	COM	174	\N	\N	\N	2025-03-14 14:53:23.84501+00	2025-03-14 14:53:23.84501+00	\N	\N
56126bf3-9a23-4ff5-bd7b-e9aa3551ce2d	Congo (the Democratic Republic of the)	CD	COD	180	\N	\N	\N	2025-03-14 14:53:23.855057+00	2025-03-14 14:53:23.855057+00	\N	\N
e76be943-41ac-4c14-980c-603a3652643f	Congo (the)	CG	COG	178	\N	\N	\N	2025-03-14 14:53:23.862265+00	2025-03-14 14:53:23.862265+00	\N	\N
3ce0f539-13c5-412d-8301-2ba191ea3328	Cook Islands (the)	CK	COK	184	\N	\N	\N	2025-03-14 14:53:23.872326+00	2025-03-14 14:53:23.872326+00	\N	\N
b3375e8e-eae1-40f9-a9e7-a7c52b64bffd	Costa Rica	CR	CRI	188	\N	\N	\N	2025-03-14 14:53:23.878445+00	2025-03-14 14:53:23.878445+00	\N	\N
623da6ff-cb25-4a58-bafa-da9088cfb606	Croatia	HR	HRV	191	\N	\N	\N	2025-03-14 14:53:23.888667+00	2025-03-14 14:53:23.888667+00	\N	\N
9a09a2e4-31fc-4a1b-b3e6-44dcaf2329be	Cuba	CU	CUB	192	\N	\N	\N	2025-03-14 14:53:23.896775+00	2025-03-14 14:53:23.896775+00	\N	\N
b0ca323f-43b7-4020-b9f0-307751da0b74	Curaçao	CW	CUW	531	\N	\N	\N	2025-03-14 14:53:23.921053+00	2025-03-14 14:53:23.921053+00	\N	\N
1c02ee54-327e-464f-b249-54a5b9f07a95	Cyprus	CY	CYP	196	\N	\N	\N	2025-03-14 14:53:23.9731+00	2025-03-14 14:53:23.9731+00	\N	\N
1a8acd2c-9221-47e0-92f6-35f89fa37812	Czechia	CZ	CZE	203	\N	\N	\N	2025-03-14 14:53:23.978532+00	2025-03-14 14:53:23.978532+00	\N	\N
8432f245-2bb6-4186-a3fd-607dee8bfbb3	Côte d'Ivoire	CI	CIV	384	\N	\N	\N	2025-03-14 14:53:23.983653+00	2025-03-14 14:53:23.983653+00	\N	\N
9c5c5b0d-7816-4ce2-9611-9c612cfe5f7f	Denmark	DK	DNK	208	\N	\N	\N	2025-03-14 14:53:23.988494+00	2025-03-14 14:53:23.988494+00	\N	\N
9d0c0a31-5443-434e-ade3-843f653b13a5	Djibouti	DJ	DJI	262	\N	\N	\N	2025-03-14 14:53:23.991102+00	2025-03-14 14:53:23.991102+00	\N	\N
15adee7a-c86c-4451-a862-6664e4a72332	Dominica	DM	DMA	212	\N	\N	\N	2025-03-14 14:53:23.993898+00	2025-03-14 14:53:23.993898+00	\N	\N
9871b276-3844-46c3-8564-243c81bfc26e	Dominican Republic (the)	DO	DOM	214	\N	\N	\N	2025-03-14 14:53:23.999496+00	2025-03-14 14:53:23.999496+00	\N	\N
65b128ab-1aa4-4f0d-a8e2-3824ae25b24d	Ecuador	EC	ECU	218	\N	\N	\N	2025-03-14 14:53:24.016365+00	2025-03-14 14:53:24.016365+00	\N	\N
441dc9df-8866-4dcf-8f81-c8957513ddaa	Egypt	EG	EGY	818	\N	\N	\N	2025-03-14 14:53:24.022549+00	2025-03-14 14:53:24.022549+00	\N	\N
6f57f96c-4e83-4188-95b1-4a58af42d368	El Salvador	SV	SLV	222	\N	\N	\N	2025-03-14 14:53:24.024993+00	2025-03-14 14:53:24.024993+00	\N	\N
2e568ea8-6aab-4e76-b578-8fc44b566d00	Equatorial Guinea	GQ	GNQ	226	\N	\N	\N	2025-03-14 14:53:24.027234+00	2025-03-14 14:53:24.027234+00	\N	\N
92ddb36f-34ee-4f99-8da8-f52d78752b40	Eritrea	ER	ERI	232	\N	\N	\N	2025-03-14 14:53:24.029168+00	2025-03-14 14:53:24.029168+00	\N	\N
d2a87d3c-d4f5-4728-a702-d520d52f8efc	Estonia	EE	EST	233	\N	\N	\N	2025-03-14 14:53:24.031295+00	2025-03-14 14:53:24.031295+00	\N	\N
7ad62e6e-cb66-4cf7-a2f7-f2d7c19aa1c3	Eswatini	SZ	SWZ	748	\N	\N	\N	2025-03-14 14:53:24.033046+00	2025-03-14 14:53:24.033046+00	\N	\N
6f00304d-9dd1-4a86-b25e-96ffc4c96245	Ethiopia	ET	ETH	231	\N	\N	\N	2025-03-14 14:53:24.041708+00	2025-03-14 14:53:24.041708+00	\N	\N
29535a71-4da7-4d9e-8a1a-088498c25104	Falkland Islands (the) [Malvinas]	FK	FLK	238	\N	\N	\N	2025-03-14 14:53:24.047549+00	2025-03-14 14:53:24.047549+00	\N	\N
ae102e8b-bccb-4edb-8c92-bdb1225dfd15	Faroe Islands (the)	FO	FRO	234	\N	\N	\N	2025-03-14 14:53:24.050959+00	2025-03-14 14:53:24.050959+00	\N	\N
53179e6b-42df-45fb-808e-06635445f0a3	Fiji	FJ	FJI	242	\N	\N	\N	2025-03-14 14:53:24.060096+00	2025-03-14 14:53:24.060096+00	\N	\N
01bfbc25-4974-4e1d-a039-afc1ab9350a0	Finland	FI	FIN	246	\N	\N	\N	2025-03-14 14:53:24.064814+00	2025-03-14 14:53:24.064814+00	\N	\N
1d36f3ae-663e-49be-90b9-c6f3fb1d7d80	France	FR	FRA	250	\N	\N	\N	2025-03-14 14:53:24.072605+00	2025-03-14 14:53:24.072605+00	\N	\N
a39aa187-a52a-4fc0-8f6f-fcf41e5fb62a	French Guiana	GF	GUF	254	\N	\N	\N	2025-03-14 14:53:24.109741+00	2025-03-14 14:53:24.109741+00	\N	\N
49845113-2ada-42b3-b60e-a10d47724be3	French Polynesia	PF	PYF	258	\N	\N	\N	2025-03-14 14:53:24.14427+00	2025-03-14 14:53:24.14427+00	\N	\N
c9e2198c-0fea-4f3b-90a8-2bd8f5b9812b	French Southern Territories (the)	TF	ATF	260	\N	\N	\N	2025-03-14 14:53:24.161874+00	2025-03-14 14:53:24.161874+00	\N	\N
23525539-5160-4174-bf39-938badb0bb75	Gabon	GA	GAB	266	\N	\N	\N	2025-03-14 14:53:24.164862+00	2025-03-14 14:53:24.164862+00	\N	\N
45b02588-26f2-4553-bb6e-c773bbe1cd45	Gambia (the)	GM	GMB	270	\N	\N	\N	2025-03-14 14:53:24.166378+00	2025-03-14 14:53:24.166378+00	\N	\N
18bed42b-5400-452c-91db-4fb4147f355f	Georgia	GE	GEO	268	\N	\N	\N	2025-03-14 14:53:24.169571+00	2025-03-14 14:53:24.169571+00	\N	\N
5849ff0b-a440-4ab2-a389-b4acc0bf552e	Germany	DE	DEU	276	\N	\N	\N	2025-03-14 14:53:24.177302+00	2025-03-14 14:53:24.177302+00	\N	\N
aba9bce3-2155-4621-b4b0-3cf669cad3b2	Ghana	GH	GHA	288	\N	\N	\N	2025-03-14 14:53:24.179408+00	2025-03-14 14:53:24.179408+00	\N	\N
2dd84bba-57aa-4137-b532-5e40df1f9818	Gibraltar	GI	GIB	292	\N	\N	\N	2025-03-14 14:53:24.192794+00	2025-03-14 14:53:24.192794+00	\N	\N
02bf47ac-626f-45f7-910b-344eab76bc24	Greece	GR	GRC	300	\N	\N	\N	2025-03-14 14:53:24.198863+00	2025-03-14 14:53:24.198863+00	\N	\N
c022b4da-2739-428a-8169-4522791ac94e	Greenland	GL	GRL	304	\N	\N	\N	2025-03-14 14:53:24.210436+00	2025-03-14 14:53:24.210436+00	\N	\N
1b3188a7-a4c9-40ea-8a0e-8e12eb6e791a	Grenada	GD	GRD	308	\N	\N	\N	2025-03-14 14:53:24.223316+00	2025-03-14 14:53:24.223316+00	\N	\N
8d49f450-e103-4b29-8e22-2e14306ae829	Guadeloupe	GP	GLP	312	\N	\N	\N	2025-03-14 14:53:24.228172+00	2025-03-14 14:53:24.228172+00	\N	\N
e483cd63-2bcc-41d8-bb4e-692c4d20afc0	Guam	GU	GUM	316	\N	\N	\N	2025-03-14 14:53:24.244146+00	2025-03-14 14:53:24.244146+00	\N	\N
6b142850-4553-451e-a6cb-3cb9fe612458	Guatemala	GT	GTM	320	\N	\N	\N	2025-03-14 14:53:24.246608+00	2025-03-14 14:53:24.246608+00	\N	\N
5029f19f-04e8-4c22-baaa-abc4410face3	Guernsey	GG	GGY	831	\N	\N	\N	2025-03-14 14:53:24.262487+00	2025-03-14 14:53:24.262487+00	\N	\N
d841dbc9-97ef-4511-a5e1-e5b5c6e150f0	Guinea	GN	GIN	324	\N	\N	\N	2025-03-14 14:53:24.277946+00	2025-03-14 14:53:24.277946+00	\N	\N
ecd2c5a0-557e-4089-87b9-d8fe33d1d7a0	Guinea-Bissau	GW	GNB	624	\N	\N	\N	2025-03-14 14:53:24.288837+00	2025-03-14 14:53:24.288837+00	\N	\N
3a237a3a-4394-48e9-87c4-334c87d1b6a1	Guyana	GY	GUY	328	\N	\N	\N	2025-03-14 14:53:24.296846+00	2025-03-14 14:53:24.296846+00	\N	\N
7ef05e26-cf68-4e16-a18d-c925d29e7d0a	Haiti	HT	HTI	332	\N	\N	\N	2025-03-14 14:53:24.304676+00	2025-03-14 14:53:24.304676+00	\N	\N
00160b54-fdf1-48d1-9b52-52842dc8df4e	Heard Island and McDonald Islands	HM	HMD	334	\N	\N	\N	2025-03-14 14:53:24.30966+00	2025-03-14 14:53:24.30966+00	\N	\N
29e9b502-fde8-4a8f-91b6-ff44f8d41479	Holy See (the)	VA	VAT	336	\N	\N	\N	2025-03-14 14:53:24.326936+00	2025-03-14 14:53:24.326936+00	\N	\N
ca6e0150-9d34-403c-9fea-bb1e35d0e894	Honduras	HN	HND	340	\N	\N	\N	2025-03-14 14:53:24.330228+00	2025-03-14 14:53:24.330228+00	\N	\N
16743e3d-672d-4584-9a3c-5d76ae079569	Hong Kong	HK	HKG	344	\N	\N	\N	2025-03-14 14:53:24.341746+00	2025-03-14 14:53:24.341746+00	\N	\N
e11c3cf6-eb5d-4f2d-9cfb-fcb0c826eba2	Hungary	HU	HUN	348	\N	\N	\N	2025-03-14 14:53:24.345584+00	2025-03-14 14:53:24.345584+00	\N	\N
372b482c-fcb8-405d-a88a-5d2ee5686e30	Iceland	IS	ISL	352	\N	\N	\N	2025-03-14 14:53:24.357979+00	2025-03-14 14:53:24.357979+00	\N	\N
c47cf3e0-e149-4834-b454-5fd4d583a1a7	India	IN	IND	356	\N	\N	\N	2025-03-14 14:53:24.365561+00	2025-03-14 14:53:24.365561+00	\N	\N
d7b7595d-a831-48ec-84d4-39476bc3e44a	Indonesia	ID	IDN	360	\N	\N	\N	2025-03-14 14:53:24.381804+00	2025-03-14 14:53:24.381804+00	\N	\N
0690e264-ed8b-48b3-8930-5651eebe2e2e	Iran (Islamic Republic of)	IR	IRN	364	\N	\N	\N	2025-03-14 14:53:24.393712+00	2025-03-14 14:53:24.393712+00	\N	\N
b969a964-3765-4744-8080-3e2c88ab688e	Iraq	IQ	IRQ	368	\N	\N	\N	2025-03-14 14:53:24.407826+00	2025-03-14 14:53:24.407826+00	\N	\N
6750bd19-7115-4966-b7db-0d8e2add036a	Ireland	IE	IRL	372	\N	\N	\N	2025-03-14 14:53:24.412399+00	2025-03-14 14:53:24.412399+00	\N	\N
e2b4450f-4d07-4171-9a2b-8e2ba98a390d	Isle of Man	IM	IMN	833	\N	\N	\N	2025-03-14 14:53:24.424426+00	2025-03-14 14:53:24.424426+00	\N	\N
2afa78a2-892a-4dfb-9098-7926491b648f	Israel	IL	ISR	376	\N	\N	\N	2025-03-14 14:53:24.428544+00	2025-03-14 14:53:24.428544+00	\N	\N
374edfb0-e4ae-4625-af63-a14d4cb48f9b	Italy	IT	ITA	380	\N	\N	\N	2025-03-14 14:53:24.43444+00	2025-03-14 14:53:24.43444+00	\N	\N
d9f8f427-d02c-4a3a-9091-0a442685cf72	Jamaica	JM	JAM	388	\N	\N	\N	2025-03-14 14:53:24.448962+00	2025-03-14 14:53:24.448962+00	\N	\N
9b28e1e2-badb-4a9d-88d4-84f5612934e5	Japan	JP	JPN	392	\N	\N	\N	2025-03-14 14:53:24.451423+00	2025-03-14 14:53:24.451423+00	\N	\N
d4b1799f-245c-44e7-bc89-1eec59a28c9c	Jersey	JE	JEY	832	\N	\N	\N	2025-03-14 14:53:24.453104+00	2025-03-14 14:53:24.453104+00	\N	\N
6038e2ae-cb47-4eb1-be2e-067e48ba9c83	Jordan	JO	JOR	400	\N	\N	\N	2025-03-14 14:53:24.455181+00	2025-03-14 14:53:24.455181+00	\N	\N
1a810543-4218-41a4-90ba-9e3743f077fa	Kazakhstan	KZ	KAZ	398	\N	\N	\N	2025-03-14 14:53:24.456644+00	2025-03-14 14:53:24.456644+00	\N	\N
09827071-8a30-42ac-898c-59a6fe9f0c75	Kenya	KE	KEN	404	\N	\N	\N	2025-03-14 14:53:24.458331+00	2025-03-14 14:53:24.458331+00	\N	\N
59996c9e-0bc9-4120-bee1-3f0455f81725	Kiribati	KI	KIR	296	\N	\N	\N	2025-03-14 14:53:24.463045+00	2025-03-14 14:53:24.463045+00	\N	\N
d36af823-920c-47ab-965e-4ab698621052	Korea (the Democratic People's Republic of)	KP	PRK	408	\N	\N	\N	2025-03-14 14:53:24.464918+00	2025-03-14 14:53:24.464918+00	\N	\N
fa57e232-d2ab-47bf-b7fd-a057a37a0b9c	Korea (the Republic of)	KR	KOR	410	\N	\N	\N	2025-03-14 14:53:24.469369+00	2025-03-14 14:53:24.469369+00	\N	\N
2d3e7958-5f64-4312-abe6-0af811e901c3	Kuwait	KW	KWT	414	\N	\N	\N	2025-03-14 14:53:24.489815+00	2025-03-14 14:53:24.489815+00	\N	\N
92b916e1-6a0b-4498-9048-3901b27bec39	Kyrgyzstan	KG	KGZ	417	\N	\N	\N	2025-03-14 14:53:24.502787+00	2025-03-14 14:53:24.502787+00	\N	\N
7f87bc22-635b-416a-8722-53c1ee704f0c	Lao People's Democratic Republic (the)	LA	LAO	418	\N	\N	\N	2025-03-14 14:53:24.529699+00	2025-03-14 14:53:24.529699+00	\N	\N
d65b2853-a79d-401a-8f05-adf2743b9162	Latvia	LV	LVA	428	\N	\N	\N	2025-03-14 14:53:24.536995+00	2025-03-14 14:53:24.536995+00	\N	\N
5f946046-e498-403d-a64a-6933c7bd6896	Lebanon	LB	LBN	422	\N	\N	\N	2025-03-14 14:53:24.540781+00	2025-03-14 14:53:24.540781+00	\N	\N
f3aa333e-caa8-4933-b05c-e98a52d0fd1c	Lesotho	LS	LSO	426	\N	\N	\N	2025-03-14 14:53:24.545027+00	2025-03-14 14:53:24.545027+00	\N	\N
c6db06ec-612a-4dc3-bbc6-7c153e90994c	Liberia	LR	LBR	430	\N	\N	\N	2025-03-14 14:53:24.557993+00	2025-03-14 14:53:24.557993+00	\N	\N
f410965b-b444-4df5-bfd6-e138109567a0	Libya	LY	LBY	434	\N	\N	\N	2025-03-14 14:53:24.562023+00	2025-03-14 14:53:24.562023+00	\N	\N
77e171bc-3fa1-4ecb-8a5a-95029ca1f242	Liechtenstein	LI	LIE	438	\N	\N	\N	2025-03-14 14:53:24.581548+00	2025-03-14 14:53:24.581548+00	\N	\N
edccde66-49d6-459e-94e7-02b99477d24c	Lithuania	LT	LTU	440	\N	\N	\N	2025-03-14 14:53:24.587703+00	2025-03-14 14:53:24.587703+00	\N	\N
a7c48d63-d3dc-4643-bd51-cb0a361bb6f9	Luxembourg	LU	LUX	442	\N	\N	\N	2025-03-14 14:53:24.593051+00	2025-03-14 14:53:24.593051+00	\N	\N
f3da6061-0490-40ac-bdec-10e862ef1296	Macao	MO	MAC	446	\N	\N	\N	2025-03-14 14:53:24.595156+00	2025-03-14 14:53:24.595156+00	\N	\N
8e9ff64e-0787-4e03-9835-e833ca96ed46	Madagascar	MG	MDG	450	\N	\N	\N	2025-03-14 14:53:24.610271+00	2025-03-14 14:53:24.610271+00	\N	\N
b54125c1-a96c-4137-9e7a-c197421d99b3	Malawi	MW	MWI	454	\N	\N	\N	2025-03-14 14:53:24.628845+00	2025-03-14 14:53:24.628845+00	\N	\N
bebb0636-e19e-40a8-8733-18aa11ba1e13	Malaysia	MY	MYS	458	\N	\N	\N	2025-03-14 14:53:24.64033+00	2025-03-14 14:53:24.64033+00	\N	\N
6432d484-b4a5-427f-a12a-59303f1e50ee	Maldives	MV	MDV	462	\N	\N	\N	2025-03-14 14:53:24.644909+00	2025-03-14 14:53:24.644909+00	\N	\N
4f96dd8e-6915-481e-aebb-672f83b45aa1	Mali	ML	MLI	466	\N	\N	\N	2025-03-14 14:53:24.657797+00	2025-03-14 14:53:24.657797+00	\N	\N
88f85444-56fd-4596-a6f3-84e3dde28513	Malta	MT	MLT	470	\N	\N	\N	2025-03-14 14:53:24.67338+00	2025-03-14 14:53:24.67338+00	\N	\N
0953b49f-6af7-4347-a249-24c34997bf1d	Marshall Islands (the)	MH	MHL	584	\N	\N	\N	2025-03-14 14:53:24.676937+00	2025-03-14 14:53:24.676937+00	\N	\N
0d33577d-027b-4a5d-b055-d766d2627542	Martinique	MQ	MTQ	474	\N	\N	\N	2025-03-14 14:53:24.678617+00	2025-03-14 14:53:24.678617+00	\N	\N
8e2f3b14-4bb8-48fd-88c4-54a573635bc4	Mauritania	MR	MRT	478	\N	\N	\N	2025-03-14 14:53:24.679978+00	2025-03-14 14:53:24.679978+00	\N	\N
02932d66-2813-47b0-ae40-30564049a5ef	Mauritius	MU	MUS	480	\N	\N	\N	2025-03-14 14:53:24.7116+00	2025-03-14 14:53:24.7116+00	\N	\N
a4ccc274-2686-4677-b826-95e0616f156d	Mayotte	YT	MYT	175	\N	\N	\N	2025-03-14 14:53:24.728396+00	2025-03-14 14:53:24.728396+00	\N	\N
a04fc678-94ae-42bb-b43b-38ce17d30faf	Mexico	MX	MEX	484	\N	\N	\N	2025-03-14 14:53:24.744561+00	2025-03-14 14:53:24.744561+00	\N	\N
1a8f1b99-a206-48d9-8170-23814b72c4cc	Micronesia (Federated States of)	FM	FSM	583	\N	\N	\N	2025-03-14 14:53:24.748574+00	2025-03-14 14:53:24.748574+00	\N	\N
295fd56c-315c-4c82-9e20-fb571f376ddd	Moldova (the Republic of)	MD	MDA	498	\N	\N	\N	2025-03-14 14:53:24.770311+00	2025-03-14 14:53:24.770311+00	\N	\N
a0099cf4-5479-4475-a86b-2f3d67995db8	Monaco	MC	MCO	492	\N	\N	\N	2025-03-14 14:53:24.777624+00	2025-03-14 14:53:24.777624+00	\N	\N
dfbc0a35-28c7-4077-b9e6-08f3413ad130	Mongolia	MN	MNG	496	\N	\N	\N	2025-03-14 14:53:24.792541+00	2025-03-14 14:53:24.792541+00	\N	\N
47dcd774-7cbf-4a87-94df-369d0abf9232	Montenegro	ME	MNE	499	\N	\N	\N	2025-03-14 14:53:24.796324+00	2025-03-14 14:53:24.796324+00	\N	\N
d2d84e05-c829-4c67-acec-3632e5f6515a	Montserrat	MS	MSR	500	\N	\N	\N	2025-03-14 14:53:24.800496+00	2025-03-14 14:53:24.800496+00	\N	\N
0a421a5e-ad04-43ab-a539-2644d3ddabb0	Morocco	MA	MAR	504	\N	\N	\N	2025-03-14 14:53:24.803575+00	2025-03-14 14:53:24.803575+00	\N	\N
f8705655-8e50-4159-b738-efdb7c92de1f	Mozambique	MZ	MOZ	508	\N	\N	\N	2025-03-14 14:53:24.805925+00	2025-03-14 14:53:24.805925+00	\N	\N
0d9d4962-176e-4a2b-acc4-aa121c0d2d2f	Myanmar	MM	MMR	104	\N	\N	\N	2025-03-14 14:53:24.813302+00	2025-03-14 14:53:24.813302+00	\N	\N
81e51f8b-500d-4366-9360-3450dfa5ee4d	Namibia	NA	NAM	516	\N	\N	\N	2025-03-14 14:53:24.819467+00	2025-03-14 14:53:24.819467+00	\N	\N
a42e1e31-c988-4ece-9cc1-9f4ce8eec87d	Nauru	NR	NRU	520	\N	\N	\N	2025-03-14 14:53:24.825044+00	2025-03-14 14:53:24.825044+00	\N	\N
9297daf6-1431-4b62-9039-2ee22dcbba29	Nepal	NP	NPL	524	\N	\N	\N	2025-03-14 14:53:24.829174+00	2025-03-14 14:53:24.829174+00	\N	\N
eb4b669b-ccb1-4be4-bbad-5e1717b36d79	Netherlands (Kingdom of the)	NL	NLD	528	\N	\N	\N	2025-03-14 14:53:24.84512+00	2025-03-14 14:53:24.84512+00	\N	\N
f34e06ee-82cc-4a62-bd17-947c58f42116	New Caledonia	NC	NCL	540	\N	\N	\N	2025-03-14 14:53:24.860825+00	2025-03-14 14:53:24.860825+00	\N	\N
38ccc597-1f09-4de4-ad38-b9cddd2256c3	New Zealand	NZ	NZL	554	\N	\N	\N	2025-03-14 14:53:24.862685+00	2025-03-14 14:53:24.862685+00	\N	\N
70e897f5-c029-4382-9778-de9aa02b85d7	Nicaragua	NI	NIC	558	\N	\N	\N	2025-03-14 14:53:24.864128+00	2025-03-14 14:53:24.864128+00	\N	\N
5f42e8ac-7ec4-4192-9df8-2b18467c12e9	Niger (the)	NE	NER	562	\N	\N	\N	2025-03-14 14:53:24.865375+00	2025-03-14 14:53:24.865375+00	\N	\N
834f193e-7023-48a7-bc8e-58a910845d6b	Nigeria	NG	NGA	566	\N	\N	\N	2025-03-14 14:53:24.873157+00	2025-03-14 14:53:24.873157+00	\N	\N
e90ca965-4a55-433d-83c8-9de44b168b9c	Niue	NU	NIU	570	\N	\N	\N	2025-03-14 14:53:24.877519+00	2025-03-14 14:53:24.877519+00	\N	\N
e8d65387-e415-4e52-bf95-4cf7134e2235	Norfolk Island	NF	NFK	574	\N	\N	\N	2025-03-14 14:53:24.882084+00	2025-03-14 14:53:24.882084+00	\N	\N
6420bd1c-7b7b-40ec-87b0-8e25fd57ace2	North Macedonia	MK	MKD	807	\N	\N	\N	2025-03-14 14:53:24.896094+00	2025-03-14 14:53:24.896094+00	\N	\N
66177523-edef-4bb4-9e47-1db421e14257	Northern Mariana Islands (the)	MP	MNP	580	\N	\N	\N	2025-03-14 14:53:24.899499+00	2025-03-14 14:53:24.899499+00	\N	\N
fcd820ab-6f42-4794-8e6a-217faa6017ac	Norway	NO	NOR	578	\N	\N	\N	2025-03-14 14:53:24.904709+00	2025-03-14 14:53:24.904709+00	\N	\N
172fe5c4-06a1-435e-86e1-50a717ff1505	Oman	OM	OMN	512	\N	\N	\N	2025-03-14 14:53:24.907264+00	2025-03-14 14:53:24.907264+00	\N	\N
52fa7c54-7266-459b-b679-a4a0966dcca2	Pakistan	PK	PAK	586	\N	\N	\N	2025-03-14 14:53:24.911627+00	2025-03-14 14:53:24.911627+00	\N	\N
ad04836f-3c39-4de5-ba1d-171dded4420b	Palau	PW	PLW	585	\N	\N	\N	2025-03-14 14:53:24.923129+00	2025-03-14 14:53:24.923129+00	\N	\N
5c6ae2e3-4332-4f90-b002-8dedcae3ba24	Palestine, State of	PS	PSE	275	\N	\N	\N	2025-03-14 14:53:24.927897+00	2025-03-14 14:53:24.927897+00	\N	\N
9fab0497-b7b0-43af-8c94-ac59cf2d504a	Panama	PA	PAN	591	\N	\N	\N	2025-03-14 14:53:24.930406+00	2025-03-14 14:53:24.930406+00	\N	\N
9f60a3ca-cbd2-444d-818c-d0e7bf517bc0	Papua New Guinea	PG	PNG	598	\N	\N	\N	2025-03-14 14:53:24.939409+00	2025-03-14 14:53:24.939409+00	\N	\N
e0b720ab-8f2e-4914-b9f1-3dbec41eef21	Paraguay	PY	PRY	600	\N	\N	\N	2025-03-14 14:53:24.943386+00	2025-03-14 14:53:24.943386+00	\N	\N
2069bcb9-4a3d-4462-8860-e39fe7327d4f	Peru	PE	PER	604	\N	\N	\N	2025-03-14 14:53:24.945942+00	2025-03-14 14:53:24.945942+00	\N	\N
4b0170c2-6403-45f2-a9be-25e61595b48e	Philippines (the)	PH	PHL	608	\N	\N	\N	2025-03-14 14:53:24.954883+00	2025-03-14 14:53:24.954883+00	\N	\N
db94e4b5-77ae-4459-8494-e31443458d7a	Pitcairn	PN	PCN	612	\N	\N	\N	2025-03-14 14:53:24.978423+00	2025-03-14 14:53:24.978423+00	\N	\N
fb7e9280-2b6f-429c-be0c-e4fa204755f8	Poland	PL	POL	616	\N	\N	\N	2025-03-14 14:53:24.987208+00	2025-03-14 14:53:24.987208+00	\N	\N
9c06ea4c-d311-4249-a91e-09c14c66786a	Portugal	PT	PRT	620	\N	\N	\N	2025-03-14 14:53:24.990172+00	2025-03-14 14:53:24.990172+00	\N	\N
38c264c0-26f6-4929-a52c-2277e2aaccce	Puerto Rico	PR	PRI	630	\N	\N	\N	2025-03-14 14:53:24.993455+00	2025-03-14 14:53:24.993455+00	\N	\N
d2b5abfa-efc3-4bd6-8a44-7d747e3a4157	Qatar	QA	QAT	634	\N	\N	\N	2025-03-14 14:53:24.996574+00	2025-03-14 14:53:24.996574+00	\N	\N
1042f63e-2ebf-492c-87e8-2b7bdc69150d	Romania	RO	ROU	642	\N	\N	\N	2025-03-14 14:53:24.999228+00	2025-03-14 14:53:24.999228+00	\N	\N
7c469d95-9f01-4295-ab59-fd3698ed7a36	Russian Federation (the)	RU	RUS	643	\N	\N	\N	2025-03-14 14:53:25.002547+00	2025-03-14 14:53:25.002547+00	\N	\N
8d3556d9-f508-4a55-9f48-5c1aebc59de9	Rwanda	RW	RWA	646	\N	\N	\N	2025-03-14 14:53:25.005324+00	2025-03-14 14:53:25.005324+00	\N	\N
04c59caf-4541-4e15-8c6e-d4a435967ef4	Réunion	RE	REU	638	\N	\N	\N	2025-03-14 14:53:25.008038+00	2025-03-14 14:53:25.008038+00	\N	\N
ade77569-3a72-4030-b2b4-11814fdd6b0a	Saint Barthélemy	BL	BLM	652	\N	\N	\N	2025-03-14 14:53:25.010558+00	2025-03-14 14:53:25.010558+00	\N	\N
8bd68779-d3a5-4372-b932-598273b735ef	Saint Helena, Ascension and Tristan da Cunha	SH	SHN	654	\N	\N	\N	2025-03-14 14:53:25.012907+00	2025-03-14 14:53:25.012907+00	\N	\N
251ebe60-b752-4467-aa22-0d46d5ae4953	Saint Kitts and Nevis	KN	KNA	659	\N	\N	\N	2025-03-14 14:53:25.016219+00	2025-03-14 14:53:25.016219+00	\N	\N
411c3f03-3466-4fb1-a4ff-a9f71f7432ba	Saint Lucia	LC	LCA	662	\N	\N	\N	2025-03-14 14:53:25.033112+00	2025-03-14 14:53:25.033112+00	\N	\N
9b0f7458-981e-4a78-9cc1-969130cfb358	Saint Martin (French part)	MF	MAF	663	\N	\N	\N	2025-03-14 14:53:25.039534+00	2025-03-14 14:53:25.039534+00	\N	\N
36ea8942-d4e1-44ed-a36c-33fb6e715560	Saint Pierre and Miquelon	PM	SPM	666	\N	\N	\N	2025-03-14 14:53:25.043691+00	2025-03-14 14:53:25.043691+00	\N	\N
c4944fca-068f-4ab5-8b9d-3b2493d785f2	Saint Vincent and the Grenadines	VC	VCT	670	\N	\N	\N	2025-03-14 14:53:25.046366+00	2025-03-14 14:53:25.046366+00	\N	\N
e997b7ee-7a74-41b3-8089-1f8b84fa6b24	Samoa	WS	WSM	882	\N	\N	\N	2025-03-14 14:53:25.052006+00	2025-03-14 14:53:25.052006+00	\N	\N
c2066743-efa9-40b6-94b9-5b2b6e0942f3	San Marino	SM	SMR	674	\N	\N	\N	2025-03-14 14:53:25.057288+00	2025-03-14 14:53:25.057288+00	\N	\N
5def1949-7a28-4715-8427-6cb028048712	Sao Tome and Principe	ST	STP	678	\N	\N	\N	2025-03-14 14:53:25.062681+00	2025-03-14 14:53:25.062681+00	\N	\N
add83dad-b55a-4e07-ab2f-9c1828f310e6	Saudi Arabia	SA	SAU	682	\N	\N	\N	2025-03-14 14:53:25.068807+00	2025-03-14 14:53:25.068807+00	\N	\N
b306c1e2-e38e-4740-8467-7c9cb7c6c9b4	Senegal	SN	SEN	686	\N	\N	\N	2025-03-14 14:53:25.072864+00	2025-03-14 14:53:25.072864+00	\N	\N
1a73dfdb-7333-4239-a6a6-7863010a6953	Serbia	RS	SRB	688	\N	\N	\N	2025-03-14 14:53:25.076977+00	2025-03-14 14:53:25.076977+00	\N	\N
635f7357-f443-4723-994f-7a81dd5d165f	Seychelles	SC	SYC	690	\N	\N	\N	2025-03-14 14:53:25.079726+00	2025-03-14 14:53:25.079726+00	\N	\N
1a291f0f-1525-4815-ba48-67acaf27dd7a	Sierra Leone	SL	SLE	694	\N	\N	\N	2025-03-14 14:53:25.085184+00	2025-03-14 14:53:25.085184+00	\N	\N
d2f92a82-754c-4dbf-9297-8222e71b7573	Singapore	SG	SGP	702	\N	\N	\N	2025-03-14 14:53:25.090103+00	2025-03-14 14:53:25.090103+00	\N	\N
aec1a837-c291-452c-9ac6-425d9f9dca36	Sint Maarten (Dutch part)	SX	SXM	534	\N	\N	\N	2025-03-14 14:53:25.095694+00	2025-03-14 14:53:25.095694+00	\N	\N
409020d5-67ce-4eb1-a5ba-7ecd1356a2c8	Slovakia	SK	SVK	703	\N	\N	\N	2025-03-14 14:53:25.099237+00	2025-03-14 14:53:25.099237+00	\N	\N
81cf9d60-063d-4054-8277-0fc6eaa042ee	Slovenia	SI	SVN	705	\N	\N	\N	2025-03-14 14:53:25.115229+00	2025-03-14 14:53:25.115229+00	\N	\N
11859bb3-3249-4b3b-bc93-2236f608ff1e	Solomon Islands	SB	SLB	90	\N	\N	\N	2025-03-14 14:53:25.129269+00	2025-03-14 14:53:25.129269+00	\N	\N
4e6637ef-7d36-459a-9cf9-bd485e521443	Somalia	SO	SOM	706	\N	\N	\N	2025-03-14 14:53:25.141969+00	2025-03-14 14:53:25.141969+00	\N	\N
1e00e441-4e0a-4c95-a147-d5ba83dc7883	South Africa	ZA	ZAF	710	\N	\N	\N	2025-03-14 14:53:25.149683+00	2025-03-14 14:53:25.149683+00	\N	\N
2af622c9-671a-4992-8b66-085781d11864	South Georgia and the South Sandwich Islands	GS	SGS	239	\N	\N	\N	2025-03-14 14:53:25.165323+00	2025-03-14 14:53:25.165323+00	\N	\N
fda4281b-edb1-4bc4-8b80-86653209240b	South Sudan	SS	SSD	728	\N	\N	\N	2025-03-14 14:53:25.189514+00	2025-03-14 14:53:25.189514+00	\N	\N
1ad39315-d1f4-4655-84f0-db922eac7e1f	Spain	ES	ESP	724	\N	\N	\N	2025-03-14 14:53:25.193787+00	2025-03-14 14:53:25.193787+00	\N	\N
6bda2acd-5f00-4100-b31a-0de28d40a7c0	Sri Lanka	LK	LKA	144	\N	\N	\N	2025-03-14 14:53:25.197717+00	2025-03-14 14:53:25.197717+00	\N	\N
29569e45-ea36-4138-83a3-80b85ba9ba1a	Sudan (the)	SD	SDN	729	\N	\N	\N	2025-03-14 14:53:25.208952+00	2025-03-14 14:53:25.208952+00	\N	\N
37afad6a-c579-4b34-8042-c3aa708227b9	Suriname	SR	SUR	740	\N	\N	\N	2025-03-14 14:53:25.212931+00	2025-03-14 14:53:25.212931+00	\N	\N
d61520ca-a0b6-4df5-aaec-9abda8fc55d5	Svalbard and Jan Mayen	SJ	SJM	744	\N	\N	\N	2025-03-14 14:53:25.235961+00	2025-03-14 14:53:25.235961+00	\N	\N
c4233e6e-d7a3-4018-aff0-5415b06ef15b	Sweden	SE	SWE	752	\N	\N	\N	2025-03-14 14:53:25.243489+00	2025-03-14 14:53:25.243489+00	\N	\N
c93e39fe-759b-4db1-bd9a-230c1f930a7a	Switzerland	CH	CHE	756	\N	\N	\N	2025-03-14 14:53:25.246762+00	2025-03-14 14:53:25.246762+00	\N	\N
8dc3df2d-da25-4880-bfd6-a4f8fe8162c8	Syrian Arab Republic (the)	SY	SYR	760	\N	\N	\N	2025-03-14 14:53:25.257621+00	2025-03-14 14:53:25.257621+00	\N	\N
583c470c-9284-4b66-a009-81ffab8bda1a	Taiwan (Province of China)	TW	TWN	158	\N	\N	\N	2025-03-14 14:53:25.261934+00	2025-03-14 14:53:25.261934+00	\N	\N
6c387ed5-533e-4d6c-915f-72a85bc28c14	Tajikistan	TJ	TJK	762	\N	\N	\N	2025-03-14 14:53:25.277273+00	2025-03-14 14:53:25.277273+00	\N	\N
0abf95b2-7e48-4d1f-bc17-4d5c384783a2	Tanzania, the United Republic of	TZ	TZA	834	\N	\N	\N	2025-03-14 14:53:25.281813+00	2025-03-14 14:53:25.281813+00	\N	\N
90a8f117-bde3-4070-8165-95116ddb6c78	Thailand	TH	THA	764	\N	\N	\N	2025-03-14 14:53:25.289245+00	2025-03-14 14:53:25.289245+00	\N	\N
78331efc-59a3-49c6-a4da-cd971800b07b	Timor-Leste	TL	TLS	626	\N	\N	\N	2025-03-14 14:53:25.292988+00	2025-03-14 14:53:25.292988+00	\N	\N
10cd0a5a-934b-4541-900f-61c5400cb33e	Togo	TG	TGO	768	\N	\N	\N	2025-03-14 14:53:25.295719+00	2025-03-14 14:53:25.295719+00	\N	\N
3db7e945-42c5-4ca5-88c0-1ae75751d3cd	Tokelau	TK	TKL	772	\N	\N	\N	2025-03-14 14:53:25.311821+00	2025-03-14 14:53:25.311821+00	\N	\N
9c6b3dbf-9144-4d72-9c8c-c9984731beec	Tonga	TO	TON	776	\N	\N	\N	2025-03-14 14:53:25.32262+00	2025-03-14 14:53:25.32262+00	\N	\N
5e585603-a76d-425f-a0e9-1e62f5f7e9e8	Trinidad and Tobago	TT	TTO	780	\N	\N	\N	2025-03-14 14:53:25.326421+00	2025-03-14 14:53:25.326421+00	\N	\N
d9295f16-be88-4756-8f6e-1cf4764be20a	Tunisia	TN	TUN	788	\N	\N	\N	2025-03-14 14:53:25.328839+00	2025-03-14 14:53:25.328839+00	\N	\N
bfb05d2f-9712-4a49-9db5-c7fc6db9e876	Turkmenistan	TM	TKM	795	\N	\N	\N	2025-03-14 14:53:25.344414+00	2025-03-14 14:53:25.344414+00	\N	\N
e67b4538-7412-45c0-a0cf-e27bff88caab	Turks and Caicos Islands (the)	TC	TCA	796	\N	\N	\N	2025-03-14 14:53:25.365367+00	2025-03-14 14:53:25.365367+00	\N	\N
b24c16bb-ff27-4814-b9d7-523fd69d9b41	Tuvalu	TV	TUV	798	\N	\N	\N	2025-03-14 14:53:25.372383+00	2025-03-14 14:53:25.372383+00	\N	\N
1cb61161-23ca-4336-806e-61086d967a67	Türkiye	TR	TUR	792	\N	\N	\N	2025-03-14 14:53:25.376719+00	2025-03-14 14:53:25.376719+00	\N	\N
1737bb09-f1c5-4a9d-9dbc-0d03fbb86fa9	Uganda	UG	UGA	800	\N	\N	\N	2025-03-14 14:53:25.381905+00	2025-03-14 14:53:25.381905+00	\N	\N
278cade5-e251-4520-9394-cdd42c9212e6	Ukraine	UA	UKR	804	\N	\N	\N	2025-03-14 14:53:25.390328+00	2025-03-14 14:53:25.390328+00	\N	\N
b5966924-f09e-4024-8942-8f2e00949567	United Arab Emirates (the)	AE	ARE	784	\N	\N	\N	2025-03-14 14:53:25.394818+00	2025-03-14 14:53:25.394818+00	\N	\N
d1627009-fe55-469a-baf7-1a8b4979d654	United Kingdom of Great Britain and Northern Ireland (the)	GB	GBR	826	\N	\N	\N	2025-03-14 14:53:25.415377+00	2025-03-14 14:53:25.415377+00	\N	\N
f5804675-69c7-4b68-9dc6-22dea1f5201a	United States Minor Outlying Islands (the)	UM	UMI	581	\N	\N	\N	2025-03-14 14:53:25.421631+00	2025-03-14 14:53:25.421631+00	\N	\N
4a7446ad-a670-4e50-82dd-e71d2013d520	Uruguay	UY	URY	858	\N	\N	\N	2025-03-14 14:53:25.42718+00	2025-03-14 14:53:25.42718+00	\N	\N
3f51eb23-7ee5-43dd-a4c1-1bcd5880a4f4	Uzbekistan	UZ	UZB	860	\N	\N	\N	2025-03-14 14:53:25.432006+00	2025-03-14 14:53:25.432006+00	\N	\N
6915f34b-6468-4e75-a1d9-dbeee0529cb8	Vanuatu	VU	VUT	548	\N	\N	\N	2025-03-14 14:53:25.442507+00	2025-03-14 14:53:25.442507+00	\N	\N
e4778ab5-7678-46d9-baea-0368e4f812f0	Venezuela (Bolivarian Republic of)	VE	VEN	862	\N	\N	\N	2025-03-14 14:53:25.44543+00	2025-03-14 14:53:25.44543+00	\N	\N
cf4be8bf-0906-4925-8291-6c8c785dcef4	Viet Nam	VN	VNM	704	\N	\N	\N	2025-03-14 14:53:25.458576+00	2025-03-14 14:53:25.458576+00	\N	\N
0b038769-9d16-464d-85e6-fed33a40579a	Virgin Islands (British)	VG	VGB	92	\N	\N	\N	2025-03-14 14:53:25.461722+00	2025-03-14 14:53:25.461722+00	\N	\N
da33dd8f-a448-4e0a-93cc-a23abf6b1f8c	Virgin Islands (U.S.)	VI	VIR	850	\N	\N	\N	2025-03-14 14:53:25.475717+00	2025-03-14 14:53:25.475717+00	\N	\N
027e9c43-d25b-4cb5-b4c9-916084271623	Wallis and Futuna	WF	WLF	876	\N	\N	\N	2025-03-14 14:53:25.478793+00	2025-03-14 14:53:25.478793+00	\N	\N
8179a9d3-8d6d-4007-9b57-20d6f06f0a1a	Western Sahara*	EH	ESH	732	\N	\N	\N	2025-03-14 14:53:25.48921+00	2025-03-14 14:53:25.48921+00	\N	\N
7d0f9dbd-4909-491d-9440-5f87bca5a254	Yemen	YE	YEM	887	\N	\N	\N	2025-03-14 14:53:25.496611+00	2025-03-14 14:53:25.496611+00	\N	\N
aa0a06e7-d580-47b2-bc2e-cddd466186cb	Zambia	ZM	ZMB	894	\N	\N	\N	2025-03-14 14:53:25.507594+00	2025-03-14 14:53:25.507594+00	\N	\N
7cb24c49-fbcf-45ce-aae7-db9d896f8dbb	Zimbabwe	ZW	ZWE	716	\N	\N	\N	2025-03-14 14:53:25.511113+00	2025-03-14 14:53:25.511113+00	\N	\N
fa0dcd21-865b-4de3-a315-83af78061b4a	Åland Islands	AX	ALA	248	\N	\N	\N	2025-03-14 14:53:25.516047+00	2025-03-14 14:53:25.516047+00	\N	\N
69b81a70-6fa3-4533-9d00-c252f0f6245f	Ontario	CA_ONT	CAN_ONT	124	Ontario	\N	\N	2025-03-28 20:59:00.703+00	2025-03-28 20:59:00.703+00	b52c3226-dc94-4289-a051-b7227fd77ae8	f
360b9bee-d159-4e20-ba1f-9681d17cf9bc	Toronto	CA_ONT_ONT	CAN_ONT_ONT	124	Ontario	Toronto	\N	2025-03-28 21:00:09.105+00	2025-03-28 21:00:09.105+00	69b81a70-6fa3-4533-9d00-c252f0f6245f	f
6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	Illinois	US_ILL	USA_ILL	840	Illinois	\N	\N	2025-03-28 21:12:17.915+00	2025-03-28 21:12:17.915+00	e6fffac1-4aad-4ce4-9981-3983dde344d3	f
c9d94069-3e55-43c7-bca2-bbb5cabedc9a	Cook County	US_ILL_ILL	USA_ILL_ILL	840	Illinois	Cook County	\N	2025-03-28 21:12:34.908+00	2025-03-28 21:12:34.908+00	6bc52e9d-dbcb-40c0-b974-a4cd37748cfd	f
b19145e9-2513-41c3-b2a7-719588692eed	Chicago	US_ILL_ILL_ILL	USA_ILL_ILL_ILL	840	Illinois	Cook County	Chicago	2025-03-28 21:12:48.947+00	2025-03-28 21:12:48.947+00	c9d94069-3e55-43c7-bca2-bbb5cabedc9a	f
be12d2a6-5412-488d-a0ce-0ec5f8f60b8b	New South Wales	AU-NSW	NSW	\N	New South Wales	\N	\N	2026-02-14 15:32:09.603582+00	2026-02-14 15:32:09.603582+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
f53e7f72-8bbe-4017-994a-499b681bfc70	Queensland	AU-QLD	QLD	\N	Queensland	\N	\N	2026-02-14 15:32:09.60516+00	2026-02-14 15:32:09.60516+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
e2d10ec3-9430-4d5c-8052-4079b7646c83	South Australia	AU-SA	SA	\N	South Australia	\N	\N	2026-02-14 15:32:09.605493+00	2026-02-14 15:32:09.605493+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
31ac7237-951c-4135-863e-bc87b9359032	Western Australia	AU-WA	WA	\N	Western Australia	\N	\N	2026-02-14 15:32:09.605758+00	2026-02-14 15:32:09.605758+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
a512089d-7e1a-4faf-bbe7-791658c5abc6	Tasmania	AU-TAS	TAS	\N	Tasmania	\N	\N	2026-02-14 15:32:09.605944+00	2026-02-14 15:32:09.605944+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
cdaade9b-d3c7-43c9-98ea-e7c226278029	Northern Territory	AU-NT	NT	\N	Northern Territory	\N	\N	2026-02-14 15:32:09.606177+00	2026-02-14 15:32:09.606177+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
e7ab0d86-da11-47da-a667-9ccd8313e83d	Australian Capital Territory	AU-ACT	ACT	\N	Australian Capital Territory	\N	\N	2026-02-14 15:32:09.606373+00	2026-02-14 15:32:09.606373+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
0edca2a6-84ed-4258-828a-688d9bae549d	Victoria	AU-VIC	VIC	\N	Victoria	\N	\N	2026-02-11 21:24:52.903+00	2026-02-11 21:24:52.903+00	071a36ac-c2e2-4462-b10d-3175b101bd06	f
82ea570a-9354-43d8-b2dd-4dee5843fd59	Virginia	US_VIR_4574	USA_VIR_4574	\N	Virginia	\N	\N	2026-02-25 03:17:24.575+00	2026-02-25 03:17:24.575+00	e6fffac1-4aad-4ce4-9981-3983dde344d3	f
01fc255a-47d7-49da-bddf-8fdeb9b870c3	Arlington	US_VIR_4574_ARL_1298	USA_VIR_4574_ARL_1298	\N	Virginia	Arlington	\N	2026-02-25 03:17:51.299+00	2026-02-25 03:17:51.299+00	82ea570a-9354-43d8-b2dd-4dee5843fd59	f
\.


--
-- Data for Name: customer_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer_services (id, "customerId", "serviceId", "createdAt") FROM stdin;
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
020b3051-2e2e-4006-975c-41b7f77c5f4e	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-30 01:05:11.325+00	2026-02-14 17:41:45.927+00
f6a48306-cc9c-4cf7-87c2-7768eacc908b	ABC Company		Andy Hellman	andythellman@gmail.com					f	\N	\N	\N	2026-02-25 19:22:57.442+00	2026-02-25 19:22:57.442+00
bfd1d2fe-6915-4e2c-a704-54ff349ff197	1-Test Customer		Andy Hellman	andythellman@gmail.com	7037410710				f	\N	\N	\N	2025-05-30 19:32:17.959+00	2025-05-30 19:50:06.406+00
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
\.


--
-- Data for Name: dsx_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dsx_requirements (id, name, type, "fieldData", "documentData", "formData", "createdAt", "updatedAt", disabled) FROM stdin;
7456d517-e212-454d-8d4a-e19ddd077ba7	Company Name	field	{"options": [], "dataType": "text", "versions": [{"changes": {"dataType": {"to": "text"}, "shortName": {"to": "Company Name"}, "instructions": {"to": ""}, "collectionTab": {"to": "search", "from": "subject"}, "retentionHandling": {"to": "no_delete"}}, "timestamp": "2026-01-27T21:18:44.413Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Company Name", "instructions": "", "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2025-04-06 16:07:35.433	2026-01-27 21:18:44.416	f
5132a5a2-6bbc-4fe6-b242-8eee1e761c86	School Street Address	field	{"options": [], "dataType": "text", "disabled": true, "shortName": "Street Address", "instructions": "", "collectionTab": "search", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:43:32.486	2026-02-23 03:24:07.173	f
739b2b3f-db5c-4010-b96c-5238a3a26298	First Name	field	{"options": [], "dataType": "text", "shortName": "First Name", "instructions": "", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-27 02:54:17.592	2026-01-27 22:58:54.993	f
5ea29387-6d88-43e4-aaa8-481937d22b9c	School Name	field	{"options": [], "dataType": "text", "shortName": "School Name", "instructions": "Enter the full official name of the school attended.", "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2026-01-28 19:44:43.434	2026-01-28 19:44:43.434	f
b41cc87a-89af-4031-970a-1b1b860d2894	Primary ID	document	\N	{"scope": "per_search", "instructions": "Upload a doc from this list:\\n- Passport\\n- Driver Licence", "retentionHandling": "global_rule"}	\N	2026-02-14 17:38:01.856	2026-02-14 17:38:01.856	f
0f73bcea-e704-44da-bbf2-0a4a5e0b679b	School Address	field	{"options": [], "dataType": "address_block", "versions": [{"changes": {"collectionTab": {"to": "search", "from": "subject"}}, "timestamp": "2026-02-14T15:13:38.618Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "School Address", "instructions": "", "addressConfig": {"city": {"label": "City", "enabled": true, "required": true}, "state": {"label": "State/Province", "enabled": true, "required": true}, "county": {"label": "County", "enabled": false, "required": false}, "street1": {"label": "Street Address", "enabled": true, "required": true}, "street2": {"label": "Apt/Suite", "enabled": true, "required": false}, "postalCode": {"label": "ZIP/Postal Code", "enabled": true, "required": true}}, "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2026-02-14 15:01:51.861	2026-02-14 15:13:38.619	f
b6f8e826-249a-458d-af9d-fcdeb8542abd	Start Date	field	{"options": [], "dataType": "date", "shortName": "Start date of studies", "instructions": "Enter the date you started studying.", "addressConfig": null, "collectionTab": "search", "retentionHandling": "no_delete", "requiresVerification": true}	\N	\N	2026-02-23 03:15:46.443	2026-02-23 03:15:46.443	f
61588fb6-5a89-4b27-bf6f-1a6d07b48a1f	Company Name	field	{"options": [], "dataType": "text", "versions": [{"changes": {"collectionTab": {"to": "search", "from": "subject"}}, "timestamp": "2026-02-14T15:48:28.023Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Company Name", "instructions": "Provide the full company name.", "addressConfig": null, "collectionTab": "search", "retentionHandling": "no_delete"}	\N	\N	2025-04-06 16:07:26.568	2026-02-14 15:48:28.024	f
1f27c8a7-e554-41bc-8750-230e2c3f5018	Residence Street Address	field	{"options": [], "dataType": "text", "disabled": true, "shortName": "Street Address", "instructions": "Enter the candidate's street address, including house/building number.", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:42:29.168	2026-02-14 17:40:01.893	f
8cc249d5-d320-442f-b2fe-88380569770c	Surname/Last Name	field	{"options": [], "dataType": "text", "versions": [{"changes": {"shortName": {"to": "Surname/Last Name", "from": "Last Name"}, "requiresVerification": {"to": false, "from": false}}, "timestamp": "2026-02-25T03:29:15.266Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Surname/Last Name", "instructions": "", "addressConfig": null, "collectionTab": "subject", "retentionHandling": "global_rule", "requiresVerification": false}	\N	\N	2026-01-27 02:54:43.847	2026-02-25 03:29:15.267	f
ed12120d-674a-47cc-b06e-81a135eb7ea5	Residence Address	field	{"options": [], "dataType": "address_block", "shortName": "Residence Address", "instructions": "Enter your current address.", "addressConfig": {"city": {"label": "City", "enabled": true, "required": true}, "state": {"label": "State/Province", "enabled": true, "required": true}, "county": {"label": "County", "enabled": false, "required": false}, "street1": {"label": "Street Address", "enabled": true, "required": true}, "street2": {"label": "Apt/Suite", "enabled": true, "required": false}, "postalCode": {"label": "ZIP/Postal Code", "enabled": true, "required": true}}, "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-02-14 17:40:45.39	2026-02-14 17:40:45.39	f
cb63bfb9-b41b-4a99-8c42-49b057d66af0	End Date	field	{"options": [], "dataType": "date", "shortName": "End date of studies", "instructions": "", "addressConfig": null, "collectionTab": "search", "retentionHandling": "no_delete", "requiresVerification": true}	\N	\N	2026-02-23 03:16:18.184	2026-02-23 03:16:18.184	f
007a7957-92c0-4ec4-9a93-f5cd56260f10	Company Address	field	{"options": [], "dataType": "address_block", "versions": [{"changes": {"requiresVerification": {"to": false, "from": false}}, "timestamp": "2026-02-20T19:57:26.549Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Company Address", "instructions": "", "addressConfig": {"city": {"label": "City", "enabled": true, "required": true}, "state": {"label": "State/Province", "enabled": true, "required": true}, "county": {"label": "County", "enabled": false, "required": false}, "street1": {"label": "Street Address", "enabled": true, "required": true}, "street2": {"label": "Apt/Suite", "enabled": true, "required": false}, "postalCode": {"label": "ZIP/Postal Code", "enabled": true, "required": true}}, "collectionTab": "search", "retentionHandling": "no_delete", "requiresVerification": false}	\N	\N	2026-01-29 01:24:46.435	2026-02-20 19:57:26.55	f
ba8bb198-a455-4713-b8bf-026f155acda0	Residence City	field	{"options": [], "dataType": "text", "disabled": true, "shortName": "City", "instructions": "Enter the city of the residential address.", "collectionTab": "subject", "retentionHandling": "global_rule"}	\N	\N	2026-01-28 19:42:56.87	2026-02-23 03:24:02.287	f
81b5aa1d-3072-46df-91be-c31f8dd04ebb	Degree type	field	{"options": [{"label": "Did not graduate", "value": "did_not_graduate"}, {"label": "High School/Secondary", "value": "high_school/secondary"}, {"label": "Associates", "value": "associates"}, {"label": "Bachelors", "value": "bachelors"}, {"label": "Masters", "value": "masters"}, {"label": "Doctorate", "value": "doctorate"}], "dataType": "select", "versions": [{"changes": {"requiresVerification": {"to": false, "from": false}}, "timestamp": "2026-02-20T19:55:36.188Z", "modifiedBy": "andythellman@gmail.com"}, {"changes": {"requiresVerification": {"to": true, "from": false}}, "timestamp": "2026-02-20T19:55:46.211Z", "modifiedBy": "andythellman@gmail.com"}, {"changes": {"options": {"to": [{"label": "Did not graduate", "value": "did_not_graduate"}, {"label": "High School/Secondary", "value": "high_school/secondary"}, {"label": "Associates", "value": "associates"}, {"label": "Bachelors", "value": "bachelors"}, {"label": "Masters", "value": "masters"}, {"label": "Doctorate", "value": "doctorate"}], "from": []}, "dataType": {"to": "select", "from": "text"}}, "timestamp": "2026-02-23T03:22:39.593Z", "modifiedBy": "andythellman@gmail.com"}], "shortName": "Degree type", "instructions": "", "addressConfig": null, "collectionTab": "search", "retentionHandling": "no_delete", "requiresVerification": true}	\N	\N	2026-02-20 16:41:41.672	2026-02-23 03:22:39.595	f
86d871fe-eb21-42e0-9584-7a94cdc4792c	Copy of degree	document	\N	{"scope": "per_search", "instructions": "Provide a copy of your degree.", "retentionHandling": "global_rule"}	\N	2026-02-23 03:23:20.515	2026-02-23 03:23:20.515	f
26b49fc1-828d-4117-bb9f-17ef79510261	Graduation Date	field	{"options": [], "dataType": "date", "shortName": "Graduation Date", "instructions": "Enter the date you actually graduated.", "addressConfig": null, "collectionTab": "search", "retentionHandling": "no_delete", "requiresVerification": true}	\N	\N	2026-02-25 03:27:32.919	2026-02-25 03:27:32.919	f
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
\.


--
-- Data for Name: order_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_statuses (id, code, name, description, color, sequence, "isActive", "allowedNextStatuses", "createdAt") FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, "orderNumber", "customerId", "userId", "statusCode", subject, "totalPrice", notes, "submittedAt", "completedAt", "createdAt", "updatedAt", "assignedVendorId") FROM stdin;
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

COPY public.service_requirements (id, "serviceId", "requirementId", "createdAt", "updatedAt", "displayOrder") FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") FROM stdin;
\.


--
-- Data for Name: translations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.translations (id, "labelKey", language, value) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions, "customerId", "failedLoginAttempts", "lastLoginAt", "lastLoginIp", "lastPasswordChange", "lockedUntil", "mfaEnabled", "mfaSecret", "userType", "vendorId") FROM stdin;
c2175238-b327-40ac-86c9-3e31dbabaee4	andyh@realidatasolutions.com	$2a$10$F3PNQV1kejotJP7fFpoCwOMu1l3i..qruy3RHHyabTizipcSe8IZ.	Andy	Hellman	2025-03-11 12:53:14.139	2026-02-25 03:15:03.14	{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}	\N	1	\N	\N	2026-01-25 20:49:42.445	\N	f	\N	admin	\N
9afc7407-afc9-40be-9c18-79141256c69a	testuser2@gmail.com	$2a$10$o4Y.OaLMtpWIpR9PdnRBrueNF1DWJeJh.Ptai/TG6QKSZzfhFeTAy	Andy	Hellman	2026-02-20 12:33:22.137	2026-02-20 13:44:23.656	{"users": {"manage": true}, "orders": {"edit": true, "view": true, "create": true}}	bfd1d2fe-6915-4e2c-a704-54ff349ff197	0	2026-02-20 13:44:23.654	\N	2026-02-20 12:33:22.137	\N	f	\N	customer	\N
ef32c9ec-ac05-4735-980e-325ae989dac1	andy.hellman@employmentscreeninggroup.com	$2a$10$csg67sC3ZRAPf0Y4o7v.6OvMcIkxmaKe7OzY1fpFMXV6hHC4ezD.e	Andy	Hellman	2026-02-25 03:16:01.757	2026-02-28 14:57:41.322	{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}	\N	0	2026-02-28 14:57:41.321	\N	2026-02-25 03:16:01.757	\N	f	\N	admin	\N
f7b3085b-f119-4dfe-8116-43ca962c6eb0	customer@test.com	$2a$10$.gvhCO2O5hp5nDo7t4Wa0O0VSPHGJDT..sgdMKRnjzngFuSzpKc7q	Test	Customer	2026-01-26 12:52:45.701	2026-03-01 18:02:36.671	{"services": [], "countries": [], "customers": ["020b3051-2e2e-4006-975c-41b7f77c5f4e"]}	020b3051-2e2e-4006-975c-41b7f77c5f4e	0	2026-03-01 18:02:36.67	\N	2026-01-26 12:52:45.701	\N	f	\N	customer	\N
a683ee4e-ea02-4db1-a662-2d100a80867a	vendor@vendor.com	$2a$10$sAmWCj9Cz1cYtzAnUgjiN.eNbpm12b9sIEFn.DPcUzzRommECu8eO	Jonny	Vendor	2026-02-28 21:11:13.872	2026-03-01 18:10:47.312	{"fulfillment": "*"}	\N	0	2026-03-01 18:10:47.311	\N	2026-02-28 21:11:13.872	\N	f	\N	vendor	f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8
0c81952d-f51e-469f-a9ad-074be12b18e4	andythellman@gmail.com	$2a$10$53r0G1lUnNhnoMCjMG0DH.N1Bk41UMXZ/sDJ.9gTB1ie638raM6Ze	Admin	User	2025-03-11 02:29:39.361	2026-03-01 20:52:45.502	{"vendors": "*", "user_admin": "*", "global_config": "*", "customer_config": "*"}	\N	0	2026-03-01 20:52:45.501	\N	2026-01-25 20:49:42.445	\N	f	\N	admin	\N
\.


--
-- Data for Name: vendor_organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vendor_organizations (id, name, "isActive", "isPrimary", "contactEmail", "contactPhone", address, notes, "createdAt", "updatedAt") FROM stdin;
f0ae8208-2bdb-4fcb-b90a-3109b7d6bcb8	ESG Internal	t	f	andy@esg.com	1234			2026-02-28 21:02:10.869	2026-02-28 21:02:10.869
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
-- Name: vendor_organizations vendor_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_organizations
    ADD CONSTRAINT vendor_organizations_pkey PRIMARY KEY (id);


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
-- Name: customer_services_customerId_serviceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "customer_services_customerId_serviceId_key" ON public.customer_services USING btree ("customerId", "serviceId");


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
-- Name: orders_assignedVendorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "orders_assignedVendorId_idx" ON public.orders USING btree ("assignedVendorId");


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
-- Name: package_services_packageId_serviceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "package_services_packageId_serviceId_key" ON public.package_services USING btree ("packageId", "serviceId");


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
-- Name: users_vendorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "users_vendorId_idx" ON public.users USING btree ("vendorId");


--
-- Name: vendor_organizations_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vendor_organizations_isActive_idx" ON public.vendor_organizations USING btree ("isActive");


--
-- Name: vendor_organizations_isPrimary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "vendor_organizations_isPrimary_idx" ON public.vendor_organizations USING btree ("isPrimary");


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
-- Name: orders orders_assignedVendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES public.vendor_organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


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
-- Name: users users_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendor_organizations(id) ON UPDATE CASCADE ON DELETE SET NULL;


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

\unrestrict TLSQ95aNfiEhnhm691WbGAhhKaoS1gDPHX6sV8NcYuXAi3IEOBtI7IZleDts0ia

