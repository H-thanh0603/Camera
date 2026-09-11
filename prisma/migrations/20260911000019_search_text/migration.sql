-- Văn bản tìm kiếm gộp không dấu (name/brand/subcategory/sku/tags)
ALTER TABLE "Product" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';
