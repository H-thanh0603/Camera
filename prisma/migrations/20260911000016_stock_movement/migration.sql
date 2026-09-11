-- Sổ kho: mọi biến động tồn đều ghi dòng (đơn hàng, hủy, nhập tay)
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "refOrderId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
