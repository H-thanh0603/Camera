/**
 * Smoke pg_trgm trên Postgres (CI postgres-check + prod sau deploy).
 * Chạy: DATABASE_URL="postgresql://..." npx tsx scripts/smoke-trigram.ts
 * Yêu cầu: schema đã db push + seed + prisma/postgres-extensions.sql.
 */
import { dbFacets, dbQueryProducts } from "../src/lib/server/product-db";
import { isPostgresDialect } from "../src/lib/server/product-search-pg";
import { prisma } from "../src/lib/server/prisma";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`SMOKE FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`SMOKE OK: ${msg}`);
}

async function main(): Promise<void> {
  assert(isPostgresDialect(), "dialect là postgres");

  const ext = await prisma.$queryRaw<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`;
  assert(ext.length === 1, "extension pg_trgm đã cài");

  const idx = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'Product' AND indexname LIKE 'idx_product_%_trgm'`;
  assert(idx.length === 4, `đủ 4 GIN index trigram (thấy ${idx.length})`);

  // Typo tolerance: "lumia" → Lumina
  const typo = await dbQueryProducts({ q: "lumia", pageSize: 12 });
  assert(typo.total > 0, `"lumia" tìm thấy ${typo.total} SP (typo-tolerant)`);
  assert(
    typo.items[0].brand === "Lumina" || typo.items[0].name.includes("Lumina"),
    `top-1 relevance là Lumina (được ${typo.items[0].name})`,
  );

  // Case-insensitive: "SONY" (contains SQLite-style trên PG sẽ miss)
  const ci = await dbQueryProducts({ q: "SONY", pageSize: 12 });
  assert(ci.total === 1 && ci.items[0].id === "p-sony-a1m2", `"SONY" ra đúng Sony A1 II`);

  // Multi-term AND
  const multi = await dbQueryProducts({ q: "medium format", pageSize: 60 });
  assert(multi.total === 2, `"medium format" ra 2 SP Hasselblad`);

  // Facets cùng WHERE trigram
  const facets = await dbFacets({ q: "leica" });
  assert(facets.brands.some((b) => b.value === "Leica"), "facets brand có Leica");

  // EXPLAIN dùng GIN index (không seq scan toàn bảng)
  const explain = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
    `EXPLAIN SELECT id FROM "Product" WHERE "name" % 'lumia'`,
  );
  const planText = explain.map((r) => r["QUERY PLAN"]).join("\n");
  assert(/trgm|Bitmap|Index Scan/i.test(planText), `EXPLAIN dùng index trigram:\n${planText}`);

  await prisma.$disconnect();
  console.log("TRIGRAM SMOKE: ALL GREEN");
}

main().catch((e) => {
  console.error("SMOKE FAIL:", e);
  process.exit(1);
});
