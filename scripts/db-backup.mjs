/**
 * Backup DB — chạy định kỳ (cron) trước khi deploy hoặc mỗi đêm.
 * - SQLite (dev/staging file): copy file + giữ N bản gần nhất.
 * - Postgres (production): pg_dump qua DATABASE_URL (cần `pg_dump` trong PATH).
 *
 * Dùng: node scripts/db-backup.mjs [--keep 7] [--dir ./backups]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const keepArg = args.indexOf("--keep");
const dirArg = args.indexOf("--dir");
const KEEP = keepArg >= 0 ? Number(args[keepArg + 1]) || 7 : 7;
const DIR = dirArg >= 0 ? args[dirArg + 1] : "./backups";
const DATABASE_URL = process.env.DATABASE_URL ?? "";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function prune(dir, keep) {
  const files = readdirSync(dir).filter((f) => f.startsWith("lumina-")).sort();
  while (files.length > keep) {
    const oldest = files.shift();
    if (oldest) rmSync(join(dir, oldest));
  }
}

mkdirSync(DIR, { recursive: true });

if (DATABASE_URL.startsWith("file:")) {
  const dbFile = DATABASE_URL.replace(/^file:/, "").replace(/^\.\//, "prisma/");
  const src = join(process.cwd(), DATABASE_URL.replace(/^file:/, ""));
  void dbFile;
  if (!existsSync(src)) {
    console.error(`Không tìm thấy DB file: ${src}`);
    process.exit(1);
  }
  const dest = join(DIR, `lumina-${stamp()}.db`);
  copyFileSync(src, dest);
  console.log(`Backup SQLite xong: ${dest}`);
  prune(DIR, KEEP);
} else if (/^postgres(ql)?:/.test(DATABASE_URL)) {
  const dest = join(DIR, `lumina-${stamp()}.sql`);
  try {
    execFileSync("pg_dump", [DATABASE_URL, "-f", dest], { stdio: "inherit" });
  } catch {
    console.error("pg_dump thất bại — kiểm tra PATH và DATABASE_URL.");
    process.exit(1);
  }
  console.log(`Backup Postgres xong: ${dest}`);
  prune(DIR, KEEP);
} else {
  console.error("DATABASE_URL không nhận diện được (file: hoặc postgres).");
  process.exit(1);
}
