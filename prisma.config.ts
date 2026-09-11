import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7: CLI đọc URL/schema/seed từ đây (datasource.url trong schema
 * đã bỏ). CI job postgres-check sed provider trong schema rồi chạy CLI —
 * config này giữ nguyên vì đọc DATABASE_URL từ env lúc chạy.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
