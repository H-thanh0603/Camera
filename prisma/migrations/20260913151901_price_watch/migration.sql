-- CreateTable
CREATE TABLE "PriceWatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetPrice" INTEGER NOT NULL,
    "startPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredAt" DATETIME
);

-- CreateIndex
CREATE INDEX "PriceWatch_status_idx" ON "PriceWatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceWatch_sessionHash_productId_key" ON "PriceWatch"("sessionHash", "productId");
