import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Prisma CLI resolve `file:` URL theo CWD, còn runtime client
 * (src/lib/server/prisma.ts) neo vào thư mục prisma/ — hai tầng này phải
 * trỏ cùng một DB (không thì CLI migrate vào root/dev.db nhưng app đọc
 * prisma/dev.db, và seed/E2E trong CI vỡ). Chuẩn hóa về prisma/ ở đây.
 */
function datasourceUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;
  const p = raw.slice("file:".length);
  if (path.isAbsolute(p)) return `file:${p}`;
  return `file:${path.resolve(repoRoot, "prisma", p)}`;
}

/**
 * Prisma 7: CLI đọc URL/schema/seed từ đây (datasource.url trong schema
 * đã bỏ). CI job postgres-check sed provider trong schema rồi chạy CLI —
 * config này giữ nguyên vì đọc DATABASE_URL từ env lúc chạy.
 *
 * KHÔNG dùng env("DATABASE_URL") — nó throw PrismaConfigEnvError khi thiếu,
 * làm `prisma generate` (postinstall của npm ci) fail trong CI trước khi
 * bước "Setup database" kịp chạy. `generate` không cần DB nên fallback để
 * qua được bước load config.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl(),
  },
});
