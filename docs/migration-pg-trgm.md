# Phase 2.2 — pg_trgm Full-Text Search Migration

> ✅ IMPLEMENTED (xem `src/lib/server/product-search-pg.ts`,
> `prisma/postgres-extensions.sql`, `scripts/smoke-trigram.ts`).
> Doc dưới giữ nguyên làm tài liệu thiết kế.

## Trigger
Khi cần search chính xác hơn contains (fuzzy, typo-tolerant, relevance scoring)
trên catalogue >1000 products.

## Trạng thái hiện tại
- SQLite: `{ contains: term }` — LIKE `%term%`, không index, case-insensitive
- Multi-term search: AND trên 4 cột (name, brand, subcategory, tagString)
- Kết quả satisfactory cho 18 products, sẽ chậm trên 1000+

## Mục tiêu
- Fuzzy search: "lumia" → "Lumina", "sonny" → "Sony"
- Relevance scoring: name match > brand match > tag match
- Giữ nguyên filter logic hiện tại (brands/categories/price/rating/tag)

## Implementation

### 1. Enable pg_trgm (Postgres only)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 2. Add GIN indexes
```sql
-- Search columns
CREATE INDEX idx_product_name_trgm ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX idx_product_brand_trgm ON "Product" USING gin (brand gin_trgm_ops);
CREATE INDEX idx_product_subcategory_trgm ON "Product" USING gin (subcategory gin_trgm_ops);
CREATE INDEX idx_product_tagstring_trgm ON "Product" USING gin ("tagString" gin_trgm_ops);
```

### 3. Code changes (`src/lib/server/product-db.ts`)
```typescript
// SQLite path (current): contains
if (dialect === "sqlite") {
  and.push({ OR: [
    { name: { contains: term } },
    { brand: { contains: term } },
    ...
  ]});
}

// Postgres path (new): trigram similarity
if (dialect === "postgres") {
  and.push({ OR: [
    { name: { mode: "insensitive", contains: term } },  // fallback
    // Prisma chưa support pg_trgm trực tiếp → raw SQL
  ]});
}
```

**Lưu ý**: Prisma không hỗ trợ `pg_trgm` operators trực tiếp.
Cần dùng `$queryRaw` hoặc extension:

```typescript
// Option A: Raw SQL cho search, Prisma cho filter
const results = await prisma.$queryRaw<Product[]>`
  SELECT p.* FROM "Product" p
  WHERE p.name % ${term} OR p.brand % ${term}
  ORDER BY similarity(p.name, ${term}) DESC
  LIMIT ${pageSize} OFFSET ${skip}
`;

// Option B: Prisma client extension (khuyến nghị)
const prismaTrgm = prisma.$extends({
  query: {
    product: {
      findMany({ args, query }) {
        // Inject trigram WHERE nếu có q
        return query(args);
      },
    },
  },
});
```

### 4. Search API response thêm relevance score
```typescript
// GET /api/products?q=lumia&sort=relevance
// → items sorted by pg_trgm similarity, not just contains
```

### 5. Fallback strategy
- SQLite dev: giữ contains (hoạt động OK)
- Postgres prod: dùng pg_trgm khi extension available
- Detection: `SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'`

## Rollback
- Drop GIN indexes
- Remove extension
- Code fallback về contains (already works)

## Effort
~2-3 ngày: extension setup, raw query integration, relevance sort, tests.

## Files affected
- `prisma/schema.prisma` — index definitions
- `src/lib/server/product-db.ts` — search logic branching
- `src/app/api/products/route.ts` — sort=relevance option
- `tests/` — search relevance tests
