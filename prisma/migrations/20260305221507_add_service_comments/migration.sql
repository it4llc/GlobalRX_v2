-- CreateTable
CREATE TABLE "service_comments" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "finalText" VARCHAR(1000) NOT NULL,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "service_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_comments_serviceId_createdAt_idx" ON "service_comments"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "service_comments_serviceId_idx" ON "service_comments"("serviceId");

-- CreateIndex
CREATE INDEX "service_comments_createdBy_idx" ON "service_comments"("createdBy");

-- CreateIndex
CREATE INDEX "service_comments_createdAt_idx" ON "service_comments"("createdAt");

-- AddForeignKey
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services_fulfillment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "comment_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_comments" ADD CONSTRAINT "service_comments_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;