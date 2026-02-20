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
-- Name: public; Type: SCHEMA; Schema: -; Owner: andyhellman
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO andyhellman;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: andyhellman
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public._prisma_migrations OWNER TO andyhellman;

--
-- Name: countries; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.countries OWNER TO andyhellman;

--
-- Name: customer_services; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.customer_services (
    id text NOT NULL,
    "customerId" text NOT NULL,
    "serviceId" text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.customer_services OWNER TO andyhellman;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.customers OWNER TO andyhellman;

--
-- Name: data_fields; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.data_fields (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    label text NOT NULL,
    "shortName" text NOT NULL,
    "dataType" text NOT NULL,
    instructions text
);


ALTER TABLE public.data_fields OWNER TO andyhellman;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.documents (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    name text NOT NULL,
    instructions text,
    scope text NOT NULL,
    "filePath" text
);


ALTER TABLE public.documents OWNER TO andyhellman;

--
-- Name: dsx_availability; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.dsx_availability OWNER TO andyhellman;

--
-- Name: dsx_mappings; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.dsx_mappings OWNER TO andyhellman;

--
-- Name: dsx_requirements; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.dsx_requirements OWNER TO andyhellman;

--
-- Name: package_services; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.package_services (
    id text NOT NULL,
    "packageId" text NOT NULL,
    "serviceId" text NOT NULL,
    scope jsonb,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.package_services OWNER TO andyhellman;

--
-- Name: packages; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.packages (
    id text NOT NULL,
    "customerId" text NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.packages OWNER TO andyhellman;

--
-- Name: service_requirements; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.service_requirements (
    id text NOT NULL,
    "serviceId" text NOT NULL,
    "requirementId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.service_requirements OWNER TO andyhellman;

--
-- Name: services; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.services OWNER TO andyhellman;

--
-- Name: translations; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.translations (
    id text NOT NULL,
    "labelKey" text NOT NULL,
    language text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.translations OWNER TO andyhellman;

--
-- Name: users; Type: TABLE; Schema: public; Owner: andyhellman
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "firstName" text,
    "lastName" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    permissions jsonb
);


ALTER TABLE public.users OWNER TO andyhellman;

--
-- Name: workflow_sections; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.workflow_sections OWNER TO andyhellman;

--
-- Name: workflows; Type: TABLE; Schema: public; Owner: andyhellman
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


ALTER TABLE public.workflows OWNER TO andyhellman;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
341d756a-68d8-40be-8341-1e30f33044d2	3a44da6d50f85c4cac248ad62517f115d4e016e3343f5cda49da59b5792c6b44	2026-01-25 20:33:35.918137-05	20240318_update_service_model	\N	\N	2026-01-25 20:33:35.916749-05	1
60af7626-dbb3-494f-9a72-1f353002cb76	9d929016b988050643ce916086c428e340af45ef5a86193a5ffbc1cc3b0bea70	\N	20250530000000_workflow_direct_package_relation	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20250530000000_workflow_direct_package_relation\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "workflows" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"workflows\\" does not exist", detail: None, hint: None, position: None, where_: Some("SQL statement \\"ALTER TABLE \\"workflows\\" ADD COLUMN \\"packageId\\" TEXT\\"\\nPL/pgSQL function inline_code_block line 6 at SQL statement"), schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(437), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20250530000000_workflow_direct_package_relation"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20250530000000_workflow_direct_package_relation"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	\N	2026-01-25 20:33:35.918451-05	0
e775c470-5d31-4d2d-be96-e42edbb2664f	3a44da6d50f85c4cac248ad62517f115d4e016e3343f5cda49da59b5792c6b44	2025-05-30 19:34:37.749046-04	20240318_update_service_model	\N	\N	2025-05-30 19:34:37.747584-04	1
496b8a92-2e94-48a7-8dea-2c2c5ed01ed0	57488e00cfbf736ca6a068712002f0d65cea88887a804df75942453dc46dc147	\N	20250530000000_workflow_direct_package_relation	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20250530000000_workflow_direct_package_relation\n\nDatabase error code: 42P01\n\nDatabase error:\nERROR: relation "workflows" does not exist\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42P01), message: "relation \\"workflows\\" does not exist", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("namespace.c"), line: Some(437), routine: Some("RangeVarGetRelidExtended") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20250530000000_workflow_direct_package_relation"\n             at schema-engine/connectors/sql-schema-connector/src/apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20250530000000_workflow_direct_package_relation"\n             at schema-engine/core/src/commands/apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine/core/src/state.rs:226	2025-05-30 19:36:13.446452-04	2025-05-30 19:34:37.749421-04	0
fe5657a5-329a-41a4-a189-63b2b9dbcce4	9d929016b988050643ce916086c428e340af45ef5a86193a5ffbc1cc3b0bea70	2025-05-30 19:36:13.448022-04	20250530000000_workflow_direct_package_relation		\N	2025-05-30 19:36:13.448022-04	0
a95eca5a-4cbb-4cc4-8726-c587d8c9b34a	d9d9e35900254fef106b5f179a0abb8762a77c53ed35dad883faaafdc20876a9	2025-03-18 21:55:42.294656-04	20240318_update_service_model		\N	2025-03-18 21:55:42.294656-04	0
097f45a8-9826-4a5c-8f5f-022b6c9e9c27	d8e53a77e0ecc6f37d5ff682b5a26e7a6f33b95c3e88956a7c96545a6c646de1	2025-05-30 19:39:29.836612-04	20250530194500_add_workflow_user_tracking	\N	\N	2025-05-30 19:39:29.836612-04	1
d41c6107-ae57-4ce2-b749-6ecf626d42db	a973abdccf7660e2be0b35cdc7d62fa413fea96c6528efa555afeeeea19a9f21	2025-06-01 21:35:21.228542-04	20250601000000_add_workflow_reminder_fields		\N	2025-06-01 21:35:21.228542-04	0
\.


--
-- Data for Name: countries; Type: TABLE DATA; Schema: public; Owner: andyhellman
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
\.


--
-- Data for Name: customer_services; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.customer_services (id, "customerId", "serviceId", "createdAt") FROM stdin;
29b76fd1-c53b-42ce-855e-1187987a33b0	2e743d0f-692a-43f0-bcad-2d75ff9b0c02	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:04:22.046-04
2d7da26c-74a9-4380-9474-de6545998e6e	2e743d0f-692a-43f0-bcad-2d75ff9b0c02	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:04:22.052-04
02fe8f17-8a33-4c85-995a-f0e7f6e16331	2e743d0f-692a-43f0-bcad-2d75ff9b0c02	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:04:22.053-04
d888538f-3ade-4bd5-9d6d-8fa44b40754d	bbec2a1a-47f4-4599-9a54-0bd370e765fb	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:04:22.054-04
cc2f1667-01a2-43b4-ab98-87e2ff1d9b5d	bbec2a1a-47f4-4599-9a54-0bd370e765fb	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:04:22.055-04
dbb0d409-2901-4d86-a1f2-11dd196f156d	bbec2a1a-47f4-4599-9a54-0bd370e765fb	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:04:22.058-04
3d7ad6f1-1f48-485c-8fbd-1f845f2d9971	8332c067-6f72-49b7-92da-ad478f76623d	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:04:22.06-04
e80b51db-877b-41d5-a6a7-96bf9dba9118	8332c067-6f72-49b7-92da-ad478f76623d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:04:22.061-04
c79afa7a-afe5-4ac3-b105-f689afe785e8	8332c067-6f72-49b7-92da-ad478f76623d	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:04:22.061-04
9852240a-1632-43a1-8ffa-c19b4a63a2e7	9cb261a7-ee30-44fa-af74-f8b4c404c351	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:04:22.063-04
0fcaff82-fb28-4a56-bc97-0b6aa5dac36c	9cb261a7-ee30-44fa-af74-f8b4c404c351	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:04:22.064-04
3a15bdec-1ada-4eb0-9e5c-c89c2e364373	9cb261a7-ee30-44fa-af74-f8b4c404c351	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:04:22.067-04
91bde758-35ef-4f2b-99b7-5c5a5f4b12e8	13fb7ef5-908a-45ae-a2ec-799808ed2513	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:05:11.342-04
97f7dd2a-8e55-4b34-a5cc-ff31faaa30c7	13fb7ef5-908a-45ae-a2ec-799808ed2513	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:05:11.344-04
ec1d4aac-e0c9-4fa0-bdac-3acbdb816ee2	13fb7ef5-908a-45ae-a2ec-799808ed2513	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:05:11.345-04
e10d5c98-adf9-48bc-8b92-5783081b9fa4	398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:05:11.347-04
3c42d1fc-26a9-4498-8dec-ac9662b777e2	398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:05:11.348-04
b761a472-8848-41a9-a78f-f9ed8a02ee8e	398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:05:11.349-04
baa78880-a7b6-40ee-bf16-8f1fc009e832	cd4ed22f-47a6-4e23-a0bd-7cc006265b51	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:05:11.356-04
55a88a82-2a1d-4aec-834d-01b40aadb899	cd4ed22f-47a6-4e23-a0bd-7cc006265b51	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:05:11.357-04
c8ca7d8b-f13d-4170-93da-e99c7664688c	cd4ed22f-47a6-4e23-a0bd-7cc006265b51	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:05:11.358-04
4ceb6754-9cdc-4bab-937c-8b8f70021a3b	f6c03bae-9c84-49c4-a504-649505400189	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:06:50.719-04
cfafca78-1f89-415e-89c0-9c02a51dcdac	f6c03bae-9c84-49c4-a504-649505400189	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:06:50.721-04
45912da9-19e4-43b2-96d6-8b61fbd5104b	f6c03bae-9c84-49c4-a504-649505400189	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:06:50.722-04
93303b1c-b850-4c0b-8b46-e58428aa0e8c	1145c0c6-5fc2-4694-85d8-321ca84cbd26	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:06:50.723-04
b3a0ee07-d321-4c8d-a020-ddb4a1e082ce	1145c0c6-5fc2-4694-85d8-321ca84cbd26	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:06:50.724-04
f2f55cf3-74a8-4533-8677-004c78a7d5a0	1145c0c6-5fc2-4694-85d8-321ca84cbd26	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:06:50.724-04
3896c760-ccd1-4deb-9142-324a250aaa87	26138196-6ec8-4b94-affc-a3fad8bec97a	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:06:50.731-04
f45745be-1315-486a-a4ab-3375165047f5	26138196-6ec8-4b94-affc-a3fad8bec97a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:06:50.732-04
d0df8d9a-50c1-41c7-a41e-f09e284fce46	26138196-6ec8-4b94-affc-a3fad8bec97a	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:06:50.733-04
75dd108e-346e-4fdc-a75c-aaaca08b69a1	c0bac8ac-e49b-432e-b60e-85b094f7ffe5	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:06:50.735-04
7c97be46-2cdc-494d-93fa-9477a779b020	c0bac8ac-e49b-432e-b60e-85b094f7ffe5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:06:50.736-04
0f57f839-7080-40b3-bd5a-cd596bbd5b79	c0bac8ac-e49b-432e-b60e-85b094f7ffe5	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:06:50.736-04
ad655f39-8be2-4f65-a3a5-5ed592c0f74b	33ee375a-81d3-4d21-a893-5c0177a96bb3	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:08:13.219-04
9e625b03-ec5f-46b1-8729-ed1b8dadd860	33ee375a-81d3-4d21-a893-5c0177a96bb3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:08:13.223-04
2764965e-c52c-48b8-a0e3-7a613c7771b2	33ee375a-81d3-4d21-a893-5c0177a96bb3	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:08:13.224-04
9aadebea-281a-4344-b431-a0285c821ed2	37959e50-3372-45a7-8cb3-a641c7ad7758	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:08:13.231-04
14866a7d-9a09-45b2-973e-ec4500e7c606	37959e50-3372-45a7-8cb3-a641c7ad7758	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:08:13.234-04
7e3dbbf7-0092-4378-a28b-07df41dc01d4	37959e50-3372-45a7-8cb3-a641c7ad7758	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:08:13.235-04
a58ab6a8-c600-4316-a71e-053248d07abe	e22c5274-bd67-4b1b-9ab4-019742292e41	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:08:13.239-04
1a3b98c7-aa80-4936-b646-5f6d80c77974	e22c5274-bd67-4b1b-9ab4-019742292e41	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:08:13.241-04
685a2e8d-d2c6-4e78-8070-5dbe51965cc1	e22c5274-bd67-4b1b-9ab4-019742292e41	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:08:13.242-04
b61cb18d-3149-4367-b24b-75f297907b89	eb03d0d0-713a-4f38-a373-d1222dfdaff3	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-29 21:08:13.248-04
16ccba43-098a-4508-af2d-8dcc842c9ef6	eb03d0d0-713a-4f38-a373-d1222dfdaff3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-29 21:08:13.25-04
f51149d6-020c-426e-b449-198c8fae5d60	eb03d0d0-713a-4f38-a373-d1222dfdaff3	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-29 21:08:13.25-04
0f702a67-5333-42cd-b5b0-2abe1825ecc8	b7174195-60c7-49c8-af34-afe975add6e4	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-30 09:15:58.848-04
6c3659ee-92ae-4bed-8eac-5c9c8c0939f6	b7174195-60c7-49c8-af34-afe975add6e4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-30 09:15:58.854-04
96ef40f2-6fe0-4bbd-9ecb-76c2b3a031c2	b7174195-60c7-49c8-af34-afe975add6e4	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-30 09:15:58.857-04
428a30ed-86b2-471c-bd45-1a95b807de9a	d0a15923-951f-4bfc-89c1-0fef30160bda	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-30 09:15:58.863-04
ed6949cb-c8fb-4895-a980-f239bbf89c4a	d0a15923-951f-4bfc-89c1-0fef30160bda	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-30 09:15:58.865-04
9ced6801-0919-4fca-a642-9d71ec7fa0fa	d0a15923-951f-4bfc-89c1-0fef30160bda	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-30 09:15:58.879-04
62520f6f-59ee-430a-a612-36b7e8d80dca	1cbdb224-5544-480b-bccb-1327b8ccf41f	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-30 09:15:58.884-04
d00fbd0f-a6e6-447c-b078-ae76d625e2fa	1cbdb224-5544-480b-bccb-1327b8ccf41f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-30 09:15:58.886-04
ddddc797-b8cf-43ab-8902-3e93135c821f	1cbdb224-5544-480b-bccb-1327b8ccf41f	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-30 09:15:58.891-04
ce0af6dd-6a2f-4a51-be18-22a9ddb0af42	3a26d5e2-a04e-4c99-91b7-32d9f1924467	383f3f2f-3194-4396-9a63-297f80e151f9	2025-03-30 09:15:58.894-04
b4d66b80-03b5-43d3-8338-721586f95ef2	3a26d5e2-a04e-4c99-91b7-32d9f1924467	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-03-30 09:15:58.896-04
6e8e10c5-9b56-4b7c-9fbc-2ffc00034d88	3a26d5e2-a04e-4c99-91b7-32d9f1924467	8388bb60-48e4-4781-a867-7c86b51be776	2025-03-30 09:15:58.897-04
e078fbdf-f6c7-4b58-bbce-ef274dbdbd76	bfd1d2fe-6915-4e2c-a704-54ff349ff197	383f3f2f-3194-4396-9a63-297f80e151f9	2025-05-30 15:50:06.416-04
6f887f58-26b1-4135-b929-6deb5e8825f9	bfd1d2fe-6915-4e2c-a704-54ff349ff197	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-05-30 15:50:06.416-04
73eb51db-809f-4822-87a3-d05340461a2d	bfd1d2fe-6915-4e2c-a704-54ff349ff197	8388bb60-48e4-4781-a867-7c86b51be776	2025-05-30 15:50:06.416-04
9a4e421a-9efe-4df9-994e-914d20e7f063	9ca83837-8779-4529-968a-a58899218b8c	383f3f2f-3194-4396-9a63-297f80e151f9	2025-06-06 16:57:08.823-04
b4e895e5-d38c-445b-9643-d61c50c0b249	9ca83837-8779-4529-968a-a58899218b8c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	2025-06-06 16:57:08.823-04
8d4c6ae3-39d4-40a3-8176-aaf66732f6da	9ca83837-8779-4529-968a-a58899218b8c	8388bb60-48e4-4781-a867-7c86b51be776	2025-06-06 16:57:08.823-04
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.customers (id, name, address, "contactName", "contactEmail", "contactPhone", "invoiceTerms", "invoiceContact", "invoiceMethod", disabled, "allowedServices", "masterAccountId", "billingAccountId", "createdAt", "updatedAt") FROM stdin;
114fde83-dda4-4f45-b2fe-93d160f9d846	Global Enterprises Inc.	123 Main Street, New York, NY 10001	John Smith	john.smith@globalenterprises.com	212-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:01:36.165898-04	2025-03-29 21:01:36.165898-04
5f70af84-f402-4992-8853-f42d983c878c	Pacific Regional Corp.	456 Market Street, San Francisco, CA 94105	Emily Wong	emily.wong@pacificregional.com	415-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:01:36.165898-04	2025-03-29 21:01:36.165898-04
6f5d2cd7-2ccb-44d1-abd4-f284da2e2d11	European Solutions Ltd.	789 Regent Street, London, UK W1B 2HE	James Thompson	james.thompson@europeansolutions.co.uk	+44 20 7123 4567	Net 60	Accounting	Electronic Invoicing	f	\N	\N	\N	2025-03-29 21:01:36.165898-04	2025-03-29 21:01:36.165898-04
4857a791-782f-48a2-bca6-d456daf0608a	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:03:04.397-04	2025-03-29 21:03:04.397-04
ea6a817e-a0ef-4562-8a7e-d246fe07472e	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:03:04.46-04	2025-03-29 21:03:04.46-04
6bed6fde-bfd8-49a1-91ff-45511853ca37	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-29 21:03:04.461-04	2025-03-29 21:03:04.461-04
5f970bae-13f4-4558-bf17-abb7f801c51d	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	4857a791-782f-48a2-bca6-d456daf0608a	4857a791-782f-48a2-bca6-d456daf0608a	2025-03-29 21:03:04.481-04	2025-03-29 21:03:04.481-04
0effd5ee-3c96-40dd-b285-b68086c3f78a	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:04:22.023-04	2025-03-29 21:04:22.023-04
a62aeb1f-ddf0-4e21-9e52-aa63ae5fde66	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:04:22.039-04	2025-03-29 21:04:22.039-04
0f5f03a4-56bd-4da5-9082-819ab5c53735	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-29 21:04:22.04-04	2025-03-29 21:04:22.04-04
2e743d0f-692a-43f0-bcad-2d75ff9b0c02	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	0effd5ee-3c96-40dd-b285-b68086c3f78a	0effd5ee-3c96-40dd-b285-b68086c3f78a	2025-03-29 21:04:22.044-04	2025-03-29 21:04:22.044-04
bbec2a1a-47f4-4599-9a54-0bd370e765fb	Global Enterprises - Europe	56 Oxford St, London, UK W1D 1BF	James Wilson	james.wilson@globalenterprises.com	+44 20 7123 4567	Net 30	\N	\N	f	\N	0effd5ee-3c96-40dd-b285-b68086c3f78a	0effd5ee-3c96-40dd-b285-b68086c3f78a	2025-03-29 21:04:22.053-04	2025-03-29 21:04:22.053-04
8332c067-6f72-49b7-92da-ad478f76623d	Acme Corp - West	789 Wilshire Blvd, Los Angeles, CA 90017	David Lee	david.lee@acmecorp.com	213-555-8901	Net 45	\N	\N	f	\N	a62aeb1f-ddf0-4e21-9e52-aa63ae5fde66	a62aeb1f-ddf0-4e21-9e52-aa63ae5fde66	2025-03-29 21:04:22.059-04	2025-03-29 21:04:22.059-04
9cb261a7-ee30-44fa-af74-f8b4c404c351	Tech Innovations - Research	101 Innovation Way, Seattle, WA 98101	Emily Zhang	emily.zhang@techinnovations.com	206-555-6543	Net 15	\N	\N	f	\N	0f5f03a4-56bd-4da5-9082-819ab5c53735	0f5f03a4-56bd-4da5-9082-819ab5c53735	2025-03-29 21:04:22.062-04	2025-03-29 21:04:22.062-04
020b3051-2e2e-4006-975c-41b7f77c5f4e	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:05:11.325-04	2025-03-29 21:05:11.325-04
c6ccf24d-3c41-4f34-ade3-9e9bb7977304	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:05:11.332-04	2025-03-29 21:05:11.332-04
55dc1f54-1071-4c40-9489-ddaed18f2289	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-29 21:05:11.337-04	2025-03-29 21:05:11.337-04
13fb7ef5-908a-45ae-a2ec-799808ed2513	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	020b3051-2e2e-4006-975c-41b7f77c5f4e	020b3051-2e2e-4006-975c-41b7f77c5f4e	2025-03-29 21:05:11.34-04	2025-03-29 21:05:11.34-04
398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	Global Enterprises - Europe	56 Oxford St, London, UK W1D 1BF	James Wilson	james.wilson@globalenterprises.com	+44 20 7123 4567	Net 30	\N	\N	f	\N	020b3051-2e2e-4006-975c-41b7f77c5f4e	020b3051-2e2e-4006-975c-41b7f77c5f4e	2025-03-29 21:05:11.345-04	2025-03-29 21:05:11.345-04
cd4ed22f-47a6-4e23-a0bd-7cc006265b51	Tech Innovations - Research	101 Innovation Way, Seattle, WA 98101	Emily Zhang	emily.zhang@techinnovations.com	206-555-6543	Net 15	\N	\N	f	\N	55dc1f54-1071-4c40-9489-ddaed18f2289	55dc1f54-1071-4c40-9489-ddaed18f2289	2025-03-29 21:05:11.355-04	2025-03-29 21:05:11.355-04
05b4f626-8e60-43c0-8644-28a657f4eeab	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:06:50.707-04	2025-03-29 21:06:50.707-04
cb926243-b907-408b-a8a1-80e98df6d4f0	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:06:50.712-04	2025-03-29 21:06:50.712-04
a2268ecc-3d99-4ff3-8c2e-c3ddb6f25bbe	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-29 21:06:50.713-04	2025-03-29 21:06:50.713-04
f6c03bae-9c84-49c4-a504-649505400189	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	05b4f626-8e60-43c0-8644-28a657f4eeab	05b4f626-8e60-43c0-8644-28a657f4eeab	2025-03-29 21:06:50.717-04	2025-03-29 21:06:50.717-04
1145c0c6-5fc2-4694-85d8-321ca84cbd26	Global Enterprises - Europe	56 Oxford St, London, UK W1D 1BF	James Wilson	james.wilson@globalenterprises.com	+44 20 7123 4567	Net 30	\N	\N	f	\N	05b4f626-8e60-43c0-8644-28a657f4eeab	05b4f626-8e60-43c0-8644-28a657f4eeab	2025-03-29 21:06:50.722-04	2025-03-29 21:06:50.722-04
26138196-6ec8-4b94-affc-a3fad8bec97a	Acme Corp - West	789 Wilshire Blvd, Los Angeles, CA 90017	David Lee	david.lee@acmecorp.com	213-555-8901	Net 45	\N	\N	f	\N	cb926243-b907-408b-a8a1-80e98df6d4f0	cb926243-b907-408b-a8a1-80e98df6d4f0	2025-03-29 21:06:50.73-04	2025-03-29 21:06:50.73-04
c0bac8ac-e49b-432e-b60e-85b094f7ffe5	Tech Innovations - Research	101 Innovation Way, Seattle, WA 98101	Emily Zhang	emily.zhang@techinnovations.com	206-555-6543	Net 15	\N	\N	f	\N	a2268ecc-3d99-4ff3-8c2e-c3ddb6f25bbe	a2268ecc-3d99-4ff3-8c2e-c3ddb6f25bbe	2025-03-29 21:06:50.735-04	2025-03-29 21:06:50.735-04
fbaf7a1e-3fef-4d33-952d-1e2a424fe21f	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-29 21:08:13.192-04	2025-03-29 21:08:13.192-04
1446775b-1c14-47bf-a55b-8d0691b1468a	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-29 21:08:13.206-04	2025-03-29 21:08:13.206-04
3bf4f959-5f7c-4bb3-b298-3f21010f4632	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-29 21:08:13.207-04	2025-03-29 21:08:13.207-04
33ee375a-81d3-4d21-a893-5c0177a96bb3	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	fbaf7a1e-3fef-4d33-952d-1e2a424fe21f	fbaf7a1e-3fef-4d33-952d-1e2a424fe21f	2025-03-29 21:08:13.214-04	2025-03-29 21:08:13.214-04
37959e50-3372-45a7-8cb3-a641c7ad7758	Global Enterprises - Europe	56 Oxford St, London, UK W1D 1BF	James Wilson	james.wilson@globalenterprises.com	+44 20 7123 4567	Net 30	\N	\N	f	\N	fbaf7a1e-3fef-4d33-952d-1e2a424fe21f	fbaf7a1e-3fef-4d33-952d-1e2a424fe21f	2025-03-29 21:08:13.228-04	2025-03-29 21:08:13.228-04
e22c5274-bd67-4b1b-9ab4-019742292e41	Acme Corp - West	789 Wilshire Blvd, Los Angeles, CA 90017	David Lee	david.lee@acmecorp.com	213-555-8901	Net 45	\N	\N	f	\N	1446775b-1c14-47bf-a55b-8d0691b1468a	1446775b-1c14-47bf-a55b-8d0691b1468a	2025-03-29 21:08:13.237-04	2025-03-29 21:08:13.237-04
eb03d0d0-713a-4f38-a373-d1222dfdaff3	Tech Innovations - Research	101 Innovation Way, Seattle, WA 98101	Emily Zhang	emily.zhang@techinnovations.com	206-555-6543	Net 15	\N	\N	f	\N	3bf4f959-5f7c-4bb3-b298-3f21010f4632	3bf4f959-5f7c-4bb3-b298-3f21010f4632	2025-03-29 21:08:13.243-04	2025-03-29 21:08:13.243-04
709610a3-88e3-43f3-9300-983127c7874e	Global Enterprises	123 Main St, San Francisco, CA 94105	John Smith	john.smith@globalenterprises.com	415-555-1234	Net 30	Accounts Payable	Email	f	\N	\N	\N	2025-03-30 09:15:58.802-04	2025-03-30 09:15:58.802-04
23154020-06aa-4135-bb7b-4ee432733e58	Acme Corporation	456 Market St, Chicago, IL 60601	Sarah Johnson	sarah.johnson@acmecorp.com	312-555-6789	Net 45	Finance Department	Mail	f	\N	\N	\N	2025-03-30 09:15:58.819-04	2025-03-30 09:15:58.819-04
e9f9f512-76c5-4dba-913e-565798389db5	Tech Innovations	789 Tech Blvd, Austin, TX 78701	Michael Chen	michael.chen@techinnovations.com	512-555-4321	Net 15	Billing Department	Email	f	\N	\N	\N	2025-03-30 09:15:58.82-04	2025-03-30 09:15:58.82-04
b7174195-60c7-49c8-af34-afe975add6e4	Global Enterprises - North America	234 Broadway, New York, NY 10001	Linda Johnson	linda.johnson@globalenterprises.com	212-555-2345	Net 30	\N	\N	f	\N	709610a3-88e3-43f3-9300-983127c7874e	709610a3-88e3-43f3-9300-983127c7874e	2025-03-30 09:15:58.843-04	2025-03-30 09:15:58.843-04
d0a15923-951f-4bfc-89c1-0fef30160bda	Global Enterprises - Europe	56 Oxford St, London, UK W1D 1BF	James Wilson	james.wilson@globalenterprises.com	+44 20 7123 4567	Net 30	\N	\N	f	\N	709610a3-88e3-43f3-9300-983127c7874e	709610a3-88e3-43f3-9300-983127c7874e	2025-03-30 09:15:58.859-04	2025-03-30 09:15:58.859-04
1cbdb224-5544-480b-bccb-1327b8ccf41f	Acme Corp - West	789 Wilshire Blvd, Los Angeles, CA 90017	David Lee	david.lee@acmecorp.com	213-555-8901	Net 45	\N	\N	f	\N	23154020-06aa-4135-bb7b-4ee432733e58	23154020-06aa-4135-bb7b-4ee432733e58	2025-03-30 09:15:58.88-04	2025-03-30 09:15:58.88-04
3a26d5e2-a04e-4c99-91b7-32d9f1924467	Tech Innovations - Research	101 Innovation Way, Seattle, WA 98101	Emily Zhang	emily.zhang@techinnovations.com	206-555-6543	Net 15	\N	\N	f	\N	e9f9f512-76c5-4dba-913e-565798389db5	e9f9f512-76c5-4dba-913e-565798389db5	2025-03-30 09:15:58.893-04	2025-03-30 09:15:58.893-04
bfd1d2fe-6915-4e2c-a704-54ff349ff197	1-Test Customer		Andy Hellman	andythellman@gmail.com	7037410710				f	\N	\N	\N	2025-05-30 15:32:17.959-04	2025-05-30 15:50:06.406-04
9ca83837-8779-4529-968a-a58899218b8c	Acme Corp - West	789 Wilshire Blvd, Los Angeles, CA 90017	David Lee	david.lee@acmecorp.com	213-555-8901	Net 45			f	\N	c6ccf24d-3c41-4f34-ade3-9e9bb7977304	c6ccf24d-3c41-4f34-ade3-9e9bb7977304	2025-03-29 21:05:11.349-04	2025-06-06 16:57:08.809-04
\.


--
-- Data for Name: data_fields; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.data_fields (id, "serviceId", label, "shortName", "dataType", instructions) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.documents (id, "serviceId", name, instructions, scope, "filePath") FROM stdin;
\.


--
-- Data for Name: dsx_availability; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.dsx_availability (id, "serviceId", "locationId", "isAvailable", "unavailableReason", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dsx_mappings; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.dsx_mappings (id, "serviceId", "locationId", "requirementId", "isRequired", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: dsx_requirements; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.dsx_requirements (id, name, type, "fieldData", "documentData", "formData", "createdAt", "updatedAt", disabled) FROM stdin;
7456d517-e212-454d-8d4a-e19ddd077ba7	Company Name	field	\N	\N	\N	2025-04-06 16:07:35.433	2025-04-06 16:07:35.433	f
61588fb6-5a89-4b27-bf6f-1a6d07b48a1f	Company Name	field	{"options": [], "dataType": "text", "shortName": "Company Name", "instructions": "Provide the full company name.", "retentionHandling": "no_delete"}	\N	\N	2025-04-06 16:07:26.568	2025-04-06 16:07:26.568	f
\.


--
-- Data for Name: package_services; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.package_services (id, "packageId", "serviceId", scope, "createdAt") FROM stdin;
44007cf6-d50e-4cb4-94a0-d1b2774d205e	79ca85b9-58d7-47b3-ab69-68aedf6f9d72	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:58.926-04
4ca0cf5f-ef12-4e95-a6f1-397e738398cd	79ca85b9-58d7-47b3-ab69-68aedf6f9d72	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.932-04
c3429cd3-f6ae-418f-a36a-4966581ce078	79ca85b9-58d7-47b3-ab69-68aedf6f9d72	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.936-04
0eb75a1e-b6c7-4399-be5f-017c8c700ca3	09b21a41-433c-4801-93fe-9564f0f8a991	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:58.941-04
72bad860-5471-49a0-850c-e24e0b9f8c49	09b21a41-433c-4801-93fe-9564f0f8a991	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.944-04
3c257eca-8279-4f03-bff4-5969c630dee2	09b21a41-433c-4801-93fe-9564f0f8a991	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.945-04
d5feafa1-daed-4144-83db-333369c9e7c8	acc58956-ad62-436b-9487-008fddb63734	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:58.947-04
cb14151e-d178-4cc3-9298-2b848f1f0225	acc58956-ad62-436b-9487-008fddb63734	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.948-04
44875f14-7a4f-4469-8f98-c54cb13baabf	acc58956-ad62-436b-9487-008fddb63734	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.948-04
135e313c-c403-4630-901c-6aab91928dcc	c6b14d82-a9ae-4101-a4ad-c9278d8f8ddc	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:58.95-04
05424cc4-ccc9-429e-8b4f-988fa4ecc8d6	c6b14d82-a9ae-4101-a4ad-c9278d8f8ddc	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.951-04
49ebf0cb-f4cf-4677-8d4a-058a4041c4d6	c6b14d82-a9ae-4101-a4ad-c9278d8f8ddc	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.952-04
ef40276f-9718-43af-a7ba-511e9159981b	a29a8160-875b-4315-a455-f28fd20f398f	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:58.969-04
2ee5ca45-3ff9-4434-aa1a-8db2074faab4	a29a8160-875b-4315-a455-f28fd20f398f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.971-04
92160324-1d5c-46d5-8bae-b8af6e227053	a29a8160-875b-4315-a455-f28fd20f398f	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.972-04
f59c0a87-4e51-4ff5-8a41-e5042d7d2f27	a8f8fff2-1394-4831-8d89-f12204bd0f1f	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:58.975-04
93d80dc9-b1f7-4b2e-b293-5227c2ca8967	a8f8fff2-1394-4831-8d89-f12204bd0f1f	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.982-04
11c10109-61ea-41bb-9d42-c183df5ab771	a8f8fff2-1394-4831-8d89-f12204bd0f1f	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.984-04
69352fff-11eb-4d7b-95c0-87e328221927	a35f0f06-e10c-41ac-b263-06b77be158a2	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:58.987-04
c6e920b7-f559-4a2b-999b-2fab77089f46	a35f0f06-e10c-41ac-b263-06b77be158a2	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.991-04
0fd40598-ad02-4d6d-8cf8-2166f18ac3b8	a35f0f06-e10c-41ac-b263-06b77be158a2	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.993-04
6ae1373a-e89c-491a-8285-91a02c672e89	d910218b-8056-4b74-a192-98b1347504d5	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:58.996-04
7952bba8-21fc-4200-aab8-82fdf668a749	d910218b-8056-4b74-a192-98b1347504d5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:58.996-04
21af4a10-7679-465c-a9c0-0a27131a7c7b	d910218b-8056-4b74-a192-98b1347504d5	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:58.997-04
d209c411-58f0-423e-980f-222f1370587c	211fe370-6235-4851-8542-773dab12320c	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.003-04
6bcd53bc-f7b9-48f3-915d-5800e90095c9	211fe370-6235-4851-8542-773dab12320c	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.004-04
c93779a9-b8bf-46a5-a97d-bcbbab7c9642	211fe370-6235-4851-8542-773dab12320c	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.005-04
4ae13f20-7b36-4c25-b12a-633f867448ff	6a8c14cc-7d59-4834-9099-af0904b9c715	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.007-04
de3759c2-2886-47f3-9091-44a4edee157a	6a8c14cc-7d59-4834-9099-af0904b9c715	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.008-04
e0dd32b2-6069-43d3-bb1a-82904df771c9	6a8c14cc-7d59-4834-9099-af0904b9c715	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.009-04
68d1c514-9103-4c2f-a49e-a09ae1f9061e	447c4668-fc71-4a3d-a789-b6af6aeb1b43	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.011-04
aa29ef4a-0697-4de8-9184-722b59674f5e	447c4668-fc71-4a3d-a789-b6af6aeb1b43	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.013-04
c6b959b6-aa04-4ff7-b782-f06c4988ada4	447c4668-fc71-4a3d-a789-b6af6aeb1b43	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.014-04
a124f617-d39c-44fd-846b-d11289963289	d1e030b8-dfef-48b9-a333-16f20dbf3f41	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.019-04
26481a3e-c777-4ec9-a3a6-a79009078e03	d1e030b8-dfef-48b9-a333-16f20dbf3f41	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.021-04
3af9ad24-f31e-47c6-a90a-beb23cbb0296	d1e030b8-dfef-48b9-a333-16f20dbf3f41	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.028-04
052709f8-69f4-4eb7-837f-587035b6ced5	38012e1f-2042-4d3b-a7eb-a828e789eb39	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.031-04
89d33e2c-7866-4ed7-a838-198f8748e063	38012e1f-2042-4d3b-a7eb-a828e789eb39	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.032-04
674ad7d3-1bde-477a-bfa0-9a9041f1a855	38012e1f-2042-4d3b-a7eb-a828e789eb39	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.033-04
d1cb3d06-c5a0-4e01-894f-520fa399aac6	126c7ba5-a83f-431a-bf4b-f145b1730442	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.034-04
d6f7156a-c136-42a1-838a-7726a12ebe08	126c7ba5-a83f-431a-bf4b-f145b1730442	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.035-04
c213e9f1-87d5-4c59-afcf-3334e0db3b8b	126c7ba5-a83f-431a-bf4b-f145b1730442	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.037-04
580a8209-ee82-486e-87b1-fc168685cc74	91bc6118-340e-4fd1-88f7-e3de8a4a2876	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.039-04
30c05809-760e-48e1-acf0-46395b5622a8	91bc6118-340e-4fd1-88f7-e3de8a4a2876	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.04-04
f34f005a-4147-49dd-a4d6-a6f4e996034c	91bc6118-340e-4fd1-88f7-e3de8a4a2876	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.04-04
ed8b337a-3d6a-40c1-8b39-789f6a906ce8	b97af659-9c39-4c9c-a205-992dddf091ce	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.042-04
b0b20221-ca34-4a33-ad1d-dbb0981dd36f	b97af659-9c39-4c9c-a205-992dddf091ce	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.043-04
d219a261-40a4-40f7-a245-2d0e4ae714e9	b97af659-9c39-4c9c-a205-992dddf091ce	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.045-04
2c6aff75-99e7-4794-b251-43750a6a4618	ef26f728-502e-4139-8b0c-8a32752dd563	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.046-04
7e43914b-1125-45fc-9a61-7af18d5c513e	ef26f728-502e-4139-8b0c-8a32752dd563	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.051-04
9ae4e608-bc85-425f-a000-f0e4a06d3950	ef26f728-502e-4139-8b0c-8a32752dd563	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.053-04
eccffe2e-dc0a-4a87-a4fb-c2a75abdbb87	68252ee0-f7d2-4a3c-b650-9103b1cef7bf	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.067-04
9be633cd-9dfe-4dcc-98b7-f21190e5a4cb	68252ee0-f7d2-4a3c-b650-9103b1cef7bf	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.069-04
83a877b8-9bbf-47ae-bc9e-48cfec7018ed	68252ee0-f7d2-4a3c-b650-9103b1cef7bf	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.075-04
27c5bb93-b102-4146-9540-a3181946a793	c03cd36a-d2a0-4f85-96e9-8eb8dab0b130	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.077-04
3ab4891a-abc8-46e0-9c33-15c9cc671fbf	c03cd36a-d2a0-4f85-96e9-8eb8dab0b130	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.077-04
bcbf0b3a-6471-41bc-9576-10314a3baf92	c03cd36a-d2a0-4f85-96e9-8eb8dab0b130	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.078-04
72b9b733-c9a9-4b61-8906-4a946a767f46	a31a59fa-c4fe-4159-9f5a-341994ca6809	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.084-04
a16e4ac4-6044-46ce-99d7-5004e2b1402e	a31a59fa-c4fe-4159-9f5a-341994ca6809	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.085-04
f0879ca9-e775-4c91-ab8e-e39dbc7c41cd	a31a59fa-c4fe-4159-9f5a-341994ca6809	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.086-04
7ca3a561-c7e3-47d9-809a-107d4987baf6	f4157ac2-ec6a-4896-b1f5-3ba04b284489	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.088-04
b6c35f2b-4378-495b-9e77-68fe2be51021	f4157ac2-ec6a-4896-b1f5-3ba04b284489	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.089-04
0cc42380-ae29-4c27-b2a3-f040fd4fc5c6	f4157ac2-ec6a-4896-b1f5-3ba04b284489	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.091-04
3db5c4e2-039c-4fa6-9c18-6f32b85f837b	b72949a8-c86c-449e-bb7e-fe9ef2942493	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.094-04
5bf3013c-2e7c-417c-ba31-29af6ae4bf02	b72949a8-c86c-449e-bb7e-fe9ef2942493	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.095-04
a9261bbf-088d-4365-b630-031cd25f5549	b72949a8-c86c-449e-bb7e-fe9ef2942493	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.096-04
e09cec3d-2ee0-447e-802b-e1ddf1ab664a	b4c3a34a-0250-45bf-9bed-789d7efdbf23	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.098-04
4eca7078-0d49-434c-a89c-365044ad2004	b4c3a34a-0250-45bf-9bed-789d7efdbf23	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.099-04
4b7420c3-a4b9-4a99-83b4-2ae465030890	b4c3a34a-0250-45bf-9bed-789d7efdbf23	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.101-04
6591d9a7-b685-4ef5-80d6-87c319a164e4	7d590683-2ee0-4ebe-b6f1-d2b318107dba	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.103-04
f5c51f91-151d-439f-9bfe-99c03da52323	7d590683-2ee0-4ebe-b6f1-d2b318107dba	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.104-04
f00e037f-b1d4-4fb8-8232-196142bad658	7d590683-2ee0-4ebe-b6f1-d2b318107dba	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.108-04
25262b12-3f1c-4fc9-a653-d150dd11361f	8eb82f58-0fde-4431-bc9e-06a924bca523	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.11-04
3009dc91-fb12-4859-92a2-2b5ae8e6a62e	8eb82f58-0fde-4431-bc9e-06a924bca523	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.111-04
ec55a893-7350-4af9-b435-758c567f6b72	8eb82f58-0fde-4431-bc9e-06a924bca523	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.112-04
96ccf1c9-7aad-448e-bca9-f6d39aea7eba	a7e5f9e4-3e6d-4a0a-b44f-0d3abd34188a	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.114-04
ccaefd1c-3c87-44d9-a2ce-7b6556f92399	a7e5f9e4-3e6d-4a0a-b44f-0d3abd34188a	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.114-04
bcf54cb6-9b22-4a2a-ab0b-cc675d74e3ee	a7e5f9e4-3e6d-4a0a-b44f-0d3abd34188a	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.116-04
ef6051f2-ff45-4635-a880-98b66277fafa	9202334c-487b-44b8-805a-97f3d6526155	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.149-04
70205d8a-142d-4e28-8445-2f68051e8e1c	9202334c-487b-44b8-805a-97f3d6526155	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.152-04
460bc4eb-97d2-47f6-a27e-2343e9044865	9202334c-487b-44b8-805a-97f3d6526155	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.153-04
66be83b5-4e59-4a7f-a6e0-5a28584e7cb7	24be6548-12b4-4a56-a185-1e76e3bf31a6	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.158-04
136da70d-4c7e-4194-9774-faa7b5dbb8b2	24be6548-12b4-4a56-a185-1e76e3bf31a6	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.159-04
9a5f5d2e-4d05-4fc7-8c3d-64443f882b1e	24be6548-12b4-4a56-a185-1e76e3bf31a6	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.159-04
b2d6fb8c-2a3e-4871-8eb0-a4076fa1eb19	b7ae3c4c-9bbd-46d6-bea9-b2a4e784d9c3	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.16-04
fd01bf4f-2e8c-435f-bd12-97018171dcad	b7ae3c4c-9bbd-46d6-bea9-b2a4e784d9c3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.161-04
c706e0c0-1173-489e-a39b-1702d20435c3	b7ae3c4c-9bbd-46d6-bea9-b2a4e784d9c3	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.161-04
34777ad5-f51a-410e-a266-67dd28fdfde0	b79ebcad-50aa-4630-8631-695389f039ac	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.162-04
39e89499-4602-48c7-bee5-3c76755da960	b79ebcad-50aa-4630-8631-695389f039ac	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.164-04
d9c75dcb-67a3-425a-96a4-3c62a8682897	b79ebcad-50aa-4630-8631-695389f039ac	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.169-04
4d6e21bd-5ef2-47bf-affb-0326a016abeb	6011c6c7-2762-461a-b248-87805e84e680	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.171-04
01c7881d-bd0d-45f1-ad3c-54fdd9bb7c36	6011c6c7-2762-461a-b248-87805e84e680	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.171-04
988f9178-8752-46a5-a87c-2cdd19613aa1	6011c6c7-2762-461a-b248-87805e84e680	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.172-04
9ef7e38d-3a46-470a-af3d-6235fd018a7a	8d635357-3079-4e90-86b2-594aa611ac0d	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.173-04
59ff9f12-92c0-43a1-a5cc-45959d88453d	8d635357-3079-4e90-86b2-594aa611ac0d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.174-04
fbb64dd0-40db-4f5c-b061-9fcd9f6fa801	8d635357-3079-4e90-86b2-594aa611ac0d	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.174-04
80260703-a855-4479-b0e0-709a0410e365	5177d80c-643c-47f3-bc3e-bae061f462d3	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.176-04
dd77bcf5-cdcf-40ca-b952-fbbd448bdaa9	5177d80c-643c-47f3-bc3e-bae061f462d3	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.177-04
ae967b46-63bc-4721-8bf9-1dcba59b1852	5177d80c-643c-47f3-bc3e-bae061f462d3	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.177-04
360937c7-076e-4165-b805-6eb34ee81871	ff89ce83-c7a4-488d-8ca5-4c609811347d	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.178-04
f359db90-17a4-4734-a4c6-80bee85e75e4	ff89ce83-c7a4-488d-8ca5-4c609811347d	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.179-04
c123ea79-9ecc-4eda-86e3-83d3cc8c36a0	ff89ce83-c7a4-488d-8ca5-4c609811347d	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.179-04
ac0d3745-3218-4cd8-b756-a40febcae395	537efcf4-f3e8-42a2-817b-03b14d6ef357	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.181-04
209ee0e4-6b2f-41a1-acc1-774d858460a5	537efcf4-f3e8-42a2-817b-03b14d6ef357	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.181-04
ac231936-6c06-4186-9d25-a1675d2820c9	537efcf4-f3e8-42a2-817b-03b14d6ef357	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.182-04
1a2409f0-acc7-4345-8893-b64a07526b11	0ba4c1c3-b171-44eb-a72f-ecf6376b8bca	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.183-04
db6ad7b5-cd3f-4934-aee8-108be52777bd	0ba4c1c3-b171-44eb-a72f-ecf6376b8bca	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.183-04
19d7bf6a-8673-4314-ac63-6e98d6ecfa49	0ba4c1c3-b171-44eb-a72f-ecf6376b8bca	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.184-04
b875938d-4a42-4b26-840d-207a26e8924f	a8ff6939-2aac-4e1c-a65d-299768289416	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.185-04
442a0498-396c-40f0-ad09-9e85cfccbee5	a8ff6939-2aac-4e1c-a65d-299768289416	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.185-04
a6c76988-fc68-453b-80f0-2ddc75df3fe4	a8ff6939-2aac-4e1c-a65d-299768289416	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.185-04
cac3ca6d-d6a3-471d-95d4-868e40775ed7	e342cadb-6d94-4049-af04-d03e8eae11e0	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.187-04
f81950f0-d9ff-446e-9399-c0161a2683f4	e342cadb-6d94-4049-af04-d03e8eae11e0	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.187-04
5838edef-dfb0-4529-bd87-74d81b0f9053	e342cadb-6d94-4049-af04-d03e8eae11e0	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.188-04
5987ebb0-7eb8-4ead-bcb5-27bd1ff0aa55	a1b00704-ac46-4d7f-8f42-9b689ea77aa4	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "current-address"}	2025-03-30 09:15:59.189-04
5baaa19e-38c7-475e-8c19-2bddc3ca9c1b	a1b00704-ac46-4d7f-8f42-9b689ea77aa4	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.189-04
812b1ee0-f2a8-4a97-88f6-dd6d7f79078e	a1b00704-ac46-4d7f-8f42-9b689ea77aa4	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.19-04
d4dcd4fe-b061-4fd4-8d66-67141ba2a5ba	f3616a96-865c-4f29-8827-fe5d6ba166d5	383f3f2f-3194-4396-9a63-297f80e151f9	{"type": "past-7-years"}	2025-03-30 09:15:59.191-04
54bf3290-f2d2-44f1-9b1a-335172a0fd41	f3616a96-865c-4f29-8827-fe5d6ba166d5	4b9d6a10-6861-426a-ad7f-60eb94312d0d	{}	2025-03-30 09:15:59.193-04
a74a46b3-73c7-4b45-bdd1-026e8ddec3ce	f3616a96-865c-4f29-8827-fe5d6ba166d5	8388bb60-48e4-4781-a867-7c86b51be776	{}	2025-03-30 09:15:59.194-04
\.


--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.packages (id, "customerId", name, description) FROM stdin;
79ca85b9-58d7-47b3-ab69-68aedf6f9d72	2e743d0f-692a-43f0-bcad-2d75ff9b0c02	Standard Package	Standard background check package
09b21a41-433c-4801-93fe-9564f0f8a991	2e743d0f-692a-43f0-bcad-2d75ff9b0c02	Comprehensive Package	Complete background check package
acc58956-ad62-436b-9487-008fddb63734	bbec2a1a-47f4-4599-9a54-0bd370e765fb	Standard Package	Standard background check package
c6b14d82-a9ae-4101-a4ad-c9278d8f8ddc	bbec2a1a-47f4-4599-9a54-0bd370e765fb	Comprehensive Package	Complete background check package
a29a8160-875b-4315-a455-f28fd20f398f	8332c067-6f72-49b7-92da-ad478f76623d	Standard Package	Standard background check package
a8f8fff2-1394-4831-8d89-f12204bd0f1f	8332c067-6f72-49b7-92da-ad478f76623d	Comprehensive Package	Complete background check package
a35f0f06-e10c-41ac-b263-06b77be158a2	9cb261a7-ee30-44fa-af74-f8b4c404c351	Standard Package	Standard background check package
d910218b-8056-4b74-a192-98b1347504d5	9cb261a7-ee30-44fa-af74-f8b4c404c351	Comprehensive Package	Complete background check package
211fe370-6235-4851-8542-773dab12320c	13fb7ef5-908a-45ae-a2ec-799808ed2513	Standard Package	Standard background check package
6a8c14cc-7d59-4834-9099-af0904b9c715	13fb7ef5-908a-45ae-a2ec-799808ed2513	Comprehensive Package	Complete background check package
447c4668-fc71-4a3d-a789-b6af6aeb1b43	398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	Standard Package	Standard background check package
d1e030b8-dfef-48b9-a333-16f20dbf3f41	398f0fcb-0e7d-4fac-8991-d88bc4ac16d6	Comprehensive Package	Complete background check package
38012e1f-2042-4d3b-a7eb-a828e789eb39	9ca83837-8779-4529-968a-a58899218b8c	Standard Package	Standard background check package
126c7ba5-a83f-431a-bf4b-f145b1730442	9ca83837-8779-4529-968a-a58899218b8c	Comprehensive Package	Complete background check package
91bc6118-340e-4fd1-88f7-e3de8a4a2876	cd4ed22f-47a6-4e23-a0bd-7cc006265b51	Standard Package	Standard background check package
b97af659-9c39-4c9c-a205-992dddf091ce	cd4ed22f-47a6-4e23-a0bd-7cc006265b51	Comprehensive Package	Complete background check package
ef26f728-502e-4139-8b0c-8a32752dd563	f6c03bae-9c84-49c4-a504-649505400189	Standard Package	Standard background check package
68252ee0-f7d2-4a3c-b650-9103b1cef7bf	f6c03bae-9c84-49c4-a504-649505400189	Comprehensive Package	Complete background check package
c03cd36a-d2a0-4f85-96e9-8eb8dab0b130	1145c0c6-5fc2-4694-85d8-321ca84cbd26	Standard Package	Standard background check package
a31a59fa-c4fe-4159-9f5a-341994ca6809	1145c0c6-5fc2-4694-85d8-321ca84cbd26	Comprehensive Package	Complete background check package
f4157ac2-ec6a-4896-b1f5-3ba04b284489	26138196-6ec8-4b94-affc-a3fad8bec97a	Standard Package	Standard background check package
b72949a8-c86c-449e-bb7e-fe9ef2942493	26138196-6ec8-4b94-affc-a3fad8bec97a	Comprehensive Package	Complete background check package
b4c3a34a-0250-45bf-9bed-789d7efdbf23	c0bac8ac-e49b-432e-b60e-85b094f7ffe5	Standard Package	Standard background check package
7d590683-2ee0-4ebe-b6f1-d2b318107dba	c0bac8ac-e49b-432e-b60e-85b094f7ffe5	Comprehensive Package	Complete background check package
8eb82f58-0fde-4431-bc9e-06a924bca523	33ee375a-81d3-4d21-a893-5c0177a96bb3	Standard Package	Standard background check package
a7e5f9e4-3e6d-4a0a-b44f-0d3abd34188a	33ee375a-81d3-4d21-a893-5c0177a96bb3	Comprehensive Package	Complete background check package
9202334c-487b-44b8-805a-97f3d6526155	37959e50-3372-45a7-8cb3-a641c7ad7758	Standard Package	Standard background check package
24be6548-12b4-4a56-a185-1e76e3bf31a6	37959e50-3372-45a7-8cb3-a641c7ad7758	Comprehensive Package	Complete background check package
b7ae3c4c-9bbd-46d6-bea9-b2a4e784d9c3	e22c5274-bd67-4b1b-9ab4-019742292e41	Standard Package	Standard background check package
b79ebcad-50aa-4630-8631-695389f039ac	e22c5274-bd67-4b1b-9ab4-019742292e41	Comprehensive Package	Complete background check package
6011c6c7-2762-461a-b248-87805e84e680	eb03d0d0-713a-4f38-a373-d1222dfdaff3	Standard Package	Standard background check package
8d635357-3079-4e90-86b2-594aa611ac0d	eb03d0d0-713a-4f38-a373-d1222dfdaff3	Comprehensive Package	Complete background check package
5177d80c-643c-47f3-bc3e-bae061f462d3	b7174195-60c7-49c8-af34-afe975add6e4	Standard Package	Standard background check package
ff89ce83-c7a4-488d-8ca5-4c609811347d	b7174195-60c7-49c8-af34-afe975add6e4	Comprehensive Package	Complete background check package
537efcf4-f3e8-42a2-817b-03b14d6ef357	d0a15923-951f-4bfc-89c1-0fef30160bda	Standard Package	Standard background check package
0ba4c1c3-b171-44eb-a72f-ecf6376b8bca	d0a15923-951f-4bfc-89c1-0fef30160bda	Comprehensive Package	Complete background check package
a8ff6939-2aac-4e1c-a65d-299768289416	1cbdb224-5544-480b-bccb-1327b8ccf41f	Standard Package	Standard background check package
e342cadb-6d94-4049-af04-d03e8eae11e0	1cbdb224-5544-480b-bccb-1327b8ccf41f	Comprehensive Package	Complete background check package
a1b00704-ac46-4d7f-8f42-9b689ea77aa4	3a26d5e2-a04e-4c99-91b7-32d9f1924467	Standard Package	Standard background check package
f3616a96-865c-4f29-8827-fe5d6ba166d5	3a26d5e2-a04e-4c99-91b7-32d9f1924467	Comprehensive Package	Complete background check package
\.


--
-- Data for Name: service_requirements; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.service_requirements (id, "serviceId", "requirementId", "createdAt", "updatedAt") FROM stdin;
f851d5a8-a1aa-42dc-a801-08e222899486	383f3f2f-3194-4396-9a63-297f80e151f9	7456d517-e212-454d-8d4a-e19ddd077ba7	2025-05-30 17:11:34.162	2025-05-30 17:11:34.162
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") FROM stdin;
383f3f2f-3194-4396-9a63-297f80e151f9	County Criminal	US Criminal	\N	f	2025-03-22 14:04:35.856	2025-03-22 14:04:35.856	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	record
8388bb60-48e4-4781-a867-7c86b51be776	ID Verification	IDV	Review of ID doc	f	2025-03-22 14:05:12.786	2025-03-22 14:05:12.786	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	other
4b9d6a10-6861-426a-ad7f-60eb94312d0d	Emp Verif	Verifications	\N	f	2025-03-22 00:51:35.968	2025-03-22 00:51:35.968	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	verification-emp
\.


--
-- Data for Name: translations; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.translations (id, "labelKey", language, value) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.users (id, email, password, "firstName", "lastName", "createdAt", "updatedAt", permissions) FROM stdin;
c2175238-b327-40ac-86c9-3e31dbabaee4	andyh@realidatasolutions.com	$2a$10$F3PNQV1kejotJP7fFpoCwOMu1l3i..qruy3RHHyabTizipcSe8IZ.	Andy	Hellman	2025-03-11 12:53:14.139	2025-03-13 16:21:05.41	{"services": ["*"], "countries": ["*"]}
0c81952d-f51e-469f-a9ad-074be12b18e4	andythellman@gmail.com	$2a$10$9e1W1xPBRhbynkTCZ73VzOSnBDSKNlFNvKHMYcf8ceXRuPjU52wmm	Admin	User	2025-03-11 02:29:39.361	2025-03-30 13:21:02.976	{"dsx": ["*"], "services": ["*"], "countries": ["*"], "customers": ["*"]}
\.


--
-- Data for Name: workflow_sections; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.workflow_sections (id, "workflowId", name, "displayOrder", "isRequired", "dependsOnSection", "dependencyLogic", "createdAt", "updatedAt") FROM stdin;
797d6ca0-a865-40f0-a7e0-2c4815b0a037	e2ff9ed8-4413-428b-834b-15bc94abb619	Notice of Processing	0	t	\N	\N	2025-06-08 14:59:04.212-04	2025-06-08 14:59:04.212-04
\.


--
-- Data for Name: workflows; Type: TABLE DATA; Schema: public; Owner: andyhellman
--

COPY public.workflows (id, name, description, status, "defaultLanguage", "expirationDays", "autoCloseEnabled", "extensionAllowed", "extensionDays", disabled, "createdAt", "updatedAt", "packageId", "createdById", "updatedById", "reminderEnabled", "reminderFrequency", "maxReminders") FROM stdin;
865219d6-8ee7-4c01-bb87-87e1b22e256a	Testing Workflow 88		draft	en-US	90	t	f	\N	f	2025-05-30 19:42:25.579-04	2025-06-01 21:01:31.957-04	126c7ba5-a83f-431a-bf4b-f145b1730442	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	f	7	3
e2ff9ed8-4413-428b-834b-15bc94abb619	Testing Workflow 800		draft	en-US	90	t	f	\N	f	2025-06-01 21:01:21.532-04	2025-06-07 12:55:29.137-04	38012e1f-2042-4d3b-a7eb-a828e789eb39	0c81952d-f51e-469f-a9ad-074be12b18e4	0c81952d-f51e-469f-a9ad-074be12b18e4	t	3	6
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: customer_services customer_services_customerId_serviceId_key; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_customerId_serviceId_key" UNIQUE ("customerId", "serviceId");


--
-- Name: customer_services customer_services_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT customer_services_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: data_fields data_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.data_fields
    ADD CONSTRAINT data_fields_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: dsx_availability dsx_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT dsx_availability_pkey PRIMARY KEY (id);


--
-- Name: dsx_mappings dsx_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT dsx_mappings_pkey PRIMARY KEY (id);


--
-- Name: dsx_requirements dsx_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_requirements
    ADD CONSTRAINT dsx_requirements_pkey PRIMARY KEY (id);


--
-- Name: package_services package_services_packageId_serviceId_key; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_packageId_serviceId_key" UNIQUE ("packageId", "serviceId");


--
-- Name: package_services package_services_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT package_services_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: service_requirements service_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT service_requirements_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: translations translations_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_sections workflow_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflow_sections
    ADD CONSTRAINT workflow_sections_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: countries_code2_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX countries_code2_key ON public.countries USING btree (code2);


--
-- Name: countries_code3_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX countries_code3_key ON public.countries USING btree (code3);


--
-- Name: countries_parentId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "countries_parentId_idx" ON public.countries USING btree ("parentId");


--
-- Name: customer_services_customerId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "customer_services_customerId_idx" ON public.customer_services USING btree ("customerId");


--
-- Name: customer_services_serviceId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "customer_services_serviceId_idx" ON public.customer_services USING btree ("serviceId");


--
-- Name: customers_billingAccountId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "customers_billingAccountId_idx" ON public.customers USING btree ("billingAccountId");


--
-- Name: customers_masterAccountId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "customers_masterAccountId_idx" ON public.customers USING btree ("masterAccountId");


--
-- Name: dsx_availability_locationId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "dsx_availability_locationId_idx" ON public.dsx_availability USING btree ("locationId");


--
-- Name: dsx_availability_serviceId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "dsx_availability_serviceId_idx" ON public.dsx_availability USING btree ("serviceId");


--
-- Name: dsx_availability_serviceId_locationId_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX "dsx_availability_serviceId_locationId_key" ON public.dsx_availability USING btree ("serviceId", "locationId");


--
-- Name: dsx_mappings_locationId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "dsx_mappings_locationId_idx" ON public.dsx_mappings USING btree ("locationId");


--
-- Name: dsx_mappings_requirementId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "dsx_mappings_requirementId_idx" ON public.dsx_mappings USING btree ("requirementId");


--
-- Name: dsx_mappings_serviceId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "dsx_mappings_serviceId_idx" ON public.dsx_mappings USING btree ("serviceId");


--
-- Name: dsx_mappings_serviceId_locationId_requirementId_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX "dsx_mappings_serviceId_locationId_requirementId_key" ON public.dsx_mappings USING btree ("serviceId", "locationId", "requirementId");


--
-- Name: dsx_requirements_type_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX dsx_requirements_type_idx ON public.dsx_requirements USING btree (type);


--
-- Name: package_services_packageId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "package_services_packageId_idx" ON public.package_services USING btree ("packageId");


--
-- Name: package_services_serviceId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "package_services_serviceId_idx" ON public.package_services USING btree ("serviceId");


--
-- Name: service_requirements_requirementId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "service_requirements_requirementId_idx" ON public.service_requirements USING btree ("requirementId");


--
-- Name: service_requirements_serviceId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "service_requirements_serviceId_idx" ON public.service_requirements USING btree ("serviceId");


--
-- Name: service_requirements_serviceId_requirementId_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX "service_requirements_serviceId_requirementId_key" ON public.service_requirements USING btree ("serviceId", "requirementId");


--
-- Name: services_createdById_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "services_createdById_idx" ON public.services USING btree ("createdById");


--
-- Name: services_updatedById_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "services_updatedById_idx" ON public.services USING btree ("updatedById");


--
-- Name: translations_labelKey_language_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX "translations_labelKey_language_key" ON public.translations USING btree ("labelKey", language);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: workflow_sections_workflowId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "workflow_sections_workflowId_idx" ON public.workflow_sections USING btree ("workflowId");


--
-- Name: workflows_createdById_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "workflows_createdById_idx" ON public.workflows USING btree ("createdById");


--
-- Name: workflows_packageId_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "workflows_packageId_idx" ON public.workflows USING btree ("packageId");


--
-- Name: workflows_updatedById_idx; Type: INDEX; Schema: public; Owner: andyhellman
--

CREATE INDEX "workflows_updatedById_idx" ON public.workflows USING btree ("updatedById");


--
-- Name: countries countries_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT "countries_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customer_services customer_services_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_services customer_services_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customer_services
    ADD CONSTRAINT "customer_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: customers customers_billingAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: customers customers_masterAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "customers_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES public.customers(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: dsx_availability dsx_availability_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT "dsx_availability_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_availability dsx_availability_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_availability
    ADD CONSTRAINT "dsx_availability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.countries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_requirementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES public.dsx_requirements(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: dsx_mappings dsx_mappings_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.dsx_mappings
    ADD CONSTRAINT "dsx_mappings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: package_services package_services_packageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES public.packages(id) ON DELETE CASCADE;


--
-- Name: package_services package_services_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.package_services
    ADD CONSTRAINT "package_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: packages packages_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT "packages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: service_requirements service_requirements_requirementId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT "service_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES public.dsx_requirements(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: service_requirements service_requirements_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.service_requirements
    ADD CONSTRAINT "service_requirements_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: services services_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: services services_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflow_sections workflow_sections_workflowId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflow_sections
    ADD CONSTRAINT "workflow_sections_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES public.workflows(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: workflows workflows_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: workflows workflows_packageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES public.packages(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: workflows workflows_updatedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: andyhellman
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT "workflows_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: andyhellman
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

