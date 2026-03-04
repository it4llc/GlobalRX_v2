-- CreateTable
CREATE TABLE "comment_templates" (
    "id" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "hasBeenUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "comment_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comment_templates_serviceCode_idx" ON "comment_templates"("serviceCode");

-- CreateIndex
CREATE INDEX "comment_templates_status_idx" ON "comment_templates"("status");

-- CreateIndex
CREATE INDEX "comment_templates_hasBeenUsed_idx" ON "comment_templates"("hasBeenUsed");

-- CreateIndex
CREATE INDEX "comment_templates_deletedAt_idx" ON "comment_templates"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "comment_templates_serviceCode_status_deletedAt_key" ON "comment_templates"("serviceCode", "status", "deletedAt");