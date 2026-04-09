-- CreateTable
CREATE TABLE "order_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_views_userId_orderId_key" ON "order_views"("userId", "orderId");

-- CreateIndex
CREATE INDEX "order_views_userId_idx" ON "order_views"("userId");

-- CreateIndex
CREATE INDEX "order_views_orderId_idx" ON "order_views"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_views_userId_orderItemId_key" ON "order_item_views"("userId", "orderItemId");

-- CreateIndex
CREATE INDEX "order_item_views_userId_idx" ON "order_item_views"("userId");

-- CreateIndex
CREATE INDEX "order_item_views_orderItemId_idx" ON "order_item_views"("orderItemId");

-- AddForeignKey
ALTER TABLE "order_views" ADD CONSTRAINT "order_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_views" ADD CONSTRAINT "order_views_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_views" ADD CONSTRAINT "order_item_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_views" ADD CONSTRAINT "order_item_views_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;