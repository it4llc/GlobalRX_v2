-- CreateTable
CREATE TABLE "services_fulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "assignedVendorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "vendorNotes" TEXT,
    "internalNotes" TEXT,
    "assignedAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_fulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_audit_log" (
    "id" TEXT NOT NULL,
    "serviceFulfillmentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "notes" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_fulfillment_orderItemId_key" ON "services_fulfillment"("orderItemId");

-- CreateIndex
CREATE INDEX "services_fulfillment_orderId_idx" ON "services_fulfillment"("orderId");

-- CreateIndex
CREATE INDEX "services_fulfillment_orderItemId_idx" ON "services_fulfillment"("orderItemId");

-- CreateIndex
CREATE INDEX "services_fulfillment_assignedVendorId_idx" ON "services_fulfillment"("assignedVendorId");

-- CreateIndex
CREATE INDEX "services_fulfillment_status_idx" ON "services_fulfillment"("status");

-- CreateIndex
CREATE INDEX "service_audit_log_serviceFulfillmentId_idx" ON "service_audit_log"("serviceFulfillmentId");

-- CreateIndex
CREATE INDEX "service_audit_log_orderId_idx" ON "service_audit_log"("orderId");

-- CreateIndex
CREATE INDEX "service_audit_log_userId_idx" ON "service_audit_log"("userId");

-- CreateIndex
CREATE INDEX "service_audit_log_createdAt_idx" ON "service_audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "vendor_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services_fulfillment" ADD CONSTRAINT "services_fulfillment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_audit_log" ADD CONSTRAINT "service_audit_log_serviceFulfillmentId_fkey" FOREIGN KEY ("serviceFulfillmentId") REFERENCES "services_fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_audit_log" ADD CONSTRAINT "service_audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;