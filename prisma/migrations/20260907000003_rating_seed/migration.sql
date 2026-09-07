-- Tách đánh giá nền (seed) khỏi aggregate review duyệt — chống phình rating
ALTER TABLE "Product" ADD COLUMN "seedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "seedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
-- Backfill: toàn bộ reviewCount/rating hiện tại coi là nền seed
UPDATE "Product" SET "seedCount" = "reviewCount", "seedTotal" = "rating" * "reviewCount";
