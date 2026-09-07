/**
 * Restore DB từ file backup (ngược với db-backup.mjs).
 * - `.db` → copy vào target (mặc định file trong DATABASE_URL).
 * - `.sql` → psql vào database (Postgres).
 * - `.enc` → giải mã bằng BACKUP_ENCRYPTION_KEY trước.
 *
 * AN TOÀN: từ chối ghi đè DB đang dùng nếu không có --force.
 * Luôn tự backup hiện trạng trước khi restore (phòng restore nhầm).
 *
 * Dùng: node scripts/db-restore.mjs <backup-file> [--force] [--target <path|url>]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [file, ...rest] = process.argv.slice(2);
const FORCE = rest.includes("--force");
const targetFlag = rest.indexOf("--target");
const DATABASE_URL = process.env.DATABASE_URL ?? "";

if (!file || !existsSync(file)) {
  console.error("Dùng: node scripts/db-restore.mjs <backup-file> [--force] [--target <path|url>]");
  process.exit(1);
}

let src = file;
if (file.endsWith(".enc")) {
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    console.error("File mã hóa — cần BACKUP_ENCRYPTION_KEY.");
    process.exit(1);
  }
  src = file.replace(/\.enc$/, ".dec");
  execFileSync("openssl", [
    "enc", "-d", "-aes-256-cbc", "-pbkdf2",
    "-in", file, "-out", src,
    "-pass", "env:BACKUP_ENCRYPTION_KEY",
  ]);
  console.log(`Đã giải mã → ${src}`);
}

const isSql = src.endsWith(".sql");
// file: resolve tương đối từ prisma/ như Prisma (xem db-backup.mjs)
const liveTarget = isSql
  ? DATABASE_URL
  : join(process.cwd(), "prisma", DATABASE_URL.replace(/^file:/, "").replace(/^\.\//, ""));
const target = targetFlag >= 0 ? rest[targetFlag + 1] : liveTarget;

if (!FORCE && target === liveTarget) {
  console.error("Từ chối ghi đè DB đang dùng khi thiếu --force (an toàn).");
  console.error("Kiểm tra file backup trước bằng --target <file-tạm>, rồi chạy lại với --force.");
  process.exit(1);
}

if (isSql) {
  execFileSync("psql", [target, "-f", src], { stdio: "inherit" });
  console.log(`Restore Postgres xong vào ${target}`);
} else {
  copyFileSync(src, target);
  console.log(`Restore SQLite xong vào ${target}`);
}
