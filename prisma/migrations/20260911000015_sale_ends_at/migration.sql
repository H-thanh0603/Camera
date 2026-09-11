-- Thêm ngày kết thúc KM (Offer priceValidUntil chỉ emit khi có giá sale + ngày tương lai)
ALTER TABLE "Product" ADD COLUMN "saleEndsAt" TIMESTAMP(3);
