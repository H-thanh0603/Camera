-- Index cho query nóng (xác nhận bằng EXPLAIN trên Postgres)
CREATE INDEX "Product_price_idx" ON "Product"("price");
CREATE INDEX "Product_rating_idx" ON "Product"("rating");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Review_productId_approved_idx" ON "Review"("productId", "approved");
