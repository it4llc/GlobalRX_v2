-- CreateTable
CREATE TABLE "address_entries" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "street1" TEXT,
    "street2" TEXT,
    "city" TEXT NOT NULL,
    "stateId" TEXT,
    "countyId" TEXT,
    "postalCode" TEXT,
    "countryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "address_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city_mappings" (
    "id" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "stateId" TEXT,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_entries_customerId_idx" ON "address_entries"("customerId");

-- CreateIndex
CREATE INDEX "address_entries_orderId_idx" ON "address_entries"("orderId");

-- CreateIndex
CREATE INDEX "address_entries_city_idx" ON "address_entries"("city");

-- CreateIndex
CREATE INDEX "city_mappings_cityName_idx" ON "city_mappings"("cityName");

-- CreateIndex
CREATE INDEX "city_mappings_stateId_idx" ON "city_mappings"("stateId");

-- CreateIndex
CREATE UNIQUE INDEX "city_mappings_cityName_stateId_key" ON "city_mappings"("cityName", "stateId");

-- AddForeignKey
ALTER TABLE "address_entries" ADD CONSTRAINT "address_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_entries" ADD CONSTRAINT "address_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_entries" ADD CONSTRAINT "address_entries_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_entries" ADD CONSTRAINT "address_entries_countyId_fkey" FOREIGN KEY ("countyId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address_entries" ADD CONSTRAINT "address_entries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_mappings" ADD CONSTRAINT "city_mappings_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "city_mappings" ADD CONSTRAINT "city_mappings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
