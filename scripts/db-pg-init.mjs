/**
 * Khởi tạo schema lần đầu trên Postgres production từ baseline đã verify.
 * (Xem docs/backup-drill-log.md — drill 2026-09-10 trên Postgres 18.)
 *
 * Lịch sử migrations trong repo là SQLite-only nên KHÔNG `migrate deploy`
 * lên Postgres. Thay vào đó: baseline SQL (sinh từ schema.postgres.prisma)
 * + extensions + seed. Từ sau lần này, mọi thay đổi schema PHẢI đi bằng
 * migration mới (không `db push` trực tiếp lên prod).
 *
 * Dùng: DATABASE_URL="postgresql://...?sslmode=require" \
 *   ADMIN_PASSWORD="<>=12 ky tu>" node scripts/db-pg-init.mjs [--seed]
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const SEED = args.includes("--seed");
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!/^postgres(ql)?:/.test(DATABASE_URL)) {
  console.error("DATABASE_URL phải là postgres (từ chối chạy lên SQLite).");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD (>=12 ký tự) là bắt buộc — chống seed mật khẩu mặc định.");
  process.exit(1);
}

const psql = (file) => {
  console.log(`Applying ${file}...`);
  execFileSync("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", file], { stdio: "inherit" });
};

psql("prisma/postgres-baseline.sql");
psql("prisma/postgres-extensions.sql");

if (SEED) {
  console.log("Seeding...");
  execFileSync("npx", ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });
}
console.log("db-pg-init: xong. Ghi lại _prisma_migrations nếu cần baseline cho migrate deploy về sau.");
