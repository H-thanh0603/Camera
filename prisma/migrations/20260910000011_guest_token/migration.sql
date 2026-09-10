-- Thêm guestTokenHash cho đơn khách vãng lai (chống IDOR).
ALTER TABLE "Order" ADD COLUMN "guestTokenHash" TEXT;
CREATE UNIQUE INDEX "Order_guestTokenHash_key" ON "Order"("guestTokenHash");
