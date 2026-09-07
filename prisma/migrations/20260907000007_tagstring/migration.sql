-- Cột tag phi chuẩn hóa cho filter server-side (LIKE portable SQLite/PG)
ALTER TABLE "Product" ADD COLUMN "tagString" TEXT NOT NULL DEFAULT '|';
-- Backfill từ JSON tags: '|t1|t2|'
UPDATE "Product" SET "tagString" = COALESCE((SELECT '|' || group_concat(value, '|') || '|' FROM json_each("Product"."tags")), '|');
