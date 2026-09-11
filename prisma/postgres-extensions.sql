-- Phase 2.2 — pg_trgm full-text search (Postgres only).
-- Chạy sau `prisma db push` lần đầu trên Postgres prod:
--   psql "$DATABASE_URL" -f prisma/postgres-extensions.sql
-- Idempotent: chạy lại an toàn. SQLite dev không dùng file này.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram cho 4 cột search (name/brand/subcategory/tagString)
CREATE INDEX IF NOT EXISTS idx_product_name_trgm ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_brand_trgm ON "Product" USING gin (brand gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_subcategory_trgm ON "Product" USING gin (subcategory gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_product_tagstring_trgm ON "Product" USING gin ("tagString" gin_trgm_ops);
-- GIN trigram cho cột gộp searchText (query không dấu + fuzzy 1 cột)
CREATE INDEX IF NOT EXISTS idx_product_searchtext_trgm ON "Product" USING gin ("searchText" gin_trgm_ops);
