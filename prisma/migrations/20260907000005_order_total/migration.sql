-- Cột vô hướng cho báo cáo doanh thu trong DB (thay vì reduce JSON ở JS)
ALTER TABLE "Order" ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0;
-- Backfill từ snapshot totals JSON hiện có
UPDATE "Order" SET "totalAmount" = CAST(json_extract("totals", '$.total') AS INTEGER);
