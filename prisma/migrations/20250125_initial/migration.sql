-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code2" TEXT NOT NULL,
    "code3" TEXT NOT NULL,
    "numeric" TEXT,
    "subregion1" TEXT,
    "subregion2" TEXT,
    "subregion3" TEXT,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT,
    "disabled" BOOLEAN,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_services" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "invoiceTerms" TEXT,
    "invoiceContact" TEXT,
    "invoiceMethod" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedServices" JSONB,
    "masterAccountId" TEXT,
    "billingAccountId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_fields" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "data_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "scope" TEXT NOT NULL,
    "filePath" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsx_availability" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "unavailableReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsx_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsx_mappings" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dsx_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsx_requirements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fieldData" JSONB,
    "documentData" JSONB,
    "formData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dsx_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_services" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "scope" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requirements" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "functionalityType" TEXT NOT NULL DEFAULT 'other',

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" TEXT NOT NULL,
    "labelKey" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "permissions" JSONB,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_sections" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dependsOnSection" TEXT,
    "dependencyLogic" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-US',
    "expirationDays" INTEGER NOT NULL DEFAULT 15,
    "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "extensionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "extensionDays" INTEGER,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderFrequency" INTEGER NOT NULL DEFAULT 7,
    "maxReminders" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code2_key" ON "countries"("code2" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code3_key" ON "countries"("code3" ASC);

-- CreateIndex
CREATE INDEX "countries_parentId_idx" ON "countries"("parentId" ASC);

-- CreateIndex
CREATE INDEX "customer_services_customerId_idx" ON "customer_services"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_services_customerId_serviceId_key" ON "customer_services"("customerId" ASC, "serviceId" ASC);

-- CreateIndex
CREATE INDEX "customer_services_serviceId_idx" ON "customer_services"("serviceId" ASC);

-- CreateIndex
CREATE INDEX "customers_billingAccountId_idx" ON "customers"("billingAccountId" ASC);

-- CreateIndex
CREATE INDEX "customers_masterAccountId_idx" ON "customers"("masterAccountId" ASC);

-- CreateIndex
CREATE INDEX "dsx_availability_locationId_idx" ON "dsx_availability"("locationId" ASC);

-- CreateIndex
CREATE INDEX "dsx_availability_serviceId_idx" ON "dsx_availability"("serviceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dsx_availability_serviceId_locationId_key" ON "dsx_availability"("serviceId" ASC, "locationId" ASC);

-- CreateIndex
CREATE INDEX "dsx_mappings_locationId_idx" ON "dsx_mappings"("locationId" ASC);

-- CreateIndex
CREATE INDEX "dsx_mappings_requirementId_idx" ON "dsx_mappings"("requirementId" ASC);

-- CreateIndex
CREATE INDEX "dsx_mappings_serviceId_idx" ON "dsx_mappings"("serviceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dsx_mappings_serviceId_locationId_requirementId_key" ON "dsx_mappings"("serviceId" ASC, "locationId" ASC, "requirementId" ASC);

-- CreateIndex
CREATE INDEX "dsx_requirements_type_idx" ON "dsx_requirements"("type" ASC);

-- CreateIndex
CREATE INDEX "package_services_packageId_idx" ON "package_services"("packageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "package_services_packageId_serviceId_key" ON "package_services"("packageId" ASC, "serviceId" ASC);

-- CreateIndex
CREATE INDEX "package_services_serviceId_idx" ON "package_services"("serviceId" ASC);

-- CreateIndex
CREATE INDEX "service_requirements_requirementId_idx" ON "service_requirements"("requirementId" ASC);

-- CreateIndex
CREATE INDEX "service_requirements_serviceId_idx" ON "service_requirements"("serviceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "service_requirements_serviceId_requirementId_key" ON "service_requirements"("serviceId" ASC, "requirementId" ASC);

-- CreateIndex
CREATE INDEX "services_createdById_idx" ON "services"("createdById" ASC);

-- CreateIndex
CREATE INDEX "services_updatedById_idx" ON "services"("updatedById" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "translations_labelKey_language_key" ON "translations"("labelKey" ASC, "language" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email" ASC);

-- CreateIndex
CREATE INDEX "workflow_sections_workflowId_idx" ON "workflow_sections"("workflowId" ASC);

-- CreateIndex
CREATE INDEX "workflows_createdById_idx" ON "workflows"("createdById" ASC);

-- CreateIndex
CREATE INDEX "workflows_packageId_idx" ON "workflows"("packageId" ASC);

-- CreateIndex
CREATE INDEX "workflows_updatedById_idx" ON "workflows"("updatedById" ASC);

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_services" ADD CONSTRAINT "customer_services_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customer_services" ADD CONSTRAINT "customer_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_masterAccountId_fkey" FOREIGN KEY ("masterAccountId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsx_availability" ADD CONSTRAINT "dsx_availability_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsx_availability" ADD CONSTRAINT "dsx_availability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsx_mappings" ADD CONSTRAINT "dsx_mappings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsx_mappings" ADD CONSTRAINT "dsx_mappings_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "dsx_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsx_mappings" ADD CONSTRAINT "dsx_mappings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "package_services" ADD CONSTRAINT "package_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_requirements" ADD CONSTRAINT "service_requirements_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "dsx_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requirements" ADD CONSTRAINT "service_requirements_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_sections" ADD CONSTRAINT "workflow_sections_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

