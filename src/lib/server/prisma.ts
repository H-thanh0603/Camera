import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 singleton — Rust-free client + driver adapter bắt buộc.
 * - postgres:// → node-pg pool (connectionTimeout 5s như v6).
 * - file: → better-sqlite3, resolve tương đối từ prisma/ (giữ semantics v6:
 *   file:./dev.db và file:../tests/e2e/.test.db đều chạy).
 * Tránh mở nhiều connection khi Next hot-reload trong dev.
 */

function createAdapter() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:/.test(url)) {
    return new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5_000 });
  }
  const here = dirname(fileURLToPath(import.meta.url)); // src/lib/server
  const dbPath = resolve(here, "../../../prisma", url.replace(/^file:/, ""));
  return new PrismaBetterSqlite3({ url: dbPath });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
